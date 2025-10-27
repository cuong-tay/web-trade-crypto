import React from 'react';
import { useTradingContext } from '../context/TradingContext';
import { SYMBOLS, INTERVALS } from '../constants';
import { MarketType, Symbol, Interval } from '../types';

interface IndicatorControlsProps {
  showVolume: boolean;
  setShowVolume: (show: boolean) => void;
  showEma: boolean;
  setShowEma: (show: boolean) => void;
  emaPeriod: number;
  setEmaPeriod: (period: number) => void;
  showRsi: boolean;
  setShowRsi: (show: boolean) => void;
  rsiPeriod: number;
  setRsiPeriod: (period: number) => void;
}

const Controls: React.FC<IndicatorControlsProps> = (props) => {
  const { marketType, setMarketType, symbol, setSymbol, interval, setInterval } = useTradingContext();

  const baseStyle: React.CSSProperties = {
    background: '#2a2e39',
    color: '#d1d4dc',
    border: '1px solid #444',
    padding: '0.5rem',
    borderRadius: '4px',
    cursor: 'pointer',
    marginRight: '0.5rem'
  };

  const buttonStyle: React.CSSProperties = {
    ...baseStyle,
    padding: '0.5rem 0.75rem',
  }
  
  const indicatorLabelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    cursor: 'pointer'
  }

  const numberInputStyle: React.CSSProperties = {
      ...baseStyle,
      width: '60px',
      padding: '0.4rem',
      margin: '0 0.5rem'
  }

  return (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.25rem 0' }}>
      <div>
        <select value={marketType} onChange={(e) => setMarketType(e.target.value as MarketType)} style={baseStyle}>
          <option value="spot">Spot</option>
          <option value="futures">Futures</option>
        </select>
        <select value={symbol} onChange={(e) => setSymbol(e.target.value as Symbol)} style={baseStyle}>
          {SYMBOLS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div>
        {INTERVALS.map(i => (
          <button key={i} onClick={() => setInterval(i as Interval)} style={{...buttonStyle, background: interval === i ? '#2962ff' : 'transparent', marginRight: '2px' }}>
            {i}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label htmlFor="showVolume" style={indicatorLabelStyle}>
            <input id="showVolume" type="checkbox" checked={props.showVolume} onChange={e => props.setShowVolume(e.target.checked)} />
            Volume
          </label>
          <label htmlFor="showEma" style={indicatorLabelStyle}>
            <input id="showEma" type="checkbox" checked={props.showEma} onChange={e => props.setShowEma(e.target.checked)} />
            EMA
            <input id="emaPeriod" type="number" value={props.emaPeriod} onChange={e => props.setEmaPeriod(parseInt(e.target.value, 10))} style={numberInputStyle} />
          </label>
          <label htmlFor="showRsi" style={indicatorLabelStyle}>
            <input id="showRsi" type="checkbox" checked={props.showRsi} onChange={e => props.setShowRsi(e.target.checked)} />
            RSI
            <input id="rsiPeriod" type="number" value={props.rsiPeriod} onChange={e => props.setRsiPeriod(parseInt(e.target.value, 10))} style={numberInputStyle} />
          </label>
      </div>
    </div>
  );
};

export default Controls;