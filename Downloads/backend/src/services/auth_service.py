from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from datetime import datetime, timedelta
from uuid import uuid4
import logging

from src.models.user import User, UserProfile, ActivityLog
from src.schemas.user import UserRegister, UserLogin, Token, UserResponse
from src.utils.security import (
    get_password_hash,
    verify_password,
    create_access_token
)
from src.utils.timezone import get_vietnam_now
from src.config.settings import get_settings

settings = get_settings()

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)


class AuthService:
    def __init__(self, db: Session):
        self.db = db

    def register_user(self, user_data: UserRegister, ip_address: str | None = None, user_agent: str | None = None) -> Token:
        """
        Đăng ký người dùng mới
        - Email được normalize thành lowercase
        - Username lưu nguyên vẹn nhưng kiểm tra case-insensitive
        """
        logger.info(f"=== REGISTER REQUEST RECEIVED ===")
        logger.info(f"Email: {user_data.email}, Username: {user_data.username}")
        logger.info(f"IP Address: {ip_address}, User Agent: {user_agent}")

        # Normalize email thành lowercase
        email_normalized = user_data.email.lower().strip()
        username_input = user_data.username.strip()

        # Kiểm tra email đã tồn tại (case-insensitive)
        existing_email = self.db.query(User).filter(
            User.email == email_normalized
        ).first()
        if existing_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email đã được đăng ký"
            )

        # Kiểm tra username đã tồn tại (case-insensitive)
        existing_username = self.db.query(User).filter(
            User.username.ilike(username_input)
        ).first()
        if existing_username:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username đã tồn tại"
            )

        # Kiểm tra password match
        if user_data.password != user_data.confirm_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mật khẩu không khớp"
            )

        # Validate password strength
        if not self._validate_password_strength(user_data.password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt"
            )

        try:
            # Tạo user mới
            now = get_vietnam_now()
            new_user = User(
                id=uuid4(),
                email=email_normalized,  # Lưu email normalized
                username=username_input,  # Lưu username nguyên vẹn
                password_hash=get_password_hash(user_data.password),
                role='user',
                status='active',
                email_verified=False,
                created_at=now,
                last_login=now
            )

            self.db.add(new_user)
            self.db.flush()
            logger.info(f"✅ User created: {new_user.id}")

            # Tạo user profile
            new_profile = UserProfile(
                id=uuid4(),
                user_id=new_user.id,
                display_name=username_input,
                language='vi',
                default_currency='USDT',
                notify_email=True,
                notify_push=True
            )

            self.db.add(new_profile)
            logger.info(f"✅ Profile created: {new_profile.id}")

            # Ghi activity log
            activity = ActivityLog(
                id=uuid4(),
                user_id=new_user.id,
                action='register',
                details=f"Đăng ký tài khoản mới. Email: {email_normalized}, Username: {username_input}",
                created_at=now
            )
            self.db.add(activity)

            self.db.commit()
            logger.info(f"✅ Activity logged")

            # Tạo token
            access_token = create_access_token(
                data={
                    "sub": new_user.email,
                    "user_id": str(new_user.id)
                }
            )

            logger.info(f"✅ Token created, registration successful")

            return Token(
                access_token=access_token,
                token_type="bearer",
                expires_in=settings.access_token_expire_minutes * 60,
                user=UserResponse.model_validate({
                    "id": str(new_user.id),
                    "email": str(new_user.email),
                    "username": str(new_user.username),
                    "role": str(new_user.role),
                    "status": str(new_user.status),
                    "email_verified": bool(new_user.email_verified),
                    "created_at": new_user.created_at,
                    "last_login": new_user.last_login
                })
            )
        except Exception as e:
            self.db.rollback()
            logger.error(f"❌ Registration error: {str(e)}")
            raise

    def login_user(self, user_data: UserLogin, ip_address: str | None = None, user_agent: str | None = None) -> Token:
        """
        Đăng nhập người dùng
        - Email được normalize thành lowercase để kiểm tra
        """
        logger.info(f"=== LOGIN REQUEST RECEIVED ===")
        logger.info(f"Email: {user_data.email}")
        logger.info(f"IP Address: {ip_address}, User Agent: {user_agent}")

        # Normalize email thành lowercase
        email_normalized = user_data.email.lower().strip()

        try:
            # Tìm user bằng email normalized
            user = self.db.query(User).filter(User.email == email_normalized).first()

            if not user:
                logger.warning(f"❌ User not found: {email_normalized}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Email hoặc mật khẩu không chính xác"
                )

            # Verify password
            if not verify_password(user_data.password, str(user.password_hash)):
                logger.warning(f"❌ Invalid password for: {email_normalized}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Email hoặc mật khẩu không chính xác"
                )

            if str(user.status) != 'active':
                logger.warning(f"❌ Account locked: {email_normalized}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Tài khoản của bạn đã bị khóa"
                )

            # Cập nhật last_login
            new_last_login = get_vietnam_now()
            self.db.query(User).filter(User.id == user.id).update(
                {User.last_login: new_last_login}
            )

            # Ghi activity log
            activity = ActivityLog(
                id=uuid4(),
                user_id=user.id,
                action='login',
                details=f"Đăng nhập thành công. Email: {user.email}",
                created_at=get_vietnam_now()
            )
            self.db.add(activity)
            self.db.commit()

            logger.info(f"✅ Login successful: {email_normalized}")

            # Tạo token
            access_token = create_access_token(
                data={
                    "sub": user.email,
                    "user_id": str(user.id)
                }
            )

            return Token(
                access_token=access_token,
                token_type="bearer",
                expires_in=settings.access_token_expire_minutes * 60,
                user=UserResponse.model_validate({
                    "id": str(user.id),
                    "email": str(user.email),
                    "username": str(user.username),
                    "role": str(user.role),
                    "status": str(user.status),
                    "email_verified": bool(user.email_verified),
                    "created_at": user.created_at,
                    "last_login": new_last_login
                })
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Login error: {str(e)}")
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Lỗi server khi đăng nhập"
            )

    def logout_user(self, user_id: str) -> dict:
        """
        Đăng xuất người dùng (chỉ ghi log, JWT không có blacklist)
        """
        user = self.db.query(User).filter(User.id == user_id).first()

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Người dùng không tồn tại"
            )

        # Ghi activity log
        activity = ActivityLog(
            id=uuid4(),
            user_id=user.id,
            action='logout',
            details=f"Đăng xuất. Email: {user.email}",
            created_at=get_vietnam_now()
        )
        self.db.add(activity)
        self.db.commit()

        return {"message": "Đăng xuất thành công"}

    def change_password(self, current_user: User, password_data) -> dict:
        """
        Thay đổi mật khẩu
        """
        logger.info(f"=== CHANGE PASSWORD REQUEST ===")
        logger.info(f"User: {current_user.email}")

        try:
            # Verify current password
            if not verify_password(password_data.current_password, str(current_user.password_hash)):
                logger.warning(f"❌ Invalid current password: {current_user.email}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Mật khẩu hiện tại không chính xác"
                )
            
            # Check new password match
            if password_data.new_password != password_data.confirm_new_password:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Mật khẩu mới không khớp"
                )
            
            # Validate password strength
            if not self._validate_password_strength(password_data.new_password):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt"
                )
            
            # Update password
            new_hash = get_password_hash(password_data.new_password)
            self.db.query(User).filter(User.id == current_user.id).update(
                {User.password_hash: new_hash}
            )
            
            # Log activity
            activity = ActivityLog(
                id=uuid4(),
                user_id=current_user.id,
                action='password_change',
                details="Thay đổi mật khẩu thành công",
                created_at=get_vietnam_now()
            )
            self.db.add(activity)
            self.db.commit()
            
            logger.info(f"✅ Password changed successfully: {current_user.email}")
            
            return {"message": "Thay đổi mật khẩu thành công"}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"❌ Change password error: {str(e)}")
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Lỗi server khi thay đổi mật khẩu"
            )

    @staticmethod
    def _validate_password_strength(password: str) -> bool:
        """
        Validate password strength
        - Tối thiểu 8 ký tự
        - Có ít nhất 1 chữ hoa
        - Có ít nhất 1 chữ thường
        - Có ít nhất 1 số
        - Có ít nhất 1 ký tự đặc biệt
        """
        if len(password) < 8:
            return False

        has_upper = any(c.isupper() for c in password)
        has_lower = any(c.islower() for c in password)
        has_digit = any(c.isdigit() for c in password)
        has_special = any(not c.isalnum() for c in password)

        return has_upper and has_lower and has_digit and has_special

