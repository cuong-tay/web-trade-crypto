from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from uuid import UUID
from decimal import Decimal
from pydantic import BaseModel
from src.config.database import get_db
from src.schemas.wallet import WalletResponse, TransactionResponse
from src.models.wallet import Wallet, Transaction
from src.utils.dependencies import get_current_user, check_user_not_banned
from src.utils.timezone import get_vietnam_now
from datetime import datetime
import uuid as uuid_module

router = APIRouter()

# ============= SCHEMAS =============
class WalletBalanceResponse(BaseModel):
    currency: str
    balance: Decimal
    wallet_type: str

class BalancesResponse(BaseModel):
    total_wallets: int
    wallets: list[WalletBalanceResponse]

class DepositAddressRequest(BaseModel):
    currency: str
    network: str = "default"

class DepositAddressResponse(BaseModel):
    currency: str
    network: str
    address: str
    memo: str = ""
    message: str = "Deposit address created/retrieved successfully"

class WithdrawRequest(BaseModel):
    currency: str
    amount: Decimal
    address: str
    network: str = "default"

class WithdrawResponse(BaseModel):
    message: str
    transaction_id: str
    status: str
    amount: Decimal
    currency: str

class UpdateBalanceRequest(BaseModel):
    """Cập nhật balance cho wallet"""
    currency: str
    amount: Decimal  # Số tiền thêm/bớt
    transaction_type: str  # deposit, withdrawal, bonus, penalty, etc.
    description: str = ""  # Mô tả giao dịch
    wallet_type: str = "spot"  # spot, future, margin

class UpdateBalanceResponse(BaseModel):
    """Response khi cập nhật balance"""
    message: str
    wallet_id: str
    currency: str
    old_balance: Decimal
    new_balance: Decimal
    amount_changed: Decimal
    transaction_id: str

# ============= GET ALL WALLETS =============
@router.get("/", response_model=list[WalletResponse])
async def get_wallets(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Lấy danh sách ví người dùng"""
    wallets = db.query(Wallet).filter(
        Wallet.user_id == current_user.id
    ).all()
    
    return [WalletResponse.from_orm(w) for w in wallets]


# ============= GET WALLET BALANCES =============
@router.get("/balances/summary", response_model=BalancesResponse)
async def get_wallet_balances(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Lấy tổng quan số dư của tất cả loại ví (spot, funding...)
    
    Returns:
    - total_wallets: Số lượng ví
    - wallets: Danh sách ví với balance
    """
    wallets = db.query(Wallet).filter(
        Wallet.user_id == current_user.id
    ).all()
    
    wallet_summaries = []
    for wallet in wallets:
        wallet_summaries.append(
            WalletBalanceResponse(
                currency=wallet.currency,  # type: ignore
                balance=wallet.balance,  # type: ignore
                wallet_type=wallet.wallet_type  # type: ignore
            )
        )
    
    return BalancesResponse(
        total_wallets=len(wallets),
        wallets=wallet_summaries
    )


# ============= GET WALLET BALANCES (alias) =============
@router.get("/balances", response_model=BalancesResponse)
async def get_wallet_balances_alias(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Lấy tổng quan số dư (alias endpoint)
    """
    wallets = db.query(Wallet).filter(
        Wallet.user_id == current_user.id
    ).all()
    
    wallet_summaries = []
    for wallet in wallets:
        wallet_summaries.append(
            WalletBalanceResponse(
                currency=wallet.currency,  # type: ignore
                balance=wallet.balance,  # type: ignore
                wallet_type=wallet.wallet_type  # type: ignore
            )
        )
    
    return BalancesResponse(
        total_wallets=len(wallets),
        wallets=wallet_summaries
    )


# ============= GET SINGLE WALLET =============
@router.get("/detail/{wallet_id}", response_model=WalletResponse)
async def get_wallet(
    wallet_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Lấy thông tin ví"""
    try:
        wallet_uuid = UUID(wallet_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid wallet_id format")
    
    wallet = db.query(Wallet).filter(
        and_(
            Wallet.id == wallet_uuid,
            Wallet.user_id == current_user.id
        )
    ).first()
    
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    
    return WalletResponse.from_orm(wallet)


# ============= GET DEPOSIT ADDRESS =============
@router.post("/deposit/address", response_model=DepositAddressResponse)
async def get_deposit_address(
    request: DepositAddressRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Lấy địa chỉ ví để nạp coin
    
    - **currency**: Loại tiền tệ (BTC, ETH, USDT...)
    - **network**: Mạng (BTC, BEP20, ERC20...)
    
    Logic: Trong môi trường thực, sẽ tương tác với dịch vụ quản lý ví
    Tạm thời: Trả về địa chỉ giả lập cho testing
    """
    currency = request.currency.upper()
    network = request.network or "default"
    
    # Kiểm tra ví tồn tại
    wallet = db.query(Wallet).filter(
        and_(
            Wallet.user_id == current_user.id,
            Wallet.currency == currency
        )
    ).first()
    
    if not wallet:
        raise HTTPException(status_code=404, detail=f"Wallet {currency} not found")
    
    # Trong thực tế, sẽ gọi external API để tạo/lấy địa chỉ
    # Tạm thời: Tạo địa chỉ giả lập dựa trên user_id và currency
    import hashlib
    address_seed = f"{current_user.id}{currency}{network}"
    fake_address = "0x" + hashlib.sha256(address_seed.encode()).hexdigest()[:40]
    
    return DepositAddressResponse(
        currency=currency,
        network=network,
        address=fake_address,
        memo=""
    )


# ============= WITHDRAW =============
@router.post("/withdraw", response_model=WithdrawResponse)
async def withdraw(
    request: WithdrawRequest,
    db: Session = Depends(get_db),
    current_user = Depends(check_user_not_banned)
):
    """
    Tạo yêu cầu rút tiền
    
    - **currency**: Loại tiền tệ
    - **amount**: Số lượng rút
    - **address**: Địa chỉ nhận
    - **network**: Mạng
    
    Logic:
    1. Kiểm tra ví tồn tại
    2. Kiểm tra số dư đủ
    3. Tạo giao dịch rút tiền (status: pending)
    4. Khóa số dư
    """
    currency = request.currency.upper()
    amount = request.amount
    
    # Validate input
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be > 0")
    
    if not request.address:
        raise HTTPException(status_code=400, detail="Address is required")
    
    # Lấy ví
    wallet = db.query(Wallet).filter(
        and_(
            Wallet.user_id == current_user.id,
            Wallet.currency == currency
        )
    ).first()
    
    if not wallet:
        raise HTTPException(status_code=404, detail=f"Wallet {currency} not found")
    
    # Kiểm tra số dư
    available = wallet.balance - wallet.locked_balance  # type: ignore
    if available < amount:  # type: ignore
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Available: {available}, Requested: {amount}"
        )
    
    # Tạo giao dịch rút tiền
    import uuid as uuid_module
    
    # Tính balance_after (số dư sau khi rút)
    balance_after = wallet.balance - amount
    
    transaction = Transaction(
        id=uuid_module.uuid4(),
        user_id=current_user.id,
        wallet_id=wallet.id,
        type="withdrawal",
        currency=currency,
        amount=amount,
        fee=Decimal("0"),  # Có thể tính phí sau
        balance_after=balance_after,
        created_at=get_vietnam_now()
    )
    
    # Khóa số dư
    wallet.locked_balance += amount  # type: ignore
    
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    
    return WithdrawResponse(
        message="Withdrawal request created successfully",
        transaction_id=str(transaction.id),
        status="pending",
        amount=amount,
        currency=currency
    )


# ============= GET ALL TRANSACTIONS =============
@router.get("/transactions/history", response_model=list[TransactionResponse])
async def get_all_transactions(
    limit: int = 50,
    offset: int = 0,
    type: str | None = None,  # type: ignore
    currency: str | None = None,  # type: ignore
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Lấy lịch sử giao dịch (nạp, rút, chuyển tiền)
    
    - **limit**: Số bản ghi mỗi lần
    - **offset**: Vị trí bắt đầu
    - **type**: Lọc theo loại (deposit, withdrawal, transfer...)
    - **currency**: Lọc theo tiền tệ
    """
    query = db.query(Transaction).filter(
        Transaction.user_id == current_user.id
    )
    
    if type:
        query = query.filter(Transaction.type == type.lower())
    
    if currency:
        query = query.filter(Transaction.currency == currency.upper())
    
    transactions = query.order_by(
        Transaction.created_at.desc()
    ).offset(offset).limit(limit).all()
    
    return [TransactionResponse.from_orm(t) for t in transactions]


# ============= GET TRANSACTIONS (alias for /transactions/history) =============
@router.get("/transactions", response_model=list[TransactionResponse])
async def get_transactions(
    limit: int = 50,
    offset: int = 0,
    type: str | None = None,  # type: ignore
    currency: str | None = None,  # type: ignore
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Lấy lịch sử giao dịch (alias)
    
    - **limit**: Số bản ghi mỗi lần
    - **offset**: Vị trí bắt đầu
    - **type**: Lọc theo loại
    - **currency**: Lọc theo tiền tệ
    """
    query = db.query(Transaction).filter(
        Transaction.user_id == current_user.id
    )
    
    if type:
        query = query.filter(Transaction.type == type.lower())
    
    if currency:
        query = query.filter(Transaction.currency == currency.upper())
    
    transactions = query.order_by(
        Transaction.created_at.desc()
    ).offset(offset).limit(limit).all()
    
    return [TransactionResponse.from_orm(t) for t in transactions]


# ============= GET WALLET TRANSACTIONS =============
@router.get("/{wallet_id}/transaction-history", response_model=list[TransactionResponse])
async def get_wallet_transactions(
    wallet_id: str,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Lấy lịch sử giao dịch của ví
    
    - **wallet_id**: ID của ví
    - **limit**: Số lượng bản ghi
    - **offset**: Vị trí bắt đầu
    """
    try:
        wallet_uuid = UUID(wallet_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid wallet_id format")
    
    # Kiểm tra ví tồn tại và thuộc current_user
    wallet = db.query(Wallet).filter(
        and_(
            Wallet.id == wallet_uuid,
            Wallet.user_id == current_user.id
        )
    ).first()
    
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    
    # Lấy transactions
    transactions = db.query(Transaction).filter(
        Transaction.wallet_id == wallet_uuid
    ).order_by(Transaction.created_at.desc()).offset(offset).limit(limit).all()
    
    return [TransactionResponse.from_orm(t) for t in transactions]


# ============= UPDATE BALANCE =============
@router.post("/update-balance", response_model=UpdateBalanceResponse)
async def update_balance(
    user_id: UUID,
    update_data: UpdateBalanceRequest,
    db: Session = Depends(get_db),
    current_user = Depends(check_user_not_banned)
):
    """
    Cập nhật balance cho wallet (dùng cho admin/system)
    
    - **user_id**: ID user cần cập nhật
    - **currency**: Loại tiền tệ (BTC, ETH, USDT, etc.)
    - **amount**: Số tiền thêm (dương) hoặc bớt (âm)
    - **transaction_type**: Loại giao dịch (deposit, withdrawal, bonus, penalty, etc.)
    - **description**: Mô tả giao dịch
    - **wallet_type**: Loại ví (spot, future, margin)
    
    Ví dụ:
    - Thêm 1000 USDT: amount=1000, transaction_type="deposit"
    - Trừ 100 USDT: amount=-100, transaction_type="penalty"
    """
    
    # Kiểm tra input
    if not update_data.currency:
        raise HTTPException(status_code=400, detail="currency required")
    
    if update_data.amount == 0:
        raise HTTPException(status_code=400, detail="amount cannot be 0")
    
    # Lấy wallet
    wallet = db.query(Wallet).filter(
        and_(
            Wallet.user_id == user_id,
            Wallet.currency == update_data.currency.upper(),
            Wallet.wallet_type == update_data.wallet_type
        )
    ).first()
    
    if not wallet:
        raise HTTPException(
            status_code=404, 
            detail=f"Wallet not found for {update_data.currency} ({update_data.wallet_type})"
        )
    
    # Lưu balance cũ
    old_balance = wallet.balance
    
    # Cập nhật balance
    wallet.balance += update_data.amount  # type: ignore
    new_balance = wallet.balance
    
    # Kiểm tra balance không được âm
    if wallet.balance < 0:  # type: ignore
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient balance. Current: {old_balance}, Trying to deduct: {abs(update_data.amount)}"
        )
    
    db.add(wallet)
    db.commit()
    
    # Log transaction
    transaction = Transaction(
        id=uuid_module.uuid4(),
        user_id=user_id,
        wallet_id=wallet.id,
        type=update_data.transaction_type.lower(),
        currency=update_data.currency.upper(),
        amount=abs(update_data.amount),
        fee=Decimal("0"),
        balance_after=new_balance,
        created_at=get_vietnam_now()
    )
    
    db.add(transaction)
    db.commit()
    
    return UpdateBalanceResponse(
        message=f"Balance updated successfully ({update_data.transaction_type})",
        wallet_id=str(wallet.id),
        currency=update_data.currency.upper(),
        old_balance=old_balance,  # type: ignore
        new_balance=new_balance,  # type: ignore
        amount_changed=update_data.amount,
        transaction_id=str(transaction.id)
    )
