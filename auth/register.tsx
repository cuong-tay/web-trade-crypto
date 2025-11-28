/**
 * Logic xử lý cho trang đăng ký
 */

import { AuthService } from '../services/authService';

const form = document.querySelector('.auth-form') as HTMLFormElement;
const fullnameInput = document.getElementById('fullname') as HTMLInputElement;
const emailInput = document.getElementById('email') as HTMLInputElement;
const passwordInput = document.getElementById('password') as HTMLInputElement;
const confirmPasswordInput = document.getElementById('confirm-password') as HTMLInputElement;
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

const validatePassword = (password: string): { valid: boolean; message?: string } => {
  if (password.length < 8) {
    return { valid: false, message: 'Mật khẩu phải có ít nhất 8 ký tự' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Mật khẩu phải chứa ít nhất 1 chữ hoa' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Mật khẩu phải chứa ít nhất 1 chữ thường' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, message: 'Mật khẩu phải chứa ít nhất 1 số' };
  }
  if (!/[!@#$%^&*]/.test(password)) {
    return { valid: false, message: 'Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt (!@#$%^&*)' };
  }
  return { valid: true };
};

const handleRegister = async (e: Event) => {
  e.preventDefault();

  if (isProcessing) return;

  const fullname = fullnameInput?.value?.trim();
  const email = emailInput?.value?.trim();
  const password = passwordInput?.value?.trim();
  const confirmPassword = confirmPasswordInput?.value?.trim();

  // Validation
  if (!fullname || !email || !password || !confirmPassword) {
    showError('Vui lòng điền tất cả các trường');
    return;
  }

  if (fullname.length < 3 || fullname.length > 100) {
    showError('Tên đầy đủ phải từ 3 đến 100 ký tự');
    return;
  }

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.valid) {
    showError(passwordValidation.message || 'Mật khẩu không hợp lệ');
    return;
  }

  if (password !== confirmPassword) {
    showError('Mật khẩu xác nhận không khớp');
    return;
  }

  console.log('🔄 Đang gửi request register...', { fullname, email });

  isProcessing = true;
  hideError();
  
  if (submitBtn) {
    submitBtn.style.opacity = '0.6';
    submitBtn.style.pointerEvents = 'none';
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Đang tạo tài khoản...';
  }

  try {
    const result = await AuthService.register({
      email,
      username: fullname.toLowerCase().replace(/\s+/g, '_'),
      password,
      confirm_password: confirmPassword,
    });

    console.log('✅ Đăng ký thành công!');
    console.log('User:', result.user);
    console.log('Token:', result.access_token.substring(0, 20) + '...');

    // Redirect tới dashboard
    setTimeout(() => {
      window.location.href = '/index.html';
    }, 500);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Lỗi đăng ký không xác định';
    console.error('❌ Lỗi:', errorMessage);
    showError(errorMessage);

    if (submitBtn) {
      submitBtn.style.opacity = '1';
      submitBtn.style.pointerEvents = 'auto';
      submitBtn.innerHTML = 'Đăng ký';
    }
  } finally {
    isProcessing = false;
  }
};

// Handle form submit
form?.addEventListener('submit', handleRegister);

// Handle button click (vì button là <a> tag)
submitBtn?.addEventListener('click', handleRegister);

// Focus vào fullname input khi load page
fullnameInput?.focus();
