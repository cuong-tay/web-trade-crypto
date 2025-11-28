from pydantic_settings import BaseSettings
from functools import lru_cache
from typing import Optional
import pytz  # type: ignore

class Settings(BaseSettings):
    # Database
    db_server: str = r"CUONG-TAY\SQLEXPRESS"
    db_database: str = "CTrading"
    db_user: str = "sa"
    db_password: str = "p@ssw0rd"
    
    # API
    api_host: str = "0.0.0.0"  # Cho phép truy cập từ network
    api_port: int = 8000
    api_env: str = "development"
    
    # Timezone (Việt Nam UTC+7)
    timezone: str = "Asia/Ho_Chi_Minh"  # UTC+7
    
    # JWT
    secret_key: str = "your-secret-key"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours
    
    # External APIs
    binance_api_key: Optional[str] = None
    binance_api_secret: Optional[str] = None
    
    # AI Services
    ai_provider: str = "openai"  # openai | mock
    openai_api_key: Optional[str] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = False

@lru_cache()
def get_settings():
    return Settings()
