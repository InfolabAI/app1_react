from google_play_scraper import Sort, reviews_all, reviews
from google_play_scraper import app
import pandas as pd
from manage_mysql import HOST, USER, PASSWORD, DB_NAME, TABLE_NAME, create_db_and_table, insert_df_data, get_data_by_date_range

result = app(
    'com.nianticlabs.pokemongo',
    lang='en',  # defaults to 'en'
    country='us'  # defaults to 'us'
)

print(result)

result, continuation_token = reviews(
    'com.nianticlabs.pokemongo',
    lang='ko',  # defaults to 'en'
    country='kr',  # defaults to 'us'
    sort=Sort.NEWEST,  # defaults to Sort.NEWEST
    count=200,  # defaults to 100
    filter_score_with=1  # defaults to None(means all score)
)

# ['reviewId', 'userName', 'userImage', 'content', 'score', 'thumbsUpCount', 'reviewCreatedVersion', 'at', 'replyContent', 'repliedAt', 'appVersion']
df = pd.DataFrame(result)

df.content.to_string()
df_tmp = df[['at', 'score', 'content']]
with open('pokemongo_reviews.txt', 'w') as f:
    for i in range(len(df_tmp)):
        f.write(f"일자: {str(df_tmp['at'][i])}\n")
        f.write(f"점수: {str(df_tmp['score'][i])}\n")
        f.write(f"내용: {df_tmp['content'][i]}\n\n")

print()

# result = reviews_all(
#    'com.nianticlabs.pokemongo',
#    sleep_milliseconds=0,  # defaults to 0
#    lang='en',  # defaults to 'en'
#    country='us',  # defaults to 'us'
#    sort=Sort.MOST_RELEVANT,  # defaults to Sort.MOST_RELEVANT
#    filter_score_with=5  # defaults to None(means all score)
# )
