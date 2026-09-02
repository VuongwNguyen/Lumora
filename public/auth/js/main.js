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
  // Dọn trạng thái lỗi của màn hình vừa rời: nếu không, quay lại sẽ thấy ô viền
  // đỏ kèm thông báo cũ đã mất ngữ cảnh.
  document.querySelectorAll('[aria-invalid="true"]').forEach(function(el) {
    markField(el.id, false);
  });
}

function setMsg(id, text, type) {
  var el = document.getElementById(id);
  el.className = 'msg' + (type ? ' ' + type : '');
  el.textContent = '';
  if (type === 'error' && text) {
    // Lỗi và nút hành động chính đều thuộc họ đỏ trong bảng màu sơn mài — icon
    // đứng trước chữ để không lẫn nhau khi chỉ phân biệt được bằng màu.
    var icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '⚠ ';
    el.appendChild(icon);
  }
  el.appendChild(document.createTextNode(text));
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
var OTP_RE = /^\d{6}$/;
var MIN_PASSWORD = 8;

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

function clearFields() {
  for (var i = 0; i < arguments.length; i++) markField(arguments[i], false);
}

// Trả về true nếu HỢP LỆ. Nếu sai thì hiện thông báo, tô ô sai và focus vào nó.
// Mọi form auth đều dùng novalidate nên đây là nơi DUY NHẤT chặn dữ liệu xấu ở
// FE — bỏ sót một nhánh là mất luôn kiểm tra, không còn tooltip trình duyệt đỡ.
function checkFields(msgId, formName, rules) {
  for (var i = 0; i < rules.length; i++) {
    var rule = rules[i];
    if (rule.ok) continue;
    // Giữ đúng convention tracking sẵn có của form-reset (AGENTS.md mục 9):
    // submit bị chặn ở FE vẫn phải được ghi nhận, nếu không việc chuyển validate
    // từ server về client sẽ làm mất luôn số liệu lỗi nhập liệu.
    window.LumoraActivity?.logBlocked('Auth Submit Blocked', 'invalid_input', { form: formName, fields: [rule.field] });
    setMsg(msgId, rule.message, 'error');
    markField(rule.field, true, msgId);
    var el = document.getElementById(rule.field);
    if (el) el.focus();
    return false;
  }
  return true;
}

function emailRules(field, value) {
  return [
    { field: field, ok: !!value, message: window.t.errEmailRequired },
    { field: field, ok: EMAIL_RE.test(value), message: window.t.errEmailInvalid },
  ];
}

function passwordRules(field, value) {
  return [
    { field: field, ok: !!value, message: window.t.errPasswordRequired },
    { field: field, ok: value.length >= MIN_PASSWORD, message: window.t.errPasswordShort },
  ];
}

function otpRules(field, value) {
  return [
    { field: field, ok: !!value, message: window.t.errOtpRequired },
    { field: field, ok: OTP_RE.test(value), message: window.t.errOtpFormat },
  ];
}

document.getElementById('form-auth').addEventListener('submit', async function(e) {
  e.preventDefault();
  var email = document.getElementById('email').value;
  var password = document.getElementById('password').value;
  var label = mode === 'login' ? window.t.btnLogin : window.t.btnRegister;
  setMsg('msg-auth', '', '');
  clearFields('email', 'password');
  if (!checkFields('msg-auth', mode, emailRules('email', email).concat(passwordRules('password', password)))) return;

  setLoading('submit-btn', true, window.t.processing);

  try {
    var res = await fetch('/auth/' + mode, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password }),
    });
    var data = await res.json();

    // So MÃ, không so chuỗi: luồng này từng phụ thuộc message.includes('not
    // verified') nên dịch message sang tiếng Việt là màn hình OTP không bao giờ
    // hiện, hỏng âm thầm và không test nào bắt được.
    if (window.LumoraErrors.is(data, 'EMAIL_NOT_VERIFIED')) {
      showOtpScreen(email);
      return;
    }
    if (!res.ok) {
      setMsg('msg-auth', window.LumoraErrors.resolve(data, window.t), 'error');
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
  clearFields('otp');
  if (!checkFields('msg-otp', 'verify_otp', otpRules('otp', otp))) return;
  setLoading('verify-btn', true, window.t.verifying);

  try {
    var res = await fetch('/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingEmail, otp: otp }),
    });
    var data = await res.json();
    if (!res.ok) {
      setMsg('msg-otp', window.LumoraErrors.resolve(data, window.t, window.t.errOtp), 'error');
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
      setMsg('msg-otp', window.LumoraErrors.resolve(data, window.t, window.t.errOtpSend), 'error');
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
  clearFields('forgot-email');
  if (!checkFields('msg-forgot', 'forgot_password', emailRules('forgot-email', email))) return;
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

  setMsg('msg-reset', '', '');
  clearFields('reset-otp', 'new-password', 'confirm-password');
  if (!checkFields('msg-reset', 'reset_password',
      otpRules('reset-otp', otp)
        .concat(passwordRules('new-password', newPassword))
        .concat([{ field: 'confirm-password', ok: newPassword === confirmPassword, message: window.t.errPasswordMismatch }]))) return;

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
