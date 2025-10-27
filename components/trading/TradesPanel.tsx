
import React from 'react';
import { useTradingContext } from '../../context/TradingContext';

const TradesPanel: React.FC = () => {
  const { trades } = useTradingContext();
  
  const panelStyle: React.CSSProperties = {
    background: '#1e222d',
    padding: '1rem',
    borderRadius: '4px',
    flex: 1,
    display: 'flex',
    flexDirection: 'column'
  }

  return (
    <div style={panelStyle}>
      <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Recent Trades</h3>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <table style={{width: '100%', borderCollapse: 'collapse'}}>
          <thead>
            <tr style={{textAlign: 'left'}}>
              <th style={{padding: '0.25rem'}}>Time</th>
              <th style={{padding: '0.25rem'}}>Side</th>
              <th style={{padding: '0.25rem', textAlign: 'right'}}>Price</th>
              <th style={{padding: '0.25rem', textAlign: 'right'}}>Qty</th>
            </tr>
          </thead>
          <tbody>
            {trades.slice(0, 50).map(trade => (
              <tr key={trade.id}>
                <td style={{padding: '0.25rem'}}>{new Date(trade.timestamp).toLocaleTimeString()}</td>
                <td style={{ color: trade.side === 'buy' ? '#26a69a' : '#ef5350', padding: '0.25rem' }}>{trade.side.toUpperCase()}</td>
                <td style={{textAlign: 'right', padding: '0.25rem'}}>{trade.price.toFixed(2)}</td>
                <td style={{textAlign: 'right', padding: '0.25rem'}}>{trade.quantity.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TradesPanel;
