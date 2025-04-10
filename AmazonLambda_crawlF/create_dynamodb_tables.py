import boto3

# DynamoDB 클라이언트 생성
dynamodb = boto3.resource('dynamodb')

# AppInfo 테이블 생성
app_info_table = dynamodb.create_table(
    TableName='AppInfo',
    KeySchema=[
        {
            'AttributeName': 'app_id',
            'KeyType': 'HASH'  # 파티션 키 = Primary Key
        }
    ],
    AttributeDefinitions=[
        {
            'AttributeName': 'app_id',
            'AttributeType': 'S'  # String 타입
        }
    ],
    BillingMode='PAY_PER_REQUEST'
)

# AppReview 테이블 생성
app_review_table = dynamodb.create_table(
    TableName='AppReview',
    KeySchema=[
        {
            'AttributeName': 'app_id',
            'KeyType': 'HASH'  # 파티션 키
        },
        {
            'AttributeName': 'date_user_id',  # 날짜와 유저이름 결합
            'KeyType': 'RANGE'  # 정렬 키
        }
    ],
    AttributeDefinitions=[
        {
            'AttributeName': 'app_id',
            'AttributeType': 'S'
        },
        {
            'AttributeName': 'date_user_id',
            'AttributeType': 'S'
        }
    ],
    BillingMode='PAY_PER_REQUEST'
)

# AppSummary 테이블 생성
app_summary_table = dynamodb.create_table(
    TableName='AppSummary',
    KeySchema=[
        {
            'AttributeName': 'app_id',
            'KeyType': 'HASH'  # 파티션 키
        },
        {
            'AttributeName': 'date_range',
            'KeyType': 'RANGE'  # 정렬 키
        }
    ],
    AttributeDefinitions=[
        {
            'AttributeName': 'app_id',
            'AttributeType': 'S'
        },
        {
            'AttributeName': 'date_range',
            'AttributeType': 'S'
        }
    ],
    BillingMode='PAY_PER_REQUEST'
)

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
        
        print("모든 테이블이 성공적으로 생성되었습니다.")
    except Exception as e:
        print(f"테이블 생성 중 오류가 발생했습니다: {e}")

# 테이블 생성 완료 대기
app_info_table.meta.client.get_waiter('table_exists').wait(TableName='AppInfo')
app_review_table.meta.client.get_waiter(
    'table_exists').wait(TableName='AppReview')
app_summary_table.meta.client.get_waiter(
    'table_exists').wait(TableName='AppSummary')

print("모든 테이블이 생성되었습니다.")
