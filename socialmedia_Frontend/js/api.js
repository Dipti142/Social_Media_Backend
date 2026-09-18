/**
 * SocialSync API Client
 * Connects to all backend endpoints:
 * - POST /api/v1/auth/register
 * - POST /api/v1/auth/login
 * - POST /api/v1/auth/send-otp
 * - POST /api/v1/auth/verify-otp
 * - POST /api/v1/auth/refresh-token
 * - POST /api/v1/auth/logout
 * - GET  /health
 */

const API_BASE_URL = window.location.origin.includes('localhost:3000') || window.location.origin.includes('127.0.0.1:3000')
  ? '' // Same origin when served by Express
  : 'http://localhost:3000'; // Default API host

const TOKEN_KEY = 'socialsync_access_token';
const REFRESH_TOKEN_KEY = 'socialsync_refresh_token';
const USER_KEY = 'socialsync_user';

class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  // Token storage helpers
  getAccessToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  getRefreshToken() {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  getUser() {
    const raw = localStorage.getItem(USER_KEY);
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  saveSession(accessToken, refreshToken, user) {
    if (accessToken) localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  // Generic request wrapper
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const accessToken = this.getAccessToken();
    if (accessToken && !headers.Authorization) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const config = {
      ...options,
      headers,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    const startTime = performance.now();
    try {
      const response = await fetch(url, config);
      const latencyMs = Math.round(performance.now() - startTime);

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = { message: await response.text() };
      }

      return {
        ok: response.ok,
        status: response.status,
        latencyMs,
        data,
      };
    } catch (error) {
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        ok: false,
        status: 0,
        latencyMs,
        data: {
          success: false,
          message: error.message || 'Network error: Cannot reach server',
        },
      };
    }
  }

  // 1. Health Check
  async checkHealth() {
    return this.request('/health', { method: 'GET' });
  }

  // 2. User Registration (POST /api/v1/auth/register)
  async register({ username, email, password }) {
    return this.request('/api/v1/auth/register', {
      method: 'POST',
      body: { username, email, password },
    });
  }

  // 3. User Login (POST /api/v1/auth/login)
  async login({ email, username, password }) {
    const payload = { password };
    if (email) payload.email = email;
    if (username) payload.username = username;

    const res = await this.request('/api/v1/auth/login', {
      method: 'POST',
      body: payload,
    });

    if (res.ok && res.data && res.data.data) {
      const { accessToken, refreshToken, user } = res.data.data;
      this.saveSession(accessToken, refreshToken, user);
    }

    return res;
  }

  // 4. Send OTP (POST /api/v1/auth/send-otp)
  async sendOtp(email, type = 'verification') {
    return this.request('/api/v1/auth/send-otp', {
      method: 'POST',
      body: { email, type },
    });
  }

  // 5. Verify OTP (POST /api/v1/auth/verify-otp)
  async verifyOtp(email, otp, type = 'verification') {
    const res = await this.request('/api/v1/auth/verify-otp', {
      method: 'POST',
      body: { email, otp, type },
    });

    if (res.ok && res.data && res.data.data && res.data.data.user) {
      const currentUser = this.getUser();
      if (currentUser && currentUser.email === email) {
        currentUser.isVerified = true;
        localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
      }
    }

    return res;
  }

  // 6. Refresh Token (POST /api/v1/auth/refresh-token)
  async refreshToken() {
    const token = this.getRefreshToken();
    if (!token) {
      return {
        ok: false,
        status: 400,
        data: { success: false, message: 'No refresh token stored' },
      };
    }

    const res = await this.request('/api/v1/auth/refresh-token', {
      method: 'POST',
      body: { refreshToken: token },
    });

    if (res.ok && res.data && res.data.data) {
      const { accessToken, refreshToken, user } = res.data.data;
      this.saveSession(accessToken, refreshToken, user);
    }

    return res;
  }

  // 7. Logout (POST /api/v1/auth/logout)
  async logout() {
    const refreshToken = this.getRefreshToken();
    const accessToken = this.getAccessToken();

    const res = await this.request('/api/v1/auth/logout', {
      method: 'POST',
      body: { refreshToken },
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });

    this.clearSession();
    return res;
  }
}

// Export singleton instance
window.apiClient = new ApiClient(API_BASE_URL);
