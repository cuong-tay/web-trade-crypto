/**
 * Banned User Handler - Global utility for handling 403 Forbidden responses
 * 
 * Usage:
 * - Import handleBannedUser in services
 * - Call it when response.status === 403
 */

export interface BannedUserError {
  isBanned: boolean;
  message: string;
  shouldShowModal: boolean;
}

/**
 * Check if error is a banned user error (403 with specific message)
 */
export function isBannedUserError(response: Response, errorData?: any): boolean {
  if (response.status !== 403) return false;
  
  const detail = errorData?.detail || '';
  return detail.includes('khóa') || detail.includes('banned') || detail.includes('⛔');
}

/**
 * Handle banned user - Show modal and redirect to support
 */
export function handleBannedUser(message: string): void {
  console.warn('⛔ User account is banned:', message);
  
  // Show alert modal
  const shouldRedirect = confirm(
    `⛔ TÀI KHOẢN BỊ KHÓA\n\n${message}\n\nBạn có muốn liên hệ support không?`
  );
  
  if (shouldRedirect) {
    // Redirect to support page (create if not exists)
    window.location.href = '/support.html';
  }
}

/**
 * Show banned user banner on page
 */
export function showBannedBanner(message: string): void {
  // Check if banner already exists
  if (document.getElementById('banned-user-banner')) return;
  
  const banner = document.createElement('div');
  banner.id = 'banned-user-banner';
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 9999;
    background: #fff3cd;
    border-bottom: 2px solid #ffc107;
    padding: 12px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  `;
  
  banner.innerHTML = `
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 20px;">⛔</span>
      <span style="color: #856404; font-weight: 500;">${message}</span>
    </div>
    <a href="/support.html" style="
      padding: 6px 16px;
      background: #ffc107;
      color: #000;
      border-radius: 4px;
      text-decoration: none;
      font-weight: 500;
    ">Liên Hệ Support</a>
  `;
  
  document.body.prepend(banner);
  
  // Add padding to body to prevent content from being hidden
  document.body.style.paddingTop = '60px';
}

/**
 * Check user status and show banner if banned
 */
export async function checkAndShowBannedStatus(): Promise<boolean> {
  try {
    const token = localStorage.getItem('access_token');
    if (!token) return false;
    
    const response = await fetch('http://localhost:8000/api/auth/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const userData = await response.json();
      const userStatus = userData.status || userData.user?.status;
      
      if (userStatus === 'banned') {
        showBannedBanner('Tài khoản của bạn đã bị khóa. Bạn chỉ có thể xem thông tin.');
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking user status:', error);
    return false;
  }
}

/**
 * Disable trading buttons for banned users
 */
export function disableTradingButtons(): void {
  // Disable all trading action buttons
  const tradingButtons = document.querySelectorAll(
    '.order-btn, .close-position-btn, .cancel-order-btn, [data-trading-action]'
  );
  
  tradingButtons.forEach((btn) => {
    if (btn instanceof HTMLButtonElement) {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      btn.title = 'Tài khoản bị khóa - Không thể giao dịch';
      
      // Update button text if contains "Đặt lệnh" or similar
      if (btn.textContent?.includes('Đặt lệnh') || btn.textContent?.includes('Mua') || btn.textContent?.includes('Bán')) {
        btn.textContent = '⛔ Tài khoản bị khóa';
      }
    }
  });
}

/**
 * Parse error response and handle banned user
 * Returns true if user is banned, false otherwise
 */
export async function checkAndHandleBannedError(
  response: Response
): Promise<boolean> {
  if (response.status !== 403) return false;
  
  try {
    const errorData = await response.json();
    if (isBannedUserError(response, errorData)) {
      handleBannedUser(errorData.detail || 'Tài khoản của bạn đã bị khóa.');
      return true;
    }
  } catch (e) {
    // If can't parse JSON, check if it's banned by status code alone
    if (response.status === 403) {
      handleBannedUser('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ support.');
      return true;
    }
  }
  
  return false;
}
