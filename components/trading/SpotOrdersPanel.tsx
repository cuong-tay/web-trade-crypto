import React, { useState, useEffect } from 'react';
import { TradingService, type Order, type Trade } from '../../services/tradingService';
import { useTradingContext } from '../../context/TradingContext';
import { API_BASE_URL } from '../../config/api';

interface SelectedOrder extends Order {
  tradeDetails?: Trade;
}

interface HoldingAsset {
  coin: string;
  available: number;
  locked: number;
  total: number;
  price: number;
  usdValue: number;
}

const SpotOrdersPanel: React.FC = () => {
  const { symbol, lastPrice, lastChartTime } = useTradingContext();
  
  // State for different tabs
  const [activeTab, setActiveTab] = useState<'pending' | 'assets' | 'history'>('pending');
  const [selectedOrder, setSelectedOrder] = useState<SelectedOrder | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  
  // Pending Orders (Lệnh chờ)
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  
  // Holdings/Assets (Tài sản giao dịch thành công)
  const [holdings, setHoldings] = useState<HoldingAsset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  
  // Trade History (Lịch sử giao dịch)
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loadingTrades, setLoadingTrades] = useState(false);
  
  // Cancellation
  const [cancelling, setCancelling] = useState<string | null>(null);
  
  // Auto-refresh interval
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Refresh trigger for wallet updates
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch pending orders
  const fetchPendingOrders = async () => {
    setLoadingPending(true);
    try {
      console.log('🔵 [SPOT Panel] Fetching pending SPOT orders...');
      const pending = await TradingService.getPendingOrders(symbol);
      console.log('📥 [SPOT Panel] Raw pending orders from API:', pending);
      
      // Only show LIMIT orders in pending tab (MARKET orders execute immediately)
      const limitOrders = pending.filter((order: Order) => {
        const isLimit = order.order_type === 'limit' || (order.order_type as string).toUpperCase() === 'LIMIT';
        console.log(`  - [SPOT Panel] Order #${order.id}: type=${order.order_type} (isLimit=${isLimit})`);
        return isLimit;
      });
      console.log('✅ [SPOT Panel] Pending LIMIT orders filtered:', limitOrders.length, 'orders');
      setPendingOrders(limitOrders);
    } catch (error) {
      console.error('❌ Error fetching pending orders:', error);
      setPendingOrders([]);
    } finally {
      setLoadingPending(false);
    }
  };

  // Fetch positions for PNL calculation (silent - không update UI)
  const fetchPositionsForPnl = async () => {
    console.log('🚀 [fetchPositionsForPnl] Fetching positions for PNL calculation...');
    try {
      const positions = await TradingService.getPositions();
      console.log('📊 [fetchPositionsForPnl] Positions fetched:', positions);
      
      // ✅ Tính tổng PNL
      const totalPnl = positions.reduce((sum: number, pos: any) => sum + (parseFloat(String(pos.pnl)) || 0), 0);
      const totalInvested = positions.reduce((sum: number, pos: any) => 
        sum + ((parseFloat(String(pos.average_price)) || 0) * (parseFloat(String(pos.quantity)) || 0)), 0
      );
      const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
      
      console.log(`💰 [fetchPositionsForPnl] Total PNL: $${totalPnl.toFixed(2)} (${totalPnlPercent.toFixed(2)}%)`);
      console.log(`📊 [fetchPositionsForPnl] Total Invested: $${totalInvested.toFixed(2)}`);
      
      // ✅ Dispatch custom event với PNL data cho dashboard/wallet
      const pnlEvent = new CustomEvent('pnlUpdated', {
        detail: {
          totalPnl: totalPnl,
          totalPnlPercent: totalPnlPercent,
          totalInvested: totalInvested,
          positionsCount: positions.length,
          timestamp: Date.now(),
        }
      });
      window.dispatchEvent(pnlEvent);
      console.log('✅ [fetchPositionsForPnl] pnlUpdated event dispatched');
      
    } catch (error) {
      console.error('❌ [fetchPositionsForPnl] Error:', error);
    }
  };

  // Fetch holdings from wallet API
  const fetchHoldings = async () => {
    setLoadingAssets(true);
    console.log('🚀 [fetchHoldings] Starting...');
    try {
      // Load from wallet data saved in localStorage
      const savedWallet = localStorage.getItem('walletData');
      console.log('📦 [fetchHoldings] walletData in localStorage:', savedWallet ? `${JSON.parse(savedWallet).length} items` : 'EMPTY');
      
      if (savedWallet) {
        const walletData = JSON.parse(savedWallet) as HoldingAsset[];
        console.log('💰 [fetchHoldings] Parsed wallet data:', walletData);
        // Filter out coins with 0 total balance
        const activeHoldings = walletData.filter((coin: HoldingAsset) => coin.total > 0);
        console.log('✅ [fetchHoldings] Holdings loaded from wallet:', activeHoldings);
        setHoldings(activeHoldings);
      } else {
        // If localStorage is empty, fetch from API
        console.warn('⚠️ [fetchHoldings] No wallet data in localStorage, fetching from API...');
        
        try {
          const response = await fetch(`${API_BASE_URL}/wallet/balances`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
              'Content-Type': 'application/json'
            }
          });

          console.log('📥 [fetchHoldings] API Response status:', response.status);

          if (response.ok) {
            const data = await response.json();
            console.log('📊 [fetchHoldings] API Response data:', data);
            let balances = (data as any).spot || [];
            
            if (balances.length === 0 && Array.isArray(data)) {
              balances = data as any;
            }
            
            if (balances.length === 0 && (data as any).wallets) {
              balances = (data as any).wallets;
            }
            
            if (balances.length === 0 && (data as any).balances) {
              balances = (data as any).balances;
            }

            console.log('🔄 [fetchHoldings] Balances extracted:', balances.length, 'items');

            // Save to localStorage
            const balancesForStorage = balances.map((asset: any) => {
              // If available is undefined/null, use total instead
              const available = asset.available !== undefined && asset.available !== null 
                ? parseFloat(String(asset.available)) 
                : parseFloat(String(asset.total || 0));
              const locked = asset.locked !== undefined && asset.locked !== null
                ? parseFloat(String(asset.locked))
                : parseFloat(String(asset.locked_balance || 0));
              const total = parseFloat(String(asset.total || asset.balance || 0));
              
              console.log(`[SpotOrdersPanel] Mapping ${asset.coin}: available=${available}, locked=${locked}, total=${total}`);
              
              return {
                coin: asset.coin || asset.currency,
                available: available || 0,
                locked: locked || 0,
                total: total || 0,
                price: asset.price || 0,
                usdValue: asset.usdValue || 0
              };
            });

            console.log('💾 [fetchHoldings] Saving to localStorage:', balancesForStorage);
            localStorage.setItem('walletData', JSON.stringify(balancesForStorage));
            
            const activeHoldings = balancesForStorage.filter((coin: HoldingAsset) => coin.total > 0);
            console.log('✅ [fetchHoldings] Holdings fetched from API:', activeHoldings);
            setHoldings(activeHoldings);
            
            window.dispatchEvent(new Event('walletUpdated'));
          } else {
            console.error('❌ [fetchHoldings] Failed to fetch wallet from API, status:', response.status);
            setHoldings([]);
          }
        } catch (apiError) {
          console.error('❌ [fetchHoldings] Error fetching wallet from API:', apiError);
          setHoldings([]);
        }
      }
    } catch (error) {
      console.error('❌ [fetchHoldings] Error fetching holdings:', error);
      setHoldings([]);
    } finally {
      setLoadingAssets(false);
      console.log('✅ [fetchHoldings] Done');
    }
  };

  // Fetch trade history
  const fetchTrades = async () => {
    setLoadingTrades(true);
    try {
      const tradesData = await TradingService.getTrades(symbol, 50, 0);
      console.log('✅ Trades fetched:', tradesData);
      console.log(`📊 Total trades: ${tradesData.length}`);
      
      // Show breakdown by type
      if (tradesData.length > 0) {
        const byType = tradesData.reduce((acc: any, t: any) => {
          const type = t.order_type || 'unknown';
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {});
        console.log(`📈 By type:`, byType);
      }
      
      setTrades(tradesData);
    } catch (error) {
      console.error('❌ Error fetching trades:', error);
      setTrades([]);
    } finally {
      setLoadingTrades(false);
    }
  };

  // Listen for wallet updates
  useEffect(() => {
    const handleWalletUpdate = () => {
      console.log('🔄 Wallet updated, refreshing all data...');
      
      // Reload wallet data from localStorage
      const savedWallet = localStorage.getItem('walletData');
      if (savedWallet) {
        const updatedWalletData = JSON.parse(savedWallet);
        console.log('💾 Reloaded walletData from localStorage:', updatedWalletData);
        
        // Update holdings for Holdings tab
        const activeHoldings = updatedWalletData.filter((coin: HoldingAsset) => coin.total > 0);
        setHoldings(activeHoldings);
        console.log('✅ Holdings refreshed:', activeHoldings);
      }
      
      // ✅ Trigger refresh for trades and pending orders
      setRefreshTrigger(prev => prev + 1);
    };

    window.addEventListener('walletUpdated', handleWalletUpdate);
    return () => window.removeEventListener('walletUpdated', handleWalletUpdate);
  }, []);
  
  // Initial fetch and setup auto-refresh
  useEffect(() => {
    console.log('🚀 [SpotOrdersPanel mount] Component mounted, fetching data...');
    
    // Fetch ALL data ngay khi component mount để tab hiển thị dữ liệu ngay
    console.log('📞 [SpotOrdersPanel mount] Calling fetchPendingOrders()');
    fetchPendingOrders();
    
    console.log('📞 [SpotOrdersPanel mount] Calling fetchHoldings()');
    fetchHoldings();
    
    console.log('📞 [SpotOrdersPanel mount] Calling fetchTrades()');
    fetchTrades();

    // Auto-refresh every 5 seconds (chỉ refresh tab active để tiết kiệm bandwidth)
    const refreshInterval = setInterval(() => {
      if (autoRefresh) {
        if (activeTab === 'pending') fetchPendingOrders();
        else if (activeTab === 'assets') fetchHoldings();
        else if (activeTab === 'history') fetchTrades();
      }
    }, 5000);

    return () => clearInterval(refreshInterval);
  }, [symbol, autoRefresh, activeTab, refreshTrigger]);

  // 🎯 Monitor pending LIMIT orders and auto-fill when price conditions are met
  useEffect(() => {
    if (!pendingOrders || pendingOrders.length === 0 || lastPrice === 0) {
      return;
    }

    // For each pending LIMIT order, check if price condition is met
    const checkAndFillPendingOrders = async () => {
      console.log(`📊 Checking ${pendingOrders.length} pending orders against market price: ${lastPrice}`);
      
      for (const order of pendingOrders) {
        console.log(`🔍 Order #${order.id}: status=${order.status}, order_type=${order.order_type}, side=${order.side}, price=${order.price}`);
        
        // Check for both 'limit'/'LIMIT' variants
        const isLimitOrder = order.order_type === 'limit' || (order.order_type as string).toUpperCase() === 'LIMIT';
        const isPending = order.status === 'pending' || (order.status as string).toUpperCase() === 'PENDING';
        
        if (!isPending || !isLimitOrder) {
          console.log(`⏭️  Bỏ qua: isPending=${isPending}, isLimitOrder=${isLimitOrder}`);
          continue;
        }

        const limitPrice = parseFloat(String(order.price)) || 0;
        const marketPrice = lastPrice;
        
        // Normalize side to uppercase (backend returns 'BUY'/'SELL')
        const side = String(order.side).toUpperCase();
        
        // ✅ Check if limit order should be filled
        // - MUA (BUY): Khớp khi giá thị trường <= giá limit (thị trường xuống đến mức mua được)
        // - BÁN (SELL): Khớp khi giá thị trường >= giá limit (thị trường lên đến mức bán được)
        const shouldFill = (side === 'BUY' && marketPrice <= limitPrice) || 
                         (side === 'SELL' && marketPrice >= limitPrice);
        
        console.log(`💰 shouldFill check: side=${side}, market=${marketPrice}, limit=${limitPrice} => shouldFill=${shouldFill}`);

        if (shouldFill) {
          console.log(`✨ Lệnh ${side} #${order.id} sẽ khớp! Limit: ${limitPrice}, Market: ${marketPrice}`);
          
          try {
            // Call fill-trade API to match the order
            const fillResponse = await TradingService.fillTrade(order.id, limitPrice, order.quantity, Date.now());
            console.log(`✅ Pending order #${order.id} filled successfully!`, fillResponse);

            // Update wallet from response
            if (fillResponse.wallet_updates) {
              console.log('💰 Cập nhật wallet từ auto-fill response:', fillResponse.wallet_updates);
              
              // Load current wallet from localStorage
              const savedWallet = localStorage.getItem('walletData');
              let walletData = savedWallet ? JSON.parse(savedWallet) : [];
              
              let updatedBalances = [...walletData];
              
              // Update ALL coins in wallet_updates
              updatedBalances = walletData.map((balance: any) => {
                if (fillResponse.wallet_updates[balance.coin]) {
                  const update = fillResponse.wallet_updates[balance.coin];
                  console.log(`💰 Update ${balance.coin}: ${balance.available} → ${update.balance}`);
                  return {
                    ...balance,
                    available: update.balance,
                    locked: 0,
                    total: update.balance,
                  };
                }
                return balance;
              });
              
              // Add new coins if they don't exist in walletData but are in wallet_updates
              Object.keys(fillResponse.wallet_updates).forEach(coin => {
                if (!walletData.find((b: any) => b.coin === coin)) {
                  console.log(`➕ Thêm coin mới từ auto-fill: ${coin}`);
                  updatedBalances.push({
                    coin,
                    available: fillResponse.wallet_updates[coin].balance,
                    locked: 0,
                    total: fillResponse.wallet_updates[coin].balance,
                    price: 0,
                    usdValue: 0,
                  });
                }
              });
              
              // Save updated wallet to localStorage
              localStorage.setItem('walletData', JSON.stringify(updatedBalances));
              
              // Update holdings state
              const refreshedHoldings = updatedBalances.filter((asset: any) => asset.total > 0);
              setHoldings(refreshedHoldings);
              window.dispatchEvent(new Event('walletUpdated'));
              
              console.log('✨ Wallet updated from auto-fill:', updatedBalances);
              
              // ✅ Fetch positions for PNL calculation (silent - không ảnh hưởng UI)
              await fetchPositionsForPnl();
              
              // Show notification to user
              const message = `✅ Lệnh ${side} ${order.symbol} @ ${limitPrice} đã khớp!`;
              console.log(`🔔 ${message}`);
              alert(message);
            }

            // Refresh BOTH pending orders and trade history
            console.log('🔄 Refreshing pending orders and trade history after fill...');
            await fetchPendingOrders();
            await fetchTrades();
            
          } catch (error) {
            console.error(`❌ Failed to auto-fill pending order #${order.id}:`, error);
            // Continue checking other orders even if one fails
          }
        }
      }
    };

    // Run check after a small delay to avoid too frequent checks
    const timeoutId = setTimeout(checkAndFillPendingOrders, 100);
    return () => clearTimeout(timeoutId);

  }, [lastPrice, pendingOrders]);

  // Cancel order
  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Bạn có chắc muốn hủy lệnh này?')) return;

    setCancelling(orderId);
    try {
      // Backend sẽ trả về wallet_update/wallet_updates khi hủy lệnh
      const cancelResponse = await TradingService.cancelOrder(orderId);
      console.log('✅ Order cancelled:', orderId, cancelResponse);
      
      // ✅ Cập nhật wallet từ response (không cần fetch lại)
      // Logic: balance tăng lại khi cancel order (hoàn tiền)
      if (cancelResponse.wallet_update || cancelResponse.wallet_updates) {
        console.log('💰 Cập nhật wallet từ response:', cancelResponse.wallet_update || cancelResponse.wallet_updates);
        
        // Lấy walletData từ localStorage
        const savedWallet = localStorage.getItem('walletData');
        let walletData = savedWallet ? JSON.parse(savedWallet) : [];
        
        let updatedBalances = [...walletData];
        
        // Xử lý wallet_updates (multiple coins)
        if (cancelResponse.wallet_updates) {
          const walletUpdates = cancelResponse.wallet_updates;
          console.log('📊 wallet_updates coins:', Object.keys(walletUpdates));
          
          // Update TẤT CẢ coins có trong wallet_updates
          updatedBalances = walletData.map((balance: any) => {
            if (walletUpdates[balance.coin]) {
              const update = walletUpdates[balance.coin];
              console.log(`💰 Update ${balance.coin}: ${balance.available} → ${update.balance}`);
              return {
                ...balance,
                available: update.balance,  // ← Chỉ có balance (= available)
                locked: 0,
                total: update.balance,
              };
            }
            return balance;
          });
          
          // Add coins mới nếu chúng không có trong walletData nhưng có trong wallet_updates
          Object.keys(walletUpdates).forEach(coin => {
            if (!walletData.find((b: any) => b.coin === coin)) {
              console.log(`➕ Thêm coin mới: ${coin}`);
              updatedBalances.push({
                coin,
                available: walletUpdates[coin].balance,
                locked: 0,
                total: walletUpdates[coin].balance,
                price: 0,
                usdValue: 0,
              });
            }
          });
        }
        // Xử lý wallet_update (single coin - deprecated)
        else if (cancelResponse.wallet_update) {
          console.warn('⚠️ Using deprecated wallet_update (single coin) - backend should return wallet_updates');
          const cancelledOrder = pendingOrders.find(o => o.id === orderId);
          const quoteAsset = cancelledOrder?.symbol.replace(/USDT$/, 'USDT') || 'USDT';
          
          const walletUpdate = cancelResponse.wallet_update;
          updatedBalances = walletData.map((balance: any) => {
            if (balance.coin === quoteAsset) {
              return {
                ...balance,
                available: walletUpdate.balance,  // ← Chỉ có balance (= available)
                locked: 0,
                total: walletUpdate.balance,
              };
            }
            return balance;
          });
        }
        
        localStorage.setItem('walletData', JSON.stringify(updatedBalances));

        // Cập nhật holdings state ngay để phản ánh thay đổi tức thì
        const refreshedHoldings = updatedBalances.filter((asset: any) => asset.total > 0);
        setHoldings(refreshedHoldings);
        window.dispatchEvent(new Event('walletUpdated'));
        
        console.log('✨ Wallet cập nhật từ response thành công:', updatedBalances);
      } else {
        console.warn('⚠️ Response không có wallet_update/wallet_updates - backend nên luôn trả về!');
      }
      
      // ✅ Fetch positions for PNL calculation (silent - không ảnh hưởng UI)
      await fetchPositionsForPnl();
      
      // Refresh pending orders list
      await fetchPendingOrders();
      
      alert('✅ Đã hủy lệnh thành công!');
    } catch (error) {
      console.error('❌ Error cancelling order:', error);
      alert('❌ Hủy lệnh thất bại!');
    } finally {
      setCancelling(null);
    }
  };

  // Get order details
  const handleViewDetails = async (orderId: string) => {
    try {
      const order = await TradingService.getOrderById(orderId);
      setSelectedOrder(order);
    } catch (error) {
      console.error('❌ Error fetching order details:', error);
      alert('❌ Không thể tải chi tiết lệnh!');
    }
  };

  // Format timestamp to readable time (handle both ms and seconds)
  const formatTime = (timestamp: number | string | undefined) => {
    if (!timestamp) return 'N/A';
    
    try {
      let time: number;
      
      if (typeof timestamp === 'string') {
        // Try to parse as ISO string first (from backend)
        if (timestamp.includes('T') || timestamp.includes('-')) {
          time = new Date(timestamp).getTime();
        } else {
          time = parseInt(timestamp);
        }
      } else {
        time = timestamp;
      }
      
      // Validate
      if (isNaN(time) || time <= 0) {
        console.log(`[formatTime] Invalid time: ${timestamp}`);
        return 'N/A';
      }
      
      // Convert to milliseconds if in seconds (timestamps < 10 billion)
      if (time < 10000000000) {
        time = time * 1000;
      }
      
      // Format directly in Vietnam timezone (GMT+7)
      const formatted = new Date(time).toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      
      return formatted;
    } catch (e) {
      console.error(`[formatTime] Error:`, e, timestamp);
      return 'N/A';
    }
  };

  // Handle edit order price
  const handleEditOrder = (order: Order) => {
    setEditingOrderId(order.id);
    setEditPrice(String(order.price || ''));
  };

  const handleSaveEditOrder = async () => {
    if (!editingOrderId) return;
    
    const newPrice = parseFloat(editPrice);
    if (isNaN(newPrice) || newPrice <= 0) {
      alert('❌ Giá không hợp lệ!');
      return;
    }

    try {
      // Find the order being edited
      const orderToEdit = pendingOrders.find(o => o.id === editingOrderId);
      if (!orderToEdit) {
        throw new Error('Không tìm thấy lệnh');
      }

      console.log(`🔄 Updating order #${editingOrderId}: Cancel old & create new with price ${newPrice}`);
      
      // Step 1: Cancel the old order
      console.log('📤 Step 1: Cancelling old order...');
      const cancelResponse = await TradingService.cancelOrder(editingOrderId);
      console.log('✅ Order cancelled:', cancelResponse);

      // Update wallet from cancel response
      if (cancelResponse.wallet_updates) {
        const savedWallet = localStorage.getItem('walletData');
        let walletData = savedWallet ? JSON.parse(savedWallet) : [];
        
        let updatedBalances = walletData.map((balance: any) => {
          if (cancelResponse.wallet_updates[balance.coin]) {
            return {
              ...balance,
              available: cancelResponse.wallet_updates[balance.coin].balance,
              locked: 0,
              total: cancelResponse.wallet_updates[balance.coin].balance,
            };
          }
          return balance;
        });
        
        localStorage.setItem('walletData', JSON.stringify(updatedBalances));
        const refreshedHoldings = updatedBalances.filter((asset: any) => asset.total > 0);
        setHoldings(refreshedHoldings);
        window.dispatchEvent(new Event('walletUpdated'));
      }

      // Step 2: Create new order with new price
      console.log('📤 Step 2: Creating new order with new price...');
      const newOrderResponse = await TradingService.createOrder({
        symbol: orderToEdit.symbol,
        side: orderToEdit.side.toUpperCase() as 'BUY' | 'SELL',
        quantity: orderToEdit.quantity,
        order_type: 'limit',
        price: newPrice,
      });
      console.log('✅ New order created:', newOrderResponse);

      alert('✅ Cập nhật giá lệnh thành công!');
      setEditingOrderId(null);
      setEditPrice('');
      await fetchPendingOrders();
    } catch (error) {
      console.error('❌ Error updating order:', error);
      alert('❌ Cập nhật giá lệnh thất bại!');
    }
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    background: '#1e222d',
    borderRadius: '4px',
    padding: '1rem',
    gap: '1rem',
    boxSizing: 'border-box',
    overflow: 'hidden', // ✅ Prevent outer container from scrolling
  };

  const tabsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '0.5rem',
    borderBottom: '1px solid #2a2e39',
    paddingBottom: '0.5rem',
    flexShrink: 0, // ✅ Tabs don't shrink
  };

  const tabButtonStyle = (isActive: boolean): React.CSSProperties => ({
    padding: '0.5rem 1rem',
    background: isActive ? '#363c4f' : 'transparent',
    border: 'none',
    borderBottom: isActive ? '2px solid #26a69a' : 'none',
    color: isActive ? '#d1d4dc' : '#888',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: isActive ? 600 : 400,
    transition: 'all 0.2s',
  });

  const contentStyle: React.CSSProperties = {
    flex: 1,
    minHeight: 0, // ✅ Allow flex item to shrink below content size
    overflowY: 'auto', // ✅ Enable vertical scrolling
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  };

  const tableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '0.8rem',
  };

  const rowStyle: React.CSSProperties = {
    borderBottom: '1px solid #2a2e39',
  };

  const cellStyle: React.CSSProperties = {
    padding: '0.5rem',
    textAlign: 'left',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.3rem 0.6rem',
    fontSize: '0.75rem',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontWeight: 600,
  };

  return (
    <div style={containerStyle}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        gap: '0.5rem',
        flexShrink: 0 // ✅ Header doesn't shrink
      }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>📊 Lệnh Giao Dịch</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', color: '#888', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          Tự động làm mới
        </label>
      </div>

      {/* Tabs */}
      <div style={tabsStyle}>
        <button
          style={tabButtonStyle(activeTab === 'pending')}
          onClick={() => { setActiveTab('pending'); setSelectedOrder(null); }}
        >
          Đang chờ ({pendingOrders.length})
        </button>
        <button
          style={tabButtonStyle(activeTab === 'assets')}
          onClick={() => { setActiveTab('assets'); setSelectedOrder(null); }}
        >
          Tài sản ({holdings.length})
        </button>
        <button
          style={tabButtonStyle(activeTab === 'history')}
          onClick={() => { setActiveTab('history'); setSelectedOrder(null); }}
        >
          Lịch sử ({trades.length})
        </button>
      </div>

      {/* Content */}
      <div style={contentStyle}>
        {/* Selected Order Details Modal */}
        {selectedOrder && (
          <div style={{
            background: '#282c34',
            border: '1px solid #26a69a',
            borderRadius: '4px',
            padding: '0.75rem',
            marginBottom: '0.5rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#26a69a' }}>
                Chi tiết lệnh: {selectedOrder.id}
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#d1d4dc', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              <div><span style={{ color: '#888' }}>Cặp:</span> {selectedOrder.symbol}</div>
              <div><span style={{ color: '#888' }}>Phía:</span> <span style={{ color: selectedOrder.side === 'BUY' ? '#26a69a' : '#ef5350' }}>{selectedOrder.side}</span></div>
              <div><span style={{ color: '#888' }}>Loại:</span> {selectedOrder.order_type}</div>
              <div><span style={{ color: '#888' }}>Trạng thái:</span> {selectedOrder.status}</div>
              <div><span style={{ color: '#888' }}>Giá:</span> ${parseFloat(String(selectedOrder.price)) > 0 ? parseFloat(String(selectedOrder.price)).toFixed(2) : 'N/A'}</div>
              <div><span style={{ color: '#888' }}>SL:</span> {parseFloat(String(selectedOrder.quantity)) > 0 ? parseFloat(String(selectedOrder.quantity)).toFixed(4) : 'N/A'}</div>
              <div><span style={{ color: '#888' }}>Đã điền:</span> {parseFloat(String(selectedOrder.filled_quantity || 0)).toFixed(4)} / {parseFloat(String(selectedOrder.quantity)) > 0 ? parseFloat(String(selectedOrder.quantity)).toFixed(4) : 'N/A'}</div>
              <div><span style={{ color: '#888' }}>Lệnh phí:</span> ${parseFloat(String(selectedOrder.fee || 0)).toFixed(4)}</div>
              <div style={{ gridColumn: '1 / -1' }}><span style={{ color: '#888' }}>Thời gian:</span> {formatTime(selectedOrder.created_at)}</div>
            </div>
          </div>
        )}

        {/* Edit Order Modal */}
        {editingOrderId && (
          <div style={{
            background: '#282c34',
            border: '1px solid #ffa500',
            borderRadius: '4px',
            padding: '0.75rem',
            marginBottom: '0.5rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffa500' }}>
                Sửa giá lệnh: {editingOrderId}
              </div>
              <button
                onClick={() => { setEditingOrderId(null); setEditPrice(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#888',
                  cursor: 'pointer',
                  fontSize: '1rem',
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="number"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                placeholder="Nhập giá mới"
                step="0.01"
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  background: '#131722',
                  color: '#d1d4dc',
                  border: '1px solid #2a2e39',
                  borderRadius: '3px',
                  fontSize: '0.85rem',
                }}
              />
              <button
                onClick={handleSaveEditOrder}
                style={{
                  ...buttonStyle,
                  background: '#26a69a',
                  color: 'white',
                  padding: '0.5rem 1rem',
                }}
              >
                Lưu
              </button>
            </div>
          </div>
        )}

        {/* Pending Orders Tab */}
        {activeTab === 'pending' && (
          <>
            {loadingPending ? (
              <div style={{ textAlign: 'center', color: '#888' }}>⏳ Đang tải...</div>
            ) : pendingOrders.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#888' }}>Không có lệnh đang chờ</div>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr style={{ ...rowStyle, borderBottom: '2px solid #363c4f' }}>
                    <th style={{ ...cellStyle, color: '#888' }}>Cặp</th>
                    <th style={{ ...cellStyle, color: '#888' }}>Phía</th>
                    <th style={{ ...cellStyle, color: '#888', textAlign: 'right' }}>Giá</th>
                    <th style={{ ...cellStyle, color: '#888', textAlign: 'right' }}>Số lượng</th>
                    <th style={{ ...cellStyle, color: '#888' }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingOrders.map(order => {
                    const price = parseFloat(String(order.price)) || 0;
                    const quantity = parseFloat(String(order.quantity)) || 0;
                    return (
                    <tr key={order.id} style={rowStyle}>
                      <td style={{ ...cellStyle, color: '#d1d4dc', fontWeight: 600 }}>{order.symbol}</td>
                      <td style={{ ...cellStyle, color: order.side === 'BUY' ? '#26a69a' : '#ef5350', fontWeight: 600 }}>
                        {order.side}
                      </td>
                      <td style={{ ...cellStyle, color: '#d1d4dc', textAlign: 'right' }}>
                        ${price > 0 ? price.toFixed(2) : 'N/A'}
                      </td>
                      <td style={{ ...cellStyle, color: '#d1d4dc', textAlign: 'right' }}>
                        {quantity > 0 ? quantity.toFixed(8) : 'N/A'}
                      </td>
                      <td style={{ ...cellStyle, display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleViewDetails(order.id)}
                          style={{
                            ...buttonStyle,
                            background: '#363c4f',
                            color: '#26a69a',
                          }}
                        >
                          Chi tiết
                        </button>
                        <button
                          onClick={() => handleEditOrder(order)}
                          style={{
                            ...buttonStyle,
                            background: '#ffa500',
                            color: 'white',
                          }}
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          disabled={cancelling === order.id}
                          style={{
                            ...buttonStyle,
                            background: '#ef5350',
                            color: 'white',
                            opacity: cancelling === order.id ? 0.6 : 1,
                            cursor: cancelling === order.id ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {cancelling === order.id ? '...' : 'Hủy'}
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* Order History Tab */}
        {activeTab === 'assets' && (
          <>
            {loadingAssets ? (
              <div style={{ textAlign: 'center', color: '#888' }}>⏳ Đang tải...</div>
            ) : holdings.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#888' }}>Không có tài sản</div>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr style={{ ...rowStyle, borderBottom: '2px solid #363c4f' }}>
                    <th style={{ ...cellStyle, color: '#888' }}>Đồng coin</th>
                    <th style={{ ...cellStyle, color: '#888', textAlign: 'right' }}>Số lượng</th>
                    <th style={{ ...cellStyle, color: '#888', textAlign: 'right' }}>Giá</th>
                    <th style={{ ...cellStyle, color: '#888', textAlign: 'right' }}>Giá trị (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map(holding => {
                    const total = parseFloat(String(holding.total)) || 0;
                    const price = parseFloat(String(holding.price)) || 0;
                    const usdValue = parseFloat(String(holding.usdValue)) || 0;
                    return (
                    <tr key={holding.coin} style={rowStyle}>
                      <td style={{ ...cellStyle, color: '#d1d4dc', fontWeight: 600 }}>{holding.coin}</td>
                      <td style={{ ...cellStyle, color: '#d1d4dc', textAlign: 'right' }}>
                        {total > 0 ? total.toFixed(8) : '0'}
                      </td>
                      <td style={{ ...cellStyle, color: '#d1d4dc', textAlign: 'right' }}>
                        ${price > 0 ? price.toFixed(2) : 'N/A'}
                      </td>
                      <td style={{ ...cellStyle, color: '#26a69a', textAlign: 'right', fontWeight: 600 }}>
                        ${usdValue > 0 ? usdValue.toFixed(2) : '0.00'}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}

        {/* Trades Tab */}
        {activeTab === 'history' && (
          <>
            {loadingTrades ? (
              <div style={{ textAlign: 'center', color: '#888' }}>⏳ Đang tải...</div>
            ) : trades.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#888' }}>Không có giao dịch nào</div>
            ) : (
              <table style={tableStyle}>
                <thead>
                  <tr style={{ ...rowStyle, borderBottom: '2px solid #363c4f' }}>
                    <th style={{ ...cellStyle, color: '#888' }}>Thời gian</th>
                    <th style={{ ...cellStyle, color: '#888' }}>Phía</th>
                    <th style={{ ...cellStyle, color: '#888', textAlign: 'right' }}>Giá</th>
                    <th style={{ ...cellStyle, color: '#888', textAlign: 'right' }}>Số lượng</th>
                    <th style={{ ...cellStyle, color: '#888', textAlign: 'right' }}>Tổng tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map(trade => {
                    const price = parseFloat(String(trade.price)) || 0;
                    const quantity = parseFloat(String(trade.quantity)) || 0;
                    return (
                    <tr key={trade.id} style={rowStyle}>
                      <td style={{ ...cellStyle, color: '#888', fontSize: '0.75rem' }}>
                        {formatTime(trade.created_at)}
                      </td>
                      <td style={{ ...cellStyle, color: trade.side === 'BUY' ? '#26a69a' : '#ef5350', fontWeight: 600 }}>
                        {trade.side}
                      </td>
                      <td style={{ ...cellStyle, color: '#d1d4dc', textAlign: 'right' }}>
                        ${price > 0 ? price.toFixed(2) : 'N/A'}
                      </td>
                      <td style={{ ...cellStyle, color: '#d1d4dc', textAlign: 'right' }}>
                        {quantity > 0 ? quantity.toFixed(4) : 'N/A'}
                      </td>
                      <td style={{ ...cellStyle, color: '#d1d4dc', textAlign: 'right', fontWeight: 600 }}>
                        ${(quantity > 0 ? quantity * price : 0).toFixed(2)}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SpotOrdersPanel;
