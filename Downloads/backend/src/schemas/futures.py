from pydantic import BaseModel, Field, field_serializer
from typing import Optional, List, Dict
from datetime import datetime
from decimal import Decimal
from uuid import UUID


# ============= FUTURES POSITION SCHEMAS =============

class FuturesPositionCreate(BaseModel):
    """Tạo vị thế futures mới"""
    symbol: str = Field(..., description="Cặp giao dịch (BTC/USDT)")
    side: str = Field(..., description="LONG hoặc SHORT")
    entry_price: Decimal = Field(..., gt=0, description="Giá vào")
    quantity: Decimal = Field(..., gt=0, description="Số lượng hợp đồng")
    leverage: Decimal = Field(default=Decimal(1), ge=1, le=100, description="Leverage (1x-100x)")
    collateral: Decimal = Field(..., gt=0, description="Ký quỹ ban đầu (USDT)")
    stop_loss_price: Optional[Decimal] = Field(None, description="Giá stop loss")
    take_profit_price: Optional[Decimal] = Field(None, description="Giá take profit")


class FuturesPositionUpdate(BaseModel):
    """Update vị thế futures"""
    mark_price: Decimal = Field(..., gt=0, description="Giá hiện tại")
    stop_loss_price: Optional[Decimal] = Field(None, description="Cập nhật stop loss")
    take_profit_price: Optional[Decimal] = Field(None, description="Cập nhật take profit")


class FuturesPositionResponse(BaseModel):
    """Response vị thế futures"""
    id: str
    user_id: str
    symbol: str
    side: str
    entry_price: Decimal
    quantity: Decimal
    leverage: int  # Changed from Decimal to int
    margin: Decimal  # Changed from collateral to margin (matches database)
    unrealized_pnl: Decimal
    realized_pnl: Decimal
    liquidation_price: Optional[Decimal]
    stop_loss: Optional[Decimal] = Field(None, serialization_alias='stop_loss_price')
    take_profit: Optional[Decimal] = Field(None, serialization_alias='take_profit_price')
    status: str
    opened_at: datetime
    closed_at: Optional[datetime]
    updated_at: datetime
    
    @field_serializer('id', 'user_id')
    def serialize_uuid(self, value: UUID | str, _info) -> str:
        return str(value)
    
    class Config:
        from_attributes = True
        populate_by_name = True  # Allow both field name and alias


class FuturesPositionListResponse(BaseModel):
    """Danh sách vị thế futures"""
    positions: List[FuturesPositionResponse]
    total_count: int
    total_unrealized_pnl: Decimal


# ============= FUTURES ORDER SCHEMAS =============

class FuturesOrderCreate(BaseModel):
    """Tạo lệnh futures"""
    symbol: str = Field(..., description="Cặp giao dịch (BTC/USDT)")
    side: str = Field(..., description="BUY (LONG) hoặc SELL (SHORT)")
    order_type: str = Field(..., description="MARKET hoặc LIMIT")
    quantity: Decimal = Field(..., gt=0)
    price: Optional[Decimal] = Field(None, description="Null cho MARKET orders")
    leverage: Decimal = Field(default=Decimal(1), ge=1, le=100)


class FuturesOrderResponse(BaseModel):
    """Response lệnh futures"""
    id: str
    user_id: str
    symbol: str
    side: str
    order_type: str
    market_type: str  # spot, futures
    quantity: Decimal
    price: Optional[Decimal]
    leverage: Decimal
    status: str
    filled_quantity: Decimal
    created_at: datetime
    updated_at: datetime
    filled_at: Optional[datetime]
    margin_required: Optional[Decimal] = None  # Margin yêu cầu
    wallet_updates: Optional[dict] = None  # Cập nhật ví
    
    @field_serializer('id', 'user_id')
    def serialize_uuid(self, value: UUID | str, _info) -> str:
        return str(value)
    
    class Config:
        from_attributes = True
        # Thêm populate_by_name để hỗ trợ alias
        populate_by_name = True


class FuturesOrderListResponse(BaseModel):
    """Danh sách lệnh futures"""
    orders: List[FuturesOrderResponse]
    total_count: int


# ============= FUTURES PNL SCHEMAS =============

class FuturesPnLResponse(BaseModel):
    """Response PnL (lịch sử đóng position)"""
    id: str
    user_id: str
    symbol: str
    side: str
    entry_price: Decimal
    exit_price: Decimal
    quantity: Decimal
    leverage: Decimal
    realized_pnl: Decimal
    pnl_percentage: Decimal
    opening_fee: Decimal
    closing_fee: Decimal
    funding_fee: Decimal
    opened_at: datetime
    closed_at: datetime
    
    @field_serializer('id', 'user_id')
    def serialize_uuid(self, value: UUID | str, _info) -> str:
        return str(value)
    
    class Config:
        from_attributes = True


class FuturesPnLListResponse(BaseModel):
    """Danh sách PnL"""
    pnl_history: List[FuturesPnLResponse]
    total_count: int
    total_pnl: Decimal
    win_rate: Decimal  # Phần trăm lợi nhuận


# ============= UPDATE TP/SL SCHEMA =============

class UpdateTPSLRequest(BaseModel):
    """Cập nhật Take Profit và Stop Loss"""
    take_profit_price: Optional[Decimal] = Field(None, description="Giá Take Profit (null = xóa TP)")
    stop_loss_price: Optional[Decimal] = Field(None, description="Giá Stop Loss (null = xóa SL)")


# ============= CLOSE POSITION SCHEMA =============

class ClosePositionRequest(BaseModel):
    """Đóng vị thế"""
    position_id: str
    exit_price: Decimal = Field(..., gt=0, description="Giá bán/đóng")
    quantity: Optional[Decimal] = Field(None, description="Phần lợi nhuận cụ thể (null = close all)")


class ClosePositionResponse(BaseModel):
    """Response đóng vị thế"""
    position_id: str
    realized_pnl: Decimal
    pnl_percentage: Decimal
    total_fees: Decimal
    wallet_updates: Dict[str, Dict[str, Decimal]]
    message: str


# ============= FUNDING RATE SCHEMA =============

class FundingRateResponse(BaseModel):
    """Response funding rate"""
    symbol: str
    funding_rate: Decimal
    funding_timestamp: datetime
    estimated_fee_8h: Decimal  # Phí dự kiến cho 8 giờ tiếp theo
    
    class Config:
        from_attributes = True


class FundingRateListResponse(BaseModel):
    """Danh sách funding rates"""
    funding_rates: List[FundingRateResponse]
    next_funding_time: datetime


# ============= PORTFOLIO SUMMARY SCHEMA =============

class FuturesPortfolioSummary(BaseModel):
    """Tóm tắt portfolio futures"""
    total_collateral: Decimal  # Tổng ký quỹ
    total_unrealized_pnl: Decimal  # Tổng lợi nhuận chưa thực hiện
    total_realized_pnl: Decimal  # Tổng lợi nhuận đã thực hiện
    total_fees_paid: Decimal  # Tổng phí đã trả
    available_balance: Decimal  # Ký quỹ còn lại
    max_leverage_available: Decimal  # Leverage tối đa có thể dùng
    open_positions_count: int
    closed_positions_count: int
    win_rate: Decimal  # Phần trăm giao dịch lợi nhuận
    best_trade_pnl: Decimal  # Giao dịch tốt nhất
    worst_trade_pnl: Decimal  # Giao dịch tệ nhất
