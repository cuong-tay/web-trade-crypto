from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
import logging
from datetime import timedelta

from src.config.database import get_db
from src.schemas.user import UserRegister, UserLogin, Token, UserDetailResponse, UserResponse
from src.services.auth_service import AuthService
from src.utils.dependencies import get_current_user, get_client_ip, get_user_agent
from src.utils.timezone import get_vietnam_now
from src.models.user import User

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(
    user_data: UserRegister,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Đăng ký tài khoản mới
    
    - **email**: Email của người dùng (phải là email hợp lệ)
    - **username**: Tên người dùng (3-50 ký tự, chỉ chữ, số, gạch dưới và gạch ngang)
    - **password**: Mật khẩu (tối thiểu 8 ký tự, phải có chữ hoa, chữ thường, số, ký tự đặc biệt)
    - **confirm_password**: Xác nhận mật khẩu
    
    **Trả về:** Token JWT và thông tin người dùng
    """
    logger.info(f">>> AUTH ROUTER: REGISTER endpoint called from {request.client.host if request.client else 'unknown'}")
    logger.info(f">>> Request headers: {dict(request.headers)}")

    auth_service = AuthService(db)
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)
    
    return auth_service.register_user(user_data, ip_address, user_agent)

@router.post("/login", response_model=Token)
def login(
    user_data: UserLogin,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Đăng nhập
    
    - **email**: Email của người dùng
    - **password**: Mật khẩu
    
    **Trả về:** Token JWT và thông tin người dùng
    """
    logger.info(f">>> AUTH ROUTER: LOGIN endpoint called from {request.client.host if request.client else 'unknown'}")
    logger.info(f">>> Request headers: {dict(request.headers)}")

    auth_service = AuthService(db)
    ip_address = get_client_ip(request)
    user_agent = get_user_agent(request)
    
    return auth_service.login_user(user_data, ip_address, user_agent)

@router.post("/logout")
def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Đăng xuất
    
    **Yêu cầu:** Bearer Token trong header Authorization
    
    **Trả về:** Thông báo đăng xuất thành công
    """
    auth_service = AuthService(db)
    return auth_service.logout_user(str(current_user.id))

@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    current_user: User = Depends(get_current_user),
):
    """
    Lấy thông tin user hiện tại
    
    **Yêu cầu:** Bearer Token trong header Authorization
    
    **Trả về:** Thông tin chi tiết của user
    """
    logger.info(f">>> AUTH ROUTER: GET /me endpoint called for user {current_user.email}")
    
    return UserResponse.model_validate({
        "id": str(current_user.id),
        "email": str(current_user.email),
        "username": str(current_user.username),
        "role": str(current_user.role),
        "status": str(current_user.status),
        "email_verified": bool(current_user.email_verified),
        "created_at": current_user.created_at,
        "last_login": current_user.last_login
    })

@router.get("/last-login")
def get_last_login(
    current_user: User = Depends(get_current_user),
):
    """
    Lấy lần đăng nhập cuối cùng
    
    **Yêu cầu:** Bearer Token trong header Authorization
    
    **Trả về:** Timestamp và thời gian tương đối (VD: "Vừa xong", "30 phút trước")
    """
    from datetime import datetime
    
    last_login_value = current_user.last_login
    
    if last_login_value is None:
        return {
            "last_login": None,
            "time_ago": "Chưa đăng nhập lần nào",
            "formatted": None
        }
    
    # Convert to datetime nếu là string
    if isinstance(last_login_value, str):
        try:
            last_login_value = datetime.fromisoformat(last_login_value.replace('Z', '+00:00'))
        except:
            last_login_value = datetime.fromisoformat(last_login_value)
    
    # Tính thời gian tương đối dùng Vietnam time
    now = get_vietnam_now()
    delta = now - last_login_value
    
    # Hàm tính thời gian tương đối
    def get_time_ago_text(time_delta: timedelta) -> str:
        total_seconds = int(time_delta.total_seconds())
        
        if total_seconds < 60:
            return "Vừa xong"
        elif total_seconds < 3600:
            minutes = total_seconds // 60
            return f"{minutes} phút trước"
        elif total_seconds < 86400:
            hours = total_seconds // 3600
            return f"{hours} giờ trước"
        elif total_seconds < 604800:
            days = total_seconds // 86400
            return f"{days} ngày trước"
        elif total_seconds < 2592000:
            weeks = total_seconds // 604800
            return f"{weeks} tuần trước"
        else:
            months = total_seconds // 2592000
            return f"{months} tháng trước"
    
    time_ago = get_time_ago_text(delta)  # type: ignore
    
    return {
        "last_login": last_login_value.isoformat(),
        "time_ago": time_ago,
        "formatted": last_login_value.strftime("%d/%m/%Y %H:%M:%S")
    }

@router.patch("/admin/update-role/{user_id}")
def update_user_role(
    user_id: str,
    role: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update user role (Admin only)
    
    **Yêu cầu:** Bearer Token của admin trong header Authorization
    
    **Parameters:**
    - user_id: ID của user cần update
    - role: Role mới (user, admin, moderator)
    
    **Trả về:** Thông báo thành công
    """
    logger.info(f">>> AUTH ROUTER: PATCH /admin/update-role endpoint called")
    
    # Check if current user is admin
    if str(current_user.role) != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ admin mới có quyền cập nhật role"
        )
    
    # Check if role is valid
    valid_roles = ["user", "admin", "moderator"]
    if role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role không hợp lệ. Các role hợp lệ: {', '.join(valid_roles)}"
        )
    
    # Find user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy người dùng"
        )
    
    # Update role using SQLAlchemy update
    db.query(User).filter(User.id == user_id).update({User.role: role})
    db.commit()
    
    # Refresh user object to get updated data
    db.refresh(user)
    
    logger.info(f"✅ Updated user {user.email} role to {role}")
    
    return {
        "message": f"Cập nhật role thành công",
        "user_id": str(user.id),
        "email": user.email,
        "username": user.username,
        "role": user.role
    }
