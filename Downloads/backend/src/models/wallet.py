from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey, Boolean, Index
from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from ..config.database import Base
from ..utils.timezone import get_vietnam_now

class Wallet(Base):
    __tablename__ = "wallets"
    
    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid.uuid4)
    user_id = Column(UNIQUEIDENTIFIER, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    currency = Column(String(20), nullable=False)
    balance = Column(Numeric(36, 18), default=0)
    wallet_type = Column(String(10), default='spot')
    created_at = Column(DateTime, default=get_vietnam_now)
    updated_at = Column(DateTime, default=get_vietnam_now, onupdate=get_vietnam_now)
    
    # Relationships
    user = relationship("User", back_populates="wallets")
    transactions = relationship("Transaction", back_populates="wallet", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_wallets_user_id', 'user_id'),
        Index('idx_wallets_currency', 'currency'),
    )

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid.uuid4)
    user_id = Column(UNIQUEIDENTIFIER, ForeignKey('users.id'), nullable=False, index=True)
    wallet_id = Column(UNIQUEIDENTIFIER, ForeignKey('wallets.id', ondelete='CASCADE'), nullable=False, index=True)
    type = Column(String(30), nullable=False)
    currency = Column(String(20), nullable=False)
    amount = Column(Numeric(36, 18), nullable=False)
    fee = Column(Numeric(20, 8), default=0)
    balance_after = Column(Numeric(36, 18), nullable=False, default=0)
    created_at = Column(DateTime, default=get_vietnam_now, index=True)
    
    # Relationships
    wallet = relationship("Wallet", back_populates="transactions")
    
    __table_args__ = (
        Index('idx_transactions_user_id', 'user_id'),
        Index('idx_transactions_wallet_id', 'wallet_id'),
        Index('idx_transactions_created_at', 'created_at'),
    )
