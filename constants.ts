import { Symbol, Interval } from './types';

export const SPOT_API_URL = 'https://api.binance.com/api/v3';
export const FUTURES_API_URL = 'https://fapi.binance.com/fapi/v1';

export const SPOT_WS_URL = 'wss://stream.binance.com:9443/ws';
export const FUTURES_WS_URL = 'wss://fstream.binance.com/ws';


export const MAX_KLINES = 800;

export const SYMBOLS: Symbol[] = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'ADAUSDT', 'AVAXUSDT', 
  'DOTUSDT', 'TRXUSDT', 'MATICUSDT', 'NEARUSDT', 'ATOMUSDT', 'FTMUSDT', 
  'HBARUSDT', 'ALGOUSDT', 'XTZUSDT', 'APTUSDT', 'SUIUSDT', 'LINKUSDT', 
  'UNIUSDT', 'AAVEUSDT', 'LDOUSDT', 'MKRUSDT', 'GRTUSDT', 'SNXUSDT', 
  'CRVUSDT', 'COMPUSDT', 'DYDXUSDT', 'GMXUSDT', 'CAKEUSDT', 'RUNEUSDT'
];
export const INTERVALS: Interval[] = ['1m', '5m', '15m', '1h', '4h', '1d'];