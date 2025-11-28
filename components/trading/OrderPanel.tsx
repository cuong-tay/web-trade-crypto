import React, { useState, useEffect, useRef } from 'react';
import { useTradingContext } from '../../context/TradingContext';
import { 
  TradingService, 
  type CreateOrderRequest,
  calculateSpotTradingFee,
  calculateFuturesOpeningFee
} from '../../services/tradingService';
import { WalletService } from '../../services/walletService';
import { OrderSide, OrderType } from '../../types';
import { API_BASE_URL } from '../../config/api';

interface WalletBalance {
  coin: string;
  available: number;
  locked: number;
  total: number;
  price?: number;
  usdValue?: number;
}

const OrderPanel: React.FC = () => {
  const renderCount = useRef(0);
  renderCount.current += 1;
  
  console.log(`🔄 [OrderPanel] RENDER #${renderCount.current}`);
  
  const { symbol, placeOrder, openPosition, lastPrice, marketType, lastChartTime } = useTradingContext();
  const [side, setSide] = useState<OrderSide>('buy');
  const [type, setType] = useState<OrderType>('market');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [total, setTotal] = useState('');
  const [loading, setLoading] = useState(false);
  const [userEditedPrice, setUserEditedPrice] = useState(false); // ✅ Track if user manually edited price
  
  // Futures specific
  const [leverage, setLeverage] = useState(10);
  const [margin, setMargin] = useState('');
  const [userEditedMargin, setUserEditedMargin] = useState(false); // ✅ Track if user manually edited margin
  
  // Wallet balances
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  
  // Extract base and quote asset
  const baseAsset = symbol.replace('USDT', '').replace('BUSD', '');
  const quoteAsset = symbol.includes('USDT') ? 'USDT' : 'BUSD';
  
  // Fetch price từ Binance API
  const fetchCoinPrice = async (coin: string): Promise<number> => {
    try {
      const pairSymbol = `${coin}USDT`;
      const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pairSymbol}`);
      if (response.ok) {
        const data = await response.json();
        const fetchedPrice = parseFloat(data.price);
        console.log(`💰 Fetched price for ${coin}: ${fetchedPrice}`);
        return fetchedPrice;
      }
    } catch (err) {
      console.error(`❌ Failed to fetch price for ${coin}:`, err);
    }
    return 0;
  };
  
  const isFutures = marketType === 'futures';

  // Load wallet balances
  useEffect(() => {
    // Load wallet từ localStorage lần đầu (mock data từ wallet page)
    loadWalletFromLocalStorage();
    
    // Also load from API if localStorage is empty (new login)
    const loadInitialWallet = async () => {
      const savedWallet = localStorage.getItem('walletData');
      if (!savedWallet || JSON.parse(savedWallet).length === 0) {
        console.log('📊 localStorage empty, attempting to fetch from API...');
        try {
          const response = await WalletService.getBalances();
          let balances = (response as any).spot || [];
          
          if (balances.length === 0 && Array.isArray(response)) {
            balances = response as any;
          }
          
          if (balances.length === 0 && (response as any).wallets) {
            balances = (response as any).wallets;
          }
          
          if (balances.length === 0 && (response as any).balances) {
            balances = (response as any).balances;
          }

          // Save to localStorage
          const balancesForStorage = balances.map((asset: any) => ({
            coin: asset.coin || asset.currency,
            available: parseFloat(String(asset.available || asset.total || 0)) || 0,
            locked: parseFloat(String(asset.locked || asset.locked_balance || 0)) || 0,
            total: parseFloat(String(asset.total || asset.balance || 0)) || 0,
            price: asset.price || 0,
            usdValue: asset.usdValue || 0
          }));

          localStorage.setItem('walletData', JSON.stringify(balancesForStorage));
          console.log('✅ Wallet loaded from API and saved to localStorage');
          loadWalletFromLocalStorage();
        } catch (error) {
          console.warn('⚠️ Could not load wallet from API:', error);
        }
      }
    };

    loadInitialWallet();
    
    // Listen for wallet updates từ trades/cancellations
    const handleWalletUpdate = () => {
      console.log('🔄 [OrderPanel] Wallet update event received!');
      console.log('⏰ Timestamp:', new Date().toLocaleTimeString());
      loadWalletFromLocalStorage();
    };
    
    window.addEventListener('walletUpdated', handleWalletUpdate);
    console.log('🎧 [OrderPanel] Registered walletUpdated event listener');
    
    return () => {
      window.removeEventListener('walletUpdated', handleWalletUpdate);
      console.log('🎧 [OrderPanel] Removed walletUpdated event listener');
    };
  }, []);

  useEffect(() => {
    // 🔍 DEBUG: Log mỗi khi useEffect chạy
    console.log('🔍 [OrderPanel useEffect] Triggered:', {
      type,
      lastPrice,
      userEditedPrice,
      currentPrice: price,
      willUpdate: type === 'market' && lastPrice > 0 && !userEditedPrice
    });
    
    // ✅ Chỉ tự động cập nhật giá khi:
    // 1. Type là market
    // 2. lastPrice > 0
    // 3. User chưa tự nhập giá (userEditedPrice = false)
    if (type === 'market' && lastPrice > 0 && !userEditedPrice) {
      console.log('🔄 [OrderPanel] Auto-updating price:', lastPrice);
      setPrice(lastPrice.toString());
      calculateTotal(lastPrice.toString(), quantity);
    }
  }, [type, lastPrice, userEditedPrice]);

  // Load wallet balances from server first, then fallback to localStorage
  // Load from localStorage - called on mount and when walletUpdated event fires
  const loadWalletFromLocalStorage = () => {
    console.log('\n📋 ===== LOAD WALLET FROM LOCALSTORAGE =====');
    const savedWallet = localStorage.getItem('walletData');
    console.log('📊 localStorage.getItem("walletData"):', savedWallet ? '✅ Found' : '❌ Not found');
    
    if (savedWallet) {
      try {
        const walletData = JSON.parse(savedWallet);
        console.log('💰 Parsed wallet data:', walletData);
        
        const formattedBalances = walletData.map((asset: any) => ({
          coin: asset.coin,
          available: asset.available || asset.total,
          locked: asset.locked || 0,
          total: asset.total,
          price: asset.price,
          usdValue: asset.usdValue
        }));
        
        console.log('✅ Formatted balances from localStorage:', formattedBalances);
        setBalances(formattedBalances);
        
        // 🔍 Log USDT balance specifically
        const usdtBalance = formattedBalances.find((b: any) => b.coin === 'USDT');
        console.log('💵 USDT balance after update:', usdtBalance);
        if (usdtBalance) {
          console.log(`💵 USDT Available for trading: ${usdtBalance.available}`);
        }
      } catch (error) {
        console.error('❌ Error parsing wallet data:', error);
        setBalances([]);
      }
    } else {
      console.warn('⚠️ No wallet data in localStorage - using empty balances. Please load wallet page first.');
      setBalances([]);
    }
  };

  // Fetch wallet from server API
  const getBalance = (coin: string): WalletBalance | undefined => {
    return balances.find(b => b.coin === coin);
  };

  const calculateTotal = (priceValue: string, qtyValue: string) => {
    const p = parseFloat(priceValue) || 0;
    const q = parseFloat(qtyValue) || 0;
    
    if (isFutures) {
      // For futures: Position Value = Margin × Leverage (independent of price)
      if (margin && parseFloat(margin) > 0) {
        const positionValue = parseFloat(margin) * leverage;
        setTotal(positionValue.toFixed(2));
      } else {
        // If no margin yet, calculate margin from price × quantity
        if (!userEditedMargin) {
          const positionValue = p * q;
          const requiredMargin = positionValue / leverage;
          setMargin(requiredMargin.toFixed(2));
          setTotal(positionValue.toFixed(2));
        }
      }
    } else {
      setTotal((p * q).toFixed(2));
    }
  };

  const handlePriceChange = (value: string) => {
    console.log('✍️ [OrderPanel] User editing price:', value);
    setPrice(value);
    setUserEditedPrice(true); // ✅ User manually edited price
    console.log('🔒 [OrderPanel] userEditedPrice set to TRUE - auto-update disabled');
    calculateTotal(value, quantity);
  };

  const handleQuantityChange = (value: string) => {
    setQuantity(value);
    calculateTotal(price || lastPrice.toString(), value);
  };

  const handleTotalChange = (value: string) => {
    setTotal(value);
    const p = parseFloat(price) || lastPrice || 0;
    if (p > 0) {
      setQuantity((parseFloat(value) / p).toFixed(8));
    }
  };

  const handleMarginChange = (value: string) => {
    console.log('✍️ [OrderPanel] User editing margin:', value);
    setMargin(value);
    setUserEditedMargin(true); // ✅ User manually edited margin
    console.log('🔒 [OrderPanel] userEditedMargin set to TRUE - auto-calculation disabled');
    
    const p = parseFloat(price) || lastPrice || 0;
    if (p > 0) {
      const positionValue = parseFloat(value) * leverage;
      const qty = (positionValue / p).toFixed(8);
      setQuantity(qty);
      setTotal(positionValue.toFixed(2));
    }
  };

  const handleLeverageChange = (value: number) => {
    setLeverage(value);
    
    if (isFutures && margin && parseFloat(margin) > 0) {
      // Recalculate position value and quantity based on new leverage
      const positionValue = parseFloat(margin) * value;
      setTotal(positionValue.toFixed(2));
      
      const p = parseFloat(price) || lastPrice || 0;
      if (p > 0) {
        const qty = (positionValue / p).toFixed(8);
        setQuantity(qty);
      }
    } else if (quantity && price) {
      calculateTotal(price, quantity);
    }
  };

    const setPercentage = (percentage: number) => {
    if (isFutures) {
      // For futures, calculate based on available margin
      const quoteBalance = getBalance(quoteAsset);
      if (quoteBalance) {
        const availableMargin = quoteBalance.available * percentage;
        setMargin(availableMargin.toFixed(2));
        setUserEditedMargin(false); // ✅ Reset flag when using percentage
        const p = parseFloat(price) || lastPrice || 0;
        if (p > 0) {
          const positionValue = availableMargin * leverage;
          const qty = (positionValue / p).toFixed(8);
          setQuantity(qty);
          setTotal(positionValue.toFixed(2));
        }
      }
    } else if (side === 'buy') {
      const quoteBalance = getBalance(quoteAsset);
      if (quoteBalance) {
        const availableUsdt = quoteBalance.available;
        const p = parseFloat(price) || lastPrice || 0;
        
        if (p > 0) {
          const targetTotal = availableUsdt * percentage;
          const fee = targetTotal * 0.001;
          const totalMinusFee = targetTotal - fee;
          const calculatedAmount = (totalMinusFee / p).toFixed(8);
          setQuantity(calculatedAmount);
          setTotal(targetTotal.toFixed(2));
        }
      }
    } else {
      const baseBalance = getBalance(baseAsset);
      if (baseBalance) {
        const qty = (baseBalance.available * percentage).toFixed(8);
        setQuantity(qty);
        calculateTotal(price || lastPrice.toString(), qty);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const orderPrice = type === 'market' ? lastPrice : parseFloat(price);
    const orderQuantity = parseFloat(quantity);
    
    if (!orderPrice || !orderQuantity || orderQuantity <= 0) {
      alert('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    // Validate balance
    if (isFutures) {
      // For futures, check margin
      const requiredMargin = parseFloat(margin);
      const quoteBalance = getBalance(quoteAsset);
      if (!quoteBalance || quoteBalance.available < requiredMargin) {
        alert(`Margin không đủ! Cần: ${requiredMargin.toFixed(2)} ${quoteAsset}`);
        return;
      }
    } else {
      const totalCost = orderPrice * orderQuantity;
      const fee = totalCost * 0.001;

      if (side === 'buy') {
        const quoteBalance = getBalance(quoteAsset);
        if (!quoteBalance || quoteBalance.available < totalCost + fee) {
          const needed = totalCost + fee;
          const available = quoteBalance?.available || 0;
          alert(`Số dư ${quoteAsset} không đủ!\nCần: ${needed.toFixed(2)}\nCó: ${available.toFixed(2)}`);
          return;
        }
      } else {
        const baseBalance = getBalance(baseAsset);
        if (!baseBalance || baseBalance.available < orderQuantity) {
          const available = baseBalance?.available || 0;
          alert(`Số dư ${baseAsset} không đủ!\nCần: ${orderQuantity.toFixed(8)}\nCó: ${available.toFixed(8)}`);
          return;
        }
      }
    }

    setLoading(true);
    
    try {
      console.log('🎯 ===== BẮT ĐẦU ĐẶT LỆNH =====');
      console.log(`📊 Mode: ${isFutures ? 'FUTURES' : 'SPOT'}`);
      console.log(`📊 Order Type: ${type.toUpperCase()}`);
      console.log(`📊 Side: ${side.toUpperCase()}`);
      console.log(`📊 Symbol: ${symbol}`);
      console.log(`📊 Price: ${orderPrice}`);
      console.log(`📊 Quantity: ${orderQuantity}`);
      if (isFutures) console.log(`📊 Leverage: ${leverage}x`);
      
      if (isFutures) {
        const positionSide = side === 'buy' ? 'LONG' : 'SHORT';
        const positionValue = orderPrice * orderQuantity;
        const requiredMargin = positionValue / leverage;
        
        console.log('💰 [FUTURES] Margin calculation:', {
          positionValue,
          leverage,
          requiredMargin,
          marginState: margin,
          marginParsed: parseFloat(margin),
        });

        if (type === 'market') {
          // ✅ MARKET ORDER - Mở vị thế ngay lập tức
          console.log('📤 Opening MARKET futures position:', {
            symbol,
            side: positionSide,
            quantity: orderQuantity,
            leverage,
            entry_price: orderPrice,
          });

          // Calculate collateral (margin) = position value / leverage
          const collateral = (orderQuantity * orderPrice) / leverage;
          
          // Calculate opening fee (0.02%) using utility function
          const openingFee = calculateFuturesOpeningFee(orderQuantity, orderPrice);
          
          const positionResponse = await TradingService.openFuturesPosition({
            symbol,
            side: positionSide,
            quantity: orderQuantity,
            leverage,
            collateral,  // Required by backend
            entry_price: orderPrice,
            timestamp: Date.now(),
            fee: openingFee,  // ✅ Send opening fee
          });

          console.log('✅ Futures position opened:', positionResponse);

          // Cập nhật wallet từ response nếu có
          if (positionResponse && (positionResponse as any).wallet_updates) {
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
          } else {
            // Fallback: local update nếu backend chưa trả wallet_updates
            updateBalancesAfterFuturesTrade(side, quoteAsset, requiredMargin);
          }

          // Dispatch event để TradesPanel refresh
          window.dispatchEvent(new Event('futuresPositionOpened'));
          
          alert(`✅ Mở vị thế ${positionSide} ${symbol} thành công!\nĐòn bẩy: ${leverage}x\nMargin: ${requiredMargin.toFixed(2)} ${quoteAsset}`);
          
        } else {
          // ✅ LIMIT ORDER - Tạo lệnh chờ khớp (tương tự Spot)
          console.log('📤 Creating LIMIT futures order:', {
            symbol,
            side: positionSide,
            order_type: 'limit',
            quantity: orderQuantity,
            price: orderPrice,
            leverage,
          });

          const orderResponse = await TradingService.createFuturesOrder({
            symbol,
            side: positionSide,
            order_type: 'limit',
            quantity: orderQuantity,
            price: orderPrice,
            leverage,
            timestamp: Date.now(),
          });

          console.log('✅ Futures LIMIT order created:', orderResponse);
          console.log('💰 wallet_updates in response?', orderResponse.wallet_updates ? 'YES' : 'NO');
          console.log('💰 margin_required in response?', orderResponse.margin_required ? 'YES' : 'NO');
          
          // ✅ Update wallet from response (backend đã sửa)
          if (orderResponse.wallet_updates) {
            console.log('💰 Updating wallet from Futures order response...');
            
            const walletUpdates = orderResponse.wallet_updates;
            let updatedBalances = [...balances];
            
            // Update all coins in wallet_updates
            updatedBalances = balances.map(balance => {
              if (walletUpdates[balance.coin]) {
                const update = walletUpdates[balance.coin];
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
            
            // Add new coins if not exist
            Object.keys(walletUpdates).forEach(coin => {
              if (!balances.find(b => b.coin === coin)) {
                console.log(`➕ Adding new coin: ${coin}`);
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
            
            setBalances(updatedBalances);
            localStorage.setItem('walletData', JSON.stringify(updatedBalances));
            window.dispatchEvent(new Event('walletUpdated'));
            console.log('✅ Wallet updated after Futures order');
          } else {
            console.warn('⚠️ Backend chưa trả về wallet_updates - vui lòng kiểm tra API');
          }

          // Dispatch event để TradesPanel refresh pending orders
          window.dispatchEvent(new Event('futuresOrderCreated'));

          alert(`✅ Đặt lệnh LIMIT ${positionSide} ${symbol} thành công!\nGiá: ${orderPrice}\nĐòn bẩy: ${leverage}x\nLệnh sẽ tự động khớp khi giá chạm mức ${orderPrice}`);
        }
        
        console.log('✅ ===== HOÀN TẤT ĐẶT LỆNH FUTURES =====');
        
      } else {
        console.log('\n🔵 ===== SPOT TRADING =====');
        console.log('📊 Loại lệnh:', type.toUpperCase());
        console.log('📊 Hướng:', side.toUpperCase());
        console.log('📊 Symbol:', symbol);
        console.log('📊 Số lượng:', orderQuantity);
        console.log('📊 Giá:', orderPrice);

        // Calculate trading fee (0.1%) using utility function
        const calculatedFee = calculateSpotTradingFee(orderQuantity, orderPrice);
        console.log('💰 Phí giao dịch (0.1%):', calculatedFee, 'USDT');
        
        const orderRequest: CreateOrderRequest = {
          symbol,
          side: side.toUpperCase() as 'BUY' | 'SELL',
          order_type: type === 'market' ? 'market' : 'limit',
          quantity: Number(orderQuantity),
          price: Number(orderPrice),
          timestamp: Date.now(), // ⏰ Real-time timestamp
          fee: calculatedFee,    // ✅ Send calculated fee to backend
        };

        // 📡 Gọi API tạo lệnh
        console.log('📤 Đang gửi request tới backend...');
        const createdOrder = await TradingService.createOrder(orderRequest);
        
        console.log('📥 Response từ backend:');
        console.log('  - Order ID:', createdOrder.id);
        console.log('  - Status:', createdOrder.status);
        console.log('  - Wallet updates:', createdOrder.wallet_updates ? '✅' : '❌');

        // 🎯 Xử lý theo loại lệnh
        if (type === 'market') {
          // Market orders - backend tự động fill
          if (createdOrder.status === 'filled') {
            console.log('✅ MARKET ORDER THÀNH CÔNG');
            console.log('  - Trade ID:', createdOrder.id);
            console.log('  - Số lượng:', orderQuantity, baseAsset);
            console.log('  - Giá:', orderPrice, quoteAsset);
            console.log('  - Phí:', calculatedFee, quoteAsset);
            console.log('  - Tổng:', (orderQuantity * orderPrice).toFixed(2), quoteAsset);
            
            const totalValue = (orderQuantity * orderPrice).toFixed(2);
            const actionText = side === 'buy' ? 'MUA' : 'BÁN';
            const message = `✅ Lệnh MARKET ${actionText} thành công!\n\n` +
                          `Coin: ${baseAsset}\n` +
                          `Số lượng: ${orderQuantity}\n` +
                          `Giá: ${orderPrice.toLocaleString()} ${quoteAsset}\n` +
                          `Tổng: ${parseFloat(totalValue).toLocaleString()} ${quoteAsset}\n` +
                          `Phí: ${calculatedFee} ${quoteAsset}`;
            alert(message);
          } else {
            // Backend chưa fix
            console.error('❌ MARKET ORDER FAILED');
            console.error('  - Expected status: filled');
            console.error('  - Actual status:', createdOrder.status);
            console.error('  - Backend cần fix theo: BACKEND_FIX_MARKET_ORDER_DUPLICATE.md');
            alert(`⚠️ Backend chưa auto-fill Market order!\nStatus: ${createdOrder.status}\n\nĐọc: BACKEND_FIX_MARKET_ORDER_DUPLICATE.md`);
          }
        }
        // Check nếu là LIMIT order và giá đặt khớp với thị trường thì auto-fill
        else if (type === 'limit' && createdOrder.status === 'pending') {
          const limitPrice = parseFloat(String(createdOrder.price)) || 0;
          const marketPrice = lastPrice;
          
          // ✅ Logic đúng:
          // - MUA: giá limit >= giá thị trường → Khớp ngay (mua được với giá tốt hơn hoặc bằng)
          // - BÁN: giá limit <= giá thị trường → Khớp ngay (bán được với giá tốt hơn hoặc bằng)
          const shouldFill = (side === 'buy' && limitPrice >= marketPrice) || 
                           (side === 'sell' && limitPrice <= marketPrice);
          
          if (shouldFill) {
            console.log(`✅ Lệnh Limit khớp ngay! ${side.toUpperCase()} @ ${limitPrice} | Thị trường: ${marketPrice}`);
            // Call fill-trade API để khớp lệnh
            try {
              const fillResponse = await TradingService.fillTrade(createdOrder.id, limitPrice, orderQuantity, Date.now());
              console.log('✅ Lệnh đã khớp thành công:', fillResponse);
              
              // Update wallet từ fill response
              if (fillResponse.wallet_updates) {
                createdOrder.wallet_updates = fillResponse.wallet_updates;
                createdOrder.status = 'filled';
              }
              
              // Thông báo cho người dùng
              const message = `✅ Lệnh ${side.toUpperCase()} ${symbol} @ ${limitPrice} đã khớp thành công!`;
              console.log(`🔔 ${message}`);
              alert(message);
            } catch (err) {
              console.error('❌ Auto-fill failed:', err);
              const errorMsg = err instanceof Error ? err.message : String(err);
              console.warn(`⚠️ Lệnh LIMIT vẫn ở trạng thái Đang chờ (auto-fill lỗi): ${errorMsg}`);
              // Vẫn tiếp tục với lệnh pending
            }
          } else {
            console.log(`📋 Lệnh LIMIT đặt thành công, đang chờ khớp: ${side.toUpperCase()} @ ${limitPrice} | Thị trường: ${marketPrice}`);
            // Thông báo cho người dùng
            const message = `📋 Lệnh LIMIT ${side.toUpperCase()} ${symbol} @ ${limitPrice} đã đặt, đang chờ khớp...\n(Giá thị trường: ${marketPrice})`;
            console.log(`🔔 ${message}`);
            alert(message);
          }
        } else if (type === 'limit' && createdOrder.status === 'filled') {
          // Lệnh LIMIT được khớp ngay bởi backend
          console.log(`✅ Lệnh LIMIT khớp ngay bởi backend! ${side.toUpperCase()} @ ${createdOrder.price}`);
          const message = `✅ Lệnh LIMIT ${side.toUpperCase()} ${symbol} @ ${createdOrder.price} đã khớp thành công!`;
          console.log(`🔔 ${message}`);
          alert(message);
        } else {
          console.log('🔍 Trạng thái lệnh:', { type, status: createdOrder.status });
        }

        // ✅ Cập nhật wallet từ response (không cần fetch lại)
        // Logic: balance giảm/tăng ngay khi create order, không có locked state
        if (createdOrder.wallet_update || createdOrder.wallet_updates) {
          console.log('💰 Cập nhật wallet từ response:', createdOrder.wallet_update || createdOrder.wallet_updates);
          console.log('📋 Order side:', side, 'Base:', baseAsset, 'Quote:', quoteAsset);
          
          let updatedBalances = [...balances];
          
          // Xử lý wallet_updates (multiple coins - từ fill-trade hoặc create-order)
          if (createdOrder.wallet_updates) {
            const walletUpdates = createdOrder.wallet_updates;
            console.log('📊 wallet_updates coins:', Object.keys(walletUpdates));
            
            // Update TẤT CẢ coins có trong wallet_updates
            updatedBalances = balances.map(balance => {
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
            
            // Add coins mới nếu chúng không có trong balances nhưng có trong wallet_updates
            for (const coin of Object.keys(walletUpdates)) {
              if (!balances.find(b => b.coin === coin)) {
                console.log(`➕ Thêm coin mới: ${coin}`);
                // Lấy giá từ Binance API (async)
                const coinPrice = await fetchCoinPrice(coin);
                const coinUsdValue = walletUpdates[coin].balance * coinPrice;
                updatedBalances.push({
                  coin,
                  available: walletUpdates[coin].balance,
                  locked: 0,
                  total: walletUpdates[coin].balance,
                  price: coinPrice,
                  usdValue: coinUsdValue,
                });
              }
            };
          } 
          // Xử lý wallet_update (single coin từ create-order/cancel-order - deprecated)
          else if (createdOrder.wallet_update) {
            console.warn('⚠️ Using deprecated wallet_update (single coin) - backend should return wallet_updates');
            const walletUpdate = createdOrder.wallet_update;
            updatedBalances = balances.map(balance => {
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
          
          setBalances(updatedBalances);
          localStorage.setItem('walletData', JSON.stringify(updatedBalances));
          window.dispatchEvent(new Event('walletUpdated'));
          
          console.log('✨ Wallet cập nhật từ response thành công:', updatedBalances);
        } else {
          console.warn('⚠️ Response không có wallet_update/wallet_updates - backend nên luôn trả về!');
        }
        
        console.log('✅ ===== HOÀN TẤT ĐẶT LỆNH SPOT =====');
      }
      
      setPrice('');
      setQuantity('');
      setTotal('');
      setMargin('');
    } catch (error) {
      let errorMsg = 'Lỗi không xác định';
      if (error instanceof Error) {
        errorMsg = error.message;
      } else if (typeof error === 'string') {
        errorMsg = error;
      } else if (typeof error === 'object' && error !== null) {
        try {
          errorMsg = JSON.stringify(error, null, 2);
        } catch {
          errorMsg = String(error);
        }
      }
      
      console.error('❌ Đặt lệnh thất bại:', errorMsg);
      alert(`❌ Đặt lệnh thất bại!\n${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const updateBalancesAfterFuturesTrade = (
    tradeSide: OrderSide,
    quote: string,
    marginUsed: number
  ) => {
    // For futures, deduct margin from available balance (no locked state)
    const updatedBalances = balances.map(balance => {
      if (balance.coin === quote) {
        return {
          ...balance,
          available: balance.available - marginUsed,
          locked: 0,  // No locked state
          total: (balance.available - marginUsed),  // Total = available
        };
      }
      return balance;
    });

    setBalances(updatedBalances);
    
    const walletData = updatedBalances.map(b => ({
      coin: b.coin,
      total: b.total,
      available: b.available,
      locked: b.locked,
      usdValue: 0
    }));
    
    console.log('Opening position - updating wallet:', walletData);
    localStorage.setItem('walletData', JSON.stringify(walletData));
    
    // Trigger event để các component khác cập nhật
    window.dispatchEvent(new Event('walletUpdated'));
  };

  const updateBalancesAfterTrade = (
    tradeSide: OrderSide,
    base: string,
    quote: string,
    qty: number,
    prc: number
  ) => {
    const totalCost = qty * prc;
    const fee = totalCost * 0.001;

    const updatedBalances = balances.map(balance => {
      if (tradeSide === 'buy') {
        if (balance.coin === quote) {
          return {
            ...balance,
            available: Math.max(0, balance.available - totalCost - fee),
            total: Math.max(0, balance.total - totalCost - fee)
          };
        }
        if (balance.coin === base) {
          return {
            ...balance,
            available: balance.available + qty,
            total: balance.total + qty
          };
        }
      } else {
        if (balance.coin === base) {
          return {
            ...balance,
            available: Math.max(0, balance.available - qty),
            total: Math.max(0, balance.total - qty)
          };
        }
        if (balance.coin === quote) {
          return {
            ...balance,
            available: balance.available + totalCost - fee,
            total: balance.total + totalCost - fee
          };
        }
      }
      return balance;
    });

    setBalances(updatedBalances);
    
    // Save to localStorage
    const walletData = updatedBalances.map(b => ({
      coin: b.coin,
      total: b.total,
      available: b.available,
      locked: b.locked,
      usdValue: 0
    }));
    localStorage.setItem('walletData', JSON.stringify(walletData));
  };

  const formatBalance = (value: number | undefined, coin: string) => {
    // Convert to number and handle invalid values
    const numValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
    
    if (coin === 'USDT' || coin === 'BUSD') {
      return numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return numValue.toFixed(8).replace(/\.?0+$/, '');
  };

  // Get available balance directly from wallet localStorage
  const getAvailableBalanceFromWallet = (coin: string): number => {
    const savedWallet = localStorage.getItem('walletData');
    console.log(`🔍 [getAvailableBalance] Looking for ${coin}`);
    console.log(`📦 [getAvailableBalance] walletData in localStorage:`, savedWallet ? 'EXISTS' : 'EMPTY');
    
    if (savedWallet) {
      try {
        const walletData = JSON.parse(savedWallet);
        console.log(`📊 [getAvailableBalance] Parsed wallet:`, walletData);
        const asset = walletData.find((a: any) => a.coin === coin);
        console.log(`💰 [getAvailableBalance] Found ${coin}:`, asset);
        return asset ? parseFloat(asset.available) || 0 : 0;
      } catch (error) {
        console.error(`❌ [getAvailableBalance] Error reading wallet:`, error);
        return 0;
      }
    }
    console.warn(`⚠️ [getAvailableBalance] No wallet data for ${coin}`);
    return 0;
  };

  const availableBalance = side === 'buy' 
    ? getAvailableBalanceFromWallet(quoteAsset)
    : getAvailableBalanceFromWallet(baseAsset);
  
  const balanceAsset = side === 'buy' ? quoteAsset : baseAsset;
  
  console.log(`📈 [availableBalance] side=${side}, asset=${balanceAsset}, balance=${availableBalance}`);

  const panelStyle: React.CSSProperties = {
    background: '#1e222d',
    padding: '1rem',
    borderRadius: '4px',
    height: '100%',
    overflowY: 'auto'
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#131722',
    color: '#d1d4dc',
    border: '1px solid #2a2e39',
    padding: '0.5rem',
    borderRadius: '4px',
    boxSizing: 'border-box',
    fontSize: '0.9rem'
  };
  
  const labelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: '0.5rem',
    fontSize: '0.85rem',
    color: '#888',
    fontWeight: 500
  };

  const inputGroupStyle: React.CSSProperties = {
    marginBottom: '1rem'
  };

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Đặt lệnh {isFutures ? 'Futures' : 'Spot'}</h3>
        <span style={{ fontSize: '0.85rem', color: '#888' }}>{symbol}</span>
      </div>

      {/* Buy/Sell Tabs - Only for Spot */}
      {!isFutures && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <button 
            onClick={() => setSide('buy')} 
            style={{ 
              flex: 1, 
              padding: '0.6rem', 
              background: side === 'buy' ? 'rgba(38, 166, 154, 0.2)' : '#2a2e39',
              border: side === 'buy' ? '1px solid #26a69a' : '1px solid transparent',
              color: side === 'buy' ? '#26a69a' : '#888',
              cursor: 'pointer',
              borderRadius: '4px',
              fontWeight: 600,
              transition: 'all 0.3s'
            }}
          >
            Mua
          </button>
          <button 
            onClick={() => setSide('sell')} 
            style={{ 
              flex: 1, 
              padding: '0.6rem', 
              background: side === 'sell' ? 'rgba(239, 83, 80, 0.2)' : '#2a2e39',
              border: side === 'sell' ? '1px solid #ef5350' : '1px solid transparent',
              color: side === 'sell' ? '#ef5350' : '#888',
              cursor: 'pointer',
              borderRadius: '4px',
              fontWeight: 600,
              transition: 'all 0.3s'
            }}
          >
            Bán
          </button>
        </div>
      )}

      {/* Order Type */}
      <div style={inputGroupStyle}>
        <label style={labelStyle}>Loại lệnh</label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            onClick={() => {
              setType('limit');
              setUserEditedPrice(false); // ✅ Reset flag when switching type
            }}
            style={{
              flex: 1,
              padding: '0.5rem',
              background: type === 'limit' ? '#363c4f' : '#2a2e39',
              border: '1px solid #2a2e39',
              color: type === 'limit' ? '#d1d4dc' : '#888',
              cursor: 'pointer',
              borderRadius: '4px',
              fontSize: '0.85rem'
            }}
          >
            Limit
          </button>
          <button
            type="button"
            onClick={() => {
              setType('market');
              setUserEditedPrice(false); // ✅ Reset flag when switching type
            }}
            style={{
              flex: 1,
              padding: '0.5rem',
              background: type === 'market' ? '#363c4f' : '#2a2e39',
              border: '1px solid #2a2e39',
              color: type === 'market' ? '#d1d4dc' : '#888',
              cursor: 'pointer',
              borderRadius: '4px',
              fontSize: '0.85rem'
            }}
          >
            Market
          </button>
        </div>
      </div>

      {/* Leverage Control - Only for Futures */}
      {isFutures && (
        <div style={inputGroupStyle}>
          <label style={labelStyle}>Đòn bẩy: {leverage}x</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="range"
              min="1"
              max="125"
              value={leverage}
              onChange={(e) => handleLeverageChange(parseInt(e.target.value))}
              style={{
                flex: 1,
                accentColor: '#26a69a'
              }}
            />
            <input
              type="number"
              min="1"
              max="125"
              value={leverage}
              onChange={(e) => handleLeverageChange(parseInt(e.target.value) || 1)}
              style={{
                width: '60px',
                background: '#131722',
                color: '#d1d4dc',
                border: '1px solid #2a2e39',
                padding: '0.4rem',
                borderRadius: '4px',
                textAlign: 'center',
                fontSize: '0.85rem'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem' }}>
            {[1, 5, 10, 20, 50, 100].map(lev => (
              <button
                key={lev}
                type="button"
                onClick={() => handleLeverageChange(lev)}
                style={{
                  flex: 1,
                  padding: '0.3rem',
                  background: leverage === lev ? '#26a69a' : '#2a2e39',
                  border: 'none',
                  color: leverage === lev ? 'white' : '#888',
                  cursor: 'pointer',
                  borderRadius: '3px',
                  fontSize: '0.75rem',
                  fontWeight: leverage === lev ? 600 : 400
                }}
              >
                {lev}x
              </button>
            ))}
          </div>
          <div style={{ 
            marginTop: '0.5rem', 
            padding: '0.5rem',
            background: 'rgba(255, 152, 0, 0.1)',
            borderLeft: '3px solid #ff9800',
            borderRadius: '4px',
            fontSize: '0.75rem',
            color: '#ff9800'
          }}>
            ⚠️ Đòn bẩy cao có rủi ro thanh lý cao
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Available Balance */}
        <div style={{ 
          background: '#131722', 
          padding: '0.75rem', 
          borderRadius: '4px', 
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.85rem', color: '#888' }}>Số dư khả dụng:</span>
          <span style={{ fontSize: '0.9rem', color: '#26a69a', fontWeight: 600 }}>
            {formatBalance(availableBalance, balanceAsset)} {balanceAsset}
          </span>
        </div>

        {/* Price */}
        {type === 'limit' ? (
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Giá</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="number" 
                placeholder="0.00" 
                value={price} 
                onChange={e => handlePriceChange(e.target.value)} 
                style={inputStyle}
                step="0.01"
                required 
              />
              <span style={{ 
                position: 'absolute', 
                right: '0.75rem', 
                top: '50%', 
                transform: 'translateY(-50%)',
                color: '#888',
                fontSize: '0.85rem'
              }}>
                {quoteAsset}
              </span>
            </div>
            {lastPrice > 0 && (
              <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
                📊 Thị trường: {lastPrice.toFixed(2)} {quoteAsset}
              </div>
            )}
          </div>
        ) : (
          <div style={{ 
            marginBottom: '1rem', 
            padding: '0.75rem',
            background: 'linear-gradient(135deg, #1a1f2e 0%, #131722 100%)',
            borderRadius: '4px',
            border: '1px solid #26a69a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '0.85rem', color: '#26a69a', fontWeight: 600 }}>💹 Giá thị trường:</span>
            <span style={{ 
              fontSize: '1rem', 
              color: '#26a69a', 
              fontWeight: 700,
              animation: 'pulse 1s infinite'
            }}>
              {lastPrice > 0 ? lastPrice.toFixed(2) : '--'} {quoteAsset}
            </span>
          </div>
        )}
        
        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
        `}</style>

        {/* Quantity */}
        <div style={inputGroupStyle}>
          <label style={labelStyle}>Số lượng</label>
          <div style={{ position: 'relative' }}>
            <input 
              type="number" 
              placeholder="0.00" 
              value={quantity} 
              onChange={e => handleQuantityChange(e.target.value)} 
              style={inputStyle}
              step="0.00000001"
              required 
            />
            <span style={{ 
              position: 'absolute', 
              right: '0.75rem', 
              top: '50%', 
              transform: 'translateY(-50%)',
              color: '#888',
              fontSize: '0.85rem'
            }}>
              {baseAsset}
            </span>
          </div>
          {side === 'sell' && (
            <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
              Có sẵn: {formatBalance(getBalance(baseAsset)?.available || 0, baseAsset)} {baseAsset}
            </div>
          )}
          {side === 'buy' && (
            <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
              Có sẵn: {formatBalance(getBalance(quoteAsset)?.available || 0, quoteAsset)} {quoteAsset}
            </div>
          )}
        </div>

        {/* Percentage Buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
          {[25, 50, 75, 100].map(pct => (
            <button
              key={pct}
              type="button"
              onClick={() => setPercentage(pct / 100)}
              style={{
                padding: '0.4rem',
                background: '#2a2e39',
                border: '1px solid #363c4f',
                color: '#888',
                cursor: 'pointer',
                borderRadius: '4px',
                fontSize: '0.8rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#26a69a';
                e.currentTarget.style.color = '#26a69a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#363c4f';
                e.currentTarget.style.color = '#888';
              }}
            >
              {pct}%
            </button>
          ))}
        </div>

        {/* Margin - Only for Futures */}
        {isFutures && (
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Margin (Ký quỹ)</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="number" 
                placeholder="0.00" 
                value={margin || ''} 
                onChange={e => handleMarginChange(e.target.value)} 
                style={inputStyle}
                step="0.01"
                min="0"
              />
              <span style={{ 
                position: 'absolute', 
                right: '0.75rem', 
                top: '50%', 
                transform: 'translateY(-50%)',
                color: '#888',
                fontSize: '0.85rem'
              }}>
                {quoteAsset}
              </span>
            </div>
            <div style={{ 
              marginTop: '0.5rem',
              fontSize: '0.75rem',
              color: '#888',
              display: 'flex',
              justifyContent: 'space-between'
            }}>
              <span>Giá trị vị thế:</span>
              <span style={{ color: '#d1d4dc' }}>{total || '0.00'} {quoteAsset}</span>
            </div>
          </div>
        )}

        {/* Total - Only for Spot */}
        {!isFutures && (
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Tổng</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="number" 
                placeholder="0.00" 
                value={total} 
                onChange={e => handleTotalChange(e.target.value)} 
                style={inputStyle}
                step="0.01"
              />
              <span style={{ 
                position: 'absolute', 
                right: '0.75rem', 
                top: '50%', 
                transform: 'translateY(-50%)',
                color: '#888',
                fontSize: '0.85rem'
              }}>
                {quoteAsset}
              </span>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button 
          type="submit" 
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '0.75rem', 
            background: loading ? '#555' : (side === 'buy' ? '#26a69a' : '#ef5350'),
            border: 'none', 
            color: 'white', 
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '1rem', 
            borderRadius: '4px',
            fontWeight: 600,
            transition: 'all 0.3s',
            marginBottom: isFutures ? '0.5rem' : 0
          }}
          onClick={() => isFutures && setSide('buy')}
        >
          {loading ? 'Đang xử lý...' : `${isFutures ? 'Mở Long' : (side === 'buy' ? 'Mua' : 'Bán')} ${baseAsset}`}
        </button>

        {/* Short Button - Only for Futures */}
        {isFutures && (
          <button 
            type="button"
            onClick={() => {
              setSide('sell');
              setTimeout(() => {
                const form = document.querySelector('form');
                if (form) {
                  form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                }
              }, 100);
            }}
            disabled={loading}
            style={{ 
              width: '100%', 
              padding: '0.75rem', 
              background: loading ? '#555' : '#ef5350',
              border: 'none', 
              color: 'white', 
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem', 
              borderRadius: '4px',
              fontWeight: 600,
              transition: 'all 0.3s'
            }}
          >
            {loading ? 'Đang xử lý...' : `Mở Short ${baseAsset}`}
          </button>
        )}

        {/* Fee Info */}
        <div style={{ 
          marginTop: '1rem', 
          paddingTop: '1rem',
          borderTop: '1px solid #2a2e39',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          fontSize: '0.8rem',
          color: '#888'
        }}>
          {isFutures ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Phí mở vị thế (0.02%):</span>
                <span>{(parseFloat(total || '0') * 0.0002).toFixed(2)} {quoteAsset}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Giá thanh lý dự kiến:</span>
                <span style={{ color: '#ef5350' }}>
                  {(() => {
                    const p = parseFloat(price) || lastPrice;
                    const lev = leverage;
                    const liquidationPrice = side === 'buy' 
                      ? p * (1 - 0.9 / lev)
                      : p * (1 + 0.9 / lev);
                    return liquidationPrice.toFixed(2);
                  })()} {quoteAsset}
                </span>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Phí giao dịch (0.1%):</span>
              <span>{(parseFloat(total || '0') * 0.001).toFixed(2)} {quoteAsset}</span>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default OrderPanel;