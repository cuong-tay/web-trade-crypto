from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Index, Text, func
from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from ..config.database import Base
from ..utils.timezone import get_vietnam_now

class User(Base):
    __tablename__ = "users"
    
    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default='user')
    status = Column(String(20), default='active')
    email_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=get_vietnam_now, nullable=False)
    last_login = Column(DateTime)
    
    # Relationships
    profile = relationship("UserProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="user", cascade="all, delete-orphan")
    wallets = relationship("Wallet", back_populates="user", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="user", cascade="all, delete-orphan")
    trades = relationship("Trade", back_populates="user", cascade="all, delete-orphan")
    watchlist = relationship("Watchlist", back_populates="user", cascade="all, delete-orphan")
    chat_histories = relationship("ChatHistory", back_populates="user", cascade="all, delete-orphan")
    positions = relationship("Position", back_populates="user", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_users_email', 'email'),
        Index('idx_users_username', 'username'),
        Index('idx_users_role', 'role'),
    )

class UserProfile(Base):
    __tablename__ = "user_profiles"
    
    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid.uuid4)
    user_id = Column(UNIQUEIDENTIFIER, ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False)
    display_name = Column(String(100))
    avatar_url = Column(String(512))  # Avatar ảnh đại diện
    cover_url = Column(String(512), nullable=True)  # Cover ảnh nền
    bio = Column(String(500))
    phone = Column(String(20))
    date_of_birth = Column(DateTime, nullable=True)  # Ngày sinh
    country = Column(String(100), nullable=True)  # Quốc gia
    language = Column(String(10), default='vi')
    default_currency = Column(String(10), default='USDT')
    notify_email = Column(Boolean, default=True)
    notify_push = Column(Boolean, default=True)
    
    # Relationships
    user = relationship("User", back_populates="profile")

class ActivityLog(Base):
    __tablename__ = "activity_log"
    
    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UNIQUEIDENTIFIER, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    action = Column(String(100), nullable=False)  # Tên hành động: register, login, logout, profile_update, password_change
    entity_type = Column(String(50), nullable=True, default=None)  # Loại entity liên quan (optional)
    entity_id = Column(String(50), nullable=True, default=None)  # ID của entity liên quan (optional) - Changed to String to avoid pyodbc NULL issues
    details = Column(Text, nullable=True, default=None)  # Chi tiết thêm (JSON hoặc text)
    created_at = Column(DateTime, default=get_vietnam_now, nullable=False, index=True)

    # Relationships
    user = relationship("User", back_populates="activity_logs")
    
    __table_args__ = (
        Index('idx_activity_user_id', 'user_id'),
        Index('idx_activity_log_action', 'action'),
        Index('idx_activity_log_entity_type', 'entity_type'),
    )
