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
    print("Database connection successful!")
    conn.close()
except Exception as e:
    print(f"Database connection failed: {e}")
