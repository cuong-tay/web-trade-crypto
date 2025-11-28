import re
from email_validator import validate_email, EmailNotValidError

def validate_email_format(email: str) -> bool:
    """Validate email format"""
    # Simple regex validation
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, email):
        return False
    
    # Try to validate with email_validator if possible
    try:
        validate_email(email, check_deliverability=False)
    except Exception:
        pass
    
    return True

def validate_username(username: str) -> tuple[bool, str]:
    """Validate username"""
    if len(username) < 3:
        return False, "Tên người dùng phải từ 3 ký tự trở lên"
    if len(username) > 50:
        return False, "Tên người dùng không được vượt quá 50 ký tự"
    if not username.replace("_", "").replace("-", "").isalnum():
        return False, "Tên người dùng chỉ được chứa chữ, số, gạch dưới và gạch ngang"
    return True, ""

def validate_password(password: str) -> tuple[bool, str]:
    """Validate password strength"""
    if len(password) < 8:
        return False, "Mật khẩu phải từ 8 ký tự trở lên"
    if not any(char.isupper() for char in password):
        return False, "Mật khẩu phải chứa ít nhất một ký tự in hoa"
    if not any(char.isdigit() for char in password):
        return False, "Mật khẩu phải chứa ít nhất một chữ số"
    if not any(char in "!@#$%^&*" for char in password):
        return False, "Mật khẩu phải chứa ít nhất một ký tự đặc biệt (!@#$%^&*)"
    return True, ""
