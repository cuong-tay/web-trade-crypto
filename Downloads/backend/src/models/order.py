from sqlalchemy import Column, String, DateTime, Numeric, ForeignKey, Index, Enum
from sqlalchemy.dialects.mssql import UNIQUEIDENTIFIER
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid
from ..config.database import Base
from ..utils.timezone import get_vietnam_now

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid.uuid4)
    user_id = Column(UNIQUEIDENTIFIER, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    side = Column(String(10), nullable=False)  # BUY, SELL, LONG, SHORT
    order_type = Column(String(20), nullable=False)  # LIMIT, MARKET, STOP_LOSS, TAKE_PROFIT
    market_type = Column(String(20), nullable=True, default='spot', index=True)  # spot, futures
    price = Column(Numeric(36, 18), nullable=True)  # Nullable cho MARKET orders
    quantity = Column(Numeric(36, 18), nullable=False)
    filled_quantity = Column(Numeric(36, 18), default=0)
    leverage = Column(Numeric(10, 2), default=1)  # Leverage cho futures (1-125)
    status = Column(String(20), default='pending', index=True)  # pending, filled, cancelled, rejected
    created_at = Column(DateTime, default=get_vietnam_now)
    updated_at = Column(DateTime, default=get_vietnam_now, onupdate=get_vietnam_now)
    filled_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="orders")
    trades = relationship("Trade", back_populates="order", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('idx_orders_user_id', 'user_id'),
        Index('idx_orders_symbol', 'symbol'),
        Index('idx_orders_status', 'status'),
        Index('idx_orders_market_type', 'market_type'),
    )

class Trade(Base):
    __tablename__ = "trades"
    
    id = Column(UNIQUEIDENTIFIER, primary_key=True, default=uuid.uuid4)
    user_id = Column(UNIQUEIDENTIFIER, ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    order_id = Column(UNIQUEIDENTIFIER, ForeignKey('orders.id'), nullable=False, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    side = Column(String(10), nullable=False)
    price = Column(Numeric(36, 18), nullable=False)
    quantity = Column(Numeric(36, 18), nullable=False)
    commission = Column(Numeric(20, 8), default=0)
    created_at = Column(DateTime, default=get_vietnam_now, index=True)
    
    # Relationships
    user = relationship("User", back_populates="trades")
    order = relationship("Order", back_populates="trades")
    
    __table_args__ = (
        Index('idx_trades_user_id', 'user_id'),
        Index('idx_trades_order_id', 'order_id'),
        Index('idx_trades_symbol', 'symbol'),
    )
