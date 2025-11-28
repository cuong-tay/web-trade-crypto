import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { TradingService, type FuturesOrder, type FuturesPosition } from '../../services/tradingService';
import { useTradingContext } from '../../context/TradingContext';

// Memoize component để tránh re-render từ WebSocket chart
const FuturesOrdersPanel: React.FC = React.memo(() => {
  const tradingContext = useTradingContext();
  const { symbol } = tradingContext;
  const contextLastPrice = tradingContext.lastPrice;
  
  // Throttle lastPrice để giảm re-render (chỉ update mỗi 1 giây)
  const [throttledPrice, setThrottledPrice] = useState(contextLastPrice);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setThrottledPrice(contextLastPrice);
    }, 1000); // Update mỗi 1 giây
    
    return () => clearTimeout(timer);
  }, [contextLastPrice]);
  
  const lastPrice = throttledPrice;
  
  // State for different tabs
  const [activeTab, setActiveTab] = useState<'positions' | 'orders'>('positions');
  
  // Futures Positions (Vị thế đang mở)
  const [positions, setPositions] = useState<FuturesPosition[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(false);
  
  // Pending Orders (Lệnh chờ khớp)
  const [pendingOrders, setPendingOrders] = useState<FuturesOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  
  // Cancellation/Closing
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const [reversing, setReversing] = useState<string | null>(null);
  
  // TP/SL Modal
  const [tpslModalOpen, setTpslModalOpen] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<FuturesPosition | null>(null);
  const [tpPrice, setTpPrice] = useState<string>('');
  const [slPrice, setSlPrice] = useState<string>('');
  const [tpslError, setTpslError] = useState<string>('');
  const [savingTpsl, setSavingTpsl] = useState(false);
  
  // Auto-refresh
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  // Ref to preserve scroll position
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollPositionRef = useRef<number>(0);

  // Fetch positions
  const fetchPositions = async () => {
    // Lưu scroll position trước khi update
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
      console.log(`📍 [SCROLL] Lưu vị trí scroll trước fetch: ${scrollPositionRef.current}px`);
    }
    
    setLoadingPositions(true);
    try {
      const response = await TradingService.getFuturesPositions(symbol, 'open');
      console.log('📥 Futures positions fetched:', response.positions.length, 'of', response.total);
      setPositions(response.positions);
      
      // Restore scroll position sau khi update
      setTimeout(() => {
        if (scrollContainerRef.current) {
          console.log(`📍 [SCROLL] Restore scroll position từ ${scrollPositionRef.current}px -> ${scrollContainerRef.current.scrollTop}px`);
          scrollContainerRef.current.scrollTop = scrollPositionRef.current;
          console.log(`✅ [SCROLL] Scroll restored thành công: ${scrollContainerRef.current.scrollTop}px`);
        }
      }, 0);
    } catch (error) {
      console.error('❌ Error fetching futures positions:', error);
      setPositions([]);
    } finally {
      setLoadingPositions(false);
    }
  };

  // Fetch pending orders
  const fetchPendingOrders = async () => {
    // Lưu scroll position trước khi update
    if (scrollContainerRef.current) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
      console.log(`📍 [SCROLL] Lưu vị trí scroll trước fetch orders: ${scrollPositionRef.current}px`);
    }
    
    setLoadingOrders(true);
    try {
      console.log('🟠 [FUTURES Panel] Fetching pending FUTURES orders...');
      const response = await TradingService.getFuturesOrders(symbol, 'pending');
      console.log('📥 [FUTURES Panel] Raw futures orders from API:', response.orders.length, 'of', response.total);
      
      // Filter LIMIT orders only + exclude cancelled/filled
      const limitOrders = response.orders.filter((order: FuturesOrder) => {
        const isLimit = order.order_type === 'limit' || (order.order_type as string).toUpperCase() === 'LIMIT';
        const orderStatus = (order.status as string).toLowerCase();
        const isPending = orderStatus === 'pending';
        return isLimit && isPending;
      });
      console.log('✅ [FUTURES Panel] Pending LIMIT orders filtered:', limitOrders.length, 'orders');
      setPendingOrders(limitOrders);
      
      // Restore scroll position sau khi update
      setTimeout(() => {
        if (scrollContainerRef.current) {
          console.log(`📍 [SCROLL] Restore scroll position orders từ ${scrollPositionRef.current}px -> ${scrollContainerRef.current.scrollTop}px`);
          scrollContainerRef.current.scrollTop = scrollPositionRef.current;
          console.log(`✅ [SCROLL] Scroll restored thành công: ${scrollContainerRef.current.scrollTop}px`);
        }
      }, 0);
    } catch (error) {
      console.error('❌ Error fetching futures orders:', error);
      setPendingOrders([]);
    } finally {
      setLoadingOrders(false);
    }
  };

  // Initial load & auto-refresh
  useEffect(() => {
    fetchPositions();
    fetchPendingOrders();

    if (autoRefresh) {
      const interval = setInterval(() => {
        if (activeTab === 'positions') fetchPositions();
        else if (activeTab === 'orders') fetchPendingOrders();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [symbol, activeTab, autoRefresh]);

  // Listen for events from OrderPanel
  useEffect(() => {
    const handlePositionOpened = () => {
      console.log('🔄 Position opened event, refreshing...');
      fetchPositions();
    };

    const handleOrderCreated = () => {
      console.log('🔄 Order created event, refreshing...');
      fetchPendingOrders();
    };

    window.addEventListener('futuresPositionOpened', handlePositionOpened);
    window.addEventListener('futuresOrderCreated', handleOrderCreated);

    return () => {
      window.removeEventListener('futuresPositionOpened', handlePositionOpened);
      window.removeEventListener('futuresOrderCreated', handleOrderCreated);
    };
  }, []);

  // 🏃 Monitor pending LIMIT orders and auto-fill when price conditions are met  
  // Use useMemo to avoid recalculation on every render
  const orderCheckingEnabled = useMemo(() => {
    return pendingOrders && pendingOrders.length > 0 && lastPrice > 0;
  }, [pendingOrders?.length, lastPrice]);

  // Memoize the order checking function to prevent unnecessary re-creation
  const checkAndFillOrders = useCallback(async () => {
    if (!orderCheckingEnabled) return;
    
    console.log(`📊 [Futures] Checking ${pendingOrders.length} pending orders against market price: ${lastPrice}`);

    for (const order of pendingOrders) {
      const isLimitOrder = order.order_type === 'limit' || (order.order_type as string).toUpperCase() === 'LIMIT';
      const isPending = order.status === 'pending' || (order.status as string).toUpperCase() === 'PENDING';

      if (!isPending || !isLimitOrder) {
        continue;
      }

      const limitPrice = parseFloat(String(order.price)) || 0;
      const marketPrice = lastPrice;
      const side = String(order.side).toUpperCase();

      // LONG: Khớp khi market <= limit (giá xuống đến mức mua)
      // SHORT: Khớp khi market >= limit (giá lên đến mức bán)
      const shouldFill = (side === 'LONG' && marketPrice <= limitPrice) || 
                        (side === 'SHORT' && marketPrice >= limitPrice);

      console.log(`💰 [Futures] Order #${order.id}: side=${side}, market=${marketPrice}, limit=${limitPrice} => shouldFill=${shouldFill}`);

      if (shouldFill) {
        console.log(`✨ [Futures] Lệnh ${side} #${order.id} sẽ khớp! Limit: ${limitPrice}, Market: ${marketPrice}`);

        try {
          // Call fill-order API to open position
          const positionResponse = await TradingService.fillFuturesOrder(order.id, limitPrice, Date.now());
          console.log(`✅ [Futures] Order #${order.id} filled, position opened:`, positionResponse);

          // Update wallet if backend returns wallet_updates
          if ((positionResponse as any).wallet_updates) {
            const walletUpdates = (positionResponse as any).wallet_updates;
            const savedWallet = localStorage.getItem('walletData');
            let walletData = savedWallet ? JSON.parse(savedWallet) : [];

            const updatedBalances = walletData.map((balance: any) => {
              if (walletUpdates[balance.coin]) {
                const update = walletUpdates[balance.coin];
                return {
                  ...balance,
                  available: update.balance,
                  locked: 0,
                  total: update.balance,
                };
              }
              return balance;
            });

            localStorage.setItem('walletData', JSON.stringify(updatedBalances));
            window.dispatchEvent(new Event('walletUpdated'));
          }

          // Refresh positions and orders
          await fetchPositions();
          await fetchPendingOrders();

          alert(`✅ Lệnh ${side} ${symbol} @ ${limitPrice} đã khớp và mở vị thế!`);
        } catch (error) {
          console.error(`❌ [Futures] Error filling order #${order.id}:`, error);
        }
      }
    }
  }, [orderCheckingEnabled, pendingOrders, lastPrice, symbol]);
  
  // Throttle order checking to reduce CPU usage (3 seconds instead of 2)
  useEffect(() => {
    if (!orderCheckingEnabled) return;

    const interval = setInterval(checkAndFillOrders, 3000);
    return () => clearInterval(interval);
  }, [orderCheckingEnabled, checkAndFillOrders]);

  // Handle TP/SL
  const handleOpenTpslModal = (position: FuturesPosition) => {
    setSelectedPosition(position);
    setTpPrice(position.take_profit_price ? String(position.take_profit_price) : '');
    setSlPrice(position.stop_loss_price ? String(position.stop_loss_price) : '');
    setTpslError('');
    setTpslModalOpen(true);
    console.log(`📋 [TP/SL] Mở modal cho vị thế ${position.id}`);
  };

  const handleCloseTpslModal = () => {
    setTpslModalOpen(false);
    setSelectedPosition(null);
    setTpPrice('');
    setSlPrice('');
    setTpslError('');
    console.log(`📋 [TP/SL] Đóng modal`);
  };

  const handleSaveTpsl = async () => {
    if (!selectedPosition) return;

    try {
      setSavingTpsl(true);
      setTpslError('');

      // Validate
      const tp = tpPrice ? parseFloat(tpPrice) : null;
      const sl = slPrice ? parseFloat(slPrice) : null;
      const liquidationPrice = selectedPosition.liquidation_price 
        ? parseFloat(String(selectedPosition.liquidation_price))
        : 0;

      if (sl && liquidationPrice && sl <= liquidationPrice) {
        setTpslError(`❌ Stop Loss phải cao hơn giá thanh lý (${liquidationPrice.toFixed(2)})`);
        setSavingTpsl(false);
        return;
      }

      console.log(`📤 [TP/SL] Gửi request: tp=${tp}, sl=${sl}`);

      // Call API
      const response = await TradingService.updateFuturesPositionTPSL(
        selectedPosition.id,
        tp,
        sl
      );

      console.log(`✅ [TP/SL] Cập nhật thành công:`, response);
      alert('✅ Cập nhật TP/SL thành công!');
      handleCloseTpslModal();
      await fetchPositions();
    } catch (error: any) {
      console.error('❌ [TP/SL] Lỗi:', error);
      
      // Nếu backend chưa support, show friendly error
      if (error.message.includes('404')) {
        setTpslError('⚠️ Backend chưa hỗ trợ cập nhật TP/SL. Vui lòng liên hệ admin.');
      } else {
        setTpslError(error.response?.data?.detail || error.message || 'Cập nhật TP/SL thất bại');
      }
    } finally {
      setSavingTpsl(false);
    }
  };

  // Close position
  const handleClosePosition = async (positionId: string) => {
    if (!confirm('Bạn có chắc muốn đóng vị thế này?')) return;

    setClosing(positionId);
    try {
      const closeResponse = await TradingService.closeFuturesPosition(positionId, lastPrice);
      console.log('✅ Futures position closed:', closeResponse);

      // ✅ DETAILED WALLET UPDATE LOGGING
      console.log('\n📋 ===== WALLET UPDATE DEBUG =====');
      console.log('📥 Response wallet_updates:', closeResponse.wallet_updates);
      
      // Update wallet from response
      if (closeResponse.wallet_updates) {
        const walletUpdates = closeResponse.wallet_updates;
        console.log('💾 Wallet updates received:', walletUpdates);
        
        const savedWallet = localStorage.getItem('walletData');
        console.log('💾 Saved wallet before update:', savedWallet);
        
        let walletData = savedWallet ? JSON.parse(savedWallet) : [];
        console.log('📊 Parsed wallet data:', walletData);

        const updatedBalances = walletData.map((balance: any) => {
          if (walletUpdates[balance.coin]) {
            const update = walletUpdates[balance.coin];
            console.log(`✅ Updating ${balance.coin}:`, {
              before: balance,
              update: update,
            });
            return {
              ...balance,
              available: update.balance,
              locked: 0,
              total: update.balance,
            };
          }
          return balance;
        });

        console.log('📊 Updated balances:', updatedBalances);
        localStorage.setItem('walletData', JSON.stringify(updatedBalances));
        console.log('💾 Saved to localStorage');
        
        window.dispatchEvent(new Event('walletUpdated'));
        console.log('🔔 walletUpdated event dispatched');
      } else {
        console.warn('⚠️ NO wallet_updates in response!');
      }

      // Refresh positions
      await fetchPositions();

      // ✅ Parse realized_pnl to ensure it's a number
      const realizedPnl = typeof closeResponse.realized_pnl === 'number' 
        ? closeResponse.realized_pnl 
        : parseFloat(String(closeResponse.realized_pnl)) || 0;
      
      const commission = typeof closeResponse.commission === 'number'
        ? closeResponse.commission
        : parseFloat(String(closeResponse.commission)) || 0;
      
      // ✅ Total profit/loss = PnL - Commission
      const netProfit = realizedPnl - commission;

      alert(`Đóng vị thế thành công!\nPnL: ${netProfit.toFixed(2)} USDT`);
    } catch (error: any) {
      console.error('❌ Error closing position:', error);
      alert(error.response?.data?.detail || 'Lỗi khi đóng vị thế');
    } finally {
      setClosing(null);
    }
  };

  // Cancel order
  const handleCancelOrder = async (orderId: string) => {
    // Double-check order status before cancelling
    const order = pendingOrders.find(o => o.id === orderId);
    if (!order) {
      alert('❌ Không tìm thấy lệnh!');
      return;
    }
    
    const orderStatus = (order.status as string).toLowerCase();
    if (orderStatus !== 'pending') {
      alert(`❌ Không thể hủy lệnh có trạng thái: ${orderStatus}`);
      await fetchPendingOrders(); // Refresh to remove from list
      return;
    }

    if (!confirm('Bạn có chắc muốn hủy lệnh này?')) return;

    setCancelling(orderId);
    try {
      const cancelResponse = await TradingService.cancelFuturesOrder(orderId);
      console.log('✅ Futures order cancelled:', cancelResponse);
      
      // ✅ UPDATE WALLET FROM RESPONSE
      console.log('\n📋 ===== CANCEL ORDER WALLET UPDATE =====');
      console.log('📥 Response wallet_updates:', cancelResponse.wallet_updates);
      
      if (cancelResponse.wallet_updates) {
        const walletUpdates = cancelResponse.wallet_updates;
        console.log('💾 Wallet updates received:', walletUpdates);
        
        const savedWallet = localStorage.getItem('walletData');
        console.log('💾 Saved wallet before update:', savedWallet);
        
        let walletData = savedWallet ? JSON.parse(savedWallet) : [];
        console.log('📊 Parsed wallet data:', walletData);

        const updatedBalances = walletData.map((balance: any) => {
          if (walletUpdates[balance.coin]) {
            const update = walletUpdates[balance.coin];
            console.log(`✅ Updating ${balance.coin}:`, {
              before: balance,
              update: update,
            });
            return {
              ...balance,
              available: update.balance,
              locked: 0,
              total: update.balance,
            };
          }
          return balance;
        });

        console.log('📊 Updated balances:', updatedBalances);
        localStorage.setItem('walletData', JSON.stringify(updatedBalances));
        console.log('💾 Saved to localStorage');
        
        window.dispatchEvent(new Event('walletUpdated'));
        console.log('🔔 walletUpdated event dispatched');
      } else {
        console.warn('⚠️ NO wallet_updates in cancel response!');
      }
      
      // Refresh orders
      await fetchPendingOrders();
      
      alert('✅ Đã hủy lệnh thành công!');
    } catch (error) {
      console.error('❌ Error cancelling order:', error);
      const errorMsg = error instanceof Error ? error.message : 'Hủy lệnh thất bại!';
      
      // If already cancelled, just refresh the list
      if (errorMsg.includes('cancelled')) {
        await fetchPendingOrders();
        alert('ℹ️ Lệnh này đã được hủy trước đó.');
      } else {
        alert(`❌ ${errorMsg}`);
      }
    } finally {
      setCancelling(null);
    }
  };

  // Reverse position (đóng rồi mở ngược lại)
  const handleReversePosition = async (position: FuturesPosition) => {
    if (!confirm(`Bạn có chắc muốn đảo ngược vị thế ${position.symbol}? Sẽ đóng ${position.side} và mở ${position.side === 'LONG' ? 'SHORT' : 'LONG'}`)) return;

    setReversing(position.id);
    try {
      console.log(`🔄 [REVERSE] Bắt đầu đảo ngược vị thế ${position.id}`);

      // Step 1: Đóng vị thế hiện tại
      console.log(`📊 Step 1: Đóng vị thế ${position.side} ${position.symbol}`);
      const closeResponse = await TradingService.closeFuturesPosition(position.id, lastPrice);
      console.log('✅ Vị thế đã đóng:', closeResponse);

      // Update wallet từ close response
      if (closeResponse.wallet_updates) {
        const walletUpdates = closeResponse.wallet_updates;
        const savedWallet = localStorage.getItem('walletData');
        let walletData = savedWallet ? JSON.parse(savedWallet) : [];

        const updatedBalances = walletData.map((balance: any) => {
          if (walletUpdates[balance.coin]) {
            const update = walletUpdates[balance.coin];
            return {
              ...balance,
              available: update.balance,
              locked: 0,
              total: update.balance,
            };
          }
          return balance;
        });

        localStorage.setItem('walletData', JSON.stringify(updatedBalances));
        window.dispatchEvent(new Event('walletUpdated'));
      }

      // Step 2: Mở vị thế ngược lại
      const newSide = position.side === 'LONG' ? 'SHORT' : 'LONG';
      console.log(`📊 Step 2: Mở vị thế ${newSide} ${position.symbol} @ ${lastPrice}`);

      // Tính margin cần dùng
      const margin = position.margin 
        ? (typeof position.margin === 'number' ? position.margin : parseFloat(String(position.margin)))
        : (lastPrice * position.quantity) / position.leverage;

      const openResponse = await TradingService.openFuturesPosition({
        symbol: position.symbol,
        side: newSide,
        quantity: position.quantity,
        leverage: position.leverage,
        collateral: margin,
        entry_price: lastPrice,
      });

      console.log('✅ Vị thế mới đã mở:', openResponse);

      // Update wallet từ open response (nếu có)
      if ((openResponse as any).wallet_updates) {
        const walletUpdates = (openResponse as any).wallet_updates;
        const savedWallet = localStorage.getItem('walletData');
        let walletData = savedWallet ? JSON.parse(savedWallet) : [];

        const updatedBalances = walletData.map((balance: any) => {
          if (walletUpdates[balance.coin]) {
            const update = walletUpdates[balance.coin];
            return {
              ...balance,
              available: update.balance,
              locked: 0,
              total: update.balance,
            };
          }
          return balance;
        });

        localStorage.setItem('walletData', JSON.stringify(updatedBalances));
        window.dispatchEvent(new Event('walletUpdated'));
      } else {
        // Nếu backend không trả wallet_updates, tính toán trực tiếp
        console.log('📝 Backend không trả wallet_updates, tính toán trực tiếp...');
        const savedWallet = localStorage.getItem('walletData');
        let walletData = savedWallet ? JSON.parse(savedWallet) : [];

        // Trừ margin của vị thế mới từ USDT
        const updatedBalances = walletData.map((balance: any) => {
          if (balance.coin === 'USDT') {
            // Tính margin của vị thế mới
            const newMargin = lastPrice * position.quantity / position.leverage;
            return {
              ...balance,
              available: balance.available - newMargin,
              locked: (balance.locked || 0) + newMargin,
              total: balance.total - newMargin,
            };
          }
          return balance;
        });

        localStorage.setItem('walletData', JSON.stringify(updatedBalances));
        window.dispatchEvent(new Event('walletUpdated'));
        console.log('✅ Wallet updated (calculated):', updatedBalances);
      }

      // Refresh positions
      await fetchPositions();

      alert(`✅ Đảo ngược thành công!\n${position.side} → ${newSide} ${position.symbol}`);
      window.dispatchEvent(new Event('futuresPositionOpened'));
    } catch (error: any) {
      console.error('❌ Error reversing position:', error);
      alert(error.response?.data?.detail || 'Lỗi khi đảo ngược vị thế');
    } finally {
      setReversing(null);
    }
  };

  return (
    <div style={{
      background: '#1e222d',
      borderRadius: '4px',
      padding: '1rem',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <h3 style={{ margin: 0, fontSize: '1rem', color: '#d1d4dc' }}>
          Futures Trading
        </h3>
        <label style={{ fontSize: '0.85rem', color: '#888', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          Auto-refresh
        </label>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #2a2e39' }}>
        <button
          onClick={() => setActiveTab('positions')}
          style={{
            flex: 1,
            padding: '0.5rem',
            background: activeTab === 'positions' ? '#363c4f' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'positions' ? '2px solid #26a69a' : '2px solid transparent',
            color: activeTab === 'positions' ? '#d1d4dc' : '#888',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: activeTab === 'positions' ? 600 : 400
          }}
        >
          Vị thế ({positions.length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          style={{
            flex: 1,
            padding: '0.5rem',
            background: activeTab === 'orders' ? '#363c4f' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'orders' ? '2px solid #26a69a' : '2px solid transparent',
            color: activeTab === 'orders' ? '#d1d4dc' : '#888',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: activeTab === 'orders' ? 600 : 400
          }}
        >
          Lệnh chờ ({pendingOrders.length})
        </button>
      </div>

      {/* Content */}
      <div ref={scrollContainerRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Tab: Positions */}
        {activeTab === 'positions' && (
          <>
            {loadingPositions ? (
              <div style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
                Đang tải...
              </div>
            ) : positions.length > 0 ? (
              positions.map(position => {
                const currentPrice = lastPrice || position.mark_price;
                const entryPrice = typeof position.entry_price === 'number' ? position.entry_price : parseFloat(String(position.entry_price));
                const margin = position.margin 
                  ? (typeof position.margin === 'number' ? position.margin : parseFloat(String(position.margin)))
                  : 0; // ✅ Fallback to 0 if margin not provided
                const qty = typeof position.quantity === 'number' ? position.quantity : parseFloat(String(position.quantity));
                const leverage = typeof position.leverage === 'number' ? position.leverage : parseFloat(String(position.leverage));
                
                // ✅ Parse liquidation price with fallback
                let liquidationPrice = 0;
                if (position.liquidation_price) {
                  liquidationPrice = typeof position.liquidation_price === 'number' 
                    ? position.liquidation_price 
                    : parseFloat(String(position.liquidation_price));
                }
                
                // Nếu liquidation_price từ API không hợp lệ, tính toán
                if (!liquidationPrice || isNaN(liquidationPrice) || liquidationPrice <= 0) {
                  // ✅ Calculate: liquidation = entry ± (entry × (1/leverage))
                  // LONG: Liquidation khi giá giảm xuống = Entry * (1 - 1/Leverage)
                  // SHORT: Liquidation khi giá tăng lên = Entry * (1 + 1/Leverage)
                  liquidationPrice = position.side === 'LONG'
                    ? entryPrice * (1 - 1 / leverage)
                    : entryPrice * (1 + 1 / leverage);
                  
                  console.log(`🧮 [Position ${position.id}] Liquidation calculated (not from API):`, {
                    side: position.side,
                    entryPrice,
                    leverage,
                    calculatedLiquidationPrice: liquidationPrice
                  });
                }
                
                // ✅ Calculate margin if not provided: margin = position_value / leverage
                const positionValue = entryPrice * qty;
                const calculatedMargin = margin > 0 ? margin : positionValue / leverage;
                
                // 🔍 Debug log
                console.log(`💰 [Position ${position.id}] Margin calculation:`, {
                  marginFromAPI: position.margin,
                  marginParsed: margin,
                  entryPrice,
                  quantity: qty,
                  leverage,
                  positionValue,
                  calculatedMargin,
                  isNaN: isNaN(calculatedMargin),
                  liquidationPrice,
                  liquidationFromAPI: position.liquidation_price,
                  liquidationIsNaN: isNaN(liquidationPrice)
                });
                
                const priceDiff = position.side === 'LONG' 
                  ? currentPrice - entryPrice 
                  : entryPrice - currentPrice;
                const unrealizedPnL = priceDiff * qty * leverage;
                const pnlPercent = calculatedMargin > 0 ? (unrealizedPnL / calculatedMargin) * 100 : 0;

                return (
                  <div 
                    key={position.id}
                    style={{
                      background: '#131722',
                      borderRadius: '6px',
                      padding: '0.875rem',
                      border: `1px solid ${position.side === 'LONG' ? 'rgba(38, 166, 154, 0.3)' : 'rgba(239, 83, 80, 0.3)'}`,
                      borderLeft: `3px solid ${position.side === 'LONG' ? '#26a69a' : '#ef5350'}`
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: '1rem', color: '#d1d4dc' }}>
                          {position.symbol}
                        </span>
                        <span style={{ 
                          marginLeft: '0.75rem',
                          padding: '0.25rem 0.75rem',
                          background: position.side === 'LONG' ? 'rgba(38, 166, 154, 0.2)' : 'rgba(239, 83, 80, 0.2)',
                          color: position.side === 'LONG' ? '#26a69a' : '#ef5350',
                          borderRadius: '3px',
                          fontSize: '0.8rem',
                          fontWeight: 600
                        }}>
                          {position.side} {position.leverage}x
                        </span>
                      </div>
                      <button
                        onClick={() => handleClosePosition(position.id)}
                        disabled={closing === position.id}
                        style={{
                          padding: '0.4rem 1rem',
                          background: '#ef5350',
                          border: 'none',
                          color: '#fff',
                          borderRadius: '4px',
                          cursor: closing === position.id ? 'not-allowed' : 'pointer',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          opacity: closing === position.id ? 0.6 : 1
                        }}
                      >
                        {closing === position.id ? 'Đang đóng...' : 'Đóng'}
                      </button>
                    </div>

                    {/* Info Rows - giống ảnh */}
                    <div style={{ fontSize: '0.75rem', marginBottom: '0.75rem' }}>
                      {/* Row 1: PNL & ROI */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div>
                          <span style={{ color: '#888' }}>PNL (USDT)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                          <span style={{ color: unrealizedPnL >= 0 ? '#26a69a' : '#ef5350', fontWeight: 700, fontSize: '1rem' }}>
                            {unrealizedPnL >= 0 ? '+' : ''}{unrealizedPnL.toFixed(2)}
                          </span>
                          <span style={{ color: pnlPercent >= 0 ? '#26a69a' : '#ef5350', fontSize: '0.75rem' }}>
                            {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                      
                      {/* Row 2: Size & Margin */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div>
                          <span style={{ color: '#888' }}>Kích thước (USDT) </span>
                          <span style={{ color: '#d1d4dc' }}>{parseFloat(String(position.quantity)).toFixed(5)}</span>
                        </div>
                        <div>
                          <span style={{ color: '#888' }}>Margin (USDT) </span>
                          <span style={{ color: '#d1d4dc' }}>{!isNaN(calculatedMargin) && calculatedMargin > 0 ? calculatedMargin.toFixed(2) : 'N/A'}</span>
                        </div>
                      </div>
                      
                      {/* Row 2b: Tỉ lệ ký quỹ - như ảnh */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                        <div>
                          <span style={{ color: '#888' }}>Tỉ lệ ký quỹ</span>
                          <span style={{ color: '#d1d4dc', marginLeft: '0.5rem' }}>
                            {calculatedMargin > 0 ? ((calculatedMargin / positionValue) * 100).toFixed(2) : '0.00'}%
                          </span>
                        </div>
                      </div>

                      {/* Row 3: Entry & Mark */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div>
                          <span style={{ color: '#888' }}>Giá vào lệnh (USDT)</span>
                        </div>
                        <div style={{ color: '#d1d4dc', fontWeight: 600 }}>
                          {entryPrice.toFixed(7)}
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div>
                          <span style={{ color: '#888' }}>Giá đánh dấu (USDT)</span>
                        </div>
                        <div style={{ color: '#d1d4dc', fontWeight: 600 }}>
                          {currentPrice.toFixed(7)}
                        </div>
                      </div>

                      {/* Row 4: Liquidation Price */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div>
                          <span style={{ color: '#888' }}>Giá thanh lý (USDT)</span>
                        </div>
                        <div style={{ color: liquidationPrice > 0 ? '#d1d4dc' : '#ef5350', fontWeight: 600 }}>
                          {liquidationPrice > 0 ? liquidationPrice.toFixed(2) : '—'}
                        </div>
                      </div>

                      {/* Row 5: TP/SL - format giống ảnh */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div>
                          <span style={{ color: '#888' }}>TP/SL</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ color: '#d1d4dc', fontWeight: 600 }}>
                            {position.take_profit_price ? parseFloat(String(position.take_profit_price)).toFixed(7) : '—'} / {position.stop_loss_price ? parseFloat(String(position.stop_loss_price)).toFixed(7) : '—'}
                          </span>
                          <button
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#888',
                              cursor: 'pointer',
                              padding: '0.25rem',
                              fontSize: '1rem'
                            }}
                            onClick={() => handleOpenTpslModal(position)}
                          >
                            ✏️
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.75rem' }}>
                      <button
                        style={{
                          padding: '0.5rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#d1d4dc',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.75rem'
                        }}
                        onClick={() => handleOpenTpslModal(position)}
                      >
                        TP/SL
                      </button>
                      <button
                        onClick={() => handleClosePosition(position.id)}
                        disabled={closing === position.id}
                        style={{
                          padding: '0.5rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#d1d4dc',
                          borderRadius: '4px',
                          cursor: closing === position.id ? 'not-allowed' : 'pointer',
                          fontSize: '0.75rem',
                          opacity: closing === position.id ? 0.6 : 1
                        }}
                      >
                        {closing === position.id ? 'Đang đóng...' : 'Đóng'}
                      </button>
                      <button
                        onClick={() => handleReversePosition(position)}
                        disabled={reversing === position.id}
                        style={{
                          padding: '0.5rem',
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          color: '#d1d4dc',
                          borderRadius: '4px',
                          cursor: reversing === position.id ? 'not-allowed' : 'pointer',
                          fontSize: '0.75rem',
                          opacity: reversing === position.id ? 0.6 : 1
                        }}
                      >
                        {reversing === position.id ? 'Đang đảo...' : 'Đảo ngược'}
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', color: '#888', padding: '2rem', fontSize: '0.9rem' }}>
                Không có vị thế nào
              </div>
            )}
          </>
        )}

        {/* Tab: Orders */}
        {activeTab === 'orders' && (
          <>
            {loadingOrders ? (
              <div style={{ textAlign: 'center', color: '#888', padding: '2rem' }}>
                Đang tải...
              </div>
            ) : pendingOrders.length > 0 ? (
              pendingOrders.map(order => {
                // ✅ Parse margin_required with fallback
                const marginRequired = order.margin_required
                  ? (typeof order.margin_required === 'number' ? order.margin_required : parseFloat(String(order.margin_required)))
                  : 0;
                
                // ✅ Calculate fallback if not provided: margin = (price × qty) / leverage
                const orderPrice = typeof order.price === 'number' ? order.price : parseFloat(String(order.price)) || 0;
                const orderQty = typeof order.quantity === 'number' ? order.quantity : parseFloat(String(order.quantity)) || 0;
                const orderLeverage = typeof order.leverage === 'number' ? order.leverage : parseFloat(String(order.leverage)) || 1;
                const calculatedMargin = marginRequired > 0 ? marginRequired : (orderPrice * orderQty) / orderLeverage;
                
                console.log(`📋 [Order ${order.id}] Parsing:`, {
                  marginFromAPI: order.margin_required,
                  marginParsed: marginRequired,
                  price: orderPrice,
                  quantity: orderQty,
                  leverage: orderLeverage,
                  calculatedMargin,
                  isNaN: isNaN(calculatedMargin)
                });
                
                return (
                <div 
                  key={order.id}
                  style={{
                    background: '#131722',
                    borderRadius: '6px',
                    padding: '0.875rem',
                    border: '1px solid #2a2e39'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 600, color: '#d1d4dc' }}>{order.symbol}</span>
                      <span style={{ 
                        marginLeft: '0.5rem',
                        padding: '0.2rem 0.5rem',
                        background: order.side === 'LONG' ? 'rgba(38, 166, 154, 0.2)' : 'rgba(239, 83, 80, 0.2)',
                        color: order.side === 'LONG' ? '#26a69a' : '#ef5350',
                        borderRadius: '3px',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        {order.side} {order.leverage}x
                      </span>
                    </div>
                    <button
                      onClick={() => handleCancelOrder(order.id)}
                      disabled={cancelling === order.id}
                      style={{
                        padding: '0.3rem 0.75rem',
                        background: 'transparent',
                        border: '1px solid #ef5350',
                        color: '#ef5350',
                        borderRadius: '4px',
                        cursor: cancelling === order.id ? 'not-allowed' : 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        opacity: cancelling === order.id ? 0.5 : 1
                      }}
                    >
                      {cancelling === order.id ? 'Đang hủy...' : 'Hủy'}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.8rem' }}>
                    <div>
                      <span style={{ color: '#888' }}>Type:</span>
                      <span style={{ marginLeft: '0.25rem', color: '#d1d4dc' }}>{order.order_type.toUpperCase()}</span>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>Quantity:</span>
                      <span style={{ marginLeft: '0.25rem', color: '#d1d4dc' }}>{order.quantity}</span>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>Price:</span>
                      <span style={{ marginLeft: '0.25rem', color: '#d1d4dc' }}>
                        ${typeof order.price === 'number' ? order.price.toFixed(2) : parseFloat(String(order.price)).toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: '#888' }}>Margin:</span>
                      <span style={{ marginLeft: '0.25rem', color: '#d1d4dc' }}>
                        ${!isNaN(calculatedMargin) && calculatedMargin > 0 ? calculatedMargin.toFixed(2) : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div style={{ 
                    marginTop: '0.5rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid #2a2e39',
                    fontSize: '0.75rem',
                    color: '#888'
                  }}>
                    Tạo lúc: {new Date(order.created_at).toLocaleString()}
                  </div>
                </div>
              );
              })
            ) : (
              <div style={{ textAlign: 'center', color: '#888', padding: '2rem', fontSize: '0.9rem' }}>
                Không có lệnh chờ nào
              </div>
            )}
          </>
        )}
      </div>

      {/* TP/SL Modal */}
      {tpslModalOpen && selectedPosition && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#1e222d',
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '400px',
            width: '90%',
            border: '1px solid #2a2e39'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#d1d4dc', fontSize: '1.1rem' }}>
              Cập nhật TP/SL cho {selectedPosition.symbol}
            </h3>

            {/* Display position info */}
            <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: '#888' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Side:</span>
                <span style={{ color: '#d1d4dc', fontWeight: 600 }}>
                  {selectedPosition.side} {selectedPosition.leverage}x
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span>Entry Price:</span>
                <span style={{ color: '#d1d4dc' }}>
                  {parseFloat(String(selectedPosition.entry_price)).toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Liquidation:</span>
                <span style={{ color: selectedPosition.liquidation_price ? '#d1d4dc' : '#ef5350' }}>
                  {selectedPosition.liquidation_price 
                    ? parseFloat(String(selectedPosition.liquidation_price)).toFixed(2)
                    : (() => {
                      const entryPrice = typeof selectedPosition.entry_price === 'number' ? selectedPosition.entry_price : parseFloat(String(selectedPosition.entry_price));
                      const leverage = typeof selectedPosition.leverage === 'number' ? selectedPosition.leverage : parseFloat(String(selectedPosition.leverage));
                      return selectedPosition.side === 'LONG'
                        ? (entryPrice * (1 - 1 / leverage)).toFixed(2)
                        : (entryPrice * (1 + 1 / leverage)).toFixed(2);
                    })()}
                </span>
              </div>
            </div>

            {/* Error message */}
            {tpslError && (
              <div style={{
                background: 'rgba(239, 83, 80, 0.1)',
                border: '1px solid #ef5350',
                borderRadius: '4px',
                padding: '0.75rem',
                marginBottom: '1rem',
                color: '#ef5350',
                fontSize: '0.85rem'
              }}>
                {tpslError}
              </div>
            )}

            {/* Inputs */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d1d4dc', fontSize: '0.9rem', fontWeight: 600 }}>
                Take Profit Price (USDT)
              </label>
              <input
                type="number"
                value={tpPrice}
                onChange={(e) => setTpPrice(e.target.value)}
                placeholder="Nhập giá TP hoặc để trống"
                step="0.01"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#131722',
                  border: '1px solid #2a2e39',
                  borderRadius: '4px',
                  color: '#d1d4dc',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#d1d4dc', fontSize: '0.9rem', fontWeight: 600 }}>
                Stop Loss Price (USDT)
              </label>
              <input
                type="number"
                value={slPrice}
                onChange={(e) => setSlPrice(e.target.value)}
                placeholder="Nhập giá SL hoặc để trống"
                step="0.01"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: '#131722',
                  border: '1px solid #2a2e39',
                  borderRadius: '4px',
                  color: '#d1d4dc',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
                * SL phải cao hơn giá thanh lý ({selectedPosition.liquidation_price 
                  ? parseFloat(String(selectedPosition.liquidation_price)).toFixed(2)
                  : 'N/A'})
              </div>
            </div>

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={handleCloseTpslModal}
                disabled={savingTpsl}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: 'transparent',
                  border: '1px solid #2a2e39',
                  color: '#d1d4dc',
                  borderRadius: '4px',
                  cursor: savingTpsl ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  opacity: savingTpsl ? 0.5 : 1
                }}
              >
                Hủy
              </button>
              <button
                onClick={handleSaveTpsl}
                disabled={savingTpsl}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: '#26a69a',
                  border: 'none',
                  color: '#fff',
                  borderRadius: '4px',
                  cursor: savingTpsl ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  opacity: savingTpsl ? 0.6 : 1
                }}
              >
                {savingTpsl ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

// Set display name for debugging
FuturesOrdersPanel.displayName = 'FuturesOrdersPanel';

export default FuturesOrdersPanel;
