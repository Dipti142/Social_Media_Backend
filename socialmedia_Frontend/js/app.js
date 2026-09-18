/**
 * SocialSync - Main Application Controller
 */

// Application State
const AppState = {
  activeTab: 'login', // 'login' | 'register' | 'sendOtp' | 'verifyOtp'
  otpEmail: '',
  otpTimerInterval: null,
  otpCountdown: 0,
  inspectorEndpoint: 'login',
  mockPosts: [
    {
      id: 1,
      author: 'Sarah Jenkins',
      handle: '@sarahj',
      avatar: 'SJ',
      time: '20m ago',
      content: 'Just deployed the new auth microservices with OTP verification and JWT token rotation! 🚀 The backend latency is down to 14ms.',
      likes: 42,
      isLiked: false,
      comments: [
        { author: 'Alex Chen', text: 'Looks blazing fast! Great job!' }
      ]
    },
    {
      id: 2,
      author: 'David Rivera',
      handle: '@david_tech',
      avatar: 'DR',
      time: '2h ago',
      content: 'Building ultra-responsive glassmorphic UIs is so satisfying. Here is a snapshot of our latest social dashboard! 🎨✨',
      likes: 128,
      isLiked: true,
      comments: []
    }
  ]
};

// DOM Content Loaded Initializer
document.addEventListener('DOMContentLoaded', () => {
  initServerHealthCheck();
  initAuthTabs();
  initOtpInputs();
  initForms();
  initSessionState();
  initApiInspector();
  renderFeed();
});

/* ==========================================================================
   Toast Notification System
   ========================================================================== */

function showToast(message, type = 'info', duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span style="font-weight: 800; font-size: 16px;">${icons[type] || 'ℹ'}</span>
    <span style="flex: 1;">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ==========================================================================
   Server Health Monitor
   ========================================================================== */

async function initServerHealthCheck() {
  const statusPill = document.getElementById('backend-status-pill');
  const statusText = document.getElementById('backend-status-text');

  async function check() {
    try {
      const res = await window.apiClient.checkHealth();
      if (res.ok && res.data && res.data.success) {
        statusPill.className = 'status-pill online';
        statusText.textContent = `Backend Online (${res.latencyMs}ms)`;
      } else {
        statusPill.className = 'status-pill offline';
        statusText.textContent = 'Backend Offline';
      }
    } catch {
      statusPill.className = 'status-pill offline';
      statusText.textContent = 'Backend Offline';
    }
  }

  check();
  setInterval(check, 10000);
}

/* ==========================================================================
   Session & View Management
   ========================================================================== */

function initSessionState() {
  const user = window.apiClient.getUser();
  const token = window.apiClient.getAccessToken();

  if (user && token) {
    showDashboardView(user);
  } else {
    showAuthView();
  }
}

function showAuthView() {
  document.getElementById('auth-wrapper').style.display = 'block';
  document.getElementById('dashboard-container').classList.remove('active');
  document.getElementById('nav-user-profile').style.display = 'none';
  document.getElementById('nav-login-btn').style.display = 'inline-flex';
}

function showDashboardView(user) {
  document.getElementById('auth-wrapper').style.display = 'none';
  document.getElementById('dashboard-container').classList.add('active');
  document.getElementById('nav-login-btn').style.display = 'none';
  document.getElementById('nav-user-profile').style.display = 'flex';

  // Populate profile info
  const initials = (user.username || 'User').slice(0, 2).toUpperCase();
  document.getElementById('profile-avatar-initials').textContent = initials;
  document.getElementById('profile-display-username').textContent = `@${user.username}`;
  document.getElementById('profile-display-email').textContent = user.email;
  document.getElementById('profile-display-role').textContent = user.role || 'user';

  // Verification status pill
  const badgeWrap = document.getElementById('profile-badge-indicator');
  if (user.isVerified) {
    badgeWrap.innerHTML = `<span class="verified-badge" title="Verified Account">✓</span>`;
    document.getElementById('verification-banner')?.remove();
  } else {
    badgeWrap.innerHTML = `<span class="unverified-badge" title="Unverified Account">!</span>`;
    showVerificationPrompt(user.email);
  }

  // Token debug display
  updateTokenDisplay();
}

function showVerificationPrompt(email) {
  let banner = document.getElementById('verification-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'verification-banner';
    banner.className = 'session-card';
    banner.style.borderLeft = '4px solid var(--warning)';
    banner.innerHTML = `
      <h3 style="color: var(--warning); margin-bottom: 6px;">⚠️ Account Not Verified</h3>
      <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 12px;">
        Please verify your email address (<strong>${email}</strong>) with an OTP to secure your account.
      </p>
      <div style="display: flex; gap: 8px;">
        <button class="btn btn-primary btn-sm" id="btn-banner-verify">Verify with OTP</button>
        <button class="btn btn-secondary btn-sm" id="btn-banner-resend">Send Code</button>
      </div>
    `;

    const feedCol = document.querySelector('.feed-column');
    if (feedCol) feedCol.prepend(banner);

    document.getElementById('btn-banner-verify')?.addEventListener('click', () => {
      AppState.otpEmail = email;
      switchAuthTab('verifyOtp');
      document.getElementById('verify-otp-email').value = email;
      document.getElementById('auth-wrapper').style.display = 'block';
    });

    document.getElementById('btn-banner-resend')?.addEventListener('click', async () => {
      const res = await window.apiClient.sendOtp(email);
      if (res.ok) {
        showToast(res.data.message || 'OTP sent to email!', 'success');
        AppState.otpEmail = email;
        switchAuthTab('verifyOtp');
        document.getElementById('verify-otp-email').value = email;
        document.getElementById('auth-wrapper').style.display = 'block';
      } else {
        showToast(res.data.message || 'Failed to send OTP', 'error');
      }
    });
  }
}

function updateTokenDisplay() {
  const tokenEl = document.getElementById('debug-access-token');
  const refreshEl = document.getElementById('debug-refresh-token');
  if (tokenEl) tokenEl.textContent = window.apiClient.getAccessToken() || 'None';
  if (refreshEl) refreshEl.textContent = window.apiClient.getRefreshToken() || 'None';
}

/* ==========================================================================
   Tab Navigation & Form Handlers
   ========================================================================== */

function initAuthTabs() {
  const tabBtns = document.querySelectorAll('.auth-tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabKey = btn.getAttribute('data-tab');
      switchAuthTab(tabKey);
    });
  });

  // Switch links
  document.getElementById('link-to-register')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchAuthTab('register');
  });
  document.getElementById('link-to-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchAuthTab('login');
  });
  document.getElementById('link-to-send-otp')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchAuthTab('sendOtp');
  });
  document.getElementById('link-to-verify-otp')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchAuthTab('verifyOtp');
  });
}

function switchAuthTab(tabKey) {
  AppState.activeTab = tabKey;

  // Update tabs UI
  document.querySelectorAll('.auth-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabKey);
  });

  // Update Views
  document.querySelectorAll('.auth-view').forEach(view => {
    view.classList.toggle('active', view.id === `view-${tabKey}`);
  });

  // If switching to verify OTP and email is available
  if (tabKey === 'verifyOtp' && AppState.otpEmail) {
    const emailInput = document.getElementById('verify-otp-email');
    if (emailInput && !emailInput.value) {
      emailInput.value = AppState.otpEmail;
    }
  }
}

/* ==========================================================================
   OTP 6-Digit Box Controller
   ========================================================================== */

function initOtpInputs() {
  const inputs = document.querySelectorAll('.otp-box-input');

  inputs.forEach((input, index) => {
    // Keyup navigation
    input.addEventListener('keyup', (e) => {
      const val = input.value;

      if (val.length >= 1) {
        input.value = val.slice(0, 1);
        input.classList.add('filled');
        if (index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
      } else {
        input.classList.remove('filled');
      }

      // Handle Backspace
      if (e.key === 'Backspace' && index > 0 && val === '') {
        inputs[index - 1].focus();
      }

      // Check if all filled -> Auto submit
      const fullOtp = getEnteredOtp();
      if (fullOtp.length === 6) {
        document.getElementById('btn-verify-otp-submit')?.focus();
      }
    });

    // Paste handler for entire 6-digit OTP
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim();
      if (/^\d{6}$/.test(pasteData)) {
        pasteData.split('').forEach((char, i) => {
          if (inputs[i]) {
            inputs[i].value = char;
            inputs[i].classList.add('filled');
          }
        });
        inputs[5].focus();
        showToast('OTP pasted from clipboard', 'info');
      }
    });
  });
}

function getEnteredOtp() {
  const inputs = document.querySelectorAll('.otp-box-input');
  let otp = '';
  inputs.forEach(input => {
    otp += input.value;
  });
  return otp;
}

function clearOtpInputs() {
  const inputs = document.querySelectorAll('.otp-box-input');
  inputs.forEach(input => {
    input.value = '';
    input.classList.remove('filled');
  });
  if (inputs[0]) inputs[0].focus();
}

function startOtpCountdown(seconds = 60) {
  clearInterval(AppState.otpTimerInterval);
  AppState.otpCountdown = seconds;

  const resendBtn = document.getElementById('btn-resend-otp');
  const timerText = document.getElementById('otp-timer-display');

  if (resendBtn) resendBtn.disabled = true;

  AppState.otpTimerInterval = setInterval(() => {
    AppState.otpCountdown--;
    if (timerText) timerText.textContent = `(Resend in ${AppState.otpCountdown}s)`;

    if (AppState.otpCountdown <= 0) {
      clearInterval(AppState.otpTimerInterval);
      if (resendBtn) resendBtn.disabled = false;
      if (timerText) timerText.textContent = '';
    }
  }, 1000);
}

/* ==========================================================================
   Form Submissions (Register, Login, Send OTP, Verify OTP)
   ========================================================================== */

function initForms() {
  // 1. REGISTER FORM
  const formRegister = document.getElementById('form-register');
  formRegister?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    const btn = document.getElementById('btn-register-submit');
    btn.disabled = true;
    btn.textContent = 'Creating Account...';

    const res = await window.apiClient.register({ username, email, password });
    btn.disabled = false;
    btn.textContent = 'Create Account';

    if (res.ok && res.data.success) {
      showToast('Registration successful! Sending verification OTP...', 'success');
      AppState.otpEmail = email;

      // Automatically request OTP for the user
      await window.apiClient.sendOtp(email);
      startOtpCountdown(60);

      // Route to Verify OTP view
      switchAuthTab('verifyOtp');
      document.getElementById('verify-otp-email').value = email;
    } else {
      showToast(res.data.message || 'Registration failed', 'error');
    }
  });

  // Password Strength Meter for Register
  const regPassword = document.getElementById('reg-password');
  regPassword?.addEventListener('input', () => {
    const val = regPassword.value;
    const meter = document.getElementById('reg-password-meter');
    if (!meter) return;

    let score = 0;
    if (val.length >= 6) score += 25;
    if (/[A-Z]/.test(val)) score += 25;
    if (/[0-9]/.test(val)) score += 25;
    if (/[^A-Za-z0-9]/.test(val)) score += 25;

    meter.style.width = `${score}%`;
    if (score <= 25) meter.style.background = 'var(--danger)';
    else if (score <= 50) meter.style.background = 'var(--warning)';
    else if (score <= 75) meter.style.background = 'var(--info)';
    else meter.style.background = 'var(--success)';
  });

  // 2. LOGIN FORM
  const formLogin = document.getElementById('form-login');
  formLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('login-identifier').value.trim();
    const password = document.getElementById('login-password').value;

    const btn = document.getElementById('btn-login-submit');
    btn.disabled = true;
    btn.textContent = 'Signing in...';

    const isEmail = identifier.includes('@');
    const payload = isEmail
      ? { email: identifier, password }
      : { username: identifier, password };

    const res = await window.apiClient.login(payload);
    btn.disabled = false;
    btn.textContent = 'Sign In';

    if (res.ok && res.data.success) {
      showToast('Welcome back! Login successful.', 'success');
      showDashboardView(res.data.data.user);
    } else {
      showToast(res.data.message || 'Invalid username or password', 'error');
    }
  });

  // 3. SEND OTP FORM
  const formSendOtp = document.getElementById('form-send-otp');
  formSendOtp?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('send-otp-email').value.trim();

    const btn = document.getElementById('btn-send-otp-submit');
    btn.disabled = true;
    btn.textContent = 'Generating OTP...';

    const res = await window.apiClient.sendOtp(email);
    btn.disabled = false;
    btn.textContent = 'Send Verification Code';

    if (res.ok && res.data.success) {
      showToast(res.data.message || 'OTP sent successfully!', 'success');
      AppState.otpEmail = email;
      switchAuthTab('verifyOtp');
      document.getElementById('verify-otp-email').value = email;
      startOtpCountdown(60);
    } else {
      showToast(res.data.message || 'Failed to send OTP', 'error');
    }
  });

  // 4. VERIFY OTP FORM
  const formVerifyOtp = document.getElementById('form-verify-otp');
  formVerifyOtp?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('verify-otp-email').value.trim();
    const otp = getEnteredOtp();

    if (!email) {
      showToast('Please provide email address', 'warning');
      return;
    }

    if (otp.length !== 6) {
      showToast('Please enter all 6 digits of the OTP', 'warning');
      return;
    }

    const btn = document.getElementById('btn-verify-otp-submit');
    btn.disabled = true;
    btn.textContent = 'Verifying...';

    const res = await window.apiClient.verifyOtp(email, otp);
    btn.disabled = false;
    btn.textContent = 'Verify Code';

    if (res.ok && res.data.success) {
      showToast('🎉 OTP Verified Successfully!', 'success');
      clearOtpInputs();

      const loggedInUser = window.apiClient.getUser();
      if (loggedInUser && loggedInUser.email === email) {
        loggedInUser.isVerified = true;
        showDashboardView(loggedInUser);
      } else {
        // Direct to login
        switchAuthTab('login');
      }
    } else {
      showToast(res.data.message || 'Invalid or Expired OTP', 'error');
    }
  });

  // Resend OTP Button in Verify view
  document.getElementById('btn-resend-otp')?.addEventListener('click', async () => {
    const email = document.getElementById('verify-otp-email').value.trim();
    if (!email) {
      showToast('Please enter your email to resend OTP', 'warning');
      return;
    }

    const res = await window.apiClient.sendOtp(email);
    if (res.ok) {
      showToast('New OTP sent to email!', 'success');
      clearOtpInputs();
      startOtpCountdown(60);
    } else {
      showToast(res.data.message || 'Failed to resend OTP', 'error');
    }
  });

  // Logout button
  document.querySelectorAll('.btn-logout-trigger').forEach(btn => {
    btn.addEventListener('click', async () => {
      await window.apiClient.logout();
      showToast('Logged out successfully', 'info');
      showAuthView();
      switchAuthTab('login');
    });
  });

  // Refresh Token Button
  document.getElementById('btn-manual-refresh-token')?.addEventListener('click', async () => {
    const res = await window.apiClient.refreshToken();
    if (res.ok && res.data.success) {
      showToast('JWT Access Token refreshed successfully!', 'success');
      updateTokenDisplay();
    } else {
      showToast(res.data.message || 'Refresh token expired. Please login again.', 'error');
    }
  });
}

/* ==========================================================================
   Feed & Post Interaction
   ========================================================================== */

function renderFeed() {
  const container = document.getElementById('feed-posts-container');
  if (!container) return;

  container.innerHTML = AppState.mockPosts.map(post => `
    <article class="feed-post-card" id="post-${post.id}">
      <div class="post-header">
        <div class="post-user-info">
          <div class="post-user-avatar">${post.avatar}</div>
          <div>
            <div class="post-user-name">${post.author} <span style="font-weight: 400; color: var(--text-muted); font-size: 12px;">${post.handle}</span></div>
            <div class="post-time">${post.time}</div>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" title="Post options">•••</button>
      </div>

      <div class="post-content">${post.content}</div>

      <div class="post-footer-actions">
        <button class="post-action-btn ${post.isLiked ? 'liked' : ''}" onclick="toggleLikePost(${post.id})">
          <span>${post.isLiked ? '❤️' : '🤍'}</span>
          <span>${post.likes}</span>
        </button>
        <button class="post-action-btn" onclick="focusComment(${post.id})">
          <span>💬</span>
          <span>${post.comments.length}</span>
        </button>
        <button class="post-action-btn" onclick="sharePost(${post.id})">
          <span>🔗</span>
          <span>Share</span>
        </button>
      </div>
    </article>
  `).join('');
}

window.toggleLikePost = function(postId) {
  const post = AppState.mockPosts.find(p => p.id === postId);
  if (!post) return;

  post.isLiked = !post.isLiked;
  post.likes += post.isLiked ? 1 : -1;
  renderFeed();
};

window.focusComment = function(postId) {
  showToast('Comment drawer ready for discussion', 'info');
};

window.sharePost = function(postId) {
  navigator.clipboard.writeText(window.location.href);
  showToast('Post link copied to clipboard!', 'success');
};

// Create Post form
document.getElementById('form-create-post')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const textarea = document.getElementById('create-post-text');
  const content = textarea.value.trim();
  if (!content) return;

  const user = window.apiClient.getUser() || { username: 'Current User' };

  AppState.mockPosts.unshift({
    id: Date.now(),
    author: user.username,
    handle: `@${user.username.toLowerCase()}`,
    avatar: user.username.slice(0, 2).toUpperCase(),
    time: 'Just now',
    content,
    likes: 0,
    isLiked: false,
    comments: []
  });

  textarea.value = '';
  renderFeed();
  showToast('Post published to feed!', 'success');
});

/* ==========================================================================
   Live API Inspector Modal & Live Tester
   ========================================================================== */

const API_ENDPOINTS_CONFIG = {
  health: {
    title: 'GET /health',
    method: 'GET',
    endpoint: '/health',
    desc: 'Verify that backend API server is healthy and responding.',
    sampleBody: null
  },
  register: {
    title: 'POST /api/v1/auth/register',
    method: 'POST',
    endpoint: '/api/v1/auth/register',
    desc: 'Register a new user with username, email, and password.',
    sampleBody: {
      username: 'johndoe',
      email: 'johndoe@example.com',
      password: 'SuperSecret123!'
    }
  },
  login: {
    title: 'POST /api/v1/auth/login',
    method: 'POST',
    endpoint: '/api/v1/auth/login',
    desc: 'Authenticate user with email/username and password. Returns JWT tokens.',
    sampleBody: {
      email: 'johndoe@example.com',
      password: 'SuperSecret123!'
    }
  },
  sendOtp: {
    title: 'POST /api/v1/auth/send-otp',
    method: 'POST',
    endpoint: '/api/v1/auth/send-otp',
    desc: 'Generate 6-digit verification OTP and deliver via Nodemailer.',
    sampleBody: {
      email: 'johndoe@example.com',
      type: 'verification'
    }
  },
  verifyOtp: {
    title: 'POST /api/v1/auth/verify-otp',
    method: 'POST',
    endpoint: '/api/v1/auth/verify-otp',
    desc: 'Verify matching OTP code and activate user verified status.',
    sampleBody: {
      email: 'johndoe@example.com',
      otp: '123456',
      type: 'verification'
    }
  },
  refreshToken: {
    title: 'POST /api/v1/auth/refresh-token',
    method: 'POST',
    endpoint: '/api/v1/auth/refresh-token',
    desc: 'Rotate JWT tokens using an existing active Refresh Token.',
    sampleBody: {
      refreshToken: '<PASTE_REFRESH_TOKEN_HERE>'
    }
  },
  logout: {
    title: 'POST /api/v1/auth/logout',
    method: 'POST',
    endpoint: '/api/v1/auth/logout',
    desc: 'Invalidate refresh token and end session.',
    sampleBody: {
      refreshToken: '<PASTE_REFRESH_TOKEN_HERE>'
    }
  }
};

function initApiInspector() {
  const modalBackdrop = document.getElementById('api-inspector-modal');
  const openBtns = document.querySelectorAll('.btn-open-api-inspector');
  const closeBtn = document.getElementById('btn-close-api-inspector');

  openBtns.forEach(b => b.addEventListener('click', () => {
    modalBackdrop.classList.add('open');
    selectInspectorEndpoint('health');
  }));

  closeBtn?.addEventListener('click', () => {
    modalBackdrop.classList.remove('open');
  });

  modalBackdrop?.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) modalBackdrop.classList.remove('open');
  });

  // Endpoints list clicks
  document.querySelectorAll('.api-endpoint-item').forEach(item => {
    item.addEventListener('click', () => {
      const epKey = item.getAttribute('data-endpoint');
      selectInspectorEndpoint(epKey);
    });
  });

  // Run Test Button
  document.getElementById('btn-run-inspector-request')?.addEventListener('click', runInspectorTest);
}

function selectInspectorEndpoint(epKey) {
  AppState.inspectorEndpoint = epKey;
  const config = API_ENDPOINTS_CONFIG[epKey];
  if (!config) return;

  document.querySelectorAll('.api-endpoint-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-endpoint') === epKey);
  });

  document.getElementById('inspector-title').textContent = config.title;
  document.getElementById('inspector-desc').textContent = config.desc;

  const payloadTextarea = document.getElementById('inspector-payload');
  if (config.sampleBody) {
    // If refreshToken and token exists in localStorage, auto-populate
    if (epKey === 'refreshToken' || epKey === 'logout') {
      const sample = { ...config.sampleBody };
      sample.refreshToken = window.apiClient.getRefreshToken() || sample.refreshToken;
      payloadTextarea.value = JSON.stringify(sample, null, 2);
    } else {
      payloadTextarea.value = JSON.stringify(config.sampleBody, null, 2);
    }
    payloadTextarea.disabled = false;
  } else {
    payloadTextarea.value = '// No request body needed for this endpoint';
    payloadTextarea.disabled = true;
  }

  // Clear previous response
  document.getElementById('inspector-response').textContent = '// Click "Send Request" to inspect live response';
  document.getElementById('inspector-status-badge').textContent = 'READY';
  document.getElementById('inspector-status-badge').style.background = 'rgba(255,255,255,0.1)';
}

async function runInspectorTest() {
  const epKey = AppState.inspectorEndpoint;
  const config = API_ENDPOINTS_CONFIG[epKey];
  if (!config) return;

  let body = null;
  if (config.sampleBody) {
    try {
      body = JSON.parse(document.getElementById('inspector-payload').value);
    } catch (err) {
      showToast('Invalid JSON in Request Payload editor', 'error');
      return;
    }
  }

  const runBtn = document.getElementById('btn-run-inspector-request');
  runBtn.disabled = true;
  runBtn.textContent = 'Sending...';

  const res = await window.apiClient.request(config.endpoint, {
    method: config.method,
    body: body
  });

  runBtn.disabled = false;
  runBtn.textContent = 'Send Request 🚀';

  // Render Response
  const respEl = document.getElementById('inspector-response');
  respEl.textContent = JSON.stringify(res.data, null, 2);

  const badgeEl = document.getElementById('inspector-status-badge');
  badgeEl.textContent = `${res.status || 'ERR'} (${res.latencyMs}ms)`;

  if (res.ok) {
    badgeEl.style.background = 'rgba(16, 185, 129, 0.3)';
    badgeEl.style.color = '#34d399';
  } else {
    badgeEl.style.background = 'rgba(239, 68, 68, 0.3)';
    badgeEl.style.color = '#f87171';
  }
}
