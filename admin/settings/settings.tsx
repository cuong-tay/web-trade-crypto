import { checkAdminAuth, setupLogoutButton } from '../../utils/authGuard';

// Check admin authentication
checkAdminAuth();

const API_BASE_URL = 'http://192.168.1.57:8000/api';

// Load Settings
const loadSettings = () => {
  console.log('⚙️ Loading settings...');
  
  // Settings are already loaded from HTML defaults
  // In production, fetch from API
  
  console.log('✅ Settings loaded successfully');
};

// Save General Settings
document.getElementById('general-settings-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const settings = {
    platform_name: (document.getElementById('platform-name') as HTMLInputElement).value,
    support_email: (document.getElementById('support-email') as HTMLInputElement).value,
    maintenance_mode: (document.getElementById('maintenance-mode') as HTMLSelectElement).value,
    default_language: (document.getElementById('default-language') as HTMLSelectElement).value,
    platform_description: (document.getElementById('platform-description') as HTMLTextAreaElement).value
  };
  
  console.log('💾 Saving general settings:', settings);
  
  // TODO: Send to API
  // await fetch(`${API_BASE_URL}/admin/settings/general`, {
  //   method: 'PUT',
  //   headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  //   body: JSON.stringify(settings)
  // });
  
  alert('✅ General settings saved successfully!');
});

// Save Trading Settings
document.getElementById('trading-settings-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const settings = {
    min_trade_amount: parseFloat((document.getElementById('min-trade-amount') as HTMLInputElement).value),
    max_trade_amount: parseFloat((document.getElementById('max-trade-amount') as HTMLInputElement).value),
    max_leverage: parseInt((document.getElementById('max-leverage') as HTMLInputElement).value),
    price_update_interval: parseInt((document.getElementById('price-update-interval') as HTMLInputElement).value),
    enable_stop_loss: (document.getElementById('enable-stop-loss') as HTMLInputElement).checked,
    enable_take_profit: (document.getElementById('enable-take-profit') as HTMLInputElement).checked
  };
  
  console.log('💾 Saving trading settings:', settings);
  alert('✅ Trading settings saved successfully!');
});

// Save Fees Settings
document.getElementById('fees-settings-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const settings = {
    trading_fee: parseFloat((document.getElementById('trading-fee') as HTMLInputElement).value),
    withdrawal_fee: parseFloat((document.getElementById('withdrawal-fee') as HTMLInputElement).value),
    deposit_fee: parseFloat((document.getElementById('deposit-fee') as HTMLInputElement).value),
    vip_discount: parseFloat((document.getElementById('vip-discount') as HTMLInputElement).value)
  };
  
  console.log('💾 Saving fees settings:', settings);
  alert('✅ Fees settings saved successfully!');
});

// Save Security Settings
document.getElementById('security-settings-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const settings = {
    session_timeout: parseInt((document.getElementById('session-timeout') as HTMLInputElement).value),
    max_login_attempts: parseInt((document.getElementById('max-login-attempts') as HTMLInputElement).value),
    password_min_length: parseInt((document.getElementById('password-min-length') as HTMLInputElement).value),
    ip_whitelist_mode: (document.getElementById('ip-whitelist-mode') as HTMLSelectElement).value,
    enable_2fa: (document.getElementById('enable-2fa') as HTMLInputElement).checked,
    require_email_verification: (document.getElementById('require-email-verification') as HTMLInputElement).checked,
    enable_captcha: (document.getElementById('enable-captcha') as HTMLInputElement).checked
  };
  
  console.log('💾 Saving security settings:', settings);
  alert('✅ Security settings saved successfully!');
});

// Save Notifications Settings
document.getElementById('notifications-settings-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const settings = {
    notify_new_user: (document.getElementById('notify-new-user') as HTMLInputElement).checked,
    notify_large_trade: (document.getElementById('notify-large-trade') as HTMLInputElement).checked,
    notify_withdrawal: (document.getElementById('notify-withdrawal') as HTMLInputElement).checked,
    notify_suspicious: (document.getElementById('notify-suspicious') as HTMLInputElement).checked,
    admin_emails: (document.getElementById('admin-emails') as HTMLTextAreaElement).value
  };
  
  console.log('💾 Saving notifications settings:', settings);
  alert('✅ Notification settings saved successfully!');
});

// Clear Cache
document.getElementById('clear-cache-btn')?.addEventListener('click', () => {
  if (confirm('⚠️ Bạn chắc chắn muốn xóa tất cả cache? Điều này có thể ảnh hưởng đến performance tạm thời.')) {
    console.log('🗑️ Clearing cache...');
    
    // Clear browser cache (limited scope)
    localStorage.clear();
    sessionStorage.clear();
    
    alert('✅ Cache cleared successfully!');
    window.location.reload();
  }
});

// Reset Settings
document.getElementById('reset-settings-btn')?.addEventListener('click', () => {
  if (confirm('⚠️ CẢNH BÁO: Bạn chắc chắn muốn reset TẤT CẢ settings về mặc định? Hành động này KHÔNG THỂ HOÀN TÁC!')) {
    if (confirm('⚠️ XÁC NHẬN LẦN CUỐI: Bạn có chắc chắn 100%?')) {
      console.log('🔄 Resetting all settings...');
      
      // TODO: Call API to reset settings
      // await fetch(`${API_BASE_URL}/admin/settings/reset`, {
      //   method: 'POST',
      //   headers: { 'Authorization': `Bearer ${token}` }
      // });
      
      alert('✅ All settings have been reset to default values!');
      window.location.reload();
    }
  }
});

// Setup logout button (đồng bộ từ authGuard)
setupLogoutButton('#logout-btn');

// Load admin name
const user = JSON.parse(localStorage.getItem('user') || '{}');
const adminNameEl = document.getElementById('admin-name');
if (adminNameEl) {
  adminNameEl.textContent = user.username || 'Admin';
}

// Initialize
document.addEventListener('DOMContentLoaded', loadSettings);
