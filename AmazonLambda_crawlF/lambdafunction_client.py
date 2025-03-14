# test_client.py
import requests
import json


def main():
    # API Gateway 엔드포인트 URL
    url = "https://2frhmnck64.execute-api.ap-northeast-2.amazonaws.com/crawlF"

    # 호출할 앱의 packageName (Google Play ID)
    # 예) 'com.nianticlabs.pokemongo' 등
    payload = {
        "app_id": "com.nianticlabs.pokemongo"
    }

    try:
        # POST 요청으로 JSON 데이터를 보냄
        response = requests.post(url, json=payload)

        # 상태 코드 확인
        print("Status Code:", response.status_code)

        if response.ok:
            # 응답 본문(JSON) 파싱
            data = response.json()
            print("Response JSON:")
            print(json.dumps(data, ensure_ascii=False, indent=2))
        else:
            print("Error occurred:", response.text)

    except Exception as e:
        print("Exception:", str(e))


if __name__ == "__main__":
    main()
