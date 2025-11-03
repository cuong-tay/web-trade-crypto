
import React, { useState } from 'react';
import { useTradingContext } from '../../context/TradingContext';
import { Position } from '../../types';

const TradesPanel: React.FC = () => {
  const { trades, marketType, lastPrice, symbol, positions, closePosition: contextClosePosition, updatePositionTPSL } = useTradingContext();
  const [activeTab, setActiveTab] = useState<'trades' | 'positions'>('positions');
  const [editingPosition, setEditingPosition] = useState<string | null>(null);
  const [tpValue, setTpValue] = useState<string>('');
  const [slValue, setSlValue] = useState<string>('');
  
  const isFutures = marketType === 'futures';
  
  const panelStyle: React.CSSProperties = {
    background: '#1e222d',
    padding: '1rem',
    borderRadius: '4px',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden'
  };

  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    flex: 1,
    padding: '0.5rem',
    background: isActive ? '#363c4f' : 'transparent',
    border: 'none',
    borderBottom: isActive ? '2px solid #26a69a' : '2px solid transparent',
    color: isActive ? '#d1d4dc' : '#888',
    cursor: 'pointer',
    fontSize: '0.9rem',
    fontWeight: isActive ? 600 : 400,
    transition: 'all 0.3s'
  });

  const closePosition = (positionId: string) => {
    if (confirm('Bạn có chắc muốn đóng vị thế này?')) {
      const position = positions.find(p => p.id === positionId);
      
      if (position) {
        // Tính PnL
        const currentPrice = position.symbol === symbol && lastPrice 
          ? lastPrice 
          : position.markPrice;
        const priceDiff = position.side === 'LONG' 
          ? currentPrice - position.entryPrice 
          : position.entryPrice - currentPrice;
        const realizedPnL = priceDiff * position.size * position.leverage;
        
        // Hoàn trả margin + PnL về ví
        const returnAmount = position.margin + realizedPnL;
        
        console.log('Close Position Details:', {
          symbol: position.symbol,
          side: position.side,
          entryPrice: position.entryPrice,
          currentPrice,
          priceDiff,
          size: position.size,
          leverage: position.leverage,
          margin: position.margin,
          realizedPnL,
          returnAmount
        });
        
        // Cập nhật ví (cần lấy từ localStorage)
        const savedWallet = localStorage.getItem('walletData');
        if (savedWallet) {
          const walletData = JSON.parse(savedWallet);
          const quoteAsset = position.symbol.includes('USDT') ? 'USDT' : 'BUSD';
          
          console.log('Wallet before close:', walletData);
          
          const updatedWallet = walletData.map((asset: any) => {
            if (asset.coin === quoteAsset) {
              const newAvailable = (asset.available || 0) + returnAmount;
              const newLocked = Math.max((asset.locked || 0) - position.margin, 0);
              const newTotal = (asset.total || 0) + realizedPnL;
              
              console.log(`Update ${quoteAsset}:`, {
                oldAvailable: asset.available,
                addReturn: returnAmount,
                newAvailable,
                oldLocked: asset.locked,
                removeMargin: position.margin,
                newLocked,
                oldTotal: asset.total,
                addPnL: realizedPnL,
                newTotal
              });
              
              return {
                coin: asset.coin,
                available: newAvailable,
                locked: newLocked,
                total: newTotal,
                usdValue: asset.usdValue || 0
              };
            }
            return asset;
          });
          
          console.log('Wallet after close:', updatedWallet);
          localStorage.setItem('walletData', JSON.stringify(updatedWallet));
          
          // Trigger window event để các component khác cập nhật
          window.dispatchEvent(new Event('walletUpdated'));
        }
        
        contextClosePosition(positionId);
        
        alert(`✅ Đã đóng vị thế thành công!\nPnL: ${realizedPnL >= 0 ? '+' : ''}${realizedPnL.toFixed(2)} USDT\nHoàn trả: ${returnAmount.toFixed(2)} USDT`);
      }
    }
  };

  const setTPSL = (positionId: string) => {
    const tp = parseFloat(tpValue);
    const sl = parseFloat(slValue);
    
    updatePositionTPSL(
      positionId,
      tp > 0 ? tp : undefined,
      sl > 0 ? sl : undefined
    );
    
    setEditingPosition(null);
    setTpValue('');
    setSlValue('');
    alert('Đã cập nhật TP/SL thành công!');
  };

  const openTPSLModal = (position: Position) => {
    setEditingPosition(position.id);
    setTpValue(position.takeProfit?.toString() || '');
    setSlValue(position.stopLoss?.toString() || '');
  };

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', marginBottom: '1rem', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, flex: 1 }}>
          {isFutures ? (activeTab === 'positions' ? 'Vị thế' : 'Lệnh gần đây') : 'Recent Trades'}
        </h3>
      </div>

      {/* Tabs - Only show for Futures */}
      {isFutures && (
        <div style={{ display: 'flex', marginBottom: '1rem', borderBottom: '1px solid #2a2e39' }}>
          <button 
            style={tabStyle(activeTab === 'trades')}
            onClick={() => setActiveTab('trades')}
          >
            Lệnh gần đây
          </button>
          <button 
            style={tabStyle(activeTab === 'positions')}
            onClick={() => setActiveTab('positions')}
          >
            Vị thế ({positions.length})
          </button>
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, overflowX: 'hidden' }}>
        {(!isFutures || activeTab === 'trades') ? (
          // Trades Table
          <table style={{width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem'}}>
            <thead>
              <tr style={{textAlign: 'left', color: '#888', borderBottom: '1px solid #2a2e39'}}>
                <th style={{padding: '0.5rem', fontWeight: 500}}>Thời gian</th>
                <th style={{padding: '0.5rem', fontWeight: 500}}>Phía</th>
                <th style={{padding: '0.5rem', textAlign: 'right', fontWeight: 500}}>Giá</th>
                <th style={{padding: '0.5rem', textAlign: 'right', fontWeight: 500}}>Số lượng</th>
              </tr>
            </thead>
            <tbody>
              {trades.slice(0, 50).map(trade => (
                <tr key={trade.id} style={{borderBottom: '1px solid #2a2e39'}}>
                  <td style={{padding: '0.5rem', color: '#888'}}>
                    {new Date(trade.timestamp).toLocaleTimeString()}
                  </td>
                  <td style={{ 
                    color: trade.side === 'buy' ? '#26a69a' : '#ef5350', 
                    padding: '0.5rem',
                    fontWeight: 600
                  }}>
                    {trade.side.toUpperCase()}
                  </td>
                  <td style={{textAlign: 'right', padding: '0.5rem', color: '#d1d4dc'}}>
                    {trade.price.toFixed(2)}
                  </td>
                  <td style={{textAlign: 'right', padding: '0.5rem', color: '#d1d4dc'}}>
                    {trade.quantity.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          // Positions List (Futures only)
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '0.75rem',
            paddingRight: '0.25rem' // Space for scrollbar
          }}>
            {positions.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '2rem', 
                color: '#888',
                fontSize: '0.9rem'
              }}>
                Không có vị thế nào đang mở
              </div>
            ) : (
              positions.map(position => {
                // Tính PnL động dựa trên giá hiện tại từ biểu đồ
                // Chỉ dùng lastPrice nếu position symbol trùng với symbol đang xem
                const currentPrice = position.symbol === symbol && lastPrice 
                  ? lastPrice 
                  : position.markPrice;
                const priceDiff = position.side === 'LONG' 
                  ? currentPrice - position.entryPrice 
                  : position.entryPrice - currentPrice;
                const unrealizedPnL = priceDiff * position.size * position.leverage;
                const pnlPercent = (unrealizedPnL / position.margin) * 100;

                return (
                <div 
                  key={position.id}
                  style={{
                    background: '#1e222d',
                    borderRadius: '8px',
                    padding: '0.875rem',
                    border: `1px solid ${position.side === 'LONG' ? 'rgba(38, 166, 154, 0.3)' : 'rgba(239, 83, 80, 0.3)'}`,
                    borderLeft: `3px solid ${position.side === 'LONG' ? '#26a69a' : '#ef5350'}`,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    marginBottom: '0.5rem',
                    alignItems: 'center'
                  }}>
                    <div>
                      <span style={{ 
                        fontWeight: 600, 
                        fontSize: '0.95rem',
                        color: '#d1d4dc'
                      }}>
                        {position.symbol}
                      </span>
                      <span style={{ 
                        marginLeft: '0.5rem',
                        padding: '0.2rem 0.5rem',
                        background: position.side === 'LONG' ? 'rgba(38, 166, 154, 0.2)' : 'rgba(239, 83, 80, 0.2)',
                        color: position.side === 'LONG' ? '#26a69a' : '#ef5350',
                        borderRadius: '3px',
                        fontSize: '0.75rem',
                        fontWeight: 600
                      }}>
                        {position.side} {position.leverage}x
                      </span>
                    </div>
                    <button
                      onClick={() => closePosition(position.id)}
                      style={{
                        padding: '0.3rem 0.75rem',
                        background: 'transparent',
                        border: '1px solid #ef5350',
                        color: '#ef5350',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#ef5350';
                        e.currentTarget.style.color = 'white';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = '#ef5350';
                      }}
                    >
                      Đóng
                    </button>
                  </div>

                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.5rem',
                    fontSize: '0.8rem'
                  }}>
                    <div>
                      <div style={{ color: '#888', marginBottom: '0.25rem' }}>Số lượng</div>
                      <div style={{ color: '#d1d4dc', fontWeight: 500 }}>{position.size}</div>
                    </div>
                    <div>
                      <div style={{ color: '#888', marginBottom: '0.25rem' }}>Giá vào</div>
                      <div style={{ color: '#d1d4dc', fontWeight: 500 }}>${position.entryPrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ color: '#888', marginBottom: '0.25rem' }}>Giá hiện tại</div>
                      <div style={{ color: '#d1d4dc', fontWeight: 500 }}>${currentPrice.toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ color: '#888', marginBottom: '0.25rem' }}>Margin</div>
                      <div style={{ color: '#d1d4dc', fontWeight: 500 }}>${position.margin.toFixed(2)}</div>
                    </div>
                    <div>
                      <div style={{ color: '#888', marginBottom: '0.25rem' }}>PnL chưa thực hiện</div>
                      <div style={{ 
                        color: unrealizedPnL >= 0 ? '#26a69a' : '#ef5350',
                        fontWeight: 600,
                        fontSize: '0.9rem'
                      }}>
                        {unrealizedPnL >= 0 ? '+' : ''}{unrealizedPnL.toFixed(2)} USDT
                        <span style={{ fontSize: '0.75rem', marginLeft: '0.25rem' }}>
                          ({pnlPercent.toFixed(2)}%)
                        </span>
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#888', marginBottom: '0.25rem' }}>Giá thanh lý</div>
                      <div style={{ color: '#ef5350', fontWeight: 500 }}>${position.liquidationPrice.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* TP/SL Section */}
                  <div style={{ 
                    marginTop: '0.75rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid #2a2e39'
                  }}>
                    {/* Action Buttons - Always visible */}
                    <div style={{ 
                      display: 'grid', 
                      gridTemplateColumns: 'repeat(4, 1fr)', 
                      gap: '0.5rem',
                      marginBottom: editingPosition === position.id ? '0.75rem' : 0
                    }}>
                      <button
                        style={{
                          padding: '0.5rem 0.25rem',
                          background: '#2a2e39',
                          border: '1px solid #363c4f',
                          borderRadius: '4px',
                          color: '#d1d4dc',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#363c4f';
                          e.currentTarget.style.borderColor = '#26a69a';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#2a2e39';
                          e.currentTarget.style.borderColor = '#363c4f';
                        }}
                      >
                        Đòn bẩy
                      </button>
                      <button
                        onClick={() => openTPSLModal(position)}
                        style={{
                          padding: '0.5rem 0.25rem',
                          background: editingPosition === position.id ? '#363c4f' : '#2a2e39',
                          border: `1px solid ${editingPosition === position.id ? '#26a69a' : '#363c4f'}`,
                          borderRadius: '4px',
                          color: editingPosition === position.id ? '#26a69a' : '#d1d4dc',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          if (editingPosition !== position.id) {
                            e.currentTarget.style.background = '#363c4f';
                            e.currentTarget.style.borderColor = '#26a69a';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (editingPosition !== position.id) {
                            e.currentTarget.style.background = '#2a2e39';
                            e.currentTarget.style.borderColor = '#363c4f';
                          }
                        }}
                      >
                        TP/SL
                      </button>
                      <button
                        onClick={() => closePosition(position.id)}
                        style={{
                          padding: '0.5rem 0.25rem',
                          background: '#2a2e39',
                          border: '1px solid #363c4f',
                          borderRadius: '4px',
                          color: '#d1d4dc',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 83, 80, 0.2)';
                          e.currentTarget.style.borderColor = '#ef5350';
                          e.currentTarget.style.color = '#ef5350';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#2a2e39';
                          e.currentTarget.style.borderColor = '#363c4f';
                          e.currentTarget.style.color = '#d1d4dc';
                        }}
                      >
                        Đóng
                      </button>
                      <button
                        style={{
                          padding: '0.5rem 0.25rem',
                          background: '#2a2e39',
                          border: '1px solid #363c4f',
                          borderRadius: '4px',
                          color: '#d1d4dc',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#363c4f';
                          e.currentTarget.style.borderColor = '#26a69a';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#2a2e39';
                          e.currentTarget.style.borderColor = '#363c4f';
                        }}
                      >
                        Đảo ngược
                      </button>
                    </div>

                    {editingPosition === position.id && (
                      // TP/SL Edit Form
                      <div style={{ fontSize: '0.8rem' }}>
                        <div style={{ marginBottom: '0.5rem', color: '#888', fontWeight: 600 }}>
                          Cài đặt TP/SL
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.25rem', color: '#888', fontSize: '0.75rem' }}>
                              Take Profit
                            </label>
                            <input
                              type="number"
                              placeholder="Giá TP"
                              value={tpValue}
                              onChange={(e) => setTpValue(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '0.4rem',
                                background: '#1e222d',
                                border: '1px solid #2a2e39',
                                borderRadius: '4px',
                                color: '#26a69a',
                                fontSize: '0.8rem'
                              }}
                              step="0.01"
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.25rem', color: '#888', fontSize: '0.75rem' }}>
                              Stop Loss
                            </label>
                            <input
                              type="number"
                              placeholder="Giá SL"
                              value={slValue}
                              onChange={(e) => setSlValue(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '0.4rem',
                                background: '#1e222d',
                                border: '1px solid #2a2e39',
                                borderRadius: '4px',
                                color: '#ef5350',
                                fontSize: '0.8rem'
                              }}
                              step="0.01"
                            />
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => setTPSL(position.id)}
                            style={{
                              flex: 1,
                              padding: '0.4rem',
                              background: '#26a69a',
                              border: 'none',
                              borderRadius: '4px',
                              color: 'white',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Xác nhận
                          </button>
                          <button
                            onClick={() => {
                              setEditingPosition(null);
                              setTpValue('');
                              setSlValue('');
                            }}
                            style={{
                              flex: 1,
                              padding: '0.4rem',
                              background: '#2a2e39',
                              border: 'none',
                              borderRadius: '4px',
                              color: '#888',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: 'pointer'
                            }}
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ 
                    marginTop: '0.5rem',
                    paddingTop: '0.5rem',
                    borderTop: '1px solid #2a2e39',
                    fontSize: '0.75rem',
                    color: '#888'
                  }}>
                    Mở lúc: {new Date(position.timestamp).toLocaleString()}
                  </div>
                </div>
              );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TradesPanel;
