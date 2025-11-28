/**
 * API Client Helpers - Xử lý lỗi Fetch và CORS
 * 
 * Khuyến nghị:
 * 1. Kiểm tra CORS headers từ server
 * 2. Xử lý Network errors với fallback
 * 3. Retry logic với exponential backoff
 * 4. Comprehensive error logging
 */

// ============================================
// 1. FETCH WITH COMPREHENSIVE ERROR HANDLING
// ============================================

interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Fetch an URL with comprehensive error handling
 * @param url - The URL to fetch
 * @param options - Fetch options including timeout, retries, etc
 * @returns Response or throws error with details
 */
export async function safeFetch(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    timeout = 10000,
    retries = 3,
    retryDelay = 1000,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Log successful response with CORS info
      console.log(`✅ Fetch successful (${response.status}):`, {
        url,
        method: fetchOptions.method || 'GET',
        corsOrigin: response.headers.get('Access-Control-Allow-Origin'),
        contentType: response.headers.get('Content-Type'),
        attempt: attempt + 1,
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${errorData || response.statusText}`
        );
      }

      return response;
    } catch (error) {
      lastError = error as Error;

      // Log error details
      console.error(`❌ Fetch attempt ${attempt + 1} failed:`, {
        url,
        method: fetchOptions.method || 'GET',
        error: lastError.message,
        errorType: lastError.name,
        attempt: attempt + 1,
        retriesLeft: retries - attempt,
      });

      // Handle specific error types
      if (lastError.name === 'AbortError') {
        console.error('⏱️  Request timeout');
      } else if (lastError.message.includes('Failed to fetch')) {
        console.error('🚨 Network error - CORS or network connectivity issue');
        console.error('📋 Tips:');
        console.error('   - Check server CORS headers: Access-Control-Allow-Origin');
        console.error('   - Check server is running and reachable');
        console.error('   - Check browser console for CORS errors');
        console.error('   - Verify request headers are correct');
      }

      // Retry with exponential backoff
      if (attempt < retries) {
        const delay = retryDelay * Math.pow(2, attempt);
        console.log(`⏳ Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retries failed
  throw new Error(
    `Failed to fetch after ${retries + 1} attempts: ${lastError?.message}`
  );
}

// ============================================
// 2. JSON FETCH WITH RETRY AND ERROR HANDLING
// ============================================

export interface JsonFetchOptions extends FetchOptions {
  headers?: Record<string, string>;
  body?: any;
}

/**
 * Fetch JSON data with comprehensive error handling
 * Includes CORS headers logging and network error diagnostics
 */
export async function fetchJson<T = any>(
  url: string,
  options: JsonFetchOptions = {}
): Promise<T> {
  const { body, headers = {}, ...fetchOptions } = options;

  // Set default headers for JSON
  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...headers,
  };

  try {
    const response = await safeFetch(url, {
      ...fetchOptions,
      method: body ? 'POST' : options.method || 'GET',
      headers: finalHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Log CORS headers from response
    const corsHeaders = {
      'Access-Control-Allow-Origin': response.headers.get(
        'Access-Control-Allow-Origin'
      ),
      'Access-Control-Allow-Methods': response.headers.get(
        'Access-Control-Allow-Methods'
      ),
      'Access-Control-Allow-Headers': response.headers.get(
        'Access-Control-Allow-Headers'
      ),
      'Access-Control-Allow-Credentials': response.headers.get(
        'Access-Control-Allow-Credentials'
      ),
    };

    console.log('📊 CORS Headers in Response:', corsHeaders);

    const data = await response.json();
    return data as T;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('❌ JSON Fetch Error:', errorMsg);

    // Provide debugging information
    console.group('🔍 Debugging Information:');
    console.log('URL:', url);
    console.log('Method:', options.method || 'GET');
    console.log('Headers:', finalHeaders);
    console.log('Body:', body);
    console.log('Error:', errorMsg);
    console.groupEnd();

    throw error;
  }
}

// ============================================
// 3. POST REQUEST WITH CORS HANDLING
// ============================================

export interface PostOptions extends JsonFetchOptions {
  retries?: number;
}

/**
 * POST request with built-in CORS and error handling
 */
export async function postJson<T = any>(
  url: string,
  body: any,
  options: PostOptions = {}
): Promise<T> {
  console.log('📤 Sending POST request:', {
    url,
    body,
    headers: options.headers,
  });

  return fetchJson<T>(url, {
    ...options,
    method: 'POST',
    body,
    retries: options.retries ?? 3,
  });
}

// ============================================
// 4. ERROR REPORTER FOR PRODUCTION
// ============================================

interface ErrorLog {
  timestamp: string;
  url: string;
  method: string;
  status?: number;
  error: string;
  errorType: string;
  userAgent: string;
  correlationId: string;
  attemptCount?: number;
}

/**
 * Log errors to monitoring service (for production)
 * Can be integrated with Sentry, DataDog, or custom backend
 */
export async function reportError(errorLog: Omit<ErrorLog, 'timestamp' | 'userAgent' | 'correlationId'>) {
  const log: ErrorLog = {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    correlationId: generateCorrelationId(),
    ...errorLog,
  };

  console.error('📋 Error Log:', log);

  // Uncomment for production monitoring
  // try {
  //   await fetch('/api/logs/errors', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify(log),
  //   });
  // } catch (err) {
  //   console.error('Failed to report error:', err);
  // }
}

// ============================================
// 5. UTILITY FUNCTIONS
// ============================================

/**
 * Generate unique correlation ID for tracing
 */
function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if error is CORS-related
 */
export function isCorsError(error: Error): boolean {
  return (
    error.message.includes('Failed to fetch') ||
    error.message.includes('CORS') ||
    error.name === 'TypeError'
  );
}

/**
 * Format error message for user display
 */
export function formatErrorForUser(error: Error): string {
  if (isCorsError(error)) {
    return 'Lỗi kết nối đến máy chủ. Vui lòng kiểm tra cấu hình mạng và thử lại.';
  }
  if (error.message.includes('timeout')) {
    return 'Yêu cầu quá lâu. Vui lòng thử lại.';
  }
  return error.message || 'Đã xảy ra lỗi không xác định.';
}

// ============================================
// 6. EXAMPLE USAGE
// ============================================

/*
// Example 1: Simple POST request with error handling
async function register() {
  try {
    const response = await postJson('/api/auth/register', {
      email: 'user@example.com',
      username: 'testuser',
      password: 'Test@123456',
      confirm_password: 'Test@123456',
    });
    console.log('✅ Registration successful:', response);
  } catch (error) {
    const userMessage = formatErrorForUser(error as Error);
    console.error('❌ Registration failed:', userMessage);
    
    await reportError({
      url: '/api/auth/register',
      method: 'POST',
      error: (error as Error).message,
      errorType: (error as Error).name,
    });
  }
}

// Example 2: Fetch with custom retry logic
async function getUser() {
  try {
    const user = await fetchJson('/api/users/me', {
      retries: 5,
      timeout: 15000,
    });
    console.log('User:', user);
  } catch (error) {
    console.error('Failed to fetch user:', error);
  }
}

// Example 3: Check CORS before making request
async function checkServerHealth() {
  try {
    const response = await safeFetch('http://localhost:8000/health');
    const data = await response.json();
    console.log('Server status:', data);
  } catch (error) {
    console.error('Server is unreachable');
  }
}
*/
