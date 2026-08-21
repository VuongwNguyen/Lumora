import { playTransition } from './transition.js';

// Guard: đã đăng nhập → về portal
if (localStorage.getItem('token')) {
  window.LumoraActivity?.log({ action: 'Auth Already Authenticated Redirect', feature: 'auth' });
  window.location.replace('/portal/');
}

var mode = 'login';
var pendingEmail = '';
var resendTimer = null;

function syncAuthModeContent() {
  var isLogin = mode === 'login';
  document.getElementById('auth-kicker').textContent = isLogin ? window.t.authLoginKicker : window.t.authRegisterKicker;
  document.getElementById('auth-heading').textContent = isLogin ? window.t.authLoginHeading : window.t.authRegisterHeading;
  document.getElementById('auth-description').textContent = isLogin ? window.t.authLoginDescription : window.t.authRegisterDescription;
  document.getElementById('tab-login').setAttribute('aria-selected', String(isLogin));
  document.getElementById('tab-register').setAttribute('aria-selected', String(!isLogin));
  document.getElementById('password').autocomplete = isLogin ? 'current-password' : 'new-password';
}

function showScreen(name) {
  document.querySelectorAll('.screen').forEach(function(s) {
    s.classList.remove('active');
  });
  document.getElementById('screen-' + name).classList.add('active');
}

function setMsg(id, text, type) {
  var el = document.getElementById(id);
  el.className = 'msg' + (type ? ' ' + type : '');
  el.textContent = text;
}

function setLoading(btnId, loading, label) {
  var btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.textContent = '';
  if (loading) {
    var spinner = document.createElement('span');
    spinner.className = 'spinner';
    btn.appendChild(spinner);
  }
  var text = document.createTextNode(label);
  btn.appendChild(text);
}

function startResendCountdown(seconds) {
  var btn = document.getElementById('btn-resend');
  btn.disabled = true;
  var remaining = seconds;
  btn.textContent = window.t.btnResendCountdown(remaining);
  resendTimer = setInterval(function() {
    remaining--;
    if (remaining <= 0) {
      clearInterval(resendTimer);
      btn.disabled = false;
      btn.textContent = window.t.btnResend;
    } else {
      btn.textContent = window.t.btnResendCountdown(remaining);
    }
  }, 1000);
}

function showOtpScreen(email, countdown) {
  pendingEmail = email;
  document.getElementById('otp-email-display').textContent = email;
  document.getElementById('otp').value = '';
  setMsg('msg-otp', '', '');
  setLoading('verify-btn', false, window.t.btnVerify);
  showScreen('otp');
  if (resendTimer) clearInterval(resendTimer);
  startResendCountdown(countdown || 60);
}

document.getElementById('tab-login').addEventListener('click', function() {
  mode = 'login';
  document.getElementById('tab-login').classList.add('active');
  document.getElementById('tab-register').classList.remove('active');
  setLoading('submit-btn', false, window.t.btnLogin);
  setMsg('msg-auth', '', '');
  syncAuthModeContent();
});

document.getElementById('tab-register').addEventListener('click', function() {
  mode = 'register';
  document.getElementById('tab-register').classList.add('active');
  document.getElementById('tab-login').classList.remove('active');
  setLoading('submit-btn', false, window.t.btnRegister);
  setMsg('msg-auth', '', '');
  syncAuthModeContent();
});

syncAuthModeContent();

document.getElementById('back-btn').addEventListener('click', function() {
  showScreen('auth');
});

// Cùng luật với services/auth.service.js — để lệch là FE cho qua rồi BE chặn,
// người dùng nhận thông báo tiếng Anh từ server thay vì tiếng Việt tại chỗ.
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function markField(id, invalid, msgId) {
  var el = document.getElementById(id);
  if (!el) return;
  if (invalid) {
    el.setAttribute('aria-invalid', 'true');
    // Nối ô nhập với dòng thông báo: thiếu cái này thì screen reader đọc hai
    // thứ rời rạc và người dùng không biết thông báo nói về ô nào.
    if (msgId) el.setAttribute('aria-describedby', msgId);
  } else {
    el.removeAttribute('aria-invalid');
    el.removeAttribute('aria-describedby');
  }
}

// Chặn ngay ở FE các lỗi FE tự biết, để người dùng không phải chờ một vòng
// mạng mới biết mật khẩu ngắn. KHÔNG thay thế validate ở backend: đó vẫn là
// nơi quyết định, FE chỉ là lớp phản hồi nhanh.
function validateAuthInput(email, password) {
  if (!email) return { field: 'email', message: window.t.errEmailRequired };
  if (!EMAIL_RE.test(email)) return { field: 'email', message: window.t.errEmailInvalid };
  if (!password) return { field: 'password', message: window.t.errPasswordRequired };
  if (password.length < 8) return { field: 'password', message: window.t.errPasswordShort };
  return null;
}

document.getElementById('form-auth').addEventListener('submit', async function(e) {
  e.preventDefault();
  var email = document.getElementById('email').value;
  var password = document.getElementById('password').value;
  var label = mode === 'login' ? window.t.btnLogin : window.t.btnRegister;
  setMsg('msg-auth', '', '');
  markField('email', false);
  markField('password', false);

  var invalid = validateAuthInput(email, password);
  if (invalid) {
    setMsg('msg-auth', invalid.message, 'error');
    markField(invalid.field, true, 'msg-auth');
    document.getElementById(invalid.field).focus();
    return;
  }

  setLoading('submit-btn', true, window.t.processing);

  try {
    var res = await fetch('/auth/' + mode, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password }),
    });
    var data = await res.json();

    if (res.status === 403 && data.message && data.message.includes('not verified')) {
      showOtpScreen(email);
      return;
    }
    if (!res.ok) {
      setMsg('msg-auth', data.message || window.t.errGeneric, 'error');
      setLoading('submit-btn', false, label);
      return;
    }
    if (mode === 'register') {
      showOtpScreen(email);
      return;
    }
    localStorage.setItem('token', data.meta.token);
    localStorage.setItem('user', JSON.stringify(data.meta.user));
    setMsg('msg-auth', window.t.loginSuccess, 'success');
    if (data.meta.user.role === 'admin') {
      playTransition('/portal/');
    } else {
      setTimeout(function() { window.location.href = '/portal/'; }, 600);
    }
  } catch(err) {
    setMsg('msg-auth', window.t.errConnection, 'error');
    setLoading('submit-btn', false, label);
  }
});

document.getElementById('form-otp').addEventListener('submit', async function(e) {
  e.preventDefault();
  var otp = document.getElementById('otp').value;
  setMsg('msg-otp', '', '');
  setLoading('verify-btn', true, window.t.verifying);

  try {
    var res = await fetch('/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingEmail, otp: otp }),
    });
    var data = await res.json();
    if (!res.ok) {
      setMsg('msg-otp', data.message || window.t.errOtp, 'error');
      setLoading('verify-btn', false, window.t.btnVerify);
      return;
    }
    localStorage.setItem('token', data.meta.token);
    localStorage.setItem('user', JSON.stringify(data.meta.user));
    setMsg('msg-otp', window.t.verifySuccess, 'success');
    if (data.meta.user.role === 'admin') {
      playTransition('/portal/');
    } else {
      setTimeout(function() { window.location.href = '/portal/'; }, 600);
    }
  } catch(err) {
    setMsg('msg-otp', window.t.errConnection, 'error');
    setLoading('verify-btn', false, window.t.btnVerify);
  }
});

document.getElementById('btn-resend').addEventListener('click', async function() {
  setMsg('msg-otp', '', '');
  try {
    var res = await fetch('/auth/resend-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingEmail }),
    });
    var data = await res.json();
    if (!res.ok) {
      setMsg('msg-otp', data.message || window.t.errOtpSend, 'error');
      return;
    }
    setMsg('msg-otp', window.t.otpResent, 'success');
    startResendCountdown(60);
  } catch(err) {
    setMsg('msg-otp', window.t.errConnection, 'error');
  }
});

// ── Forgot Password ───────────────────────────────────────────────────────────

var forgotEmail = '';
var resetResendTimer = null;

function startResetResendCountdown(seconds) {
  var btn = document.getElementById('btn-resend-reset');
  btn.disabled = true;
  var remaining = seconds;
  btn.textContent = window.t.btnResendCountdown(remaining);
  resetResendTimer = setInterval(function() {
    remaining--;
    if (remaining <= 0) {
      clearInterval(resetResendTimer);
      btn.disabled = false;
      btn.textContent = window.t.btnResend;
    } else {
      btn.textContent = window.t.btnResendCountdown(remaining);
    }
  }, 1000);
}

document.getElementById('btn-forgot').addEventListener('click', function() {
  setMsg('msg-auth', '', '');
  document.getElementById('forgot-email').value = document.getElementById('email').value;
  showScreen('forgot');
});

document.getElementById('back-from-forgot').addEventListener('click', function() {
  showScreen('auth');
});

document.getElementById('back-from-reset').addEventListener('click', function() {
  showScreen('forgot');
});

document.getElementById('form-forgot').addEventListener('submit', async function(e) {
  e.preventDefault();
  var email = document.getElementById('forgot-email').value;
  setMsg('msg-forgot', '', '');
  setLoading('forgot-send-btn', true, window.t.processing);

  try {
    var res = await fetch('/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setLoading('forgot-send-btn', false, window.t.btnSendOtp);
    // Luôn chuyển sang màn nhập OTP (không tiết lộ email có tồn tại hay không)
    forgotEmail = email;
    document.getElementById('reset-email-display').textContent = email;
    document.getElementById('reset-otp').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-password').value = '';
    setMsg('msg-reset', window.t.forgotOtpSent, 'success');
    setLoading('reset-btn', false, window.t.btnResetPassword);
    if (resetResendTimer) clearInterval(resetResendTimer);
    startResetResendCountdown(60);
    showScreen('reset');
  } catch(err) {
    setMsg('msg-forgot', window.t.errConnection, 'error');
    setLoading('forgot-send-btn', false, window.t.btnSendOtp);
  }
});

document.getElementById('form-reset').addEventListener('submit', async function(e) {
  e.preventDefault();
  var otp = document.getElementById('reset-otp').value;
  var newPassword = document.getElementById('new-password').value;
  var confirmPassword = document.getElementById('confirm-password').value;

  if (newPassword !== confirmPassword) {
    window.LumoraActivity?.logBlocked('Auth Submit Blocked', 'invalid_input', { form: 'reset_password', fields: ['new_password', 'confirm_password'] });
    setMsg('msg-reset', window.t.errPasswordMismatch, 'error');
    return;
  }

  setMsg('msg-reset', '', '');
  setLoading('reset-btn', true, window.t.processing);

  try {
    // Bước 1: xác thực OTP
    var res1 = await fetch('/auth/verify-reset-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotEmail, otp }),
    });
    var data1 = await res1.json();
    if (!res1.ok) {
      setMsg('msg-reset', data1.message || window.t.errOtp, 'error');
      setLoading('reset-btn', false, window.t.btnResetPassword);
      return;
    }

    // Bước 2: đặt mật khẩu mới
    var res2 = await fetch('/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotEmail, newPassword }),
    });
    var data2 = await res2.json();
    if (!res2.ok) {
      setMsg('msg-reset', data2.message || window.t.errGeneric, 'error');
      setLoading('reset-btn', false, window.t.btnResetPassword);
      return;
    }

    setMsg('msg-reset', window.t.resetSuccess, 'success');
    if (resetResendTimer) clearInterval(resetResendTimer);
    setTimeout(function() {
      showScreen('auth');
      setMsg('msg-auth', '', '');
    }, 2000);
  } catch(err) {
    setMsg('msg-reset', window.t.errConnection, 'error');
    setLoading('reset-btn', false, window.t.btnResetPassword);
  }
});

document.getElementById('btn-resend-reset').addEventListener('click', async function() {
  setMsg('msg-reset', '', '');
  try {
    await fetch('/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: forgotEmail }),
    });
    setMsg('msg-reset', window.t.otpResent, 'success');
    startResetResendCountdown(60);
  } catch(err) {
    setMsg('msg-reset', window.t.errConnection, 'error');
  }
});
