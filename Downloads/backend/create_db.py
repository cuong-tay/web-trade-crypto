"""
Script để tạo bảng trong database
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.config.database import engine, Base
# Import all models to register them with Base
from src.models import User, UserProfile, ActivityLog, Wallet, Transaction, Order, Trade, Watchlist

def create_all_tables():
    """Tạo tất cả bảng"""
    print("Dropping all existing tables...")
    
    # Manually drop tables in reverse dependency order
    # This is more robust than `drop_all` which can fail on complex dependencies
    try:
        with engine.connect() as connection:
            # Start a transaction
            with connection.begin():
                # Get a list of all table names from metadata
                tables = Base.metadata.sorted_tables
                
                # Drop tables in reverse order of creation
                for table in reversed(tables):
                    print(f"  - Dropping table {table.name}...")
                    try:
                        table.drop(connection, checkfirst=True)
                    except Exception as e:
                        print(f"    - Could not drop table {table.name}. Reason: {e}")
            print("OK. All tables dropped.")
    except Exception as e:
        print(f"An error occurred during table dropping: {e}")


    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    print("OK. Tables created successfully!")
    
    # List tables created
    print("\nTables created:")
    for table in Base.metadata.tables.keys():
        print(f"  - {table}")

if __name__ == "__main__":
    create_all_tables()
