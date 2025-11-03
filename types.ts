export type MarketType = 'spot' | 'futures';
export type Symbol = 
  'BTCUSDT' | 'ETHUSDT' | 'BNBUSDT' | 'SOLUSDT' | 'ADAUSDT' | 'AVAXUSDT' | 
  'DOTUSDT' | 'TRXUSDT' | 'MATICUSDT' | 'NEARUSDT' | 'ATOMUSDT' | 'FTMUSDT' | 
  'HBARUSDT' | 'ALGOUSDT' | 'XTZUSDT' | 'APTUSDT' | 'SUIUSDT' | 'LINKUSDT' | 
  'UNIUSDT' | 'AAVEUSDT' | 'LDOUSDT' | 'MKRUSDT' | 'GRTUSDT' | 'SNXUSDT' | 
  'CRVUSDT' | 'COMPUSDT' | 'DYDXUSDT' | 'GMXUSDT' | 'CAKEUSDT' | 'RUNEUSDT';
  
export type Interval = '1m' | '5m' | '15m' | '1h' | '4h' | '1d';

export interface Kline {
  t: number; // open time
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
}

export type OrderType = 'limit' | 'market';
export type OrderSide = 'buy' | 'sell';

export interface Order {
  id: string;
  symbol: Symbol;
  price: number;
  quantity: number;
  side: OrderSide;
  type: OrderType;
  timestamp: number;
}

export interface Trade {
  id: string;
  symbol: Symbol;
  price: number;
  quantity: number;
  side: OrderSide;
  timestamp: number;
}

export interface Position {
  id: string;
  symbol: Symbol;
  side: 'LONG' | 'SHORT';
  size: number;
  entryPrice: number;
  markPrice: number;
  leverage: number;
  margin: number;
  unrealizedPnL: number;
  liquidationPrice: number;
  timestamp: number;
  takeProfit?: number;
  stopLoss?: number;
}

export interface TradingState {
  marketType: MarketType;
  symbol: Symbol;
  interval: Interval;
  orders: Order[];
  trades: Trade[];
  positions: Position[];
  balance: number;
  lastPrice: number;
}

export interface TradingContextType extends TradingState {
  setMarketType: (marketType: MarketType) => void;
  setSymbol: (symbol: Symbol) => void;
  setInterval: (interval: Interval) => void;
  placeOrder: (order: Omit<Order, 'id' | 'timestamp'>) => void;
  openPosition: (position: Omit<Position, 'id' | 'timestamp' | 'markPrice' | 'unrealizedPnL'>) => void;
  closePosition: (positionId: string) => void;
  updatePositionTPSL: (positionId: string, takeProfit?: number, stopLoss?: number) => void;
  setLastPrice: (price: number) => void;
}