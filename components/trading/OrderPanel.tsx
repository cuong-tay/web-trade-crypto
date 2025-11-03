import React, { useState, useEffect } from 'react';
import { useTradingContext } from '../../context/TradingContext';
import { OrderSide, OrderType } from '../../types';

interface WalletBalance {
  coin: string;
  available: number;
  locked: number;
  total: number;
}

const OrderPanel: React.FC = () => {
  const { symbol, placeOrder, openPosition, lastPrice, marketType } = useTradingContext();
  const [side, setSide] = useState<OrderSide>('buy');
  const [type, setType] = useState<OrderType>('market');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [total, setTotal] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Futures specific
  const [leverage, setLeverage] = useState(10);
  const [margin, setMargin] = useState('');
  
  // Wallet balances
  const [balances, setBalances] = useState<WalletBalance[]>([]);
  
  // Extract base and quote asset
  const baseAsset = symbol.replace('USDT', '').replace('BUSD', '');
  const quoteAsset = symbol.includes('USDT') ? 'USDT' : 'BUSD';
  
  const isFutures = marketType === 'futures';

  // Load wallet balances
  useEffect(() => {
    loadWalletBalances();
    
    // Listen for wallet updates from other components
    const handleWalletUpdate = () => {
      console.log('Wallet update event received, reloading balances...');
      loadWalletBalances();
    };
    
    window.addEventListener('walletUpdated', handleWalletUpdate);
    
    return () => {
      window.removeEventListener('walletUpdated', handleWalletUpdate);
    };
  }, []);

  useEffect(() => {
    if (type === 'market' && lastPrice > 0) {
      setPrice(lastPrice.toString());
      calculateTotal(lastPrice.toString(), quantity);
    }
  }, [type, lastPrice]);

  const loadWalletBalances = () => {
    const savedWallet = localStorage.getItem('walletData');
    if (savedWallet) {
      const walletData = JSON.parse(savedWallet);
      const formattedBalances = walletData.map((asset: any) => ({
        coin: asset.coin,
        available: asset.available || asset.total,
        locked: asset.locked || 0,
        total: asset.total
      }));
      setBalances(formattedBalances);
    } else {
      // Default balances
      setBalances([
        { coin: 'BTC', available: 0.025, locked: 0, total: 0.025 },
        { coin: 'ETH', available: 1.2, locked: 0.3, total: 1.5 },
        { coin: 'USDT', available: 10000, locked: 0, total: 10000 },
        { coin: 'BNB', available: 20, locked: 5, total: 25 },
        { coin: 'SOL', available: 50, locked: 0, total: 50 },
      ]);
    }
  };

  const getBalance = (coin: string): WalletBalance | undefined => {
    return balances.find(b => b.coin === coin);
  };

  const calculateTotal = (priceValue: string, qtyValue: string) => {
    const p = parseFloat(priceValue) || 0;
    const q = parseFloat(qtyValue) || 0;
    
    if (isFutures) {
      // For futures, calculate margin required
      const positionValue = p * q;
      const requiredMargin = positionValue / leverage;
      setMargin(requiredMargin.toFixed(2));
      setTotal(positionValue.toFixed(2));
    } else {
      setTotal((p * q).toFixed(2));
    }
  };

  const handlePriceChange = (value: string) => {
    setPrice(value);
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
    setMargin(value);
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
    if (quantity && price) {
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
          alert(`Số dư ${quoteAsset} không đủ!`);
          return;
        }
      } else {
        const baseBalance = getBalance(baseAsset);
        if (!baseBalance || baseBalance.available < orderQuantity) {
          alert(`Số dư ${baseAsset} không đủ!`);
          return;
        }
      }
    }

    setLoading(true);
    
    try {
      if (isFutures) {
        // Tạo vị thế Futures
        const positionSide = side === 'buy' ? 'LONG' : 'SHORT';
        const positionValue = orderPrice * orderQuantity;
        const requiredMargin = positionValue / leverage;
        
        // Tính giá thanh lý
        const liquidationPrice = positionSide === 'LONG'
          ? orderPrice * (1 - 0.9 / leverage)
          : orderPrice * (1 + 0.9 / leverage);

        openPosition({
          symbol,
          side: positionSide,
          size: orderQuantity,
          entryPrice: orderPrice,
          leverage,
          margin: requiredMargin,
          liquidationPrice,
        });

        // Khóa margin từ ví
        updateBalancesAfterFuturesTrade(side, quoteAsset, requiredMargin);
        
        alert(`✅ Mở vị thế ${positionSide} ${symbol} thành công!\nĐòn bẩy: ${leverage}x\nMargin: ${requiredMargin.toFixed(2)} ${quoteAsset}`);
      } else {
        // Spot trading - giữ nguyên logic cũ
        placeOrder({
          symbol,
          side,
          type,
          price: orderPrice,
          quantity: orderQuantity,
        });

        updateBalancesAfterTrade(side, baseAsset, quoteAsset, orderQuantity, orderPrice);
        alert(`✅ Đặt lệnh Spot thành công!`);
      }
      
      setPrice('');
      setQuantity('');
      setTotal('');
      setMargin('');
    } catch (error) {
      alert('❌ Đặt lệnh thất bại!');
    } finally {
      setLoading(false);
    }
  };

  const updateBalancesAfterFuturesTrade = (
    tradeSide: OrderSide,
    quote: string,
    marginUsed: number
  ) => {
    // For futures, only lock the margin
    const updatedBalances = balances.map(balance => {
      if (balance.coin === quote) {
        return {
          ...balance,
          available: balance.available - marginUsed,
          locked: balance.locked + marginUsed,
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

  const formatBalance = (value: number, coin: string) => {
    if (coin === 'USDT' || coin === 'BUSD') {
      return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return value.toFixed(8).replace(/\.?0+$/, '');
  };

  const availableBalance = side === 'buy' 
    ? getBalance(quoteAsset)?.available || 0
    : getBalance(baseAsset)?.available || 0;
  
  const balanceAsset = side === 'buy' ? quoteAsset : baseAsset;

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
            onClick={() => setType('limit')}
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
            onClick={() => setType('market')}
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

        {/* Wallet Details */}
        <details style={{ marginBottom: '1rem' }}>
          <summary style={{ 
            cursor: 'pointer', 
            fontSize: '0.85rem', 
            color: '#888',
            padding: '0.5rem',
            background: '#131722',
            borderRadius: '4px',
            userSelect: 'none'
          }}>
            Chi tiết ví
          </summary>
          <div style={{ 
            marginTop: '0.5rem', 
            padding: '0.75rem',
            background: '#131722',
            borderRadius: '4px',
            fontSize: '0.8rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ color: '#888' }}>{quoteAsset}:</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#26a69a' }}>Khả dụng: {formatBalance(getBalance(quoteAsset)?.available || 0, quoteAsset)}</div>
                <div style={{ color: '#ff9800', fontSize: '0.75rem' }}>Đóng băng: {formatBalance(getBalance(quoteAsset)?.locked || 0, quoteAsset)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#888' }}>{baseAsset}:</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: '#26a69a' }}>Khả dụng: {formatBalance(getBalance(baseAsset)?.available || 0, baseAsset)}</div>
                <div style={{ color: '#ff9800', fontSize: '0.75rem' }}>Đóng băng: {formatBalance(getBalance(baseAsset)?.locked || 0, baseAsset)}</div>
              </div>
            </div>
          </div>
        </details>

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
          </div>
        ) : (
          <div style={{ 
            marginBottom: '1rem', 
            padding: '0.75rem',
            background: '#131722',
            borderRadius: '4px',
            display: 'flex',
            justifyContent: 'space-between'
          }}>
            <span style={{ fontSize: '0.85rem', color: '#888' }}>Giá thị trường:</span>
            <span style={{ fontSize: '0.9rem', color: '#d1d4dc', fontWeight: 600 }}>
              {lastPrice > 0 ? lastPrice.toFixed(2) : '--'} {quoteAsset}
            </span>
          </div>
        )}

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
                value={margin} 
                onChange={e => handleMarginChange(e.target.value)} 
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