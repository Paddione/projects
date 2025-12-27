import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(dotenv_path='env/.env-app')
load_dotenv(dotenv_path='env/.env-postgres')

DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "videovault"
DB_USER = os.getenv("POSTGRES_USER", "postgres")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")

try:
    conn = psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )
    cur = conn.cursor()
    cur.execute("SELECT count(*) FROM videos")
    count = cur.fetchone()[0]
    print(f"Total videos: {count}")
    
    cur.execute("SELECT filename, path FROM videos LIMIT 5")
    rows = cur.fetchall()
    for row in rows:
        print(f"Filename: {row[0]}, Path: {row[1]}")
        
    conn.close()
except Exception as e:
    print(f"Database error: {e}")
