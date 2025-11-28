"""
Futures Trading API
Giao dịch ký quỹ/margin với leverage
Sử dụng các bảng database hiện có: positions, orders, trades, wallets, price_alerts
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, func
from decimal import Decimal
from uuid import uuid4
import logging
from datetime import datetime, timedelta

from src.config.database import get_db
from src.schemas.futures import (
    FuturesPositionCreate, FuturesPositionResponse, FuturesPositionListResponse,
    FuturesOrderCreate, FuturesOrderResponse, FuturesOrderListResponse,
    FuturesPnLResponse, FuturesPnLListResponse, FundingRateResponse, FundingRateListResponse,
    ClosePositionRequest, ClosePositionResponse, FuturesPortfolioSummary, UpdateTPSLRequest
)
from src.models.position import Position
from src.models.order import Order
from src.models.wallet import Wallet, Transaction
from src.models.watchlist import Watchlist  # Dùng price_alerts nếu có
from src.utils.dependencies import get_current_user, check_user_not_banned
from src.utils.timezone import get_vietnam_now
from src.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)


# ============= FUTURES POSITIONS =============

@router.post("/positions", response_model=FuturesPositionResponse)
async def open_futures_position(
    position_data: FuturesPositionCreate,
    current_user: User = Depends(check_user_not_banned),
    db: Session = Depends(get_db)
):
    """
    Mở vị thế futures mới
    
    - **symbol**: Cặp giao dịch (BTC/USDT, ETH/USDT, etc)
    - **side**: LONG hoặc SHORT
    - **entry_price**: Giá vào
    - **quantity**: Số lượng hợp đồng
    - **leverage**: Leverage (1x-100x, mặc định 1x)
    - **collateral**: Ký quỹ ban đầu (USDT)
    """
    try:
        user_id = current_user.id
        logger.info(f"📈 Opening futures position: {position_data.symbol} {position_data.side} for user {user_id}")
        
        # Kiểm tra ký quỹ
        wallet = db.query(Wallet).filter(
            and_(Wallet.user_id == user_id, Wallet.currency == "USDT")
        ).first()
        
        if not wallet:
            logger.warning(f"❌ No USDT wallet for user {user_id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không có ví USDT"
            )
        
        wallet_balance = Decimal(str(wallet.balance))
        if wallet_balance < position_data.collateral:
            logger.warning(f"❌ Insufficient collateral for user {user_id}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ký quỹ không đủ"
            )
        
        # Trừ ký quỹ từ wallet
        new_balance = wallet_balance - position_data.collateral
        db.execute(
            Wallet.__table__.update().where(Wallet.id == wallet.id).values(balance=new_balance)
        )
        
        # Tạo position
        position = Position(
            id=uuid4(),
            user_id=user_id,
            symbol=position_data.symbol,
            side=position_data.side,
            entry_price=position_data.entry_price,
            quantity=position_data.quantity,
            leverage=position_data.leverage,
            margin=position_data.collateral,  # Dùng trường margin thay vì collateral
            unrealized_pnl=Decimal(0),
            stop_loss=position_data.stop_loss_price,
            take_profit=position_data.take_profit_price,
            status='OPEN',
            opened_at=get_vietnam_now()
        )
        
        db.add(position)
        
        # Ghi transaction
        transaction = Transaction(
            id=uuid4(),
            user_id=user_id,
            wallet_id=wallet.id,
            type="futures_collateral",
            currency="USDT",
            amount=-position_data.collateral,
            balance_after=new_balance,
            created_at=get_vietnam_now()
        )
        db.add(transaction)
        db.commit()
        db.refresh(position)
        
        logger.info(f"✅ Futures position opened: {position.id}")
        
        # Convert UUID → string
        position_response_data  = {
            "id": str(position.id),
            "user_id": str(position.user_id),
            "symbol": position.symbol,
            "side": position.side,
            "entry_price": position.entry_price,
            "quantity": position.quantity,
            "leverage": position.leverage,
            "margin": position.margin,
            "unrealized_pnl": position.unrealized_pnl,
            "realized_pnl": position.realized_pnl,
            "liquidation_price": position.liquidation_price,
            "stop_loss": position.stop_loss,
            "take_profit": position.take_profit,
            "status": position.status,
            "opened_at": position.opened_at,
            "closed_at": position.closed_at,
            "updated_at": position.updated_at
        }
        return FuturesPositionResponse(**position_response_data)  # type: ignore
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error opening futures position: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/positions", response_model=FuturesPositionListResponse)
async def get_futures_positions(
    symbol: str = Query(None, description="Lọc theo cặp giao dịch"),
    status_filter: str = Query("open", description="Lọc theo status: open, closed"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lấy danh sách vị thế futures
    
    - **symbol**: Lọc theo cặp giao dịch (tùy chọn)
    - **status_filter**: open, closed (mặc định: open)
    """
    try:
        user_id = current_user.id
        logger.info(f"📋 Fetching futures positions for user {user_id}")
        
        # Positions table chỉ chứa futures positions
        query = db.query(Position).filter(Position.user_id == user_id)
        
        if symbol:
            query = query.filter(Position.symbol == symbol)
        
        # Chuẩn hóa status filter
        status_upper = status_filter.upper() if status_filter else 'OPEN'
        query = query.filter(Position.status == status_upper)
        
        # Đếm tổng số lượng trước khi phân trang
        total_count = query.count()
        
        query = query.order_by(desc(Position.opened_at)).offset(offset).limit(limit)
        
        positions = query.all()
        
        # Tính tổng unrealized PnL
        total_unrealized_pnl = sum((Decimal(str(p.unrealized_pnl or 0)) for p in positions), start=Decimal("0")) if positions else Decimal("0")
        
        # Convert positions, UUID → string
        position_responses = []
        for p in positions:
            pos_data = {
                "id": str(p.id),
                "user_id": str(p.user_id),
                "symbol": p.symbol,
                "side": p.side,
                "entry_price": p.entry_price,
                "quantity": p.quantity,
                "leverage": p.leverage,
                "margin": p.margin,
                "unrealized_pnl": p.unrealized_pnl,
                "realized_pnl": p.realized_pnl,
                "liquidation_price": p.liquidation_price,
                "stop_loss": p.stop_loss,
                "take_profit": p.take_profit,
                "status": p.status,
                "opened_at": p.opened_at,
                "closed_at": p.closed_at,
                "updated_at": p.updated_at
            }
            position_responses.append(FuturesPositionResponse(**pos_data))  # type: ignore
        
        return FuturesPositionListResponse(
            positions=position_responses,
            total_count=total_count,
            total_unrealized_pnl=total_unrealized_pnl
        )
        
    except Exception as e:
        logger.error(f"❌ Error fetching positions: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/positions/{position_id}/close", response_model=ClosePositionResponse)
async def close_futures_position(
    position_id: str,
    close_data: ClosePositionRequest,
    current_user: User = Depends(check_user_not_banned),
    db: Session = Depends(get_db)
):
    """
    Đóng vị thế futures
    
    - **position_id**: ID của vị thế
    - **exit_price**: Giá bán/đóng
    - **quantity**: Lượng cần đóng (null = đóng hết)
    """
    try:
        user_id = current_user.id
        logger.info(f"📉 Closing futures position: {position_id} for user {user_id}")
        
        # Lấy position
        position = db.query(Position).filter(
            and_(
                Position.id == position_id,
                Position.user_id == user_id
            )
        ).first()
        
        if not position:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vị thế không tồn tại"
            )
        
        if str(position.status).upper() != "OPEN":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Vị thế không ở trạng thái mở"
            )
        
        # Tính PnL
        pos_qty = Decimal(str(position.quantity))
        quantity_to_close = close_data.quantity if close_data.quantity else pos_qty
        pnl_per_contract = Decimal(0)
        
        pos_side = str(position.side)
        pos_entry = Decimal(str(position.entry_price))
        pos_leverage = Decimal(str(position.leverage))
        pos_collateral = Decimal(str(position.margin))  # Dùng margin thay vì collateral
        
        if pos_side == "LONG":
            pnl_per_contract = close_data.exit_price - pos_entry
        else:  # SHORT
            pnl_per_contract = pos_entry - close_data.exit_price
        
        realized_pnl = pnl_per_contract * quantity_to_close * pos_leverage
        pnl_percentage = (pnl_per_contract / pos_entry * Decimal(100)) if pos_entry > 0 else Decimal(0)
        
        # Tính fees (0.1% opening + 0.1% closing)
        opening_fee = pos_collateral * Decimal("0.001")
        closing_fee = pos_collateral * Decimal("0.001")
        total_funding_paid = Decimal(0)  # Có thể tính từ price_alerts nếu cần
        total_fees = opening_fee + closing_fee + total_funding_paid
        
        # Futures không cần tạo trade record - đã tracked trong positions table
        # Trade record chỉ dùng cho spot trading
        
        # Update position
        if close_data.quantity and close_data.quantity < pos_qty:
            # Partial close
            new_qty = pos_qty - quantity_to_close
            db.execute(
                Position.__table__.update()
                .where(Position.id == position.id)
                .values(quantity=new_qty, realized_pnl=realized_pnl)
            )
        else:
            # Đóng hết
            db.execute(
                Position.__table__.update()
                .where(Position.id == position.id)
                .values(status="CLOSED", closed_at=get_vietnam_now(), realized_pnl=realized_pnl)
            )
        
        # Hoàn lại ký quỹ + PnL
        wallet = db.query(Wallet).filter(
            and_(Wallet.user_id == user_id, Wallet.currency == "USDT")
        ).first()
        
        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy ví USDT"
            )
        
        return_amount = pos_collateral + realized_pnl - total_fees
        new_wallet_balance = Decimal(str(wallet.balance)) + return_amount
        db.execute(
            Wallet.__table__.update()
            .where(Wallet.id == wallet.id)
            .values(balance=new_wallet_balance)
        )
        
        # Ghi transaction
        transaction = Transaction(
            id=uuid4(),
            user_id=user_id,
            wallet_id=wallet.id,
            type="futures_pnl",
            currency="USDT",
            amount=realized_pnl - total_fees,
            balance_after=new_wallet_balance,
            created_at=get_vietnam_now()
        )
        db.add(transaction)
        
        db.commit()
        
        logger.info(f"✅ Position closed: realized_pnl={realized_pnl}")
        
        # Prepare wallet_updates for frontend (sử dụng balance từ database)
        wallet_updates = {
            "USDT": {
                "balance": new_wallet_balance,
                "available": new_wallet_balance,
                "locked": Decimal("0")
            }
        }
        
        return ClosePositionResponse(
            position_id=position_id,
            realized_pnl=realized_pnl,
            pnl_percentage=pnl_percentage,
            total_fees=total_fees,
            wallet_updates=wallet_updates,
            message=f"Vị thế đóng thành công. Lợi nhuận: {realized_pnl} USDT"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error closing position: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============= UPDATE TP/SL =============

@router.post("/positions/{position_id}/update-tpsl", response_model=FuturesPositionResponse)
async def update_position_tpsl(
    position_id: str,
    tpsl_data: UpdateTPSLRequest,
    current_user: User = Depends(check_user_not_banned),
    db: Session = Depends(get_db)
):
    """
    Cập nhật Take Profit và Stop Loss cho vị thế Futures
    
    - **position_id**: ID của vị thế
    - **take_profit_price**: Giá Take Profit (null để xóa)
    - **stop_loss_price**: Giá Stop Loss (null để xóa)
    """
    try:
        user_id = current_user.id
        logger.info(f"📝 Updating TP/SL for position: {position_id}")
        
        # Lấy position
        position = db.query(Position).filter(
            and_(
                Position.id == position_id,
                Position.user_id == user_id
            )
        ).first()
        
        if not position:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Vị thế không tồn tại"
            )
        
        if str(position.status).upper() != "OPEN":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể cập nhật TP/SL cho vị thế đã {position.status}"
            )
        
        pos_side = str(position.side).upper()
        pos_entry = Decimal(str(position.entry_price))
        pos_liq = Decimal(str(position.liquidation_price)) if position.liquidation_price is not None else None
        
        # Validate TP/SL based on position side
        if tpsl_data.take_profit_price:
            tp_price = Decimal(str(tpsl_data.take_profit_price))
            if pos_side == "LONG":
                if tp_price <= pos_entry:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Take Profit phải cao hơn giá vào ({pos_entry}) cho LONG"
                    )
            else:  # SHORT
                if tp_price >= pos_entry:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Take Profit phải thấp hơn giá vào ({pos_entry}) cho SHORT"
                    )
        
        if tpsl_data.stop_loss_price:
            sl_price = Decimal(str(tpsl_data.stop_loss_price))
            
            # Validate SL vs liquidation price
            if pos_liq:
                if pos_side == "LONG" and sl_price <= pos_liq:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Stop Loss phải cao hơn giá thanh lý ({pos_liq})"
                    )
                elif pos_side == "SHORT" and sl_price >= pos_liq:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Stop Loss phải thấp hơn giá thanh lý ({pos_liq})"
                    )
            
            # Validate SL vs entry price
            if pos_side == "LONG":
                if sl_price >= pos_entry:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Stop Loss phải thấp hơn giá vào ({pos_entry}) cho LONG"
                    )
            else:  # SHORT
                if sl_price <= pos_entry:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Stop Loss phải cao hơn giá vào ({pos_entry}) cho SHORT"
                    )
        
        # Update TP/SL
        update_values: dict = {"updated_at": get_vietnam_now()}
        
        if tpsl_data.take_profit_price is not None:
            update_values["take_profit"] = tpsl_data.take_profit_price
            logger.info(f"✅ Updated TP: {tpsl_data.take_profit_price}")
        
        if tpsl_data.stop_loss_price is not None:
            update_values["stop_loss"] = tpsl_data.stop_loss_price
            logger.info(f"✅ Updated SL: {tpsl_data.stop_loss_price}")
        
        db.execute(
            Position.__table__.update()
            .where(Position.id == position.id)
            .values(**update_values)
        )
        
        db.commit()
        db.refresh(position)
        
        logger.info(f"✅ TP/SL updated for position: {position_id}")
        
        # Return updated position
        response_data = {
            "id": str(position.id),
            "user_id": str(position.user_id),
            "symbol": position.symbol,
            "side": position.side,
            "entry_price": position.entry_price,
            "quantity": position.quantity,
            "leverage": position.leverage,
            "margin": position.margin,
            "unrealized_pnl": position.unrealized_pnl,
            "realized_pnl": position.realized_pnl,
            "liquidation_price": position.liquidation_price,
            "stop_loss": position.stop_loss,
            "take_profit": position.take_profit,
            "status": position.status,
            "opened_at": position.opened_at,
            "closed_at": position.closed_at,
            "updated_at": position.updated_at
        }
        return FuturesPositionResponse(**response_data)  # type: ignore
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error updating TP/SL: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============= FUTURES ORDERS =============

@router.post("/orders", response_model=FuturesOrderResponse)
async def create_futures_order(
    order_data: FuturesOrderCreate,
    current_user: User = Depends(check_user_not_banned),
    db: Session = Depends(get_db)
):
    """
    Tạo lệnh futures (limit hoặc market)
    
    - **symbol**: Cặp giao dịch
    - **side**: BUY (LONG) hoặc SELL (SHORT)
    - **order_type**: MARKET hoặc LIMIT
    - **quantity**: Số lượng hợp đồng
    - **price**: Giá (null cho MARKET orders)
    - **leverage**: Leverage (1x-100x)
    """
    try:
        user_id = current_user.id
        logger.info(f"📊 Creating futures order: {order_data.symbol} {order_data.side}")
        
        # Kiểm tra ký quỹ cần thiết
        wallet = db.query(Wallet).filter(
            and_(Wallet.user_id == user_id, Wallet.currency == "USDT")
        ).first()
        
        if wallet is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không có ví USDT"
            )
        
        # Tính margin yêu cầu
        position_value = order_data.quantity * (order_data.price or Decimal(100))
        margin_required = position_value / order_data.leverage
        
        logger.info(f"💰 Margin required: {margin_required} USDT (position_value={position_value}, leverage={order_data.leverage})")
        
        wallet_balance = Decimal(str(wallet.balance))
        if wallet_balance < margin_required:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Ký quỹ không đủ. Cần: {margin_required} USDT, Có: {wallet_balance} USDT"
            )
        
        # TRỪ margin từ ví ngay khi tạo lệnh
        new_balance = wallet_balance - margin_required
        db.execute(
            Wallet.__table__.update().where(Wallet.id == wallet.id).values(balance=new_balance)
        )
        
        logger.info(f"💸 Deducted margin: {wallet_balance} → {new_balance} USDT")
        
        # Ghi transaction log
        transaction = Transaction(
            id=uuid4(),
            user_id=user_id,
            wallet_id=wallet.id,
            type="futures_order_margin_lock",
            currency="USDT",
            amount=-margin_required,
            balance_after=new_balance,
            created_at=get_vietnam_now()
        )
        db.add(transaction)
        
        # Tạo order
        order = Order(
            id=uuid4(),
            user_id=user_id,
            symbol=order_data.symbol,
            side=order_data.side,
            order_type=order_data.order_type,
            market_type='futures',  # ← QUAN TRỌNG: Đánh dấu là Futures
            quantity=order_data.quantity,
            price=order_data.price,
            leverage=order_data.leverage,
            status='pending',
            created_at=get_vietnam_now()
        )
        
        db.add(order)
        db.commit()
        db.refresh(order)  # Refresh để lấy dữ liệu mới nhất
        
        logger.info(f"✅ Futures order created: {order.id}")
        
        # Refresh wallet để lấy balance mới
        db.refresh(wallet)
        
        # Convert sang dict, sau đó convert UUID thành string
        response_data = {
            "id": str(order.id),
            "user_id": str(order.user_id),
            "symbol": order.symbol,
            "side": order.side,
            "order_type": order.order_type,
            "market_type": order.market_type,
            "quantity": order.quantity,
            "price": order.price,
            "leverage": order.leverage,
            "status": order.status,
            "filled_quantity": order.filled_quantity,
            "created_at": order.created_at,
            "updated_at": order.updated_at,
            "filled_at": order.filled_at,
            "margin_required": margin_required,
            "wallet_updates": {
                "USDT": {
                    "balance": float(new_balance)
                }
            }
        }
        return FuturesOrderResponse(**response_data)  # type: ignore
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error creating futures order: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/orders", response_model=FuturesOrderListResponse)
async def get_futures_orders(
    symbol: str = Query(None),
    status_filter: str = Query(None),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lấy danh sách lệnh futures
    
    - **symbol**: Lọc theo cặp giao dịch (tùy chọn)
    - **status_filter**: Lọc theo trạng thái (tùy chọn)
    - **limit**: Số lượng records (mặc định: 50, max: 100)
    """
    try:
        user_id = current_user.id
        
        # QUAN TRỌNG: Filter theo market_type='futures'
        query = db.query(Order).filter(
            and_(
                Order.user_id == user_id,
                Order.market_type == 'futures'
            )
        )
        
        if symbol:
            query = query.filter(Order.symbol == symbol)
        if status_filter:
            query = query.filter(Order.status == status_filter)
        
        orders = query.order_by(desc(Order.created_at)).limit(limit).all()
        
        logger.info(f"📋 Found {len(orders)} orders for user {user_id}")
        
        # Convert từng order, UUID → string
        order_responses = []
        for o in orders:
            try:
                order_data = {
                    "id": str(o.id),
                    "user_id": str(o.user_id),
                    "symbol": o.symbol,
                    "side": o.side,
                    "order_type": o.order_type,
                    "market_type": o.market_type,
                    "quantity": o.quantity,
                    "price": o.price,
                    "leverage": o.leverage,
                    "status": o.status,
                    "filled_quantity": o.filled_quantity,
                    "created_at": o.created_at,
                    "updated_at": o.updated_at,
                    "filled_at": o.filled_at
                }
                order_responses.append(FuturesOrderResponse(**order_data))  # type: ignore
            except Exception as e:
                logger.error(f"❌ Error serializing order {o.id}: {str(e)}")
                raise
        
        return FuturesOrderListResponse(
            orders=order_responses,
            total_count=len(orders)
        )
        
    except Exception as e:
        logger.error(f"❌ Error fetching futures orders: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============= CANCEL FUTURES ORDER =============

@router.delete("/orders/{order_id}", response_model=FuturesOrderResponse)
async def cancel_futures_order(
    order_id: str,
    current_user: User = Depends(check_user_not_banned),
    db: Session = Depends(get_db)
):
    """
    Hủy lệnh futures
    
    - **order_id**: ID của lệnh cần hủy
    """
    try:
        user_id = current_user.id
        logger.info(f"🚫 Cancelling futures order: {order_id} for user {user_id}")
        
        # Lấy order
        order = db.query(Order).filter(
            and_(
                Order.id == order_id,
                Order.user_id == user_id,
                Order.market_type == 'futures'  # Only allow cancelling futures orders
            )
        ).first()
        
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lệnh không tồn tại"
            )
        
        if str(order.status).lower() != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Không thể hủy lệnh có trạng thái {order.status}"
            )
        
        # Tính margin cần hoàn lại
        position_value = order.quantity * (order.price or Decimal(100))
        margin_to_refund = position_value / order.leverage
        
        logger.info(f"💰 Refunding margin: {margin_to_refund} USDT")
        
        # Lấy ví USDT
        wallet = db.query(Wallet).filter(
            and_(Wallet.user_id == user_id, Wallet.currency == "USDT")
        ).first()
        
        if not wallet:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy ví USDT"
            )
        
        # HOÀN LẠI margin vào ví
        current_balance = Decimal(str(wallet.balance))
        refunded_balance = Decimal(str(current_balance)) + Decimal(str(margin_to_refund))
        
        db.execute(
            Wallet.__table__.update()
            .where(Wallet.id == wallet.id)
            .values(balance=refunded_balance)
        )
        
        logger.info(f"💸 Refunded margin: {current_balance} → {refunded_balance} USDT")
        
        # Ghi transaction log
        transaction = Transaction(
            id=uuid4(),
            user_id=user_id,
            wallet_id=wallet.id,
            type="futures_order_margin_refund",
            currency="USDT",
            amount=margin_to_refund,
            balance_after=refunded_balance,
            created_at=get_vietnam_now()
        )
        db.add(transaction)
        
        # Update order status
        db.execute(
            Order.__table__.update()
            .where(Order.id == order.id)
            .values(status='cancelled', updated_at=get_vietnam_now())
        )
        
        db.commit()
        
        # Refresh to get updated data
        db.refresh(order)
        
        logger.info(f"✅ Futures order cancelled: {order_id}")
        
        # Convert sang dict, sau đó convert UUID thành string
        response_data = {
            "id": str(order.id),
            "user_id": str(order.user_id),
            "symbol": order.symbol,
            "side": order.side,
            "order_type": order.order_type,
            "market_type": order.market_type,
            "quantity": order.quantity,
            "price": order.price,
            "leverage": order.leverage,
            "status": order.status,
            "filled_quantity": order.filled_quantity,
            "created_at": order.created_at,
            "updated_at": order.updated_at,
            "filled_at": order.filled_at,
            "margin_required": margin_to_refund,
            "wallet_updates": {
                "USDT": {
                    "balance": refunded_balance,
                    "available": refunded_balance,
                    "locked": Decimal("0")
                }
            }
        }
        return FuturesOrderResponse(**response_data)  # type: ignore
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error cancelling futures order: {str(e)}")
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============= PnL HISTORY =============

@router.get("/pnl-history", response_model=FuturesPnLListResponse)
async def get_pnl_history(
    symbol: str = Query(None),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lấy lịch sử PnL (lịch sử đóng position)
    
    - **symbol**: Lọc theo cặp giao dịch (tùy chọn)
    - **limit**: Số lượng records
    """
    try:
        user_id = current_user.id
        
        # Lấy lịch sử PnL từ bảng trades (các giao dịch đóng vị thế)
        # Và cả positions đã đóng
        query = db.query(Position).filter(
            and_(
                Position.user_id == user_id,
                Position.status == "CLOSED"
            )
        )
        
        if symbol:
            query = query.filter(Position.symbol == symbol)
        
        closed_positions = query.order_by(desc(Position.closed_at)).limit(limit).all()
        
        # Tính tổng PnL
        total_pnl = sum((Decimal(str(p.realized_pnl or 0)) for p in closed_positions), start=Decimal("0")) if closed_positions else Decimal("0")
        win_count = len([p for p in closed_positions if Decimal(str(p.realized_pnl or 0)) > 0])
        win_rate = (Decimal(win_count) / Decimal(len(closed_positions)) * Decimal(100)) if closed_positions else Decimal("0")
        
        # Chuyển đổi Position thành FuturesPnLResponse
        pnl_responses = []
        for p in closed_positions:
            pnl_responses.append(FuturesPnLResponse(
                id=str(p.id),
                user_id=str(p.user_id),
                symbol=str(p.symbol),
                side=str(p.side),
                entry_price=Decimal(str(p.entry_price)),
                exit_price=Decimal(str(p.entry_price)),  # Cần lưu exit_price riêng nếu cần
                quantity=Decimal(str(p.quantity)),
                leverage=Decimal(str(p.leverage)),
                realized_pnl=Decimal(str(p.realized_pnl or 0)),
                pnl_percentage=Decimal("0"),  # Tính toán
                opening_fee=Decimal("0"),
                closing_fee=Decimal("0"),
                funding_fee=Decimal("0"),
                opened_at=p.opened_at,  # type: ignore
                closed_at=p.closed_at  # type: ignore
            ))
        
        return FuturesPnLListResponse(
            pnl_history=pnl_responses,
            total_count=len(closed_positions),
            total_pnl=total_pnl,
            win_rate=win_rate
        )
        
    except Exception as e:
        logger.error(f"❌ Error fetching PnL history: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============= FUNDING RATES =============

@router.get("/funding-rates", response_model=FundingRateListResponse)
async def get_funding_rates(
    symbols: str = Query(None, description="Cặp giao dịch cách nhau bằng dấu phẩy, VD: BTC/USDT,ETH/USDT"),
    db: Session = Depends(get_db)
):
    """
    Lấy funding rates hiện tại
    
    Funding rate cập nhật mỗi 8 giờ (0h, 8h, 16h UTC)
    - **symbols**: Lọc theo cặp giao dịch (tùy chọn, cách nhau bằng dấu phẩy)
    """
    try:
        # Tạm thời dùng dữ liệu mock cho funding rates
        # Sau này có thể lưu vào market_data_cache hoặc tạo bảng riêng
        symbol_list = [s.strip() for s in symbols.split(",")] if symbols else ["BTC/USDT", "ETH/USDT"]
        
        funding_rates = []
        base_time = get_vietnam_now()
        
        for idx, symbol in enumerate(symbol_list[:20]):  # Giới hạn 20 symbols
            funding_rates.append(FundingRateResponse(
                symbol=symbol,
                funding_rate=Decimal("0.0001"),  # Mock: 0.01% funding rate
                funding_timestamp=base_time - timedelta(hours=idx),
                estimated_fee_8h=Decimal("0.0008")  # 0.01% * 8
            ))
        
        next_funding_time = base_time + timedelta(hours=8)
        
        return FundingRateListResponse(
            funding_rates=funding_rates,
            next_funding_time=next_funding_time  # type: ignore
        )
        
    except Exception as e:
        logger.error(f"❌ Error fetching funding rates: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


# ============= PORTFOLIO SUMMARY =============

@router.get("/portfolio-summary", response_model=FuturesPortfolioSummary)
async def get_portfolio_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lấy tóm tắt portfolio futures
    
    Bao gồm: Tổng ký quỹ, PnL chưa thực hiện, PnL đã thực hiện, etc.
    """
    try:
        user_id = current_user.id
        
        # Lấy positions mở
        open_positions = db.query(Position).filter(
            and_(
                Position.user_id == user_id,
                Position.status == "OPEN"
            )
        ).all()
        
        # Lấy positions đã đóng (PnL history)
        closed_positions = db.query(Position).filter(
            and_(
                Position.user_id == user_id,
                Position.status == "CLOSED"
            )
        ).all()
        
        # Tính tổng
        total_collateral = sum((Decimal(str(p.margin or 0)) for p in open_positions), start=Decimal("0")) if open_positions else Decimal("0")
        total_unrealized_pnl = sum((Decimal(str(p.unrealized_pnl or 0)) for p in open_positions), start=Decimal("0")) if open_positions else Decimal("0")
        total_realized_pnl = sum((Decimal(str(p.realized_pnl or 0)) for p in closed_positions), start=Decimal("0")) if closed_positions else Decimal("0")
        total_fees_paid = Decimal("0")  # Có thể tính từ trades
        
        # Lấy wallet
        wallet = db.query(Wallet).filter(
            and_(Wallet.user_id == user_id, Wallet.currency == "USDT")
        ).first()
        
        available_balance = Decimal(str(wallet.balance)) if wallet else Decimal("0")
        
        # Tính win rate
        win_count = len([p for p in closed_positions if Decimal(str(p.realized_pnl or 0)) > 0])
        win_rate = (Decimal(win_count) / Decimal(len(closed_positions)) * Decimal(100)) if closed_positions else Decimal("0")
        
        # Best/worst trades
        best_trade = max((Decimal(str(p.realized_pnl or 0)) for p in closed_positions), default=Decimal("0"))
        worst_trade = min((Decimal(str(p.realized_pnl or 0)) for p in closed_positions), default=Decimal("0"))
        
        return FuturesPortfolioSummary(
            total_collateral=total_collateral,
            total_unrealized_pnl=total_unrealized_pnl,
            total_realized_pnl=total_realized_pnl,
            total_fees_paid=total_fees_paid,
            available_balance=available_balance,
            max_leverage_available=Decimal(100),  # Mặc định 100x
            open_positions_count=len(open_positions),
            closed_positions_count=len(closed_positions),
            win_rate=win_rate,
            best_trade_pnl=best_trade,
            worst_trade_pnl=worst_trade
        )
        
    except Exception as e:
        logger.error(f"❌ Error fetching portfolio summary: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
