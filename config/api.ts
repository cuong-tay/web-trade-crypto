// API Base URL Configuration
// Automatically detects the correct backend URL based on where the frontend is running

export const API_BASE_URL = 'http://127.0.0.1:8000/api';

// If you need to support multiple environments, use this:
// export const API_BASE_URL = 
//   window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
//     ? 'http://127.0.0.1:8000/api' 
//     : `http://192.168.1.57:8000/api`;

console.log(`🌐 API_BASE_URL configured to: ${API_BASE_URL}`);
