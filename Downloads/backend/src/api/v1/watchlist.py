from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.config.database import get_db

router = APIRouter()

@router.get("/")
async def get_watchlist(db: Session = Depends(get_db)):
    """Lấy danh sách theo dõi"""
    return {"message": "Watchlist"}

@router.post("/{symbol}")
async def add_to_watchlist(symbol: str, db: Session = Depends(get_db)):
    """Thêm mã vào danh sách theo dõi"""
    return {"message": f"{symbol} added to watchlist"}

@router.delete("/{symbol}")
async def remove_from_watchlist(symbol: str, db: Session = Depends(get_db)):
    """Xóa mã khỏi danh sách theo dõi"""
    return {"message": f"{symbol} removed from watchlist"}
