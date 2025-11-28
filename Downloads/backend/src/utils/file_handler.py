"""
File handling utilities for avatar and cover uploads
"""

import os
import uuid
from pathlib import Path
from datetime import datetime
from fastapi import HTTPException, status

# Configuration - Use absolute path from project root
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
UPLOAD_DIR = os.path.join(PROJECT_ROOT, "uploads")
AVATAR_DIR = os.path.join(UPLOAD_DIR, "avatars")
COVER_DIR = os.path.join(UPLOAD_DIR, "covers")

# Allowed extensions
ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

# Create directories if not exist
for directory in [AVATAR_DIR, COVER_DIR]:
    Path(directory).mkdir(parents=True, exist_ok=True)


def validate_image_file(filename: str, file_size: int) -> bool:
    """
    Validate image file
    
    Args:
        filename: Tên file
        file_size: Kích thước file (bytes)
    
    Returns:
        bool: True nếu file hợp lệ
    """
    # Check extension
    file_ext = os.path.splitext(filename)[1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Định dạng file không được hỗ trợ. Các định dạng được phép: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Check file size
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Kích thước file quá lớn. Tối đa: {MAX_FILE_SIZE / 1024 / 1024}MB"
        )
    
    return True


async def save_avatar(file_content: bytes, user_id: str, original_filename: str) -> str:
    """
    Save avatar image
    
    Args:
        file_content: Nội dung file
        user_id: ID của user
        original_filename: Tên file gốc
    
    Returns:
        str: Đường dẫn file đã lưu (relative path)
    """
    # Validate
    validate_image_file(original_filename, len(file_content))
    
    # Generate unique filename
    file_ext = os.path.splitext(original_filename)[1].lower()
    filename = f"{user_id}_{int(datetime.now().timestamp())}{file_ext}"
    
    # Full path
    filepath = os.path.join(AVATAR_DIR, filename)
    
    # Save file
    try:
        with open(filepath, 'wb') as f:
            f.write(file_content)
        
        # Return relative path for storing in DB
        return f"/uploads/avatars/{filename}"
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi lưu file: {str(e)}"
        )


async def save_cover(file_content: bytes, user_id: str, original_filename: str) -> str:
    """
    Save cover image
    
    Args:
        file_content: Nội dung file
        user_id: ID của user
        original_filename: Tên file gốc
    
    Returns:
        str: Đường dẫn file đã lưu (relative path)
    """
    # Validate
    validate_image_file(original_filename, len(file_content))
    
    # Generate unique filename
    file_ext = os.path.splitext(original_filename)[1].lower()
    filename = f"{user_id}_cover_{int(datetime.now().timestamp())}{file_ext}"
    
    # Full path
    filepath = os.path.join(COVER_DIR, filename)
    
    # Save file
    try:
        with open(filepath, 'wb') as f:
            f.write(file_content)
        
        # Return relative path for storing in DB
        return f"/uploads/covers/{filename}"
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi khi lưu file: {str(e)}"
        )


def delete_avatar(avatar_path: str) -> bool:
    """Delete old avatar file"""
    if not avatar_path:
        return False
    
    try:
        # Convert URL path to file path
        file_path = avatar_path.replace('/uploads/avatars/', '')
        full_path = os.path.join(AVATAR_DIR, file_path)
        
        if os.path.exists(full_path):
            os.remove(full_path)
            return True
    except Exception as e:
        print(f"Warning: Could not delete avatar: {str(e)}")
    
    return False


def delete_cover(cover_path: str) -> bool:
    """Delete old cover file"""
    if not cover_path:
        return False
    
    try:
        # Convert URL path to file path
        file_path = cover_path.replace('/uploads/covers/', '')
        full_path = os.path.join(COVER_DIR, file_path)
        
        if os.path.exists(full_path):
            os.remove(full_path)
            return True
    except Exception as e:
        print(f"Warning: Could not delete cover: {str(e)}")
    
    return False
