import boto3
import botocore
from botocore.exceptions import ClientError
from datetime import datetime

"""
app_summary_table.put_item(
    Item={
        'app_id': app_id,
        'end_date': last_date,
        'google_id': google_id,
        'start_date': first_date,
        'date_range': date_range,
        'scores': scores_set,  # Converted to Decimal set
        'prompt': prompt,
        'summary': summary,
        'created_at': datetime.now().isoformat()
    }
)
"""
TABLE = "AppSummary"
REGION = "ap-northeast-2"          # 서울 리전
dynamodb = boto3.client("dynamodb", region_name=REGION)

# ────────────────────────────────────────────────────────────
# 1) 테이블 삭제 (존재할 때만)
# ────────────────────────────────────────────────────────────
try:
    dynamodb.delete_table(TableName=TABLE)
    print(f"[삭제] {TABLE} 테이블 삭제 요청 전송")
    waiter = dynamodb.get_waiter("table_not_exists")
    waiter.wait(TableName=TABLE)
    print(f"[삭제] {TABLE} 테이블 완전 삭제 확인")
except dynamodb.exceptions.ResourceNotFoundException:
    print(f"[삭제] 이미 존재하지 않음 → 건너뜀")

# ────────────────────────────────────────────────────────────
# 2) app_id와 end_date를 복합키로 사용하는 테이블 재생성
# ────────────────────────────────────────────────────────────
table_def = {
    "TableName": TABLE,
    "KeySchema": [
        {"AttributeName": "app_id", "KeyType": "HASH"},
        {"AttributeName": "end_date", "KeyType": "RANGE"}
    ],
    "AttributeDefinitions": [
        {"AttributeName": "app_id", "AttributeType": "S"},
        {"AttributeName": "end_date", "AttributeType": "S"}
    ],
    "BillingMode": "PAY_PER_REQUEST"
}
dynamodb.create_table(**table_def)
print(f"[생성] {TABLE} 테이블 재생성 완료(위임형 요금제)")
waiter = dynamodb.get_waiter("table_exists")
waiter.wait(TableName=TABLE)
print("[생성] ACTIVE 상태 진입 확인")

# ────────────────────────────────────────────────────────────
# 3) 예시 삽입: app_id와 end_date 기준으로 중복 완전 차단
# ────────────────────────────────────────────────────────────
item = {
    "app_id": {"S": "com.example.app"},
    "end_date": {"S": "2025-04-18"},
    "google_id": {"S": "user123"},
    "start_date": {"S": "2025-04-01"},
    "date_range": {"S": "2025-04-01~2025-04-18"},
    "scores": {"SS": ["4.5", "4.7", "4.2"]},
    "prompt": {"S": "앱 리뷰 요약을 생성해 주세요"},
    "summary": {"S": "사용자들은 이 앱의 사용성과 성능에 만족하고 있습니다."},
    "created_at": {"S": datetime.now().isoformat()}
}

try:
    dynamodb.put_item(
        TableName=TABLE,
        Item=item,
        ConditionExpression="attribute_not_exists(app_id) AND attribute_not_exists(end_date)"
    )
    print("[삽입] 중복 없이 성공")
except ClientError as e:
    if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
        print("[삽입] 동일 (app_id, end_date) 레코드가 이미 존재 → 거부")
    else:
        raise