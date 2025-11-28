from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.config.database import get_db

router = APIRouter()

@router.get("/tickers")
async def get_tickers(db: Session = Depends(get_db)):
    """Lấy dữ liệu tóm tắt tất cả cặp giao dịch"""
    return {"message": "Market tickers"}

@router.get("/klines")
async def get_klines(
    symbol: str,
    interval: str = "1h",
    db: Session = Depends(get_db)
):
    """
    Lấy dữ liệu nến (candlestick data)
    
    - **symbol**: Ký hiệu giao dịch (VD: BTCUSDT)
    - **interval**: Khoảng thời gian (1m, 5m, 15m, 1h, 4h, 1d, etc.)
    """
    return {"message": f"Klines for {symbol} with interval {interval}"}

@router.get("/stats")
async def get_market_stats(db: Session = Depends(get_db)):
    """Lấy thống kê thị trường"""
    return {"message": "Market statistics"}
