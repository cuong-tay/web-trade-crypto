import { checkAdminAuth, setupLogoutButton } from '../../utils/authGuard';
import { AdminService } from '../../services/adminService';

// Check admin authentication
checkAdminAuth();

interface ReportData {
  totalRevenue: number;
  totalFees: number;
  newUsers: number;
  totalTrades: number;
  revenueGrowth: number;
  feesGrowth: number;
  usersGrowth: number;
  tradesGrowth: number;
}

// Load Reports
const loadReports = async () => {
  try {
    console.log('📊 Loading reports...');
    
    const period = (document.getElementById('period-filter') as HTMLSelectElement)?.value || '7d';
    
    // Fetch summary stats using AdminService
    const reportData = await AdminService.getReportsSummary(period) as any;
    
    // Update stats
    const totalRevenueNum = Number(reportData.totalRevenue);
    const totalFeesNum = Number(reportData.totalFees);
    const revenueGrowthNum = Number(reportData.revenueGrowth);
    const feesGrowthNum = Number(reportData.feesGrowth);
    const usersGrowthNum = Number(reportData.usersGrowth);
    const tradesGrowthNum = Number(reportData.tradesGrowth);
    
    document.getElementById('total-revenue')!.textContent = `$${totalRevenueNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('total-fees')!.textContent = `$${totalFeesNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('new-users')!.textContent = reportData.newUsers.toString();
    document.getElementById('total-trades')!.textContent = reportData.totalTrades.toString();
    
    document.getElementById('revenue-growth')!.textContent = `${revenueGrowthNum >= 0 ? '+' : ''}${revenueGrowthNum.toFixed(2)}% so với kỳ trước`;
    document.getElementById('fees-growth')!.textContent = `${feesGrowthNum >= 0 ? '+' : ''}${feesGrowthNum.toFixed(2)}% so với kỳ trước`;
    document.getElementById('users-growth')!.textContent = `${usersGrowthNum >= 0 ? '+' : ''}${usersGrowthNum.toFixed(2)}% so với kỳ trước`;
    document.getElementById('trades-growth')!.textContent = `${tradesGrowthNum >= 0 ? '+' : ''}${tradesGrowthNum.toFixed(2)}% so với kỳ trước`;
    
    // Load charts with API
    await loadRevenueChart(period);
    await loadUserGrowthChart(period);
    await loadTopCoinsChart(period);
    await loadBuySellRatioChart(period);
    await loadActivityHeatmap(period);
    
    // Load tables with API
    await loadTopUsersTable(period);
    await loadTopDaysTable(period);
    
    console.log('✅ Reports loaded successfully');
  } catch (error) {
    console.error('❌ Error loading reports:', error);
    alert('Failed to load reports. Please refresh the page.');
  }
};

// Load Revenue Chart
const loadRevenueChart = async (period: string) => {
  try {
    const data = await AdminService.getRevenueChart(period) as any;
    const ctx = (document.getElementById('revenue-chart') as HTMLCanvasElement).getContext('2d');
  
  new (window as any).Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels,
      datasets: [{
        label: 'Doanh Thu ($)',
        data: data.values,
        borderColor: '#30D475',
        backgroundColor: 'rgba(48, 212, 117, 0.1)',
        tension: 0.4,
        fill: true,
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context: any) => `$${context.parsed.y.toLocaleString()}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value: any) => `$${(value / 1000)}k`
          }
        }
      }
    }
  });
  } catch (error) {
    console.error('Error loading revenue chart:', error);
  }
};

// Load User Growth Chart
const loadUserGrowthChart = async (period: string) => {
  try {
    const data = await AdminService.getUserGrowthReportChart(period) as any;
    const ctx = (document.getElementById('user-growth-chart') as HTMLCanvasElement).getContext('2d');
  
  new (window as any).Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [{
        label: 'New Users',
        data: data.values,
        backgroundColor: 'rgba(102, 126, 234, 0.8)',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
  } catch (error) {
    console.error('Error loading user growth chart:', error);
  }
};

// Load Top Coins Chart
const loadTopCoinsChart = async (period: string) => {
  try {
    const data = await AdminService.getTopCoins(period) as any;
    const ctx = (document.getElementById('top-coins-chart') as HTMLCanvasElement).getContext('2d');
  
  new (window as any).Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [{
        label: 'Số Giao Dịch',
        data: data.values,
        backgroundColor: [
          '#f7931a', '#627eea', '#f3ba2f', '#00d4aa', '#0033ad',
          '#23292f', '#e6007a', '#c2a633', '#8247e5', '#e84142'
        ],
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true } }
    }
  });
  } catch (error) {
    console.error('Error loading top coins chart:', error);
  }
};

// Load Buy/Sell Ratio Chart
const loadBuySellRatioChart = async (period: string) => {
  try {
    const data = await AdminService.getBuySellRatio(period) as any;
    const ctx = (document.getElementById('buy-sell-ratio-chart') as HTMLCanvasElement).getContext('2d');
  
  new (window as any).Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.labels,
      datasets: [{
        data: data.values,
        backgroundColor: ['#10b981', '#f59e0b'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' }
      }
    }
  });
  } catch (error) {
    console.error('Error loading buy/sell ratio chart:', error);
  }
};

// Load Activity Heatmap
const loadActivityHeatmap = async (period: string) => {
  try {
    const data = await AdminService.getActivityHeatmap(period) as any;
    const ctx = (document.getElementById('activity-heatmap') as HTMLCanvasElement).getContext('2d');
  
  new (window as any).Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels,
      datasets: [{
        label: 'Active Users',
        data: data.values,
        backgroundColor: data.values.map(v => {
          if (v > 100) return 'rgba(239, 68, 68, 0.8)';
          if (v > 50) return 'rgba(251, 146, 60, 0.8)';
          if (v > 20) return 'rgba(250, 204, 21, 0.8)';
          return 'rgba(34, 197, 94, 0.8)';
        }),
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
  } catch (error) {
    console.error('Error loading activity heatmap:', error);
  }
};

// Load Top Users Table
const loadTopUsersTable = async (period: string) => {
  try {
    const users = await AdminService.getTopUsers(period) as any;
    const tbody = document.getElementById('top-users-table')!;
  
  tbody.innerHTML = users.map(user => `
    <tr>
      <td><strong>#${user.rank}</strong></td>
      <td>${user.email}</td>
      <td>${user.trades}</td>
      <td><strong>$${(Number(user.volume) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
      <td>$${(Number(user.fees) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
    </tr>
  `).join('');
  } catch (error) {
    console.error('Error loading top users:', error);
  }
};

// Load Top Days Table
const loadTopDaysTable = async (period: string) => {
  try {
    const days = await AdminService.getTopDays(period) as any;
    const tbody = document.getElementById('top-days-table')!;
  
  tbody.innerHTML = days.map(day => `
    <tr>
      <td><strong>#${day.rank}</strong></td>
      <td>${new Date(day.date).toLocaleDateString('vi-VN')}</td>
      <td>${day.trades}</td>
      <td><strong>$${(Number(day.volume) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
      <td>${day.activeUsers}</td>
    </tr>
  `).join('');
  } catch (error) {
    console.error('Error loading top days:', error);
  }
};

// Export Report
document.getElementById('export-report-btn')?.addEventListener('click', () => {
  alert('📄 Export PDF functionality will be implemented with backend API');
});

// Apply Period Filter
document.getElementById('apply-period-btn')?.addEventListener('click', () => {
  loadReports();
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
document.addEventListener('DOMContentLoaded', loadReports);
