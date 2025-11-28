import { checkAdminAuth, setupLogoutButton } from '../utils/authGuard';
import { AdminService } from '../services/adminService';

// Check admin authentication
checkAdminAuth();

interface StatData {
  totalUsers: number;
  totalTransactions: number;
  totalRevenue: number;
  activeUsers: number;
  usersChange: number;
  transactionsVolume: number;
  revenueChange: number;
}

// Load Admin Dashboard
const loadAdminDashboard = async () => {
  try {
    console.log('📊 Loading admin dashboard...');
    
    // Fetch stats from API using AdminService
    const stats = await AdminService.getDashboardStats() as any;
    
    // Format numbers with 2 decimal places
    const totalRevenueNum = Number(stats.totalRevenue);
    const totalRevenueStr = totalRevenueNum.toFixed(2);
    const usersChangeNum = Number(stats.usersChange);
    const transactionsVolumeNum = Number(stats.transactionsVolume);
    const revenueChangeNum = Number(stats.revenueChange);
    
    const usersChangeStr = usersChangeNum.toFixed(2);
    const transactionsVolumeStr = transactionsVolumeNum.toFixed(2);
    const revenueChangeStr = revenueChangeNum.toFixed(2);
    
    // Update stats cards
    document.getElementById('total-users')!.textContent = stats.totalUsers.toLocaleString();
    document.getElementById('today-transactions')!.textContent = stats.totalTransactions.toString();
    document.getElementById('today-revenue')!.textContent = `$${parseFloat(totalRevenueStr).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('active-users')!.textContent = stats.activeUsers.toString();
    
    document.getElementById('users-change')!.textContent = 
      `${usersChangeNum >= 0 ? '+' : ''}${usersChangeStr}% hôm nay`;
    document.getElementById('transactions-volume')!.textContent = 
      `$${parseFloat(transactionsVolumeStr).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} khối lượng`;
    document.getElementById('revenue-change')!.textContent = 
      `${revenueChangeNum >= 0 ? '+' : ''}${revenueChangeStr}% so với hôm qua`;

    // Load charts
    await loadUserGrowthChart();
    await loadTradingVolumeChart();
    
    // Load tables
    await loadRecentUsers();
    await loadRecentTransactions();
    await loadActivityLog();
    
    console.log('✅ Admin dashboard loaded successfully');
    
  } catch (error) {
    console.error('❌ Error loading dashboard:', error);
    alert('Failed to load dashboard data. Please refresh the page.');
  }
};

// Load User Growth Chart
const loadUserGrowthChart = async () => {
  try {
    const data = await AdminService.getUserGrowthChart('7d') as any;
    
    const ctx = (document.getElementById('user-growth-chart') as HTMLCanvasElement).getContext('2d');
    
    new (window as any).Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'New Users',
          data: data.values,
          borderColor: '#30D475',
          backgroundColor: 'rgba(48, 212, 117, 0.1)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#30D475',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: '#30D475',
            borderWidth: 1
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0, 0, 0, 0.05)' },
            ticks: { color: '#999' }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#999' }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error loading user growth chart:', error);
  }
};

// Load Trading Volume Chart
const loadTradingVolumeChart = async () => {
  try {
    const data = await AdminService.getTradingVolumeChart('7d') as any;
    
    const ctx = (document.getElementById('trading-volume-chart') as HTMLCanvasElement).getContext('2d');
    
    new (window as any).Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Trading Volume ($)',
          data: data.values,
          backgroundColor: 'rgba(102, 126, 234, 0.8)',
          borderColor: '#667eea',
          borderWidth: 1,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            callbacks: {
              label: (context: any) => `$${context.parsed.y.toLocaleString()}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(0, 0, 0, 0.05)' },
            ticks: {
              color: '#999',
              callback: (value: any) => `$${(value / 1000)}k`
            }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#999' }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error loading trading volume chart:', error);
  }
};

// Load Recent Users
const loadRecentUsers = async () => {
  try {
    const users = await AdminService.getRecentUsers() as any;
    const tbody = document.getElementById('recent-users')!;
    
    tbody.innerHTML = users.map(user => `
      <tr>
        <td>#${user.id}</td>
        <td>${user.email}</td>
        <td>${user.username}</td>
        <td>${new Date(user.created_at).toLocaleDateString('vi-VN')}</td>
        <td>
          <span class="badge badge-${user.status === 'active' ? 'success' : 'danger'}">
            ${user.status === 'active' ? 'Active' : 'Inactive'}
          </span>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error loading recent users:', error);
  }
};

// Load Recent Transactions
const loadRecentTransactions = async () => {
  try {
    // Use same API as Danh Sách Giao Dịch (trades table)
    const response = await AdminService.getTransactions({ page: 1, limit: 10 }) as any;
    const transactions = response.transactions || [];
    const tbody = document.getElementById('recent-transactions')!;
    
    tbody.innerHTML = transactions.map((tx: any) => {
      // Convert type to lowercase for consistent comparison
      const type = (tx.type || '').toLowerCase();
      const coin = tx.coin || tx.currency || 'UNKNOWN';
      const amount = parseFloat(tx.total || tx.amount || '0');
      
      return `
      <tr>
        <td>#${tx.id.toString().substring(0, 8)}</td>
        <td>${tx.user_email}</td>
        <td>
          <span class="badge badge-${type === 'buy' ? 'success' : 'warning'}">
            ${type === 'buy' ? '🟢 Mua' : '🔴 Bán'}
          </span>
        </td>
        <td><strong>${coin}</strong></td>
        <td>$${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
        <td>${new Date(tx.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</td>
      </tr>
    `;
    }).join('');
  } catch (error) {
    console.error('Error loading recent transactions:', error);
  }
};

// Load Activity Log
const loadActivityLog = async () => {
  try {
    const activities = await AdminService.getActivityLog() as any;
    const tbody = document.getElementById('activity-log')!;
    
    tbody.innerHTML = activities.map(activity => `
      <tr>
        <td>${new Date(activity.timestamp).toLocaleString('vi-VN')}</td>
        <td>${activity.user_email}</td>
        <td><strong>${activity.action}</strong></td>
        <td>${activity.details}</td>
        <td><code>${activity.ip_address}</code></td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Error loading activity log:', error);
  }
};

// Setup logout button (đồng bộ từ authGuard)
setupLogoutButton('#logout-btn');

// Load admin name
const user = JSON.parse(localStorage.getItem('user') || '{}');
const adminNameEl = document.getElementById('admin-name');
if (adminNameEl) {
  adminNameEl.textContent = user.username || 'Admin';
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', loadAdminDashboard);
