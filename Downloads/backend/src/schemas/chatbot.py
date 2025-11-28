from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


class ChatMessageRequest(BaseModel):
    """Request body cho POST /api/chatbot/message"""
    message: str = Field(..., min_length=1, max_length=2000, description="Nội dung tin nhắn")
    session_id: str = Field(..., description="Session ID để nhóm các cuộc trò chuyện")
    
    class Config:
        json_schema_extra = {
            "example": {
                "message": "Giá Bitcoin hiện tại là bao nhiêu?",
                "session_id": "session-123-abc"
            }
        }


class ChatHistoryResponse(BaseModel):
    """Response cho mỗi message trong chat history"""
    id: str
    user_id: str
    message_type: str  # "user" | "bot"
    content: str
    session_id: str
    tokens_used: Optional[float] = None
    created_at: datetime
    
    class Config:
        from_attributes = True
        json_schema_extra = {
            "example": {
                "id": "msg-123",
                "user_id": "user-123",
                "message_type": "user",
                "content": "Giá Bitcoin hiện tại là bao nhiêu?",
                "session_id": "session-123-abc",
                "tokens_used": 12.5,
                "created_at": "2025-11-17T10:30:00"
            }
        }


class ChatMessageResponse(BaseModel):
    """Response cho POST /api/chatbot/message"""
    user_message: ChatHistoryResponse
    bot_message: ChatHistoryResponse
    
    class Config:
        json_schema_extra = {
            "example": {
                "user_message": {
                    "id": "msg-user-1",
                    "user_id": "user-123",
                    "message_type": "user",
                    "content": "Bitcoin giờ bao nhiêu tiền?",
                    "session_id": "session-123-abc",
                    "tokens_used": None,
                    "created_at": "2025-11-17T10:30:00"
                },
                "bot_message": {
                    "id": "msg-bot-1",
                    "user_id": "user-123",
                    "message_type": "bot",
                    "content": "Theo thông tin mới nhất, Bitcoin hiện đang giao dịch ở mức $45,000 USD...",
                    "session_id": "session-123-abc",
                    "tokens_used": 25.5,
                    "created_at": "2025-11-17T10:30:05"
                }
            }
        }


class ChatHistoryListResponse(BaseModel):
    """Response cho GET /api/chatbot/history"""
    session_id: str
    messages: List[ChatHistoryResponse]
    total_count: int
    page: int
    page_size: int
    total_pages: int
    
    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "session-123-abc",
                "messages": [
                    {
                        "id": "msg-user-1",
                        "user_id": "user-123",
                        "message_type": "user",
                        "content": "Bitcoin giờ bao nhiêu tiền?",
                        "session_id": "session-123-abc",
                        "tokens_used": None,
                        "created_at": "2025-11-17T10:30:00"
                    },
                    {
                        "id": "msg-bot-1",
                        "user_id": "user-123",
                        "message_type": "bot",
                        "content": "Theo thông tin mới nhất, Bitcoin hiện đang giao dịch ở mức $45,000 USD...",
                        "session_id": "session-123-abc",
                        "tokens_used": 25.5,
                        "created_at": "2025-11-17T10:30:05"
                    }
                ],
                "total_count": 2,
                "page": 1,
                "page_size": 50,
                "total_pages": 1
            }
        }


class ChatSessionResponse(BaseModel):
    """Response cho danh sách tất cả chat sessions"""
    session_id: str
    last_message: str
    message_count: int
    created_at: datetime
    last_updated: datetime
    
    class Config:
        from_attributes = True
