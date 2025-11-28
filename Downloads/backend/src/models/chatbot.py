from sqlalchemy import Column, String, DateTime, Numeric, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from uuid import uuid4
from src.config.database import Base
from src.utils.timezone import get_vietnam_now


class ChatHistory(Base):
    """Bảng lưu lịch sử trò chuyện chatbot"""
    __tablename__ = "chat_history"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    
    # Loại message: "user" hoặc "bot"
    message_type = Column(String(10), nullable=False)  # user | bot
    
    # Nội dung message
    content = Column(Text, nullable=False)
    
    # Session ID để nhóm các cuộc trò chuyện
    session_id = Column(String(60), nullable=False, index=True)
    
    # Tokens sử dụng (nếu tích hợp OpenAI)
    tokens_used = Column(Numeric(10, 2), nullable=True, default=0)
    
    # Timestamp
    created_at = Column(DateTime, nullable=False, default=get_vietnam_now, index=True)
    
    # Relationship
    user = relationship("User", back_populates="chat_histories")

    def __repr__(self):
        return f"<ChatHistory(id={self.id}, user_id={self.user_id}, type={self.message_type}, session={self.session_id})>"
