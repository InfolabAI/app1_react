# server.py
from flask import Flask, request
import pandas as pd
from google_play_scraper import Sort, reviews
from manage_mysql import (
    HOST, USER, PASSWORD, DB_NAME, TABLE_NAME,
    create_db_and_table, insert_df_data, get_data_by_date_range
)

app_server = Flask(__name__)

# 서버 시작 시 미리 DB/테이블 준비
create_db_and_table(HOST, USER, PASSWORD, DB_NAME, TABLE_NAME)


@app_server.route("/reviews/<app_id>", methods=["GET"])
def get_reviews_by_app_id(app_id):
    """
    예: GET /reviews/com.nianticlabs.pokemongo
    1) <app_id>로 구글플레이에서 리뷰 스크래핑
    2) DB 저장(중복은 update)
    3) JSON 형태로 반환
    """

    # 1) 구글플레이에서 리뷰 스크래핑
    #    여기서는 가장 최신 리뷰 200개 중 별점 1인 것만 예시로 수집
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

    # 4) 방금 저장한 데이터(또는 전체)를 바로 JSON으로 반환
    #    여기선 "오늘" 날짜 등을 필터링할 수도 있지만,
    #    간단하게 스크래핑된 df_tmp 자체를 JSON으로 변환해 반환
    #    (DB에서 다시 불러오고 싶다면 get_data_by_date_range 등을 활용)
    json_str = df_tmp.to_json(orient='records', force_ascii=False)

    return json_str, 200, {"Content-Type": "application/json; charset=utf-8"}


if __name__ == "__main__":
    # Flask 서버 실행
    app_server.run(host="0.0.0.0", port=5000, debug=True)
