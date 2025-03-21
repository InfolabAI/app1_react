import json
from google_play_scraper import Sort, reviews
import pandas as pd
from llm import LLM

PROMPT = "아래 리뷰 내용들을 마크 다운 보고서로 요약해주세요. 헤더 # 2개(1. 주요 문제점 2. 개선 아이디어). 각 헤더 # 마다, 하위 헤더 ## 를 통해 상세 내용 작성. 개선 아이디어 헤더에서는 해결하려는 문제 헤더 ## 마다 구현 ### 난이도 상, ### 난이도 중, ### 난이도 하 헤더로 아이디어 제공.\n"


def cover_api_and_invoke(event, context):
    # 아래 2가지 경우를 동일하게 처리하기 위함
    # 1. API gateway 를 통해서 받은 event: '{"body": "{\"app_id\": \"com.nianticlabs.pokemongo\"}"}' \ # 그래서 json.loads(event) 를 해야 함
    # 2. aws invoke --payload 를 통해서 받은 event: { "app_id": "com.nianticlabs.pokemongo" } # 그래서 json.loads(event) 를 하면 에러 발생

    # API Gateway에서 호출된 경우 (body가 문자열)
    if isinstance(event.get('body'), str):
        body_dict = json.loads(event.get('body', '{}'))
    # 직접 Lambda invoke로 호출된 경우 (body가 없거나 event 자체가 데이터)
    elif event.get('body') and isinstance(event.get('body'), dict):
        # body가 딕셔너리인 경우
        body_dict = event['body']
    else:
        # 혹시 스크래핑 결과가 없을 경우
        raise Exception("'body' is not found in input")

    return body_dict


def lambda_handler(event, context):
    try:
        # app_id = event['body']['app_id']
        # event['body'] 내부의 JSON 문자열을 딕셔너리로 변환

        # 'app_id' 추출
        body_dict = cover_api_and_invoke(event, context)
        print(f"body: {body_dict}")

        app_id = body_dict.get('app_id')
        print(f"app_id: {app_id}")
        is_summary = body_dict.get('is_summary')
        print(f"is_summary: {is_summary}")

        # 간단 예시: 요청 + HTML <title> 추출
        result_list, continuation_token = reviews(
            app_id,
            lang='ko',       # 한국어
            country='kr',    # 한국
            sort=Sort.NEWEST,
            count=200,
            filter_score_with=1
        )
        print(f"result_list: {result_list[0]}")

        # Supabase DB 저장
        # data = supabase.table("crawled_data").insert({
        #    "url": target_url,
        #    "content": title
        # }).execute()

        # DataFrame 생성 (일자, 점수, 내용만 추출 예시)
        df = pd.DataFrame(result_list)
        if df.empty:
            # 혹시 스크래핑 결과가 없을 경우
            return "No Reviews Found", 200

        df_tmp = df[['at', 'score', 'content']]
        df_tmp = df_tmp.rename(columns={'at': 'date'})

        if is_summary == "true":
            # summarize by using LLM
            llm = LLM()
            first_date = df_tmp['date'].iloc[0].strftime('%Y-%m-%d')
            last_date = df_tmp['date'].iloc[-1].strftime('%Y-%m-%d')
            prompt = PROMPT + f"아래는 {first_date}부터 {last_date}까지의 리뷰들입니다."
            text_list = df_tmp['content'].to_list()
            selected_text_list = llm.sampling(text_list)
            print(f"len of selected_text_list: {len(selected_text_list)}")
            selected_texts = ' '.join(selected_text_list)
            body_str = llm(prompt, selected_texts)
        elif is_summary == "false":
            # 4) 방금 저장한 데이터(또는 전체)를 바로 JSON 으로 변환 후, 다시 string 으로 변환. POST 에서 body 는 string 이어야 함
            df_tmp['date'] = df_tmp['date'].astype(str)
            body_str = df_tmp.to_json(orient='records', force_ascii=False)
        else:
            raise ValueError("is_summary should be 'true' or 'false'")

        # 결과 반환
        return {
            "statusCode": 200,
            "body": body_str
        }

    except Exception as e:
        err = f"{str(e)}, {str(event)}"
        return {
            "statusCode": 500,
            "body": json.dumps({"error": err})
        }


if __name__ == "__main__":
    event = {
        "body": {
            "app_id": "com.nianticlabs.pokemongo",
            "is_summary": "true"
        }
    }
    response = lambda_handler(event, None)
    print(response['body'])
