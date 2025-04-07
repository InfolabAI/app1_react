import boto3

"""
아래 내용으로 DynamoDB 테이블 생성하는 python 코드 요청
<시작코드>
import boto3
dynamodb = boto3.resource('dynamodb')

<테이블 정보>
사용자 테이블: TableName='User'
- id (PK): 자체 생성한 고유 ID
- google_id (PK): 구글에서 제공한 고유 ID (sub)
- email: 사용자 이메일
- created_at: 계정 생성 시간
- last_login: 마지막 로그인 시간

사용자 요약 데이터 테이블: TableName='AppReviewSummary'
- id (PK): 데이터 고유 ID
- user_id (FK): 사용자 테이블의 id 참조
- summary: 사용자 데이터
- created_at: 생성 시간
"""

# DynamoDB 리소스 생성
dynamodb = boto3.resource('dynamodb')

# User 테이블 생성
def create_user_table():
    table = dynamodb.create_table(
        TableName='User',
        KeySchema=[
            {
                'AttributeName': 'id',
                'KeyType': 'HASH'  # 파티션 키
            }
        ],
        AttributeDefinitions=[
            {
                'AttributeName': 'id',
                'AttributeType': 'S'
            },
            {
                'AttributeName': 'google_id',
                'AttributeType': 'S'
            }
        ],
        GlobalSecondaryIndexes=[
            {
                'IndexName': 'GoogleIdIndex',
                'KeySchema': [
                    {
                        'AttributeName': 'google_id',
                        'KeyType': 'HASH'
                    },
                ],
                'Projection': {
                    'ProjectionType': 'ALL'
                },
                'ProvisionedThroughput': {
                    'ReadCapacityUnits': 5,
                    'WriteCapacityUnits': 5
                }
            }
        ],
        ProvisionedThroughput={
            'ReadCapacityUnits': 5,
            'WriteCapacityUnits': 5
        }
    )
    
    print(f"테이블 {table.table_name}이(가) 생성되었습니다.")
    return table

# AppReviewSummary 테이블 생성
def create_app_review_summary_table():
    table = dynamodb.create_table(
        TableName='AppReviewSummary',
        KeySchema=[
            {
                'AttributeName': 'id',
                'KeyType': 'HASH'  # 파티션 키
            }
        ],
        AttributeDefinitions=[
            {
                'AttributeName': 'id',
                'AttributeType': 'S'
            },
            {
                'AttributeName': 'user_id',
                'AttributeType': 'S'
            }
        ],
        GlobalSecondaryIndexes=[
            {
                'IndexName': 'UserIdIndex',
                'KeySchema': [
                    {
                        'AttributeName': 'user_id',
                        'KeyType': 'HASH'
                    },
                ],
                'Projection': {
                    'ProjectionType': 'ALL'
                },
                'ProvisionedThroughput': {
                    'ReadCapacityUnits': 5,
                    'WriteCapacityUnits': 5
                }
            }
        ],
        ProvisionedThroughput={
            'ReadCapacityUnits': 5,
            'WriteCapacityUnits': 5
        }
    )
    
    print(f"테이블 {table.table_name}이(가) 생성되었습니다.")
    return table

# 테이블 생성 실행
if __name__ == '__main__':
    try:
        user_table = create_user_table()
        app_review_summary_table = create_app_review_summary_table()

        # 테이블 생성 완료 대기
        user_table.meta.client.get_waiter('table_exists').wait(TableName='User')
        app_review_summary_table.meta.client.get_waiter('table_exists').wait(TableName='AppReviewSummary')
        
        print("모든 테이블이 성공적으로 생성되었습니다.")
    except Exception as e:
        print(f"테이블 생성 중 오류가 발생했습니다: {e}")

print("모든 테이블이 생성되었습니다.")
