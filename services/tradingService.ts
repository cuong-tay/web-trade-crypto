/**
 * Trading Service - Spot Trading APIs
 * Xử lý tất cả các trading operations
 */

import { API_BASE_URL } from '../config/api';
import { checkAndHandleBannedError } from '../utils/bannedUserHandler';

console.log('📡 TradingService loaded with API_BASE_URL:', API_BASE_URL);

// ============= Fee Calculation Utilities =============

/**
 * Calculate spot trading fee (0.1%) rounded to 8 decimals
 */
export function calculateSpotTradingFee(quantity: number, price: number): number {
  const total = quantity * price;
  const fee = total * 0.001;  // 0.1%
  return Math.round(fee * 100000000) / 100000000;
}

/**
 * Calculate futures opening fee (0.02%) rounded to 8 decimals
 */
export function calculateFuturesOpeningFee(quantity: number, entryPrice: number): number {
  const positionValue = quantity * entryPrice;
  const fee = positionValue * 0.0002;  // 0.02%
  return Math.round(fee * 100000000) / 100000000;
}

/**
 * Calculate futures closing fee (0.02%) rounded to 8 decimals
 */
export function calculateFuturesClosingFee(quantity: number, exitPrice: number): number {
  const positionValue = quantity * exitPrice;
  const fee = positionValue * 0.0002;  // 0.02%
  return Math.round(fee * 100000000) / 100000000;
}

// ============= Interfaces =============

export interface CreateOrderRequest {
  symbol: string;        // "BTCUSDT", "ETHUSDT", etc.
  side: 'BUY' | 'SELL';
  order_type: 'limit' | 'market';
  quantity: number;
  price?: number;        // Required if order_type = 'limit'
  timestamp?: number;    // Chart WebSocket time (UTC ms) - for server-side logging
  fee?: number;          // Trading fee calculated by frontend (0.1% = 0.001)
}

export interface WalletUpdate {
  balance: number;  // Total = Available (không có locked)
}

export interface WalletUpdates {
  [coin: string]: WalletUpdate;  // Multiple coins (USDT, BTC, ETH, etc.)
}

export interface TransactionLog {
  type: string;        // "unlock", "fill_buy", "fill_sell", etc.
  currency: string;    // "USDT", "BTC", etc.
  amount: string;      // Amount changed
  fee?: string;        // Commission/fee if any
  balance_after: string; // Balance after transaction
}

export interface FillTradeResponse {
  message: string;
  trade_id: string;
  order_id: string;
  status: 'partial' | 'filled';
  quantity: number;
  price: number;
  commission: number;
  wallet_updates: WalletUpdates;    // Multiple coins
  transaction_logs: TransactionLog[];
}

export interface Order {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  order_type: 'limit' | 'market' | 'LIMIT' | 'MARKET';
  quantity: number;
  price: number;
  status: 'pending' | 'filled' | 'cancelled';
  created_at: string;
  filled_quantity?: number;
  filled_at?: string;
  fee?: number;
  wallet_update?: WalletUpdate; // ← Backend trả về wallet update (single coin - deprecated)
  wallet_updates?: WalletUpdates; // ← Backend trả về wallet updates (multiple coins)
}

export interface Trade {
  id: string;
  order_id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  total: number;
  fee: number;
  fee_asset: string;
  executed_at: string;
  created_at: string;
}

export interface Position {
  symbol: string;
  quantity: number;
  average_price: number;
  current_value: number;
  pnl: number;
  status: 'open';
}

// ============= Futures Interfaces =============

export interface FuturesOrder {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  order_type: 'market' | 'limit' | 'stop_loss' | 'take_profit' | 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
  quantity: number;
  price: number;
  leverage: number;
  status: 'pending' | 'filled' | 'cancelled';
  created_at: string;
  filled_at?: string;
  margin_required?: number;
  wallet_update?: WalletUpdate; // ✅ Single coin update (deprecated)
  wallet_updates?: WalletUpdates; // ✅ Multiple coins update
}

export interface FuturesPosition {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  entry_price: number;
  mark_price: number;
  liquidation_price: number;
  leverage: number;
  margin: number;
  unrealized_pnl: number;
  realized_pnl: number;
  status: 'open' | 'closed';
  created_at: string;
  closed_at?: string;
  take_profit_price?: number;  // ✅ TP price
  stop_loss_price?: number;    // ✅ SL price
}

export interface PaginatedFuturesPositionsResponse {
  positions: FuturesPosition[];
  total: number;
}

export interface PaginatedFuturesOrdersResponse {
  orders: FuturesOrder[];
  total: number;
}

export interface CreateFuturesOrderRequest {
  symbol: string;
  side: 'LONG' | 'SHORT';
  order_type: 'market' | 'limit' | 'stop_loss' | 'take_profit';
  quantity: number;
  price?: number;
  leverage: number;
  timestamp?: number;
}

export interface CreateFuturesPositionRequest {
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  leverage: number;
  collateral: number;  // Margin amount (required by backend)
  entry_price?: number;
  timestamp?: number;
  fee?: number;        // Opening fee (0.02% = 0.0002)
}

export interface CancelFuturesOrderResponse {
  message: string;
  id: string;
  wallet_updates?: WalletUpdates;  // ✅ May include wallet updates if margin was refunded
}

export interface CloseFuturesPositionResponse {
  position_id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry_price: number;
  exit_price: number;
  quantity: number;
  leverage: number;
  collateral: number;      // ✅ Original margin
  realized_pnl: number;    // Profit/loss
  commission: number;      // Trading fee
  closed_at: string;       // Close timestamp
  wallet_updates: WalletUpdates;
}

export interface OrdersResponse {
  orders: Order[];
  total: number;
}

export interface TradesResponse {
  trades: Trade[];
  total: number;
}

// ============= Trading Service =============

export class TradingService {
  private static getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  /**
   * ✅ 1️⃣ POST /api/trading/orders - Tạo Lệnh (Spot)
   * Tạo lệnh mới, kiểm tra số dư, khóa tiền
   */
  static async createOrder(data: CreateOrderRequest): Promise<Order> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      // Validate data
      if (!data.symbol || !data.side || !data.order_type || !data.quantity) {
        throw new Error('Thiếu thông tin lệnh: symbol, side, order_type, quantity là bắt buộc');
      }

      if (!data.price) {
        throw new Error('Price là bắt buộc cho tất cả các loại lệnh');
      }

      // Sanitize payload - luôn gửi price
      const payload: any = {
        symbol: data.symbol,
        side: data.side,
        order_type: data.order_type,
        quantity: Number(data.quantity),
        price: Number(data.price),
      };
      
      // Thêm timestamp (real-time)
      if (data.timestamp) {
        payload.timestamp = data.timestamp;
        console.log(`⏰ Order timestamp: ${new Date(data.timestamp).toISOString()}`);
      }
      
      // Thêm fee nếu có
      if (data.fee !== undefined) {
        payload.fee = Number(data.fee);
        console.log(`💰 Trading fee: ${data.fee}`);
      }

      console.log('📤 POST /trading/orders:', payload);

      const response = await fetch(`${API_BASE_URL}/trading/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        // Check if user is banned (403 Forbidden)
        const isBanned = await checkAndHandleBannedError(response.clone());
        if (isBanned) {
          throw new Error('⛔ Tài khoản bị khóa - Không thể giao dịch');
        }
        
        let error;
        let errorText = '';
        try {
          error = await response.json();
          errorText = typeof error === 'string' ? error : JSON.stringify(error, null, 2);
        } catch {
          errorText = `HTTP ${response.status}`;
          error = { detail: errorText };
        }
        
        console.error('❌ API Error Response:', errorText);
        console.error('❌ Status:', response.status);
        
        // Extract error message - handle array or object
        let errorMessage = '';
        if (Array.isArray(error)) {
          errorMessage = error.map(e => typeof e === 'string' ? e : JSON.stringify(e)).join('; ');
        } else if (typeof error === 'object' && error !== null) {
          errorMessage = error.detail || error.message || error.error || JSON.stringify(error);
        } else {
          errorMessage = String(error);
        }
        
        console.error('❌ Error Message:', errorMessage);
        console.error('❌ Full Payload Sent:', JSON.stringify(payload, null, 2));
        throw new Error(`[${response.status}] ${errorMessage}`);
      }

      const result = await response.json();
      console.log('✅ Order created:', result);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('❌ Create order error:', errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * ✅ 2️⃣ GET /api/trading/orders - Lấy Danh Sách Lệnh (Spot)
   * Lấy danh sách lệnh, lọc theo symbol/status
   */
  static async getOrders(symbol?: string, status?: string, limit: number = 50, offset: number = 0): Promise<Order[]> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      const params = new URLSearchParams();
      if (symbol) params.append('symbol', symbol);
      if (status) params.append('status', status);
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      const url = `${API_BASE_URL}/trading/orders${params.toString() ? '?' + params.toString() : ''}`;
      console.log('📤 [SPOT API] GET /trading/orders:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error response:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          console.error('❌ Server error detail:', errorJson);
        } catch (e) {
          console.error('❌ Server error (non-JSON):', errorText);
        }
        throw new Error(`Lỗi lấy danh sách lệnh: HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ [SPOT API] Orders fetched:', result);
      // Backend đã filter market_type='spot', không cần filter ở client
      return result.orders || result;
    } catch (error) {
      console.error('❌ Get orders error:', error);
      throw error;
    }
  }

  /**
   * ✅ 3️⃣ GET /api/trading/orders/{id} - Lấy Chi Tiết Một Lệnh (Spot)
   */
  static async getOrderById(orderId: string): Promise<Order> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      console.log('📤 GET /trading/orders/' + orderId);

      const response = await fetch(`${API_BASE_URL}/futures/orders/${orderId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        throw new Error(`Lỗi hủy lệnh futures: HTTP ${response.status}`);
      }

      const rawText = await response.text();
      const result = JSON.parse(rawText, (key, value) => {
        if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'UUID') return String(value);
        if (typeof value === 'string' && value.startsWith("UUID('") && value.endsWith("')")) return value.slice(6, -2);
        return value;
      });
      console.log('✅ Futures order cancelled:', result);
      return result;
    } catch (error) {
      console.error('❌ Get order by ID error:', error);
      throw error;
    }
  }

  /**
   * ✅ 4️⃣ DELETE /api/trading/orders/{id} - Hủy Lệnh (Spot)
   * Hủy lệnh, mở khóa tiền
   */
  static async cancelOrder(orderId: string): Promise<{ 
    message: string; 
    id: string; 
    status: string;
    wallet_update?: WalletUpdate;
    wallet_updates?: WalletUpdates;
  }> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      console.log('📤 DELETE /trading/orders/' + orderId);

      const response = await fetch(`${API_BASE_URL}/trading/orders/${orderId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error response:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          console.error('❌ Server error detail:', errorJson);
          throw new Error(errorJson.detail || errorJson.message || `Lỗi hủy lệnh: HTTP ${response.status}`);
        } catch (e) {
          if (e instanceof Error && e.message.startsWith('Lỗi hủy')) throw e;
          console.error('❌ Server error (non-JSON):', errorText);
          throw new Error(`Lỗi hủy lệnh: HTTP ${response.status}`);
        }
      }

      const result = await response.json();
      console.log('✅ Order cancelled:', result);
      return result;
    } catch (error) {
      console.error('❌ Cancel order error:', error);
      throw error;
    }
  }

  /**
   * ✅ 5️⃣ POST /api/trading/fill-trade - Khớp lệnh (Auto-fill limit orders)
   * Khi limit order price khớp với market price
   */
  static async fillTrade(orderId: string, price?: number, quantity?: number, timestamp?: number): Promise<FillTradeResponse> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      console.log('📤 POST /trading/fill-trade:', { orderId, price, quantity, timestamp });

      // Chuẩn bị payload
      const payload: any = { order_id: orderId };
      if (price !== undefined) payload.price = Number(price);
      if (quantity !== undefined) payload.quantity = Number(quantity);
      if (timestamp !== undefined) {
        payload.timestamp = timestamp;
        console.log(`⏰ Fill-trade timestamp: ${new Date(timestamp).toISOString()}`);
      }

      const response = await fetch(`${API_BASE_URL}/trading/fill-trade`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        let error;
        let errorText = '';
        try {
          error = await response.json();
          errorText = typeof error === 'string' ? error : JSON.stringify(error, null, 2);
        } catch {
          errorText = `HTTP ${response.status}`;
          error = { detail: errorText };
        }
        
        console.error('❌ Fill trade API Error:', errorText);
        
        // Extract error message - handle array or object
        let errorMessage = '';
        if (Array.isArray(error)) {
          errorMessage = error.map(e => {
            if (typeof e === 'string') return e;
            if (e.msg) return e.msg;
            return JSON.stringify(e);
          }).join('; ');
        } else if (typeof error === 'object' && error !== null) {
          errorMessage = error.detail || error.message || error.error || JSON.stringify(error);
        } else {
          errorMessage = String(error);
        }
        
        throw new Error(`[${response.status}] ${errorMessage}`);
      }

      const result = await response.json();
      console.log('✅ Trade filled:', result);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('❌ Fill trade error:', errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * ✅ 5️⃣ GET /api/trading/trades - Lấy Lịch Sử Giao Dịch (Spot)
   * Lấy lịch sử các lệnh đã filled
   */
  static async getTrades(symbol?: string, limit: number = 50, offset: number = 0): Promise<Trade[]> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      const params = new URLSearchParams();
      if (symbol) params.append('symbol', symbol);
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      const url = `${API_BASE_URL}/trading/trades${params.toString() ? '?' + params.toString() : ''}`;
      console.log('📤 GET /trading/trades:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        throw new Error(`Lỗi lấy lịch sử giao dịch: HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Trades fetched:', result);
      return result.trades || result;
    } catch (error) {
      console.error('❌ Get trades error:', error);
      throw error;
    }
  }

  /**
   * ✅ 6️⃣ GET /api/trading/trades/{id} - Lấy Chi Tiết Giao Dịch (Spot)
   */
  static async getTradeById(tradeId: string): Promise<Trade> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      console.log('📤 GET /trading/trades/' + tradeId);

      const response = await fetch(`${API_BASE_URL}/trading/trades/${tradeId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        throw new Error(`Lỗi lấy chi tiết giao dịch: HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Trade details fetched:', result);
      return result;
    } catch (error) {
      console.error('❌ Get trade by ID error:', error);
      throw error;
    }
  }

  /**
   * ✅ 7️⃣ GET /api/trading/positions - Tính Vị Thế (Spot)
   * Tính vị thế từ pending orders
   */
  static async getPositions(): Promise<Position[]> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      console.log('📤 [SPOT API] GET /trading/positions');

      const response = await fetch(`${API_BASE_URL}/trading/positions`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error response:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          console.error('❌ Server error detail:', errorJson);
        } catch (e) {
          console.error('❌ Server error (non-JSON):', errorText);
        }
        throw new Error(`Lỗi lấy vị thế: HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ [SPOT API] Positions fetched:', result);
      // Backend đã filter market_type='spot', không cần filter ở client
      return result.positions || result;
    } catch (error) {
      console.error('❌ Get positions error:', error);
      throw error;
    }
  }

  /**
   * 🔄 Helper: Get Pending Orders Only
   */
  static async getPendingOrders(symbol?: string): Promise<Order[]> {
    return this.getOrders(symbol, 'pending');
  }

  /**
   * 🔄 Helper: Get Filled Orders Only
   */
  static async getFilledOrders(symbol?: string, limit: number = 20): Promise<Order[]> {
    return this.getOrders(symbol, 'filled', limit);
  }

  /**
   * 🔄 Helper: Get Cancelled Orders Only
   */
  static async getCancelledOrders(symbol?: string): Promise<Order[]> {
    return this.getOrders(symbol, 'cancelled');
  }

  /**
   * 🔄 Helper: Calculate Locked Balance
   * Tính số tiền bị khóa từ pending orders
   */
  static async getLockedBalance(): Promise<{ [key: string]: number }> {
    try {
      const orders = await this.getPendingOrders();
      const locked: { [key: string]: number } = {};

      orders.forEach((order) => {
        if (order.side === 'BUY') {
          // BUY: khóa USDT
          const locked_usdt = order.quantity * order.price;
          locked['USDT'] = (locked['USDT'] || 0) + locked_usdt;
        } else {
          // SELL: khóa coin
          const symbol = order.symbol.replace('USDT', '');
          locked[symbol] = (locked[symbol] || 0) + order.quantity;
        }
      });

      console.log('✅ Locked balance calculated:', locked);
      return locked;
    } catch (error) {
      console.error('❌ Calculate locked balance error:', error);
      return {};
    }
  }

  // ============= FUTURES TRADING APIs =============

  /**
   * ✅ F1️⃣ POST /api/futures/orders - Tạo Lệnh Futures (LIMIT, STOP_LOSS, TAKE_PROFIT)
   * Đặt lệnh chờ khớp - chưa mở vị thế, chưa trừ margin
   */
  static async createFuturesOrder(data: CreateFuturesOrderRequest): Promise<FuturesOrder> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      console.log('📤 POST /futures/orders:', data);

      const payload: any = {
        symbol: data.symbol,
        side: data.side,
        order_type: data.order_type,
        quantity: Number(data.quantity),
        leverage: Number(data.leverage),
      };

      if (data.price) {
        payload.price = Number(data.price);
      }

      if (data.timestamp) {
        payload.timestamp = data.timestamp;
      }

      const response = await fetch(`${API_BASE_URL}/futures/orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const error = await response.json();
        const errorMessage = error.detail || error.message || JSON.stringify(error);
        throw new Error(`[${response.status}] ${errorMessage}`);
      }

      const rawText = await response.text();
      console.log('📥 Raw response:', rawText);
      
      // ✅ Fix UUID format: Replace UUID('...') with just '...'
      const cleanedText = rawText.replace(/UUID\('([^']+)'\)/g, '"$1"');
      console.log('🔧 Cleaned response:', cleanedText);
      
      const result = JSON.parse(cleanedText);
      console.log('✅ Futures order created:', result);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('❌ Create futures order error:', errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * ✅ F2️⃣ GET /api/futures/orders - Lấy Danh Sách Lệnh Futures (Paginated)
   */
  static async getFuturesOrders(symbol?: string, status?: string, limit: number = 50, offset: number = 0): Promise<PaginatedFuturesOrdersResponse> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      const params = new URLSearchParams();
      if (symbol) params.append('symbol', symbol);
      if (status) params.append('status', status);
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      const url = `${API_BASE_URL}/futures/orders${params.toString() ? '?' + params.toString() : ''}`;
      console.log('📤 [FUTURES API] GET /futures/orders:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error response:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          console.error('❌ Server error detail:', errorJson);
        } catch (e) {
          console.error('❌ Server error (non-JSON):', errorText);
        }
        throw new Error(`Lỗi lấy danh sách lệnh futures: HTTP ${response.status}`);
      }

      const rawText = await response.text();
      const cleanedText = rawText.replace(/UUID\('([^']+)'\)/g, '"$1"');
      const result = JSON.parse(cleanedText);
      
      console.log('✅ [FUTURES API] Orders fetched:', result);
      // Backend đã filter market_type='futures', không cần filter ở client
      // Return paginated response with total count
      if (result.orders && typeof result.total === 'number') {
        return {
          orders: result.orders,
          total: result.total
        };
      }
      // Fallback for backward compatibility
      return {
        orders: Array.isArray(result) ? result : result.orders || [],
        total: Array.isArray(result) ? result.length : (result.orders?.length || 0)
      };
    } catch (error) {
      console.error('❌ Get futures orders error:', error);
      throw error;
    }
  }

  /**
   * ✅ F3️⃣ DELETE /api/futures/orders/{id} - Hủy Lệnh Futures
   */
  static async cancelFuturesOrder(orderId: string): Promise<CancelFuturesOrderResponse> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      console.log('📤 DELETE /futures/orders/' + orderId);

      const response = await fetch(`${API_BASE_URL}/futures/orders/${orderId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error response:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          console.error('❌ Server error detail:', errorJson);
          throw new Error(errorJson.detail || errorJson.message || `Lỗi hủy lệnh futures: HTTP ${response.status}`);
        } catch (e) {
          if (e instanceof Error && e.message.startsWith('Lỗi hủy')) throw e;
          console.error('❌ Server error (non-JSON):', errorText);
          throw new Error(`Lỗi hủy lệnh futures: HTTP ${response.status}`);
        }
      }

      const rawText = await response.text();
      const cleanedText = rawText.replace(/UUID\('([^']+)'\)/g, '"$1"');
      const result = JSON.parse(cleanedText);
      
      console.log('\n📋 ===== CANCEL ORDER RESPONSE DEBUG =====');
      console.log('📥 Raw text:', rawText);
      console.log('✅ Parsed result:', result);
      console.log('🔍 Result keys:', Object.keys(result));
      console.log('🔍 wallet_updates present?', !!result.wallet_updates);
      console.log('🔍 wallet_updates value:', result.wallet_updates);
      
      return result as CancelFuturesOrderResponse;
    } catch (error) {
      console.error('❌ Cancel futures order error:', error);
      throw error;
    }
  }

  /**
   * ✅ F4️⃣ POST /api/futures/positions - Mở Vị Thế Futures (MARKET)
   * Mở vị thế ngay lập tức, trừ margin từ wallet
   */
  static async openFuturesPosition(data: CreateFuturesPositionRequest): Promise<FuturesPosition> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      console.log('📤 POST /futures/positions:', data);

      const payload: any = {
        symbol: data.symbol,
        side: data.side,
        quantity: Number(data.quantity),
        leverage: Number(data.leverage),
        collateral: Number(data.collateral),  // Required margin amount
      };

      if (data.entry_price) {
        payload.entry_price = Number(data.entry_price);
      }

      if (data.timestamp) {
        payload.timestamp = data.timestamp;
      }
      
      // Thêm fee nếu có
      if (data.fee !== undefined) {
        payload.fee = Number(data.fee);
        console.log(`💰 Futures opening fee: ${data.fee}`);
      }

      const response = await fetch(`${API_BASE_URL}/futures/positions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error response:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          console.error('❌ Server error detail:', errorJson);
          const errorMessage = errorJson.detail || errorJson.message || JSON.stringify(errorJson);
          throw new Error(`[${response.status}] ${errorMessage}`);
        } catch (e) {
          if (e instanceof Error && e.message.startsWith('[')) throw e;
          console.error('❌ Server error (non-JSON):', errorText);
          throw new Error(`[${response.status}] Lỗi mở vị thế futures`);
        }
      }

      const rawText = await response.text();
      const cleanedText = rawText.replace(/UUID\('([^']+)'\)/g, '"$1"');
      const result = JSON.parse(cleanedText);
      
      console.log('✅ Futures position opened:', result);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('❌ Open futures position error:', errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * ✅ F5️⃣ GET /api/futures/positions - Lấy Danh Sách Vị Thế Futures (Paginated)
   */
  static async getFuturesPositions(symbol?: string, status?: string, limit: number = 50, offset: number = 0): Promise<PaginatedFuturesPositionsResponse> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      const params = new URLSearchParams();
      if (symbol) params.append('symbol', symbol);
      if (status) params.append('status', status);
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      const url = `${API_BASE_URL}/futures/positions${params.toString() ? '?' + params.toString() : ''}`;
      console.log('📤 [FUTURES API] GET /futures/positions:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error response:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          console.error('❌ Server error detail:', errorJson);
        } catch (e) {
          console.error('❌ Server error (non-JSON):', errorText);
        }
        throw new Error(`Lỗi lấy danh sách vị thế futures: HTTP ${response.status}`);
      }

      const rawText = await response.text();
      const cleanedText = rawText.replace(/UUID\('([^']+)'\)/g, '"$1"');
      const result = JSON.parse(cleanedText);
      
      console.log('✅ [FUTURES API] Positions fetched:', result);
      // Backend đã filter market_type='futures', không cần filter ở client
      // Return paginated response with total count
      if (result.positions && typeof result.total === 'number') {
        return {
          positions: result.positions,
          total: result.total
        };
      }
      // Fallback for backward compatibility
      return {
        positions: Array.isArray(result) ? result : result.positions || [],
        total: Array.isArray(result) ? result.length : (result.positions?.length || 0)
      };
    } catch (error) {
      console.error('❌ Get futures positions error:', error);
      throw error;
    }
  }

  /**
   * ✅ F6️⃣ POST /api/futures/positions/{id}/close - Đóng Vị Thế Futures
   */
  /**
   * ✅ Close Futures Position - Đóng vị thế futures
   * @param positionId - ID of position to close
   * @param closePrice - Exit price (optional, backend will use market price if not provided)
   * @param closingFee - Closing fee (optional, for future backend compatibility)
   */
  static async closeFuturesPosition(
    positionId: string, 
    closePrice?: number,
    closingFee?: number
  ): Promise<CloseFuturesPositionResponse> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      console.log('📤 POST /futures/positions/' + positionId + '/close');

      // ✅ Backend requires position_id and exit_price in body
      const payload: any = {
        position_id: positionId,
        exit_price: closePrice ? Number(closePrice) : undefined,
      };
      
      // Add closing fee if provided (for future backend compatibility)
      if (closingFee !== undefined) {
        payload.fee = Number(closingFee);
        console.log(`💰 Futures closing fee: ${closingFee}`);
      }

      const response = await fetch(`${API_BASE_URL}/futures/positions/${positionId}/close`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error response:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          console.error('❌ Server error detail:', errorJson);
          throw new Error(errorJson.detail || errorJson.message || `Lỗi đóng vị thế: HTTP ${response.status}`);
        } catch (e) {
          if (e instanceof Error && e.message.startsWith('Lỗi đóng')) throw e;
          console.error('❌ Server error (non-JSON):', errorText);
          throw new Error(`Lỗi đóng vị thế: HTTP ${response.status}`);
        }
      }

      const rawText = await response.text();
      const cleanedText = rawText.replace(/UUID\('([^']+)'\)/g, '"$1"');
      const result = JSON.parse(cleanedText);
      
      // ✅ DETAILED RESPONSE LOGGING
      console.log('\n📋 ===== CLOSE POSITION RESPONSE DEBUG =====');
      console.log('📥 Raw text:', rawText);
      console.log('📥 Cleaned text:', cleanedText);
      console.log('✅ Parsed result:', result);
      console.log('🔍 Result keys:', Object.keys(result));
      console.log('🔍 wallet_updates present?', !!result.wallet_updates);
      console.log('🔍 wallet_updates value:', result.wallet_updates);
      console.log('✅ Futures position closed:', result);
      
      return result;
    } catch (error) {
      console.error('❌ Close futures position error:', error);
      throw error;
    }
  }

  /**
   * ✅ F7️⃣ POST /api/futures/fill-order - Khớp lệnh Futures (Auto-fill limit orders)
   * Tương tự fill-trade cho Spot, nhưng tạo Position thay vì Trade
   */
  static async fillFuturesOrder(orderId: string, fillPrice?: number, timestamp?: number): Promise<FuturesPosition> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      console.log('📤 POST /futures/fill-order:', { orderId, fillPrice, timestamp });

      const payload: any = { order_id: orderId };
      if (fillPrice !== undefined) payload.fill_price = Number(fillPrice);
      if (timestamp !== undefined) payload.timestamp = timestamp;

      const response = await fetch(`${API_BASE_URL}/futures/fill-order`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error response:', errorText);
        try {
          const errorJson = JSON.parse(errorText);
          console.error('❌ Server error detail:', errorJson);
          const errorMessage = errorJson.detail || errorJson.message || JSON.stringify(errorJson);
          throw new Error(`[${response.status}] ${errorMessage}`);
        } catch (e) {
          if (e instanceof Error && e.message.startsWith('[')) throw e;
          console.error('❌ Server error (non-JSON):', errorText);
          throw new Error(`[${response.status}] Lỗi fill lệnh`);
        }
      }

      const rawText = await response.text();
      const cleanedText = rawText.replace(/UUID\('([^']+)'\)/g, '"$1"');
      const result = JSON.parse(cleanedText);
      
      console.log('✅ Futures order filled, position opened:', result);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('❌ Fill futures order error:', errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * ✅ F7️⃣.5 POST /api/futures/positions/{id}/update-tpsl - Cập nhật TP/SL cho Position
   */
  static async updateFuturesPositionTPSL(
    positionId: string,
    takeProfitPrice?: number | null,
    stopLossPrice?: number | null
  ): Promise<FuturesPosition> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      const payload: any = {};
      if (takeProfitPrice !== undefined) payload.take_profit_price = takeProfitPrice;
      if (stopLossPrice !== undefined) payload.stop_loss_price = stopLossPrice;

      console.log('📤 POST /futures/positions/:id/update-tpsl:', { positionId, payload });

      // Thử endpoint khác: /futures/positions/{id}/update-tpsl
      let response = await fetch(`${API_BASE_URL}/futures/positions/${positionId}/update-tpsl`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      // Nếu 404, thử endpoint cũ
      if (response.status === 404) {
        console.log('📤 Trying alternative endpoint: POST /futures/{id}/update-tpsl');
        response = await fetch(`${API_BASE_URL}/futures/${positionId}/update-tpsl`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Server error response:', errorText);
        throw new Error(`Cập nhật TP/SL thất bại: HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Position updated:', result);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('❌ Update TP/SL error:', errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * ✅ F8️⃣ GET /api/futures/pnl-history - Lịch Sử PnL Futures
   * Lấy từ Position (status=CLOSED) + Trade
   */
  static async getFuturesPnlHistory(
    symbol?: string,
    startDate?: string,
    endDate?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<any[]> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      const params = new URLSearchParams();
      if (symbol) params.append('symbol', symbol);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      const url = `${API_BASE_URL}/futures/pnl-history${params.toString() ? '?' + params.toString() : ''}`;
      console.log('📤 GET /futures/pnl-history:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Lỗi lấy lịch sử PnL: HTTP ${response.status}`);
      }

      const rawText = await response.text();
      const cleanedText = rawText.replace(/UUID\('([^']+)'\)/g, '"$1"');
      const result = JSON.parse(cleanedText);

      console.log('✅ PnL history fetched:', result);
      return result.history || result;
    } catch (error) {
      console.error('❌ Get PnL history error:', error);
      throw error;
    }
  }

  /**
   * ✅ F9️⃣ GET /api/futures/funding-rates - Funding Rates
   * Mock data (chuẩn bị cho tương lai)
   */
  static async getFuturesFundingRates(symbol?: string): Promise<any[]> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      const params = new URLSearchParams();
      if (symbol) params.append('symbol', symbol);

      const url = `${API_BASE_URL}/futures/funding-rates${params.toString() ? '?' + params.toString() : ''}`;
      console.log('📤 GET /futures/funding-rates:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Lỗi lấy funding rates: HTTP ${response.status}`);
      }

      const rawText = await response.text();
      const cleanedText = rawText.replace(/UUID\('([^']+)'\)/g, '"$1"');
      const result = JSON.parse(cleanedText);

      console.log('✅ Funding rates fetched:', result);
      return result.rates || result;
    } catch (error) {
      console.error('❌ Get funding rates error:', error);
      throw error;
    }
  }

  /**
   * ✅ F🔟 GET /api/futures/portfolio-summary - Tóm Tắt Portfolio Futures
   * Tổng ký quỹ, PnL chưa thực hiện, PnL đã thực hiện, Win rate, Best/Worst trades
   */
  static async getFuturesPortfolioSummary(): Promise<{
    total_collateral: number;
    unrealized_pnl: number;
    realized_pnl: number;
    win_rate: number;
    total_positions: number;
    open_positions: number;
    closed_positions: number;
    best_trade?: any;
    worst_trade?: any;
  }> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      const url = `${API_BASE_URL}/futures/portfolio-summary`;
      console.log('📤 GET /futures/portfolio-summary');

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Lỗi lấy tóm tắt portfolio: HTTP ${response.status}`);
      }

      const rawText = await response.text();
      const cleanedText = rawText.replace(/UUID\('([^']+)'\)/g, '"$1"');
      const result = JSON.parse(cleanedText);

      console.log('✅ Portfolio summary fetched:', result);
      return result;
    } catch (error) {
      console.error('❌ Get portfolio summary error:', error);
      throw error;
    }
  }
}
