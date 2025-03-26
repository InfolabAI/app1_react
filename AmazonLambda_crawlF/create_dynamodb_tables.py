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

# 테이블 생성 완료 대기
app_info_table.meta.client.get_waiter('table_exists').wait(TableName='AppInfo')
app_review_table.meta.client.get_waiter(
    'table_exists').wait(TableName='AppReview')
app_summary_table.meta.client.get_waiter(
    'table_exists').wait(TableName='AppSummary')

print("모든 테이블이 생성되었습니다.")
