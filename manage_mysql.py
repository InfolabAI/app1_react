import pymysql
import pandas as pd
from datetime import datetime
# 예시 파라미터
HOST = "localhost"
USER = "root"
PASSWORD = "1234"
DB_NAME = "review_db"
TABLE_NAME = "app_reviews"


def create_db_and_table(host, user, password, db_name, table_name):
    """
    지정한 MySQL 서버에 접속하여 DB가 없으면 생성하고,
    해당 DB 안에 table_name 테이블이 없으면 생성합니다.

    테이블 구조:
        id (INT AUTO_INCREMENT PRIMARY KEY)
        app_name (VARCHAR(255))
        review_date (DATE)
        score (INT)
        content (TEXT)
    중복 처리를 위해 (app_name, review_date, content)에 유니크 인덱스를 설정합니다.
    """
    # 1) MySQL 서버에 접속(처음에는 db_name 없이 접속)
    conn = pymysql.connect(
        host=host,
        user=user,
        password=password,
        charset='utf8mb4'
    )
    conn.autocommit(True)
    cursor = conn.cursor()

    # 2) DB 생성 (없으면)
    cursor.execute(
        f"CREATE DATABASE IF NOT EXISTS {db_name} DEFAULT CHARACTER SET utf8mb4;")

    # 3) db_name으로 커넥션 재연결
    conn.select_db(db_name)

    # 4) 테이블 생성 (없으면)
    create_table_sql = f"""
        CREATE TABLE IF NOT EXISTS {table_name} (
            id INT AUTO_INCREMENT PRIMARY KEY,
            app_name VARCHAR(255) NOT NULL,
            review_date DATE NOT NULL,
            userName VARCHAR(255) NOT NULL,
            score INT NOT NULL,
            content TEXT NOT NULL,
            UNIQUE KEY unique_review (app_name, review_date, userName(255))
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    """

    cursor.execute(create_table_sql)

    cursor.close()
    conn.close()
    print(f"[OK] 데이터베이스({db_name}) 및 테이블({table_name}) 준비 완료")


def insert_df_data(df, app_name, host, user, password, db_name, table_name):
    """
    df(DataFrame)의 'at'(일자), 'score', 'content' 컬럼 정보를
    (app_name, review_date, score, content) 형태로 MySQL에 삽입합니다.
    중복(UNIQUE KEY 충돌) 발생 시에는 score와 content를 업데이트합니다.
    """
    # MySQL 연결
    conn = pymysql.connect(
        host=host,
        user=user,
        password=password,
        db=db_name,
        charset='utf8mb4'
    )
    conn.autocommit(False)
    cursor = conn.cursor()

    # 날짜 컬럼이 datetime이 아니면 변환
    if not pd.api.types.is_datetime64_any_dtype(df['at']):
        df['at'] = pd.to_datetime(df['at'])

    # INSERT SQL 템플릿 (중복 발생 시 score, content 업데이트)
    insert_sql = f"""
        INSERT INTO {table_name} (app_name, review_date, userName, score, content)
        VALUES (%s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            score = VALUES(score),
            content = VALUES(content)
    """

    # 한 번에 executemany로 bulk insert (중복 시 UPDATE)
    data_to_insert = []
    for idx, row in df.iterrows():
        # review_date는 DATE 포맷을 위해 .date() 사용
        review_date = row['at'].date()
        score = row['score']
        content = row['content']
        user_name = row['userName']
        data_to_insert.append(
            (app_name, review_date, user_name, score, content))

    try:
        cursor.executemany(insert_sql, data_to_insert)
        conn.commit()
        print(f"[OK] {len(data_to_insert)}건 삽입(중복 시 갱신) 완료")
    except Exception as e:
        conn.rollback()
        print("[ERROR]", e)
    finally:
        cursor.close()
        conn.close()


def get_data_by_date_range(start_date, end_date, app_name, host, user, password, db_name, table_name):
    """
    start_date ~ end_date 범위(포함) 내 리뷰를 조회합니다.
    MySQL의 DATE 타입을 사용하므로 'YYYY-MM-DD' 형태로 전달하면 됩니다.

    반환값: Pandas DataFrame
    """
    # MySQL 연결
    conn = pymysql.connect(
        host=host,
        user=user,
        password=password,
        db=db_name,
        charset='utf8mb4'
    )
    cursor = conn.cursor(pymysql.cursors.DictCursor)

    query = f"""
        SELECT id, app_name, review_date, score, content
        FROM {table_name}
        WHERE app_name = %s
          AND review_date BETWEEN %s AND %s
        ORDER BY review_date ASC
    """
    cursor.execute(query, (app_name, start_date, end_date))
    rows = cursor.fetchall()

    df_result = pd.DataFrame(rows)
    cursor.close()
    conn.close()
    return df_result


# ========== 사용 예시 ==========
if __name__ == "__main__":

    # 위에 정의한 df_tmp, app_name
    # df_tmp = pd.DataFrame(...)  # 이미 만들어진 DataFrame 예시
    # app_name = "com.nianticlabs.pokemongo"

    # 1) DB/테이블 생성
    create_db_and_table(HOST, USER, PASSWORD, DB_NAME, TABLE_NAME)

    # 2) DataFrame 삽입 (중복 발생 시 update)
    # insert_df_data(df_tmp, app_name, HOST, USER, PASSWORD, DB_NAME, TABLE_NAME)

    # 3) 날짜 구간으로 조회
    # start_date = "2023-01-01"
    # end_date   = "2023-12-31"
    # result_df = get_data_by_date_range(start_date, end_date, app_name, HOST, USER, PASSWORD, DB_NAME, TABLE_NAME)
    # print(result_df)
