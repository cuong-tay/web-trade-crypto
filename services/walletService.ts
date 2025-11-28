/**
 * Wallet Service - Wallet Management APIs
 * Quản lý ví, nạp/rút tiền, lịch sử giao dịch
 */

import { API_BASE_URL } from '../config/api';

console.log('💰 WalletService loaded with API_BASE_URL:', API_BASE_URL);

// ============= Interfaces =============

export interface WalletBalance {
  coin: string;
  available: number;
  locked: number;
  total: number;
  usdValue?: number;
}

export interface DepositAddress {
  currency: string;
  network: string;
  address: string;
  qrCode?: string;
  createdAt: string;
}

export interface WithdrawRequest {
  currency: string;
  amount: number;
  address: string;
  network: string;
  memo?: string;
}

export interface WithdrawResponse {
  id: string;
  currency: string;
  amount: number;
  address: string;
  network: string;
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'failed';
  fee: number;
  txHash?: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  wallet_id: string;
  type: string;
  currency: string;
  amount: string;
  fee: string;
  balance_after: string;
  created_at: string;
  metadata?: Record<string, any>;
}

export interface WalletsResponse {
  spot?: WalletBalance[];
  funding?: WalletBalance[];
  margin?: WalletBalance[];
  total_value: number;
}

// ============= Wallet Service =============

export class WalletService {
  private static getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  /**
   * ✅ 1️⃣ GET /api/wallets/balances - Lấy Tổng Quan Số Dư
   * Lấy số dư của tất cả các loại ví (spot, funding, margin...)
   */
  static async getBalances(): Promise<WalletsResponse> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      console.log('📤 GET /wallets/balances');

      const response = await fetch(`${API_BASE_URL}/wallets/balances`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Wallet balances fetched:', result);
      return result;
    } catch (error) {
      console.error('❌ Get balances error:', error);
      throw error;
    }
  }

  /**
   * ✅ 2️⃣ POST /api/wallets/deposit/address - Lấy Địa Chỉ Nạp
   * Lấy địa chỉ ví để nạp coin
   */
  static async getDepositAddress(currency: string, network: string): Promise<DepositAddress> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      console.log('📤 POST /wallets/deposit/address:', { currency, network });

      const response = await fetch(`${API_BASE_URL}/wallets/deposit/address`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currency, network }),
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Deposit address fetched:', result);
      return result;
    } catch (error) {
      console.error('❌ Get deposit address error:', error);
      throw error;
    }
  }

  /**
   * ✅ 3️⃣ POST /api/wallets/withdraw - Tạo Yêu Cầu Rút Tiền
   * Tạo yêu cầu rút tiền (cần xác nhận)
   */
  static async createWithdraw(data: WithdrawRequest): Promise<WithdrawResponse> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      // Validate
      if (!data.currency || !data.amount || !data.address || !data.network) {
        throw new Error('Thiếu thông tin rút tiền');
      }

      if (data.amount <= 0) {
        throw new Error('Số lượng rút phải lớn hơn 0');
      }

      const payload = {
        currency: data.currency,
        amount: Number(data.amount),
        address: data.address.trim(),
        network: data.network,
        ...(data.memo && { memo: data.memo }),
      };

      console.log('📤 POST /wallets/withdraw:', payload);

      const response = await fetch(`${API_BASE_URL}/wallets/withdraw`, {
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
        try {
          error = await response.json();
        } catch {
          error = { detail: `HTTP ${response.status}` };
        }
        const errorMsg = error.detail || error.message || JSON.stringify(error);
        console.error('❌ API Error:', error);
        throw new Error(errorMsg);
      }

      const result = await response.json();
      console.log('✅ Withdraw request created:', result);
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : JSON.stringify(error);
      console.error('❌ Create withdraw error:', errorMsg);
      throw new Error(errorMsg);
    }
  }

  /**
   * ✅ 4️⃣ GET /api/wallets/transactions - Lấy Lịch Sử Giao Dịch
   * Lấy lịch sử nạp, rút, chuyển tiền
   */
  static async getTransactions(
    type?: 'deposit' | 'withdraw' | 'transfer' | 'trading',
    limit: number = 50,
    offset: number = 0
  ): Promise<Transaction[]> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      const params = new URLSearchParams();
      if (type) params.append('type', type);
      params.append('limit', limit.toString());
      params.append('offset', offset.toString());

      const url = `${API_BASE_URL}/wallets/transactions${params.toString() ? '?' + params.toString() : ''}`;
      console.log('📤 GET /wallets/transactions:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Transactions fetched:', result);
      return result.transactions || result;
    } catch (error) {
      console.error('❌ Get transactions error:', error);
      throw error;
    }
  }

  /**
   * 🔄 Helper: Get Spot Balance Only
   */
  static async getSpotBalances(): Promise<WalletBalance[]> {
    const wallets = await this.getBalances();
    return wallets.spot || [];
  }

  /**
   * 🔄 Helper: Get Single Coin Balance
   */
  static async getCoinBalance(coin: string): Promise<WalletBalance | null> {
    const wallets = await this.getBalances();
    const allBalances = [
      ...(wallets.spot || []),
      ...(wallets.funding || []),
      ...(wallets.margin || []),
    ];
    return allBalances.find(b => b.coin === coin) || null;
  }

  /**
   * 🔄 Helper: Get Total USD Value
   */
  static async getTotalValue(): Promise<number> {
    const wallets = await this.getBalances();
    return wallets.total_value || 0;
  }

  /**
   * 📊 GET /api/portfolio/stats - Lấy Lợi Nhuận 24h (Chờ Backend)
   * Lấy dữ liệu lợi nhuận/lỗ trong 24 giờ
   * Backend cần implement endpoint này
   */
  static async getProfit24h(): Promise<{ profit: number; profitPercent: number }> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      // Try to get from /portfolio/stats endpoint
      const response = await fetch(`${API_BASE_URL}/portfolio/stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📤 GET /portfolio/stats - Response:', response.status);

      if (!response.ok) {
        // Endpoint not available yet - return 0
        if (response.status === 404) {
          console.warn('⚠️ /portfolio/stats endpoint not implemented yet');
          return { profit: 0, profitPercent: 0 };
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const profit = data.profit_24h || 0;
      const profitPercent = data.profit_24h_percent || 0;
      
      console.log(`✅ 24h Profit fetched: $${profit} (${profitPercent}%)`);
      
      return { profit, profitPercent };
    } catch (error) {
      console.warn('⚠️ Get 24h profit error:', error);
      // Return 0 as fallback - don't throw to keep app stable
      return { profit: 0, profitPercent: 0 };
    }
  }

  /**
   * 📊 Fallback: Tính Lợi Nhuận từ Trading History
   * Nếu /portfolio/stats không available, dùng trade history để tính
   */
  static async calculateProfitFromTrades(): Promise<{ profit: number; profitPercent: number }> {
    try {
      const token = this.getToken();
      if (!token) throw new Error('Không có token');

      // Try to fetch trading data
      const response = await fetch(`${API_BASE_URL}/trading/trades?period=24h`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return { profit: 0, profitPercent: 0 };
      }

      const trades = await response.json();
      
      // Calculate profit from completed trades
      let totalProfit = 0;
      let totalInvested = 0;

      trades.forEach((trade: any) => {
        const entryValue = (trade.price || 0) * (trade.quantity || 0);
        const exitValue = (trade.exit_price || 0) * (trade.quantity || 0);
        const profit = exitValue - entryValue;
        
        totalProfit += profit;
        totalInvested += entryValue;
      });

      const profitPercent = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;

      console.log(`💹 Calculated 24h Profit from trades: $${totalProfit} (${profitPercent}%)`);
      
      return { profit: totalProfit, profitPercent };
    } catch (error) {
      console.warn('⚠️ Calculate profit from trades error:', error);
      return { profit: 0, profitPercent: 0 };
    }
  }
}
