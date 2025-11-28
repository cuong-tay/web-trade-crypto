"""
Admin API Routes
API endpoints cho Admin Dashboard
Base URL: /api/admin
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func, extract, Date, String
from decimal import Decimal
from datetime import datetime, timedelta
from typing import Optional, List
import logging
import io
import csv

from src.config.database import get_db
from src.schemas.admin import *
from src.models.user import User, UserProfile, ActivityLog
from src.models.order import Order, Trade
from src.models.wallet import Wallet, Transaction
from src.models.position import Position
from src.utils.dependencies import get_current_user
from src.utils.timezone import get_vietnam_now

router = APIRouter()
logger = logging.getLogger(__name__)


# ============= ADMIN AUTH MIDDLEWARE =============

def require_admin(current_user: User = Depends(get_current_user)):
    """Middleware: Chỉ cho phép admin access"""
    if current_user.role != 'admin': # type: ignore
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


# ============= DASHBOARD APIs =============

@router.get("/dashboard/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Lấy 4 stat cards cho dashboard"""
    try:
        today = datetime.now().date()
        yesterday = today - timedelta(days=1)
        
        # Total Users
        total_users = db.query(func.count(User.id)).scalar()
        
        # Users created today
        users_today = db.query(func.count(User.id)).filter(
            func.cast(User.created_at, Date) == today
        ).scalar()
        
        # Users created yesterday
        users_yesterday = db.query(func.count(User.id)).filter(
            func.cast(User.created_at, Date) == yesterday
        ).scalar()
        
        users_change = ((users_today - users_yesterday) / users_yesterday * 100) if users_yesterday > 0 else 0
        
        # Active Users (logged in last 24h)
        active_users = db.query(func.count(User.id)).filter(
            User.last_login >= datetime.now() - timedelta(hours=24)
        ).scalar()
        
        # Transactions Today
        total_transactions = db.query(func.count(Transaction.id)).filter(
            func.cast(Transaction.created_at, Date) == today
        ).scalar()
        
        # Transaction Volume Today
        transactions_volume = db.query(func.sum(Transaction.amount)).filter(
            and_(
                func.cast(Transaction.created_at, Date) == today,
                Transaction.amount > 0
            )
        ).scalar() or Decimal("0")
        
        # Revenue Today (fees)
        total_revenue = db.query(func.sum(Transaction.fee)).filter(
            func.cast(Transaction.created_at, Date) == today
        ).scalar() or Decimal("0")
        
        # Revenue Yesterday
        revenue_yesterday = db.query(func.sum(Transaction.fee)).filter(
            func.cast(Transaction.created_at, Date) == yesterday
        ).scalar() or Decimal("0")
        
        revenue_change = ((total_revenue - revenue_yesterday) / revenue_yesterday * 100) if revenue_yesterday > 0 else 0
        
        return DashboardStatsResponse(
            totalUsers=total_users or 0,
            totalTransactions=total_transactions or 0,
            totalRevenue=total_revenue,
            activeUsers=active_users or 0,
            usersChange=Decimal(str(users_change)),
            transactionsVolume=transactions_volume,
            revenueChange=Decimal(str(revenue_change))
        )
        
    except Exception as e:
        logger.error(f"❌ Error fetching dashboard stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/trading-volume", response_model=ChartDataResponse)
async def get_trading_volume(
    period: str = Query("7d", description="7d, 30d, 90d"),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Trading Volume Chart"""
    try:
        from sqlalchemy import Date
        days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 7)
        labels = []
        values = []
        
        for i in range(days):
            date = datetime.now().date() - timedelta(days=days-i-1)
            volume = db.query(func.sum(Transaction.amount)).filter(
                and_(
                    func.cast(Transaction.created_at, Date) == date,
                    Transaction.amount > 0
                )
            ).scalar()
            
            labels.append(date.strftime("%a"))
            values.append(Decimal(str(volume or 0)))
        
        return ChartDataResponse(labels=labels, values=values)
        
    except Exception as e:
        logger.error(f"❌ Error fetching trading volume: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/recent-users", response_model=List[RecentUserResponse])
async def get_recent_users(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """5 User mới nhất"""
    try:
        users = db.query(User).order_by(desc(User.created_at)).limit(5).all()
        
        return [
            RecentUserResponse(
                id=str(u.id),
                email=str(u.email),
                username=str(u.username),
                created_at=u.created_at,  # type: ignore
                status=str(u.status)
            ) for u in users
        ]
        
    except Exception as e:
        logger.error(f"❌ Error fetching recent users: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/recent-transactions", response_model=List[RecentTransactionResponse])
async def get_recent_transactions(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """5 Giao dịch mới nhất"""
    try:
        transactions = db.query(Transaction, User.email).join(
            User, Transaction.user_id == User.id
        ).order_by(desc(Transaction.created_at)).limit(5).all()
        
        return [
            RecentTransactionResponse(
                id=str(t.id),
                user_email=str(email),
                type=str(t.type),
                currency=str(t.currency),
                amount=t.amount,
                created_at=t.created_at  # type: ignore
            ) for t, email in transactions
        ]
        
    except Exception as e:
        logger.error(f"❌ Error fetching recent transactions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/dashboard/activity-log", response_model=List[ActivityLogResponse])
async def get_activity_log(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """10 Log hoạt động mới nhất"""
    try:
        logs = db.query(ActivityLog, User.email).join(
            User, ActivityLog.user_id == User.id
        ).order_by(desc(ActivityLog.created_at)).limit(10).all()
        
        return [
            ActivityLogResponse(
                timestamp=log.created_at,  # type: ignore
                user_email=str(email),
                action=str(log.action),
                details=str(log.details) if log.details else "",
                ip_address=None
            ) for log, email in logs
        ]
        
    except Exception as e:
        logger.error(f"❌ Error fetching activity log: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============= USER MANAGEMENT APIs =============

@router.get("/users", response_model=UserListResponse)
async def get_users(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=1000),
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Danh sách users với filter và pagination"""
    try:
        query = db.query(User)
        
        # Search
        if search:
            query = query.filter(
                or_(
                    User.email.contains(search),
                    User.username.contains(search),
                    func.cast(User.id, String).contains(search)
                )
            )
        
        # Filter by status
        if status:
            query = query.filter(User.status == status)
        
        # Filter by role
        if role:
            query = query.filter(User.role == role)
        
        # Count total
        total = query.count()
        
        # Pagination
        users = query.order_by(desc(User.created_at)).offset((page-1)*limit).limit(limit).all()
        
        return UserListResponse(
            total=total,
            page=page,
            users=[
                UserListItem(
                    id=str(u.id),
                    email=str(u.email),
                    username=str(u.username),
                    role=str(u.role),
                    status=str(u.status),
                    created_at=u.created_at,  # type: ignore
                    last_login=u.last_login,  # type: ignore
                    email_verified=bool(u.email_verified)
                ) for u in users
            ]
        )
        
    except Exception as e:
        logger.error(f"❌ Error fetching users: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{user_id}", response_model=UserDetailResponse)
async def get_user_detail(
    user_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Chi tiết user"""
    try:
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return UserDetailResponse(
            id=str(user.id),
            email=str(user.email),
            username=str(user.username),
            role=str(user.role),
            status=str(user.status),
            email_verified=bool(user.email_verified),
            created_at=user.created_at,  # type: ignore
            last_login=user.last_login  # type: ignore
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching user detail: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/users/{user_id}/ban", response_model=BanUserResponse)
async def ban_user(
    user_id: str,
    ban_request: BanUserRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Ban user"""
    try:
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update status
        user.status = 'banned'  # type: ignore
        
        # Log activity
        activity = ActivityLog(
            user_id=user.id,
            action='banned',
            details=f"Banned by admin. Reason: {ban_request.reason}",
            created_at=get_vietnam_now()
        )
        db.add(activity)
        db.commit()
        
        return BanUserResponse(
            message="User banned successfully",
            id=str(user.id),
            status=str(user.status)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error banning user: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/users/{user_id}/unban", response_model=BanUserResponse)
async def unban_user(
    user_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Unban user"""
    try:
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update status
        user.status = 'active'  # type: ignore
        
        # Log activity
        activity = ActivityLog(
            user_id=user.id,
            action='unbanned',
            details="Unbanned by admin",
            created_at=get_vietnam_now()
        )
        db.add(activity)
        db.commit()
        
        return BanUserResponse(
            message="User unbanned successfully",
            id=str(user.id),
            status=str(user.status)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error unbanning user: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/users/export-csv")
async def export_users_csv(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Export users to CSV"""
    try:
        users = db.query(User).all()
        
        # Create CSV in memory
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow(['ID', 'Email', 'Username', 'Role', 'Status', 'Created', 'Last Login'])
        
        # Data
        for u in users:
            created = u.created_at.strftime("%Y-%m-%d %H:%M:%S") if hasattr(u.created_at, 'strftime') else str(u.created_at)
            last_login = ""
            try:
                if hasattr(u.last_login, 'strftime'):  # type: ignore
                    last_login = u.last_login.strftime("%Y-%m-%d %H:%M:%S")  # type: ignore
                elif u.last_login:  # type: ignore
                    last_login = str(u.last_login)
            except (TypeError, ValueError):
                pass
            
            writer.writerow([
                str(u.id),
                str(u.email),
                str(u.username),
                str(u.role),
                str(u.status),
                created,
                last_login
            ])
        
        output.seek(0)
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=users_{datetime.now().strftime('%Y%m%d')}.csv"}
        )
        
    except Exception as e:
        logger.error(f"❌ Error exporting users CSV: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============= TRANSACTION MANAGEMENT APIs =============

@router.get("/transactions", response_model=TransactionListResponse)
async def get_transactions(
    page: int = Query(1, ge=1),
    limit: int = Query(15, ge=1, le=1000),
    search: Optional[str] = Query(None),
    side: Optional[str] = Query(None),  # Changed: type → side (buy/sell)
    symbol: Optional[str] = Query(None),  # Changed: currency → symbol
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Danh sách giao dịch mua/bán coin (từ bảng trades)"""
    try:
        # Changed: Query bảng Trade (giao dịch mua/bán) thay vì Transaction (ví)
        query = db.query(Trade, User.email).join(
            User, Trade.user_id == User.id
        )
        
        # Search by email
        if search:
            query = query.filter(
                or_(
                    User.email.contains(search),
                    func.cast(Trade.id, String).contains(search)
                )
            )
        
        # Filter by side (buy/sell)
        if side:
            query = query.filter(Trade.side == side)
        
        # Filter by symbol (BTC, ETH, etc)
        if symbol:
            query = query.filter(Trade.symbol == symbol)
        
        # Date range
        if from_date:
            query = query.filter(Trade.created_at >= datetime.fromisoformat(from_date))
        if to_date:
            query = query.filter(Trade.created_at <= datetime.fromisoformat(to_date))
        
        # Count total
        total = query.count()
        
        # Pagination
        results = query.order_by(desc(Trade.created_at)).offset((page-1)*limit).limit(limit).all()
        
        return TransactionListResponse(
            total=total,
            page=page,
            transactions=[
                TransactionListItem(
                    id=str(trade.id),
                    user_id=str(trade.user_id),
                    user_email=str(email),
                    type=str(trade.side),  # buy/sell instead of futures_pnl
                    currency=str(trade.symbol),  # BTC/ETH/DOGE instead of USDT
                    quantity=trade.quantity,  # Quantity of coin
                    price=trade.price,  # Price per unit
                    amount=trade.quantity * trade.price,  # total = quantity * price
                    fee=trade.commission,  # commission instead of fee
                    balance_after=None,  # trades don't have balance_after
                    created_at=trade.created_at  # type: ignore
                ) for trade, email in results
            ]
        )
        
    except Exception as e:
        logger.error(f"❌ Error fetching transactions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/transactions/{txn_id}", response_model=TransactionDetailResponse)
async def get_transaction_detail(
    txn_id: str,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Chi tiết giao dịch mua/bán coin"""
    try:
        # Changed: Query bảng Trade thay vì Transaction
        result = db.query(Trade, User.email).join(
            User, Trade.user_id == User.id
        ).filter(Trade.id == txn_id).first()
        
        if not result:
            raise HTTPException(status_code=404, detail="Trade not found")
        
        trade, email = result
        
        return TransactionDetailResponse(
            id=str(trade.id),
            user_id=str(trade.user_id),
            user_email=str(email),
            type=str(trade.side),  # buy/sell
            currency=str(trade.symbol),  # BTC/ETH/DOGE
            quantity=trade.quantity,  # Quantity of coin
            price=trade.price,  # Price per unit
            amount=trade.quantity * trade.price,  # Total
            fee=trade.commission,  # Commission
            balance_after=None,  # Not available for trades
            created_at=trade.created_at  # type: ignore
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error fetching transaction detail: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/transactions/export-csv")
async def export_transactions_csv(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Export giao dịch mua/bán coin to CSV"""
    try:
        # Changed: Query bảng Trade thay vì Transaction
        results = db.query(Trade, User.email).join(
            User, Trade.user_id == User.id
        ).all()
        
        # Create CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header - Changed fields to match trades
        writer.writerow(['ID', 'User', 'Type', 'Symbol', 'Quantity', 'Price', 'Total', 'Fee', 'Created'])
        
        # Data
        for trade, email in results:
            created = trade.created_at.strftime("%Y-%m-%d %H:%M:%S") if hasattr(trade.created_at, 'strftime') else str(trade.created_at)
            total = trade.quantity * trade.price
            
            writer.writerow([
                str(trade.id),
                str(email),
                str(trade.side),  # buy/sell
                str(trade.symbol),  # BTC/ETH/etc
                str(trade.quantity),  # Quantity
                str(trade.price),  # Price
                str(total),  # Total = quantity * price
                str(trade.commission),  # Commission
                created
            ])
        
        output.seek(0)
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=transactions_{datetime.now().strftime('%Y%m%d')}.csv"}
        )
        
    except Exception as e:
        logger.error(f"❌ Error exporting transactions CSV: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============= REPORTS APIs =============

@router.get("/reports/summary", response_model=ReportSummaryResponse)
async def get_reports_summary(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Report summary với date range"""
    try:
        from sqlalchemy import Date
        query_filter = []
        
        if from_date:
            query_filter.append(func.cast(Transaction.created_at, Date) >= datetime.fromisoformat(from_date).date())
        if to_date:
            query_filter.append(func.cast(Transaction.created_at, Date) <= datetime.fromisoformat(to_date).date())
        
        # Total Revenue (fees)
        total_revenue = db.query(func.sum(Transaction.fee)).filter(
            *query_filter
        ).scalar() or Decimal("0")
        
        # Total Fees (same as revenue in our case)
        total_fees = total_revenue
        
        # Total Trades
        total_trades = db.query(func.count(Trade.id)).filter(
            *query_filter
        ).scalar() or 0
        
        # New Users
        new_users = db.query(func.count(User.id))
        if from_date:
            new_users = new_users.filter(func.cast(User.created_at, Date) >= datetime.fromisoformat(from_date).date())
        if to_date:
            new_users = new_users.filter(func.cast(User.created_at, Date) <= datetime.fromisoformat(to_date).date())
        new_users = new_users.scalar() or 0
        
        # Calculate growth rates (mock for now since we need previous period comparison)
        return ReportSummaryResponse(
            totalRevenue=total_revenue,
            totalFees=total_fees,
            newUsers=new_users,
            totalTrades=total_trades,
            revenueGrowth=Decimal("0"),
            feesGrowth=Decimal("0"),
            usersGrowth=Decimal("0"),
            tradesGrowth=Decimal("0")
        )
        
    except Exception as e:
        logger.error(f"❌ Error fetching report summary: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/revenue-chart", response_model=ChartDataResponse)
async def get_revenue_chart(
    period: str = Query("30d"),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Revenue Chart"""
    try:
        from sqlalchemy import Date
        days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
        labels = []
        values = []
        
        for i in range(days):
            date = datetime.now().date() - timedelta(days=days-i-1)
            revenue = db.query(func.sum(Transaction.fee)).filter(
                func.cast(Transaction.created_at, Date) == date
            ).scalar()
            
            labels.append(date.strftime("%m/%d"))
            values.append(Decimal(str(revenue or 0)))
        
        return ChartDataResponse(labels=labels, values=values)
        
    except Exception as e:
        logger.error(f"❌ Error fetching revenue chart: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/trades-chart", response_model=ChartDataResponse)
async def get_trades_chart(
    period: str = Query("30d"),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Trades Chart"""
    try:
        from sqlalchemy import Date
        days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
        labels = []
        values = []
        
        for i in range(days):
            date = datetime.now().date() - timedelta(days=days-i-1)
            count = db.query(func.count(Trade.id)).filter(
                func.cast(Trade.created_at, Date) == date
            ).scalar()
            
            labels.append(date.strftime("%m/%d"))
            values.append(Decimal(str(count or 0)))
        
        return ChartDataResponse(labels=labels, values=values)
        
    except Exception as e:
        logger.error(f"❌ Error fetching trades chart: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/volume-chart", response_model=ChartDataResponse)
async def get_volume_chart(
    period: str = Query("30d"),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Volume Chart"""
    try:
        from sqlalchemy import Date
        days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
        labels = []
        values = []
        
        for i in range(days):
            date = datetime.now().date() - timedelta(days=days-i-1)
            volume = db.query(func.sum(Trade.quantity * Trade.price)).filter(
                func.cast(Trade.created_at, Date) == date
            ).scalar()
            
            labels.append(date.strftime("%m/%d"))
            values.append(Decimal(str(volume or 0)))
        
        return ChartDataResponse(labels=labels, values=values)
        
    except Exception as e:
        logger.error(f"❌ Error fetching volume chart: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/new-users-chart", response_model=ChartDataResponse)
async def get_new_users_chart(
    period: str = Query("30d"),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """New Users Chart"""
    try:
        from sqlalchemy import Date
        days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
        labels = []
        values = []
        
        for i in range(days):
            date = datetime.now().date() - timedelta(days=days-i-1)
            count = db.query(func.count(User.id)).filter(
                func.cast(User.created_at, Date) == date
            ).scalar()
            
            labels.append(date.strftime("%m/%d"))
            values.append(Decimal(str(count or 0)))
        
        return ChartDataResponse(labels=labels, values=values)
        
    except Exception as e:
        logger.error(f"❌ Error fetching new users chart: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/active-users-chart", response_model=ChartDataResponse)
async def get_active_users_chart(
    period: str = Query("30d"),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Active Users Chart"""
    try:
        from sqlalchemy import Date
        days = {"7d": 7, "30d": 30, "90d": 90}.get(period, 30)
        labels = []
        values = []
        
        for i in range(days):
            date = datetime.now().date() - timedelta(days=days-i-1)
            count = db.query(func.count(func.distinct(Transaction.user_id))).filter(
                func.cast(Transaction.created_at, Date) == date
            ).scalar()
            
            labels.append(date.strftime("%m/%d"))
            values.append(Decimal(str(count or 0)))
        
        return ChartDataResponse(labels=labels, values=values)
        
    except Exception as e:
        logger.error(f"❌ Error fetching active users chart: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/top-users", response_model=List[TopUserResponse])
async def get_top_users(
    limit: int = Query(10, ge=1, le=50),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Top Users by Trading Volume"""
    try:
        from sqlalchemy import Date
        query_filter = []
        
        if from_date:
            query_filter.append(func.cast(Transaction.created_at, Date) >= datetime.fromisoformat(from_date).date())
        if to_date:
            query_filter.append(func.cast(Transaction.created_at, Date) <= datetime.fromisoformat(to_date).date())
        
        # Group by user và sum volume
        query = db.query(
            User.id,
            User.email,
            User.username,
            func.count(Transaction.id).label('total_trades'),
            func.sum(Transaction.amount).label('total_volume')
        ).join(Transaction, User.id == Transaction.user_id)
        
        if query_filter:
            query = query.filter(and_(*query_filter))
        
        results = query.group_by(
            User.id, User.email, User.username
        ).order_by(
            desc('total_volume')
        ).limit(limit).all()
        
        return [
            TopUserResponse(
                rank=idx+1,
                email=str(r.email),
                trades=int(r.total_trades),
                volume=r.total_volume or Decimal("0"),
                fees=Decimal("0")
            ) for idx, r in enumerate(results)
        ]
        
    except Exception as e:
        logger.error(f"❌ Error fetching top users: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/top-days", response_model=List[TopDayResponse])
async def get_top_days(
    limit: int = Query(10, ge=1, le=50),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Top Trading Days"""
    try:
        from sqlalchemy import Date
        query_filter = []
        
        if from_date:
            query_filter.append(func.cast(Transaction.created_at, Date) >= datetime.fromisoformat(from_date).date())
        if to_date:
            query_filter.append(func.cast(Transaction.created_at, Date) <= datetime.fromisoformat(to_date).date())
        
        # Group by date
        query = db.query(
            func.cast(Transaction.created_at, Date).label('date'),
            func.count(Transaction.id).label('total_trades'),
            func.sum(Transaction.amount).label('total_volume')
        )
        
        if query_filter:
            query = query.filter(and_(*query_filter))
        
        results = query.group_by(
            func.cast(Transaction.created_at, Date)
        ).order_by(
            desc('total_volume')
        ).limit(limit).all()
        
        return [
            TopDayResponse(
                rank=idx+1,
                date=r.date.isoformat(),
                trades=int(r.total_trades),
                volume=r.total_volume or Decimal("0"),
                activeUsers=0
            ) for idx, r in enumerate(results)
        ]
        
    except Exception as e:
        logger.error(f"❌ Error fetching top days: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============= SETTINGS APIs =============

# NOTE: Settings được lưu trong bảng nào? Nếu không có bảng settings riêng,
# ta có thể dùng activity_log.details để lưu JSON settings hoặc
# return mock data. Ở đây tôi sẽ return mock data vì không có bảng settings

@router.get("/settings/general", response_model=GeneralSettingsResponse)
async def get_general_settings(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """General Settings - Mock data (no settings table)"""
    try:
        return GeneralSettingsResponse(
            platform_name="C-Trading",
            support_email="support@ctrading.com",
            maintenance_mode="inactive",
            default_language="vi",
            platform_description="Cryptocurrency Trading Platform"
        )
    except Exception as e:
        logger.error(f"❌ Error fetching general settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/settings/general")
async def update_general_settings(
    settings: GeneralSettingsUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update General Settings"""
    try:
        # Log activity (since no settings table exists)
        activity = ActivityLog(
            user_id=admin.id,
            action='update_settings',
            entity_type='general_settings',
            details=str(settings.model_dump()),
            created_at=get_vietnam_now()
        )
        db.add(activity)
        db.commit()
        
        return {"message": "General settings updated", "settings": settings}
        
    except Exception as e:
        logger.error(f"❌ Error updating general settings: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings/trading", response_model=TradingSettingsResponse)
async def get_trading_settings(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Trading Settings - Mock data"""
    try:
        return TradingSettingsResponse(
            min_trade_amount=Decimal("10"),
            max_trade_amount=Decimal("1000000"),
            max_leverage=125,
            price_update_interval=1000,
            enable_stop_loss=True,
            enable_take_profit=True
        )
    except Exception as e:
        logger.error(f"❌ Error fetching trading settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/settings/trading")
async def update_trading_settings(
    settings: TradingSettingsUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update Trading Settings"""
    try:
        activity = ActivityLog(
            user_id=admin.id,
            action='update_settings',
            entity_type='trading_settings',
            details=str(settings.model_dump()),
            created_at=get_vietnam_now()
        )
        db.add(activity)
        db.commit()
        
        return {"message": "Trading settings updated", "settings": settings}
        
    except Exception as e:
        logger.error(f"❌ Error updating trading settings: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings/fees", response_model=FeesSettingsResponse)
async def get_fees_settings(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Fees Settings - Mock data"""
    try:
        return FeesSettingsResponse(
            trading_fee=Decimal("0.04"),
            withdrawal_fee=Decimal("1"),
            deposit_fee=Decimal("0"),
            vip_discount=Decimal("0.1"),
            fee_tiers=[]
        )
    except Exception as e:
        logger.error(f"❌ Error fetching fees settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/settings/fees")
async def update_fees_settings(
    settings: FeesSettingsUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update Fees Settings"""
    try:
        activity = ActivityLog(
            user_id=admin.id,
            action='update_settings',
            entity_type='fees_settings',
            details=str(settings.model_dump()),
            created_at=get_vietnam_now()
        )
        db.add(activity)
        db.commit()
        
        return {"message": "Fees settings updated", "settings": settings}
        
    except Exception as e:
        logger.error(f"❌ Error updating fees settings: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings/security", response_model=SecuritySettingsResponse)
async def get_security_settings(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Security Settings - Mock data"""
    try:
        return SecuritySettingsResponse(
            session_timeout=3600,
            max_login_attempts=5,
            password_min_length=8,
            ip_whitelist_mode="disabled",
            enable_2fa=False,
            require_email_verification=True,
            enable_captcha=False
        )
    except Exception as e:
        logger.error(f"❌ Error fetching security settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/settings/security")
async def update_security_settings(
    settings: SecuritySettingsUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update Security Settings"""
    try:
        activity = ActivityLog(
            user_id=admin.id,
            action='update_settings',
            entity_type='security_settings',
            details=str(settings.model_dump()),
            created_at=get_vietnam_now()
        )
        db.add(activity)
        db.commit()
        
        return {"message": "Security settings updated", "settings": settings}
        
    except Exception as e:
        logger.error(f"❌ Error updating security settings: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/settings/notifications", response_model=NotificationSettingsResponse)
async def get_notification_settings(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Notification Settings - Mock data"""
    try:
        return NotificationSettingsResponse(
            notify_new_user=True,
            notify_large_trade=True,
            notify_withdrawal=True,
            notify_suspicious=True,
            admin_emails="admin@ctrading.com"
        )
    except Exception as e:
        logger.error(f"❌ Error fetching notification settings: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/settings/notifications")
async def update_notification_settings(
    settings: NotificationSettingsUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update Notification Settings"""
    try:
        activity = ActivityLog(
            user_id=admin.id,
            action='update_settings',
            entity_type='notification_settings',
            details=str(settings.model_dump()),
            created_at=get_vietnam_now()
        )
        db.add(activity)
        db.commit()
        
        return {"message": "Notification settings updated", "settings": settings}
        
    except Exception as e:
        logger.error(f"❌ Error updating notification settings: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))


# ============= REPORTS ENDPOINTS (Frontend cần) =============

@router.get("/reports/user-growth")
async def get_user_growth(
    period: str = Query("30d", description="7d, 30d, 90d, all"),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Biểu đồ tăng trưởng người dùng - số user mới theo ngày"""
    try:
        period_map = {"7d": 7, "30d": 30, "90d": 90}
        days = period_map.get(period, 30)
        start_date = get_vietnam_now() - timedelta(days=days)
        
        # GROUP BY DATE
        results = db.query(
            func.cast(User.created_at, Date).label("date"),
            func.count(User.id).label("count")
        ).filter(
            User.created_at >= start_date
        ).group_by(
            func.cast(User.created_at, Date)
        ).order_by("date").all()
        
        labels = [str(r[0]) for r in results]
        values = [Decimal(str(int(r[1]))) for r in results]
        
        return {"labels": labels, "values": values, "period": period}
    except Exception as e:
        logger.error(f"❌ Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/top-coins")
async def get_top_coins(
    period: str = Query("30d", description="7d, 30d, 90d, all"),
    limit: int = Query(10, ge=1, le=50),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Top coins được giao dịch nhiều nhất - tính theo tổng giá trị (quantity × price)"""
    try:
        period_map = {"7d": 7, "30d": 30, "90d": 90}
        days = period_map.get(period, 30)
        start_date = get_vietnam_now() - timedelta(days=days)
        
        # GROUP BY symbol, SUM volume
        results = db.query(
            Trade.symbol,
            func.sum(Trade.quantity * Trade.price).label("total_volume"),
            func.count(Trade.id).label("trade_count")
        ).filter(
            Trade.created_at >= start_date
        ).group_by(
            Trade.symbol
        ).order_by(
            func.sum(Trade.quantity * Trade.price).desc()
        ).limit(limit).all()
        
        labels = [r[0] for r in results]
        values = [Decimal(str(float(r[1] or 0))) for r in results]
        
        return {"labels": labels, "values": values, "period": period}
    except Exception as e:
        logger.error(f"❌ Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/buy-sell-ratio")
async def get_buy_sell_ratio(
    period: str = Query("30d", description="7d, 30d, 90d, all"),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Tỷ lệ BUY/SELL - thống kê mua vs bán"""
    try:
        period_map = {"7d": 7, "30d": 30, "90d": 90}
        days = period_map.get(period, 30)
        start_date = get_vietnam_now() - timedelta(days=days)
        
        # Count BUY trades
        buy_count = db.query(func.count(Trade.id)).filter(
            and_(Trade.side == "BUY", Trade.created_at >= start_date)
        ).scalar() or 0
        
        # Count SELL trades
        sell_count = db.query(func.count(Trade.id)).filter(
            and_(Trade.side == "SELL", Trade.created_at >= start_date)
        ).scalar() or 0
        
        total = buy_count + sell_count
        buy_pct = (buy_count / total * 100) if total > 0 else 0
        sell_pct = (sell_count / total * 100) if total > 0 else 0
        
        return {
            "labels": ["BUY", "SELL"],
            "values": [Decimal(str(round(buy_pct, 2))), Decimal(str(round(sell_pct, 2)))],
            "buy_count": buy_count,
            "sell_count": sell_count,
            "period": period
        }
    except Exception as e:
        logger.error(f"❌ Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/reports/activity-heatmap")
async def get_activity_heatmap(
    period: str = Query("30d", description="7d, 30d, 90d, all"),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Bản đồ nhiệt hoạt động - giao dịch theo giờ trong ngày"""
    try:
        period_map = {"7d": 7, "30d": 30, "90d": 90}
        days = period_map.get(period, 30)
        start_date = get_vietnam_now() - timedelta(days=days)
        
        # GROUP BY HOUR
        results = db.query(
            extract('hour', Trade.created_at).label("hour"),
            func.count(Trade.id).label("count")
        ).filter(
            Trade.created_at >= start_date
        ).group_by(
            extract('hour', Trade.created_at)
        ).all()
        
        # Create 24-hour array
        data = [0] * 24
        for r in results:
            hour = int(r[0]) if r[0] is not None else 0
            if 0 <= hour < 24:
                data[hour] = int(r[1])
        
        labels = [str(h) for h in range(24)]
        values = [Decimal(str(v)) for v in data]
        
        return {"labels": labels, "values": values, "period": period}
    except Exception as e:
        logger.error(f"❌ Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

