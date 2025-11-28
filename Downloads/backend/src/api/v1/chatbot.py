from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc
from src.config.database import get_db
from src.utils.dependencies import get_current_user
from src.models.user import User
from src.models.chatbot import ChatHistory
from src.schemas.chatbot import (
    ChatMessageRequest, 
    ChatMessageResponse, 
    ChatHistoryResponse,
    ChatHistoryListResponse
)
from src.services.chatbot_service import ChatbotService
from src.utils.timezone import get_vietnam_now
from datetime import datetime
from uuid import uuid4
import logging
import json

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/message", response_model=ChatMessageResponse)
async def send_message(
    request: ChatMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Gửi một tin nhắn đến chatbot và nhận phản hồi.
    
    Logic:
    1. Lưu tin nhắn của người dùng vào chat_history
    2. Gọi đến AI service (Gemini/ChatGPT/Mock)
    3. Nhận phản hồi từ bot
    4. Lưu phản hồi vào chat_history
    5. Trả về cả user message và bot message
    """
    try:
        user_id = str(current_user.id)
        session_id = request.session_id
        user_message = request.message.strip()
        
        # Validate session_id (format: uuid)
        if not session_id:
            raise HTTPException(status_code=400, detail="session_id is required")
        
        logger.info(f"📨 New message from user {user_id}: {user_message[:100]}")
        
        # 1. Lưu tin nhắn của người dùng
        user_msg = ChatHistory(
            id=str(uuid4()),
            user_id=user_id,
            message_type="user",
            content=user_message,
            session_id=session_id,
            created_at=get_vietnam_now()
        )
        db.add(user_msg)
        db.flush()  # Get ID trước khi commit
        
        # 2. Gọi AI service để lấy response (với conversation history)
        bot_response, tokens_used = ChatbotService._openai_response(
            user_message=user_message,
            session_id=session_id,
            user_id=user_id,
            db=db
        )
        
        logger.info(f"🤖 Bot response length: {len(bot_response)}, tokens: {tokens_used}")
        
        # 3. Lưu phản hồi của bot
        bot_msg = ChatHistory(
            id=str(uuid4()),
            user_id=user_id,
            message_type="bot",
            content=bot_response,
            session_id=session_id,
            tokens_used=tokens_used,
            created_at=get_vietnam_now()
        )
        db.add(bot_msg)
        
        # 4. Commit tất cả changes
        db.commit()
        db.refresh(user_msg)
        db.refresh(bot_msg)
        
        logger.info(f"✅ Saved both messages - user_id: {user_id}, session: {session_id}")
        
        # 5. Trả về response sử dụng Pydantic model
        return ChatMessageResponse(
            user_message=ChatHistoryResponse.from_orm(user_msg),
            bot_message=ChatHistoryResponse.from_orm(bot_msg)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in send_message: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error processing message: {str(e)}")


@router.get("/history", response_model=ChatHistoryListResponse)
async def get_chat_history(
    session_id: str = Query(None, description="Session ID để lấy lịch sử chat (nếu None thì lấy tất cả)"),
    page: int = Query(1, ge=1, description="Trang (1-indexed)"),
    page_size: int = Query(50, ge=1, le=100, description="Số lượng message mỗi trang"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lấy lịch sử chat của người dùng theo session_id.
    
    Hỗ trợ:
    - Pagination (page, page_size)
    - Sắp xếp theo thời gian (newest first)
    - Chỉ lấy tin nhắn của user hiện tại
    """
    try:
        user_id = str(current_user.id)
        
        logger.info(f"📖 Getting chat history - user: {user_id}, session: {session_id}, page: {page}")
        
        # Query tổng số messages
        query = db.query(ChatHistory).filter(ChatHistory.user_id == user_id)
        
        if session_id:
            query = query.filter(ChatHistory.session_id == session_id)
        
        total_count = query.count()
        
        # Query messages với pagination (newest first)
        skip = (page - 1) * page_size
        messages = query.order_by(desc(ChatHistory.created_at)).offset(skip).limit(page_size).all()
        
        # Reverse để hiển thị oldest first (natural chat order)
        messages = list(reversed(messages))
        
        total_pages = (total_count + page_size - 1) // page_size
        
        logger.info(f"✅ Retrieved {len(messages)} messages")
        
        return ChatHistoryListResponse(
            session_id=session_id or "all",
            messages=[ChatHistoryResponse.from_orm(msg) for msg in messages],
            total_count=total_count,
            page=page,
            page_size=page_size,
            total_pages=total_pages
        )
        
    except Exception as e:
        logger.error(f"❌ Error in get_chat_history: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error retrieving history: {str(e)}")


@router.delete("/history")
async def clear_chat_history(
    session_id: str = Query(None, description="Session ID để xóa lịch sử chat (nếu None thì xóa tất cả)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Xóa lịch sử chat của một session.
    Chỉ người dùng hiện tại mới có thể xóa chat của họ.
    """
    try:
        user_id = str(current_user.id)
        
        # Xóa tất cả messages của user trong session này
        query = db.query(ChatHistory).filter(ChatHistory.user_id == user_id)
        
        if session_id:
            query = query.filter(ChatHistory.session_id == session_id)
        
        deleted_count = query.delete()
        
        db.commit()
        
        logger.info(f"🗑️  Deleted {deleted_count} messages - user: {user_id}, session: {session_id}")
        
        return {
            "message": "Chat history cleared successfully",
            "deleted_count": deleted_count,
            "session_id": session_id or "all"
        }
        
    except Exception as e:
        logger.error(f"❌ Error in clear_chat_history: {str(e)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error clearing history: {str(e)}")


@router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str, db: Session = Depends(get_db)):
    """
    WebSocket endpoint cho chatbot real-time
    
    Sử dụng: 
    - ws://localhost:8000/api/v1/chatbot/ws/session-123-abc?token=JWT_TOKEN
    - Hoặc header: Authorization: Bearer JWT_TOKEN
    """
    # Extract token từ query parameter hoặc header
    token = None
    
    # Thử lấy từ query string trước
    if "token" in websocket.query_params:
        token = websocket.query_params["token"]
    # Thử lấy từ header
    elif "authorization" in websocket.headers:
        auth_header = websocket.headers["authorization"]
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    
    # Nếu không có token, reject connection
    if not token:
        logger.warning(f"❌ WebSocket connection rejected - no token provided")
        await websocket.close(code=4001, reason="No authentication token provided")
        return
    
    # Xác thực token
    try:
        from src.utils.security import verify_token
        token_data = verify_token(token)
        
        if not token_data:
            logger.warning(f"❌ WebSocket authentication failed - invalid/expired token")
            await websocket.close(code=4002, reason="Invalid or expired token")
            return
            
        user_email = token_data.email
        user_id = token_data.user_id
        
        logger.info(f"✅ WebSocket authenticated - user: {user_email}, session: {session_id}")
    except Exception as e:
        logger.warning(f"❌ WebSocket authentication failed: {str(e)}")
        await websocket.close(code=4002, reason="Invalid or expired token")
        return
    
    # Accept connection
    await websocket.accept()
    logger.info(f"🔌 WebSocket connected - user: {user_id}, session: {session_id}")
    
    try:
        while True:
            # Nhận dữ liệu từ client
            data = await websocket.receive_text()
            logger.info(f"📨 WebSocket received from {user_id}: {data[:100]}")
            
            try:
                import json
                message_data = json.loads(data)
                user_message = message_data.get("message", "")
                
                if not user_message:
                    await websocket.send_text(json.dumps({
                        "error": "Empty message",
                        "status": "error"
                    }))
                    continue
                
                # Gọi AI service để lấy response (với conversation history)
                bot_response, tokens_used = ChatbotService._openai_response(
                    user_message=user_message,
                    session_id=session_id,
                    user_id=user_id,
                    db=db
                )
                
                # Lưu message vào database
                user_msg = ChatHistory(
                    id=str(uuid4()),
                    user_id=user_id,
                    message_type="user",
                    content=user_message,
                    session_id=session_id,
                    created_at=get_vietnam_now()
                )
                db.add(user_msg)
                db.flush()
                
                # Lưu bot response
                bot_msg = ChatHistory(
                    id=str(uuid4()),
                    user_id=user_id,
                    message_type="bot",
                    content=bot_response,
                    session_id=session_id,
                    tokens_used=tokens_used,
                    created_at=get_vietnam_now()
                )
                db.add(bot_msg)
                db.commit()
                
                # Gửi response qua WebSocket
                response = {
                    "type": "chat_response",
                    "user_message": user_message,
                    "bot_response": bot_response,
                    "tokens_used": tokens_used,
                    "timestamp": get_vietnam_now().isoformat(),
                    "status": "success"
                }
                await websocket.send_text(json.dumps(response))
                logger.info(f"✅ WebSocket response sent - tokens: {tokens_used}")
                
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "error": "Invalid JSON format",
                    "status": "error"
                }))
            except Exception as e:
                logger.error(f"❌ Error processing WebSocket message: {str(e)}")
                db.rollback()
                await websocket.send_text(json.dumps({
                    "error": f"Error processing message: {str(e)}",
                    "status": "error"
                }))
            
    except Exception as e:
        logger.error(f"❌ WebSocket error: {str(e)}")
    finally:
        db.close()
        logger.info(f"🔌 WebSocket disconnected - user: {user_id}, session: {session_id}")
