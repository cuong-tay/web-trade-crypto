from fastapi import APIRouter, Depends, HTTPException, status, Request, File, UploadFile
from sqlalchemy.orm import Session, joinedload
from typing import List

from src.config.database import get_db
from src.schemas.user import (
    UserDetailResponse, 
    UserResponse, 
    UserProfileResponse,
    ProfileUpdate,
    PasswordChange,
    ActivityLogResponse
)
from src.services.auth_service import AuthService
from src.utils.dependencies import get_current_user, get_client_ip, get_user_agent
from src.utils.file_handler import save_avatar, save_cover, delete_avatar, delete_cover
from src.models.user import User, UserProfile, ActivityLog
from datetime import datetime
from uuid import uuid4

router = APIRouter()

@router.get("/me", response_model=UserDetailResponse)
def get_my_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lấy thông tin chi tiết của người dùng đang đăng nhập
    
    **Yêu cầu:** Bearer Token trong header Authorization
    
    **Trả về:** Thông tin user và profile
    """
    # Get user with profile
    user = db.query(User).options(
        joinedload(User.profile)
    ).filter(User.id == current_user.id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy người dùng"
        )
    
    if not user.profile:
        # Create default profile if not exists
        new_profile = UserProfile(
            user_id=user.id,
            display_name=user.username,
            language="vi",
            default_currency="VND",
            notify_email=True,
            notify_push=True
        )
        db.add(new_profile)
        db.commit()
        db.refresh(user)
    
    return UserDetailResponse(
        user=UserResponse.from_orm(user),
        profile=UserProfileResponse.from_orm(user.profile)
    )

@router.put("/me/profile", response_model=UserProfileResponse)
def update_my_profile(
    profile_data: ProfileUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cập nhật thông tin cá nhân (họ tên, bio, avatar...)
    
    **Yêu cầu:** Bearer Token trong header Authorization
    
    **Có thể cập nhật:**
    - display_name: Tên hiển thị
    - bio: Giới thiệu bản thân
    - phone: Số điện thoại
    - language: Ngôn ngữ (vi, en)
    - default_currency: Tiền tệ mặc định (VND, USD)
    - notify_email: Bật/tắt thông báo email
    - notify_push: Bật/tắt thông báo push
    
    **Trả về:** Thông tin profile đã cập nhật
    """
    # Get user profile
    profile = db.query(UserProfile).filter(
        UserProfile.user_id == current_user.id
    ).first()
    
    if not profile:
        # Create profile if not exists
        profile = UserProfile(
            user_id=current_user.id,
            display_name=current_user.username,
            language="vi",
            default_currency="VND",
            notify_email=True,
            notify_push=True
        )
        db.add(profile)
    
    # Update profile fields
    update_data = profile_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(profile, field):
            setattr(profile, field, value)
    
    # Log activity - don't pass id and created_at, let DB handle them
    try:
        activity = ActivityLog(
            user_id=current_user.id,
            action="profile_update",
            details=f"Cập nhật thông tin cá nhân. Fields: {', '.join(update_data.keys())}"
        )
        db.add(activity)
    except Exception as log_err:
        print(f"Warning: Could not log activity: {log_err}")

    try:
        db.commit()
        db.refresh(profile)
        return UserProfileResponse.from_orm(profile)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi cập nhật profile: {str(e)}"
        )

@router.put("/me/password")
def change_my_password(
    password_data: PasswordChange,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Thay đổi mật khẩu
    
    **Yêu cầu:** Bearer Token trong header Authorization
    
    **Body:**
    - current_password: Mật khẩu hiện tại
    - new_password: Mật khẩu mới (tối thiểu 8 ký tự, phải có chữ hoa, chữ thường, số, ký tự đặc biệt)
    - confirm_new_password: Xác nhận mật khẩu mới
    
    **Trả về:** Thông báo thay đổi mật khẩu thành công
    """
    auth_service = AuthService(db)
    return auth_service.change_password(current_user, password_data)

@router.get("/me/activity", response_model=List[ActivityLogResponse])
def get_my_activity(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 50
):
    """
    Lấy lịch sử hoạt động từ bảng activity_log
    
    **Yêu cầu:** Bearer Token trong header Authorization
    
    **Query Parameters:**
    - skip: Số bản ghi bỏ qua (mặc định: 0)
    - limit: Số bản ghi tối đa (mặc định: 50, tối đa: 100)
    
    **Trả về:** Danh sách các hoạt động của người dùng
    """
    if limit > 100:
        limit = 100
    
    activities = db.query(ActivityLog).filter(
        ActivityLog.user_id == current_user.id
    ).order_by(
        ActivityLog.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    return [ActivityLogResponse.from_orm(activity) for activity in activities]

@router.get("/{user_id}", response_model=UserResponse)
def get_user_by_id(
    user_id: str,
    db: Session = Depends(get_db)
):
    """
    Lấy thông tin công khai của người dùng theo ID
    
    **Không yêu cầu authentication**
    
    **Trả về:** Thông tin cơ bản của người dùng
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy người dùng"
        )
    
    return UserResponse.from_orm(user)

@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload ảnh đại diện (avatar)
    
    **Yêu cầu:** Bearer Token trong header Authorization
    
    **File Requirements:**
    - Định dạng: JPG, JPEG, PNG, GIF, WebP
    - Kích thước tối đa: 5MB
    
    **Trả về:** URL của ảnh đã upload
    """
    try:
        # Validate filename
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tên file không hợp lệ"
            )
        
        # Read file content
        file_content = await file.read()
        
        # Save avatar
        avatar_url = await save_avatar(file_content, str(current_user.id), file.filename)
        
        # Get or create profile
        profile = db.query(UserProfile).filter(
            UserProfile.user_id == current_user.id
        ).first()
        
        if not profile:
            profile = UserProfile(
                user_id=current_user.id,
                display_name=current_user.username,
                language="vi",
                default_currency="USDT"
            )
            db.add(profile)
        
        # Delete old avatar if exists
        old_avatar = profile.avatar_url  # type: ignore
        if old_avatar is not None:  # type: ignore
            delete_avatar(str(old_avatar))
        
        # Update avatar URL
        profile.avatar_url = avatar_url  # type: ignore
        
        # Log activity
        activity = ActivityLog(
            user_id=current_user.id,
            action="avatar_upload",
            details=f"Upload ảnh đại diện. File: {file.filename}"
        )
        db.add(activity)
        db.commit()
        
        return {
            "message": "Upload ảnh đại diện thành công",
            "avatar_url": avatar_url
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi upload ảnh: {str(e)}"
        )

@router.post("/me/cover")
async def upload_cover(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload ảnh nền (cover)
    
    **Yêu cầu:** Bearer Token trong header Authorization
    
    **File Requirements:**
    - Định dạng: JPG, JPEG, PNG, GIF, WebP
    - Kích thước tối đa: 5MB
    
    **Trả về:** URL của ảnh đã upload
    """
    try:
        # Validate filename
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tên file không hợp lệ"
            )
        
        # Read file content
        file_content = await file.read()
        
        # Save cover
        cover_url = await save_cover(file_content, str(current_user.id), file.filename)
        
        # Get or create profile
        profile = db.query(UserProfile).filter(
            UserProfile.user_id == current_user.id
        ).first()
        
        if not profile:
            profile = UserProfile(
                user_id=current_user.id,
                display_name=current_user.username,
                language="vi",
                default_currency="USDT"
            )
            db.add(profile)
        
        # Delete old cover if exists
        old_cover = profile.cover_url  # type: ignore
        if old_cover is not None:  # type: ignore
            delete_cover(str(old_cover))
        
        # Update cover URL
        profile.cover_url = cover_url  # type: ignore
        
        # Log activity
        activity = ActivityLog(
            user_id=current_user.id,
            action="cover_upload",
            details=f"Upload ảnh nền. File: {file.filename}"
        )
        db.add(activity)
        db.commit()
        
        return {
            "message": "Upload ảnh nền thành công",
            "cover_url": cover_url
        }
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi upload ảnh: {str(e)}"
        )
