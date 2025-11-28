"""
Recreate admin user and test data
"""
from sqlalchemy.orm import Session
from src.config.database import SessionLocal
from src.models.user import User, UserProfile
from src.models.wallet import Wallet
from src.utils.security import get_password_hash
from decimal import Decimal
import uuid
from datetime import datetime

def setup_data():
    db = SessionLocal()
    
    # 1. Create admin user
    print("Creating admin user...")
    admin_user = User(
        id=uuid.uuid4(),
        email="admin@ctrading.com",
        username="admin",
        password_hash=get_password_hash("Admin@2004"),
        role="admin",
        status="active",
        email_verified=True
    )
    db.add(admin_user)
    db.flush()
    print(f"   Admin ID: {admin_user.id}")
    
    # 2. Create user profile
    print("Creating user profile...")
    profile = UserProfile(
        id=uuid.uuid4(),
        user_id=admin_user.id,
        display_name="Administrator",
        language="vi",
        default_currency="USDT"
    )
    db.add(profile)
    db.flush()
    
    # 3. Create wallets
    print("Creating wallets...")
    wallets_data = [
        ("USDT", Decimal("100000")),
        ("BTC", Decimal("5")),
        ("ETH", Decimal("50")),
    ]
    
    for currency, balance in wallets_data:
        wallet = Wallet(
            id=uuid.uuid4(),
            user_id=admin_user.id,
            currency=currency,
            balance=balance,
            locked_balance=Decimal("0"),
            wallet_type="spot"
        )
        db.add(wallet)
        print(f"   {currency}: {balance}")
    
    db.commit()
    print("\nSetup completed successfully!")
    
    # Display created data
    print("\n=== ADMIN DATA ===")
    print(f"Email: admin@ctrading.com")
    print(f"Password: Admin@2004")
    print(f"User ID: {admin_user.id}")
    print(f"\nWallets:")
    
    wallets = db.query(Wallet).filter(Wallet.user_id == admin_user.id).all()
    for w in wallets:
        print(f"  {w.currency}: {w.balance}")
    
    db.close()

if __name__ == "__main__":
    setup_data()
