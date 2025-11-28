/**
 * Logic xử lý cho trang đăng nhập
 */

import { AuthService } from '../services/authService';
import { WalletService } from '../services/walletService';

const form = document.querySelector('.auth-form') as HTMLFormElement;
const emailInput = document.getElementById('email') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const submitBtn = document.querySelector('a.btn-submit') as HTMLAnchorElement;
const errorDiv = document.querySelector('.error-message') as HTMLDivElement;

let isProcessing = false;

const showError = (message: string) => {
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
  } else {
    alert(message);
  }
};

const hideError = () => {
  if (errorDiv) {
    errorDiv.style.display = 'none';
  }
};

const handleLogin = async (e: Event) => {
  e.preventDefault();

  if (isProcessing) return;

  const email = emailInput?.value?.trim();
  const password = passwordInput?.value?.trim();

  if (!email || !password) {
    showError('Vui lòng nhập email và mật khẩu');
    return;
  }

  console.log('🔄 Đang gửi request login...', { email });

  isProcessing = true;
  hideError();
  
  if (submitBtn) {
    submitBtn.style.opacity = '0.6';
    submitBtn.style.pointerEvents = 'none';
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Đang đăng nhập...';
  }

  try {
    const result = await AuthService.login({
      email,
      password,
    });

    console.log('✅ Đăng nhập thành công!');
    console.log('User:', result.user);
    console.log('Token:', result.access_token.substring(0, 20) + '...');
    
    // Check if user is banned after successful login
    if (result.user.status === 'banned') {
      const shouldRedirect = confirm(
        `⚠️ TÀI KHOẢN BỊ KHÓA\n\nTài khoản của bạn đã bị khóa.\nBạn chỉ có thể xem thông tin, không thể giao dịch.\n\nBạn có muốn liên hệ hỗ trợ ngay không?`
      );
      
      if (shouldRedirect) {
        window.location.href = '/support.html?reason=banned';
        return;
      }
      // Continue to dashboard even if user declined
    }

    // Show loading wallet message
    if (submitBtn) {
      submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Đang tải ví...';
    }

    // Fetch wallet data BEFORE redirecting
    try {
      console.log('📊 Fetching wallet data from API...');
      
      const response = await WalletService.getBalances();
      console.log('💰 Wallet API Response:', response);
      
      // Try different response formats
      let balances = (response as any).spot || [];
      
      if (balances.length === 0 && Array.isArray(response)) {
        balances = response as any;
      }
      
      if (balances.length === 0 && (response as any).wallets && Array.isArray((response as any).wallets)) {
        balances = (response as any).wallets;
      }
      
      if (balances.length === 0 && (response as any).balances && Array.isArray((response as any).balances)) {
        balances = (response as any).balances;
      }

      // Save wallet data to localStorage
      const balancesForStorage = balances.map((asset: any) => {
        // If available is undefined/null, use total instead
        const available = asset.available !== undefined && asset.available !== null 
          ? parseFloat(String(asset.available)) 
          : parseFloat(String(asset.total || 0));
        const locked = asset.locked !== undefined && asset.locked !== null
          ? parseFloat(String(asset.locked))
          : parseFloat(String(asset.locked_balance || 0));
        const total = parseFloat(String(asset.total || asset.balance || 0));
        
        console.log(`[login] Mapping ${asset.coin}: available=${available}, locked=${locked}, total=${total}`);
        
        return {
          coin: asset.coin || asset.currency,
          available: available || 0,
          locked: locked || 0,
          total: total || 0,
          price: asset.price || 0,
          usdValue: asset.usdValue || 0
        };
      });

      localStorage.setItem('walletData', JSON.stringify(balancesForStorage));
      console.log('✅ Wallet data saved:', balancesForStorage.length, 'assets');
    } catch (walletError) {
      console.warn('⚠️ Could not fetch wallet data:', walletError);
    }

    // Determine redirect URL based on user role
    let redirectUrl = '/index.html';
    if (result.user.role === 'admin') {
      redirectUrl = '/admin/admin-dashboard.html';
    }

    // Redirect after wallet is loaded
    console.log('🔄 Redirecting to:', redirectUrl);
    window.location.href = redirectUrl;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Lỗi đăng nhập không xác định';
    console.error('❌ Lỗi:', errorMessage);
    
    // Check if account is banned
    if (errorMessage.includes('khóa') || errorMessage.includes('banned')) {
      const shouldRedirect = confirm(
        `⛔ TÀI KHOẢN BỊ KHÓA\n\n${errorMessage}\n\nBạn có muốn liên hệ hỗ trợ không?`
      );
      
      if (shouldRedirect) {
        window.location.href = '/support.html?reason=banned';
        return;
      }
    }
    
    showError(errorMessage);

    if (submitBtn) {
      submitBtn.style.opacity = '1';
      submitBtn.style.pointerEvents = 'auto';
      submitBtn.innerHTML = 'Đăng nhập';
    }
  } finally {
    isProcessing = false;
  }
};

// Handle form submit
form?.addEventListener('submit', handleLogin);

// Handle button click (vì button là <a> tag)
submitBtn?.addEventListener('click', handleLogin);

// Focus vào email input khi load page
emailInput?.focus();
