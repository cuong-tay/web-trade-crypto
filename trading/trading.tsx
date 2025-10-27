import React from 'react';
import ReactDOM from 'react-dom/client';
import { TradingProvider } from '../context/TradingContext';
import TradingModule from './TradingModule';

// Find or create root element
const rootElement = document.querySelector('.trading-container') || document.body;

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

console.log('Trading module initialized with TradingContext Provider');
