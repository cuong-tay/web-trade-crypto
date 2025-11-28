import { loadCryptoData, BinanceCoin } from '../dashboard/api';
import { setupProtectedPage, setupLogoutButton, getCurrentUser } from '../utils/authGuard';
import { TradingService, type Position } from '../services/tradingService';

// --- Auth Setup ---
let currentUser = getCurrentUser();

// --- Types ---
interface Transaction {
    id: string;
    userId: string;
    type: 'buy' | 'sell';
    coin: string;
    amount: number;
    price: number;
    date: string;
    note?: string;
}

interface Holding {
    coin: string;
    amount: number;
    avgPrice: number;
    currentPrice: number;
    totalValue: number;
    pnl: number;
    pnlPercentage: number;
    portfolioPercentage: number;
}

// --- Helper Functions ---
const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: price < 1 ? 8 : 2,
    }).format(price);
};

const formatNumber = (num: number, decimals: number = 8): string => {
    return num.toFixed(decimals);
};

const getIconFallbackChain = (baseAsset: string, size: number = 32) => {
    const symbol = baseAsset.toLowerCase();
    const initial = baseAsset.substring(0, 2).toUpperCase();

    return [
        `https://cdn.jsdelivr.net/gh/VadimMalykhin/binance-icons/crypto/${symbol}.svg`,
        `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${symbol}.svg`,
        `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'%3E%3Ccircle cx='${size/2}' cy='${size/2}' r='${size/2}' fill='%23E5E7EB'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.35em' font-family='Arial' font-size='${Math.floor(size/2)}' fill='%236B7281' font-weight='bold'%3E${initial}%3C/text%3E%3C/svg%3E`
    ];
};

// --- Local Storage Functions ---
const STORAGE_KEY = (userId: string) => `crypto_portfolio_${userId}`;

const getTransactions = (): Transaction[] => {
    if (!currentUser) return [];
    const data = localStorage.getItem(STORAGE_KEY(currentUser.id));
    return data ? JSON.parse(data) : [];
};

const saveTransactions = (transactions: Transaction[]) => {
    if (!currentUser) return;
    localStorage.setItem(STORAGE_KEY(currentUser.id), JSON.stringify(transactions));
};

const addTransaction = (transaction: Omit<Transaction, 'id' | 'userId'>) => {
    if (!currentUser) return null;
    const transactions = getTransactions();
    const newTransaction: Transaction = {
        ...transaction,
        id: Date.now().toString(),
        userId: currentUser.id,
    };
    transactions.push(newTransaction);
    saveTransactions(transactions);
    return newTransaction;
};

const deleteTransaction = (id: string) => {
    const transactions = getTransactions();
    const filtered = transactions.filter(t => t.id !== id);
    saveTransactions(filtered);
};

// --- Calculate Holdings ---
const calculateHoldings = (transactions: Transaction[], priceData: Map<string, number>): Holding[] => {
    const holdingsMap = new Map<string, { amount: number; totalCost: number }>();

    transactions.forEach(tx => {
        const current = holdingsMap.get(tx.coin) || { amount: 0, totalCost: 0 };
        
        if (tx.type === 'buy') {
            holdingsMap.set(tx.coin, {
                amount: current.amount + tx.amount,
                totalCost: current.totalCost + (tx.amount * tx.price),
            });
        } else {
            const avgPrice = current.amount > 0 ? current.totalCost / current.amount : 0;
            holdingsMap.set(tx.coin, {
                amount: current.amount - tx.amount,
                totalCost: current.totalCost - (tx.amount * avgPrice),
            });
        }
    });

    const holdings: Holding[] = [];
    let totalPortfolioValue = 0;

    holdingsMap.forEach((data, coin) => {
        if (data.amount > 0) {
            const currentPrice = priceData.get(coin) || 0;
            const totalValue = data.amount * currentPrice;
            const avgPrice = data.totalCost / data.amount;
            const pnl = totalValue - data.totalCost;
            const pnlPercentage = (pnl / data.totalCost) * 100;

            totalPortfolioValue += totalValue;

            holdings.push({
                coin,
                amount: data.amount,
                avgPrice,
                currentPrice,
                totalValue,
                pnl,
                pnlPercentage,
                portfolioPercentage: 0, // Will calculate after
            });
        }
    });

    // Calculate portfolio percentages
    holdings.forEach(holding => {
        holding.portfolioPercentage = (holding.totalValue / totalPortfolioValue) * 100;
    });

    return holdings.sort((a, b) => b.totalValue - a.totalValue);
};

// --- API Functions ---
const fetchHoldingsFromAPI = async (priceData: Map<string, number>): Promise<Holding[]> => {
    try {
        console.log('📊 Fetching holdings from API...');
        const positions = await TradingService.getPositions();
        console.log('✅ Positions from API:', positions);
        
        if (!positions || positions.length === 0) {
            console.log('ℹ️ No positions found from API, using local transactions');
            const transactions = getTransactions();
            return calculateHoldings(transactions, priceData);
        }
        
        // Convert API Position to Holding
        const holdings: Holding[] = positions.map(pos => {
            const baseAsset = pos.symbol.replace('USDT', '').replace('BUSD', '');
            const currentPrice = priceData.get(baseAsset) || 0;
            const totalValue = pos.quantity * currentPrice;
            const totalCost = pos.quantity * pos.average_price;
            const pnl = totalValue - totalCost;
            const pnlPercentage = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
            
            return {
                coin: baseAsset,
                amount: pos.quantity,
                avgPrice: pos.average_price,
                currentPrice,
                totalValue,
                pnl,
                pnlPercentage,
                portfolioPercentage: 0, // Will calculate after
            };
        });
        
        // Calculate portfolio percentages
        const totalPortfolioValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);
        holdings.forEach(holding => {
            holding.portfolioPercentage = totalPortfolioValue > 0 ? (holding.totalValue / totalPortfolioValue) * 100 : 0;
        });
        
        return holdings.sort((a, b) => b.totalValue - a.totalValue);
    } catch (error) {
        console.error('❌ Error fetching holdings from API:', error);
        // Fallback to local transactions
        const transactions = getTransactions();
        return calculateHoldings(transactions, priceData);
    }
};

// --- Render Functions ---
const renderSummary = (holdings: Holding[]) => {
    const totalValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);
    const totalPnL = holdings.reduce((sum, h) => sum + h.pnl, 0);
    const totalCost = totalValue - totalPnL;
    const pnlPercentage = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

    document.getElementById('total-portfolio-value')!.textContent = formatPrice(totalValue);
    document.getElementById('total-pnl')!.textContent = formatPrice(totalPnL);
    document.getElementById('total-coins')!.textContent = holdings.length.toString();

    const changeEl = document.getElementById('portfolio-change')!;
    changeEl.textContent = `${totalPnL >= 0 ? '+' : ''}${formatPrice(totalPnL)} (${pnlPercentage.toFixed(2)}%)`;
    changeEl.className = `summary-change ${totalPnL >= 0 ? 'positive' : 'negative'}`;

    const pnlEl = document.getElementById('pnl-percentage')!;
    pnlEl.textContent = `${pnlPercentage.toFixed(2)}%`;
    pnlEl.className = `summary-change ${totalPnL >= 0 ? 'positive' : 'negative'}`;

    if (holdings.length > 0) {
        const best = holdings.reduce((max, h) => h.pnlPercentage > max.pnlPercentage ? h : max);
        document.getElementById('best-performer')!.textContent = best.coin;
        const bestChangeEl = document.getElementById('best-performer-change')!;
        bestChangeEl.textContent = `${best.pnlPercentage >= 0 ? '+' : ''}${best.pnlPercentage.toFixed(2)}%`;
        bestChangeEl.className = `summary-change ${best.pnlPercentage >= 0 ? 'positive' : 'negative'}`;
    }
};

const renderHoldingsTable = (holdings: Holding[]) => {
    const tbody = document.getElementById('holdings-table')!;

    if (holdings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="placeholder">Chưa có tài sản nào. Nhấn "Thêm giao dịch" để bắt đầu.</td></tr>';
        return;
    }

    const rows = holdings.map(holding => {
        const iconSources = getIconFallbackChain(holding.coin, 32);
        return `
        <tr>
            <td>
                <div class="asset-info">
                    <img src="${iconSources[0]}" 
                         alt="${holding.coin}"
                         onerror="this.onerror=null; this.src=&quot;${iconSources[1]}&quot;; this.onerror=function(){this.src=&quot;${iconSources[2]}&quot;;}">
                    <div class="asset-details">
                        <h4>${holding.coin}</h4>
                        <span>${holding.coin}/USDT</span>
                    </div>
                </div>
            </td>
            <td>${formatNumber(holding.amount, 8)}</td>
            <td>${formatPrice(holding.avgPrice)}</td>
            <td>${formatPrice(holding.currentPrice)}</td>
            <td>${formatPrice(holding.totalValue)}</td>
            <td class="${holding.pnl >= 0 ? 'change-positive' : 'change-negative'}">
                ${holding.pnl >= 0 ? '+' : ''}${formatPrice(holding.pnl)}<br>
                <small>(${holding.pnlPercentage.toFixed(2)}%)</small>
            </td>
            <td>${holding.portfolioPercentage.toFixed(2)}%</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-action edit" onclick="editHolding('${holding.coin}')">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                </div>
            </td>
        </tr>
        `;
    }).join('');

    tbody.innerHTML = rows;
};

const renderTransactionsTable = (transactions: Transaction[]) => {
    const tbody = document.getElementById('transaction-table')!;

    if (transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="placeholder">Chưa có giao dịch nào.</td></tr>';
        return;
    }

    const rows = transactions
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map(tx => {
            const date = new Date(tx.date);
            const formattedDate = date.toLocaleDateString('vi-VN', { 
                day: '2-digit', 
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            return `
            <tr>
                <td>${formattedDate}</td>
                <td><span class="transaction-type ${tx.type}">${tx.type === 'buy' ? 'MUA' : 'BÁN'}</span></td>
                <td><strong>${tx.coin}</strong></td>
                <td>${formatNumber(tx.amount, 8)}</td>
                <td>${formatPrice(tx.price)}</td>
                <td>${formatPrice(tx.amount * tx.price)}</td>
                <td>${tx.note || '--'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action delete" onclick="removeTransaction('${tx.id}')">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');

    tbody.innerHTML = rows;
};

const renderCharts = (holdings: Holding[]) => {
    if (holdings.length === 0) return;

    // Portfolio Allocation Chart
    const portfolioCtx = (document.getElementById('portfolioChart') as HTMLCanvasElement)?.getContext('2d');
    if (portfolioCtx && typeof (window as any).Chart !== 'undefined') {
        new (window as any).Chart(portfolioCtx, {
            type: 'doughnut',
            data: {
                labels: holdings.map(h => h.coin),
                datasets: [{
                    data: holdings.map(h => h.portfolioPercentage),
                    backgroundColor: [
                        '#30D475', '#667eea', '#f87a48', '#5983f4', '#ea3943',
                        '#16c784', '#9333ea', '#fbbf24', '#ef4444', '#3b82f6'
                    ],
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    }
                }
            }
        });
    }

    // Performance Chart (Mock data for 30 days)
    const performanceCtx = (document.getElementById('performanceChart') as HTMLCanvasElement)?.getContext('2d');
    if (performanceCtx && typeof (window as any).Chart !== 'undefined') {
        const days = Array.from({length: 30}, (_, i) => i + 1);
        const totalValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);
        const mockData = days.map((_, i) => totalValue * (0.85 + Math.random() * 0.3));

        new (window as any).Chart(performanceCtx, {
            type: 'line',
            data: {
                labels: days.map(d => `${d}`),
                datasets: [{
                    label: 'Giá trị danh mục',
                    data: mockData,
                    borderColor: '#30D475',
                    backgroundColor: 'rgba(48, 212, 117, 0.1)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: function(value: any) {
                                return '$' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    }
};

// --- Main Init ---
const initPortfolio = async () => {
    try {
        // Load price data
        const priceDataArray = await loadCryptoData();
        const priceMap = new Map<string, number>();
        
        if (priceDataArray) {
            priceDataArray.forEach(coin => {
                const symbol = coin.symbol.replace('USDT', '');
                priceMap.set(symbol, parseFloat(coin.lastPrice));
            });
        }

        // Fetch holdings từ API (sẽ fallback to local nếu API fail)
        const holdings = await fetchHoldingsFromAPI(priceMap);

        // Get local transactions for history display
        const transactions = getTransactions();

        // Render everything
        renderSummary(holdings);
        renderHoldingsTable(holdings);
        renderTransactionsTable(transactions);
        renderCharts(holdings);

    } catch (error) {
        console.error('Error initializing portfolio:', error);
    }
};

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', async () => {
    // Setup auth guard first
    currentUser = setupProtectedPage();
    
    if (!currentUser) {
        return;
    }
    
    console.log('📊 Portfolio loaded for user:', currentUser.username);
    
    // Setup logout button
    setupLogoutButton('#logout-btn');
    
    initPortfolio();

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            (e.target as HTMLElement).classList.add('active');
            // Add filter logic here if needed
        });
    });
});

// Global functions for inline onclick
(window as any).removeTransaction = async (id: string) => {
    if (confirm('Bạn có chắc muốn xóa giao dịch này?')) {
        deleteTransaction(id);
        await initPortfolio();
    }
};

(window as any).editHolding = (coin: string) => {
    alert(`Chức năng chỉnh sửa ${coin} đang được phát triển`);
};
