import json
from google_play_scraper import Sort, reviews
import pandas as pd

print('Loading function')


def lambda_handler(event, context):
    try:
        # app_id = event['body']['app_id']
        # event['body'] 내부의 JSON 문자열을 딕셔너리로 변환
        body_dict = json.loads(event.get('body', '{}'))

        # 'app_id' 추출
        app_id = body_dict.get('app_id')

        # 간단 예시: 요청 + HTML <title> 추출
        result_list, continuation_token = reviews(
            app_id,
            lang='ko',       # 한국어
            country='kr',    # 한국
            sort=Sort.NEWEST,
            count=200,
            filter_score_with=1
        )

        # 2) DataFrame 생성 (일자, 점수, 내용만 추출 예시)
        df = pd.DataFrame(result_list)
        if df.empty:
            # 혹시 스크래핑 결과가 없을 경우
            return "No Reviews Found", 200

        df_tmp = df[['at', 'score', 'content']]
        df_tmp['at'] = df_tmp['at'].astype(str)

        # 4) 방금 저장한 데이터(또는 전체)를 바로 JSON으로 반환
        #    여기선 "오늘" 날짜 등을 필터링할 수도 있지만,
        #    간단하게 스크래핑된 df_tmp 자체를 JSON으로 변환해 반환
        #    (DB에서 다시 불러오고 싶다면 get_data_by_date_range 등을 활용)
        json_str = df_tmp.to_json(orient='records', force_ascii=False)
        # Supabase DB 저장
        # data = supabase.table("crawled_data").insert({
        #    "url": target_url,
        #    "content": title
        # }).execute()

        # 결과 반환
        return {
            "statusCode": 200,
            "body": json_str
        }

    except Exception as e:
        err = f"{str(e)}, {str(event)}"
        return {
            "statusCode": 500,
            "body": json.dumps({"error": err})
        }
