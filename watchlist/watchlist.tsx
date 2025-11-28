import {
  getWatchlist,
  fetchWatchlistData,
  removeFromWatchlist,
  showNotification,
} from './watchlistManager';
import { setupProtectedPage, setupLogoutButton, getCurrentUser } from '../utils/authGuard';

// Auth setup
let currentUser = getCurrentUser();

// DOM Elements
const emptyState = document.getElementById('empty-state')!;
const watchlistGrid = document.getElementById('watchlist-grid')!;
const watchlistList = document.getElementById('watchlist-list')!;
const watchlistTableBody = document.getElementById('watchlist-table-body')!;
const sortSelect = document.getElementById('sort-select') as HTMLSelectElement;
const searchInput = document.getElementById('watchlist-search') as HTMLInputElement;
const viewButtons = document.querySelectorAll('.btn-view');

// Stats
const watchlistCountEl = document.getElementById('watchlist-count')!;
const positiveCountEl = document.getElementById('positive-count')!;
const negativeCountEl = document.getElementById('negative-count')!;
const totalValueEl = document.getElementById('total-value')!;

let currentView: 'grid' | 'list' = 'grid';
let watchlistData: any[] = [];
let filteredData: any[] = [];

// Initialize
async function init() {
  // Setup auth guard first
  currentUser = setupProtectedPage();
  
  if (!currentUser) {
    return;
  }
  
  console.log('👀 Watchlist loaded for user:', currentUser.username);
  
  // Setup logout button
  setupLogoutButton('#logout-btn');
  
  const symbols = getWatchlist();
  
  if (symbols.length === 0) {
    showEmptyState();
    return;
  }
  
  await loadWatchlistData();
  
  // Event listeners
  sortSelect?.addEventListener('change', handleSort);
  searchInput?.addEventListener('input', handleSearch);
  
  viewButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-view') as 'grid' | 'list';
      switchView(view);
    });
  });
  
  // Listen for watchlist updates
  window.addEventListener('watchlistUpdated', () => {
    loadWatchlistData();
  });
  
  // Auto refresh every 30 seconds
  setInterval(loadWatchlistData, 30000);
}

// Load watchlist data
async function loadWatchlistData() {
  try {
    watchlistData = await fetchWatchlistData();
    filteredData = [...watchlistData];
    
    if (watchlistData.length === 0) {
      showEmptyState();
      return;
    }
    
    updateStats();
    renderWatchlist();
  } catch (error) {
    console.error('Error loading watchlist:', error);
    showNotification('Lỗi khi tải dữ liệu', 'error');
  }
}

// Update stats
function updateStats() {
  const count = watchlistData.length;
  const positiveCount = watchlistData.filter(c => c.priceChangePercent24h > 0).length;
  const negativeCount = watchlistData.filter(c => c.priceChangePercent24h < 0).length;
  const totalValue = watchlistData.reduce((sum, c) => sum + (c.price * c.volume24h), 0);
  
  watchlistCountEl.textContent = count.toString();
  positiveCountEl.textContent = positiveCount.toString();
  negativeCountEl.textContent = negativeCount.toString();
  totalValueEl.textContent = `$${(totalValue / 1e9).toFixed(2)}B`;
}

// Show empty state
function showEmptyState() {
  emptyState.classList.add('show');
  watchlistGrid.style.display = 'none';
  watchlistList.style.display = 'none';
  
  watchlistCountEl.textContent = '0';
  positiveCountEl.textContent = '0';
  negativeCountEl.textContent = '0';
  totalValueEl.textContent = '$0';
}

// Hide empty state
function hideEmptyState() {
  emptyState.classList.remove('show');
  
  if (currentView === 'grid') {
    watchlistGrid.style.display = 'grid';
    watchlistList.style.display = 'none';
  } else {
    watchlistGrid.style.display = 'none';
    watchlistList.style.display = 'block';
  }
}

// Render watchlist
function renderWatchlist() {
  if (filteredData.length === 0) {
    showEmptyState();
    return;
  }
  
  hideEmptyState();
  
  if (currentView === 'grid') {
    renderGridView();
  } else {
    renderListView();
  }
}

// Render grid view
function renderGridView() {
  watchlistGrid.innerHTML = filteredData
    .map(coin => {
      const changeClass = coin.priceChangePercent24h >= 0 ? 'positive' : 'negative';
      const changeIcon = coin.priceChangePercent24h >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
      
      return `
        <div class="watchlist-card">
          <div class="watchlist-card-header">
            <div class="coin-info">
              <div class="coin-icon">
                ${coin.name.substring(0, 2)}
              </div>
              <div class="coin-name-group">
                <h4>${coin.name}</h4>
                <span>${coin.symbol}</span>
              </div>
            </div>
            <button class="btn-remove" onclick="handleRemove('${coin.symbol}')">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          
          <div class="price-section">
            <div class="current-price">$${coin.price.toFixed(2)}</div>
            <span class="price-change ${changeClass}">
              <i class="fa-solid ${changeIcon}"></i>
              ${Math.abs(coin.priceChangePercent24h).toFixed(2)}%
            </span>
          </div>
          
          <div class="coin-stats">
            <div class="stat">
              <span class="stat-label">Khối lượng 24h</span>
              <span class="stat-value">$${(coin.volume24h / 1e6).toFixed(2)}M</span>
            </div>
            <div class="stat">
              <span class="stat-label">Thay đổi 24h</span>
              <span class="stat-value ${changeClass}">$${coin.priceChange24h.toFixed(2)}</span>
            </div>
          </div>
          
          <div class="card-actions">
            <button class="btn-action" onclick="handleTrade('${coin.symbol}')">
              <i class="fa-solid fa-arrow-right-arrow-left"></i> Giao dịch
            </button>
            <button class="btn-action" onclick="handleViewChart('${coin.symbol}')">
              <i class="fa-solid fa-chart-line"></i> Biểu đồ
            </button>
          </div>
        </div>
      `;
    })
    .join('');
}

// Render list view
function renderListView() {
  watchlistTableBody.innerHTML = filteredData
    .map(coin => {
      const changeClass = coin.priceChangePercent24h >= 0 ? 'positive' : 'negative';
      const changeIcon = coin.priceChangePercent24h >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
      
      return `
        <tr>
          <td>
            <div class="coin-cell">
              <div class="coin-icon">${coin.name.substring(0, 2)}</div>
              <div>
                <div style="font-weight: 600;">${coin.name}</div>
                <div style="font-size: 12px; color: #999;">${coin.symbol}</div>
              </div>
            </div>
          </td>
          <td>$${coin.price.toFixed(2)}</td>
          <td>
            <span class="price-change ${changeClass}">
              <i class="fa-solid ${changeIcon}"></i>
              ${Math.abs(coin.priceChangePercent24h).toFixed(2)}%
            </span>
          </td>
          <td>$${(coin.volume24h / 1e6).toFixed(2)}M</td>
          <td>$${(coin.marketCap / 1e9).toFixed(2)}B</td>
          <td>
            <div class="mini-chart"></div>
          </td>
          <td>
            <div class="actions-cell">
              <button class="btn-icon-small" onclick="handleTrade('${coin.symbol}')" title="Giao dịch">
                <i class="fa-solid fa-arrow-right-arrow-left"></i>
              </button>
              <button class="btn-icon-small" onclick="handleViewChart('${coin.symbol}')" title="Xem biểu đồ">
                <i class="fa-solid fa-chart-line"></i>
              </button>
              <button class="btn-icon-small remove" onclick="handleRemove('${coin.symbol}')" title="Xóa">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

// Switch view
function switchView(view: 'grid' | 'list') {
  currentView = view;
  
  viewButtons.forEach(btn => {
    if (btn.getAttribute('data-view') === view) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  renderWatchlist();
}

// Handle sort
function handleSort() {
  const sortBy = sortSelect.value;
  
  switch (sortBy) {
    case 'name':
      filteredData.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'price-high':
      filteredData.sort((a, b) => b.price - a.price);
      break;
    case 'price-low':
      filteredData.sort((a, b) => a.price - b.price);
      break;
    case 'change-high':
      filteredData.sort((a, b) => b.priceChangePercent24h - a.priceChangePercent24h);
      break;
    case 'change-low':
      filteredData.sort((a, b) => a.priceChangePercent24h - b.priceChangePercent24h);
      break;
    case 'volume':
      filteredData.sort((a, b) => b.volume24h - a.volume24h);
      break;
  }
  
  renderWatchlist();
}

// Handle search
function handleSearch() {
  const query = searchInput.value.toLowerCase().trim();
  
  if (!query) {
    filteredData = [...watchlistData];
  } else {
    filteredData = watchlistData.filter(coin => 
      coin.name.toLowerCase().includes(query) || 
      coin.symbol.toLowerCase().includes(query)
    );
  }
  
  renderWatchlist();
}

// Global handlers (attached to window)
(window as any).handleRemove = async (symbol: string) => {
  if (confirm(`Bạn có chắc muốn xóa ${symbol} khỏi danh sách theo dõi?`)) {
    removeFromWatchlist(symbol);
    showNotification(`Đã xóa ${symbol} khỏi danh sách theo dõi`);
    await loadWatchlistData();
  }
};

(window as any).handleTrade = (symbol: string) => {
  // Redirect to trading page with symbol
  window.location.href = `trading.html?symbol=${symbol}`;
};

(window as any).handleViewChart = (symbol: string) => {
  // Redirect to trading page with symbol
  window.location.href = `trading.html?symbol=${symbol}`;
};

// Initialize on load
init();

console.log('Watchlist module loaded');
