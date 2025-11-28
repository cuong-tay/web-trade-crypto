import React from 'react';
import ReactDOM from 'react-dom/client';
import { TradingProvider } from '../context/TradingContext';
import TradingModule from './TradingModule';
import { setupProtectedPage, setupLogoutButton } from '../utils/authGuard';
import { checkAndShowBannedStatus } from '../utils/bannedUserHandler';

// Initialize trading module
(async () => {
  // Auth guard first
  const user = setupProtectedPage();
  
  if (!user) {
    console.error('❌ Trading module requires authentication');
    return;
  }
  
  console.log('💹 Trading module loaded for user:', user.username);

  // Check if user is banned and show banner
  const isBanned = await checkAndShowBannedStatus();
  if (isBanned) {
    console.warn('⛔ User is banned - Trading functions will be disabled');
  }

  // Setup logout button
  setupLogoutButton('#logout-btn');

  // Find root element - try trading-container first, then chart-section
  let rootElement = document.querySelector('.trading-container');
  if (!rootElement) {
    rootElement = document.querySelector('#chart-section');
  }
  if (!rootElement) {
    rootElement = document.querySelector('main');
  }
  if (!rootElement) {
    console.error('❌ Cannot find root element for trading module');
    return;
  }

  console.log('🎯 Root element found:', rootElement);

  // Create React root
  const root = ReactDOM.createRoot(rootElement);

  // Render with TradingContext Provider
  root.render(
    <React.StrictMode>
      <TradingProvider>
        <TradingModule />
      </TradingProvider>
    </React.StrictMode>
  );

  console.log('✅ Trading module initialized with TradingContext Provider');
})();
