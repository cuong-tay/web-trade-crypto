"""
Admin Schemas
Pydantic models cho Admin Dashboard APIs
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from decimal import Decimal


# ============= DASHBOARD SCHEMAS =============

class DashboardStatsResponse(BaseModel):
    """Dashboard Stats - 4 Card Metrics"""
    totalUsers: int
    totalTransactions: int
    totalRevenue: Decimal
    activeUsers: int
    usersChange: Decimal
    transactionsVolume: Decimal
    revenueChange: Decimal


class ChartDataResponse(BaseModel):
    """Chart Data - Labels and Values"""
    labels: List[str]
    values: List[Decimal]


class RecentUserResponse(BaseModel):
    """Recent User Info"""
    id: str
    email: str
    username: str
    created_at: datetime
    status: str


class RecentTransactionResponse(BaseModel):
    """Recent Transaction Info"""
    id: str
    user_email: str
    type: str
    currency: str
    amount: Decimal
    created_at: datetime


class ActivityLogResponse(BaseModel):
    """Activity Log Entry"""
    timestamp: datetime
    user_email: str
    action: str
    details: Optional[str]
    ip_address: Optional[str] = None


# ============= USER MANAGEMENT SCHEMAS =============

class UserListItem(BaseModel):
    """User List Item for Table"""
    id: str
    email: str
    username: str
    role: str
    status: str
    created_at: datetime
    last_login: Optional[datetime]
    email_verified: bool


class UserListResponse(BaseModel):
    """User List with Pagination"""
    total: int
    page: int
    users: List[UserListItem]


class UserDetailResponse(BaseModel):
    """Detailed User Info for Modal"""
    id: str
    email: str
    username: str
    role: str
    status: str
    email_verified: bool
    created_at: datetime
    last_login: Optional[datetime]


class BanUserRequest(BaseModel):
    """Request to Ban User"""
    reason: str = Field(..., min_length=1, max_length=500)


class BanUserResponse(BaseModel):
    """Response after Banning User"""
    message: str
    id: str
    status: str


# ============= TRANSACTION MANAGEMENT SCHEMAS =============

class TransactionListItem(BaseModel):
    """Transaction List Item"""
    id: str
    user_id: str
    user_email: str
    type: str  # buy/sell
    currency: str  # Symbol: BTC, ETH, etc
    quantity: Optional[Decimal] = None  # Quantity of coin
    price: Optional[Decimal] = None  # Price per unit
    amount: Decimal  # Total = quantity * price
    fee: Decimal  # Commission
    balance_after: Optional[Decimal] = None  # Not available for trades
    created_at: datetime


class TransactionListResponse(BaseModel):
    """Transaction List with Pagination"""
    total: int
    page: int
    transactions: List[TransactionListItem]


class TransactionDetailResponse(BaseModel):
    """Detailed Transaction Info"""
    id: str
    user_id: str
    user_email: str
    type: str  # buy/sell
    currency: str  # Symbol: BTC, ETH, etc
    quantity: Optional[Decimal] = None  # Quantity of coin
    price: Optional[Decimal] = None  # Price per unit
    amount: Decimal  # Total = quantity * price
    fee: Decimal  # Commission
    balance_after: Optional[Decimal] = None  # Not available for trades
    created_at: datetime


# ============= REPORTS SCHEMAS =============

class ReportSummaryResponse(BaseModel):
    """Report Summary Stats"""
    totalRevenue: Decimal
    totalFees: Decimal
    newUsers: int
    totalTrades: int
    revenueGrowth: Decimal
    feesGrowth: Decimal
    usersGrowth: Decimal
    tradesGrowth: Decimal


class TopUserResponse(BaseModel):
    """Top User by Volume"""
    rank: int
    email: str
    trades: int
    volume: Decimal
    fees: Decimal


class TopDayResponse(BaseModel):
    """Most Active Day"""
    rank: int
    date: str
    trades: int
    volume: Decimal
    activeUsers: int


# ============= SETTINGS SCHEMAS =============

class GeneralSettingsResponse(BaseModel):
    """General Settings"""
    platform_name: str
    support_email: str
    maintenance_mode: str
    default_language: str
    platform_description: str


class GeneralSettingsUpdate(BaseModel):
    """Update General Settings"""
    platform_name: Optional[str] = None
    support_email: Optional[str] = None
    maintenance_mode: Optional[str] = None
    default_language: Optional[str] = None
    platform_description: Optional[str] = None


class TradingSettingsResponse(BaseModel):
    """Trading Settings"""
    min_trade_amount: Decimal
    max_trade_amount: Decimal
    max_leverage: int
    price_update_interval: int
    enable_stop_loss: bool
    enable_take_profit: bool


class TradingSettingsUpdate(BaseModel):
    """Update Trading Settings"""
    min_trade_amount: Optional[Decimal] = None
    max_trade_amount: Optional[Decimal] = None
    max_leverage: Optional[int] = None
    price_update_interval: Optional[int] = None
    enable_stop_loss: Optional[bool] = None
    enable_take_profit: Optional[bool] = None


class FeeTier(BaseModel):
    """Fee Tier"""
    volume_min: Decimal
    volume_max: Optional[Decimal]
    fee: Decimal


class FeesSettingsResponse(BaseModel):
    """Fees & Commissions Settings"""
    trading_fee: Decimal
    withdrawal_fee: Decimal
    deposit_fee: Decimal
    vip_discount: Decimal
    fee_tiers: List[FeeTier]


class FeesSettingsUpdate(BaseModel):
    """Update Fees Settings"""
    trading_fee: Optional[Decimal] = None
    withdrawal_fee: Optional[Decimal] = None
    deposit_fee: Optional[Decimal] = None
    vip_discount: Optional[Decimal] = None
    fee_tiers: Optional[List[FeeTier]] = None


class SecuritySettingsResponse(BaseModel):
    """Security Settings"""
    session_timeout: int
    max_login_attempts: int
    password_min_length: int
    ip_whitelist_mode: str
    enable_2fa: bool
    require_email_verification: bool
    enable_captcha: bool


class SecuritySettingsUpdate(BaseModel):
    """Update Security Settings"""
    session_timeout: Optional[int] = None
    max_login_attempts: Optional[int] = None
    password_min_length: Optional[int] = None
    ip_whitelist_mode: Optional[str] = None
    enable_2fa: Optional[bool] = None
    require_email_verification: Optional[bool] = None
    enable_captcha: Optional[bool] = None


class NotificationSettingsResponse(BaseModel):
    """Notification Settings"""
    notify_new_user: bool
    notify_large_trade: bool
    notify_withdrawal: bool
    notify_suspicious: bool
    admin_emails: str


class NotificationSettingsUpdate(BaseModel):
    """Update Notification Settings"""
    notify_new_user: Optional[bool] = None
    notify_large_trade: Optional[bool] = None
    notify_withdrawal: Optional[bool] = None
    notify_suspicious: Optional[bool] = None
    admin_emails: Optional[str] = None


class MessageResponse(BaseModel):
    """Generic Message Response"""
    message: str
