from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from decimal import Decimal
from typing import Optional
from uuid import UUID
from datetime import datetime
from src.config.database import get_db
from src.schemas.order import OrderCreate, OrderResponse, TradeResponse, FillTradeRequest, FillTradeResponse
from src.models.order import Order, Trade
from src.models.wallet import Wallet, Transaction
from src.utils.dependencies import get_current_user, check_user_not_banned
from src.utils.timezone import get_vietnam_now
import uuid as uuid_module

router = APIRouter()

# ============= CREATE ORDER =============
@router.post("/orders", response_model=OrderResponse)
async def create_order(
    order_data: OrderCreate,
    db: Session = Depends(get_db),
    current_user = Depends(check_user_not_banned)
):
    """
    Tạo đơn hàng mới
    
    - **symbol**: Ký hiệu giao dịch (VD: BTCUSDT)
    - **side**: BUY hoặc SELL
    - **order_type**: LIMIT hoặc MARKET
    - **price**: Giá
    - **quantity**: Số lượng
    
    Logic:
    1. Kiểm tra input hợp lệ
    2. Kiểm tra số dư wallet (BUY: usdt, SELL: coin)
    3. Khóa số dư tương ứng
    4. Tạo order record
    5. Trả về order với thông tin wallet cập nhật
    """
    
    user_id = current_user.id
    
    # Validate input
    if order_data.side.upper() not in ["BUY", "SELL"]:
        raise HTTPException(status_code=400, detail="side must be BUY or SELL")
    
    if order_data.order_type.upper() not in ["MARKET", "LIMIT"]:
        raise HTTPException(status_code=400, detail="order_type must be MARKET or LIMIT")
    
    if order_data.quantity <= 0 or order_data.price <= 0:
        raise HTTPException(status_code=400, detail="quantity and price must be > 0")
    
    side = order_data.side.upper()
    order_type = order_data.order_type.upper()
    symbol = order_data.symbol.upper()
    
    # Lấy currency từ symbol (ví dụ: BTCUSDT -> BTC và USDT)
    # Giả sử format: COINUSDT
    if not symbol.endswith("USDT"):
        raise HTTPException(status_code=400, detail="Only USDT pairs supported (format: COINUSDT)")
    
    coin_currency = symbol.replace("USDT", "")
    quote_currency = "USDT"
    
    # Biến để track wallet được sử dụng (để trả về trong response)
    affected_wallet = None
    
    # Kiểm tra số dư
    if side == "BUY":
        # Cần USDT để mua
        amount_needed = order_data.quantity * order_data.price
        usdt_wallet = db.query(Wallet).filter(
            and_(
                Wallet.user_id == user_id,
                Wallet.currency == quote_currency
            )
        ).first()
        
        if not usdt_wallet:
            raise HTTPException(status_code=400, detail=f"No {quote_currency} wallet found")
        
        if usdt_wallet.balance < amount_needed:  # type: ignore
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient {quote_currency} balance. Need: {amount_needed}, Available: {usdt_wallet.balance}"
            )
        
        # Trừ USDT ngay
        usdt_wallet.balance -= amount_needed  # type: ignore
        affected_wallet = usdt_wallet
        
        # THÊM: Cộng coin mua được (tính theo pending order)
        coin_wallet = db.query(Wallet).filter(
            and_(
                Wallet.user_id == user_id,
                Wallet.currency == coin_currency
            )
        ).first()
        
        if coin_wallet:
            # Wallet đã tồn tại, cộng balance
            coin_wallet.balance += order_data.quantity  # type: ignore
        else:
            # Wallet chưa tồn tại, tạo mới
            coin_wallet = Wallet(
                id=uuid_module.uuid4(),
                user_id=user_id,
                currency=coin_currency,
                balance=order_data.quantity,
                wallet_type="spot"
            )
            db.add(coin_wallet)
    
    else:  # SELL
        # Cần coin để bán
        coin_wallet = db.query(Wallet).filter(
            and_(
                Wallet.user_id == user_id,
                Wallet.currency == coin_currency
            )
        ).first()
        
        if not coin_wallet:
            raise HTTPException(status_code=400, detail=f"No {coin_currency} wallet found")
        
        if coin_wallet.balance < order_data.quantity:  # type: ignore
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient {coin_currency} balance. Need: {order_data.quantity}, Available: {coin_wallet.balance}"
            )
        
        # Trừ coin ngay
        coin_wallet.balance -= order_data.quantity  # type: ignore
        affected_wallet = coin_wallet
        
        # THÊM: Cộng USDT nhận được (tính theo pending order, không phải fill)
        usdt_wallet = db.query(Wallet).filter(
            and_(
                Wallet.user_id == user_id,
                Wallet.currency == quote_currency
            )
        ).first()
        
        if usdt_wallet:
            # Tính USDT nhận được = quantity × price × (1 - fee%)
            fee_rate = Decimal("0.001")
            usdt_received = order_data.quantity * order_data.price * (Decimal("1") - fee_rate)
            usdt_wallet.balance += usdt_received  # type: ignore
        else:
            # Nếu USDT wallet chưa tồn tại (unlikely), tạo mới
            fee_rate = Decimal("0.001")
            usdt_received = order_data.quantity * order_data.price * (Decimal("1") - fee_rate)
            usdt_wallet = Wallet(
                id=uuid_module.uuid4(),
                user_id=user_id,
                currency=quote_currency,
                balance=usdt_received,
                wallet_type="spot"
            )
            db.add(usdt_wallet)
    
    # ✅ VALIDATE PHÍ TỪ FRONTEND
    total_amount = order_data.quantity * order_data.price
    fee_rate = Decimal("0.001")  # 0.1% cho spot trading
    expected_fee = total_amount * fee_rate
    
    # Nhận phí từ frontend
    received_fee = order_data.fee if order_data.fee else Decimal("0")
    
    # Validate phí (chấp nhận sai số 0.01 USDT do floating point)
    if abs(received_fee - expected_fee) > Decimal("0.01"):
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Invalid trading fee calculation",
                "expected": float(expected_fee),
                "received": float(received_fee),
                "difference": float(abs(received_fee - expected_fee)),
                "total_amount": float(total_amount),
                "fee_rate": "0.1%"
            }
        )
    
    # Dùng expected_fee để chắc chắn (sau khi validate)
    trading_fee = expected_fee
    
    # Tạo order
    new_order = Order(
        id=uuid_module.uuid4(),
        user_id=user_id,
        symbol=symbol,
        side=side,
        order_type=order_type,
        market_type='spot',  # Set market_type for spot orders
        price=order_data.price,
        quantity=order_data.quantity,
        filled_quantity=Decimal("0"),
        status="pending"
    )
    
    db.add(new_order)
    db.flush()  # Flush để có order.id, nhưng chưa commit
    
    # ✅ TẠO TRADE RECORD VỚI PHÍ ĐÃ VALIDATE (luôn tạo, MARKET hay LIMIT đều có)
    trade = Trade(
        id=uuid_module.uuid4(),
        user_id=user_id,
        order_id=new_order.id,
        symbol=symbol,
        side=side,
        price=order_data.price,
        quantity=order_data.quantity,
        commission=trading_fee,  # ✅ LƯU PHÍ ĐÃ VALIDATE
        created_at=get_vietnam_now()
    )
    db.add(trade)
    
    # ✅ AUTO-FILL nếu là MARKET ORDER (set status=filled, không gọi /fill-trade)
    if order_type == "MARKET":
        new_order.status = "filled"  # type: ignore
        new_order.filled_quantity = order_data.quantity  # type: ignore
        new_order.filled_at = get_vietnam_now()  # type: ignore
    
    # Log transaction - pending order
    if side == "BUY":
        amount_needed = order_data.quantity * order_data.price
        # Log USDT trừ đi
        transaction_buy_usdt = Transaction(
            id=uuid_module.uuid4(),
            user_id=user_id,
            wallet_id=usdt_wallet.id,  # type: ignore
            type="pending_buy",
            currency=quote_currency,
            amount=amount_needed,
            fee=trading_fee,  # ✅ GHI NHẬN PHÍ
            balance_after=usdt_wallet.balance,  # type: ignore
            created_at=get_vietnam_now()
        )
        db.add(transaction_buy_usdt)
        
        # ✅ LOG PHÍ RIÊNG VÀO WALLET_TRANSACTIONS
        transaction_fee = Transaction(
            id=uuid_module.uuid4(),
            user_id=user_id,
            wallet_id=usdt_wallet.id,  # type: ignore
            type="trading_fee",
            currency=quote_currency,
            amount=-trading_fee,  # Âm = trừ tiền
            fee=trading_fee,
            balance_after=usdt_wallet.balance - trading_fee,  # type: ignore
            created_at=get_vietnam_now()
        )
        db.add(transaction_fee)
        
        # Log coin cộng vào (nếu có coin_wallet)
        if coin_wallet:
            transaction_buy_coin = Transaction(
                id=uuid_module.uuid4(),
                user_id=user_id,
                wallet_id=coin_wallet.id,
                type="pending_buy_received",
                currency=coin_currency,
                amount=order_data.quantity,
                fee=Decimal("0"),
                balance_after=coin_wallet.balance,  # type: ignore
                created_at=get_vietnam_now()
            )
            db.add(transaction_buy_coin)
        
        transaction = transaction_buy_usdt
    else:  # SELL
        # Log coin trừ đi
        transaction_sell_coin = Transaction(
            id=uuid_module.uuid4(),
            user_id=user_id,
            wallet_id=coin_wallet.id,  # type: ignore
            type="pending_sell",
            currency=coin_currency,
            amount=order_data.quantity,
            fee=Decimal("0"),
            balance_after=coin_wallet.balance,  # type: ignore
            created_at=get_vietnam_now()
        )
        db.add(transaction_sell_coin)
        
        # Log USDT cộng vào (nếu có usdt_wallet)
        if usdt_wallet:
            fee_rate = Decimal("0.001")
            usdt_received = order_data.quantity * order_data.price * (Decimal("1") - fee_rate)
            transaction_sell_usdt = Transaction(
                id=uuid_module.uuid4(),
                user_id=user_id,
                wallet_id=usdt_wallet.id,
                type="pending_sell_received",
                currency=quote_currency,
                amount=usdt_received,
                fee=trading_fee,  # ✅ GHI NHẬN PHÍ ĐÃ VALIDATE
                balance_after=usdt_wallet.balance,  # type: ignore
                created_at=get_vietnam_now()
            )
            db.add(transaction_sell_usdt)
        
        # ✅ LOG PHÍ RIÊNG VÀO WALLET_TRANSACTIONS
        transaction_fee_sell = Transaction(
            id=uuid_module.uuid4(),
            user_id=user_id,
            wallet_id=usdt_wallet.id,  # type: ignore
            type="trading_fee",
            currency=quote_currency,
            amount=-trading_fee,  # Âm = trừ tiền
            fee=trading_fee,
            balance_after=usdt_wallet.balance - trading_fee,  # type: ignore
            created_at=get_vietnam_now()
        )
        db.add(transaction_fee_sell)
        
        transaction = transaction_sell_coin
    
    db.commit()
    
    # Build response with wallet updates (chỉ coin + USDT của order này)
    response = OrderResponse.from_orm(new_order)
    response.fee = trading_fee  # ✅ THÊM PHÍ VÀO RESPONSE
    
    wallet_updates = {}
    
    # Lấy coin wallet
    coin_wallet = db.query(Wallet).filter(
        and_(
            Wallet.user_id == user_id,
            Wallet.currency == coin_currency
        )
    ).first()
    
    # Lấy USDT wallet
    usdt_wallet = db.query(Wallet).filter(
        and_(
            Wallet.user_id == user_id,
            Wallet.currency == quote_currency
        )
    ).first()
    
    # Trả về coin + USDT của order này
    if coin_wallet:
        wallet_updates[coin_currency] = {
            "balance": float(coin_wallet.balance),  # type: ignore
            "available_balance": float(coin_wallet.balance)  # type: ignore
        }
    
    if usdt_wallet:
        wallet_updates["USDT"] = {
            "balance": float(usdt_wallet.balance),  # type: ignore
            "available_balance": float(usdt_wallet.balance)  # type: ignore
        }
    
    response.wallet_updates = wallet_updates
    
    return response


# ============= GET SINGLE ORDER =============
@router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Lấy thông tin đơn hàng"""
    try:
        order_uuid = UUID(order_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid order_id format")
    
    order = db.query(Order).filter(
        and_(
            Order.id == order_uuid,
            Order.user_id == current_user.id,
            Order.market_type == 'spot'  # Only allow spot orders
        )
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    return OrderResponse.from_orm(order)


# ============= LIST ORDERS =============
@router.get("/orders", response_model=list[OrderResponse])
async def list_orders(
    symbol: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Lấy danh sách đơn hàng
    
    - **symbol**: Lọc theo ký hiệu (tùy chọn)
    - **status**: Lọc theo trạng thái (tùy chọn): pending, filled, cancelled, partial
    """
    query = db.query(Order).filter(
        and_(
            Order.user_id == current_user.id,
            Order.market_type == 'spot'  # Only show spot orders
        )
    )
    
    if symbol:
        query = query.filter(Order.symbol == symbol.upper())
    
    if status:
        query = query.filter(Order.status == status.lower())
    
    orders = query.order_by(Order.created_at.desc()).all()
    return [OrderResponse.from_orm(order) for order in orders]


# ============= CANCEL ORDER =============
@router.delete("/orders/{order_id}", response_model=OrderResponse)
async def cancel_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(check_user_not_banned)
):
    """Hủy đơn hàng - mở khóa số dư và trả về wallet cập nhật"""
    try:
        order_uuid = UUID(order_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid order_id format")
    
    order = db.query(Order).filter(
        and_(
            Order.id == order_uuid,
            Order.user_id == current_user.id,
            Order.market_type == 'spot'  # Only allow cancelling spot orders
        )
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Chỉ có thể hủy order pending
    if order.status != "pending":  # type: ignore
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot cancel order with status {order.status}"
        )
    
    # Mở khóa số dư
    symbol = order.symbol
    if not symbol.endswith("USDT"):  # type: ignore
        raise HTTPException(status_code=400, detail="Invalid symbol format")
    
    coin_currency = symbol.replace("USDT", "")
    quote_currency = "USDT"
    affected_wallet = None
    
    if order.side == "BUY":  # type: ignore
        # Cộng lại USDT (hoàn lại)
        amount = order.quantity * order.price
        usdt_wallet = db.query(Wallet).filter(
            and_(
                Wallet.user_id == current_user.id,
                Wallet.currency == quote_currency
            )
        ).first()
        
        if usdt_wallet:
            usdt_wallet.balance += amount  # type: ignore
            affected_wallet = usdt_wallet
            
            # Log transaction - cancel
            transaction = Transaction(
                id=uuid_module.uuid4(),
                user_id=current_user.id,
                wallet_id=usdt_wallet.id,
                type="cancel_buy",
                currency=quote_currency,
                amount=amount,
                fee=Decimal("0"),
                balance_after=usdt_wallet.balance,  # type: ignore
                created_at=get_vietnam_now()
            )
            db.add(transaction)
    
    else:  # SELL
        # Cộng lại coin (hoàn lại)
        coin_wallet = db.query(Wallet).filter(
            and_(
                Wallet.user_id == current_user.id,
                Wallet.currency == coin_currency
            )
        ).first()
        
        if coin_wallet:
            coin_wallet.balance += order.quantity  # type: ignore
            affected_wallet = coin_wallet
            
            # Log transaction - cancel
            transaction = Transaction(
                id=uuid_module.uuid4(),
                user_id=current_user.id,
                wallet_id=coin_wallet.id,
                type="cancel_sell",
                currency=coin_currency,
                amount=order.quantity,
                fee=Decimal("0"),
                balance_after=coin_wallet.balance,  # type: ignore
                created_at=get_vietnam_now()
            )
            db.add(transaction)
    
    # Update order status
    order.status = "cancelled"  # type: ignore
    db.commit()
    db.refresh(order)
    
    # Build response with wallet updates (chỉ coin + USDT của order này)
    response = OrderResponse.from_orm(order)
    
    wallet_updates = {}
    
    # Lấy coin wallet
    coin_wallet = db.query(Wallet).filter(
        and_(
            Wallet.user_id == current_user.id,
            Wallet.currency == coin_currency
        )
    ).first()
    
    # Lấy USDT wallet
    usdt_wallet = db.query(Wallet).filter(
        and_(
            Wallet.user_id == current_user.id,
            Wallet.currency == quote_currency
        )
    ).first()
    
    # Trả về coin + USDT của order này
    if coin_wallet:
        wallet_updates[coin_currency] = {
            "balance": float(coin_wallet.balance),  # type: ignore
            "available_balance": float(coin_wallet.balance)  # type: ignore
        }
    
    if usdt_wallet:
        wallet_updates["USDT"] = {
            "balance": float(usdt_wallet.balance),  # type: ignore
            "available_balance": float(usdt_wallet.balance)  # type: ignore
        }
    
    response.wallet_updates = wallet_updates
    
    return response


# ============= LIST TRADES =============
@router.get("/trades", response_model=list[TradeResponse])
async def list_trades(
    symbol: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Lấy danh sách giao dịch
    
    - **symbol**: Lọc theo ký hiệu (tùy chọn)
    """
    query = db.query(Trade).filter(Trade.user_id == current_user.id)
    
    if symbol:
        query = query.filter(Trade.symbol == symbol.upper())
    
    trades = query.order_by(Trade.created_at.desc()).all()
    return [TradeResponse.from_orm(trade) for trade in trades]


# ============= GET SINGLE TRADE =============
@router.get("/trades/{trade_id}", response_model=TradeResponse)
async def get_trade(
    trade_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Lấy thông tin giao dịch"""
    try:
        trade_uuid = UUID(trade_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid trade_id format")
    
    trade = db.query(Trade).filter(
        and_(
            Trade.id == trade_uuid,
            Trade.user_id == current_user.id
        )
    ).first()
    
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    return TradeResponse.from_orm(trade)


# ============= GET POSITIONS =============
@router.get("/positions")
async def get_positions(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Lấy danh sách vị thế đang mở (cho margin/futures)
    
    Tính toán dựa trên orders chưa filled + trades
    """
    # Lấy các order chưa filled
    pending_orders = db.query(Order).filter(
        and_(
            Order.user_id == current_user.id,
            Order.status == "pending"
        )
    ).all()
    
    # Tính position theo symbol
    positions = {}
    
    for order in pending_orders:
        symbol = order.symbol
        if symbol not in positions:
            positions[symbol] = {
                "symbol": symbol,
                "side": order.side,
                "quantity": Decimal("0"),
                "avg_price": Decimal("0"),
                "total_value": Decimal("0"),
                "orders_count": 0
            }
        
        pos = positions[symbol]
        pos["orders_count"] += 1
        
        if order.side == pos.get("side"):
            # Cộng vào position
            pos["total_value"] += order.quantity * order.price
            pos["quantity"] += order.quantity
        else:
            # Trừ vào position (opposite side)
            pos["quantity"] -= order.quantity
    
    # Tính average price
    for symbol in positions:
        if positions[symbol]["quantity"] != 0:
            positions[symbol]["avg_price"] = positions[symbol]["total_value"] / positions[symbol]["quantity"]
    
    return {
        "positions": list(positions.values()),
        "total_positions": len(positions)
    }


# ============= FILL TRADE =============
@router.post("/fill-trade", response_model=FillTradeResponse)
async def fill_trade(
    fill_data: FillTradeRequest,
    db: Session = Depends(get_db),
    current_user = Depends(check_user_not_banned)
):
    """
    Fill (match) trade - cập nhật khi order được match
    
    - **order_id**: Order ID cần fill
    - **price**: Giá trung bình match
    - **quantity**: Số lượng fill (có thể partial)
    - **commission**: Commission/phí giao dịch
    
    Logic:
    1. Kiểm tra order tồn tại và pending
    2. Tạo trade record
    3. Cập nhật filled_quantity trên order
    4. Unlock tiền khóa từ order
    5. Cập nhật balance (BUY nhận coin, SELL nhận USDT)
    6. Log transactions
    7. Trả về wallet_updates và transaction logs
    """
    
    # Validate
    if fill_data.quantity <= 0:
        raise HTTPException(status_code=400, detail="quantity must be > 0")
    
    if fill_data.price <= 0:
        raise HTTPException(status_code=400, detail="price must be > 0")
    
    # Lấy order
    order = db.query(Order).filter(
        and_(
            Order.id == fill_data.order_id,
            Order.user_id == current_user.id,
            Order.market_type == 'spot'  # Only allow filling spot orders
        )
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # ✅ Nếu order đã filled (Market Order), không làm gì cả
    if order.status == "filled":  # type: ignore
        existing_trade = db.query(Trade).filter(Trade.order_id == order.id).first()
        return FillTradeResponse(
            message="Order already filled (market order)",
            trade_id=existing_trade.id if existing_trade else order.id,  # type: ignore
            order_id=order.id,  # type: ignore
            status="filled",
            quantity=order.quantity,  # type: ignore
            price=order.price,  # type: ignore
            commission=fill_data.commission,
            wallet_updates={},
            transaction_logs=[]
        )
    
    if order.status != "pending":  # type: ignore
        raise HTTPException(status_code=400, detail=f"Order status is {order.status}, cannot fill")
    
    # Check quantity
    fillable = order.quantity - order.filled_quantity  # type: ignore
    if fill_data.quantity > fillable:  # type: ignore
        raise HTTPException(
            status_code=400,
            detail=f"Cannot fill {fill_data.quantity}, only {fillable} available"
        )
    
    # Parse symbol
    symbol = order.symbol
    if not symbol.endswith("USDT"):  # type: ignore
        raise HTTPException(status_code=400, detail="Invalid symbol format")
    
    coin_currency = symbol.replace("USDT", "")
    quote_currency = "USDT"
    
    # ✅ Kiểm tra xem đã có trade record chưa (từ create_order)
    existing_trade = db.query(Trade).filter(
        Trade.order_id == order.id
    ).first()
    
    if existing_trade:
        # ✅ UPDATE existing trade thay vì tạo mới
        existing_trade.price = fill_data.price  # type: ignore
        existing_trade.quantity = fill_data.quantity  # type: ignore
        existing_trade.commission = fill_data.commission  # type: ignore
        trade = existing_trade
    else:
        # ✅ Chỉ tạo mới nếu chưa có (Limit Order case)
        trade = Trade(
            id=uuid_module.uuid4(),
            user_id=current_user.id,
            order_id=order.id,
            symbol=symbol,
            side=order.side,  # type: ignore
            price=fill_data.price,
            quantity=fill_data.quantity,
            commission=fill_data.commission,
            created_at=get_vietnam_now()
        )
        db.add(trade)
    
    # Update filled_quantity
    order.filled_quantity += fill_data.quantity  # type: ignore
    
    # Update order status
    if order.filled_quantity >= order.quantity:  # type: ignore
        order.status = "filled"  # type: ignore
    else:
        order.status = "partial"  # type: ignore
    
    # Track wallet updates & transactions
    wallet_updates = {}
    transaction_logs = []
    
    # Xử lý balance theo BUY/SELL
    if order.side == "BUY":  # type: ignore
        # BUY: hoàn USDT (nếu partial fill), thêm coin, trừ commission
        amount_locked = order.quantity * order.price  # type: ignore
        filled_cost = fill_data.quantity * fill_data.price
        
        # Get USDT wallet
        usdt_wallet = db.query(Wallet).filter(
            and_(
                Wallet.user_id == current_user.id,
                Wallet.currency == quote_currency
            )
        ).first()
        
        if usdt_wallet:
            # Hoàn lại USDT chưa dùng (nếu partial fill)
            unused = amount_locked - filled_cost
            if unused > Decimal('0'):  # type: ignore
                usdt_wallet.balance += unused  # type: ignore
            
            # Log hoàn lại
            tx_refund = Transaction(
                id=uuid_module.uuid4(),
                user_id=current_user.id,
                wallet_id=usdt_wallet.id,
                type="fill_buy_refund",
                currency=quote_currency,
                amount=unused,
                fee=Decimal("0"),
                balance_after=usdt_wallet.balance,  # type: ignore
                created_at=get_vietnam_now()
            )
            db.add(tx_refund)
            transaction_logs.append({
                "type": "fill_buy_refund",
                "currency": quote_currency,
                "amount": str(unused),
                "balance_after": str(usdt_wallet.balance)
            })
            
            wallet_updates[quote_currency] = {
                "balance": usdt_wallet.balance,  # type: ignore
            }
        
        # Add coin to wallet
        coin_wallet = db.query(Wallet).filter(
            and_(
                Wallet.user_id == current_user.id,
                Wallet.currency == coin_currency
            )
        ).first()
        
        if coin_wallet:
            coin_wallet.balance += fill_data.quantity  # type: ignore
            
            # Log buy (thêm coin)
            tx_buy = Transaction(
                id=uuid_module.uuid4(),
                user_id=current_user.id,
                wallet_id=coin_wallet.id,
                type="fill_buy",
                currency=coin_currency,
                amount=fill_data.quantity,
                fee=fill_data.commission,
                balance_after=coin_wallet.balance,  # type: ignore
                created_at=get_vietnam_now()
            )
            db.add(tx_buy)
            transaction_logs.append({
                "type": "fill_buy",
                "currency": coin_currency,
                "amount": str(fill_data.quantity),
                "fee": str(fill_data.commission),
                "balance_after": str(coin_wallet.balance)
            })
            
            wallet_updates[coin_currency] = {
                "balance": coin_wallet.balance,  # type: ignore
            }
    
    else:  # SELL
        # SELL: hoàn coin (nếu partial), thêm USDT
        # Get coin wallet
        coin_wallet = db.query(Wallet).filter(
            and_(
                Wallet.user_id == current_user.id,
                Wallet.currency == coin_currency
            )
        ).first()
        
        if coin_wallet:
            # Hoàn lại coin chưa bán (nếu partial fill)
            unfilled = order.quantity - fill_data.quantity  # type: ignore
            if unfilled > Decimal('0'):  # type: ignore
                coin_wallet.balance += unfilled  # type: ignore
            
            # Log hoàn lại
            tx_refund = Transaction(
                id=uuid_module.uuid4(),
                user_id=current_user.id,
                wallet_id=coin_wallet.id,
                type="fill_sell_refund",
                currency=coin_currency,
                amount=unfilled,
                fee=Decimal("0"),
                balance_after=coin_wallet.balance,  # type: ignore
                created_at=get_vietnam_now()
            )
            db.add(tx_refund)
            transaction_logs.append({
                "type": "fill_sell_refund",
                "currency": coin_currency,
                "amount": str(unfilled),
                "balance_after": str(coin_wallet.balance)
            })
            
            wallet_updates[coin_currency] = {
                "balance": coin_wallet.balance,  # type: ignore
            }
        
        # Add USDT to wallet
        usdt_amount = fill_data.quantity * fill_data.price
        usdt_wallet = db.query(Wallet).filter(
            and_(
                Wallet.user_id == current_user.id,
                Wallet.currency == quote_currency
            )
        ).first()
        
        if usdt_wallet:
            usdt_wallet.balance += usdt_amount  # type: ignore
            
            # Log sell (thêm USDT)
            tx_sell = Transaction(
                id=uuid_module.uuid4(),
                user_id=current_user.id,
                wallet_id=usdt_wallet.id,
                type="fill_sell",
                currency=quote_currency,
                amount=usdt_amount,
                fee=fill_data.commission,
                balance_after=usdt_wallet.balance,  # type: ignore
                created_at=get_vietnam_now()
            )
            db.add(tx_sell)
            transaction_logs.append({
                "type": "fill_sell",
                "currency": quote_currency,
                "amount": str(usdt_amount),
                "fee": str(fill_data.commission),
                "balance_after": str(usdt_wallet.balance)
            })
            
            wallet_updates[quote_currency] = {
                "balance": usdt_wallet.balance,  # type: ignore
            }
    
    # Commit all changes
    db.commit()
    
    return FillTradeResponse(
        message="Trade filled successfully",
        trade_id=trade.id,  # type: ignore
        order_id=order.id,  # type: ignore
        status=order.status,  # type: ignore
        quantity=fill_data.quantity,
        price=fill_data.price,
        commission=fill_data.commission,
        wallet_updates=wallet_updates,
        transaction_logs=transaction_logs
    )
