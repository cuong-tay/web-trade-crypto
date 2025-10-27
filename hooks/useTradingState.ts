import { useState, useCallback } from 'react';
import { MarketType, Symbol, Interval, Order, Trade, Position, OrderSide, OrderType } from '../types';
import { SYMBOLS, INTERVALS } from '../constants';

const generateId = () => Math.random().toString(36).substr(2, 9);

export const useTradingState = () => {
  const [marketType, setMarketType] = useState<MarketType>('spot');
  const [symbol, setSymbol] = useState<Symbol>(SYMBOLS[0]);
  const [interval, setInterval] = useState<Interval>(INTERVALS[2]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [balance, setBalance] = useState(10000); // Start with 10000 USDT
  const [lastPrice, setLastPrice] = useState(0);

  const placeOrder = useCallback((order: { symbol: Symbol; price: number; quantity: number; side: OrderSide; type: OrderType; }) => {
    const newOrder: Order = {
      ...order,
      id: generateId(),
      timestamp: Date.now(),
    };
    setOrders(prev => [newOrder, ...prev]);

    // Simplified trade execution for market orders
    if (order.type === 'market') {
      const newTrade: Trade = {
        id: generateId(),
        symbol: order.symbol,
        price: order.price, // In reality, this would be current market price
        quantity: order.quantity,
        side: order.side,
        timestamp: Date.now(),
      };
      setTrades(prev => [newTrade, ...prev]);

      // Update balance
      const cost = newTrade.price * newTrade.quantity;
      if (newTrade.side === 'buy') {
        setBalance(prev => prev - cost);
      } else {
        setBalance(prev => prev + cost);
      }
      
      // NOTE: Position management is simplified and not fully implemented
    }
  }, []);

  return {
    marketType,
    setMarketType,
    symbol,
    setSymbol,
    interval,
    setInterval,
    orders,
    trades,
    positions,
    balance,
    placeOrder,
    lastPrice,
    setLastPrice,
  };
};
