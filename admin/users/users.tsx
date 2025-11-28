import { checkAdminAuth, setupLogoutButton } from '../../utils/authGuard';
import { AdminService } from '../../services/adminService';

// Check admin authentication
checkAdminAuth();

interface User {
  id: string;  // UUID format
  email: string;
  username: string;
  role: 'user' | 'admin';
  status: 'active' | 'inactive' | 'banned';
  created_at: string;
  last_login: string | null;
  email_verified: boolean;
}

let currentPage = 1;
const itemsPerPage = 10;
let allUsers: User[] = [];
let filteredUsers: User[] = [];

// Load Users
const loadUsers = async () => {
  try {
    console.log('👥 Loading users...');
    
    const searchTerm = (document.getElementById('search-input') as HTMLInputElement)?.value || '';
    const statusFilter = (document.getElementById('status-filter') as HTMLSelectElement)?.value || '';
    const roleFilter = (document.getElementById('role-filter') as HTMLSelectElement)?.value || '';
    
    // Fetch users using AdminService
    const data = await AdminService.getUsers({
      page: currentPage,
      limit: itemsPerPage,
      search: searchTerm,
      status: statusFilter,
      role: roleFilter
    }) as any;
    
    allUsers = data.users || [];
    filteredUsers = [...allUsers];
    
    // Get all users for stats
    const statsData = await AdminService.getUsers({ page: 1, limit: 1000 }) as any;
    allUsers = statsData.users || [];
    
    updateStats();
    renderUsersTable();
    
    console.log('✅ Users loaded successfully');
  } catch (error) {
    console.error('❌ Error loading users:', error);
    alert('Failed to load users. Please refresh the page.');
  }
};

// Update Stats
const updateStats = () => {
  const totalUsers = allUsers.length;
  const activeUsers = allUsers.filter(u => u.status === 'active').length;
  const bannedUsers = allUsers.filter(u => u.status === 'banned').length;
  
  const currentMonth = new Date().getMonth();
  const newUsers = allUsers.filter(u => new Date(u.created_at).getMonth() === currentMonth).length;
  
  document.getElementById('total-users-count')!.textContent = totalUsers.toString();
  document.getElementById('active-users-count')!.textContent = activeUsers.toString();
  document.getElementById('new-users-count')!.textContent = newUsers.toString();
  document.getElementById('banned-users-count')!.textContent = bannedUsers.toString();
};

// Render Users Table
const renderUsersTable = () => {
  const tbody = document.getElementById('users-table-body')!;
  
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const pageUsers = filteredUsers.slice(startIdx, endIdx);
  
  if (pageUsers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4">Không có user nào</td></tr>';
    return;
  }
  
  tbody.innerHTML = pageUsers.map(user => `
    <tr>
      <td><input type="checkbox" class="user-checkbox" data-id="${user.id}"></td>
      <td>#${user.id}</td>
      <td>${user.email}</td>
      <td><strong>${user.username}</strong></td>
      <td>
        <span class="badge badge-${user.role === 'admin' ? 'danger' : 'info'}">
          ${user.role === 'admin' ? '👑 Admin' : '👤 User'}
        </span>
      </td>
      <td>${new Date(user.created_at).toLocaleDateString('vi-VN')}</td>
      <td>${user.last_login ? new Date(user.last_login).toLocaleDateString('vi-VN') : 'Chưa login'}</td>
      <td>
        <span class="badge badge-${user.status === 'active' ? 'success' : user.status === 'banned' ? 'danger' : 'warning'}">
          ${user.status === 'active' ? '✅ Active' : user.status === 'banned' ? '🚫 Banned' : '⚠️ Inactive'}
        </span>
      </td>
      <td>
        <div class="btn-group btn-group-sm">
          <button class="btn btn-sm btn-outline-primary view-user-btn" data-id="${user.id}">
            <i class="fa-solid fa-eye"></i>
          </button>
          ${user.status !== 'banned' ? `
            <button class="btn btn-sm btn-outline-danger ban-user-btn" data-id="${user.id}">
              <i class="fa-solid fa-ban"></i>
            </button>
          ` : `
            <button class="btn btn-sm btn-outline-success unban-user-btn" data-id="${user.id}">
              <i class="fa-solid fa-check"></i>
            </button>
          `}
        </div>
      </td>
    </tr>
  `).join('');
  
  // Update showing text
  const total = filteredUsers.length;
  document.getElementById('showing-text')!.textContent = 
    `Showing ${startIdx + 1}-${Math.min(endIdx, total)} of ${total}`;
  
  // Render pagination
  renderPagination();
  
  // Attach event listeners
  attachEventListeners();
};

// Render Pagination
const renderPagination = () => {
  const paginationEl = document.getElementById('pagination')!;
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  
  if (totalPages <= 1) {
    paginationEl.innerHTML = '';
    return;
  }
  
  let html = `
    <button class="btn btn-sm btn-outline-primary ${currentPage === 1 ? 'disabled' : ''}" id="prev-page">
      <i class="fa-solid fa-chevron-left"></i>
    </button>
  `;
  
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      html += `
        <button class="btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-outline-primary'} page-btn" data-page="${i}">
          ${i}
        </button>
      `;
    } else if (i === currentPage - 2 || i === currentPage + 2) {
      html += '<span class="px-2">...</span>';
    }
  }
  
  html += `
    <button class="btn btn-sm btn-outline-primary ${currentPage === totalPages ? 'disabled' : ''}" id="next-page">
      <i class="fa-solid fa-chevron-right"></i>
    </button>
  `;
  
  paginationEl.innerHTML = html;
  
  // Attach pagination listeners
  document.getElementById('prev-page')?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderUsersTable();
    }
  });
  
  document.getElementById('next-page')?.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderUsersTable();
    }
  });
  
  document.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPage = parseInt(btn.getAttribute('data-page')!);
      renderUsersTable();
    });
  });
};

// Attach Event Listeners
const attachEventListeners = () => {
  // View user detail
  document.querySelectorAll('.view-user-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.getAttribute('data-id')!;
      viewUserDetail(userId);
    });
  });
  
  // Ban user
  document.querySelectorAll('.ban-user-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.getAttribute('data-id')!;
      banUser(userId);
    });
  });
  
  // Unban user
  document.querySelectorAll('.unban-user-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const userId = btn.getAttribute('data-id')!;
      unbanUser(userId);
    });
  });
};

// View User Detail
const viewUserDetail = (userId: string) => {
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;
  
  const modalContent = document.getElementById('user-detail-content')!;
  modalContent.innerHTML = `
    <div class="row g-3">
      <div class="col-md-6">
        <p><strong>ID:</strong> #${user.id}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Username:</strong> ${user.username}</p>
        <p><strong>Role:</strong> <span class="badge badge-${user.role === 'admin' ? 'danger' : 'info'}">${user.role}</span></p>
      </div>
      <div class="col-md-6">
        <p><strong>Status:</strong> <span class="badge badge-${user.status === 'active' ? 'success' : user.status === 'banned' ? 'danger' : 'warning'}">${user.status}</span></p>
        <p><strong>Email Verified:</strong> ${user.email_verified ? '✅ Yes' : '❌ No'}</p>
        <p><strong>Created:</strong> ${new Date(user.created_at).toLocaleString('vi-VN')}</p>
        <p><strong>Last Login:</strong> ${user.last_login ? new Date(user.last_login).toLocaleString('vi-VN') : 'Chưa login'}</p>
      </div>
    </div>
  `;
  
  const modal = new (window as any).bootstrap.Modal(document.getElementById('userDetailModal'));
  modal.show();
};

// Ban User
const banUser = async (userId: string) => {
  const reason = prompt('Lý do ban user này:');
  
  // Validate reason
  if (reason === null) return; // User cancelled
  
  if (!reason || reason.trim().length === 0) {
    alert('❌ Lý do ban không được để trống!');
    return;
  }
  
  if (reason.length > 500) {
    alert('❌ Lý do ban quá dài (tối đa 500 ký tự)!');
    return;
  }
  
  if (!confirm(`Bạn chắc chắn muốn ban user này?\n\nLý do: ${reason}`)) return;
  
  try {
    await AdminService.banUser(userId, reason.trim());
    
    alert('✅ User đã bị ban thành công!');
    await loadUsers(); // Reload users list
  } catch (error: any) {
    console.error('Error banning user:', error);
    alert(`❌ Ban user thất bại: ${error.message || 'Unknown error'}`);
  }
};

// Unban User
const unbanUser = async (userId: string) => {
  if (!confirm('Bạn chắc chắn muốn unban user này?')) return;
  
  try {
    await AdminService.unbanUser(userId);
    
    alert('✅ User đã được unban thành công!');
    await loadUsers(); // Reload users list
  } catch (error: any) {
    console.error('Error unbanning user:', error);
    alert(`❌ Unban user thất bại: ${error.message || 'Unknown error'}`);
  }
};

// Apply Filter
const applyFilter = () => {
  const searchTerm = (document.getElementById('search-input') as HTMLInputElement).value.toLowerCase();
  const statusFilter = (document.getElementById('status-filter') as HTMLSelectElement).value;
  const roleFilter = (document.getElementById('role-filter') as HTMLSelectElement).value;
  
  filteredUsers = allUsers.filter(user => {
    const matchSearch = !searchTerm || 
      user.email.toLowerCase().includes(searchTerm) || 
      user.username.toLowerCase().includes(searchTerm) ||
      user.id.toString().includes(searchTerm);
    
    const matchStatus = !statusFilter || user.status === statusFilter;
    const matchRole = !roleFilter || user.role === roleFilter;
    
    return matchSearch && matchStatus && matchRole;
  });
  
  currentPage = 1;
  renderUsersTable();
};

// Export CSV
const exportCSV = () => {
  const csv = [
    ['ID', 'Email', 'Username', 'Role', 'Status', 'Created', 'Last Login'].join(','),
    ...filteredUsers.map(user => [
      user.id,
      user.email,
      user.username,
      user.role,
      user.status,
      user.created_at,
      user.last_login || 'N/A'
    ].join(','))
  ].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
};

// Add User Handler
const handleAddUser = async () => {
  const email = (document.getElementById('new-email') as HTMLInputElement).value;
  const username = (document.getElementById('new-username') as HTMLInputElement).value;
  const password = (document.getElementById('new-password') as HTMLInputElement).value;
  const confirmPassword = (document.getElementById('new-confirm-password') as HTMLInputElement).value;

  // Validation
  if (!email || !username || !password || !confirmPassword) {
    alert('Vui lòng điền đầy đủ thông tin!');
    return;
  }

  if (password !== confirmPassword) {
    alert('Mật khẩu xác nhận không khớp!');
    return;
  }

  if (password.length < 6) {
    alert('Mật khẩu phải có ít nhất 6 ký tự!');
    return;
  }

  try {
    console.log('➕ Creating new user...');
    
    await AdminService.createUser({
      email,
      username,
      password,
      confirm_password: confirmPassword
    });

    console.log('✅ User created successfully');
    alert('✅ Tạo user thành công!');

    // Close modal and reset form
    const modal = (window as any).bootstrap.Modal.getInstance(document.getElementById('addUserModal'));
    modal?.hide();
    (document.getElementById('add-user-form') as HTMLFormElement).reset();

    // Reload users list
    await loadUsers();
  } catch (error: any) {
    console.error('❌ Create user error:', error);
    alert(`❌ Tạo user thất bại: ${error.message}`);
  }
};

// Event Listeners
document.getElementById('apply-filter-btn')?.addEventListener('click', applyFilter);
document.getElementById('search-input')?.addEventListener('keyup', (e) => {
  if ((e as KeyboardEvent).key === 'Enter') applyFilter();
});
document.getElementById('export-btn')?.addEventListener('click', exportCSV);
document.getElementById('add-user-btn')?.addEventListener('click', () => {
  const modal = new (window as any).bootstrap.Modal(document.getElementById('addUserModal'));
  modal.show();
});
document.getElementById('confirm-add-user-btn')?.addEventListener('click', handleAddUser);

// Setup logout button (đồng bộ từ authGuard)
setupLogoutButton('#logout-btn');

// Load admin name
const user = JSON.parse(localStorage.getItem('user') || '{}');
const adminNameEl = document.getElementById('admin-name');
if (adminNameEl) {
  adminNameEl.textContent = user.username || 'Admin';
}

// Initialize
document.addEventListener('DOMContentLoaded', loadUsers);
