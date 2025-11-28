import React, { useState, useEffect, useRef } from 'react';
import { ChatbotService, ChatMessage, ChatHistory } from '../../services/chatbotService';

const ChatbotPanel: React.FC = () => {
  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalMessages, setTotalMessages] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize session
  useEffect(() => {
    // Use existing session from localStorage or create new one
    let newSessionId = localStorage.getItem('chatbot_session_id');
    
    if (!newSessionId) {
      newSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('chatbot_session_id', newSessionId);
      console.log('📱 New chat session created:', newSessionId);
    } else {
      console.log('📱 Chat session restored:', newSessionId);
    }
    
    setSessionId(newSessionId);

    // Load initial history for this session
    loadChatHistory(newSessionId);

    // Connect WebSocket
    try {
      const webSocket = ChatbotService.connectWebSocket(
        newSessionId,
        handleWebSocketMessage,
        (error) => {
          console.warn('⚠️ WebSocket error:', error);
          // Don't crash the app - just show a warning
        }
      );
      setWs(webSocket);

      return () => {
        if (webSocket && webSocket.readyState === WebSocket.OPEN) {
          webSocket.close();
        }
      };
    } catch (error) {
      console.warn('⚠️ WebSocket connection failed, using polling mode:', error);
      // App continues to work without WebSocket
    }
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChatHistory = async (sid?: string) => {
    try {
      setLoading(true);
      const sessionToUse = sid || sessionId;
      console.log('📥 Loading chat history for session:', sessionToUse);
      
      const history = await ChatbotService.getChatHistory(currentPage, 10, sessionToUse);
      console.log('📊 Loaded messages:', history.messages.length);
      
      setMessages(history.messages.reverse());
      setTotalMessages(history.total);
    } catch (error) {
      console.error('❌ Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWebSocketMessage = (msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
    console.log('📎 Files selected:', files.map(f => f.name));
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim() && selectedFiles.length === 0) return;

    setLoading(true);
    try {
      console.log('📤 Sending message:', inputValue);
      
      // Build message with file info if present
      let messageContent = inputValue;
      if (selectedFiles.length > 0) {
        const fileNames = selectedFiles.map(f => f.name).join(', ');
        messageContent = `${inputValue}\n\n📎 Files: ${fileNames}`;
      }
      
      const response = await ChatbotService.sendMessage(messageContent, sessionId);
      
      // Add both user and bot messages
      setMessages((prev) => [
        ...prev,
        response.user_message,
        response.bot_message
      ]);
      
      setInputValue('');
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
      alert('Lỗi: ' + (error instanceof Error ? error.message : 'Không thể gửi tin nhắn'));
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!confirm('Bạn chắc chắn muốn xóa toàn bộ lịch sử chat?\n\nHành động này không thể hoàn tác!')) {
      return;
    }

    if (!sessionId || sessionId.trim() === '') {
      alert('❌ Lỗi: Session ID chưa được khởi tạo');
      console.error('Session ID is invalid:', sessionId);
      return;
    }

    try {
      setLoading(true);
      console.log('🗑️ Xóa lịch sử chat cho session:', sessionId);
      
      const result = await ChatbotService.clearChatHistory(sessionId);
      
      console.log('✅ Chat history cleared successfully:', result);
      console.log('📊 Deleted count:', result.deleted_count);
      
      // Clear messages from state immediately
      setMessages([]);
      setTotalMessages(0);
      
      // Show success message
      const successMsg = `✅ Đã xóa ${result.deleted_count} tin nhắn thành công`;
      console.log(successMsg);
      alert(successMsg);
      
      // Clear session from localStorage to create fresh session next time
      localStorage.removeItem('chatbot_session_id');
      console.log('🔄 Session ID cleared from localStorage');
      
    } catch (error) {
      console.error('❌ Error clearing chat history:', error);
      
      // Extract detailed error message
      let errorMsg = 'Không thể xóa lịch sử';
      if (error instanceof Error) {
        errorMsg = error.message;
      } else if (typeof error === 'string') {
        errorMsg = error;
      }
      
      alert('❌ Lỗi xóa lịch sử:\n\n' + errorMsg);
      
    } finally {
      setLoading(false);
    }
  };

  const panelStyle: React.CSSProperties = {
    background: '#ffffff',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
  };

  const headerStyle: React.CSSProperties = {
    padding: '1.5rem',
    borderBottom: '1px solid #e5e7eb',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0
  };

  const messagesContainerStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    backgroundColor: '#fafafa',
    minHeight: 0
  };

  const messageBubbleStyle = (isUser: boolean): React.CSSProperties => ({
    display: 'flex',
    justifyContent: isUser ? 'flex-end' : 'flex-start',
    marginBottom: '0.5rem',
    width: '100%'
  });

  const messageContentStyle = (isUser: boolean): React.CSSProperties => ({
    maxWidth: '100%',
    padding: '0.875rem 1.25rem',
    borderRadius: '18px',
    background: isUser ? '#10a37f' : '#e5e7eb',
    color: isUser ? 'white' : '#333333',
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    whiteSpace: 'pre-wrap',
    fontSize: '0.95rem',
    lineHeight: '1.5',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  });

  const messageTimeStyle: React.CSSProperties = {
    fontSize: '0.8rem',
    color: '#999999',
    marginTop: '0.4rem',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  };

  const footerStyle: React.CSSProperties = {
    padding: '1.5rem',
    borderTop: '1px solid #e5e7eb',
    backgroundColor: '#ffffff',
    flexShrink: 0
  };

  const filePreviewStyle: React.CSSProperties = {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '0.75rem',
    flexWrap: 'wrap'
  };

  const fileChipStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.75rem',
    background: '#f3f4f6',
    borderRadius: '8px',
    fontSize: '0.85rem',
    color: '#374151'
  };

  const inputContainerStyle: React.CSSProperties = {
    display: 'flex',
    gap: '0.75rem',
    alignItems: 'flex-end'
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '0.875rem 1.25rem',
    background: '#f7f7f7',
    border: '1px solid #d1d5db',
    borderRadius: '24px',
    color: '#333333',
    fontSize: '0.95rem',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    outline: 'none',
    transition: 'all 0.2s',
    resize: 'none',
    minHeight: '44px',
    maxHeight: '120px'
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.875rem 1.5rem',
    background: '#10a37f',
    border: 'none',
    borderRadius: '8px',
    color: 'white',
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    flexShrink: 0
  };

  const iconButtonStyle: React.CSSProperties = {
    padding: '0.875rem',
    background: '#f3f4f6',
    border: 'none',
    borderRadius: '8px',
    color: '#374151',
    fontSize: '1.2rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  };

  const deleteButtonStyle: React.CSSProperties = {
    padding: '0.5rem 1rem',
    background: '#ef4444',
    border: 'none',
    borderRadius: '6px',
    color: 'white',
    fontSize: '0.85rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
  };

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div>
          <h3 style={{ margin: 0, color: '#1f2937', fontSize: '1.25rem', fontWeight: 600 }}>
            💬 ChatBot AI
          </h3>
          <span style={{ fontSize: '0.85rem', color: '#9ca3af', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
            {messages.length} tin nhắn
          </span>
        </div>
        <button
          onClick={clearHistory}
          style={deleteButtonStyle}
          title="Xóa lịch sử chat"
          disabled={messages.length === 0 || loading}
          onMouseEnter={(e) => {
            if (!loading) (e.target as HTMLButtonElement).style.background = '#dc2626';
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLButtonElement).style.background = '#ef4444';
          }}
        >
          🗑️ Xóa
        </button>
      </div>

      {/* Messages */}
      <div style={messagesContainerStyle}>
        {messages.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            color: '#9ca3af',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
            <p style={{ fontSize: '1rem', marginBottom: '0.5rem', margin: 0 }}>Chưa có cuộc trò chuyện nào</p>
            <p style={{ fontSize: '0.9rem', margin: 0 }}>Hãy bắt đầu bằng cách đặt một câu hỏi</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} style={messageBubbleStyle(msg.message_type === 'user')}>
              <div style={{ maxWidth: '85%' }}>
                <div style={messageContentStyle(msg.message_type === 'user')}>
                  {msg.message_type === 'bot' && msg.content.includes('<') ? (
                    <div dangerouslySetInnerHTML={{ __html: msg.content }} />
                  ) : (
                    <span>{msg.content}</span>
                  )}
                </div>
                <div style={messageTimeStyle}>
                  {new Date(msg.created_at).toLocaleTimeString()}
                  {msg.tokens_used && (
                    <span> • 📊 {msg.tokens_used.toFixed(1)} tokens</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={footerStyle}>
        {selectedFiles.length > 0 && (
          <div style={filePreviewStyle}>
            {selectedFiles.map((file, index) => (
              <div key={index} style={fileChipStyle}>
                <span>📎 {file.name}</span>
                <button
                  onClick={() => removeFile(index)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    padding: '0',
                    fontSize: '1rem'
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={sendMessage} style={inputContainerStyle}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={iconButtonStyle}
            title="Đính kèm file"
            disabled={loading}
            onMouseEnter={(e) => {
              if (!loading) (e.target as HTMLButtonElement).style.background = '#e5e7eb';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.background = '#f3f4f6';
            }}
          >
            📎
          </button>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Nhập tin nhắn của bạn..."
            style={inputStyle}
            disabled={loading}
            onFocus={(e) => {
              (e.target as HTMLInputElement).style.borderColor = '#10a37f';
              (e.target as HTMLInputElement).style.background = '#ffffff';
            }}
            onBlur={(e) => {
              (e.target as HTMLInputElement).style.borderColor = '#d1d5db';
              (e.target as HTMLInputElement).style.background = '#f7f7f7';
            }}
          />
          <button
            type="submit"
            style={buttonStyle}
            disabled={loading || (!inputValue.trim() && selectedFiles.length === 0)}
            onMouseEnter={(e) => {
              if (!loading && (inputValue.trim() || selectedFiles.length > 0)) {
                (e.target as HTMLButtonElement).style.background = '#088661';
              }
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.background = '#10a37f';
            }}
          >
            {loading ? '⏳' : '➤'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatbotPanel;
