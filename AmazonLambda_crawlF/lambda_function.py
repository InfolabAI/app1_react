"""
app_summary_table 에 대한 로직을 수정해줘.
1. google_id 를 같이 저장해야 함.
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
    즉, 사용자도 요청 body 를 아래 예제와 같이 구성해야 함
    "body": {
        "request_type": "summary",
        "app_id": "com.nianticlabs.pokemongo",
        "google_id": "google123456789"
    }
2. app_id 와 end_date 는 중복되지 않아야 함
3. app_id 와 end_date 가 같은 요청이 들어오면 LLM 이용없이, DB데이터를 가져와서 사용자에게 제공해야 함(캐시개념).
4. app_summary_table 의 created_at 과 google_id 를 통해 특정 기간동안 어떤 사용자가 LLM 을 몇번이용했는지 계산해서 사용자에게 제공해야 함.
        "body": {
            "request_type": "summary_count",
            "google_id": "google123456789"
        }
"""
import json
import boto3
from boto3.dynamodb.conditions import Key, Attr
from google_play_scraper import Sort, reviews
import pandas as pd
from llm import LLM
from datetime import datetime, timedelta
from decimal import Decimal
from lambda_user_table import save_user, get_user_by_google_id

# Constants definition
PROMPT = """다음 앱 리뷰 데이터를 분석하여 앱 개선을 위한 심층적 인사이트를 담은 마크다운 보고서를 작성해주세요:

[앱 리뷰 데이터 삽입 위치]

보고서에는 다음 섹션을 포함하되, 관련 데이터가 없는 경우 "관련 데이터 없음"으로 표시해주세요:

1. 핵심 인사이트 요약
   - 리뷰 텍스트에서 추출한 3-5개의 가장 중요한 발견점
   - 각 인사이트가 앱 발전에 갖는 전략적 중요성

2. 맥락별 감성 분석
   - 동일한 기능에 대한 상반된 평가의 맥락 차이 분석
   - 감성에 영향을 미치는 숨겨진 요인 식별
   - 언어 뉘앙스와 표현방식에서 드러나는 사용자 심리 해석

3. 주요 문제점의 근본 원인 분석
   - 표면적 불만 너머의 실제 사용자 좌절 요인 파악
   - 다양한 불만 사항 간의 연관성과 공통 원인 식별
   - 사용자 경험 문제의 심각도 평가

4. 묵시적 사용자 요구 파악
   - 직접적으로 언급되지 않았지만 리뷰 문맥에서 추론 가능한 사용자 요구
   - 잠재적 사용 시나리오와 미충족 니즈 식별
   - 사용자가 명확히 표현하지 못하는 기대사항 해석

5. 경쟁 앱 참조 분석
   - 경쟁사 언급 시 함축된 비교 우위 및 열위 요소
   - 타 앱과의 차별화 포인트 및 벤치마킹 요소
   - 경쟁 앱 대비 독특한 가치 제안 도출

6. 전략적 개선 방향
   - 리뷰 내용 기반 우선순위가 높은 개선 영역
   - 사용자 만족도를 극대화할 수 있는 구체적 개선 방안
   - 장기적 앱 발전 방향성 제시

각 인사이트는 반드시 실제 리뷰 내용을 인용하여 뒷받침하고, 특히 복잡한 감정이나 미묘한 사용자 피드백에 중점을 두어 분석해주세요."""

# DynamoDB resource initialization
dynamodb = boto3.resource('dynamodb')
app_info_table = dynamodb.Table('AppInfo')
app_review_table = dynamodb.Table('AppReview')
app_summary_table = dynamodb.Table('AppSummary')

# Request body parsing function


def cover_api_and_invoke(event, context):
    if isinstance(event.get('body'), str):
        body_dict = json.loads(event.get('body', '{}'))
    elif event.get('body') and isinstance(event.get('body'), dict):
        body_dict = event['body']
    else:
        raise Exception("'body' is not found in input")
    return body_dict

# App information related functions


def get_all_app_info():
    """Retrieve all app information"""
    try:
        response = app_info_table.scan()
        return response.get('Items', [])
    except Exception as e:
        print(f"Error retrieving app information: {str(e)}")
        raise e


def get_app_info(app_id):
    """Retrieve specific app information"""
    try:
        response = app_info_table.get_item(
            Key={'app_id': app_id}
        )
        return response.get('Item')
    except Exception as e:
        print(f"Error retrieving app information (app_id={app_id}): {str(e)}")
        raise e


def add_app_info(app_info_data):
    """Add app information"""
    app_id = app_info_data.get('app_id')
    app_name = app_info_data.get('app_name')
    app_logo = app_info_data.get('app_logo')

    # Required information validation
    if not app_id or not app_name:
        raise ValueError("app_id and app_name are required input values.")

    # Duplicate check
    existing_app = get_app_info(app_id)
    if existing_app:
        return {
            "success": True,
            "message": f"App ID already exists: {app_id}"
        }

    # Save new app information
    try:
        app_info_table.put_item(
            Item={
                'app_id': app_id,
                'app_name': app_name,
                'app_logo': app_logo if app_logo else "",
                'created_at': datetime.now().isoformat(),
                'updated_at': datetime.now().isoformat()
            }
        )
        return {
            "success": True,
            "message": f"App information successfully registered: {app_name}"
        }
    except Exception as e:
        print(f"Error registering app information: {str(e)}")
        raise e

# Review related functions


def get_latest_review_date(app_id):
    """Retrieve the most recent review date for a specific app"""
    try:
        response = app_review_table.query(
            KeyConditionExpression=Key('app_id').eq(app_id),
            ScanIndexForward=False,  # Descending order
            Limit=1
        )

        items = response.get('Items', [])
        if items:
            return items[0].get('date')
        return None
    except Exception as e:
        print(f"Error retrieving latest review date (app_id={app_id}): {str(e)}")
        return None


def get_app_reviews(app_id):
    """Retrieve all reviews for a specific app"""
    try:
        all_reviews = []
        last_evaluated_key = None

        while True:
            if last_evaluated_key:
                response = app_review_table.query(
                    KeyConditionExpression=Key('app_id').eq(app_id),
                    ExclusiveStartKey=last_evaluated_key
                )
            else:
                response = app_review_table.query(
                    KeyConditionExpression=Key('app_id').eq(app_id)
                )

            all_reviews.extend(response.get('Items', []))
            last_evaluated_key = response.get('LastEvaluatedKey')

            if not last_evaluated_key:
                break

        return all_reviews
    except Exception as e:
        print(f"Error retrieving app reviews (app_id={app_id}): {str(e)}")
        raise e


def fetch_and_save_new_reviews(app_id, latest_review_date=None):
    """Fetch new reviews from the store and save to DB without duplicates"""
    try:
        # Get existing review information (for duplicate checking)
        existing_reviews = get_app_reviews(app_id)

        # Create a set of unique identifiers for existing reviews (reviewID, username+content)
        existing_review_ids = set()
        existing_review_signatures = set()

        for review in existing_reviews:
            # Use review ID if available (otherwise create alternative identifier)
            if 'reviewId' in review:
                existing_review_ids.add(review['reviewId'])

            # Additional safety measure: identifier combining username + first 100 characters of content
            username = review.get('username', 'anonymous')
            content = review.get('content', '')[:100]  # Use only the beginning of content
            review_signature = f"{username}:{content}"
            existing_review_signatures.add(review_signature)

        print(f"Number of existing stored reviews: {len(existing_reviews)}")

        # Calculate target dates
        today = datetime.now()
        yesterday = (today - timedelta(days=1)).replace(hour=23, minute=59, second=59)
        
        # Calculate 2 months ago, set to 1st day of that month
        two_months_ago = today.replace(day=1)  # First day of current month
        # Go back one month
        two_months_ago = (two_months_ago - timedelta(days=1)).replace(day=1)
        # Go back another month to get to 2 months ago
        two_months_ago = (two_months_ago - timedelta(days=1)).replace(day=1)
        
        # Determine our target start date
        if not existing_reviews:
            # If no reviews exist, start from 2 months ago 1st day
            target_date = two_months_ago
            print(f"No existing reviews found. Will fetch reviews starting from {target_date.strftime('%Y-%m-%d')}")
        else:
            # If reviews exist, use the latest review date
            if latest_review_date:
                target_date = datetime.fromisoformat(latest_review_date)
                print(f"Existing reviews found. Will fetch reviews newer than {target_date.isoformat()}")
            else:
                # If no latest_review_date provided but we have reviews, default to 2 months ago
                target_date = two_months_ago
                print(f"Have existing reviews but no latest date. Using {target_date.strftime('%Y-%m-%d')}")

        # Fetch reviews from Google Play store
        all_new_reviews = []
        continuation_token = None
        reached_target_date = False
        
        # Keep fetching until we reach the target date or run out of reviews
        while not reached_target_date:
            result_list, continuation_token = reviews(
                app_id,
                lang='ko',
                country='kr',
                sort=Sort.NEWEST,
                count=200,  # Max batch size
                filter_score_with=None,  # Get all scores
                continuation_token=continuation_token  # Use token for pagination
            )

            # Return empty list if no reviews in this batch
            if not result_list:
                print("No more reviews retrieved.")
                break

            print(f"Retrieved {len(result_list)} reviews in this batch")

            # Process each review in this batch
            for review in result_list:
                review_id = review.get('reviewId', '')

                # Create alternative identifier
                username = review.get('userName', 'anonymous')
                content = review.get('content', '')[:100]
                review_signature = f"{username}:{content}"

                # Get review date
                review_date = review['at']
                
                # Stop if we reach a review older than our target date
                if review_date < target_date:
                    print(f"Reached review from {review_date.isoformat()}, which is older than our target {target_date.isoformat()}. Stopping.")
                    reached_target_date = True
                    break

                # Skip if review is from today or the future (only include up to yesterday)
                if review_date.date() >= today.date():
                    print(f"Skipping review from {review_date.isoformat()}, which is from today or later.")
                    continue

                # Duplicate check
                is_duplicate = (
                    (review_id and review_id in existing_review_ids) or
                    (review_signature in existing_review_signatures)
                )

                if not is_duplicate:
                    all_new_reviews.append(review)
                    # Add to sets to prevent duplicates in subsequent batches
                    if review_id:
                        existing_review_ids.add(review_id)
                    existing_review_signatures.add(review_signature)

            # If no continuation token or we've reached target date, exit loop
            if not continuation_token or reached_target_date:
                break
                
            # Safety check - if we're pulling too many pages, implement a limit
            if len(all_new_reviews) > 5000:  # Arbitrary limit - adjust as needed
                print("Reached maximum review limit. Stopping pagination.")
                break

        print(f"Total number of new reviews to save: {len(all_new_reviews)}")

        # Save new reviews to DynamoDB
        if all_new_reviews:
            save_reviews_to_dynamodb(app_id, all_new_reviews)

        return all_new_reviews
    except Exception as e:
        print(f"Error fetching new reviews (app_id={app_id}): {str(e)}")
        raise e


def save_reviews_to_dynamodb(app_id, reviews_data):
    """Save review data to DynamoDB (including duplicate check)"""
    try:
        # Preparation to get list of already stored keys
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.Table('AppReview')

        # Track number of saved reviews
        saved_count = 0

        batch_size = 25  # DynamoDB batch operation limit
        for i in range(0, len(reviews_data), batch_size):
            batch = reviews_data[i:i+batch_size]

            # Use batch writer
            with table.batch_writer() as batch_writer:
                for review in batch:
                    date_obj = review['at']
                    date_str = date_obj.strftime('%Y-%m-%d')
                    username = review.get('userName', 'anonymous')

                    # Create composite key
                    date_user_id = f"{date_str}#{username}"

                    # Convert float to Decimal
                    score = Decimal(str(review['score']))

                    # Save reviewId if available (Google Play's unique identifier)
                    review_id = review.get(
                        'reviewId', f"generated-{date_user_id}")

                    # Duplicate check before saving (optional - performance consideration)
                    try:
                        # Duplicate check is optional. Uncomment if needed.
                        # response = table.get_item(
                        #     Key={'app_id': app_id, 'date_user_id': date_user_id}
                        # )
                        # if 'Item' in response:
                        #     continue  # Skip if already exists

                        # Save if determined not to be a duplicate
                        batch_writer.put_item(
                            Item={
                                'app_id': app_id,
                                'date_user_id': date_user_id,
                                'date': date_obj.isoformat(),
                                'username': username,
                                'score': score,
                                'content': review['content'],
                                'reviewId': review_id,  # Save unique identifier
                            }
                        )
                        saved_count += 1
                    except Exception as item_error:
                        print(f"Error saving individual review: {str(item_error)}")

        print(f"Total {saved_count} reviews saved successfully")
        return True
    except Exception as e:
        print(f"Error saving reviews: {str(e)}")
        raise e

# Summary related functions


def get_latest_summary(app_id):
    """Retrieve the most recent summary for a specific app"""
    try:
        response = app_summary_table.query(
            KeyConditionExpression=Key('app_id').eq(app_id),
            ScanIndexForward=False,  # Descending order
            Limit=1
        )

        items = response.get('Items', [])
        if items:
            return items[0]
        return None
    except Exception as e:
        print(f"Error retrieving latest summary (app_id={app_id}): {str(e)}")
        return None


def generate_and_save_summary(app_id, google_id, reviews=None):
    """Generate and save review summary"""
    try:
        # Get review data from DB if not provided
        if not reviews:
            reviews = get_app_reviews(app_id)

        if not reviews:
            return {
                "success": False,
                "message": "No reviews to summarize."
            }

        # Convert review data
        init_df = pd.DataFrame(reviews)
        init_df['date'] = pd.to_datetime(init_df['date'])


        # 리뷰 품질 관리를 위해 리뷰 길이를 보장하며 너무 긴 것은 제외함
        init_df['content_length'] = init_df['content'].apply(lambda x: len(x) if isinstance(x, str) else 0)
        init_df = init_df[init_df['content_length'] > 50]
        init_df = init_df[init_df['content_length'] < 400]

        # 리뷰가 너무 많을 경우를 대비해서 computation cost 줄이기 위해 최근 500개만 추림
        init_df = init_df.sort_values(by='date', ascending=False)
        df = init_df.head(500)
        del init_df
        df = df.reset_index(drop=True)

        # Calculate summary date range
        first_date = df['date'].min().strftime('%Y-%m-%d')
        last_date = df['date'].max().strftime('%Y-%m-%d')

        
        # Check if summary with same app_id and end_date already exists (caching)
        existing_summary = get_summary_by_app_id_and_end_date(app_id, last_date)
        if existing_summary:
            return {
                "success": True,
                "summary": existing_summary['summary'],
                "date_range": f"{existing_summary['start_date']} ~ {existing_summary['end_date']}",
                "review_count": len(reviews),
                "cached": True
            }

        # Generate LLM summary
        llm = LLM()
        prompt = PROMPT + f"Below are reviews from {first_date} to {last_date}."

        # Extract review content
        text_list = df['content'].tolist()
        selected_text_list = llm.sampling(text_list)
        print(f"Sampling completed")

        selected_texts = ' '.join(selected_text_list)

        # Generate summary
        summary = llm(prompt, selected_texts)
        print(f"Summary generated")

        # Save summary information to DynamoDB
        # Important: Convert float to Decimal
        scores_set = set()
        for score in df['score'].unique():
            # Use score as is if already Decimal, otherwise convert to Decimal
            if isinstance(score, Decimal):
                scores_set.add(score)
            else:
                scores_set.add(Decimal(str(score)))

        date_range = f"{first_date}#{last_date}"

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

        return {
            "success": True,
            "summary": summary,
            "date_range": f"{first_date} ~ {last_date}",
            "review_count": len(reviews),
            "cached": False
        }
    except Exception as e:
        print(f"Error generating and saving summary (app_id={app_id}): {str(e)}")
        raise e

# Add function to get summary by app_id and end_date
def get_summary_by_app_id_and_end_date(app_id, end_date):
    """Retrieve summary for a specific app_id and end_date"""
    try:
        response = app_summary_table.query(
            KeyConditionExpression=Key('app_id').eq(app_id) & Key('end_date').eq(end_date)
        )

        items = response.get('Items', [])
        if items:
            return items[0]
        return None
    except Exception as e:
        print(f"Error retrieving summary (app_id={app_id}, end_date={end_date}): {str(e)}")
        return None

# Add function to count LLM usage by a user
def get_summary_count_by_user(google_id, start_date=None, end_date=None):
    """Get count of summaries generated by a specific user within a date range"""
    try:
        # Create filter expression for the query
        filter_expression = Attr('google_id').eq(google_id)
        
        # Add date range filter if provided
        if start_date and end_date:
            filter_expression = filter_expression & Attr('created_at').between(start_date, end_date)
        elif start_date:
            filter_expression = filter_expression & Attr('created_at').gte(start_date)
        elif end_date:
            filter_expression = filter_expression & Attr('created_at').lte(end_date)
        
        # Query summaries table with filter
        response = app_summary_table.scan(
            FilterExpression=filter_expression
        )
        
        items = response.get('Items', [])
        
        # Continue scan if LastEvaluatedKey exists (pagination)
        while 'LastEvaluatedKey' in response:
            response = app_summary_table.scan(
                FilterExpression=filter_expression,
                ExclusiveStartKey=response['LastEvaluatedKey']
            )
            items.extend(response.get('Items', []))
        
        # Process results if needed
        summary_count = len(items)
        
        # Optional: Group by date, app, etc. for more detailed analytics
        summary_by_date = {}
        summary_by_app = {}
        
        for item in items:
            # Group by date (extract date from created_at)
            created_date = item['created_at'].split('T')[0]
            summary_by_date[created_date] = summary_by_date.get(created_date, 0) + 1
            
            # Group by app
            app_id = item['app_id']
            summary_by_app[app_id] = summary_by_app.get(app_id, 0) + 1
        
        return {
            "total_count": summary_count,
            "by_date": summary_by_date,
            "by_app": summary_by_app,
            #"summaries": items  # Include all summary items (optional, may be large)
        }
    except Exception as e:
        print(f"Error getting summary count (google_id={google_id}): {str(e)}")
        raise e

# Main Lambda handler function


def lambda_handler(event, context):
    try:
        # Parse request body
        body_dict = cover_api_and_invoke(event, context)
        print(f"Request body: {body_dict}")

        # Check request type
        request_type = body_dict.get('request_type')
        if not request_type:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "Request type (request_type) is required."})
            }

        # 1. App information retrieval
        if request_type == 'app_info_read':
            app_id = body_dict.get('app_id')

            if app_id:
                # Retrieve specific app information
                app_info = get_app_info(app_id)
                if not app_info:
                    return {
                        "statusCode": 404,
                        "body": json.dumps({"error": f"App ID '{app_id}' not found."})
                    }
                response_data = {"app_info": app_info}
            else:
                # Retrieve all app information
                all_apps = get_all_app_info()
                response_data = {"apps": all_apps}

            return {
                "statusCode": 200,
                "body": json.dumps(response_data, default=str)
            }

        # 2. App information registration
        elif request_type == 'app_info_add':
            result = add_app_info(body_dict)

            if result["success"]:
                return {
                    "statusCode": 201,
                    "body": json.dumps(result, default=str)
                }
            else:
                return {
                    "statusCode": 400,
                    "body": json.dumps(result)
                }


        # 3. Review information retrieval
        elif request_type == 'app_review_read':
            app_id = body_dict.get('app_id')

            if not app_id:
                return {
                    "statusCode": 400,
                    "body": json.dumps({"error": "app_id parameter is required."})
                }

            # Check if app exists
            app_info = get_app_info(app_id)
            if not app_info:
                return {
                    "statusCode": 404,
                    "body": json.dumps({"error": f"App ID '{app_id}' not found."})
                }

            # Get all existing reviews first
            existing_reviews = get_app_reviews(app_id)
            
            new_reviews_added = False
            
            # Check if we need to fetch new reviews
            if not existing_reviews:
                # If no reviews exist, fetch from 2 months ago (1st day) to yesterday
                print(f"No existing reviews for app_id={app_id}. Fetching reviews from 2 months ago.")
                new_reviews = fetch_and_save_new_reviews(app_id)
                if new_reviews:
                    new_reviews_added = True
                    print(f"{len(new_reviews)} new reviews saved successfully")
            else:
                # If reviews exist, check if we need to update
                latest_review_date = get_latest_review_date(app_id)
                today = datetime.now()
                
                if not latest_review_date or datetime.fromisoformat(latest_review_date).date() < today.date():
                    print(f"Fetching new reviews: app_id={app_id}, latest_review_date={latest_review_date}")
                    new_reviews = fetch_and_save_new_reviews(app_id, latest_review_date)
                    if new_reviews:
                        new_reviews_added = True
                        print(f"{len(new_reviews)} new reviews saved successfully")

            # Retrieve all reviews (including newly added ones)
            all_reviews = get_app_reviews(app_id)

            return {
                "statusCode": 200,
                "body": json.dumps({
                    "reviews": all_reviews,
                    "count": len(all_reviews),
                    "new_reviews_added": new_reviews_added
                }, default=str)
            }

        # Update summary request handling
        elif request_type == 'summary':
            app_id = body_dict.get('app_id')
            google_id = body_dict.get('google_id')

            if not app_id:
                return {
                    "statusCode": 400,
                    "body": json.dumps({"error": "app_id parameter is required."})
                }
                
            if not google_id:
                return {
                    "statusCode": 400,
                    "body": json.dumps({"error": "google_id parameter is required."})
                }

            # Check if app exists
            app_info = get_app_info(app_id)
            if not app_info:
                return {
                    "statusCode": 404,
                    "body": json.dumps({"error": f"App ID '{app_id}' not found."})
                }

            # Check if we have any reviews
            existing_reviews = get_app_reviews(app_id)
            
            if not existing_reviews:
                # If no reviews exist, fetch from 2 months ago (1st day) to yesterday
                print(f"No existing reviews for app_id={app_id}. Fetching reviews from 2 months ago.")
                fetch_and_save_new_reviews(app_id)
            else:
                # Check and fetch new reviews if needed
                latest_review_date = get_latest_review_date(app_id)
                today = datetime.now()
                
                if not latest_review_date or datetime.fromisoformat(latest_review_date).date() < today.date():
                    fetch_and_save_new_reviews(app_id, latest_review_date)

            # Generate and save summary (now includes google_id)
            summary_result = generate_and_save_summary(app_id, google_id)

            return {
                "statusCode": 200,
                "body": json.dumps(summary_result, default=str)
            }
            
        # Add new request type for summary count
        elif request_type == 'summary_count':
            google_id = body_dict.get('google_id')
            start_date = body_dict.get('start_date')  # Optional
            end_date = body_dict.get('end_date')      # Optional

            if not google_id:
                return {
                    "statusCode": 400,
                    "body": json.dumps({"error": "google_id parameter is required."})
                }

            # Get summary count for the user
            summary_count = get_summary_count_by_user(google_id, start_date, end_date)

            return {
                "statusCode": 200,
                "body": json.dumps(summary_count, default=str)
            }
            
        # 5. User information storage and login
        elif request_type == 'user_login':
            google_id = body_dict.get('google_id')
            email = body_dict.get('email')
            
            if not google_id or not email:
                return {
                    "statusCode": 400,
                    "body": json.dumps({"error": "google_id and email parameters are required."})
                }
            
            # Save user information (or update)
            try:
                user_info = save_user(google_id, email)
                return {
                    "statusCode": 200,
                    "body": json.dumps({"user": user_info}, default=str)
                }
            except Exception as e:
                return {
                    "statusCode": 500,
                    "body": json.dumps({"error": f"Error occurred while saving user: {str(e)}"})
                }
                
        # 6. User information retrieval
        elif request_type == 'user_info':
            google_id = body_dict.get('google_id')
            
            if not google_id:
                return {
                    "statusCode": 400,
                    "body": json.dumps({"error": "google_id parameter is required."})
                }
            
            # Retrieve user information
            try:
                user_info = get_user_by_google_id(google_id)
                if not user_info:
                    return {
                        "statusCode": 404,
                        "body": json.dumps({"error": f"User with Google ID '{google_id}' not found."})
                    }
                
                return {
                    "statusCode": 200,
                    "body": json.dumps({"user": user_info}, default=str)
                }
            except Exception as e:
                return {
                    "statusCode": 500,
                    "body": json.dumps({"error": f"Error occurred while retrieving user: {str(e)}"})
                }

        else:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": f"Unsupported request type: {request_type}"})
            }

    except ValueError as ve:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": str(ve)})
        }
    except Exception as e:
        error_message = f"{str(e)}, event={str(event)}"
        print(f"Error occurred: {error_message}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": error_message})
        }


# Local test code
if __name__ == "__main__":
    # App 에서 발생한 에러에 대한 확인 작업
    #event0 = { "body": {"request_type":"summary","app_id":"com.kakao.talk","google_id":"103189138683203549311"} }
    event0 = { "body": {"request_type":"summary","app_id":"com.hanabank.mzplatform","google_id":"103189138683203549311"} }

    # App information retrieval test
    event1 = {
        "body": {
            "request_type": "app_info_read"
        }
    }

    # App information registration test
    event2 = {
        "body": {
            "request_type": "app_info_add",
            "app_id": "com.nianticlabs.pokemongo",
            "app_name": "Pokémon GO",
            "app_logo": "https://play-lh.googleusercontent.com/bE4FJRKJO_FhT6IcHyo3bKMfLvREP9vkBME3BaMktz8kZJrkYnq4933Ml6avuNwW_No=s48-rw"
        }
    }

    # Review information retrieval test
    event3 = {
        "body": {
            "request_type": "app_review_read",
            "app_id": "com.nianticlabs.pokemongo"
        }
    }

    # Review summary test
    event4 = { 
        "body": { 
            "request_type": "summary", 
            "app_id": "com.nianticlabs.pokemongo",
            "google_id": "google123456789"
        } 
    }
    
    # User login/registration test
    event5 = { "body": { "request_type": "user_login", "google_id": "google123456789", "email": "user@example.com" } }
    
    # User information retrieval test
    event6 = {
        "body": {
            "request_type": "user_info",
            "google_id": "google123456789"
        }
    }

    # User information not found test
    event7 = { "body": { "request_type": "user_info", "google_id": "google1234567890" } }

    # New test event for summary count
    event8 = { "body": { "request_type": "summary_count", "google_id": "google123456789" } }

    # New test event for summary count with date range
    event9 = {
        "body": {
            "request_type": "summary_count",
            "google_id": "google123456789",
            "start_date": "2023-01-01T00:00:00",
            "end_date": "2025-12-31T23:59:59"
        }
    }


    # Run all test events sequentially and save input/output to file
    #test_events = [event0, event1, event2, event3, event4, event5, event6, event7, event8, event9]
    test_events = [event0]
    
    with open('input_output.txt', 'w') as f:
        for i, event in enumerate(test_events, 1):
            print(f"Running test event {i}...")
            
            # Write input to file
            f.write(f"=== TEST EVENT {i} ===\n")
            f.write("INPUT:\n")
            f.write(json.dumps(event['body'], indent=2))
            f.write("\n\n")
            
            # Run the handler
            response = lambda_handler(event, None)

            # Parse response for display
            body_json = json.loads(response['body'])
            
            # Write output to file
            f.write("OUTPUT:\n")
            f.write(str(body_json))
            f.write("\n\n")
            
            
            # Print summary if available
            if 'summary' in body_json:
                print(f"\n===== Test {i} Summary Result =====")
                print(body_json['summary'])
                print("=====================\n")
            
            print(f"Test {i} completed. Status code: {response['statusCode']}")
    
    print("All tests completed. Results saved to input_output.txt")
    
    # Parse the last response for display
    body_json = json.loads(response['body'])

    # 요약 결과가 있는 경우 summary 필드를 보기 좋게 출력
    if 'summary' in body_json:
        print("\n===== 요약 결과 =====")
        # 마크다운 형식으로 정리된 요약 내용을 그대로 출력
        # 이미 JSON 파싱 과정에서 이스케이프 시퀀스가 처리되었으므로 추가 변환 불필요
        summary_text = body_json['summary']
        print(summary_text)
        print("=====================\n")

    print(body_json)