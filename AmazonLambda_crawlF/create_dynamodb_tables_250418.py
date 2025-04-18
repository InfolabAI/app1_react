import boto3
import botocore
from botocore.exceptions import ClientError

TABLE = "AppReview"
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
# 2) 테이블 재생성
# ────────────────────────────────────────────────────────────
table_def = {
    "TableName": TABLE,
    "KeySchema": [
        {"AttributeName": "app_id", "KeyType": "HASH"},
        {"AttributeName": "date_user_id", "KeyType": "RANGE"}
    ],
    "AttributeDefinitions": [
        {"AttributeName": "app_id", "AttributeType": "S"},
        {"AttributeName": "date_user_id", "AttributeType": "S"}
    ],
    "BillingMode": "PAY_PER_REQUEST"
}
dynamodb.create_table(**table_def)
print(f"[생성] {TABLE} 테이블 재생성 완료(위임형 요금제)")
waiter = dynamodb.get_waiter("table_exists")
waiter.wait(TableName=TABLE)
print("[생성] ACTIVE 상태 진입 확인")

# ────────────────────────────────────────────────────────────
# 3) 예시 삽입: 중복 완전 차단
# ────────────────────────────────────────────────────────────
item = {
    "app_id": {"S": "com.example.app"},
    "date_user_id": {"S": "2025-04-18#alice"},
    "rating": {"N": "5"},
    "content": {"S": "훌륭한 앱입니다."}
}

try:
    dynamodb.put_item(
        TableName=TABLE,
        Item=item,
        ConditionExpression="attribute_not_exists(app_id) AND attribute_not_exists(date_user_id)"
    )
    print("[삽입] 중복 없이 성공")
except ClientError as e:
    if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
        print("[삽입] 동일 (app_id, date_user_id) 레코드가 이미 존재 → 거부")
    else:
        raise
