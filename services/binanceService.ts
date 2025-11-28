

import { Kline, MarketType, Symbol, Interval } from '../types';
import { MAX_KLINES, SPOT_API_URL, FUTURES_API_URL } from '../constants';

export const fetchInitialKlines = async (
  marketType: MarketType,
  symbol: Symbol,
  interval: Interval,
  retries = 3
): Promise<Kline[]> => {
  const baseUrl = marketType === 'spot' ? SPOT_API_URL : FUTURES_API_URL;
  const url = `${baseUrl}/klines?symbol=${symbol}&interval=${interval}&limit=${MAX_KLINES}`;
  
  console.log(`🔄 Fetching klines from: ${url}`);
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: any[] = await response.json();
      
      console.log(`✅ Successfully fetched ${data.length} klines on attempt ${attempt}`);

      return data.map(k => ({
        t: k[0],
        o: parseFloat(k[1]),
        h: parseFloat(k[2]),
        l: parseFloat(k[3]),
        c: parseFloat(k[4]),
        v: parseFloat(k[5]),
      }));
    } catch (error) {
      console.warn(`⚠️ Attempt ${attempt}/${retries} failed:`, error);
      if (attempt === retries) {
        console.error(`❌ Failed to fetch klines after ${retries} attempts`);
        throw error;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  throw new Error('Failed to fetch klines');
};
