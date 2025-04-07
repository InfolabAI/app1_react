import boto3
import uuid
import json
from datetime import datetime
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

# DynamoDB 리소스 생성
dynamodb = boto3.resource('dynamodb')
user_table = dynamodb.Table('User')

def save_user(google_id, email):
    """
    사용자 정보를 저장하는 함수
    
    Args:
        google_id (str): 구글에서 제공한 고유 ID
        email (str): 사용자 이메일
        
    Returns:
        dict: 저장된 사용자 정보 (JSON 직렬화 가능한 형식)
    """
    # 현재 시간
    current_time = datetime.now().isoformat()
    
    # google_id로 기존 사용자 확인
    existing_user = get_user_by_google_id(google_id)
    
    # 이미 존재하는 사용자인 경우 (last_login만 업데이트)
    if existing_user:
        try:
            response = user_table.update_item(
                Key={
                    'id': existing_user['id']
                },
                UpdateExpression="set last_login = :last_login",
                ExpressionAttributeValues={
                    ':last_login': current_time
                },
                ReturnValues="ALL_NEW"
            )
            
            # 업데이트된 사용자 정보 반환
            updated_user = response.get('Attributes', {})
            
            # JSON 직렬화 가능한 형태로 변환
            return {
                'id': updated_user.get('id'),
                'google_id': updated_user.get('google_id'),
                'email': updated_user.get('email'),
                'created_at': updated_user.get('created_at'),
                'last_login': updated_user.get('last_login')
            }
            
        except ClientError as e:
            print(f"사용자 업데이트 오류: {e}")
            raise
    
    # 새로운 사용자 생성
    else:
        # 고유 ID 생성
        user_id = str(uuid.uuid4())
        
        # 사용자 정보
        user_item = {
            'id': user_id,
            'google_id': google_id,
            'email': email,
            'created_at': current_time,
            'last_login': current_time
        }
        
        try:
            # DynamoDB에 저장
            user_table.put_item(Item=user_item)
            
            # 저장된 사용자 정보 반환
            return user_item
            
        except ClientError as e:
            print(f"사용자 저장 오류: {e}")
            raise

def get_user_by_google_id(google_id):
    """
    google_id로 사용자 정보를 조회하는 함수
    
    Args:
        google_id (str): 구글에서 제공한 고유 ID
        
    Returns:
        dict: 사용자 정보 (없으면 None)
    """
    try:
        # GSI를 사용하여 google_id로 검색
        response = user_table.query(
            IndexName='GoogleIdIndex',
            KeyConditionExpression=Key('google_id').eq(google_id)
        )
        
        # 검색 결과가 있으면 첫 번째 아이템 반환
        items = response.get('Items', [])
        if items:
            return items[0]
        
        return None
        
    except ClientError as e:
        print(f"사용자 조회 오류: {e}")
        raise

def user_to_json(user):
    """
    사용자 정보를 JSON 문자열로 변환하는 함수
    
    Args:
        user (dict): 사용자 정보
        
    Returns:
        str: JSON 문자열
    """
    if not user:
        return json.dumps(None)
    
    # datetime 객체가 있으면 문자열로 변환
    user_copy = user.copy()
    
    return json.dumps(user_copy)

# 함수 사용 예시
if __name__ == "__main__":
    # 예시 데이터
    test_google_id = "google123456789"
    test_email = "user@example.com"
    
    # 사용자 저장
    saved_user = save_user(test_google_id, test_email)
    print("저장된 사용자:", user_to_json(saved_user))
    
    # 사용자 조회
    found_user = get_user_by_google_id(test_google_id)
    print("조회된 사용자:", user_to_json(found_user))