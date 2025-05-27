# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure Overview

This project consists of two main components:

1. **Mobile App (React Native)** - A Google Play Store review analysis app with the following components:
   - `MyApp_RN_New/` - React Native mobile app for displaying app reviews and analysis
   - User authentication with Google Sign-In
   - App search and importing features from Google Play Store
   - AI-powered review analysis and summary
   - Data visualization with charts for review trends

2. **Backend (AWS Lambda)** - A serverless backend that handles:
   - `AmazonLambda_crawlF/` - Lambda function for crawling Google Play Store reviews
   - `lambda_function.py` - Main entry point for AWS Lambda
   - `llm.py` - Wrapper for OpenAI API calls (review summarization)
   - DynamoDB database integration for storing app data, reviews, and summaries

## Command Reference

### React Native App

#### Setup and Installation

```bash
# Install dependencies
cd MyApp_RN_New
yarn install

# For iOS, install CocoaPods dependencies (first time only)
bundle install
bundle exec pod install
```

#### Development

```bash
# Start Metro server
yarn start

# Run on Android
yarn android

# Run on iOS
yarn ios

# Run linter
yarn lint

# Run tests
yarn test
```

#### Building for Production

```bash
# For Android, generate a release build
cd android
./gradlew assembleRelease
```

### AWS Lambda

#### Local Testing

```bash
# Set OpenAI API key environment variable
export OPENAI_API_KEY=your_api_key_here

# Run lambda_function.py directly
cd AmazonLambda_crawlF
python lambda_function.py
```

#### Deployment

```bash
# Create function zip package
cd AmazonLambda_crawlF
chmod +x build_transfer.sh
./build_transfer.sh
```

## API Reference

### Lambda API Endpoints

The Lambda function supports the following request types:

1. `app_info_read` - Get information about apps
2. `app_info_add` - Add a new app
3. `app_review_read` - Get reviews for an app
4. `summary` - Generate AI-powered summary of app reviews
5. `summary_count` - Get usage stats for AI summaries
6. `user_login` - Store user login information
7. `user_info` - Get user information

### Database Schema

The DynamoDB tables follow this schema:

1. **AppInfo**
   - `app_id` (PK) - Package ID of the app 
   - `app_name` - Name of the app
   - `app_logo` - URL of the app icon
   - `created_at` - Timestamp when the app was added
   - `updated_at` - Timestamp when the app was last updated

2. **AppReview**
   - `app_id` (PK) - Package ID of the app
   - `date_user_id` (SK) - Composite key of date and username
   - `date` - ISO date string of the review
   - `username` - Name of the reviewer
   - `score` - Rating score (1-5)
   - `content` - Review text
   - `reviewId` - Unique review ID from Google Play

3. **AppSummary**
   - `app_id` (PK) - Package ID of the app
   - `end_date` (SK) - End date of reviews included in summary
   - `google_id` - User's Google ID
   - `start_date` - Start date of reviews included in summary
   - `date_range` - String representation of date range
   - `summary` - The AI-generated summary text
   - `created_at` - Timestamp when the summary was generated

## Architecture Notes

1. The mobile app authenticates users via Google Sign-In
2. The app fetches review data from AWS Lambda API
3. The Lambda function crawls Google Play Store for reviews
4. Reviews are stored in DynamoDB
5. The OpenAI API (via the LLM class) generates summaries
6. The app displays reviews and AI summaries with charts

## Important Implementation Details

1. Google Sign-In is configured with webClientId in App.tsx
2. The API endpoint is hardcoded as `https://2frhmnck64.execute-api.ap-northeast-2.amazonaws.com/crawlF`
3. The Lambda function uses the OpenAI API to generate summaries
4. Users are limited to 20 AI summaries per week
5. Generated summaries are cached in DynamoDB to prevent duplicate processing
6. Victory-native charts were replaced with components in ReviewProcessing.tsx
7. Google ads are integrated with the Mobile Ads SDK