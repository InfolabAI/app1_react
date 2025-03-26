import json
import boto3
from boto3.dynamodb.conditions import Key, Attr
from google_play_scraper import Sort, reviews
import pandas as pd
from llm import LLM
from datetime import datetime, timedelta
from decimal import Decimal

# 상수 정의
PROMPT = "아래 리뷰 내용들을 마크 다운 보고서로 요약해주세요. 헤더 # 3개(1. 요약 기간 2. 주요 문제점 3. 개선 아이디어). 각 헤더 # 마다, 하위 헤더 ## 를 통해 상세 내용 작성. 개선 아이디어 헤더에서는 해결하려는 문제 헤더 ## 마다 구현 ### 난이도 상, ### 난이도 중, ### 난이도 하 헤더로 아이디어 제공.\n"

# DynamoDB 리소스 초기화
dynamodb = boto3.resource('dynamodb')
app_info_table = dynamodb.Table('AppInfo')
app_review_table = dynamodb.Table('AppReview')
app_summary_table = dynamodb.Table('AppSummary')

# 요청 본문 파싱 함수


def cover_api_and_invoke(event, context):
    if isinstance(event.get('body'), str):
        body_dict = json.loads(event.get('body', '{}'))
    elif event.get('body') and isinstance(event.get('body'), dict):
        body_dict = event['body']
    else:
        raise Exception("'body' is not found in input")
    return body_dict

# 앱 정보 관련 함수들


def get_all_app_info():
    """모든 앱 정보 조회"""
    try:
        response = app_info_table.scan()
        return response.get('Items', [])
    except Exception as e:
        print(f"앱 정보 조회 중 오류: {str(e)}")
        raise e


def get_app_info(app_id):
    """특정 앱 정보 조회"""
    try:
        response = app_info_table.get_item(
            Key={'app_id': app_id}
        )
        return response.get('Item')
    except Exception as e:
        print(f"앱 정보 조회 중 오류 (app_id={app_id}): {str(e)}")
        raise e


def add_app_info(app_info_data):
    """앱 정보 추가"""
    app_id = app_info_data.get('app_id')
    app_name = app_info_data.get('app_name')
    app_logo = app_info_data.get('app_logo')

    # 필수 정보 검증
    if not app_id or not app_name:
        raise ValueError("app_id와 app_name은 필수 입력값입니다.")

    # 중복 체크
    existing_app = get_app_info(app_id)
    if existing_app:
        return {
            "success": False,
            "message": f"이미 존재하는 앱 ID입니다: {app_id}"
        }

    # 새 앱 정보 저장
    try:
        app_info_table.put_item(
            Item={
                'app_id': app_id,
                'app_name': app_name,
                'app_logo': app_logo if app_logo else "",
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
        )
        return {
            "success": True,
            "message": f"앱 정보가 성공적으로 등록되었습니다: {app_name}"
        }
    except Exception as e:
        print(f"앱 정보 등록 중 오류: {str(e)}")
        raise e

# 리뷰 관련 함수들


def get_latest_review_date(app_id):
    """특정 앱의 가장 최신 리뷰 날짜 조회"""
    try:
        response = app_review_table.query(
            KeyConditionExpression=Key('app_id').eq(app_id),
            ScanIndexForward=False,  # 내림차순 정렬
            Limit=1
        )

        items = response.get('Items', [])
        if items:
            return items[0].get('date')
        return None
    except Exception as e:
        print(f"최신 리뷰 날짜 조회 중 오류 (app_id={app_id}): {str(e)}")
        return None


def get_app_reviews(app_id):
    """특정 앱의 모든 리뷰 조회"""
    try:
        all_reviews = []
        last_evaluated_key = None

        while True:
            if last_evaluated_key:
                response = app_review_table.query(
                    KeyConditionExpression=Key('app_id').eq(app_id),
                    ExclusiveStartKey=last_evaluated_key
                )
            else:
                response = app_review_table.query(
                    KeyConditionExpression=Key('app_id').eq(app_id)
                )

            all_reviews.extend(response.get('Items', []))
            last_evaluated_key = response.get('LastEvaluatedKey')

            if not last_evaluated_key:
                break

        return all_reviews
    except Exception as e:
        print(f"앱 리뷰 조회 중 오류 (app_id={app_id}): {str(e)}")
        raise e


def fetch_and_save_new_reviews(app_id, latest_review_date=None):
    """스토어에서 새 리뷰를 가져와 중복 없이 DB에 저장"""
    try:
        # 기존에 저장된 리뷰 정보 가져오기 (중복 체크용)
        existing_reviews = get_app_reviews(app_id)

        # 기존 리뷰의 고유 식별자 세트 생성 (리뷰ID, 사용자이름+내용)
        existing_review_ids = set()
        existing_review_signatures = set()

        for review in existing_reviews:
            # 리뷰 ID가 있으면 사용 (없으면 대체 식별자 생성)
            if 'reviewId' in review:
                existing_review_ids.add(review['reviewId'])

            # 추가 안전장치: 사용자명 + 내용의 첫 100자를 조합한 식별자
            username = review.get('username', 'anonymous')
            content = review.get('content', '')[:100]  # 내용 앞부분만 사용
            review_signature = f"{username}:{content}"
            existing_review_signatures.add(review_signature)

        print(f"기존 저장된 리뷰 수: {len(existing_reviews)}")

        # Google Play 스토어에서 리뷰 가져오기
        result_list, continuation_token = reviews(
            app_id,
            lang='ko',
            country='kr',
            sort=Sort.NEWEST,
            count=200,
            filter_score_with=None  # 모든 점수 가져오기
        )

        # 리뷰가 없으면 빈 리스트 반환
        if not result_list:
            print("가져온 리뷰가 없습니다.")
            return []

        print(f"Google Play에서 가져온 총 리뷰 수: {len(result_list)}")

        # 새 리뷰만 필터링
        new_reviews = []
        for review in result_list:
            review_id = review.get('reviewId', '')

            # 대체 식별자 생성
            username = review.get('userName', 'anonymous')
            content = review.get('content', '')[:100]
            review_signature = f"{username}:{content}"

            # 날짜 기준 필터링 (입력된 경우)
            date_filter_passed = True
            if latest_review_date:
                latest_date = datetime.fromisoformat(latest_review_date)
                review_date = review['at']
                if review_date <= latest_date:
                    date_filter_passed = False

            # 중복 체크: reviewId 또는 대체 식별자로 확인
            is_duplicate = (
                (review_id and review_id in existing_review_ids) or
                (review_signature in existing_review_signatures)
            )

            if date_filter_passed and not is_duplicate:
                new_reviews.append(review)

        print(f"중복 제거 후 저장할 새 리뷰 수: {len(new_reviews)}")

        # DynamoDB에 새 리뷰 저장
        if new_reviews:
            save_reviews_to_dynamodb(app_id, new_reviews)

        return new_reviews
    except Exception as e:
        print(f"새 리뷰 가져오기 중 오류 (app_id={app_id}): {str(e)}")
        raise e


def save_reviews_to_dynamodb(app_id, reviews_data):
    """리뷰 데이터를 DynamoDB에 저장 (중복 검사 포함)"""
    try:
        # 이미 저장된 키 목록을 가져오기 위한 준비
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table('AppReview')

        # 저장된 리뷰 수 추적
        saved_count = 0

        batch_size = 25  # DynamoDB 배치 작업 한계
        for i in range(0, len(reviews_data), batch_size):
            batch = reviews_data[i:i+batch_size]

            # 배치 작성기 사용
            with table.batch_writer() as batch_writer:
                for review in batch:
                    date_obj = review['at']
                    date_str = date_obj.strftime('%Y-%m-%d')
                    username = review.get('userName', 'anonymous')

                    # 복합 키 생성
                    date_user_id = f"{date_str}#{username}"

                    # float를 Decimal로 변환
                    score = Decimal(str(review['score']))

                    # reviewId가 있으면 저장 (Google Play의 고유 식별자)
                    review_id = review.get(
                        'reviewId', f"generated-{date_user_id}")

                    # 저장 전 중복 확인 (선택 사항 - 성능 고려)
                    try:
                        # 중복 체크는 옵션입니다. 필요시 주석 해제하세요.
                        # response = table.get_item(
                        #     Key={'app_id': app_id, 'date_user_id': date_user_id}
                        # )
                        # if 'Item' in response:
                        #     continue  # 이미 존재하면 건너뜀

                        # 중복이 아니라고 판단되어 저장
                        batch_writer.put_item(
                            Item={
                                'app_id': app_id,
                                'date_user_id': date_user_id,
                                'date': date_obj.isoformat(),
                                'username': username,
                                'score': score,
                                'content': review['content'],
                                'reviewId': review_id,  # 고유 식별자 저장
                                'created_at': datetime.now().isoformat()
                            }
                        )
                        saved_count += 1
                    except Exception as item_error:
                        print(f"개별 리뷰 저장 중 오류: {str(item_error)}")

        print(f"총 {saved_count}개 리뷰 저장 완료")
        return True
    except Exception as e:
        print(f"리뷰 저장 중 오류: {str(e)}")
        raise e

# 요약 관련 함수들


def get_latest_summary(app_id):
    """특정 앱의 가장 최신 요약 조회"""
    try:
        response = app_summary_table.query(
            KeyConditionExpression=Key('app_id').eq(app_id),
            ScanIndexForward=False,  # 내림차순 정렬
            Limit=1
        )

        items = response.get('Items', [])
        if items:
            return items[0]
        return None
    except Exception as e:
        print(f"최신 요약 조회 중 오류 (app_id={app_id}): {str(e)}")
        return None


def generate_and_save_summary(app_id, reviews=None):
    """리뷰 요약 생성 및 저장"""
    try:
        # 리뷰 데이터가 없으면 DB에서 가져오기
        if not reviews:
            reviews = get_app_reviews(app_id)

        if not reviews:
            return {
                "success": False,
                "message": "요약할 리뷰가 없습니다."
            }

        # 리뷰 데이터 변환
        df = pd.DataFrame(reviews)
        df['date'] = pd.to_datetime(df['date'])

        # 요약 날짜 범위 계산
        first_date = df['date'].min().strftime('%Y-%m-%d')
        last_date = df['date'].max().strftime('%Y-%m-%d')

        # LLM 요약 생성
        llm = LLM()
        prompt = PROMPT + f"아래는 {first_date}부터 {last_date}까지의 리뷰들입니다."

        # 리뷰 내용 추출
        text_list = df['content'].tolist()
        selected_text_list = llm.sampling(text_list)
        selected_texts = ' '.join(selected_text_list)

        # 요약 생성
        summary = llm(prompt, selected_texts)

        # 요약 정보 DynamoDB에 저장
        # 중요: float를 Decimal로 변환
        scores_set = set()
        for score in df['score'].unique():
            # score가 이미 Decimal이면 그대로 사용, 아니면 Decimal로 변환
            if isinstance(score, Decimal):
                scores_set.add(score)
            else:
                scores_set.add(Decimal(str(score)))

        date_range = f"{first_date}#{last_date}"

        app_summary_table.put_item(
            Item={
                'app_id': app_id,
                'date_range': date_range,
                'start_date': first_date,
                'end_date': last_date,
                'scores': scores_set,  # Decimal 세트로 변환된 값
                'prompt': prompt,
                'summary': summary,
                'created_at': datetime.now().isoformat()
            }
        )

        return {
            "success": True,
            "summary": summary,
            "date_range": f"{first_date} ~ {last_date}",
            "review_count": len(reviews)
        }
    except Exception as e:
        print(f"요약 생성 및 저장 중 오류 (app_id={app_id}): {str(e)}")
        raise e

# 메인 Lambda 핸들러 함수


def lambda_handler(event, context):
    try:
        # 요청 본문 파싱
        body_dict = cover_api_and_invoke(event, context)
        print(f"요청 본문: {body_dict}")

        # 요청 타입 확인
        request_type = body_dict.get('request_type')
        if not request_type:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "요청 타입(request_type)이 필요합니다."})
            }

        # 1. 앱 정보 조회
        if request_type == 'app_info_read':
            app_id = body_dict.get('app_id')

            if app_id:
                # 특정 앱 정보 조회
                app_info = get_app_info(app_id)
                if not app_info:
                    return {
                        "statusCode": 404,
                        "body": json.dumps({"error": f"앱 ID '{app_id}'를 찾을 수 없습니다."})
                    }
                response_data = {"app_info": app_info}
            else:
                # 모든 앱 정보 조회
                all_apps = get_all_app_info()
                response_data = {"apps": all_apps}

            return {
                "statusCode": 200,
                "body": json.dumps(response_data, default=str)
            }

        # 2. 앱 정보 등록
        elif request_type == 'app_info_add':
            result = add_app_info(body_dict)

            if result["success"]:
                return {
                    "statusCode": 201,
                    "body": json.dumps(result, default=str)
                }
            else:
                return {
                    "statusCode": 400,
                    "body": json.dumps(result)
                }

        # 3. 리뷰 정보 조회
        elif request_type == 'app_review_read':
            app_id = body_dict.get('app_id')

            if not app_id:
                return {
                    "statusCode": 400,
                    "body": json.dumps({"error": "app_id 파라미터가 필요합니다."})
                }

            # 앱 존재 확인
            app_info = get_app_info(app_id)
            if not app_info:
                return {
                    "statusCode": 404,
                    "body": json.dumps({"error": f"앱 ID '{app_id}'를 찾을 수 없습니다."})
                }

            # 최신 리뷰 날짜 확인
            latest_review_date = get_latest_review_date(app_id)
            today = datetime.now()

            new_reviews_added = False

            # 저장된 리뷰가 없거나 오늘 날짜보다 이전인 경우 새 리뷰 가져오기
            if not latest_review_date or datetime.fromisoformat(latest_review_date).date() < today.date():
                print(
                    f"새 리뷰 가져오기: app_id={app_id}, latest_review_date={latest_review_date}")
                new_reviews = fetch_and_save_new_reviews(
                    app_id, latest_review_date)
                if new_reviews:
                    new_reviews_added = True
                    print(f"새 리뷰 {len(new_reviews)}개 저장 완료")

            # 모든 리뷰 조회 (새로 추가된 리뷰 포함)
            all_reviews = get_app_reviews(app_id)

            return {
                "statusCode": 200,
                "body": json.dumps({
                    "reviews": all_reviews,
                    "count": len(all_reviews),
                    "new_reviews_added": new_reviews_added
                }, default=str)
            }

        # 4. 리뷰 요약 요청
        elif request_type == 'summary':
            app_id = body_dict.get('app_id')

            if not app_id:
                return {
                    "statusCode": 400,
                    "body": json.dumps({"error": "app_id 파라미터가 필요합니다."})
                }

            # 앱 존재 확인
            app_info = get_app_info(app_id)
            if not app_info:
                return {
                    "statusCode": 404,
                    "body": json.dumps({"error": f"앱 ID '{app_id}'를 찾을 수 없습니다."})
                }

            # 새 리뷰 확인 및 가져오기
            latest_review_date = get_latest_review_date(app_id)
            today = datetime.now()

            if not latest_review_date or datetime.fromisoformat(latest_review_date).date() < today.date():
                fetch_and_save_new_reviews(app_id, latest_review_date)

            # 요약 생성 및 저장
            summary_result = generate_and_save_summary(app_id)

            return {
                "statusCode": 200,
                "body": json.dumps(summary_result, default=str)
            }

        else:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": f"지원하지 않는 요청 타입: {request_type}"})
            }

    except ValueError as ve:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": str(ve)})
        }
    except Exception as e:
        error_message = f"{str(e)}, event={str(event)}"
        print(f"오류 발생: {error_message}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": error_message})
        }


# 로컬 테스트용 코드
if __name__ == "__main__":
    # 앱 정보 조회 테스트
    event1 = {
        "body": {
            "request_type": "app_info_read"
        }
    }

    # 앱 정보 등록 테스트
    event2 = {
        "body": {
            "request_type": "app_info_add",
            "app_id": "com.nianticlabs.pokemongo",
            "app_name": "Pokémon GO",
            "app_logo": "https://play-lh.googleusercontent.com/bE4FJRKJO_FhT6IcHyo3bKMfLvREP9vkBME3BaMktz8kZJrkYnq4933Ml6avuNwW_No=s48-rw"
        }
    }

    # 리뷰 정보 조회 테스트
    event3 = {
        "body": {
            "request_type": "app_review_read",
            "app_id": "com.nianticlabs.pokemongo"
        }
    }

    # 리뷰 요약 테스트
    event4 = { "body": { "request_type": "summary", "app_id": "com.nianticlabs.pokemongo" } }

    # 여기에서 원하는 테스트 이벤트 선택
    test_event = event4
    response = lambda_handler(test_event, None)
    breakpoint()
    print(json.dumps(response, indent=2))
