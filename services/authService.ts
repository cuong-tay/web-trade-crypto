/**
 * Authentication Service
 * Xử lý communication với backend auth APIs
 */

import { API_BASE_URL } from '../config/api';

console.log('📡 AuthService loaded with API_BASE_URL:', API_BASE_URL);

export interface User {
  id: string;
  email: string;
  username: string;
  role: string;
  status: string;
  email_verified: boolean;
  created_at: string;
  last_login: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  confirm_password: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserProfile {
  display_name: string;
  phone: string;
  notify_email: boolean;
  notify_push: boolean;
  language: string;
  default_currency: string;
}

export interface UserDetail {
  user: User;
  profile: UserProfile;
}

export interface ProfileUpdateRequest {
  display_name?: string;
  phone?: string;
  notify_email?: boolean;
  notify_push?: boolean;
  language?: string;
  default_currency?: string;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
  confirm_new_password: string;
}

export interface LastLogin {
  last_login: string;
  time_ago: string;
  formatted: string;
}

export class AuthService {
  /**
   * Đăng ký tài khoản mới
   */
  static async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      console.log('📤 Sending register request to:', `${API_BASE_URL}/auth/register`);

      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Đăng ký thất bại';
        try {
          const error = await response.json();
          errorMessage = error.detail || error.message || errorMessage;
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        console.error('❌ Register error:', errorMessage);
        throw new Error(errorMessage);
      }

      const result: AuthResponse = await response.json();
      console.log('✅ Register success:', result.user);

      // Lưu token vào localStorage
      localStorage.setItem('access_token', result.access_token);
      localStorage.setItem('user', JSON.stringify(result.user));

      return result;
    } catch (error) {
      console.error('❌ Register fetch error:', error);
      throw error;
    }
  }

  /**
   * Đăng nhập
   */
  static async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      console.log('📤 Sending login request to:', `${API_BASE_URL}/auth/login`);

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Đăng nhập thất bại';
        try {
          const error = await response.json();
          errorMessage = error.detail || error.message || errorMessage;
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        console.error('❌ Login error:', errorMessage);
        throw new Error(errorMessage);
      }

      const result: AuthResponse = await response.json();
      console.log('✅ Login success:', result.user);
      
      // Lưu token vào localStorage
      localStorage.setItem('access_token', result.access_token);
      localStorage.setItem('user', JSON.stringify(result.user));
      
      return result;
    } catch (error) {
      console.error('❌ Login fetch error:', error);
      throw error;
    }
  }

  /**
   * Đăng xuất
   */
  static async logout(): Promise<void> {
    try {
      const token = this.getToken();
      
      if (token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('❌ Logout error:', error);
    } finally {
      // Xóa token và user data
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      console.log('✅ Logged out');
    }
  }

  /**
   * Lấy token từ localStorage
   */
  static getToken(): string | null {
    return localStorage.getItem('access_token');
  }

  /**
   * Lấy user từ localStorage
   */
  static getUser(): User | null {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  /**
   * Kiểm tra xem user đã đăng nhập hay chưa
   */
  static isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Lấy thông tin chi tiết user (bao gồm profile)
   */
  static async getCurrentUser(): Promise<UserDetail> {
    try {
      const token = this.getToken();
      
      if (!token) {
        throw new Error('Không có token');
      }

      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 GET /auth/me response status:', response.status);

      if (!response.ok) {
        throw new Error(`Không thể lấy thông tin user: HTTP ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Current user loaded:', result);

      // Backend trả về định dạng khác có thể, xử lý linh hoạt
      if (!result.user) {
        // Nếu result là user data trực tiếp
        result.user = result;
      }
      
      if (!result.profile) {
        // Tạo profile mặc định
        result.profile = {
          display_name: result.user?.username || 'User',
          phone: result.user?.phone || '',
          notify_email: true,
          notify_push: true,
          language: 'vi',
          default_currency: 'VND'
        };
      }

      return result as UserDetail;
    } catch (error) {
      console.error('❌ Get current user error:', error);
      throw error;
    }
  }

  /**
   * Cập nhật thông tin cá nhân
   * Method: PUT
   * Path: /api/users/me/profile
   */
  static async updateProfile(data: ProfileUpdateRequest): Promise<UserProfile> {
    try {
      const token = this.getToken();
      
      if (!token) {
        throw new Error('Không có token');
      }

      console.log('📤 Sending PUT request to:', `${API_BASE_URL}/users/me/profile`);

      const response = await fetch(`${API_BASE_URL}/users/me/profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        let errorMessage = 'Cập nhật profile thất bại';
        try {
          const error = await response.json();
          errorMessage = error.detail || error.message || errorMessage;
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }
        console.error('❌ Update profile error:', errorMessage);
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ Profile updated:', result);

      return result;
    } catch (error) {
      console.error('❌ Update profile fetch error:', error);
      throw error;
    }
  }

  /**
   * Đổi mật khẩu
   */
  static async changePassword(data: PasswordChangeRequest): Promise<{ message: string }> {
    try {
      const token = this.getToken();
      
      if (!token) {
        throw new Error('Không có token');
      }

      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || error.message || 'Đổi mật khẩu thất bại');
      }

      const result = await response.json();
      console.log('✅ Password changed:', result);

      return result;
    } catch (error) {
      console.error('❌ Change password error:', error);
      throw error;
    }
  }

  /**
   * Lấy thông tin đăng nhập lần cuối
   * Path: GET /api/auth/last-login
   */
  static async getLastLogin(): Promise<LastLogin | null> {
    try {
      const token = this.getToken();
      
      if (!token) {
        throw new Error('Không có token');
      }

      console.log('📤 Fetching last login info from:', `${API_BASE_URL}/auth/last-login`);

      const response = await fetch(`${API_BASE_URL}/auth/last-login`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('📥 Last login response status:', response.status);

      if (!response.ok) {
        if (response.status === 404) {
          console.warn('⚠️ Last login endpoint not available');
          return null;
        }
        const error = await response.json();
        throw new Error(error.detail || error.message || 'Không thể lấy thông tin đăng nhập lần cuối');
      }

      const result = await response.json();
      console.log('✅ Last login info fetched:', result);

      return result as LastLogin;
    } catch (error) {
      console.error('❌ Get last login error:', error);
      return null;
    }
  }
}
