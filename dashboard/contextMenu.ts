import { addToWatchlist, isInWatchlist, showNotification } from '../watchlist/watchlistManager';

// Context Menu Handler
export function initWatchlistContextMenu() {
  const contextMenu = document.getElementById('coinContextMenu');
  
  if (!contextMenu) return;
  
  // Handle context menu item clicks
  contextMenu.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const menuItem = target.closest('.context-menu-item') as HTMLElement;
    
    if (!menuItem) return;
    
    const action = menuItem.getAttribute('data-action');
    const symbol = contextMenu.getAttribute('data-symbol');
    
    if (!symbol) return;
    
    if (action === 'watchlist') {
      handleWatchlistAction(symbol);
    } else if (action === 'trade') {
      window.location.href = `trading.html?symbol=${symbol}`;
    }
    
    // Close context menu
    contextMenu.classList.remove('show');
  });
  
  // Close context menu on outside click
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    
    if (!target.closest('.coin-context-menu') && !target.closest('[data-coin-symbol]')) {
      contextMenu.classList.remove('show');
    }
  });
}

// Handle watchlist action
function handleWatchlistAction(symbol: string) {
  const inWatchlist = isInWatchlist(symbol);
  
  if (inWatchlist) {
    showNotification(`${symbol} đã có trong danh sách theo dõi`, 'error');
  } else {
    const success = addToWatchlist(symbol);
    
    if (success) {
      showNotification(`Đã thêm ${symbol} vào danh sách theo dõi`, 'success');
      updateWatchlistIcon(symbol, true);
    }
  }
}

// Update watchlist icon
function updateWatchlistIcon(symbol: string, isWatched: boolean) {
  const contextMenu = document.getElementById('coinContextMenu');
  if (!contextMenu) return;
  
  const watchlistItem = contextMenu.querySelector('[data-action="watchlist"]');
  if (!watchlistItem) return;
  
  const icon = watchlistItem.querySelector('i');
  const span = watchlistItem.querySelector('span');
  
  if (isWatched) {
    icon?.classList.remove('fa-regular');
    icon?.classList.add('fa-solid');
    if (span) span.textContent = 'Đang theo dõi';
  } else {
    icon?.classList.remove('fa-solid');
    icon?.classList.add('fa-regular');
    if (span) span.textContent = 'Theo dõi';
  }
}

// Show context menu
export function showContextMenu(x: number, y: number, symbol: string) {
  const contextMenu = document.getElementById('coinContextMenu');
  if (!contextMenu) return;
  
  contextMenu.setAttribute('data-symbol', symbol);
  
  // Update watchlist icon based on current state
  updateWatchlistIcon(symbol, isInWatchlist(symbol));
  
  // Position menu
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.classList.add('show');
  
  // Adjust position if menu goes off screen
  const rect = contextMenu.getBoundingClientRect();
  
  if (rect.right > window.innerWidth) {
    contextMenu.style.left = `${x - rect.width}px`;
  }
  
  if (rect.bottom > window.innerHeight) {
    contextMenu.style.top = `${y - rect.height}px`;
  }
}

// Add context menu styles
export function addContextMenuStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .coin-context-menu {
      display: none;
      position: fixed;
      background: #1e1e1e;
      border: 1px solid #444;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      padding: 8px 0;
      min-width: 180px;
    }
    
    .coin-context-menu.show {
      display: block;
    }
    
    .context-menu-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      color: #d1d4dc;
      cursor: pointer;
      transition: background 0.2s;
    }
    
    .context-menu-item:hover {
      background: #2a2a2a;
    }
    
    .context-menu-item i {
      width: 20px;
      text-align: center;
    }
  `;
  
  document.head.appendChild(style);
}
