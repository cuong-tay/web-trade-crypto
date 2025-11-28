"""
Timezone utilities cho ứng dụng
Tất cả thời gian được lưu dưới dạng UTC+7 (Việt Nam)
"""

from datetime import datetime, timezone
from typing import Optional
import pytz  # type: ignore

# Định nghĩa timezone Việt Nam
VIETNAM_TZ = pytz.timezone('Asia/Ho_Chi_Minh')  # UTC+7


def get_vietnam_now() -> datetime:
    """
    Lấy thời gian hiện tại ở Việt Nam (UTC+7)
    
    Returns:
        datetime: Thời gian hiện tại với timezone UTC+7
    """
    return datetime.now(VIETNAM_TZ).replace(tzinfo=None)


def utc_to_vietnam(dt_utc: datetime) -> datetime:
    """
    Chuyển đổi từ UTC sang Việt Nam (UTC+7)
    
    Args:
        dt_utc: Datetime object với timezone UTC
        
    Returns:
        datetime: Datetime ở múi giờ Việt Nam (không có timezone info)
    """
    if dt_utc.tzinfo is None:
        # Nếu không có timezone, coi là UTC
        dt_utc = dt_utc.replace(tzinfo=timezone.utc)
    
    # Convert sang Việt Nam timezone
    dt_vn = dt_utc.astimezone(VIETNAM_TZ)
    
    # Remove tzinfo để lưu vào database
    return dt_vn.replace(tzinfo=None)


def vietnam_to_utc(dt_vn: datetime) -> datetime:
    """
    Chuyển đổi từ Việt Nam (UTC+7) sang UTC
    
    Args:
        dt_vn: Datetime object ở múi giờ Việt Nam
        
    Returns:
        datetime: Datetime ở múi giờ UTC
    """
    if dt_vn.tzinfo is not None:
        # Nếu đã có timezone, trực tiếp convert
        return dt_vn.astimezone(timezone.utc)
    
    # Nếu không có timezone, coi như Việt Nam
    dt_vn_tz = VIETNAM_TZ.localize(dt_vn)
    return dt_vn_tz.astimezone(timezone.utc).replace(tzinfo=None)


def format_datetime_vietnam(dt: Optional[datetime] = None, format_str: str = "%d/%m/%Y %H:%M:%S") -> str:
    """
    Format datetime ở định dạng Việt Nam
    
    Args:
        dt: Datetime object (nếu None sẽ dùng thời gian hiện tại)
        format_str: Định dạng chuỗi (mặc định: dd/mm/yyyy hh:mm:ss)
        
    Returns:
        str: Chuỗi thời gian được format
        
    Examples:
        >>> format_datetime_vietnam()
        '17/11/2025 18:59:31'
        >>> format_datetime_vietnam(custom_date, '%Y-%m-%d')
        '2025-11-17'
    """
    if dt is None:
        dt = get_vietnam_now()
    
    return dt.strftime(format_str)


# Decorator để tự động convert datetime
def use_vietnam_timezone(func):
    """
    Decorator để convert tất cả datetime.utcnow() thành Việt Nam time
    (Optional, cho phát triển sau)
    """
    def wrapper(*args, **kwargs):
        result = func(*args, **kwargs)
        if isinstance(result, datetime):
            return utc_to_vietnam(result)
        return result
    return wrapper
