/**
 * Authentication Guard - Bảo vệ các trang yêu cầu đăng nhập
 */

import { AuthService } from '../services/authService';

export interface UserData {
  id: string;
  email: string;
  username: string;
  role: string;
  status: string;
  email_verified: boolean;
  created_at: string;
  last_login: string;
}

/**
 * Guard để bảo vệ page - redirect nếu chưa đăng nhập
 */
export const authGuard = (): UserData | null => {
  const token = localStorage.getItem('access_token');
  const userData = localStorage.getItem('user');
  
  if (!token || !userData) {
    console.log('❌ Auth guard failed: No token/user found');
    window.location.href = '/login.html';
    return null;
  }
  
  try {
    const user = JSON.parse(userData) as UserData;
    console.log('✅ Auth guard passed for user:', user.username);
    return user;
  } catch (error) {
    console.error('Error parsing user data:', error);
    window.location.href = '/login.html';
    return null;
  }
};

/**
 * Lấy thông tin user từ localStorage
 */
export const getCurrentUser = (): UserData | null => {
  const userData = localStorage.getItem('user');
  return userData ? (JSON.parse(userData) as UserData) : null;
};

/**
 * Lấy access token
 */
export const getAccessToken = (): string | null => {
  return localStorage.getItem('access_token');
};

/**
 * Kiểm tra user đã authenticated
 */
export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('access_token');
};

/**
 * Update username display trong header
 */
export const updateUserDisplay = (selector: string = '.user-profile span'): void => {
  const user = getCurrentUser();
  if (user) {
    const element = document.querySelector(selector);
    if (element) {
      element.textContent = user.username || user.email;
      console.log('✅ Updated user display:', user.username);
    }
  }
};

/**
 * Setup auth guard cho một page - gọi từ DOMContentLoaded
 */
export const setupPageGuard = (selector: string = '.user-profile span'): UserData | null => {
  const user = authGuard();
  if (user) {
    updateUserDisplay(selector);
  }
  return user;
};

/**
 * Setup logout button - với xác nhận
 */
export const setupLogoutButton = (buttonSelector: string = '#logout-btn'): void => {
  const logoutBtn = document.querySelector(buttonSelector) as HTMLElement;
  
  if (logoutBtn) {
    // Clone node để remove tất cả event listeners cũ
    const newLogoutBtn = logoutBtn.cloneNode(true) as HTMLElement;
    logoutBtn.parentNode?.replaceChild(newLogoutBtn, logoutBtn);
    
    // Add new listener
    newLogoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      
      // Hiển thị confirm dialog
      const confirmed = confirm('Bạn chắc chắn muốn đăng xuất?');
      
      if (confirmed) {
        try {
          await AuthService.logout();
          window.location.href = '/login.html';
        } catch (error) {
          console.error('❌ Logout error:', error);
          localStorage.clear();
          window.location.href = '/login.html';
        }
      }
    });
    
    console.log('✅ Logout button setup');
  }
};

/**
 * Complete setup cho protected page
 */
export const setupProtectedPage = (logoutButtonSelector: string = '#logout-btn'): UserData | null => {
  const user = setupPageGuard();
  setupLogoutButton(logoutButtonSelector);
  return user;
};

/**
 * Check Admin Authentication
 * Redirect to login if not authenticated or not admin
 */
export const checkAdminAuth = (): boolean => {
  console.log('🔐 Checking admin authentication...');
  const token = localStorage.getItem('access_token');
  const user = localStorage.getItem('user');
  
  if (!token || !user) {
    console.log('❌ No token or user, redirecting to login...');
    window.location.href = '/login.html';
    return false;
  }

  try {
    const userData = JSON.parse(user) as UserData;
    
    // Check if user is admin
    if (userData.role !== 'admin') {
      console.log('❌ User is not admin, redirecting to dashboard...');
      alert('⚠️ Bạn không có quyền truy cập admin panel');
      window.location.href = '/index.html';
      return false;
    }

    console.log('✅ Admin authenticated:', userData.username);
    return true;
  } catch (error) {
    console.error('❌ Error checking admin auth:', error);
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
    return false;
  }
};
