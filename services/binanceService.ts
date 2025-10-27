
import { Kline, MarketType, Symbol, Interval } from '../types';
import { MAX_KLINES, SPOT_API_URL, FUTURES_API_URL } from '../constants';

export const fetchInitialKlines = async (
  marketType: MarketType,
  symbol: Symbol,
  interval: Interval
): Promise<Kline[]> => {
  const baseUrl = marketType === 'spot' ? SPOT_API_URL : FUTURES_API_URL;
  const url = `${baseUrl}/klines?symbol=${symbol}&interval=${interval}&limit=${MAX_KLINES}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data: any[] = await response.json();

  return data.map(k => ({
    t: k[0],
    o: parseFloat(k[1]),
    h: parseFloat(k[2]),
    l: parseFloat(k[3]),
    c: parseFloat(k[4]),
    v: parseFloat(k[5]),
  }));
};
