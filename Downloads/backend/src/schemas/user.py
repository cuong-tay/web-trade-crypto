from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional
from uuid import UUID
from datetime import datetime
import re

# Request Schemas
class UserRegister(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)
    
    @validator('username')
    def username_valid(cls, v):
        """
        Validate username - supports:
        - English letters (a-z, A-Z)
        - Vietnamese letters with diacritics (à, á, ả, ã, ạ, ă, ằ, ắ, ẳ, ẵ, ặ, â, ầ, ấ, ẩ, ẫ, ậ, đ, etc.)
        - Numbers (0-9)
        - Underscore (_)
        - Hyphen (-)
        - Spaces
        """
        # Strip leading/trailing spaces
        v = v.strip()
        
        # Pattern: alphanumeric (including Vietnamese), underscore, hyphen, spaces
        # Unicode letter (\p{L}) includes letters from all languages including Vietnamese
        # Using Python regex with Unicode support
        pattern = r"^[\w\s\-à-ỿ]+$"
        
        if not re.match(pattern, v, re.UNICODE):
            raise ValueError('Username chỉ được chứa chữ cái, số, gạch dưới (_), gạch ngang (-) và khoảng trắng')
        
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)
    confirm_new_password: str = Field(..., min_length=8)

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = Field(None, max_length=500)
    phone: Optional[str] = Field(None, max_length=20)
    date_of_birth: Optional[datetime] = Field(None)  # Ngày sinh
    country: Optional[str] = Field(None, max_length=100)  # Quốc gia
    language: Optional[str] = Field(None, max_length=10)
    default_currency: Optional[str] = Field(None, max_length=10)
    notify_email: Optional[bool] = None
    notify_push: Optional[bool] = None

# Response Schemas
class UserResponse(BaseModel):
    id: str  # Changed to str for proper JSON serialization
    email: str
    username: str
    role: str
    status: str
    email_verified: bool
    created_at: datetime
    last_login: Optional[datetime]
    
    class Config:
        from_attributes = True
        json_encoders = {
            UUID: lambda v: str(v)
        }
    
    @validator('id', pre=True)
    def convert_id(cls, v):
        """Convert UUID to string"""
        if isinstance(v, UUID):
            return str(v)
        return v

class UserProfileResponse(BaseModel):
    display_name: Optional[str]
    avatar_url: Optional[str]
    cover_url: Optional[str]
    bio: Optional[str]
    phone: Optional[str]
    date_of_birth: Optional[datetime]
    country: Optional[str]
    language: str
    default_currency: str
    notify_email: bool
    notify_push: bool
    
    class Config:
        from_attributes = True

class UserDetailResponse(BaseModel):
    user: UserResponse
    profile: UserProfileResponse
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse

class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[str] = None

class ActivityLogResponse(BaseModel):
    id: str  # Changed from UUID to str
    action: str
    entity_type: Optional[str]
    entity_id: Optional[str]
    details: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True
        json_encoders = {
            UUID: lambda v: str(v)
        }
    
    @validator('id', pre=True)
    def convert_id(cls, v):
        """Convert UUID to string"""
        if isinstance(v, UUID):
            return str(v)
        return v
