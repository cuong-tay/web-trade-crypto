import { API_BASE_URL } from '../config/api';

export interface ChatMessage {
  id: string;
  user_id?: string;
  message_type: 'user' | 'bot';
  content: string;
  session_id: string;
  tokens_used?: number;
  created_at: string;
}

export interface ChatResponse {
  user_message: ChatMessage;
  bot_message: ChatMessage;
}

export interface ChatHistory {
  messages: ChatMessage[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export class ChatbotService {
  private static reconnectAttempts = 0;
  private static maxReconnectAttempts = 5;
  private static reconnectDelay = 3000; // 3 seconds

  /**
   * Gửi tin nhắn đến chatbot
   */
  static async sendMessage(message: string, session_id?: string): Promise<ChatResponse> {
    try {
      const token = localStorage.getItem('access_token');
      
      if (!token) {
        throw new Error('Không có token xác thực');
      }

      const response = await fetch(`${API_BASE_URL}/chatbot/message`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          session_id: session_id || undefined
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Lỗi gửi tin nhắn');
      }

      const data = await response.json();
      console.log('✅ Message sent:', data);
      return data;
    } catch (error) {
      console.error('❌ Error sending message:', error);
      throw error;
    }
  }

  /**
   * Lấy lịch sử chat
   */
  static async getChatHistory(page: number = 1, page_size: number = 10, session_id?: string): Promise<ChatHistory> {
    try {
      const token = localStorage.getItem('access_token');
      
      if (!token) {
        throw new Error('Không có token xác thực');
      }

      const params = new URLSearchParams({
        page: page.toString(),
        page_size: page_size.toString(),
      });

      if (session_id) {
        params.append('session_id', session_id);
      }

      const response = await fetch(`${API_BASE_URL}/chatbot/history?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Lỗi lấy lịch sử');
      }

      const data = await response.json();
      console.log('✅ Chat history fetched:', data);
      return data;
    } catch (error) {
      console.error('❌ Error fetching chat history:', error);
      throw error;
    }
  }

  /**
   * Xóa lịch sử chat
   */
  static async clearChatHistory(session_id: string): Promise<{ message: string; deleted_count: number }> {
    try {
      const token = localStorage.getItem('access_token');
      
      if (!token) {
        throw new Error('Không có token xác thực');
      }

      if (!session_id || session_id.trim() === '') {
        throw new Error('Session ID không hợp lệ');
      }

      console.log('🗑️ Clearing chat history for session:', session_id);

      // DELETE request with session_id in query string
      const response = await fetch(`${API_BASE_URL}/chatbot/history?session_id=${encodeURIComponent(session_id)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📡 Delete response status:', response.status);

      if (!response.ok) {
        try {
          const error = await response.json();
          throw new Error(error.message || `HTTP ${response.status}: Lỗi xóa lịch sử`);
        } catch (e) {
          throw new Error(`HTTP ${response.status}: Không thể xóa lịch sử chat`);
        }
      }

      const data = await response.json();
      console.log('✅ Chat history cleared successfully:', data);
      return data;
    } catch (error) {
      console.error('❌ Error clearing chat history:', error);
      throw error;
    }
  }

  /**
   * Kết nối WebSocket cho real-time chat
   */
  static connectWebSocket(session_id: string, onMessage: (msg: ChatMessage) => void, onError: (error: string) => void): WebSocket {
    try {
      const token = localStorage.getItem('access_token');
      
      if (!token) {
        console.error('❌ No token available for WebSocket connection');
        onError('Không có token xác thực');
        return {
          close: () => {},
          send: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          readyState: 3,
        } as unknown as WebSocket;
      }

      // Build WebSocket URL - remove /api/v1/ and use /api/
      const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/chatbot/ws/${session_id}?token=${token}`;
      console.log('🔗 Attempting WebSocket connection to:', wsUrl);
      
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket connected successfully:', session_id);
        this.reconnectAttempts = 0; // Reset on successful connection
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          console.log('📨 WebSocket message received:', msg);
          onMessage(msg);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
          console.log('Raw message:', event.data);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error occurred:', error);
        console.warn('⚠️ WebSocket connection failed. Falling back to HTTP polling.');
        onError('Lỗi kết nối WebSocket - chế độ polling');
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        // Attempt to reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          console.warn(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${this.reconnectDelay}ms`);
          setTimeout(() => {
            this.connectWebSocket(session_id, onMessage, onError);
          }, this.reconnectDelay);
        } else {
          console.error('❌ Max reconnection attempts reached');
          onError('Kết nối WebSocket bị mất, hãy làm mới trang');
        }
      };

      return ws;
    } catch (error) {
      console.error('❌ Error connecting WebSocket:', error);
      onError('Lỗi kết nối WebSocket');
      return {
        close: () => {},
        send: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        readyState: 3,
      } as unknown as WebSocket;
    }
  }
}
