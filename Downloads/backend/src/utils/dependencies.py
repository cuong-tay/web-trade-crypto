from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from src.config.database import get_db
from src.utils.security import verify_token
from src.models.user import User
from src.schemas.user import TokenData

security = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """Lấy thông tin user hiện tại từ JWT token"""
    
    token = credentials.credentials
    
    # Verify token
    token_data = verify_token(token)
    if not token_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token không hợp lệ hoặc đã hết hạn",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Get user from database
    user = db.query(User).filter(User.email == token_data.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Không tìm thấy người dùng",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check user status
    if str(user.status) != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Tài khoản đang ở trạng thái: {user.status}"
        )
    
    return user

def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Kiểm tra user có active không"""
    if str(current_user.status) != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản không hoạt động"
        )
    return current_user

def check_user_not_banned(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> User:
    """
    Middleware: Kiểm tra user bị banned
    - Refresh lại status từ database để đảm bảo dữ liệu mới nhất
    - Block tất cả write operations (POST, PUT, DELETE, PATCH) nếu user bị banned
    - Allow read operations (GET) để user xem balance, history
    """
    # Refresh user status từ database để kiểm tra dữ liệu mới nhất
    user = db.query(User).filter(User.id == current_user.id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy người dùng"
        )
    
    # Kiểm tra nếu user bị banned
    if str(user.status) == 'banned':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="⛔ Tài khoản của bạn đã bị khóa. Vui lòng liên hệ hỗ trợ tại support@ctrading.com"
        )
    
    return user

def get_optional_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Lấy user nếu có token, không bắt buộc"""
    if not credentials:
        return None
    
    try:
        return get_current_user(credentials, db)
    except HTTPException:
        return None

def require_role(allowed_roles: list[str]):
    """Decorator để kiểm tra role của user"""
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Yêu cầu quyền: {', '.join(allowed_roles)}"
            )
        return current_user
    return role_checker

def get_client_ip(request: Request) -> str:
    """Lấy IP address của client"""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    return request.client.host if request.client else "unknown"

def get_user_agent(request: Request) -> str:
    """Lấy User-Agent của client"""
    return request.headers.get("User-Agent", "unknown")
