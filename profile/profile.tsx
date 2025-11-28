/**
 * Profile Page Logic
 * Tích hợp API authentication
 */

import { AuthService, type UserDetail, type ProfileUpdateRequest, type PasswordChangeRequest, type LastLogin } from '../services/authService';
import { setupProtectedPage, setupLogoutButton, getCurrentUser, type UserData } from '../utils/authGuard';
import { API_BASE_URL } from '../config/api';

let isEditing = false;
let currentUser: UserData | null = null;

// Load user data khi trang tải
async function loadUserData() {
  try {
    // Get current user from localStorage (already loaded by setupProtectedPage)
    const user = getCurrentUser();
    if (!user) {
      throw new Error('User not found');
    }
    
    console.log('✓ User data loaded:', user);

    // Get profile from API if available, otherwise use defaults
    let profile = {
      display_name: user.username || user.email,
      phone: '',
      notify_email: true,
      notify_push: true,
      language: 'vi',
      default_currency: 'VND'
    };

    currentUser = user;

    // Cập nhật UI với user data
    // Update header
    const profileMeta = document.querySelector('.profile-meta h2') as HTMLElement;
    if (profileMeta) profileMeta.textContent = profile.display_name || user.username;

    const profileEmail = document.querySelector('.profile-email') as HTMLElement;
    if (profileEmail) profileEmail.textContent = user.email;

    // Update form fields
    const fullnameInput = document.getElementById('fullname') as HTMLInputElement;
    if (fullnameInput) fullnameInput.value = profile.display_name;

    const emailInput = document.getElementById('email') as HTMLInputElement;
    if (emailInput) emailInput.value = user.email;

    const phoneInput = document.getElementById('phone') as HTMLInputElement;
    if (phoneInput) phoneInput.value = profile.phone || '';

    // Update preferences
    const notifyEmailToggle = document.querySelector('input[type="checkbox"]:not(#dark-mode-toggle)') as HTMLInputElement;
    if (notifyEmailToggle) notifyEmailToggle.checked = profile.notify_email;

    const notifyPushToggles = document.querySelectorAll('input[type="checkbox"]');
    if (notifyPushToggles[1]) (notifyPushToggles[1] as HTMLInputElement).checked = profile.notify_push;

    const languageSelect = document.querySelector('.form-select-sm') as HTMLSelectElement;
    if (languageSelect) languageSelect.value = profile.language;

    const currencySelect = document.querySelectorAll('.form-select-sm')[1] as HTMLSelectElement;
    if (currencySelect) currencySelect.value = profile.default_currency;
  } catch (error) {
    console.error('✗ Lỗi tải user data:', error);
    const errorMsg = error instanceof Error ? error.message : 'Lỗi không xác định';
    console.error('✗ Chi tiết lỗi:', errorMsg);
    alert(`Phiên đăng nhập hết hạn hoặc có lỗi khi tải dữ liệu: ${errorMsg}`);
    window.location.href = '/login.html';
  }
}

const toggleEditPersonal = () => {
  isEditing = !isEditing;

  const inputs = ['fullname', 'email', 'phone', 'birthdate', 'country'];
  const editBtn = document.getElementById('edit-personal-btn');
  const actions = document.getElementById('personal-actions');

  inputs.forEach((id) => {
    const input = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
    if (input) {
      input.disabled = !isEditing;
    }
  });

  if (editBtn && actions) {
    if (isEditing) {
      editBtn.style.display = 'none';
      actions.style.display = 'flex';
    } else {
      editBtn.style.display = 'inline-flex';
      actions.style.display = 'none';
    }
  }
};

const savePersonalInfo = async () => {
  const fullname = (document.getElementById('fullname') as HTMLInputElement).value;
  const phone = (document.getElementById('phone') as HTMLInputElement).value;

  if (!fullname) {
    alert('Tên không được để trống');
    return;
  }

  try {
    const updateData: ProfileUpdateRequest = {
      display_name: fullname,
      phone: phone || undefined,
    };

    const updated = await AuthService.updateProfile(updateData);
    console.log('✓ Profile updated:', updated);

    alert('Thông tin đã được cập nhật thành công!');

    // Cập nhật currentUser (remove profile property since UserData doesn't have it)
    // Profile data will be reloaded on next page load

    toggleEditPersonal();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Lỗi cập nhật';
    console.error('✗ Lỗi:', errorMessage);
    alert(errorMessage);
  }
};

const cancelEdit = () => {
  // Reload user data to restore original values
  loadUserData();
  toggleEditPersonal();
};

// Load and display login history
const loadLoginHistory = async () => {
  try {
    console.log('📥 Loading last login info...');
    const lastLogin = await AuthService.getLastLogin();
    
    if (!lastLogin) {
      console.warn('⚠️ No last login info available');
      return;
    }

    console.log('✅ Last login info loaded:', lastLogin);

    // Find and update the security item for login history
    const securityItems = document.querySelectorAll('.security-item');
    securityItems.forEach((item) => {
      const title = item.querySelector('h4')?.textContent;
      if (title === 'Lịch sử đăng nhập') {
        const pElement = item.querySelector('p');
        if (pElement) {
          // Update with time_ago from API
          pElement.textContent = `Lần cuối: ${lastLogin.time_ago}`;
        }
      }
    });

    // Store for detail view
    (window as any).lastLogin = lastLogin;
    console.log('✅ Last login UI updated');
  } catch (error) {
    console.error('❌ Error loading last login info:', error);
  }
};

// Show last login details
const showLoginHistoryDetail = () => {
  const lastLogin: LastLogin = (window as any).lastLogin;
  
  if (!lastLogin) {
    alert('Không có thông tin đăng nhập');
    return;
  }

  const detailText = `📱 THÔNG TIN ĐĂNG NHẬP LẦN CUỐI\n\n` +
    `⏰ Thời gian: ${lastLogin.formatted}\n` +
    `⌚ ${lastLogin.time_ago}`;

  alert(detailText);
};

// Change Password
const handleChangePassword = () => {
  const currentPassword = prompt('Nhập mật khẩu hiện tại:');
  if (!currentPassword) return;

  const newPassword = prompt('Nhập mật khẩu mới:');
  if (!newPassword) return;

  const confirmPassword = prompt('Xác nhận mật khẩu mới:');
  if (!confirmPassword) return;

  if (newPassword !== confirmPassword) {
    alert('Mật khẩu xác nhận không khớp');
    return;
  }

  changePassword(currentPassword, newPassword, confirmPassword);
};

const changePassword = async (currentPassword: string, newPassword: string, confirmPassword: string) => {
  try {
    const data: PasswordChangeRequest = {
      current_password: currentPassword,
      new_password: newPassword,
      confirm_new_password: confirmPassword,
    };

    const result = await AuthService.changePassword(data);
    console.log('✓ Password changed:', result);
    alert('Mật khẩu đã được thay đổi thành công!');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Lỗi đổi mật khẩu';
    console.error('✗ Lỗi:', errorMessage);
    alert(errorMessage);
  }
};

// Avatar Upload
const handleAvatarChange = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';

  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      try {
        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
          alert('Kích thước file quá lớn (tối đa 5MB)');
          return;
        }

        // Show loading state
        const editAvatarBtn = document.querySelector('.btn-edit-avatar');
        if (editAvatarBtn) editAvatarBtn.textContent = 'Đang tải...';

        // Upload to server
        const formData = new FormData();
        formData.append('file', file);

        const token = localStorage.getItem('access_token');
        const response = await fetch(`${API_BASE_URL}/users/me/avatar`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        console.log('📥 Avatar response status:', response.status);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Lỗi upload avatar`);
        }

        // Parse JSON response
        const data = await response.json();
        console.log('✅ Avatar response data:', data);
        console.log('Avatar URL từ backend:', data.avatar_url);

        // Update UI with avatar URL from server
        let avatarUrl = data.avatar_url;
        if (!avatarUrl) {
          console.error('❌ Backend trả về:', JSON.stringify(data));
          throw new Error('Backend không trả về avatar_url. Response: ' + JSON.stringify(data));
        }

        // Nếu backend trả về đường dẫn tương đối, thêm domain vào
        if (avatarUrl.startsWith('/')) {
          const baseUrl = API_BASE_URL.replace('/api', '');
          avatarUrl = `${baseUrl}${avatarUrl}`;
          console.log('🔗 Chuyển đổi URL từ tương đối thành:', avatarUrl);
        }

        console.log('🖼️ Cập nhật UI với URL:', avatarUrl);
        const avatars = document.querySelectorAll('.profile-avatar, .user-profile img');
        avatars.forEach((avatar) => {
          console.log('Cập nhật avatar từ:', (avatar as HTMLImageElement).src, '→', avatarUrl);
          (avatar as HTMLImageElement).src = avatarUrl;
        });

        alert('Avatar đã được cập nhật thành công!');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Lỗi upload avatar';
        console.error('❌ Avatar upload error:', errorMsg);
        alert(`Lỗi: ${errorMsg}`);
      } finally {
        const editAvatarBtn = document.querySelector('.btn-edit-avatar');
        if (editAvatarBtn) editAvatarBtn.textContent = '✏️ Sửa';
      }
    }
  };

  input.click();
};

// Cover Upload
const handleCoverChange = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';

  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      try {
        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
          alert('Kích thước file quá lớn (tối đa 5MB)');
          return;
        }

        // Show loading state
        const editCoverBtn = document.querySelector('.btn-edit-cover');
        if (editCoverBtn) editCoverBtn.textContent = 'Đang tải...';

        // Upload to server
        const formData = new FormData();
        formData.append('file', file);

        const token = localStorage.getItem('access_token');
        const response = await fetch(`${API_BASE_URL}/users/me/cover`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        console.log('📥 Cover response status:', response.status);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Lỗi upload cover`);
        }

        // Parse JSON response
        const data = await response.json();
        console.log('✅ Cover response data:', data);
        console.log('Cover URL từ backend:', data.cover_url);

        // Update UI with cover URL from server
        let coverUrl = data.cover_url;
        if (!coverUrl) {
          console.error('❌ Backend trả về:', JSON.stringify(data));
          throw new Error('Backend không trả về cover_url. Response: ' + JSON.stringify(data));
        }

        // Nếu backend trả về đường dẫn tương đối, thêm domain vào
        if (coverUrl.startsWith('/')) {
          const baseUrl = API_BASE_URL.replace('/api', '');
          coverUrl = `${baseUrl}${coverUrl}`;
          console.log('🔗 Chuyển đổi URL từ tương đối thành:', coverUrl);
        }

        console.log('🖼️ Cập nhật UI với URL:', coverUrl);
        const cover = document.querySelector('.profile-cover') as HTMLElement;
        if (cover) {
          console.log('Cập nhật cover backgroundImage');
          cover.style.backgroundImage = `url(${coverUrl})`;
          cover.style.backgroundSize = 'cover';
          cover.style.backgroundPosition = 'center';
        }

        alert('Cover đã được cập nhật thành công!');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Lỗi upload cover';
        console.error('❌ Cover upload error:', errorMsg);
        alert(`Lỗi: ${errorMsg}`);
      } finally {
        const editCoverBtn = document.querySelector('.btn-edit-cover');
        if (editCoverBtn) editCoverBtn.textContent = '✏️ Sửa';
      }
    }
  };

  input.click();
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Setup auth guard first
  const user = setupProtectedPage();
  
  if (!user) {
    return;
  }
  
  console.log('👤 Profile loaded for user:', user.username);
  
  // Setup logout button
  setupLogoutButton('#logout-btn');

  // Load user data
  await loadUserData();

  // Load login history
  await loadLoginHistory();

  // Personal info edit
  const editBtn = document.getElementById('edit-personal-btn');
  const saveBtn = document.getElementById('save-personal-btn');
  const cancelBtn = document.getElementById('cancel-personal-btn');

  editBtn?.addEventListener('click', toggleEditPersonal);
  saveBtn?.addEventListener('click', savePersonalInfo);
  cancelBtn?.addEventListener('click', cancelEdit);

  // Avatar and cover upload
  const editAvatarBtn = document.querySelector('.btn-edit-avatar');
  const editCoverBtn = document.querySelector('.btn-edit-cover');

  editAvatarBtn?.addEventListener('click', handleAvatarChange);
  editCoverBtn?.addEventListener('click', handleCoverChange);

  // Security items
  const securityItems = document.querySelectorAll('.security-item .btn-link');
  securityItems.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const parent = (btn as HTMLElement).closest('.security-item');
      const title = parent?.querySelector('h4')?.textContent;

      if (title === 'Mật khẩu') {
        handleChangePassword();
      } else if (title === 'Lịch sử đăng nhập') {
        showLoginHistoryDetail();
      } else {
        alert(`Chức năng "${title}" sẽ được cập nhật sau`);
      }
    });
  });

  // Verification items
  const verificationBtns = document.querySelectorAll('.verification-item .btn-link');
  verificationBtns.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      alert('Chức năng xác minh KYC Level 2 sẽ được cập nhật sau');
    });
  });

  // Notification toggles
  const notificationToggles = document.querySelectorAll('.preference-item input[type="checkbox"]');
  notificationToggles.forEach((toggle) => {
    if (toggle.id !== 'dark-mode-toggle') {
      toggle.addEventListener('change', async (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        const parent = (toggle as HTMLElement).closest('.preference-item');
        const title = parent?.querySelector('h4')?.textContent;
        console.log(`${title}: ${checked ? 'Bật' : 'Tắt'}`);

        // Update API
        try {
          const updateData: ProfileUpdateRequest = {};
          if (title === 'Thông báo Email') {
            updateData.notify_email = checked;
          } else if (title === 'Thông báo Push') {
            updateData.notify_push = checked;
          }

          if (Object.keys(updateData).length > 0) {
            await AuthService.updateProfile(updateData);
            console.log('✓ Preferences updated');
          }
        } catch (error) {
          console.error('✗ Lỗi cập nhật preferences:', error);
        }
      });
    }
  });

  // Language and currency selects
  const selects = document.querySelectorAll('.form-select-sm');
  selects.forEach((select) => {
    select.addEventListener('change', async (e) => {
      const value = (e.target as HTMLSelectElement).value;
      const parent = (select as HTMLElement).closest('.preference-item');
      const title = parent?.querySelector('h4')?.textContent;
      console.log(`${title} changed to: ${value}`);

      try {
        const updateData: ProfileUpdateRequest = {};
        if (title === 'Ngôn ngữ') {
          updateData.language = value;
        } else if (title === 'Đơn vị tiền tệ') {
          updateData.default_currency = value;
        }

        if (Object.keys(updateData).length > 0) {
          await AuthService.updateProfile(updateData);
          console.log('✓ Settings updated');
        }
      } catch (error) {
        console.error('✗ Lỗi cập nhật settings:', error);
      }
    });
  });
});
