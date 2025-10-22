import { loadCryptoData, BinanceCoin } from '../dashboard/api';

// Mock wallet data
interface WalletAsset {
    coin: string;
    total: number;
    available: number;
    locked: number;
    usdValue: number;
}

const mockWalletData: WalletAsset[] = [
    { coin: 'BTC', total: 0.025, available: 0.025, locked: 0, usdValue: 0 },
    { coin: 'ETH', total: 1.5, available: 1.2, locked: 0.3, usdValue: 0 },
    { coin: 'USDT', total: 10000, available: 10000, locked: 0, usdValue: 10000 },
    { coin: 'BNB', total: 25, available: 20, locked: 5, usdValue: 0 },
    { coin: 'SOL', total: 50, available: 50, locked: 0, usdValue: 0 },
];

// Format number
const formatNumber = (num: number, decimals: number = 8): string => {
    return num.toFixed(decimals);
};

const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(price);
};

// Icon fallback
const getIconFallbackChain = (baseAsset: string, size: number = 32) => {
    const symbol = baseAsset.toLowerCase();
    return [
        `https://cdn.jsdelivr.net/gh/VadimMalykhin/binance-icons/crypto/${symbol}.svg`,
        `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${symbol}.svg`,
    ];
};

// Render wallet table
const renderWalletTable = async () => {
    const tbody = document.getElementById('spot-wallet-table');
    if (!tbody) return;

    try {
        // Get current prices
        const priceData = await loadCryptoData();
        const priceMap = new Map<string, number>();
        
        if (priceData) {
            priceData.forEach(coin => {
                const symbol = coin.symbol.replace('USDT', '');
                priceMap.set(symbol, parseFloat(coin.lastPrice));
            });
        }

        // Update wallet data with current prices
        const updatedWallet = mockWalletData.map(asset => {
            const price = priceMap.get(asset.coin) || 0;
            const usdValue = asset.total * price;
            return { ...asset, usdValue };
        });

        // Sort by USD value
        updatedWallet.sort((a, b) => b.usdValue - a.usdValue);

        // Render rows
        const rows = updatedWallet.map(asset => {
            const iconSources = getIconFallbackChain(asset.coin, 32);
            
            return `
            <tr>
                <td>
                    <div class="coin-info">
                        <img src="${iconSources[0]}" 
                             alt="${asset.coin}"
                             onerror="this.onerror=null; this.src='${iconSources[1]}';">
                        <div class="coin-name">
                            <span>${asset.coin}</span>
                            <span class="coin-symbol">${asset.coin}</span>
                        </div>
                    </div>
                </td>
                <td>${formatNumber(asset.total, asset.coin === 'USDT' ? 2 : 8)}</td>
                <td>${formatNumber(asset.available, asset.coin === 'USDT' ? 2 : 8)}</td>
                <td>${formatNumber(asset.locked, asset.coin === 'USDT' ? 2 : 8)}</td>
                <td>${formatPrice(asset.usdValue)}</td>
                <td>
                    <div class="action-btns">
                        <button onclick="depositCoin('${asset.coin}')">Nạp</button>
                        <button onclick="withdrawCoin('${asset.coin}')">Rút</button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');

        tbody.innerHTML = rows;

        // Update total balance
        const totalBalance = updatedWallet.reduce((sum, asset) => sum + asset.usdValue, 0);
        const balanceEl = document.getElementById('total-balance');
        if (balanceEl) {
            balanceEl.textContent = formatPrice(totalBalance);
        }

    } catch (error) {
        console.error('Error rendering wallet table:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="placeholder">Lỗi tải dữ liệu</td></tr>';
    }
};

// Tab switching
const initTabs = () => {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = (btn as HTMLElement).dataset.tab;

            // Remove active from all
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // Add active to clicked
            btn.classList.add('active');
            const content = document.querySelector(`[data-content="${tab}"]`);
            if (content) {
                content.classList.add('active');
            }
        });
    });
};

// Modal controls
const initModals = () => {
    const depositBtn = document.getElementById('deposit-btn');
    const withdrawBtn = document.getElementById('withdraw-btn');
    const depositModal = document.getElementById('depositModal');
    const withdrawModal = document.getElementById('withdrawModal');
    const closeDepositBtn = document.getElementById('close-deposit-modal');
    const closeWithdrawBtn = document.getElementById('close-withdraw-modal');

    const showModal = (modal: HTMLElement | null) => {
        if (modal) modal.classList.add('show');
    };

    const hideModal = (modal: HTMLElement | null) => {
        if (modal) modal.classList.remove('show');
    };

    depositBtn?.addEventListener('click', () => showModal(depositModal));
    withdrawBtn?.addEventListener('click', () => showModal(withdrawModal));
    closeDepositBtn?.addEventListener('click', () => hideModal(depositModal));
    closeWithdrawBtn?.addEventListener('click', () => hideModal(withdrawModal));

    // Click outside to close
    [depositModal, withdrawModal].forEach(modal => {
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal(modal);
            }
        });
    });

    // Quick action buttons
    const actionBtns = document.querySelectorAll('.action-btn');
    actionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.classList.contains('deposit')) {
                showModal(depositModal);
            } else if (btn.classList.contains('withdraw')) {
                showModal(withdrawModal);
            } else {
                alert('Chức năng đang được phát triển');
            }
        });
    });
};

// Search and filter
const initFilters = () => {
    const searchInput = document.getElementById('search-coin') as HTMLInputElement;
    const hideZeroCheckbox = document.getElementById('hide-zero-balance') as HTMLInputElement;

    const filterTable = () => {
        const searchTerm = searchInput?.value.toLowerCase() || '';
        const hideZero = hideZeroCheckbox?.checked || false;
        const rows = document.querySelectorAll('#spot-wallet-table tr');

        rows.forEach(row => {
            const coinName = row.querySelector('.coin-name span')?.textContent?.toLowerCase() || '';
            const totalValue = parseFloat(row.querySelectorAll('td')[1]?.textContent || '0');

            const matchesSearch = coinName.includes(searchTerm);
            const matchesZero = !hideZero || totalValue > 0;

            if (matchesSearch && matchesZero) {
                (row as HTMLElement).style.display = '';
            } else {
                (row as HTMLElement).style.display = 'none';
            }
        });
    };

    searchInput?.addEventListener('input', filterTable);
    hideZeroCheckbox?.addEventListener('change', filterTable);
};

// Toggle balance visibility
const initBalanceToggle = () => {
    const toggleBtn = document.querySelector('.btn-toggle-balance');
    const balanceValue = document.getElementById('total-balance');
    let isVisible = true;

    toggleBtn?.addEventListener('click', () => {
        isVisible = !isVisible;
        if (balanceValue) {
            balanceValue.textContent = isVisible ? balanceValue.dataset.value || '$25,847.32' : '******';
        }
        const icon = toggleBtn.querySelector('i');
        if (icon) {
            icon.className = isVisible ? 'fa-regular fa-eye' : 'fa-regular fa-eye-slash';
        }
    });

    // Store original value
    if (balanceValue) {
        balanceValue.dataset.value = balanceValue.textContent || '';
    }
};

// MAX button for withdraw
const initMaxButton = () => {
    const maxBtn = document.querySelector('.btn-max');
    const withdrawAmount = document.getElementById('withdraw-amount') as HTMLInputElement;

    maxBtn?.addEventListener('click', () => {
        // Get available balance (mock)
        const available = 0.025;
        if (withdrawAmount) {
            withdrawAmount.value = available.toString();
        }
    });
};

// Global functions for inline onclick
(window as any).depositCoin = (coin: string) => {
    const modal = document.getElementById('depositModal');
    const select = document.getElementById('deposit-coin') as HTMLSelectElement;
    if (select) {
        select.value = coin;
    }
    if (modal) {
        modal.classList.add('show');
    }
};

(window as any).withdrawCoin = (coin: string) => {
    const modal = document.getElementById('withdrawModal');
    const select = document.getElementById('withdraw-coin') as HTMLSelectElement;
    if (select) {
        select.value = coin;
    }
    if (modal) {
        modal.classList.add('show');
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Wallet page initialized');
    
    await renderWalletTable();
    initTabs();
    initModals();
    initFilters();
    initBalanceToggle();
    initMaxButton();
});
