from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional
import jwt
from ..config.settings import get_settings
from .timezone import get_vietnam_now

settings = get_settings()

# Password hashing
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

def get_password_hash(password: str) -> str:
    """Hash password"""
    return pwd_context.hash(password)

def hash_password(password: str) -> str:
    """Alias for get_password_hash"""
    return get_password_hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password"""
    return pwd_context.verify(plain_password, hashed_password)

# JWT token
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT token"""
    to_encode = data.copy()
    if expires_delta:
        expire = get_vietnam_now() + expires_delta
    else:
        expire = get_vietnam_now() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt

def decode_token(token: str) -> Optional[dict]:
    """Decode JWT token"""
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def verify_token(token: str):
    """Verify JWT token and return TokenData"""
    from ..schemas.user import TokenData
    
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        email: str = payload.get("sub")
        user_id: str = payload.get("user_id")
        
        if email is None:
            return None
        
        return TokenData(email=email, user_id=user_id)
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
