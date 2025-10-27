import React, { useState, useMemo } from 'react';
import Chart from '../components/Chart';
import Controls from '../components/Controls';
import OrderPanel from '../components/trading/OrderPanel';
import TradesPanel from '../components/trading/TradesPanel';
import { calculateEMA, calculateRSI } from '../utils/indicators';
import { Kline } from '../types';

interface IndicatorData {
  ema: (number | null)[];
  rsi: (number | null)[];
}

export const TradingModule: React.FC = () => {
  // Indicator State
  const [showVolume, setShowVolume] = useState(true);
  const [showEma, setShowEma] = useState(true);
  const [emaPeriod, setEmaPeriod] = useState(20);
  const [showRsi, setShowRsi] = useState(true);
  const [rsiPeriod, setRsiPeriod] = useState(14);

  // Klines State
  const [klines, setKlines] = useState<Kline[]>([]);

  const indicatorData = useMemo<IndicatorData>(() => {
    const closePrices = klines.map(k => k.c);
    if (closePrices.length === 0) {
      return { ema: [], rsi: [] };
    }
    return {
      ema: showEma ? calculateEMA(closePrices, emaPeriod) : [],
      rsi: showRsi ? calculateRSI(closePrices, rsiPeriod) : [],
    };
  }, [klines, showEma, emaPeriod, showRsi, rsiPeriod]);

  const indicatorSettings = {
    showVolume, setShowVolume,
    showEma, setShowEma,
    emaPeriod, setEmaPeriod,
    showRsi, setShowRsi,
    rsiPeriod, setRsiPeriod
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#131722', color: '#d1d4dc', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 3, display: 'flex', flexDirection: 'column', padding: '0.5rem', gap: '0.5rem' }}>
          <Controls {...indicatorSettings} />
          <div style={{ flex: 1, minHeight: 0 }}>
            <Chart 
              indicatorData={indicatorData}
              showVolume={showVolume}
              showEma={showEma}
              showRsi={showRsi}
              klines={klines}
              setKlines={setKlines}
            />
          </div>
        </div>
        <div style={{ flex: 1, borderLeft: '1px solid #2a2e39', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>
          <OrderPanel />
          <TradesPanel />
        </div>
      </div>
    </div>
  );
};

export default TradingModule;
