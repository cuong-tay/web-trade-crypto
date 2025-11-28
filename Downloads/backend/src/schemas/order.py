from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime

class OrderCreate(BaseModel):
    symbol: str
    side: str  # BUY, SELL
    order_type: str  # LIMIT, MARKET
    price: Decimal
    quantity: Decimal
    fee: Optional[Decimal] = None  # ✅ PHÍ TỪ FRONTEND (0.1% cho spot)

class WalletUpdate(BaseModel):
    """Wallet update info included in order responses"""
    balance: Decimal
    available_balance: Decimal = Field(description="balance available")

class OrderResponse(BaseModel):
    id: UUID
    user_id: UUID
    symbol: str
    side: str
    order_type: str
    price: Decimal
    quantity: Decimal
    filled_quantity: Decimal
    status: str
    fee: Optional[Decimal] = None  # ✅ PHÍ ĐÃ VALIDATE TỪ FRONTEND
    created_at: datetime
    updated_at: datetime
    wallet_update: Optional[WalletUpdate] = None  # Include updated wallet info
    wallet_updates: Optional[dict] = None  # Dict of all affected wallets {currency: {balance, available_balance}}
    
    class Config:
        from_attributes = True

class TradeResponse(BaseModel):
    id: UUID
    user_id: UUID
    order_id: UUID
    symbol: str
    side: str
    price: Decimal
    quantity: Decimal
    commission: Decimal
    created_at: datetime
    
    class Config:
        from_attributes = True

class FillTradeRequest(BaseModel):
    """Request để fill (match) trade - khi order được match"""
    order_id: UUID
    price: Decimal
    quantity: Decimal
    commission: Decimal = Decimal("0")  # % hoặc amount

class FillTradeResponse(BaseModel):
    """Response khi fill trade thành công"""
    message: str
    trade_id: UUID
    order_id: UUID
    status: str
    quantity: Decimal
    price: Decimal
    commission: Decimal
    wallet_updates: dict  # {currency: WalletUpdate}
    transaction_logs: list[dict]  # Danh sách transactions được tạo


