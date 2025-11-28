import { checkAdminAuth, setupLogoutButton } from '../../utils/authGuard';
import { AdminService } from '../../services/adminService';

// Check admin authentication
checkAdminAuth();

interface Transaction {
  id: number;
  user_id: number;
  user_email: string;
  type: 'buy' | 'sell';
  coin: string;
  quantity: number;
  price: number;
  total: number;
  fee: number;
  created_at: string;
}

let currentPage = 1;
const itemsPerPage = 15;
let allTransactions: Transaction[] = [];
let filteredTransactions: Transaction[] = [];

// Load Transactions
const loadTransactions = async () => {
  try {
    const searchTerm = (document.getElementById('search-input') as HTMLInputElement)?.value || '';
    const typeFilter = (document.getElementById('type-filter') as HTMLSelectElement)?.value || '';
    const coinFilter = (document.getElementById('coin-filter') as HTMLSelectElement)?.value || '';
    const fromDate = (document.getElementById('from-date') as HTMLInputElement)?.value || '';
    const toDate = (document.getElementById('to-date') as HTMLInputElement)?.value || '';
    
    // Fetch transactions using AdminService
    const data = await AdminService.getTransactions({
      page: currentPage,
      limit: itemsPerPage,
      search: searchTerm,
      type: typeFilter,
      coin: coinFilter,
      from_date: fromDate,
      to_date: toDate
    }) as any;
    
    // Backend returns: currency, amount, fee, type, user_email, created_at
    // Map to frontend format: coin, total, fee, type, date
    if (!data || !data.transactions || data.transactions.length === 0) {
      allTransactions = [];
      filteredTransactions = [];
    } else {
      // Transform backend data to frontend format
      const mappedTransactions = data.transactions.map((tx: any) => ({
        id: tx.id,
        user_id: tx.user_id,
        user_email: tx.user_email,
        type: (tx.type || '').toLowerCase(), // Convert to lowercase: BUY -> buy, SELL -> sell
        coin: tx.coin || tx.currency || 'UNKNOWN',
        quantity: parseFloat(tx.quantity || '0'),
        price: parseFloat(tx.price || '0'),
        total: parseFloat(tx.total || tx.amount || '0'),
        fee: parseFloat(tx.fee || '0'),
        balance_after: tx.balance_after,
        created_at: tx.created_at
      }));
      
      filteredTransactions = mappedTransactions;
      
      // Get all transactions for stats calculation
      const statsData = await AdminService.getTransactions({ page: 1, limit: 1000 }) as any;
      allTransactions = (statsData.transactions || []).map((tx: any) => ({
        id: tx.id,
        user_id: tx.user_id,
        user_email: tx.user_email,
        type: (tx.type || '').toLowerCase(), // Convert to lowercase: BUY -> buy, SELL -> sell
        coin: tx.coin || tx.currency || 'UNKNOWN',
        quantity: parseFloat(tx.quantity || '0'),
        price: parseFloat(tx.price || '0'),
        total: parseFloat(tx.total || tx.amount || '0'),
        fee: parseFloat(tx.fee || '0'),
        balance_after: tx.balance_after,
        created_at: tx.created_at
      }));
    }
    
    updateStats();
    renderTransactionsTable();
  } catch (error) {
    console.error('Error loading transactions:', error);
    allTransactions = [];
    filteredTransactions = [];
    
    updateStats();
    renderTransactionsTable();
  }
};

// Update Stats
const updateStats = () => {
  const totalTransactions = allTransactions.length;
  const totalVolume = allTransactions.reduce((sum, tx) => {
    const total = typeof tx.total === 'number' ? tx.total : parseFloat(tx.total || '0');
    return sum + total;
  }, 0);
  
  const totalFee = allTransactions.reduce((sum, tx) => {
    const fee = typeof tx.fee === 'number' ? tx.fee : parseFloat(tx.fee || '0');
    return sum + fee;
  }, 0);
  
  const today = new Date().toISOString().split('T')[0];
  const todayTransactions = allTransactions.filter(tx => tx.created_at && tx.created_at.startsWith(today)).length;
  
  document.getElementById('total-transactions')!.textContent = totalTransactions.toString();
  document.getElementById('total-volume')!.textContent = `$${totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('total-fee')!.textContent = `$${totalFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  document.getElementById('today-transactions')!.textContent = todayTransactions.toString();
};

// Render Transactions Table
const renderTransactionsTable = () => {
  const tbody = document.getElementById('transactions-table-body')!;
  
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const pageTransactions = filteredTransactions.slice(startIdx, endIdx);
  
  if (pageTransactions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="text-center py-4">Không có giao dịch nào</td></tr>';
    return;
  }
  
  tbody.innerHTML = pageTransactions.map(tx => {
    // Data already mapped and validated in loadTransactions
    const id = tx.id || 'N/A';
    const userEmail = tx.user_email || 'N/A';
    const type = tx.type || 'N/A';
    const coin = tx.coin || 'UNKNOWN';
    const quantity = tx.quantity || 0;
    const price = tx.price || 0;
    const total = tx.total || 0;
    const fee = tx.fee || 0;
    const createdAt = tx.created_at ? new Date(tx.created_at).toLocaleString('vi-VN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit', 
      minute: '2-digit' 
    }) : 'N/A';
    
    return `
    <tr>
      <td>#${id.toString().substring(0, 8)}</td>
      <td>${userEmail}</td>
      <td>
        <span class="badge badge-${type === 'buy' ? 'success' : 'warning'}">
          ${type === 'buy' ? '🟢 Mua' : '🔴 Bán'}
        </span>
      </td>
      <td><strong>${coin}</strong></td>
      <td>${quantity > 0 ? quantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : '-'}</td>
      <td>$${price > 0 ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-'}</td>
      <td><strong>$${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
      <td>$${fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</td>
      <td>${createdAt}</td>
      <td>
        <button class="btn btn-sm btn-outline-primary view-transaction-btn" data-id="${id}">
          <i class="fa-solid fa-eye"></i>
        </button>
      </td>
    </tr>
  `;
  }).join('');
  
  // Update showing text
  const total = filteredTransactions.length;
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
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  
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
      renderTransactionsTable();
    }
  });
  
  document.getElementById('next-page')?.addEventListener('click', () => {
    const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
    if (currentPage < totalPages) {
      currentPage++;
      renderTransactionsTable();
    }
  });
  
  document.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPage = parseInt(btn.getAttribute('data-page')!);
      renderTransactionsTable();
    });
  });
};

// Attach Event Listeners
const attachEventListeners = () => {
  document.querySelectorAll('.view-transaction-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const txId = parseInt(btn.getAttribute('data-id')!);
      viewTransactionDetail(txId);
    });
  });
};

// View Transaction Detail
const viewTransactionDetail = (txId: number) => {
  const tx = allTransactions.find(t => t.id === txId);
  if (!tx) return;
  
  const modalContent = document.getElementById('transaction-detail-content')!;
  modalContent.innerHTML = `
    <div class="row g-3">
      <div class="col-md-6">
        <p><strong>Transaction ID:</strong> #${tx.id}</p>
        <p><strong>User:</strong> ${tx.user_email}</p>
        <p><strong>Type:</strong> <span class="badge badge-${tx.type === 'buy' ? 'success' : 'warning'}">${tx.type === 'buy' ? 'Mua (Buy)' : 'Bán (Sell)'}</span></p>
        <p><strong>Coin:</strong> ${tx.coin}</p>
        <p><strong>Quantity:</strong> ${tx.quantity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}</p>
      </div>
      <div class="col-md-6">
        <p><strong>Price:</strong> $${tx.price.toLocaleString()}</p>
        <p><strong>Total Amount:</strong> <strong>$${tx.total.toLocaleString()}</strong></p>
        <p><strong>Fee (0.2%):</strong> $${tx.fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        <p><strong>Created At:</strong> ${new Date(tx.created_at).toLocaleString('vi-VN')}</p>
      </div>
    </div>
  `;
  
  const modal = new (window as any).bootstrap.Modal(document.getElementById('transactionDetailModal'));
  modal.show();
};

// Apply Filter
const applyFilter = () => {
  const searchTerm = (document.getElementById('search-input') as HTMLInputElement).value.toLowerCase();
  const typeFilter = (document.getElementById('type-filter') as HTMLSelectElement).value;
  const coinFilter = (document.getElementById('coin-filter') as HTMLSelectElement).value;
  const fromDate = (document.getElementById('from-date') as HTMLInputElement).value;
  const toDate = (document.getElementById('to-date') as HTMLInputElement).value;
  
  filteredTransactions = allTransactions.filter(tx => {
    const matchSearch = !searchTerm || 
      tx.user_email.toLowerCase().includes(searchTerm) || 
      tx.id.toString().includes(searchTerm);
    
    const matchType = !typeFilter || tx.type === typeFilter;
    const matchCoin = !coinFilter || tx.coin === coinFilter;
    
    const txDate = tx.created_at.split('T')[0];
    const matchFromDate = !fromDate || txDate >= fromDate;
    const matchToDate = !toDate || txDate <= toDate;
    
    return matchSearch && matchType && matchCoin && matchFromDate && matchToDate;
  });
  
  currentPage = 1;
  renderTransactionsTable();
  updateStats(); // Update stats based on filtered results
};

// Export CSV
const exportCSV = () => {
  const csv = [
    ['ID', 'User', 'Type', 'Coin', 'Quantity', 'Price', 'Total', 'Fee', 'Created'].join(','),
    ...filteredTransactions.map(tx => [
      tx.id,
      tx.user_email,
      tx.type,
      tx.coin,
      tx.quantity,
      tx.price,
      tx.total,
      tx.fee,
      tx.created_at
    ].join(','))
  ].join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transactions_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
};

// Event Listeners
document.getElementById('apply-filter-btn')?.addEventListener('click', applyFilter);
document.getElementById('search-input')?.addEventListener('keyup', (e) => {
  if ((e as KeyboardEvent).key === 'Enter') applyFilter();
});
document.getElementById('export-btn')?.addEventListener('click', exportCSV);

// Setup logout button (đồng bộ từ authGuard)
setupLogoutButton('#logout-btn');

// Load admin name
const user = JSON.parse(localStorage.getItem('user') || '{}');
const adminNameEl = document.getElementById('admin-name');
if (adminNameEl) {
  adminNameEl.textContent = user.username || 'Admin';
}

// Initialize
document.addEventListener('DOMContentLoaded', loadTransactions);
