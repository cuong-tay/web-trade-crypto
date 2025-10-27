
import React from 'react';
import { Symbol } from '../../types';

interface CryptoIconProps {
  symbol: Symbol;
  size?: number;
}

const CryptoIcon: React.FC<CryptoIconProps> = ({ symbol, size = 24 }) => {
  // In a real app, you'd use image URLs. Here we use text placeholders.
  const getSymbolBase = (s: Symbol) => {
      if (s.endsWith('USDT')) return s.replace('USDT', '');
      return s;
  }
  
  const base = getSymbolBase(symbol);

  const style: React.CSSProperties = {
      width: size,
      height: size,
      borderRadius: '50%',
      background: '#333',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 'bold',
      fontSize: size * 0.4,
      textTransform: 'uppercase'
  }

  return (
    <div style={style}>
        {base.slice(0, 3)}
    </div>
  );
};

export default CryptoIcon;
