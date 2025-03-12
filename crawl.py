from google_play_scraper import Sort, reviews_all, reviews
from google_play_scraper import app
import pandas as pd

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

breakpoint()
print()

# result = reviews_all(
#    'com.nianticlabs.pokemongo',
#    sleep_milliseconds=0,  # defaults to 0
#    lang='en',  # defaults to 'en'
#    country='us',  # defaults to 'us'
#    sort=Sort.MOST_RELEVANT,  # defaults to Sort.MOST_RELEVANT
#    filter_score_with=5  # defaults to None(means all score)
# )
