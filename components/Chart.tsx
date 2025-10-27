import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useTradingContext } from '../context/TradingContext';
import { fetchInitialKlines } from '../services/binanceService';
import { Kline } from '../types';
import { SPOT_WS_URL, FUTURES_WS_URL } from '../constants';

const GREEN = '#26a69a';
const RED = '#ef5350';
const BG_COLOR = '#131722';
const TEXT_COLOR = '#d1d4dc';
const GRID_COLOR = '#2a2e39';
const CROSSHAIR_COLOR = '#888';
const EMA_COLOR = '#ffeb3b';
const RSI_COLOR = '#ab47bc';
const RIGHT_PADDING = 100;

interface ChartProps {
  indicatorData: {
    ema: (number | null)[];
    rsi: (number | null)[];
  };
  showVolume: boolean;
  showEma: boolean;
  showRsi: boolean;
  klines: Kline[];
  setKlines: React.Dispatch<React.SetStateAction<Kline[]>>;
}

const Chart: React.FC<ChartProps> = ({ indicatorData, showVolume, showEma, showRsi, klines, setKlines }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const { marketType, symbol, interval, lastPrice, setLastPrice } = useTradingContext();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [barsPerScreen, setBarsPerScreen] = useState(120);
    const [rightIndex, setRightIndex] = useState(0);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, rightIndex: 0 });
    const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
    const isAtLatest = rightIndex === 0;

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.scale(dpr, dpr);
        ctx.fillStyle = BG_COLOR;
        ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

        if (klines.length === 0) return;

        const chartWidth = canvas.clientWidth - RIGHT_PADDING;
        const chartHeight = canvas.clientHeight;
        
        // Define Panel Layout
        const panels = [];
        if (showRsi) panels.push({ key: 'rsi', weight: 1 });
        if (showVolume) panels.push({ key: 'volume', weight: 1 });
        const pricePanelWeight = Math.max(2, 5 - panels.length);
        panels.unshift({ key: 'price', weight: pricePanelWeight });
        
        const totalWeight = panels.reduce((sum, p) => sum + p.weight, 0);
        let currentY = 0;
        const panelLayouts: { [key: string]: { y: number, height: number } } = {};
        panels.forEach(p => {
            const panelHeight = (p.weight / totalWeight) * chartHeight;
            panelLayouts[p.key] = { y: currentY, height: panelHeight * 0.95 };
            currentY += panelHeight;
        });

        const lastVisibleIndex = klines.length - 1 - rightIndex;
        const firstVisibleIndex = Math.max(0, lastVisibleIndex - barsPerScreen + 1);
        const visibleKlines = klines.slice(firstVisibleIndex, lastVisibleIndex + 1);
        if (visibleKlines.length === 0) return;

        // Common calculations
        const barWidth = chartWidth / barsPerScreen;
        const getX = (index: number) => chartWidth - ((visibleKlines.length - 1 - index) * barWidth) - barWidth / 2;
        
        // Price Panel
        const pricePanel = panelLayouts.price;
        if (pricePanel) {
            const minPrice = Math.min(...visibleKlines.map(k => k.l));
            const maxPrice = Math.max(...visibleKlines.map(k => k.h));
            const priceRange = maxPrice - minPrice;
            const priceToY = (price: number) => pricePanel.y + pricePanel.height - ((price - minPrice) / priceRange) * pricePanel.height * 0.9 - pricePanel.height * 0.05;

            // Draw Price Grid and Axis
            const gridCount = 5;
            for (let i = 0; i <= gridCount; i++) {
                const y = pricePanel.y + (pricePanel.height / gridCount) * i;
                const price = maxPrice - (priceRange / gridCount) * i;
                ctx.strokeStyle = GRID_COLOR;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(canvas.clientWidth, y);
                ctx.stroke();
                ctx.fillStyle = TEXT_COLOR;
                ctx.font = '12px sans-serif';
                ctx.fillText(price.toFixed(2), chartWidth + 5, y + 4);
            }

            // Draw Candles
            visibleKlines.forEach((k, i) => {
                const x = getX(i);
                const color = k.c >= k.o ? GREEN : RED;
                ctx.strokeStyle = color;
                ctx.fillStyle = color;
                // Wick
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(x, priceToY(k.h)); ctx.lineTo(x, priceToY(k.l)); ctx.stroke();
                // Body
                ctx.lineWidth = barWidth * 0.7;
                ctx.beginPath(); ctx.moveTo(x, priceToY(k.o)); ctx.lineTo(x, priceToY(k.c)); ctx.stroke();
            });

            // Draw EMA
            if (showEma && indicatorData.ema) {
                const visibleEma = indicatorData.ema.slice(firstVisibleIndex, lastVisibleIndex + 1);
                ctx.strokeStyle = EMA_COLOR;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                let firstPoint = true;
                visibleEma.forEach((val, i) => {
                    if (val !== null) {
                        const x = getX(i);
                        const y = priceToY(val);
                        if (firstPoint) {
                            ctx.moveTo(x, y);
                            firstPoint = false;
                        } else {
                            ctx.lineTo(x, y);
                        }
                    }
                });
                ctx.stroke();
            }
        }
        
        // Volume Panel
        const volumePanel = panelLayouts.volume;
        if (showVolume && volumePanel) {
            const maxVolume = Math.max(...visibleKlines.map(k => k.v));
            const volumeToY = (vol: number) => volumePanel.y + volumePanel.height - (vol / maxVolume) * volumePanel.height;
            visibleKlines.forEach((k, i) => {
                const x = getX(i);
                const color = k.c >= k.o ? GREEN : RED;
                ctx.fillStyle = color;
                const y = volumeToY(k.v);
                ctx.fillRect(x - barWidth*0.35, y, barWidth * 0.7, volumePanel.y + volumePanel.height - y);
            });
        }
        
        // RSI Panel
        const rsiPanel = panelLayouts.rsi;
        if (showRsi && rsiPanel && indicatorData.rsi) {
            const rsiToY = (val: number) => rsiPanel.y + rsiPanel.height - (val / 100) * rsiPanel.height;
            // Draw RSI levels
            [30, 70].forEach(level => {
                const y = rsiToY(level);
                ctx.strokeStyle = GRID_COLOR;
                ctx.lineWidth = 1;
                ctx.setLineDash([3, 3]);
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(chartWidth, y); ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = TEXT_COLOR;
                ctx.fillText(level.toString(), chartWidth + 5, y);
            });
            // Draw RSI line
            const visibleRsi = indicatorData.rsi.slice(firstVisibleIndex, lastVisibleIndex + 1);
            ctx.strokeStyle = RSI_COLOR;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            let firstPoint = true;
            visibleRsi.forEach((val, i) => {
                if (val !== null) {
                    if (firstPoint) {
                        ctx.moveTo(getX(i), rsiToY(val));
                        firstPoint = false;
                    } else {
                        ctx.lineTo(getX(i), rsiToY(val));
                    }
                }
            });
            ctx.stroke();
        }

        // Draw Last Price Line
        if (lastPrice > 0 && pricePanel) {
             const minPrice = Math.min(...visibleKlines.map(k => k.l));
             const maxPrice = Math.max(...visibleKlines.map(k => k.h));
             if(lastPrice >= minPrice && lastPrice <= maxPrice) {
                const priceRange = maxPrice - minPrice;
                const y = pricePanel.y + pricePanel.height - ((lastPrice - minPrice) / priceRange) * pricePanel.height * 0.9 - pricePanel.height * 0.05;
                ctx.setLineDash([5, 5]);
                ctx.strokeStyle = visibleKlines[visibleKlines.length-1].c >= visibleKlines[visibleKlines.length-1].o ? GREEN : RED;
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(chartWidth, y); ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = ctx.strokeStyle;
                ctx.fillRect(chartWidth, y - 10, RIGHT_PADDING, 20);
                ctx.fillStyle = '#fff';
                ctx.fillText(lastPrice.toFixed(2), chartWidth + 5, y + 4);
             }
        }

        // Draw Crosshair and Tooltip
        if (mousePos) {
            let klineIndexOnScreen = Math.floor(mousePos.x / barWidth);
            // Clamp the index to the last visible candle if hovering in the right padding area
            klineIndexOnScreen = Math.max(0, Math.min(visibleKlines.length - 1, klineIndexOnScreen));

            const klineIndex = firstVisibleIndex + klineIndexOnScreen;
            const kline = klines[klineIndex];
            
            if (kline) {
                const crosshairX = getX(klineIndexOnScreen);

                // Vertical line (snapped to candle center)
                ctx.strokeStyle = CROSSHAIR_COLOR;
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(crosshairX, 0); ctx.lineTo(crosshairX, chartHeight); ctx.stroke();

                // Horizontal line (follows mouse y-pos)
                ctx.beginPath(); ctx.moveTo(0, mousePos.y); ctx.lineTo(chartWidth, mousePos.y); ctx.stroke();

                // Tooltip
                const tooltipX = crosshairX > chartWidth / 2 ? 10 : chartWidth - 210;
                ctx.fillStyle = 'rgba(30, 34, 45, 0.9)';
                ctx.fillRect(tooltipX, 10, 200, 140);
                ctx.fillStyle = TEXT_COLOR;
                ctx.font = '12px sans-serif';
                let tooltipY = 30;
                const write = (text: string) => {
                    ctx.fillText(text, tooltipX + 10, tooltipY);
                    tooltipY += 20;
                };

                write(`Time: ${new Date(kline.t).toLocaleString()}`);
                write(`O: ${kline.o.toFixed(2)} H: ${kline.h.toFixed(2)}`);
                write(`L: ${kline.l.toFixed(2)} C: ${kline.c.toFixed(2)}`);
                if(showVolume) write(`Vol: ${kline.v.toLocaleString(undefined, {notation: 'compact'})}`);
                if(showEma && indicatorData.ema[klineIndex] != null) write(`EMA: ${indicatorData.ema[klineIndex]?.toFixed(2)}`);
                if(showRsi && indicatorData.rsi[klineIndex] != null) write(`RSI: ${indicatorData.rsi[klineIndex]?.toFixed(2)}`);
            }
        }
    }, [klines, barsPerScreen, rightIndex, mousePos, indicatorData, showVolume, showEma, showRsi, lastPrice]);

    useEffect(() => {
        draw();
    }, [draw]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const resizeObserver = new ResizeObserver(() => requestAnimationFrame(draw));
        resizeObserver.observe(canvas);
        return () => resizeObserver.disconnect();
    }, [draw]);

    useEffect(() => {
        setLoading(true);
        setError(null);
        setKlines([]);

        fetchInitialKlines(marketType, symbol, interval)
            .then(initialKlines => {
                setKlines(initialKlines);
                setRightIndex(0);
                if (initialKlines.length > 0) {
                    setLastPrice(initialKlines[initialKlines.length - 1].c);
                }
            })
            .catch(err => {
                console.error(err);
                setError('Failed to fetch historical data.');
            })
            .finally(() => setLoading(false));

        const wsUrl = marketType === 'spot' ? SPOT_WS_URL : FUTURES_WS_URL;
        const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
        const ws = new WebSocket(`${wsUrl}/${streamName}`);

        ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.e === 'kline') {
                const klineData = message.k;
                const newKline: Kline = {
                    t: klineData.t, o: parseFloat(klineData.o), h: parseFloat(klineData.h),
                    l: parseFloat(klineData.l), c: parseFloat(klineData.c), v: parseFloat(klineData.v),
                };
                setLastPrice(newKline.c);
                setKlines(prev => {
                    if (prev.length === 0) return [newKline];
                    const lastKline = prev[prev.length - 1];
                    if (newKline.t === lastKline.t) {
                        return [...prev.slice(0, -1), newKline];
                    } else {
                        if(isAtLatest) setRightIndex(0);
                        return [...prev, newKline];
                    }
                });
            }
        };
        ws.onerror = () => setError("WebSocket connection error.");
        return () => ws.close();
    }, [marketType, symbol, interval, setLastPrice, setKlines, isAtLatest]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            const zoomFactor = e.deltaY < 0 ? 0.9 : 1.1;
            setBarsPerScreen(prev => Math.max(20, Math.min(500, Math.round(prev * zoomFactor))));
        };
        const handleMouseDown = (e: MouseEvent) => {
            setIsPanning(true);
            setPanStart({ x: e.clientX, rightIndex });
        };
        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            if (isPanning) {
                const dx = e.clientX - panStart.x;
                const barWidth = (canvas.clientWidth - RIGHT_PADDING) / barsPerScreen;
                const dIndex = Math.round(dx / barWidth);
                setRightIndex(Math.max(0, Math.min(klines.length - barsPerScreen, panStart.rightIndex - dIndex)));
            }
        };
        const handleMouseUp = () => setIsPanning(false);
        const handleMouseLeave = () => { setMousePos(null); setIsPanning(false); };

        canvas.addEventListener('wheel', handleWheel);
        canvas.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            canvas.removeEventListener('wheel', handleWheel);
            canvas.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            canvas.removeEventListener('mouseleave', handleMouseLeave);
        };
    }, [isPanning, panStart, barsPerScreen, klines.length, rightIndex]);

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            {loading && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>}
            {error && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: RED }}>{error}</div>}
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
        </div>
    );
};

export default Chart;