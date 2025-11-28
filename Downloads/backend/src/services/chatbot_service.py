"""
Chatbot Service - Xử lý AI integration
Hỗ trợ: OpenAI GPT-4o-mini (primary), Mock AI (fallback)
"""

import os
from typing import Optional
from decimal import Decimal
import logging

logger = logging.getLogger(__name__)


class ChatbotService:
    """Service xử lý chatbot AI"""
    
    # Đọc từ settings
    @staticmethod
    def _get_settings():
        from src.config.settings import get_settings
        return get_settings()
    
    # Danh sách câu hỏi thường gặp (FAQ)
    FAQ = {
        "bitcoin": "Bitcoin là loại tiền điện tử đầu tiên được tạo ra vào năm 2009 bởi một người hoặc nhóm người dùng bút danh Satoshi Nakamoto. Bitcoin sử dụng công nghệ blockchain để ghi lại các giao dịch.",
        "ethereum": "Ethereum là một nền tảng blockchain cho phép người dùng xây dựng các ứng dụng phi tập trung (dApps). Ethereum được tạo ra vào năm 2015 bởi Vitalik Buterin.",
        "trading": "Giao dịch tiền điện tử liên quan đến việc mua và bán các loại tiền điện tử khác nhau để kiếm lợi nhuận từ sự thay đổi giá.",
        "wallet": "Ví tiền điện tử là một chương trình phần mềm lưu trữ các khóa công khai và khóa riêng của bạn, cho phép bạn gửi và nhận tiền điện tử.",
        "fee": "Phí giao dịch là một khoản phí được trích từ mỗi giao dịch tiền điện tử. Phí này được sử dụng để trả thù công cho những người khai thác hoặc xác thực giao dịch.",
        "security": "Để bảo mật ví tiền điện tử của bạn, hãy: 1. Sử dụng mật khẩu mạnh 2. Kích hoạt xác thực 2 yếu tố 3. Không chia sẻ khóa riêng của bạn 4. Cập nhật phần mềm thường xuyên.",
        "bảo vệ": "Để bảo mật ví tiền điện tử của bạn, hãy: 1. Sử dụng mật khẩu mạnh 2. Kích hoạt xác thực 2 yếu tố 3. Không chia sẻ khóa riêng của bạn 4. Cập nhật phần mềm thường xuyên.",
        "kiếm tiền": "Có nhiều cách kiếm tiền từ crypto: 1. Giao dịch (trading) - mua thấp, bán cao 2. Holding - nắm giữ dài hạn 3. Staking - khóa tiền và nhận lãi 4. Lending - cho vay crypto 5. Mining - khai thác coin.",
    }
    
    @staticmethod
    def get_ai_response(user_message: str) -> tuple[str, Optional[float]]:
        """
        Lấy response từ AI service
        
        Args:
            user_message: Tin nhắn từ người dùng
            
        Returns:
            tuple: (bot_response, tokens_used)
        """
        settings = ChatbotService._get_settings()
        provider = settings.ai_provider.lower()
        
        logger.info(f"📨 Using AI provider: {provider}")
        
        if provider == "openai":
            return ChatbotService._openai_response(user_message)
        else:  # mock
            return ChatbotService._mock_response(user_message)
    
    @staticmethod
    def _mock_response(user_message: str) -> tuple[str, Optional[float]]:
        """Mock AI response cho testing"""
        message_lower = user_message.lower()
        
        # Kiểm tra lời chào
        greeting_keywords = ["xin chào", "chào", "hello", "hi", "chào bạn"]
        if any(keyword in message_lower for keyword in greeting_keywords):
            greeting_response = (
                "Chào bạn! Tôi là trợ lý AI của CTrading, sẵn sàng hỗ trợ bạn. "
                "Rất vui được nói chuyện với bạn! Bạn có bất kỳ câu hỏi nào về "
                "tiền điện tử, giao dịch, ví, bảo mật hay bất cứ điều gì khác "
                "liên quan đến CTrading không? Đừng ngần ngại hỏi nhé!"
            )
            logger.info("✅ Found greeting match")
            return (greeting_response, 18.0)
        
        # Kiểm tra FAQ
        for keyword, answer in ChatbotService.FAQ.items():
            if keyword in message_lower:
                logger.info(f"✅ Found FAQ match for: {keyword}")
                return (answer, 15.5)
        
        # Default response
        default_response = (
            "Xin lỗi, tôi không thể trả lời câu hỏi này. "
            "Vui lòng liên hệ với bộ phận hỗ trợ khách hàng để được giúp đỡ. "
            "Hoặc bạn có thể hỏi tôi về: Bitcoin, Ethereum, Trading, Wallet, Fee, Security."
        )
        logger.info("Using default mock response")
        return (default_response, 12.0)
    
    @staticmethod
    def _openai_response(user_message: str, session_id: Optional[str] = None, user_id: Optional[str] = None, db = None) -> tuple[str, Optional[float]]:
        """Call OpenAI API với conversation history"""
        try:
            from openai import OpenAI  # type: ignore
            from openai.types.chat import ChatCompletionMessageParam  # type: ignore
            
            settings = ChatbotService._get_settings()
            api_key = settings.openai_api_key
            
            if not api_key:
                logger.warning("OpenAI API key not configured, falling back to mock")
                return ChatbotService._mock_response(user_message)
            
            # Initialize OpenAI client
            client = OpenAI(api_key=api_key)
            
            # System prompt cho chatbot
            system_prompt = """Bạn là trợ lý AI chuyên nghiệp và thân thiện của CTrading - nền tảng giao dịch tiền điện tử hàng đầu.

Nhiệm vụ:
- Trả lời trực tiếp các câu hỏi về tiền điện tử, blockchain, giao dịch, ví, bảo mật
- Giải thích các khái niệm phức tạp một cách đơn giản, dễ hiểu
- Đưa ra lời khuyên đầu tư thận trọng, có căn cứ
- Sử dụng tiếng Việt chuẩn, rõ ràng
- Duy trì continuity trong cuộc trò chuyện - tham khảo context trước đó

Lưu ý quan trọng:
- Trả lời TRỰ TIẾP nội dung người dùng hỏi, không cần chào lại mỗi lần
- Nếu không chắc chắn, hãy thừa nhận và đề xuất liên hệ support
- Không đưa ra lời khuyên đầu tư chắc chắn 100%
- Luôn nhắc nhở về rủi ro khi giao dịch crypto
- Trả lời NGẮN GỌN, rõ ràng"""
            
            # Xây dựng messages list từ conversation history
            messages: list[ChatCompletionMessageParam] = [{"role": "system", "content": system_prompt}]  # type: ignore
            
            # Nếu có database và session_id, lấy lịch sử chat
            if db and session_id and user_id:
                from sqlalchemy import desc
                from src.models.chatbot import ChatHistory
                
                # Lấy 10 message gần nhất từ session
                history = db.query(ChatHistory)\
                    .filter(ChatHistory.user_id == user_id, ChatHistory.session_id == session_id)\
                    .order_by(desc(ChatHistory.created_at))\
                    .limit(20)\
                    .all()
                
                # Reverse để có order đúng (oldest first)
                history = list(reversed(history))
                
                logger.info(f"📜 Loaded {len(history)} messages from chat history")
                
                # Thêm history vào messages
                for msg in history:
                    if msg.message_type == "user":
                        messages.append({"role": "user", "content": msg.content})  # type: ignore
                    else:
                        messages.append({"role": "assistant", "content": msg.content})  # type: ignore
            
            # Thêm message hiện tại
            messages.append({"role": "user", "content": user_message})  # type: ignore
            
            # Gọi OpenAI API với conversation history
            response = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,  # type: ignore
                temperature=0.6,
                max_tokens=400,
                top_p=0.9,
                frequency_penalty=0.0,
                presence_penalty=0.0
            )
            
            bot_response = response.choices[0].message.content or ""
            
            # Xóa "Chào bạn!" ở đầu response nếu có
            bot_response = bot_response.strip()
            if bot_response.startswith("Chào bạn!"):
                bot_response = bot_response.replace("Chào bạn!", "").strip()
            if bot_response.startswith("Chào bạn "):
                bot_response = bot_response.replace("Chào bạn ", "").strip()
            
            tokens_used = float(response.usage.total_tokens) if response.usage else 0.0
            
            logger.info(f"✅ OpenAI response ({tokens_used} tokens): {bot_response[:100]}...")
            return (bot_response, tokens_used)
            
        except ImportError:
            logger.error("❌ OpenAI package not installed. Run: pip install openai")
            return ChatbotService._mock_response(user_message)
        except Exception as e:
            logger.error(f"❌ OpenAI API error: {str(e)}")
            # Fallback to Mock if OpenAI fails
            logger.info("Falling back to Mock response...")
            return ChatbotService._mock_response(user_message)


def calculate_tokens(text: str) -> float:
    """
    Tính toán số tokens (xấp xỉ)
    1 token ≈ 4 ký tự cho tiếng Anh
    """
    # Rough estimate: 1 token = 4 characters
    return len(text) / 4.0
