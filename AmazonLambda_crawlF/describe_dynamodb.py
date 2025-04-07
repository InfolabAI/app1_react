import boto3
import json
from botocore.exceptions import ClientError
from pprint import pprint
from collections import defaultdict

def describe_dynamodb_tables_with_attributes():
    """
    AWS DynamoDB의 모든 테이블 이름, 스키마 및 사용 중인 모든 속성(열)을 출력하는 함수
    """
    try:
        # DynamoDB 리소스 및 클라이언트 생성
        dynamodb = boto3.resource('dynamodb')
        dynamodb_client = boto3.client('dynamodb')
        
        # 모든 테이블 이름 가져오기
        response = dynamodb_client.list_tables()
        table_names = response.get('TableNames', [])
        
        if not table_names:
            print("DynamoDB에 테이블이 존재하지 않습니다.")
            return
        
        print(f"총 {len(table_names)}개의 테이블이 있습니다:")
        
        # 각 테이블의 상세 정보 출력
        for table_name in table_names:
            print("\n" + "="*50)
            print(f"테이블 이름: {table_name}")
            print("="*50)
            
            # 테이블 상세 정보 가져오기
            table_details = dynamodb_client.describe_table(TableName=table_name)
            table_info = table_details['Table']
            
            # 키 스키마 정보 출력
            print("\n== 키 스키마 ==")
            for key in table_info.get('KeySchema', []):
                print(f"  - {key['AttributeName']} ({key['KeyType']})")
            
            # 속성 정의 출력
            print("\n== 속성 정의 (스키마에 정의된 속성만) ==")
            for attr in table_info.get('AttributeDefinitions', []):
                attr_type = {
                    'S': '문자열',
                    'N': '숫자',
                    'B': '바이너리',
                    'BOOL': '불리언',
                    'NULL': 'NULL',
                    'M': '맵',
                    'L': '리스트',
                    'SS': '문자열 집합',
                    'NS': '숫자 집합',
                    'BS': '바이너리 집합'
                }.get(attr['AttributeType'], attr['AttributeType'])
                
                print(f"  - {attr['AttributeName']}: {attr_type}")
            
            # 글로벌 보조 인덱스 정보 출력
            if 'GlobalSecondaryIndexes' in table_info:
                print("\n== 글로벌 보조 인덱스 ==")
                for gsi in table_info['GlobalSecondaryIndexes']:
                    print(f"  인덱스 이름: {gsi['IndexName']}")
                    print("  키 스키마:")
                    for key in gsi['KeySchema']:
                        print(f"    - {key['AttributeName']} ({key['KeyType']})")
                    print(f"  프로젝션 타입: {gsi['Projection']['ProjectionType']}")
            
            # 테이블의 실제 아이템을 스캔하여 모든 사용 중인 속성 찾기
            table = dynamodb.Table(table_name)
            
            print("\n== 사용 중인 모든 속성(열) ==")
            try:
                # 테이블 스캔 (최대 100개 아이템만 검사)
                scan_response = table.scan(Limit=100)
                
                if 'Items' in scan_response and scan_response['Items']:
                    # 모든 아이템에서 속성을 수집
                    all_attributes = set()
                    attribute_types = {}
                    
                    for item in scan_response['Items']:
                        for attr_name, attr_value in item.items():
                            all_attributes.add(attr_name)
                            # 값의 타입 추론
                            attr_type = type(attr_value).__name__
                            attribute_types[attr_name] = attr_type
                    
                    # 수집된 모든 속성 출력
                    for attr in sorted(all_attributes):
                        print(f"  - {attr}: {attribute_types.get(attr, '알 수 없음')}")
                    
                    print(f"\n  총 {len(all_attributes)}개의 속성이 사용 중입니다.")
                    print(f"  참고: 최대 100개의 아이템만 스캔했으므로 모든 속성이 표시되지 않을 수 있습니다.")
                else:
                    print("  테이블에 아이템이 없거나 스캔할 수 없습니다.")
            except Exception as e:
                print(f"  테이블 스캔 중 오류 발생: {e}")
            
            # 테이블 상태 및 용량 정보
            print(f"\n== 테이블 상태 ==")
            print(f"  상태: {table_info['TableStatus']}")
            if 'ProvisionedThroughput' in table_info:
                pt = table_info['ProvisionedThroughput']
                print(f"  읽기 용량: {pt['ReadCapacityUnits']} 유닛")
                print(f"  쓰기 용량: {pt['WriteCapacityUnits']} 유닛")
            
            # 생성 시간 출력
            if 'CreationDateTime' in table_info:
                creation_time = table_info['CreationDateTime'].strftime("%Y-%m-%d %H:%M:%S")
                print(f"  생성 시간: {creation_time}")
    
    except ClientError as e:
        print(f"오류 발생: {e}")

# 함수 사용 예시
if __name__ == "__main__":
    print("DynamoDB 테이블 정보 및 모든 속성 출력 중...")
    describe_dynamodb_tables_with_attributes()