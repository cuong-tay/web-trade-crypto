const API_BASE_URL = 'http://localhost:8000/api';

/**
 * Admin Service - Handles all admin API calls
 */
export class AdminService {
  private static getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  private static async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const token = this.getToken();
    if (!token) {
      throw new Error('No authentication token');
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  // Dashboard APIs
  static async getDashboardStats() {
    return this.request('/admin/dashboard/stats');
  }

  static async getUserGrowthChart(period: string = '7d') {
    return this.request(`/admin/reports/user-growth?period=${period}`);
  }

  static async getTradingVolumeChart(period: string = '7d') {
    return this.request(`/admin/reports/top-coins?period=${period}`);
  }

  static async getRecentUsers() {
    return this.request('/admin/dashboard/recent-users');
  }

  static async getRecentTransactions() {
    return this.request('/admin/dashboard/recent-transactions');
  }

  static async getActivityLog() {
    return this.request('/admin/dashboard/activity-log');
  }

  // Users Management APIs
  static async getUsers(params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    role?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.status) queryParams.append('status', params.status);
    if (params.role) queryParams.append('role', params.role);
    
    return this.request(`/admin/users?${queryParams.toString()}`);
  }

  static async getUserDetail(userId: string) {
    return this.request(`/admin/users/${userId}`);
  }

  static async createUser(data: { email: string; username: string; password: string; confirm_password: string }) {
    // Use auth/register endpoint to create new user
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || error.message || 'Tạo user thất bại');
    }

    return response.json();
  }

  static async banUser(userId: string, reason: string) {
    // Validate reason
    if (!reason || reason.trim().length === 0) {
      throw new Error('Reason is required (1-500 characters)');
    }
    if (reason.length > 500) {
      throw new Error('Reason too long (max 500 characters)');
    }
    
    return this.request(`/admin/users/${userId}/ban`, {
      method: 'PATCH',
      body: JSON.stringify({ reason: reason.trim() }),
    });
  }

  static async unbanUser(userId: string) {
    return this.request(`/admin/users/${userId}/unban`, {
      method: 'PATCH',
    });
  }

  static async exportUsersCSV() {
    const token = this.getToken();
    const response = await fetch(`${API_BASE_URL}/admin/users/export-csv`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.blob();
  }

  // Transactions APIs
  static async getTransactions(params: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    coin?: string;
    from_date?: string;
    to_date?: string;
  }) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.type) queryParams.append('type', params.type);
    if (params.coin) queryParams.append('coin', params.coin);
    if (params.from_date) queryParams.append('from_date', params.from_date);
    if (params.to_date) queryParams.append('to_date', params.to_date);
    
    return this.request(`/admin/transactions?${queryParams.toString()}`);
  }

  static async getTransactionDetail(txnId: number) {
    return this.request(`/admin/transactions/${txnId}`);
  }

  static async exportTransactionsCSV() {
    const token = this.getToken();
    const response = await fetch(`${API_BASE_URL}/admin/transactions/export-csv`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.blob();
  }

  // Reports APIs
  static async getReportsSummary(period: string = '7d') {
    return this.request(`/admin/reports/summary?period=${period}`);
  }

  static async getRevenueChart(period: string = '7d') {
    return this.request(`/admin/reports/revenue-chart?period=${period}`);
  }

  static async getUserGrowthReportChart(period: string = '7d') {
    return this.request(`/admin/reports/user-growth?period=${period}`);
  }

  static async getTopCoins(period: string = '7d') {
    return this.request(`/admin/reports/top-coins?period=${period}`);
  }

  static async getBuySellRatio(period: string = '7d') {
    return this.request(`/admin/reports/buy-sell-ratio?period=${period}`);
  }

  static async getActivityHeatmap(period: string = '7d') {
    return this.request(`/admin/reports/activity-heatmap?period=${period}`);
  }

  static async getTopUsers(period: string = '7d') {
    return this.request(`/admin/reports/top-users?period=${period}`);
  }

  static async getTopDays(period: string = '7d') {
    return this.request(`/admin/reports/top-days?period=${period}`);
  }

  // Settings APIs
  static async getGeneralSettings() {
    return this.request('/admin/settings/general');
  }

  static async updateGeneralSettings(settings: any) {
    return this.request('/admin/settings/general', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  static async getTradingSettings() {
    return this.request('/admin/settings/trading');
  }

  static async updateTradingSettings(settings: any) {
    return this.request('/admin/settings/trading', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  static async getFeesSettings() {
    return this.request('/admin/settings/fees');
  }

  static async updateFeesSettings(settings: any) {
    return this.request('/admin/settings/fees', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  static async getSecuritySettings() {
    return this.request('/admin/settings/security');
  }

  static async updateSecuritySettings(settings: any) {
    return this.request('/admin/settings/security', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  static async getNotificationsSettings() {
    return this.request('/admin/settings/notifications');
  }

  static async updateNotificationsSettings(settings: any) {
    return this.request('/admin/settings/notifications', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  static async clearCache() {
    return this.request('/admin/settings/clear-cache', {
      method: 'POST',
    });
  }

  static async resetSettings() {
    if (!confirm('⚠️ WARNING: This will reset ALL settings to default values. This action CANNOT be undone! Continue?')) {
      throw new Error('Reset cancelled by user');
    }
    return this.request('/admin/settings/reset', {
      method: 'POST',
    });
  }
}
