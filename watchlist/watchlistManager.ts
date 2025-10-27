// Watchlist Manager - Quản lý danh sách theo dõi coin

interface WatchlistCoin {
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  volume24h: number;
  marketCap?: number;
  addedAt: number;
}

// LocalStorage key
const WATCHLIST_KEY = 'crypto_watchlist';

// Get watchlist from localStorage
export function getWatchlist(): string[] {
  const data = localStorage.getItem(WATCHLIST_KEY);
  return data ? JSON.parse(data) : [];
}

// Save watchlist to localStorage
export function saveWatchlist(symbols: string[]): void {
  localStorage.setItem(WATCHLIST_KEY, JSON.stringify(symbols));
  
  // Dispatch custom event để các trang khác biết watchlist đã thay đổi
  window.dispatchEvent(new CustomEvent('watchlistUpdated', { 
    detail: { symbols } 
  }));
}

// Add coin to watchlist
export function addToWatchlist(symbol: string): boolean {
  const watchlist = getWatchlist();
  
  if (watchlist.includes(symbol)) {
    console.log(`${symbol} đã có trong watchlist`);
    return false;
  }
  
  watchlist.push(symbol);
  saveWatchlist(watchlist);
  console.log(`Đã thêm ${symbol} vào watchlist`);
  return true;
}

// Remove coin from watchlist
export function removeFromWatchlist(symbol: string): boolean {
  const watchlist = getWatchlist();
  const index = watchlist.indexOf(symbol);
  
  if (index === -1) {
    console.log(`${symbol} không có trong watchlist`);
    return false;
  }
  
  watchlist.splice(index, 1);
  saveWatchlist(watchlist);
  console.log(`Đã xóa ${symbol} khỏi watchlist`);
  return true;
}

// Check if coin is in watchlist
export function isInWatchlist(symbol: string): boolean {
  return getWatchlist().includes(symbol);
}

// Toggle coin in watchlist
export function toggleWatchlist(symbol: string): boolean {
  if (isInWatchlist(symbol)) {
    return removeFromWatchlist(symbol);
  } else {
    return addToWatchlist(symbol);
  }
}

// Fetch coin data from Binance API
export async function fetchWatchlistData(): Promise<WatchlistCoin[]> {
  const symbols = getWatchlist();
  
  if (symbols.length === 0) {
    return [];
  }
  
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/24hr');
    const data = await response.json();
    
    const watchlistData: WatchlistCoin[] = symbols
      .map(symbol => {
        const ticker = data.find((t: any) => t.symbol === symbol);
        
        if (!ticker) return null;
        
        return {
          symbol: ticker.symbol,
          name: ticker.symbol.replace('USDT', ''),
          price: parseFloat(ticker.lastPrice),
          priceChange24h: parseFloat(ticker.priceChange),
          priceChangePercent24h: parseFloat(ticker.priceChangePercent),
          volume24h: parseFloat(ticker.volume),
          marketCap: parseFloat(ticker.quoteVolume),
          addedAt: Date.now(),
        };
      })
      .filter(coin => coin !== null) as WatchlistCoin[];
    
    return watchlistData;
  } catch (error) {
    console.error('Lỗi khi fetch dữ liệu watchlist:', error);
    return [];
  }
}

// Export notification helper
export function showNotification(message: string, type: 'success' | 'error' = 'success'): void {
  const notification = document.createElement('div');
  const bgColor = type === 'success' ? '#30D475' : '#ff4757';
  
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: ${bgColor};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-weight: 600;
    animation: slideIn 0.3s ease-out;
  `;
  
  notification.innerHTML = `
    <i class="fa-solid fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
    ${message}
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
