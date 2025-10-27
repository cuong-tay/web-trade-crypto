import React, { useState } from 'react';
import { useTradingContext } from '../../context/TradingContext';
import { OrderSide, OrderType } from '../../types';

const OrderPanel: React.FC = () => {
  const { symbol, placeOrder, lastPrice } = useTradingContext();
  const [side, setSide] = useState<OrderSide>('buy');
  const [type, setType] = useState<OrderType>('market');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const orderPrice = type === 'market' ? lastPrice : parseFloat(price);
    const orderQuantity = parseFloat(quantity);
    if (!isNaN(orderPrice) && orderPrice > 0 && !isNaN(orderQuantity) && orderQuantity > 0) {
      placeOrder({
        symbol,
        side,
        type,
        price: orderPrice,
        quantity: orderQuantity,
      });
      setPrice('');
      setQuantity('');
    }
  };

  const panelStyle: React.CSSProperties = {
    background: '#1e222d',
    padding: '1rem',
    borderRadius: '4px',
  }

  const inputStyle: React.CSSProperties = {
     width: '100%',
     background: '#131722',
     color: '#d1d4dc',
     border: '1px solid #444',
     padding: '0.5rem',
     borderRadius: '4px',
     boxSizing: 'border-box',
     marginBottom: '1rem'
  }
  
  const hiddenLabelStyle: React.CSSProperties = {
    border: 0,
    clip: 'rect(0 0 0 0)',
    height: '1px',
    margin: '-1px',
    overflow: 'hidden',
    padding: 0,
    position: 'absolute',
    width: '1px',
  };

  return (
    <div style={panelStyle}>
      <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Place Order</h3>
      <div style={{ display: 'flex', marginBottom: '1rem', borderRadius: '4px', overflow: 'hidden' }}>
        <button onClick={() => setSide('buy')} style={{ flex: 1, padding: '0.5rem', background: side === 'buy' ? '#26a69a' : '#2a2e39', border: 'none', color: 'white', cursor: 'pointer' }}>Buy</button>
        <button onClick={() => setSide('sell')} style={{ flex: 1, padding: '0.5rem', background: side === 'sell' ? '#ef5350' : '#2a2e39', border: 'none', color: 'white', cursor: 'pointer' }}>Sell</button>
      </div>
      <form onSubmit={handleSubmit}>
        <label htmlFor="orderType" style={hiddenLabelStyle}>Order Type</label>
        <select id="orderType" value={type} onChange={e => setType(e.target.value as OrderType)} style={inputStyle}>
            <option value="market">Market</option>
            <option value="limit">Limit</option>
        </select>
        {type === 'limit' && (
          <>
            <label htmlFor="orderPrice" style={hiddenLabelStyle}>Price</label>
            <input id="orderPrice" type="number" placeholder="Price" value={price} onChange={e => setPrice(e.target.value)} style={inputStyle} required />
          </>
        )}
        <label htmlFor="orderQuantity" style={hiddenLabelStyle}>Quantity</label>
        <input id="orderQuantity" type="number" placeholder="Quantity" value={quantity} onChange={e => setQuantity(e.target.value)} style={inputStyle} required />
        <div style={{marginBottom: '1rem', fontSize: '0.8rem', color: '#888'}}>
            Last Price: {lastPrice > 0 ? lastPrice.toFixed(2) : '...'}
        </div>
        <button type="submit" style={{ width: '100%', padding: '0.75rem', background: side === 'buy' ? '#26a69a' : '#ef5350', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1rem', borderRadius: '4px' }}>
          {side === 'buy' ? 'Buy' : 'Sell'} {symbol}
        </button>
      </form>
    </div>
  );
};

export default OrderPanel;