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
PROMPT = "아래 리뷰 내용들을 마크 다운 보고서로 요약해주세요. 헤더 # 3개(1. 요약 기간 2. 주요 문제점 3. 개선 아이디어). 각 헤더 # 마다, 하위 헤더 ## 를 통해 상세 내용 작성. 개선 아이디어 헤더에서는 해결하려는 문제 헤더 ## 마다 구현 ### 난이도 상, ### 난이도 중, ### 난이도 하 헤더로 아이디어 제공.\n"

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

        # Fetch reviews from Google Play store
        result_list, continuation_token = reviews(
            app_id,
            lang='ko',
            country='kr',
            sort=Sort.NEWEST,
            count=200,
            filter_score_with=None  # Get all scores
        )

        # Return empty list if no reviews
        if not result_list:
            print("No reviews retrieved.")
            return []

        print(f"Total number of reviews retrieved from Google Play: {len(result_list)}")

        # Filter only new reviews
        new_reviews = []
        for review in result_list:
            review_id = review.get('reviewId', '')

            # Create alternative identifier
            username = review.get('userName', 'anonymous')
            content = review.get('content', '')[:100]
            review_signature = f"{username}:{content}"

            # Date-based filtering (if provided)
            date_filter_passed = True
            if latest_review_date:
                latest_date = datetime.fromisoformat(latest_review_date)
                review_date = review['at']
                if review_date <= latest_date:
                    date_filter_passed = False

            # Duplicate check: verify by reviewId or alternative identifier
            is_duplicate = (
                (review_id and review_id in existing_review_ids) or
                (review_signature in existing_review_signatures)
            )

            if date_filter_passed and not is_duplicate:
                new_reviews.append(review)

        print(f"Number of new reviews to save after removing duplicates: {len(new_reviews)}")

        # Save new reviews to DynamoDB
        if new_reviews:
            save_reviews_to_dynamodb(app_id, new_reviews)

        return new_reviews
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
                                'created_at': datetime.now().isoformat()
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


def generate_and_save_summary(app_id, reviews=None):
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
        df = pd.DataFrame(reviews)
        df['date'] = pd.to_datetime(df['date'])

        # Calculate summary date range
        first_date = df['date'].min().strftime('%Y-%m-%d')
        last_date = df['date'].max().strftime('%Y-%m-%d')

        # Generate LLM summary
        llm = LLM()
        prompt = PROMPT + f"Below are reviews from {first_date} to {last_date}."

        # Extract review content
        text_list = df['content'].tolist()
        selected_text_list = llm.sampling(text_list)
        selected_texts = ' '.join(selected_text_list)

        # Generate summary
        summary = llm(prompt, selected_texts)

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
                'date_range': date_range,
                'start_date': first_date,
                'end_date': last_date,
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
            "review_count": len(reviews)
        }
    except Exception as e:
        print(f"Error generating and saving summary (app_id={app_id}): {str(e)}")
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

            # Check latest review date
            latest_review_date = get_latest_review_date(app_id)
            today = datetime.now()

            new_reviews_added = False

            # Fetch new reviews if no stored reviews or if latest review is older than today
            if not latest_review_date or datetime.fromisoformat(latest_review_date).date() < today.date():
                print(
                    f"Fetching new reviews: app_id={app_id}, latest_review_date={latest_review_date}")
                new_reviews = fetch_and_save_new_reviews(
                    app_id, latest_review_date)
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

        # 4. Review summary request
        elif request_type == 'summary':
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

            # Check and fetch new reviews
            latest_review_date = get_latest_review_date(app_id)
            today = datetime.now()

            if not latest_review_date or datetime.fromisoformat(latest_review_date).date() < today.date():
                fetch_and_save_new_reviews(app_id, latest_review_date)

            # Generate and save summary
            summary_result = generate_and_save_summary(app_id)

            return {
                "statusCode": 200,
                "body": json.dumps(summary_result, default=str)
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
            "app_id": "com.nianticlabs.pokemongo" 
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

    # Select desired test event here
    test_event = event6  # User login test
    response = lambda_handler(test_event, None)
    print(json.dumps(response, indent=2))
    