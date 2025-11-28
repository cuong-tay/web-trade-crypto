from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey, Index
from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from ..config.database import Base
from ..utils.timezone import get_vietnam_now

class Watchlist(Base):
    __tablename__ = "watchlist"
    
    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid.uuid4)
    user_id = Column(UNIQUEIDENTIFIER, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    symbol = Column(String(20), nullable=False)
    added_at = Column(DateTime, default=get_vietnam_now)
    
    # Relationships
    user = relationship("User", back_populates="watchlist")
    
    __table_args__ = (
        Index('idx_watchlist_user_id', 'user_id'),
        Index('idx_watchlist_symbol', 'symbol'),
    )
