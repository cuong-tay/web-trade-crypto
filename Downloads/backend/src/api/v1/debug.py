"""
Endpoint để debug upload và list files
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from src.config.database import get_db
from src.models.user import User
from src.utils.dependencies import get_current_user
import os
from pathlib import Path

router = APIRouter()

@router.get("/me/uploads/debug")
async def debug_uploads(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Debug endpoint để kiểm tra uploads của user
    """
    # Get project root directory (go up 3 levels from this file)
    project_root = Path(__file__).parent.parent.parent.parent
    uploads_dir = project_root / "uploads"
    
    avatars = []
    covers = []
    
    # List avatars
    avatar_dir = uploads_dir / "avatars"
    if avatar_dir.exists():
        for f in avatar_dir.iterdir():
            if f.is_file() and str(current_user.id) in f.name:
                avatars.append({
                    "name": f.name,
                    "size": f.stat().st_size,
                    "mtime": f.stat().st_mtime,
                    "path": f"/uploads/avatars/{f.name}"
                })
    
    # List covers
    cover_dir = uploads_dir / "covers"
    if cover_dir.exists():
        for f in cover_dir.iterdir():
            if f.is_file() and str(current_user.id) in f.name:
                covers.append({
                    "name": f.name,
                    "size": f.stat().st_size,
                    "mtime": f.stat().st_mtime,
                    "path": f"/uploads/covers/{f.name}"
                })
    
    return {
        "user_id": str(current_user.id),
        "avatars": avatars,
        "covers": covers,
        "uploads_dir": str(uploads_dir),
        "avatar_dir": str(avatar_dir),
        "cover_dir": str(cover_dir),
        "avatar_dir_exists": avatar_dir.exists(),
        "cover_dir_exists": cover_dir.exists()
    }
