from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import QueuePool
import pyodbc
from .settings import get_settings
import urllib.parse

settings = get_settings()

# Tạo connection string cho SQL Server
# Sử dụng driver có sẵn: SQL Server
params = urllib.parse.quote_plus(
    f"DRIVER={{SQL Server}};"
    f"SERVER={settings.db_server};"
    f"DATABASE={settings.db_database};"
    f"UID={settings.db_user};"
    f"PWD={settings.db_password};"
    f"TrustServerCertificate=yes;"
    f"CharacterSet=UTF-8;"
)

DATABASE_URL = f"mssql+pyodbc:///?odbc_connect={params}"

engine = create_engine(
    DATABASE_URL,
    echo=settings.api_env == "development",
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
    poolclass=QueuePool,
    use_setinputsizes=False,
    connect_args={
        'charset': 'utf8'
    }
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
