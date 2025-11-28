/**
 * Wallet API Diagnostic Tool
 * Chạy trong DevTools Console (F12) để kiểm tra wallet API
 * 
 * Usage:
 * 1. Mở trang wallet.html
 * 2. Mở DevTools (F12)
 * 3. Copy toàn bộ file này vào Console
 * 4. Chạy các hàm: checkToken(), testAPI(), etc.
 */

console.clear()
console.log('%c🔧 WALLET API DIAGNOSTIC TOOL', 'font-size: 16px; font-weight: bold; color: #26a69a')
console.log('%crun: diagnoseAll() để chạy tất cả kiểm tra', 'color: #888; font-style: italic')

// ============= DIAGNOSTIC FUNCTIONS =============

/**
 * Check if token exists in localStorage
 */
function checkToken() {
  console.log('\n%c📋 STEP 1: Check Token', 'font-size: 14px; font-weight: bold; color: #26a69a')
  
  const token = localStorage.getItem('access_token')
  
  if (!token) {
    console.log('%c❌ NO TOKEN FOUND', 'color: red; font-weight: bold')
    console.log('Action: Run login() function to get token')
    return false
  }
  
  console.log('%c✅ TOKEN EXISTS', 'color: green; font-weight: bold')
  console.log('Token (first 50 chars):', token.substring(0, 50) + '...')
  
  // Check format
  const parts = token.split('.')
  if (parts.length !== 3) {
    console.log('%c⚠️ WARNING: Token format invalid (expected 3 parts)', 'color: orange')
    return false
  }
  console.log('%c✅ Token format: Valid (3 parts)', 'color: green')
  
  // Check expiration
  try {
    const payload = JSON.parse(atob(parts[1]))
    const expireDate = new Date(payload.exp * 1000)
    const timeLeft = Math.round((payload.exp * 1000 - Date.now()) / 1000)
    
    console.log('Expires at:', expireDate.toLocaleString())
    console.log('Time left:', timeLeft > 0 ? `${timeLeft}s ✅` : 'EXPIRED ❌')
    
    if (timeLeft < 0) {
      console.log('%c❌ TOKEN EXPIRED - Run login() to refresh', 'color: red; font-weight: bold')
      return false
    }
  } catch (e) {
    console.log('⚠️ Could not parse token payload')
  }
  
  return true
}

/**
 * Login and save token
 */
async function login() {
  console.log('\n%c🔑 LOGIN', 'font-size: 14px; font-weight: bold; color: #26a69a')
  
  try {
    console.log('Sending login request...')
    const response = await fetch('http://192.168.1.57:8000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@ctrading.com',
        password: 'Admin@2004'
      })
    })
    
    console.log('Response status:', response.status)
    
    if (!response.ok) {
      console.log('%c❌ Login failed (HTTP ' + response.status + ')', 'color: red')
      const error = await response.json()
      console.log('Error:', error)
      return false
    }
    
    const data = await response.json()
    
    if (!data.access_token) {
      console.log('%c❌ No token in response', 'color: red')
      console.log('Response:', data)
      return false
    }
    
    localStorage.setItem('access_token', data.access_token)
    console.log('%c✅ Login successful!', 'color: green; font-weight: bold')
    console.log('Token saved to localStorage')
    console.log('Token (first 50 chars):', data.access_token.substring(0, 50) + '...')
    console.log('ℹ️ Refresh page to apply token: location.reload()')
    
    return true
  } catch (error) {
    console.log('%c❌ Login error:', 'color: red', error.message)
    return false
  }
}

/**
 * Test /wallets/balances endpoint
 */
async function testBalances() {
  console.log('\n%c🏦 TEST: /wallets/balances', 'font-size: 14px; font-weight: bold; color: #26a69a')
  
  const token = localStorage.getItem('access_token')
  if (!token) {
    console.log('%c❌ No token! Run login() first', 'color: red')
    return false
  }
  
  try {
    console.log('URL: http://192.168.1.57:8000/api/wallets/balances')
    console.log('Method: GET')
    console.log('Sending request...')
    
    const response = await fetch('http://192.168.1.57:8000/api/wallets/balances', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    console.log('Response status:', response.status)
    
    if (response.status === 404) {
      console.log('%c❌ 404 NOT FOUND', 'color: red; font-weight: bold')
      console.log('Backend endpoint /wallets/balances does not exist')
      console.log('Contact backend developer to create this endpoint')
      return false
    }
    
    if (response.status === 401) {
      console.log('%c❌ 401 UNAUTHORIZED', 'color: red; font-weight: bold')
      console.log('Token is invalid or expired. Run login() to refresh.')
      return false
    }
    
    if (!response.ok) {
      console.log('%c❌ Error (HTTP ' + response.status + ')', 'color: red')
      return false
    }
    
    const data = await response.json()
    console.log('%c✅ Success!', 'color: green; font-weight: bold')
    console.log('Response:', data)
    
    if (data.spot) {
      console.log(`Spot balances: ${data.spot.length} coins`)
    }
    if (data.funding) {
      console.log(`Funding balances: ${data.funding.length} coins`)
    }
    if (data.total_value) {
      console.log(`Total value: $${data.total_value.toFixed(2)}`)
    }
    
    return true
  } catch (error) {
    console.log('%c❌ Network error:', 'color: red', error.message)
    return false
  }
}

/**
 * Test /wallets/transactions endpoint
 */
async function testTransactions() {
  console.log('\n%c📊 TEST: /wallets/transactions', 'font-size: 14px; font-weight: bold; color: #26a69a')
  
  const token = localStorage.getItem('access_token')
  if (!token) {
    console.log('%c❌ No token! Run login() first', 'color: red')
    return false
  }
  
  try {
    const url = 'http://192.168.1.57:8000/api/wallets/transactions?limit=20&offset=0'
    console.log('URL:', url)
    console.log('Method: GET')
    console.log('Sending request...')
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    console.log('Response status:', response.status)
    
    if (response.status === 404) {
      console.log('%c❌ 404 NOT FOUND', 'color: red; font-weight: bold')
      console.log('Endpoint /wallets/transactions does not exist')
      return false
    }
    
    if (response.status === 401) {
      console.log('%c❌ 401 UNAUTHORIZED', 'color: red; font-weight: bold')
      console.log('Token invalid. Run login() to refresh.')
      return false
    }
    
    if (!response.ok) {
      console.log('%c❌ Error (HTTP ' + response.status + ')', 'color: red')
      return false
    }
    
    const data = await response.json()
    console.log('%c✅ Success!', 'color: green; font-weight: bold')
    
    if (Array.isArray(data)) {
      console.log(`Found ${data.length} transactions`)
      if (data.length > 0) {
        console.log('Sample transaction:', data[0])
      }
    } else {
      console.log('Response:', data)
    }
    
    return true
  } catch (error) {
    console.log('%c❌ Network error:', 'color: red', error.message)
    return false
  }
}

/**
 * Check network connectivity
 */
async function checkBackend() {
  console.log('\n%c🌐 CHECK: Backend Connectivity', 'font-size: 14px; font-weight: bold; color: #26a69a')
  
  try {
    console.log('URL: http://192.168.1.57:8000/api')
    console.log('Pinging backend...')
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch('http://192.168.1.57:8000/api', {
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    
    console.log('%c✅ Backend is reachable!', 'color: green; font-weight: bold')
    console.log('Response status:', response.status)
    return true
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('%c❌ Backend not responding (timeout)', 'color: red; font-weight: bold')
      console.log('Make sure backend is running on 192.168.1.57:8000')
    } else {
      console.log('%c❌ Cannot reach backend:', 'color: red; font-weight: bold', error.message)
    }
    return false
  }
}

/**
 * Run all diagnostics
 */
async function diagnoseAll() {
  console.log('\n%c═══════════════════════════════════════', 'color: #26a69a')
  console.log('%c📊 WALLET API FULL DIAGNOSTIC', 'font-size: 16px; font-weight: bold; color: #26a69a')
  console.log('%c═══════════════════════════════════════\n', 'color: #26a69a')
  
  // 1. Check backend
  const backendOk = await checkBackend()
  
  if (!backendOk) {
    console.log('\n%c❌ DIAGNOSTIC FAILED: Cannot reach backend', 'color: red; font-weight: bold')
    console.log('Please start backend server first')
    return
  }
  
  // 2. Check token
  const tokenOk = checkToken()
  
  if (!tokenOk) {
    console.log('\n%c⏳ Attempting login...', 'color: #fbbf24; font-weight: bold')
    const loginOk = await login()
    
    if (!loginOk) {
      console.log('\n%c❌ DIAGNOSTIC FAILED: Cannot login', 'color: red; font-weight: bold')
      return
    }
    
    console.log('\n%c⏳ Re-checking token...', 'color: #fbbf24')
    checkToken()
  }
  
  // 3. Test endpoints
  const balancesOk = await testBalances()
  const transactionsOk = await testTransactions()
  
  // Summary
  console.log('\n%c═══════════════════════════════════════', 'color: #26a69a')
  console.log('%c📋 DIAGNOSTIC SUMMARY', 'font-size: 14px; font-weight: bold; color: #26a69a')
  console.log('%c═══════════════════════════════════════', 'color: #26a69a')
  console.log(`Backend: ${backendOk ? '✅' : '❌'}`)
  console.log(`Token: ${tokenOk ? '✅' : '❌'}`)
  console.log(`/wallets/balances: ${balancesOk ? '✅' : '❌'}`)
  console.log(`/wallets/transactions: ${transactionsOk ? '✅' : '❌'}`)
  
  if (balancesOk && transactionsOk) {
    console.log('\n%c✅ ALL SYSTEMS OPERATIONAL!', 'font-size: 14px; font-weight: bold; color: green')
    console.log('Reload page to see wallet data')
  } else {
    console.log('\n%c⚠️ SOME ISSUES FOUND', 'font-size: 14px; font-weight: bold; color: orange')
    console.log('Check console output above for details')
  }
}

/**
 * Clear token and logout
 */
function logout() {
  console.log('\n%c👋 LOGOUT', 'font-size: 14px; font-weight: bold; color: #26a69a')
  localStorage.removeItem('access_token')
  console.log('%c✅ Token cleared', 'color: green')
  console.log('Run login() to login again')
}

/**
 * Show all available commands
 */
function help() {
  console.clear()
  console.log('%c🔧 WALLET API DIAGNOSTIC - COMMAND LIST', 'font-size: 16px; font-weight: bold; color: #26a69a')
  console.log(`
%c📋 MAIN COMMANDS:%c
  diagnoseAll()        - Run all diagnostic checks
  
%c🔍 INDIVIDUAL CHECKS:%c
  checkToken()         - Check if token exists and is valid
  checkBackend()       - Check if backend is reachable
  testBalances()       - Test /wallets/balances API
  testTransactions()   - Test /wallets/transactions API
  
%c🔑 AUTHENTICATION:%c
  login()              - Login and save token
  logout()             - Clear token
  
%c❓ HELP:%c
  help()               - Show this help message
  `, 'color: #888', 'color: white',
     'color: #888', 'color: white',
     'color: #888', 'color: white',
     'color: #888', 'color: white')
}

// Show help on load
console.log('%c💡 Tip: Type help() to see all commands', 'color: #fbbf24; font-style: italic')

// 1. Check WalletService exists and updated
try {
  const walletServicePath = path.join(__dirname, 'services', 'walletService.ts');
  const walletServiceContent = fs.readFileSync(walletServicePath, 'utf8');
  
  check('WalletService exists', true, `${Math.ceil(walletServiceContent.length / 1000)}KB`);
  check('WalletService has getBalances', walletServiceContent.includes('getBalances'));
  check('WalletService has getTransactions', walletServiceContent.includes('getTransactions'));
  check('WalletService has error handling', walletServiceContent.includes('catch'));
  
} catch (e) {
  check('WalletService exists', false, e.message);
}

// 2. Check wallet.tsx exists and updated
try {
  const walletTsxPath = path.join(__dirname, 'wallet', 'wallet.tsx');
  const walletTsxContent = fs.readFileSync(walletTsxPath, 'utf8');
  
  check('wallet.tsx exists', true, `${Math.ceil(walletTsxContent.length / 1000)}KB`);
  check('wallet.tsx imports WalletService', walletTsxContent.includes('import { WalletService'));
  check('wallet.tsx has renderWalletTable', walletTsxContent.includes('renderWalletTable'));
  check('wallet.tsx has handleDeposit', walletTsxContent.includes('handleDeposit'));
  check('wallet.tsx has handleWithdraw', walletTsxContent.includes('handleWithdraw'));
  check('wallet.tsx has renderTransactions', walletTsxContent.includes('renderTransactions'));
  
} catch (e) {
  check('wallet.tsx exists', false, e.message);
}

// 3. Check wallet.html is updated
try {
  const walletHtmlPath = path.join(__dirname, 'wallet.html');
  const walletHtmlContent = fs.readFileSync(walletHtmlPath, 'utf8');
  
  check('wallet.html exists', true);
  check('wallet.html has depositModal', walletHtmlContent.includes('id="depositModal"'));
  check('wallet.html has withdrawModal', walletHtmlContent.includes('id="withdrawModal"'));
  check('wallet.html has deposit-network', walletHtmlContent.includes('id="deposit-network"'));
  check('wallet.html has transactions-table', walletHtmlContent.includes('id="transactions-table"'));
  check('wallet.html imports wallet.tsx', walletHtmlContent.includes('./wallet/wallet.tsx'));
  
} catch (e) {
  check('wallet.html exists', false, e.message);
}

// 4. Check tradingService has WalletService support
try {
  const tradingServicePath = path.join(__dirname, 'services', 'tradingService.ts');
  const tradingServiceContent = fs.readFileSync(tradingServicePath, 'utf8');
  
  check('TradingService exists', true);
  check('TradingService has createOrder', tradingServiceContent.includes('createOrder'));
  check('TradingService sends price field', tradingServiceContent.includes('price:'));
  check('TradingService has error logging', tradingServiceContent.includes('JSON.stringify'));
  
} catch (e) {
  check('TradingService exists', false, e.message);
}

// 5. Check OrderPanel has wallet error handling
try {
  const orderPanelPath = path.join(__dirname, 'components', 'trading', 'OrderPanel.tsx');
  const orderPanelContent = fs.readFileSync(orderPanelPath, 'utf8');
  
  check('OrderPanel exists', true);
  check('OrderPanel has wallet error detection', orderPanelContent.includes('wallet'));
  check('OrderPanel has fallback mock wallet', orderPanelContent.includes('mockWallet'));
  
} catch (e) {
  check('OrderPanel exists', false, e.message);
}

// 6. Check Documentation
try {
  const summaryPath = path.join(__dirname, 'WALLET_INTEGRATION_SUMMARY.md');
  const summaryContent = fs.readFileSync(summaryPath, 'utf8');
  
  check('Integration summary exists', true);
  check('Summary has API documentation', summaryContent.includes('API'));
  check('Summary has testing checklist', summaryContent.includes('Checklist'));
  
} catch (e) {
  check('Integration summary exists', false, e.message);
}

// Summary
console.log('\n' + '='.repeat(50));
const passed = checks.filter(c => c.passed).length;
const total = checks.length;
const percentage = Math.round((passed / total) * 100);

console.log(`\n📊 Results: ${passed}/${total} checks passed (${percentage}%)\n`);

if (percentage === 100) {
  console.log('✅ All wallet integration checks passed!');
  console.log('🚀 Ready for testing\n');
  process.exit(0);
} else {
  console.log('⚠️  Some checks failed. Please review the output above.\n');
  process.exit(1);
}
