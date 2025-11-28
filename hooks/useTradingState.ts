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
  const [lastChartTime, setLastChartTime] = useState<number>(0); // Thời gian từ chart WebSocket

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

      // Update balance (chỉ cho Spot)
      const cost = newTrade.price * newTrade.quantity;
      if (newTrade.side === 'buy') {
        setBalance(prev => prev - cost);
      } else {
        setBalance(prev => prev + cost);
      }
    }
  }, []);

  const openPosition = useCallback((position: Omit<Position, 'id' | 'timestamp' | 'markPrice' | 'unrealizedPnL'>) => {
    const newPosition: Position = {
      ...position,
      id: generateId(),
      timestamp: Date.now(),
      markPrice: position.entryPrice, // Initialize with entry price
      unrealizedPnL: 0, // Start with 0 PnL
    };
    setPositions(prev => [...prev, newPosition]);
  }, []);

  const closePosition = useCallback((positionId: string) => {
    setPositions(prev => prev.filter(p => p.id !== positionId));
  }, []);

  const updatePositionTPSL = useCallback((positionId: string, takeProfit?: number, stopLoss?: number) => {
    setPositions(prev => prev.map(p => 
      p.id === positionId 
        ? { ...p, takeProfit, stopLoss }
        : p
    ));
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
    openPosition,
    closePosition,
    updatePositionTPSL,
    lastPrice,
    setLastPrice,
    lastChartTime,
    setLastChartTime,
  };
};
