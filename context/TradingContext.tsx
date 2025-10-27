
import React, { createContext, useContext, ReactNode } from 'react';
import { useTradingState } from '../hooks/useTradingState';
import { TradingContextType } from '../types';

const TradingContext = createContext<TradingContextType | undefined>(undefined);

export const TradingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const tradingState = useTradingState();
  return (
    <TradingContext.Provider value={tradingState}>
      {children}
    </TradingContext.Provider>
  );
};

export const useTradingContext = (): TradingContextType => {
  const context = useContext(TradingContext);
  if (!context) {
    throw new Error('useTradingContext must be used within a TradingProvider');
  }
  return context;
};
