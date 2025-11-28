from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime

class WalletResponse(BaseModel):
    id: UUID
    user_id: UUID
    currency: str
    balance: Decimal
    wallet_type: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class TransactionResponse(BaseModel):
    id: UUID
    user_id: UUID
    wallet_id: UUID
    type: str
    currency: str
    amount: Decimal
    fee: Decimal
    balance_after: Decimal
    created_at: datetime
    
    class Config:
        from_attributes = True

class TransactionCreate(BaseModel):
    wallet_id: UUID
    type: str  # deposit, withdrawal, fee
    currency: str
    amount: Decimal
    fee: Optional[Decimal] = Decimal('0')
