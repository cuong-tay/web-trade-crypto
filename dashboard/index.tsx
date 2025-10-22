import { loadCryptoData, BinanceCoin } from './api'; // Import cả hàm và kiểu dữ liệu

// --- Watchlist Management (Temporary - will be stored in database later) ---
const tempWatchlist: string[] = [];

const addToWatchlist = (symbol: string): boolean => {
    if (!tempWatchlist.includes(symbol)) {
        tempWatchlist.push(symbol);
        return true;
    }
    return false;
};

const removeFromWatchlist = (symbol: string): boolean => {
    const index = tempWatchlist.indexOf(symbol);
    if (index > -1) {
        tempWatchlist.splice(index, 1);
        return true;
    }
    return false;
};

const isInWatchlist = (symbol: string): boolean => {
    return tempWatchlist.includes(symbol);
};

// --- Context Menu Management ---
let contextMenuVisible = false;
let currentCoinSymbol = '';

const showContextMenu = (x: number, y: number, symbol: string) => {
    console.log('showContextMenu called:', { x, y, symbol });
    const menu = document.getElementById('coinContextMenu');
    if (!menu) {
        console.error('Context menu element not found!');
        return;
    }

    currentCoinSymbol = symbol;
    contextMenuVisible = true;

    // Update watchlist icon
    const watchlistItem = menu.querySelector('[data-action="watchlist"]');
    if (watchlistItem) {
        const icon = watchlistItem.querySelector('i');
        const text = watchlistItem.querySelector('span');
        if (isInWatchlist(symbol)) {
            icon?.classList.remove('fa-regular');
            icon?.classList.add('fa-solid');
            if (text) text.textContent = 'Bỏ theo dõi';
        } else {
            icon?.classList.remove('fa-solid');
            icon?.classList.add('fa-regular');
            if (text) text.textContent = 'Theo dõi';
        }
    }

    // Position menu
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
    menu.classList.add('show');
    console.log('Context menu should be visible now');

    // Adjust if menu goes off screen
    setTimeout(() => {
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = `${x - rect.width}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = `${y - rect.height}px`;
        }
    }, 0);
};

const hideContextMenu = () => {
    const menu = document.getElementById('coinContextMenu');
    if (menu) {
        menu.classList.remove('show');
        contextMenuVisible = false;
        currentCoinSymbol = '';
    }
};

// --- Các hàm trợ giúp ---

const formatPrice = (priceString: string | null): string => {
    if (priceString === null) return 'N/A';
    const price = parseFloat(priceString);
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: price < 1 ? 8 : 2,
    }).format(price);
};

const formatPercentage = (percentageString: string | null): string => {
    if (percentageString === null) return 'N/A';
    const percentage = parseFloat(percentageString);
    return `${percentage.toFixed(2)}%`;
};

// Function tạo fallback chain với Binance Icons
const getIconFallbackChain = (baseAsset: string, size: number = 32) => {
    const symbol = baseAsset.toLowerCase();
    const initial = baseAsset.substring(0, 2).toUpperCase();

    return [
        // 1. Binance Icons CDN (đúng link)
        `https://cdn.jsdelivr.net/gh/VadimMalykhin/binance-icons/crypto/${symbol}.svg`,
        // 2. Cryptocurrency Icons CDN (backup)
        `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${symbol}.svg`,
        // 3. SVG Placeholder (luôn hiển thị)
        `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'%3E%3Ccircle cx='${size/2}' cy='${size/2}' r='${size/2}' fill='%23E5E7EB'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.35em' font-family='Arial' font-size='${Math.floor(size/2)}' fill='%236B7281' font-weight='bold'%3E${initial}%3C/text%3E%3C/svg%3E`
    ];
};

// --- Các hàm Render (Đã được điều chỉnh cho BinanceCoin) ---

const renderCoinList = (selector: string, data: BinanceCoin[], limit: number = 5) => {
    const listElement = document.querySelector(selector);
    if (!listElement) return;
    if (!data || data.length === 0) {
        listElement.innerHTML = '<li class="placeholder">Không có dữ liệu.</li>';
        return;
    }

    const items = data.slice(0, limit).map((coin, index) => {
        const baseAsset = coin.symbol.replace('USDT', '');
        const priceChange = parseFloat(coin.priceChangePercent);
        const iconSources = getIconFallbackChain(baseAsset, 32);
        const watchlistStar = isInWatchlist(coin.symbol) ? '<i class="fa-solid fa-star coin-watchlist-star"></i>' : '';
        
        return `
        <li data-coin-symbol="${coin.symbol}">
            <span class="rank">#${index + 1}</span>
            <div class="coin-icon-wrapper">
                <img src="${iconSources[0]}" 
                     alt="${baseAsset}" 
                     class="coin-icon" 
                     onerror="this.onerror=null; this.src=&quot;${iconSources[1]}&quot;; this.onerror=function(){this.src=&quot;${iconSources[2]}&quot;;}">
            </div>
            <div class="name">
                <span>${baseAsset}${watchlistStar}</span>
                <span class="symbol">${coin.symbol}</span>
            </div>
            <span class="change ${priceChange >= 0 ? 'change-positive' : 'change-negative'}">
                ${formatPercentage(coin.priceChangePercent)}
            </span>
        </li>
    `}).join('');
    listElement.innerHTML = items;
    
    // Add click event listeners
    listElement.querySelectorAll('li[data-coin-symbol]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const symbol = (item as HTMLElement).dataset.coinSymbol;
            console.log('Coin clicked:', symbol);
            if (symbol) {
                showContextMenu((e as MouseEvent).clientX, (e as MouseEvent).clientY, symbol);
            }
        });
    });
};

const renderTopCoins = (selector: string, data: BinanceCoin[], limit: number = 10) => {
    const scrollerElement = document.querySelector(selector);
    if (!scrollerElement) return;
    if (!data || data.length === 0) {
        scrollerElement.innerHTML = '<div class="placeholder">Không có dữ liệu.</div>';
        return;
    }

    const items = data.slice(0, limit).map((coin, index) => {
        const baseAsset = coin.symbol.replace('USDT', '');
        const priceChange = parseFloat(coin.priceChangePercent);
        const iconSources = getIconFallbackChain(baseAsset, 50);
        const watchlistStar = isInWatchlist(coin.symbol) ? '<i class="fa-solid fa-star coin-watchlist-star"></i>' : '';
        
        return `
        <div class="top-coin-card" data-coin-symbol="${coin.symbol}">
            <span class="rank">#${index + 1}</span>
            <img src="${iconSources[0]}" 
                 alt="${baseAsset}" 
                 style="width: 50px; height: 50px;" 
                 onerror="this.onerror=null; this.src=&quot;${iconSources[1]}&quot;; this.onerror=function(){this.src=&quot;${iconSources[2]}&quot;;}">
            <div class="name">${baseAsset}${watchlistStar}</div>
            <div class="price">${formatPrice(coin.lastPrice)}</div>
            <div class="change ${priceChange >= 0 ? 'change-positive' : 'change-negative'}">
                ${formatPercentage(coin.priceChangePercent)}
            </div>
        </div>
    `}).join('');
    scrollerElement.innerHTML = items;
    
    // Add click event listeners
    scrollerElement.querySelectorAll('.top-coin-card[data-coin-symbol]').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const symbol = (item as HTMLElement).dataset.coinSymbol;
            console.log('Top coin clicked:', symbol);
            if (symbol) {
                showContextMenu((e as MouseEvent).clientX, (e as MouseEvent).clientY, symbol);
            }
        });
    });
};

// --- Thiết lập Scroller ---
const setupTopCoinsScroller = () => {
    const scroller = document.getElementById('top-coins-scroller');
    const leftBtn = document.getElementById('scroll-left-btn');
    const rightBtn = document.getElementById('scroll-right-btn');

    if (!scroller || !leftBtn || !rightBtn) return;
    const scrollAmount = 220 + 20; // chiều rộng card + khoảng cách
    rightBtn.addEventListener('click', () => { scroller.scrollLeft += scrollAmount; });
    leftBtn.addEventListener('click', () => { scroller.scrollLeft -= scrollAmount; });
};

// --- Render Market Statistics ---
const renderMarketStats = (data: BinanceCoin[]) => {
    // Total Volume
    const totalVolume = data.reduce((sum, coin) => sum + parseFloat(coin.quoteVolume), 0);
    const totalVolumeEl = document.getElementById('total-volume');
    if (totalVolumeEl) totalVolumeEl.textContent = `$${(totalVolume / 1e9).toFixed(2)}B`;
    
    // Total Coins
    const totalCoinsEl = document.getElementById('total-coins');
    if (totalCoinsEl) totalCoinsEl.textContent = data.length.toString();
    
    // Gainers & Losers
    const gainers = data.filter(coin => parseFloat(coin.priceChangePercent) > 0);
    const losers = data.filter(coin => parseFloat(coin.priceChangePercent) < 0);
    
    const gainersCountEl = document.getElementById('gainers-count');
    const losersCountEl = document.getElementById('losers-count');
    if (gainersCountEl) gainersCountEl.textContent = gainers.length.toString();
    if (losersCountEl) losersCountEl.textContent = losers.length.toString();
    
    // Top Gainer & Loser
    const topGainer = [...data].sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))[0];
    const topLoser = [...data].sort((a, b) => parseFloat(a.priceChangePercent) - parseFloat(b.priceChangePercent))[0];
    
    const topGainerEl = document.getElementById('top-gainer');
    const topLoserEl = document.getElementById('top-loser');
    if (topGainerEl) topGainerEl.textContent = `${topGainer.symbol.replace('USDT', '')}: ${formatPercentage(topGainer.priceChangePercent)}`;
    if (topLoserEl) topLoserEl.textContent = `${topLoser.symbol.replace('USDT', '')}: ${formatPercentage(topLoser.priceChangePercent)}`;
};

// --- Render Gainers/Losers Table ---
const renderMarketMoversTable = (selector: string, data: BinanceCoin[], limit: number = 10) => {
    const tbody = document.querySelector(selector);
    if (!tbody) return;
    
    const rows = data.slice(0, limit).map((coin, index) => {
        const baseAsset = coin.symbol.replace('USDT', '');
        const priceChange = parseFloat(coin.priceChangePercent);
        const iconSources = getIconFallbackChain(baseAsset, 24);
        const watchlistStar = isInWatchlist(coin.symbol) ? '<i class="fa-solid fa-star coin-watchlist-star"></i>' : '';
        
        return `
        <tr data-coin-symbol="${coin.symbol}">
            <td>${index + 1}</td>
            <td>
                <div class="coin-info">
                    <img src="${iconSources[0]}" 
                         alt="${baseAsset}" 
                         style="width: 24px; height: 24px;"
                         onerror="this.onerror=null; this.src=&quot;${iconSources[1]}&quot;; this.onerror=function(){this.src=&quot;${iconSources[2]}&quot;;}">
                    <span>${baseAsset}${watchlistStar}</span>
                </div>
            </td>
            <td>${formatPrice(coin.lastPrice)}</td>
            <td class="${priceChange >= 0 ? 'change-positive' : 'change-negative'}">
                ${formatPercentage(coin.priceChangePercent)}
            </td>
            <td>$${(parseFloat(coin.quoteVolume) / 1e6).toFixed(2)}M</td>
        </tr>
        `;
    }).join('');
    
    tbody.innerHTML = rows;
    
    // Add click event listeners
    tbody.querySelectorAll('tr[data-coin-symbol]').forEach(row => {
        row.addEventListener('click', (e) => {
            e.preventDefault();
            const symbol = (row as HTMLElement).dataset.coinSymbol;
            if (symbol) {
                showContextMenu((e as MouseEvent).clientX, (e as MouseEvent).clientY, symbol);
            }
        });
    });
};

// --- Render Volume Leaders ---
const renderVolumeLeaders = (selector: string, data: BinanceCoin[], limit: number = 6) => {
    const container = document.querySelector(selector);
    if (!container) return;
    
    const items = data.slice(0, limit).map((coin, index) => {
        const baseAsset = coin.symbol.replace('USDT', '');
        const volume = parseFloat(coin.quoteVolume);
        const priceChange = parseFloat(coin.priceChangePercent);
        const iconSources = getIconFallbackChain(baseAsset, 40);
        const watchlistStar = isInWatchlist(coin.symbol) ? '<i class="fa-solid fa-star coin-watchlist-star"></i>' : '';
        
        return `
        <div class="volume-card" data-coin-symbol="${coin.symbol}">
            <div class="volume-rank">#${index + 1}</div>
            <img src="${iconSources[0]}" 
                 alt="${baseAsset}"
                 onerror="this.onerror=null; this.src=&quot;${iconSources[1]}&quot;; this.onerror=function(){this.src=&quot;${iconSources[2]}&quot;;}">
            <div class="volume-info">
                <h4>${baseAsset}${watchlistStar}</h4>
                <p class="volume-amount">$${(volume / 1e6).toFixed(2)}M</p>
                <span class="${priceChange >= 0 ? 'change-positive' : 'change-negative'}">
                    ${formatPercentage(coin.priceChangePercent)}
                </span>
            </div>
        </div>
        `;
    }).join('');
    
    container.innerHTML = items;
    
    // Add click event listeners
    container.querySelectorAll('.volume-card[data-coin-symbol]').forEach(card => {
        card.addEventListener('click', (e) => {
            e.preventDefault();
            const symbol = (card as HTMLElement).dataset.coinSymbol;
            if (symbol) {
                showContextMenu((e as MouseEvent).clientX, (e as MouseEvent).clientY, symbol);
            }
        });
    });
};

// --- Render Market Heatmap ---
const renderMarketHeatmap = (selector: string, data: BinanceCoin[], limit: number = 20) => {
    const container = document.querySelector(selector);
    if (!container) return;
    
    const items = data.slice(0, limit).map(coin => {
        const baseAsset = coin.symbol.replace('USDT', '');
        const priceChange = parseFloat(coin.priceChangePercent);
        const volume = parseFloat(coin.quoteVolume);
        const watchlistStar = isInWatchlist(coin.symbol) ? '<i class="fa-solid fa-star coin-watchlist-star" style="font-size: 10px; position: absolute; top: 4px; right: 4px;"></i>' : '';
        
        // Size based on volume (min 80px, max 200px)
        const maxVolume = Math.max(...data.slice(0, limit).map(c => parseFloat(c.quoteVolume)));
        const size = 80 + (volume / maxVolume) * 120;
        
        // Color intensity based on price change
        const intensity = Math.min(Math.abs(priceChange) / 10, 1);
        const color = priceChange >= 0 
            ? `rgba(48, 212, 117, ${0.3 + intensity * 0.7})` 
            : `rgba(234, 57, 67, ${0.3 + intensity * 0.7})`;
        
        return `
        <div class="heatmap-cell" data-coin-symbol="${coin.symbol}" style="width: ${size}px; height: ${size}px; background-color: ${color}; position: relative;" title="${baseAsset}: ${formatPercentage(coin.priceChangePercent)}">
            ${watchlistStar}
            <span class="heatmap-symbol">${baseAsset}</span>
            <span class="heatmap-change">${formatPercentage(coin.priceChangePercent)}</span>
        </div>
        `;
    }).join('');
    
    container.innerHTML = items;
    
    // Add click event listeners
    container.querySelectorAll('.heatmap-cell[data-coin-symbol]').forEach(cell => {
        cell.addEventListener('click', (e) => {
            e.preventDefault();
            const symbol = (cell as HTMLElement).dataset.coinSymbol;
            if (symbol) {
                showContextMenu((e as MouseEvent).clientX, (e as MouseEvent).clientY, symbol);
            }
        });
    });
};

// --- Khởi tạo Dashboard chính ---
const initDashboard = async () => {
    const placeholders = document.querySelectorAll('.placeholder');
    try {
        const data: BinanceCoin[] | null = await loadCryptoData();
        
        if (data && data.length > 0) {
            // 1. Coin hàng đầu (sắp xếp theo khối lượng giao dịch)
            const sortedByVolume = [...data].sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
            
            // 2. Xu hướng (sắp xếp theo % thay đổi giá trong 24h)
            const sortedByTrending = [...data].sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent));

            // 3. Mới thêm gần đây (mô phỏng: hiển thị các coin có khối lượng giao dịch thấp hơn)
            const recentlyAdded = [...data].sort((a, b) => parseFloat(a.quoteVolume) - parseFloat(b.quoteVolume));

            // 4. Gainers & Losers
            const gainers = [...data].filter(c => parseFloat(c.priceChangePercent) > 0)
                .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent));
            
            const losers = [...data].filter(c => parseFloat(c.priceChangePercent) < 0)
                .sort((a, b) => parseFloat(a.priceChangePercent) - parseFloat(b.priceChangePercent));

            // Render các section hiện tại
            renderCoinList('.card-trending .coin-list', sortedByTrending, 5);
            renderCoinList('.card-recent .coin-list', recentlyAdded, 5);
            renderTopCoins('#top-coins-scroller', sortedByVolume, 10);
            setupTopCoinsScroller();

            // Render các section mới
            renderMarketStats(data);
            renderMarketMoversTable('#gainers-table', gainers, 10);
            renderMarketMoversTable('#losers-table', losers, 10);
            renderVolumeLeaders('#volume-leaders', sortedByVolume, 6);
            renderMarketHeatmap('#market-heatmap', sortedByVolume, 20);
        } else {
            placeholders.forEach(p => p.textContent = 'Không thể tải dữ liệu.');
        }
    } catch (error) {
        console.error('Lỗi khi khởi tạo dashboard:', error);
        placeholders.forEach(p => {
            if (p) {
                p.textContent = 'Lỗi tải dữ liệu.';
                p.classList.add('error-text');
            }
        });
    }
};

// --- Context Menu Event Handlers ---
const initContextMenu = () => {
    console.log('initContextMenu called');
    const menu = document.getElementById('coinContextMenu');
    if (!menu) {
        console.error('coinContextMenu element not found in DOM!');
        return;
    }
    console.log('Context menu element found:', menu);

    // Handle context menu actions
    menu.addEventListener('click', (e) => {
        console.log('Menu clicked');
        const target = e.target as HTMLElement;
        const menuItem = target.closest('.context-menu-item') as HTMLElement;
        
        if (!menuItem) {
            console.log('No menu item found');
            return;
        }
        
        const action = menuItem.dataset.action;
        console.log('Menu action:', action);
        
        if (action === 'watchlist') {
            // Toggle watchlist
            if (isInWatchlist(currentCoinSymbol)) {
                removeFromWatchlist(currentCoinSymbol);
                console.log('Removed from watchlist:', currentCoinSymbol);
            } else {
                addToWatchlist(currentCoinSymbol);
                console.log('Added to watchlist:', currentCoinSymbol);
            }
            // Re-render dashboard to update stars
            initDashboard();
            hideContextMenu();
        } else if (action === 'trade') {
            // Navigate to trading page (to be implemented)
            console.log(`Navigate to trade ${currentCoinSymbol}`);
            alert(`Chức năng giao dịch cho ${currentCoinSymbol} sẽ được cập nhật sau`);
            // TODO: window.location.href = `/trade.html?symbol=${currentCoinSymbol}`;
            hideContextMenu();
        }
    });

    // Hide menu when clicking outside
    document.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (contextMenuVisible && !menu.contains(target)) {
            console.log('Clicking outside, hiding menu');
            hideContextMenu();
        }
    });

    // Prevent context menu from closing when clicking inside
    menu.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    console.log('Context menu initialized successfully');
};

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    initContextMenu();
});
