/**
 * Wallet Debug Tool - Kiểm tra dữ liệu từ API
 * Copy vào Console (F12) để xem chi tiết dữ liệu từ backend
 */

console.clear()
console.log('%c🔍 WALLET DATA DEBUG TOOL', 'font-size: 16px; font-weight: bold; color: #26a69a')

// ============= CHECK DATA FUNCTIONS =============

/**
 * Kiểm tra xem có dữ liệu trong localStorage
 */
async function checkWalletData() {
    console.log('\n%c📊 CHECK: Wallet Data', 'font-size: 14px; font-weight: bold; color: #26a69a')
    
    try {
        // Kiểm tra token
        const token = localStorage.getItem('access_token')
        if (!token) {
            console.log('%c❌ No token! Login first', 'color: red')
            return
        }
        
        console.log('%c✅ Token exists', 'color: green')
        
        // Call getBalances trực tiếp
        console.log('\nCalling /api/wallets/balances...')
        const response = await fetch('http://192.168.1.57:8000/api/wallets/balances', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        
        console.log('HTTP Status:', response.status)
        
        if (!response.ok) {
            console.log('%c❌ API Error:', 'color: red', response.status)
            const error = await response.json().catch(() => ({}))
            console.log('Error details:', error)
            return
        }
        
        const data = await response.json()
        console.log('%c✅ API Response:', 'color: green; font-weight: bold', data)
        
        // Phân tích chi tiết
        console.log('\n%c📋 Data Analysis:', 'color: #fbbf24; font-weight: bold')
        console.log('Total value:', data.total_value)
        
        if (data.spot) {
            console.log(`\n📥 Spot Wallet (${data.spot.length} coins):`)
            data.spot.forEach((coin, i) => {
                console.log(`  [${i+1}] ${coin.coin}: ${coin.total} (Available: ${coin.available}, Locked: ${coin.locked}, USD: ${coin.usdValue})`)
            })
        }
        
        if (data.funding) {
            console.log(`\n🏦 Funding Wallet (${data.funding.length} coins):`)
            data.funding.forEach((coin, i) => {
                console.log(`  [${i+1}] ${coin.coin}: ${coin.total}`)
            })
        }
        
        if (data.margin) {
            console.log(`\n📊 Margin Wallet (${data.margin.length} coins):`)
            data.margin.forEach((coin, i) => {
                console.log(`  [${i+1}] ${coin.coin}: ${coin.total}`)
            })
        }
        
        // Kiểm tra format
        console.log('\n%c🔍 Format Check:', 'color: #fbbf24')
        if (data.spot && data.spot.length > 0) {
            const coin = data.spot[0]
            console.log('First coin object:', coin)
            console.log('- coin:', typeof coin.coin, coin.coin)
            console.log('- total:', typeof coin.total, coin.total)
            console.log('- available:', typeof coin.available, coin.available)
            console.log('- locked:', typeof coin.locked, coin.locked)
            console.log('- usdValue:', typeof coin.usdValue, coin.usdValue)
        }
        
        return data
    } catch (error) {
        console.log('%c❌ Error:', 'color: red', error.message)
        console.log('Full error:', error)
    }
}

/**
 * Kiểm tra xem page đã render dữ liệu chưa
 */
function checkPageRendered() {
    console.log('\n%c📺 CHECK: Page Rendering', 'font-size: 14px; font-weight: bold; color: #26a69a')
    
    const table = document.getElementById('spot-wallet-table')
    if (!table) {
        console.log('%c❌ Table element not found', 'color: red')
        return
    }
    
    console.log('%c✅ Table element found', 'color: green')
    
    const rows = table.querySelectorAll('tr')
    console.log(`Found ${rows.length} rows:`)
    
    rows.forEach((row, i) => {
        const cells = row.querySelectorAll('td')
        if (cells.length > 0) {
            const coin = cells[0]?.textContent || '-'
            const total = cells[1]?.textContent || '-'
            const available = cells[2]?.textContent || '-'
            const usd = cells[4]?.textContent || '-'
            console.log(`  [${i}] ${coin}: total=${total}, available=${available}, usd=${usd}`)
        }
    })
    
    // Check total balance
    const totalBalanceEl = document.getElementById('total-balance')
    if (totalBalanceEl) {
        console.log(`Total Balance Display: ${totalBalanceEl.textContent}`)
    }
}

/**
 * Kiểm tra localStorage dữ liệu
 */
function checkLocalStorage() {
    console.log('\n%c💾 CHECK: localStorage', 'font-size: 14px; font-weight: bold; color: #26a69a')
    
    const keys = Object.keys(localStorage)
    console.log(`Found ${keys.length} keys:`)
    
    keys.forEach(key => {
        const value = localStorage.getItem(key)
        if (key === 'access_token') {
            console.log(`  ${key}: ${value.substring(0, 50)}... (length: ${value.length})`)
        } else {
            console.log(`  ${key}: ${value}`)
        }
    })
}

/**
 * Kiểm tra xem WalletService có working không
 */
async function checkWalletService() {
    console.log('\n%c🔧 CHECK: WalletService', 'font-size: 14px; font-weight: bold; color: #26a69a')
    
    try {
        // Check if WalletService is available (if page loaded wallet.tsx)
        if (typeof window !== 'undefined' && window.WalletService) {
            console.log('%c✅ WalletService available in window', 'color: green')
        } else {
            console.log('⚠️ WalletService not in window (might be OK if using ES modules)')
        }
        
        // Try direct fetch
        const token = localStorage.getItem('access_token')
        if (!token) {
            console.log('%c⚠️ No token', 'color: orange')
            return
        }
        
        const response = await fetch('http://192.168.1.57:8000/api/wallets/balances', {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        })
        
        if (response.ok) {
            const data = await response.json()
            console.log('%c✅ WalletService API call works!', 'color: green')
            console.log('Response:', data)
        } else {
            console.log('%c❌ API returned error:', 'color: red', response.status)
        }
    } catch (error) {
        console.log('%c❌ Error:', 'color: red', error.message)
    }
}

/**
 * Kiểm tra xem có mock data không
 */
function checkMockData() {
    console.log('\n%c🎭 CHECK: Mock Data', 'font-size: 14px; font-weight: bold; color: #26a69a')
    
    // Check if page is using mock data fallback
    const table = document.getElementById('spot-wallet-table')
    if (!table) {
        console.log('Table not found')
        return
    }
    
    const firstRow = table.querySelector('tr')
    if (!firstRow) {
        console.log('No rows in table')
        return
    }
    
    const text = firstRow.textContent
    console.log('First row content:', text.substring(0, 100))
    
    if (text.includes('Không có tài sản')) {
        console.log('%c📌 Page shows "No assets" message', 'color: #fbbf24')
    } else if (text.includes('Lỗi') || text.includes('Error')) {
        console.log('%c❌ Page shows error message', 'color: red')
    } else if (text.includes('Đang tải')) {
        console.log('%c⏳ Page shows "Loading" message', 'color: #fbbf24')
    } else {
        console.log('%c✅ Page shows data!', 'color: green')
    }
}

/**
 * Reload trang để trigger data fetch
 */
function reloadPage() {
    console.log('\n%c🔄 Reloading page...', 'color: #fbbf24')
    location.reload()
}

/**
 * Full diagnostic
 */
async function fullDiagnostic() {
    console.log('\n%c═══════════════════════════════════════', 'color: #26a69a')
    console.log('%c🔍 FULL WALLET DATA DIAGNOSTIC', 'font-size: 16px; font-weight: bold; color: #26a69a')
    console.log('%c═══════════════════════════════════════\n', 'color: #26a69a')
    
    checkLocalStorage()
    await checkWalletData()
    checkPageRendered()
    checkMockData()
    
    console.log('\n%c═══════════════════════════════════════', 'color: #26a69a')
    console.log('%c✅ Diagnostic Complete', 'font-size: 14px; font-weight: bold; color: green')
    console.log('%c═══════════════════════════════════════\n', 'color: #26a69a')
}

/**
 * Show commands
 */
function help() {
    console.clear()
    console.log('%c🔍 WALLET DATA DEBUG - COMMANDS', 'font-size: 16px; font-weight: bold; color: #26a69a')
    console.log(`
%c📋 MAIN COMMANDS:%c
  fullDiagnostic()    - Run complete diagnostic
  
%c🔍 INDIVIDUAL CHECKS:%c
  checkWalletData()   - Call API and show response
  checkPageRendered() - Check what's displayed on page
  checkLocalStorage() - Check stored data
  checkWalletService() - Test WalletService
  checkMockData()     - Check if using mock data
  
%c🔄 ACTIONS:%c
  reloadPage()        - Reload page to trigger fetch
  
%c❓ HELP:%c
  help()              - Show this message
  `, 'color: #888', 'color: white',
     'color: #888', 'color: white',
     'color: #888', 'color: white',
     'color: #888', 'color: white')
}

// Auto show help
help()
console.log('%c💡 Start with: fullDiagnostic()', 'color: #fbbf24; font-style: italic')
