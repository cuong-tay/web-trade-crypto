"""
Position Model - Vị thế giao dịch (Spot/Futures/Margin)
Sử dụng bảng positions có sẵn trong database
"""
from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey, Index, Integer
from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER, BIT
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from ..config.database import Base
from ..utils.timezone import get_vietnam_now

class Position(Base):
    """
    Bảng positions - Lưu trữ các vị thế giao dịch
    Dùng cho cả Spot, Futures và Margin trading
    """
    __tablename__ = "positions"
    
    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid.uuid4)
    user_id = Column(UNIQUEIDENTIFIER, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    symbol = Column(String(50), nullable=False, index=True)  # BTCUSDT, ETHUSDT, etc.
    side = Column(String(20), nullable=False)  # LONG, SHORT
    entry_price = Column(Numeric(36, 18), nullable=False)
    quantity = Column(Numeric(36, 18), nullable=False)
    leverage = Column(Integer, nullable=False, default=1)  # 1-125x
    margin = Column(Numeric(36, 18), nullable=False)  # Ký quỹ/collateral
    unrealized_pnl = Column(Numeric(36, 18), nullable=False, default=0)
    realized_pnl = Column(Numeric(36, 18), nullable=False, default=0)
    liquidation_price = Column(Numeric(36, 18), nullable=True)
    stop_loss = Column(Numeric(36, 18), nullable=True)
    take_profit = Column(Numeric(36, 18), nullable=True)
    status = Column(String(20), nullable=False, default='OPEN', index=True)  # OPEN, CLOSED, LIQUIDATED
    opened_at = Column(DateTime, nullable=False, default=get_vietnam_now)
    closed_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=False, default=get_vietnam_now, onupdate=get_vietnam_now)
    
    # Relationships
    user = relationship("User", back_populates="positions")
    
    __table_args__ = (
        Index('idx_positions_user_id', 'user_id'),
        Index('idx_positions_symbol', 'symbol'),
        Index('idx_positions_status', 'status'),
        Index('idx_positions_user_symbol', 'user_id', 'symbol'),
    )
    
    def __repr__(self):
        return f"<Position(id={self.id}, symbol={self.symbol}, side={self.side}, status={self.status})>"
