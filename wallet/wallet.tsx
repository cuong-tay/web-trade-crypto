import { loadCryptoData, BinanceCoin } from '../dashboard/api';
import { setupProtectedPage, setupLogoutButton } from '../utils/authGuard';
import { WalletService, type WalletBalance } from '../services/walletService';
import { TradingService } from '../services/tradingService';
import { type Transaction } from '../types';

// Auth setup
let currentUser = setupProtectedPage();
let walletData: WalletBalance[] = [];

// Cache for coin prices (to avoid too many API calls)
let priceCache: { [key: string]: { price: number; timestamp: number } } = {};
const PRICE_CACHE_DURATION = 60000; // 60 seconds

// Fetch real-time price from Binance API
const getBinancePrice = async (coin: string): Promise<number> => {
    try {
        // USDT and BUSD are stablecoins - always $1
        if (coin.toUpperCase() === 'USDT' || coin.toUpperCase() === 'BUSD' || coin.toUpperCase() === 'USDC') {
            console.log(`💰 ${coin} is stablecoin: $1.00`);
            return 1;
        }

        // Check cache first
        const cached = priceCache[coin];
        if (cached && Date.now() - cached.timestamp < PRICE_CACHE_DURATION) {
            console.log(`💰 ${coin} price from cache: $${cached.price}`);
            return cached.price;
        }

        // Fetch from Binance API
        const symbol = `${coin}USDT`;
        const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
        
        if (!response.ok) {
            console.warn(`⚠️ Could not fetch ${symbol} price`);
            return 0;
        }

        const data = await response.json();
        const price = parseFloat(data.price) || 0;
        
        // Cache the price
        priceCache[coin] = { price, timestamp: Date.now() };
        console.log(`💰 ${coin} price from Binance: $${price}`);
        
        return price;
    } catch (error) {
        console.warn(`⚠️ Error fetching ${coin} price:`, error);
        return 0;
    }
};

// Calculate USD value for all coins
const calculateCoinValues = async (coins: any[]): Promise<any[]> => {
    try {
        console.log('💹 Calculating USD values for coins...');
        
        // Fetch prices in parallel
        const pricePromises = coins.map(coin => 
            getBinancePrice(coin.coin || coin.currency || 'UNKNOWN')
        );
        const prices = await Promise.all(pricePromises);
        
        // Assign prices to coins
        const coinsWithValues = coins.map((coin, index) => {
            const quantity = parseFloat(String(coin.total || coin.balance || 0)) || 0;
            const price = prices[index] || 0;
            const usdValue = quantity * price;
            
            return {
                ...coin,
                price,
                usdValue
            };
        });
        
        console.log(`✅ Calculated USD values:`, coinsWithValues);
        return coinsWithValues;
    } catch (error) {
        console.error('❌ Error calculating coin values:', error);
        return coins; // Return original if calculation fails
    }
};


// Render wallet table from API
const renderWalletTable = async () => {
    const tbody = document.getElementById('spot-wallet-table');
    if (!tbody) return;

    try {
        // Fetch real wallet data from API
        const response = await WalletService.getBalances();
        console.log('💰 Wallet API Response:', response);
        console.log('📊 Response type:', typeof response);
        console.log('📊 Response keys:', Object.keys(response));
        console.log('📊 response.spot:', (response as any).spot);
        console.log('📊 response.funding:', (response as any).funding);
        console.log('📊 Full response:', JSON.stringify(response, null, 2));
        
        // Try different response formats
        let balances = (response as any).spot || [];
        
        // If no spot, try direct array format
        if (balances.length === 0 && Array.isArray(response)) {
            console.log('🔄 Response is array format');
            balances = response as any;
        }
        
        // If still empty, try wallets property
        if (balances.length === 0 && (response as any).wallets && Array.isArray((response as any).wallets)) {
            console.log('🔄 Using response.wallets');
            balances = (response as any).wallets;
        }
        
        // If still empty, try balances property
        if (balances.length === 0 && (response as any).balances && Array.isArray((response as any).balances)) {
            console.log('🔄 Using response.balances');
            balances = (response as any).balances;
        }
        
        walletData = balances;

        console.log(`✅ Got ${balances.length} coins from API:`, balances.map((b: any) => b.coin || b.currency));

        // Calculate USD values from real-time Binance prices
        const balancesWithPrices = await calculateCoinValues(balances);

        // Add available and locked fields to each balance for localStorage
        const balancesWithDetails = balancesWithPrices.map((asset: any) => {
            let total = 0;
            let available = 0;
            let locked = 0;
            
            // Try different field names for balance
            if (asset.total !== undefined) {
                total = parseFloat(String(asset.total)) || 0;
            } else if (asset.balance !== undefined) {
                total = parseFloat(String(asset.balance)) || 0;
            }
            
            if (asset.available !== undefined) {
                available = parseFloat(String(asset.available)) || 0;
            } else if (asset.balance !== undefined) {
                available = parseFloat(String(asset.balance)) || 0;
            }
            
            if (asset.locked !== undefined) {
                locked = parseFloat(String(asset.locked)) || 0;
            } else if (asset.locked_balance !== undefined) {
                locked = parseFloat(String(asset.locked_balance)) || 0;
            }
            
            return {
                ...asset,
                total,
                available,
                locked
            };
        });

        // Sort by USD value (descending) - zeros at end
        balancesWithDetails.sort((a, b) => {
            const aVal = (b.usdValue || 0);
            const bVal = (a.usdValue || 0);
            return aVal - bVal;
        });

        // If no balances, still show empty message but continue to update stats
        if (balancesWithDetails.length === 0) {
            console.log('⚠️ No coins in wallet yet');
            tbody.innerHTML = '<tr><td colspan="6" class="placeholder">Chưa có coin nào. Hãy nạp tiền để bắt đầu.</td></tr>';
            updateWalletStats(response, balancesWithDetails);
            return;
        }

        // Render rows for all coins (including zero balance)
        const rows = balancesWithDetails.map((asset: any) => {
            // Get coin name from either 'coin' or 'currency' field
            const coinName = asset.coin || asset.currency || 'UNKNOWN';
            
            const total = asset.total || 0;
            const available = asset.available || 0;
            const locked = asset.locked || 0;
            
            const usdValue = asset.usdValue ? parseFloat(String(asset.usdValue)) : 0;
            const currentPrice = asset.price || 0;
            
            // Get coin icon from Binance/CryptoIcons CDN
            const coinLower = coinName.toLowerCase();
            const coinIcon = `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${coinLower}.png`;
            
            console.log(`  ${coinName}: total=${total}, available=${available}, locked=${locked}, price=$${currentPrice}, usd=$${usdValue}`);
            
            return `
            <tr>
                <td>
                    <div class="coin-info" style="display: flex; align-items: center; gap: 8px;">
                        <img src="${coinIcon}" alt="${coinName}" style="width: 28px; height: 28px; border-radius: 50%;" onerror="this.style.display='none'">
                        <div class="coin-name">
                            <span style="font-weight: 600;">${coinName}</span>
                            <span class="coin-symbol" style="font-size: 0.85rem; color: #888;">${coinName}</span>
                        </div>
                    </div>
                </td>
                <td>${isNaN(total) || typeof total !== 'number' ? '0' : total.toFixed(8)}</td>
                <td style="color: #26a69a">${isNaN(available) || typeof available !== 'number' ? '0' : available.toFixed(8)}</td>
                <td style="color: #fbbf24">${isNaN(locked) || typeof locked !== 'number' ? '0' : locked.toFixed(8)}</td>
                <td>$${isNaN(usdValue) || typeof usdValue !== 'number' ? '0.00' : usdValue.toFixed(2)}</td>
                <td>
                    <div class="action-btns">
                        <button onclick="depositCoin('${coinName}')" style="background: #26a69a">Nạp</button>
                        <button onclick="withdrawCoin('${coinName}')" style="background: #ef5350">Rút</button>
                    </div>
                </td>
            </tr>
            `;
        }).join('');

        tbody.innerHTML = rows;

        // Save wallet data to localStorage for use in trading panel
        localStorage.setItem('walletData', JSON.stringify(balancesWithDetails.map((coin: any) => ({
            coin: coin.coin || coin.currency,
            available: parseFloat(String(coin.available)) || 0,
            locked: parseFloat(String(coin.locked)) || 0,
            total: parseFloat(String(coin.total)) || 0,
            price: coin.price,
            usdValue: coin.usdValue
        }))));
        console.log('💾 Wallet data saved to localStorage:', balancesWithDetails.map((c: any) => `${c.coin}: ${c.available}`).join(', '));
        
        // Dispatch event to notify OrderPanel and other components to update
        window.dispatchEvent(new Event('walletUpdated'));

        // Update stats
        updateWalletStats(response, balancesWithDetails);

    } catch (error) {
        console.error('❌ Error fetching wallet data:', error);
        console.error('Error details:', {
            message: error.message,
            response: error.response,
            status: error.status
        });
        tbody.innerHTML = `<tr><td colspan="6" class="placeholder">❌ Lỗi: ${error.message}. <br/>Kiểm tra console (F12) để xem chi tiết.</td></tr>`;
    }
};

// Calculate 24h profit from trading positions API
const calculate24hProfit = async (): Promise<{ profit: number; profitPercent: number }> => {
    try {
        // ✅ Use /api/trading/positions endpoint (already implemented)
        console.log('📊 Calculating profit from positions...');
        const positions = await TradingService.getPositions();
        
        // Calculate total PNL from all positions
        const totalPnl = positions.reduce((sum: number, pos: any) => sum + (parseFloat(String(pos.pnl)) || 0), 0);
        const totalInvested = positions.reduce((sum: number, pos: any) => 
            sum + ((parseFloat(String(pos.average_price)) || 0) * (parseFloat(String(pos.quantity)) || 0)), 0
        );
        const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
        
        console.log(`✅ Total PNL: $${totalPnl.toFixed(2)} (${totalPnlPercent.toFixed(2)}%) from ${positions.length} positions`);
        return { profit: totalPnl, profitPercent: totalPnlPercent };
        
    } catch (error) {
        console.warn('⚠️ Could not calculate profit from positions:', error);
        // Fallback: return 0 if positions API fails
        return { profit: 0, profitPercent: 0 };
    }
};

// Update wallet statistics from API
const updateWalletStats = async (response: any, balances: any[]) => {
    try {
        // 1. Update total balance - Get USDT balance as total
        let totalBalance = 0;
        
        // Find USDT balance in the coins list
        const usdtCoin = balances.find((coin: any) => {
            const name = (coin.coin || coin.currency || '').toUpperCase();
            return name === 'USDT';
        });
        
        if (usdtCoin) {
            const usdtAmount = parseFloat(String(usdtCoin.total || usdtCoin.balance || 0)) || 0;
            totalBalance = usdtAmount;
            console.log(`✅ Total balance (USDT): $${totalBalance.toFixed(2)}`);
        } else {
            console.log('⚠️ No USDT coin found - calculating from all USD values');
            // Fallback: sum all USD values if no USDT
            totalBalance = balances.reduce((sum, coin) => {
                const usdValue = parseFloat(String(coin.usdValue)) || 0;
                return sum + usdValue;
            }, 0);
        }
        
        const balanceEl = document.getElementById('total-balance');
        if (balanceEl) {
            balanceEl.textContent = `$${totalBalance.toFixed(2)}`;
            balanceEl.dataset.value = `$${totalBalance.toFixed(2)}`;
        }

        // Get all stat cards
        const statCards = document.querySelectorAll('.stat-card');

        // 2. Update "Tổng tài sản" - Total assets count (first card)
        if (statCards.length >= 1 && balances.length > 0) {
            const firstCard = statCards[0];
            const totalAssetsEl = firstCard.querySelector('.stat-value');
            if (totalAssetsEl) {
                totalAssetsEl.textContent = balances.length.toString();
                console.log(`✅ Total assets: ${balances.length} coins`);
            }
        }

        // 3. Update "Lợi nhuận 24h" - 24h profit (second card)
        if (statCards.length >= 2) {
            const profitCard = statCards[1];
            const profitData = await calculate24hProfit();
            const profitValueEl = profitCard.querySelector('.stat-value');
            const profitChangeEl = profitCard.querySelector('.stat-change');
            
            if (profitValueEl) {
                const profitText = profitData.profit >= 0 
                    ? `+$${profitData.profit.toFixed(2)}` 
                    : `-$${Math.abs(profitData.profit).toFixed(2)}`;
                profitValueEl.textContent = profitText;
                (profitValueEl as HTMLElement).style.color = profitData.profit >= 0 ? '#26a69a' : '#ef5350';
                console.log(`✅ 24h profit: ${profitText}`);
            }
            
            if (profitChangeEl) {
                const percentText = profitData.profitPercent >= 0 
                    ? `+${profitData.profitPercent.toFixed(2)}%`
                    : `${profitData.profitPercent.toFixed(2)}%`;
                const percentIcon = profitData.profitPercent >= 0 
                    ? '<i class="fa-solid fa-arrow-up" style="margin-right: 4px;"></i>' 
                    : '<i class="fa-solid fa-arrow-down" style="margin-right: 4px;"></i>';
                profitChangeEl.innerHTML = percentIcon + percentText;
                (profitChangeEl as HTMLElement).style.color = profitData.profitPercent >= 0 ? '#26a69a' : '#ef5350';
            }
            
            // ✅ Update balance-change span in header
            const balanceChangeEl = document.querySelector('.balance-change');
            if (balanceChangeEl) {
                const changeText = profitData.profit >= 0 
                    ? `+$${profitData.profit.toFixed(2)} (${profitData.profitPercent.toFixed(2)}%) hôm nay` 
                    : `-$${Math.abs(profitData.profit).toFixed(2)} (${profitData.profitPercent.toFixed(2)}%) hôm nay`;
                const arrowIcon = profitData.profit >= 0 
                    ? '<i class="fa-solid fa-arrow-up"></i>' 
                    : '<i class="fa-solid fa-arrow-down"></i>';
                balanceChangeEl.innerHTML = arrowIcon + ' ' + changeText;
                (balanceChangeEl as HTMLElement).style.color = profitData.profit >= 0 ? '#26a69a' : '#ef5350';
                
                // Update class for styling
                balanceChangeEl.classList.remove('positive', 'negative');
                balanceChangeEl.classList.add(profitData.profit >= 0 ? 'positive' : 'negative');
                
                console.log(`✅ Updated balance-change: ${changeText}`);
            }
        }

        // 4. Update "Giao dịch hôm nay" - Today's transaction count (third card)
        try {
            const transactions = await WalletService.getTransactions(undefined, 100, 0);
            
            // Count today's transactions - compare date only (not time)
            const today = new Date();
            const todayDateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
            
            const todayTxs = transactions.filter(tx => {
                if (!tx.created_at) {
                    return false;
                }
                
                try {
                    const txDate = new Date(tx.created_at);
                    
                    // Check if date is valid
                    if (isNaN(txDate.getTime())) {
                        return false;
                    }
                    
                    const txDateStr = txDate.toISOString().split('T')[0]; // YYYY-MM-DD
                    return txDateStr === todayDateStr;
                } catch (error) {
                    return false;
                }
            });

            // 🔍 Group transactions by timestamp (same timestamp = same trade)
            // Backend creates 3 records per trade: main action + fee + received
            const uniqueTimestamps = new Set(todayTxs.map(tx => tx.created_at));
            const uniqueTradeCount = uniqueTimestamps.size;

            console.log(`📊 Today: ${todayTxs.length} transaction records = ${uniqueTradeCount} unique trades`);
            
            // If no transactions today, show total recent transactions instead
            const displayCount = uniqueTradeCount > 0 ? uniqueTradeCount : transactions.length;
            const displayText = uniqueTradeCount > 0 
                ? 'Hoàn thành' 
                : (transactions.length > 0 ? `${transactions.length} giao dịch gần đây` : 'Chưa có');

            // Update transaction count
            if (statCards.length >= 3) {
                const thirdCard = statCards[2];
                const txCountEl = thirdCard.querySelector('.stat-value');
                if (txCountEl) {
                    txCountEl.textContent = uniqueTradeCount > 0 
                        ? uniqueTradeCount.toString() 
                        : (transactions.length > 0 ? transactions.length.toString() : '--');
                    console.log(`✅ Updated today transactions display: ${txCountEl.textContent}`);
                }
                
                // Update transaction change text
                const txChangeEl = thirdCard.querySelector('.stat-change');
                if (txChangeEl) {
                    txChangeEl.textContent = displayText;
                    
                    // Add class based on status
                    if (todayTxs.length > 0) {
                        txChangeEl.className = 'stat-change positive';
                    } else if (transactions.length > 0) {
                        txChangeEl.className = 'stat-change';
                    } else {
                        txChangeEl.className = 'stat-change';
                    }
                    
                    console.log(`✅ Updated transaction status: ${txChangeEl.textContent}`);
                }
            } else {
                console.warn('⚠️ Stat card #3 not found in DOM');
            }
        } catch (txError: any) {
            console.error('❌ Error fetching transactions:', txError);
            console.error('❌ Error message:', txError.message);
            console.error('❌ Error stack:', txError.stack);
            
            // Set default values when API fails
            if (statCards.length >= 3) {
                const thirdCard = statCards[2];
                const txCountEl = thirdCard.querySelector('.stat-value');
                const txChangeEl = thirdCard.querySelector('.stat-change');
                
                if (txCountEl) {
                    txCountEl.textContent = '0';
                }
                if (txChangeEl) {
                    txChangeEl.textContent = 'API chưa sẵn sàng';
                    txChangeEl.classList.add('text-warning');
                }
            }
        }

    } catch (error) {
        console.error('⚠️ Error updating stats:', error);
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

// Search and filter with Binance API
let allCoins: any[] = [];

// Fetch all available coins from Binance
const fetchAllCoins = async () => {
    try {
        const response = await fetch('https://api.binance.com/api/v3/exchangeInfo');
        const data = await response.json();
        allCoins = data.symbols
            .filter((s: any) => s.status === 'TRADING' && s.quoteAsset === 'USDT')
            .map((s: any) => ({
                symbol: s.symbol,
                baseAsset: s.baseAsset,
                quoteAsset: s.quoteAsset
            }));
        console.log(`✅ Loaded ${allCoins.length} coins from Binance`);
    } catch (error) {
        console.error('❌ Failed to fetch coins from Binance:', error);
    }
};

const initFilters = () => {
    const searchInput = document.getElementById('search-coin') as HTMLInputElement;
    const hideZeroCheckbox = document.getElementById('hide-zero-balance') as HTMLInputElement;

    console.log('🔍 Init Filters - Search input:', searchInput);
    console.log('🔍 Init Filters - Hide zero checkbox:', hideZeroCheckbox);

    // Load coins from Binance on init
    fetchAllCoins();

    const filterTable = () => {
        const searchTerm = searchInput?.value.toLowerCase() || '';
        const hideZero = hideZeroCheckbox?.checked || false;
        const rows = document.querySelectorAll('#spot-wallet-table tr');

        console.log('🔍 Filter triggered - Search term:', searchTerm);
        console.log('🔍 Found rows:', rows.length);

        let visibleCount = 0;
        rows.forEach((row, index) => {
            // Skip placeholder row
            const isPlaceholder = row.querySelector('.placeholder');
            if (isPlaceholder) {
                console.log('⏭️ Skipping placeholder row');
                return;
            }

            const coinNameElement = row.querySelector('.coin-name span');
            const coinName = coinNameElement?.textContent?.toLowerCase() || '';
            const coinSymbol = coinNameElement?.textContent?.toLowerCase().replace(/\s+/g, '') || '';
            const totalCell = row.querySelectorAll('td')[1];
            const totalText = totalCell?.textContent?.trim() || '0';
            const totalValue = parseFloat(totalText.replace(/,/g, ''));

            console.log(`Row ${index}: ${coinName}, total: ${totalValue}, text: "${totalText}"`);

            // Search in coin name
            const matchesSearch = searchTerm === '' || coinName.includes(searchTerm) || coinSymbol.includes(searchTerm);
            const matchesZero = !hideZero || totalValue > 0;

            if (matchesSearch && matchesZero) {
                (row as HTMLElement).style.display = '';
                visibleCount++;
            } else {
                (row as HTMLElement).style.display = 'none';
            }
        });

        console.log(`✅ Visible rows: ${visibleCount} / ${rows.length}`);

        // Show search suggestions from Binance if search term exists
        if (searchTerm.length > 0 && allCoins.length > 0) {
            const suggestions = allCoins.filter(coin => 
                coin.baseAsset.toLowerCase().includes(searchTerm) ||
                coin.symbol.toLowerCase().includes(searchTerm)
            ).slice(0, 10);
            
            if (suggestions.length > 0) {
                console.log('💡 Suggestions from Binance:', suggestions.map(s => s.baseAsset).join(', '));
            } else {
                console.log('💡 No suggestions found for:', searchTerm);
            }
        }
    };

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            console.log('⌨️ Input event triggered:', (e.target as HTMLInputElement).value);
            filterTable();
        });
    } else {
        console.error('❌ Search input not found!');
    }

    if (hideZeroCheckbox) {
        hideZeroCheckbox.addEventListener('change', () => {
            console.log('☑️ Checkbox changed:', hideZeroCheckbox.checked);
            filterTable();
        });
    } else {
        console.error('❌ Hide zero checkbox not found!');
    }
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
(window as any).depositCoin = async (coin: string) => {
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

// Handle deposit form submission
(window as any).handleDeposit = async () => {
    const coinSelect = document.getElementById('deposit-coin') as HTMLSelectElement;
    const networkSelect = document.getElementById('deposit-network') as HTMLSelectElement;
    const addressContainer = document.getElementById('deposit-address-container');
    const addressDisplay = document.getElementById('deposit-address-display');
    const copyBtn = document.getElementById('copy-deposit-btn');

    if (!coinSelect.value || !networkSelect.value) {
        alert('Vui lòng chọn coin và mạng');
        return;
    }

    try {
        const btn = event?.target as HTMLButtonElement;
        if (btn) btn.disabled = true;
        if (btn) btn.textContent = '⏳ Đang lấy...';

        const result = await WalletService.getDepositAddress(coinSelect.value, networkSelect.value);
        
        if (addressDisplay) {
            addressDisplay.textContent = result.address;
            addressDisplay.dataset.address = result.address;
        }

        if (addressContainer) {
            addressContainer.style.display = 'block';
        }

        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Lấy địa chỉ';
        }
    } catch (error) {
        alert(`❌ Lỗi: ${error instanceof Error ? error.message : 'Không thể lấy địa chỉ'}`);
        if (event?.target) {
            (event.target as HTMLButtonElement).disabled = false;
            (event.target as HTMLButtonElement).textContent = 'Lấy địa chỉ';
        }
    }
};

// Copy deposit address
(window as any).copyDepositAddress = () => {
    const addressDisplay = document.getElementById('deposit-address-display');
    if (addressDisplay && addressDisplay.textContent) {
        navigator.clipboard.writeText(addressDisplay.textContent);
        alert('✅ Đã sao chép địa chỉ vào clipboard');
    }
};

// Handle withdraw form submission
(window as any).handleWithdraw = async () => {
    const coinSelect = document.getElementById('withdraw-coin') as HTMLSelectElement;
    const addressInput = document.getElementById('withdraw-address') as HTMLInputElement;
    const amountInput = document.getElementById('withdraw-amount') as HTMLInputElement;
    const networkSelect = document.getElementById('withdraw-network') as HTMLSelectElement;

    if (!coinSelect.value || !networkSelect.value || !addressInput.value || !amountInput.value) {
        alert('Vui lòng điền đầy đủ thông tin');
        return;
    }

    const amount = parseFloat(amountInput.value);
    if (amount <= 0) {
        alert('Số lượng phải lớn hơn 0');
        return;
    }

    if (!confirm('⚠️ Vui lòng kiểm tra kỹ thông tin. Giao dịch không thể hoàn tác!')) {
        return;
    }

    try {
        const btn = event?.target as HTMLButtonElement;
        if (btn) {
            btn.disabled = true;
            btn.textContent = '⏳ Đang xử lý...';
        }

        const result = await WalletService.createWithdraw({
            currency: coinSelect.value,
            amount: amount,
            address: addressInput.value,
            network: networkSelect.value,
        });

        alert(`✅ Yêu cầu rút tiền được tạo thành công!\nID: ${result.id}\nTrạng thái: ${result.status}`);

        // Reset form and close modal
        coinSelect.value = '';
        addressInput.value = '';
        amountInput.value = '';
        networkSelect.value = '';
        
        const modal = document.getElementById('withdrawModal');
        if (modal) modal.classList.remove('show');

        // Refresh wallet data and transactions
        await renderWalletTable();
        if ((window as any).renderTransactions) {
            await (window as any).renderTransactions();
        }

        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Xác nhận rút tiền';
        }
    } catch (error) {
        alert(`❌ Lỗi: ${error instanceof Error ? error.message : 'Không thể tạo yêu cầu rút'}`);
        if (event?.target) {
            (event.target as HTMLButtonElement).disabled = false;
            (event.target as HTMLButtonElement).textContent = 'Xác nhận rút tiền';
        }
    }
};

// Render transactions from API
(window as any).renderTransactions = async () => {
    const tbody = document.getElementById('transactions-table');
    if (!tbody) return;

    try {
        const transactions = await WalletService.getTransactions(undefined, 20, 0);

        if (transactions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="placeholder">Không có giao dịch nào</td></tr>';
            return;
        }

        const rows = transactions.map(tx => {
            // Parse transaction type from backend format (e.g., "pending_sell_received", "market_buy", etc.)
            const typeIcon = tx.type.includes('deposit') || tx.type.includes('received') ? '📥' : 
                           tx.type.includes('withdraw') || tx.type.includes('sent') ? '📤' : 
                           tx.type.includes('transfer') ? '↔️' : '💱';
            const typeLabel = tx.type.includes('deposit') || tx.type.includes('received') ? 'Nạp' : 
                            tx.type.includes('withdraw') || tx.type.includes('sent') ? 'Rút' : 
                            tx.type.includes('transfer') ? 'Chuyển' : 'Trading';
            
            // Determine status from type (pending_ prefix means pending)
            let statusColor = '#26a69a';
            let statusLabel = '✅ Thành công';
            if (tx.type.startsWith('pending_')) {
                statusColor = '#fbbf24';
                statusLabel = '⏳ Đang xử lý';
            } else if (tx.type.includes('failed')) {
                statusColor = '#ef5350';
                statusLabel = '❌ Thất bại';
            }

            const date = new Date(tx.created_at).toLocaleString('vi-VN');
            const txId = tx.id.substring(0, 10) + '...';
            // Convert amount to number in case it's a string
            const amountNum = typeof tx.amount === 'string' ? parseFloat(tx.amount) : tx.amount;
            const amountFormatted = isNaN(amountNum) ? '0.00' : amountNum.toFixed(8);

            return `
            <tr>
                <td style="color: #888">${typeIcon} ${typeLabel}</td>
                <td style="font-weight: 600">${tx.currency}</td>
                <td>${amountFormatted}</td>
                <td style="color: ${statusColor}">${statusLabel}</td>
                <td style="font-size: 0.85rem; color: #888">${date}</td>
                <td style="font-size: 0.8rem; color: #888">${txId}</td>
            </tr>
            `;
        }).join('');

        tbody.innerHTML = rows;
    } catch (error) {
        console.error('❌ Error fetching transactions:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="placeholder">❌ Lỗi tải giao dịch</td></tr>';
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Setup auth guard first
    currentUser = setupProtectedPage();
    
    if (!currentUser) {
        return;
    }
    
    console.log('💰 Wallet loaded for user:', currentUser.username);
    console.log('Wallet page initialized');
    
    // Setup logout button
    setupLogoutButton('#logout-btn');
    
    await renderWalletTable();
    await (window as any).renderTransactions();
    initTabs();
    initModals();
    initFilters();
    initBalanceToggle();
    initMaxButton();
    
    // ✅ Listen for PNL updates from trading panel
    window.addEventListener('pnlUpdated', async (event: Event) => {
        const customEvent = event as CustomEvent;
        const { totalPnl, totalPnlPercent, positionsCount } = customEvent.detail;
        console.log(`📊 [wallet.tsx] pnlUpdated event received: $${totalPnl.toFixed(2)} (${totalPnlPercent.toFixed(2)}%)`);
        
        // Update "Lợi nhuận 24h" stat card (second card)
        const statCards = document.querySelectorAll('.stat-card');
        if (statCards.length >= 2) {
            const profitCard = statCards[1];
            const profitValueEl = profitCard.querySelector('.stat-value');
            const profitChangeEl = profitCard.querySelector('.stat-change');
            
            // Update profit value (dollar amount)
            if (profitValueEl) {
                const profitText = totalPnl >= 0 
                    ? `+$${totalPnl.toFixed(2)}` 
                    : `-$${Math.abs(totalPnl).toFixed(2)}`;
                profitValueEl.textContent = profitText;
                (profitValueEl as HTMLElement).style.color = totalPnl >= 0 ? '#26a69a' : '#ef5350';
                console.log(`✅ Updated profit value: ${profitText}`);
            }
            
            // Update profit percentage
            if (profitChangeEl) {
                const percentText = totalPnlPercent >= 0 
                    ? `+${totalPnlPercent.toFixed(2)}%`
                    : `${totalPnlPercent.toFixed(2)}%`;
                const percentIcon = totalPnlPercent >= 0 
                    ? '<i class="fa-solid fa-arrow-up" style="margin-right: 4px;"></i>' 
                    : '<i class="fa-solid fa-arrow-down" style="margin-right: 4px;"></i>';
                profitChangeEl.innerHTML = percentIcon + percentText;
                (profitChangeEl as HTMLElement).style.color = totalPnlPercent >= 0 ? '#26a69a' : '#ef5350';
                console.log(`✅ Updated profit %: ${percentText}`);
            }
        }
        
        // Update balance-change span in header
        const balanceChangeEl = document.querySelector('.balance-change');
        if (balanceChangeEl) {
            const changeText = totalPnl >= 0 
                ? `+$${totalPnl.toFixed(2)} (${totalPnlPercent.toFixed(2)}%)` 
                : `-$${Math.abs(totalPnl).toFixed(2)} (${totalPnlPercent.toFixed(2)}%)`;
            balanceChangeEl.textContent = changeText;
            (balanceChangeEl as HTMLElement).style.color = totalPnl >= 0 ? '#26a69a' : '#ef5350';
            console.log(`✅ Updated balance-change: ${changeText}`);
        }
    });
});
