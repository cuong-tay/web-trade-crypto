from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.config.database import get_db

router = APIRouter()

@router.get("/")
async def get_portfolio(db: Session = Depends(get_db)):
    """Lấy danh mục đầu tư của người dùng"""
    return {"message": "Portfolio"}

@router.get("/summary")
async def get_portfolio_summary(db: Session = Depends(get_db)):
    """Lấy tóm tắt danh mục đầu tư"""
    return {"message": "Portfolio summary"}

@router.get("/performance")
async def get_portfolio_performance(
    period: str = "30d",
    db: Session = Depends(get_db)
):
    """
    Lấy hiệu suất danh mục đầu tư
    
    - **period**: Khoảng thời gian (1d, 7d, 30d, 90d, 1y)
    """
    return {"message": f"Portfolio performance for period {period}"}

@router.get("/holdings")
async def get_portfolio_holdings(db: Session = Depends(get_db)):
    """Lấy danh sách các khoảng giữ"""
    return {"message": "Holdings"}
