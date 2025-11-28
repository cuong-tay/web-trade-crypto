"""
Script để tạo tất cả các bảng trong database
"""
import sys
import os

# Add backend directory to path
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

from src.config.database import engine, Base
from src.models.user import User, UserProfile, ActivityLog
from src.models.wallet import Wallet, Transaction
from src.models.order import Order, Trade
from src.models.watchlist import Watchlist

def create_tables():
    """Tạo tất cả các bảng trong database"""
    try:
        print("Đang tạo các bảng trong database...")
        
        # Import all models to register them with Base
        print("Các models đã được import:")
        print(f"  - User, UserProfile, ActivityLog")
        print(f"  - Wallet, Transaction")
        print(f"  - Order, Trade")
        print(f"  - Watchlist")
        
        # Create all tables
        Base.metadata.create_all(bind=engine)
        
        print("\n✓ Tạo các bảng thành công!")
        print("\nCác bảng đã được tạo:")
        for table in Base.metadata.tables.keys():
            print(f"  - {table}")
            
    except Exception as e:
        print(f"\n✗ Lỗi khi tạo bảng: {str(e)}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    create_tables()
