const token = localStorage.getItem('token');
if (!token) window.location.href = '/auth/';

const user = JSON.parse(localStorage.getItem('user') || '{}');
document.getElementById('user-email').textContent = user.email || '';

// Admin: show admin panel button
if (user.role === 'admin') {
  const btn = document.getElementById('btn-admin-panel');
  const divider = document.getElementById('settings-divider');
  if (btn) {
    btn.style.display = '';
    if (divider) divider.style.display = '';
    btn.addEventListener('click', () => { window.location.href = '/admin/'; });
  }
}

// Settings dropdown
const settingsBtn = document.getElementById('btn-settings');
const settingsMenu = document.getElementById('settings-menu');
settingsBtn.addEventListener('click', function(e) {
  e.stopPropagation();
  settingsMenu.classList.toggle('open');
});
document.addEventListener('click', function() { settingsMenu.classList.remove('open'); });

// Goto account tab from dropdown
document.getElementById('btn-goto-account').addEventListener('click', function() {
  settingsMenu.classList.remove('open');
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-account').classList.add('active');
  loadSessions();
});

// Tab switching
function activateTab(tab) {
  const btn = Array.from(document.querySelectorAll('.tab-btn[data-tab]'))
    .find(function(candidate) { return candidate.getAttribute('data-tab') === tab; });
  const panel = document.getElementById('panel-' + tab);
  if (!btn || !panel) return false;

  document.querySelectorAll('.tab-btn').forEach(function(b) { b.classList.remove('active'); });
  document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
  btn.classList.add('active');
  panel.classList.add('active');
  if (tab === 'subscription' && window._loadSubscription) window._loadSubscription();
  if (tab === 'account') loadSessions();
  return true;
}

document.querySelectorAll('.tab-btn[data-tab]').forEach(function(btn) {
  btn.addEventListener('click', function() {
    activateTab(btn.getAttribute('data-tab'));
  });
});

// Cho phép CTA từ màn hình setup mở thẳng tab Subscription.
document.addEventListener('DOMContentLoaded', function() {
  const requestedTab = new URLSearchParams(window.location.search).get('tab');
  if (requestedTab) activateTab(requestedTab);
});

function clearLocalSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/auth/';
}

async function logout() {
  try {
    await fetch('/auth/logout', { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } });
  } catch (_) {}
  clearLocalSession();
}

function openModal() {
  document.getElementById('modal').classList.add('open');
  document.getElementById('galaxy-name').value = '';
  document.getElementById('modal-msg').textContent = '';
  document.getElementById('btn-create').disabled = false;
  document.getElementById('btn-create').textContent = window.t.btnCreate;
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

async function loadGalaxies() {
  const grid = document.getElementById('galaxy-grid');
  grid.textContent = '';
  try {
    const res = await fetch('/galaxies/my', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (res.status === 401) { clearLocalSession(); return; }
    const data = await res.json();
    renderGalaxies(grid, data.meta || []);
  } catch {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = window.t.errLoadData;
    grid.appendChild(p);
  }
}

function renderGalaxies(grid, galaxies) {
  grid.textContent = '';
  if (!galaxies.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = window.t.emptyGalaxies;
    grid.appendChild(p);
    return;
  }
  galaxies.forEach(function(g) {
    const card = document.createElement('div');
    card.className = 'galaxy-card';
    card.dataset.galaxyId = g._id;

    // ── Header: name + view shortcut ──────────────────
    const header = document.createElement('div');
    header.className = 'galaxy-card-header';

    const name = document.createElement('div');
    name.className = 'galaxy-name';
    name.textContent = g.name;

    const viewQuick = document.createElement('button');
    viewQuick.className = 'btn-view-quick';
    viewQuick.title = window.t.btnView || 'Xem';
    viewQuick.textContent = '↗';
    viewQuick.addEventListener('click', (e) => {
      e.stopPropagation();
      window.open(`/view/?galaxyId=${g._id}`, '_blank');
    });

    header.appendChild(name);
    header.appendChild(viewQuick);

    // ── Meta: template + status ────────────────────────
    const meta = document.createElement('div');
    meta.className = 'galaxy-meta';

    const tmpl = document.createElement('div');
    tmpl.className = 'galaxy-template-badge';
    tmpl.textContent = g.template === 'fall' ? '🍂 Fall' : '🌌 Galaxy';

    const status = document.createElement('div');
    status.className = `galaxy-status${g.status !== 'active' ? ' inactive' : ''}`;
    status.textContent = g.status;

    meta.appendChild(tmpl);
    meta.appendChild(status);

    // ── Actions: manage + copy link ───────────────────
    const actions = document.createElement('div');
    actions.className = 'galaxy-actions';

    const manageBtn = document.createElement('button');
    manageBtn.className = 'btn-manage';
    manageBtn.textContent = window.t.btnManage || 'Quản lý';
    manageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.href = `/portal/galaxy.html?galaxyId=${g._id}`;
    });

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn-copy-link';
    copyBtn.title = 'Copy link chia sẻ';
    copyBtn.textContent = '🔗';
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = `${window.location.origin}/view/?galaxyId=${g._id}`;
      const onCopied = () => {
        copyBtn.textContent = '✓';
        copyBtn.classList.add('copied');
        setTimeout(() => { copyBtn.textContent = '🔗'; copyBtn.classList.remove('copied'); }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(onCopied);
      } else {
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        onCopied();
      }
    });

    actions.appendChild(manageBtn);
    actions.appendChild(copyBtn);

    card.appendChild(header);
    card.appendChild(meta);
    card.appendChild(actions);

    card.addEventListener('click', () => {
      window.location.href = `/portal/galaxy.html?galaxyId=${g._id}`;
    });

    grid.appendChild(card);
  });
}

document.getElementById('btn-logout').addEventListener('click', logout);
document.getElementById('btn-open-modal').addEventListener('click', openModal);
document.getElementById('btn-cancel').addEventListener('click', closeModal);

document.getElementById('btn-create').addEventListener('click', async function() {
  const name = document.getElementById('galaxy-name').value.trim();
  const msg = document.getElementById('modal-msg');
  const btn = document.getElementById('btn-create');
  if (!name) { msg.textContent = window.t.errGalaxyName; return; }
  btn.disabled = true;
  btn.textContent = window.t.creating;
  try {
    const res = await fetch('/galaxies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ name: name })
    });
    const data = await res.json();
    if (!res.ok) {
      msg.textContent = data.message || window.t.errGeneric;
      btn.disabled = false;
      btn.textContent = window.t.btnCreate;
      return;
    }
    closeModal();
    loadGalaxies();
  } catch {
    msg.textContent = window.t.errConnect;
    btn.disabled = false;
    btn.textContent = window.t.btnCreate;
  }
});

loadGalaxies();

// ── Account tab ───────────────────────────────────────────────────────────────

function setAccMsg(id, text, isError) {
  var el = document.getElementById(id);
  el.textContent = text;
  el.style.color = isError ? 'var(--red)' : 'var(--green)';
}

document.getElementById('btn-change-pw').addEventListener('click', async function() {
  var currentPw = document.getElementById('acc-current-pw').value;
  var newPw = document.getElementById('acc-new-pw').value;
  var confirmPw = document.getElementById('acc-confirm-pw').value;
  setAccMsg('msg-change-pw', '', false);

  if (newPw !== confirmPw) { setAccMsg('msg-change-pw', window.t.errPasswordMismatch, true); return; }

  var btn = this;
  btn.disabled = true;
  btn.textContent = window.t.processing;
  try {
    var res = await fetch('/auth/change-password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    var data = await res.json();
    if (!res.ok) { setAccMsg('msg-change-pw', data.message || window.t.errGeneric, true); return; }
    setAccMsg('msg-change-pw', window.t.changePasswordSuccess, false);
    document.getElementById('acc-current-pw').value = '';
    document.getElementById('acc-new-pw').value = '';
    document.getElementById('acc-confirm-pw').value = '';
    setTimeout(logout, 2000);
  } catch { setAccMsg('msg-change-pw', window.t.errConnect, true); }
  finally { btn.disabled = false; btn.textContent = window.t.btnChangePassword; }
});

// ── Sessions ──────────────────────────────────────────────────────────────────

async function loadSessions() {
  const list = document.getElementById('sessions-list');
  const msg = document.getElementById('msg-sessions');
  if (!list) return;
  list.textContent = window.t.sessionsLoading;
  msg.textContent = '';
  try {
    const res = await fetch('/auth/sessions', { headers: { 'Authorization': 'Bearer ' + token } });
    if (res.status === 401) { clearLocalSession(); return; }
    const data = await res.json();
    const sessions = (data.meta && data.meta.sessions) || [];
    list.textContent = '';
    if (!sessions.length) {
      list.textContent = window.t.sessionsEmpty;
      return;
    }
    sessions.forEach(function(s) {
      const item = document.createElement('div');
      item.className = 'session-item';

      const meta = document.createElement('div');
      meta.className = 'session-meta';

      const ua = document.createElement('div');
      ua.className = 'session-ua';
      ua.textContent = s.ua || 'Unknown device';
      if (s.isCurrent) {
        const badge = document.createElement('span');
        badge.className = 'session-badge';
        badge.textContent = window.t.sessionsCurrent;
        ua.appendChild(badge);
      }

      const detail = document.createElement('div');
      detail.className = 'session-detail';
      const date = s.createdAt ? new Date(s.createdAt).toLocaleString() : '';
      detail.textContent = [s.ip, date].filter(Boolean).join(' · ');

      meta.appendChild(ua);
      meta.appendChild(detail);

      const btn = document.createElement('button');
      btn.className = 'btn-session-revoke';
      btn.textContent = window.t.sessionsLogoutOne;
      btn.addEventListener('click', async function() {
        btn.disabled = true;
        try {
          const r = await fetch('/auth/sessions/' + s.sid, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + token },
          });
          if (r.status === 401) { clearLocalSession(); return; }
          const d = await r.json();
          if (d.meta && d.meta.isCurrent) { clearLocalSession(); return; }
          setAccMsg('msg-sessions', window.t.sessionsRevoked, false);
          loadSessions();
        } catch (_) {
          btn.disabled = false;
        }
      });

      item.appendChild(meta);
      if (!s.isCurrent) item.appendChild(btn);
      list.appendChild(item);
    });
  } catch (_) {
    list.textContent = window.t.errConnect;
  }
}

document.getElementById('btn-logout-all').addEventListener('click', async function() {
  var btn = this;
  btn.disabled = true;
  try {
    var res = await fetch('/auth/logout-all', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token },
    });
    if (!res.ok) { btn.disabled = false; return; }
    logout();
  } catch (_) { btn.disabled = false; }
});

document.getElementById('btn-delete-account').addEventListener('click', async function() {
  var pw = document.getElementById('acc-delete-pw').value;
  setAccMsg('msg-delete-account', '', false);
  if (!pw) { setAccMsg('msg-delete-account', window.t.placeholderPassword, true); return; }

  var btn = this;
  btn.disabled = true;
  try {
    var res = await fetch('/auth/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ password: pw }),
    });
    var data = await res.json();
    if (!res.ok) { setAccMsg('msg-delete-account', data.message || window.t.errGeneric, true); return; }
    setAccMsg('msg-delete-account', window.t.deleteAccountSuccess, false);
    setTimeout(logout, 1500);
  } catch { setAccMsg('msg-delete-account', window.t.errConnect, true); }
  finally { btn.disabled = false; }
});
