import React from 'react';
import ReactDOM from 'react-dom/client';
import { setupProtectedPage, setupLogoutButton } from '../utils/authGuard';
import ChatbotPanel from '../components/chatbot/ChatbotPanel';

// Chatbot module
(async () => {
  // Setup auth guard first
  const user = setupProtectedPage();
  
  if (!user) {
    console.error('❌ Chatbot requires authentication');
    return;
  }
  
  console.log('🤖 Chatbot loaded for user:', user.username);
  
  // Setup logout button
  setupLogoutButton('#logout-btn');
  
  // Render ChatbotPanel component
  const root = ReactDOM.createRoot(document.getElementById('chatbot-view') as HTMLElement);
  root.render(
    <React.StrictMode>
      <ChatbotPanel />
    </React.StrictMode>
  );
  
  console.log('✅ Chatbot UI rendered successfully');
})();