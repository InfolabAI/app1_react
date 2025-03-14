# client.py
import requests
import json


def get_app_reviews(app_id, server_host="127.0.0.1", port=5000):
    """
    Flask 서버에서 제공하는 /reviews/<app_id> 엔드포인트에 GET 요청을 보냅니다.
    JSON으로 반환된 리뷰 데이터를 파이썬 객체로 반환합니다.
    """
    url = f"http://{server_host}:{port}/reviews/{app_id}"
    response = requests.get(url)

    if response.status_code == 200:
        # 응답 본문(JSON 문자열)을 파이썬 리스트/딕셔너리로 파싱
        try:
            data = response.json()
            return data
        except json.JSONDecodeError as e:
            print("[ERROR] JSON 디코딩 실패:", e)
            return None
    else:
        print("[ERROR] 응답 코드:", response.status_code)
        return None


if __name__ == "__main__":
    # 사용 예시: 서버가 localhost:5000에서 구동 중이라고 가정
    target_app_id = "com.nianticlabs.pokemongo"

    # 서버로 요청
    reviews_data = get_app_reviews(target_app_id)

    # 결과 확인
    if reviews_data:
        print("리뷰 데이터 개수:", len(reviews_data))
        # 예: 첫 번째 리뷰 내용 출력
        if len(reviews_data) > 0:
            print("첫 번째 리뷰:", reviews_data[0])
    else:
        print("리뷰 데이터를 가져오지 못했습니다.")
