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
  const isOpen = settingsMenu.classList.toggle('open');
  settingsBtn.setAttribute('aria-expanded', String(isOpen));
});
document.addEventListener('click', function() {
  settingsMenu.classList.remove('open');
  settingsBtn.setAttribute('aria-expanded', 'false');
});

// Goto account tab from dropdown
document.getElementById('btn-goto-account').addEventListener('click', function() {
  settingsMenu.classList.remove('open');
  settingsBtn.setAttribute('aria-expanded', 'false');
  activateTab('account');
});

// Tab switching
function activateTab(tab) {
  const btn = Array.from(document.querySelectorAll('.tab-btn[data-tab]'))
    .find(function(candidate) { return candidate.getAttribute('data-tab') === tab; });
  const panel = document.getElementById('panel-' + tab);
  if (!btn || !panel) return false;

  document.querySelectorAll('.tab-btn').forEach(function(b) {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });
  document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
  btn.classList.add('active');
  btn.setAttribute('aria-selected', 'true');
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
  const nameInput = document.getElementById('galaxy-name');
  nameInput.value = '';
  document.getElementById('modal-msg').textContent = '';
  document.getElementById('btn-create').disabled = false;
  document.getElementById('btn-create').textContent = window.t.btnCreate;
  window.setTimeout(function() { nameInput.focus(); }, 50);
}

function closeModal() {
  const modal = document.getElementById('modal');
  const wasOpen = modal.classList.contains('open');
  modal.classList.remove('open');
  if (wasOpen) document.getElementById('btn-open-modal').focus();
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
    const count = document.getElementById('galaxy-count');
    if (count) count.textContent = window.t.portalGalaxyCount ? window.t.portalGalaxyCount(0) : '0';
    const error = document.createElement('div');
    error.className = 'empty-state';
    const title = document.createElement('strong');
    title.textContent = window.t.errLoadData;
    const description = document.createElement('p');
    description.textContent = window.t.errConnect;
    error.appendChild(title);
    error.appendChild(description);
    grid.appendChild(error);
  }
}

function renderGalaxies(grid, galaxies) {
  grid.textContent = '';
  const count = document.getElementById('galaxy-count');
  if (count) {
    count.textContent = window.t.portalGalaxyCount
      ? window.t.portalGalaxyCount(galaxies.length)
      : `${galaxies.length} galaxy`;
  }
  if (!galaxies.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';

    const icon = document.createElement('span');
    icon.className = 'empty-state-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '✦';

    const title = document.createElement('strong');
    title.textContent = window.t.portalEmptyTitle || window.t.emptyGalaxies;

    const description = document.createElement('p');
    description.textContent = window.t.portalEmptyDescription || window.t.emptyGalaxies;

    empty.appendChild(icon);
    empty.appendChild(title);
    empty.appendChild(description);
    grid.appendChild(empty);
    return;
  }
  galaxies.forEach(function(g) {
    const card = document.createElement('div');
    card.className = 'galaxy-card';
    card.dataset.galaxyId = g._id;
    card.dataset.template = g.template || 'galaxy';

    const visual = document.createElement('div');
    visual.className = 'galaxy-card-visual';

    const visualMark = document.createElement('span');
    visualMark.className = 'galaxy-visual-mark';
    visualMark.setAttribute('aria-hidden', 'true');
    visualMark.textContent = '✦';
    visual.appendChild(visualMark);

    // ── Header: name + view shortcut ──────────────────
    const header = document.createElement('div');
    header.className = 'galaxy-card-header';

    // Tiêu đề là LIÊN KẾT THẬT, không phải <div>. Trước đây cả thẻ chỉ có
    // card.addEventListener('click') nên bàn phím không tới được — Tab đi lướt
    // qua toàn bộ danh sách galaxy. Dùng kiểu "stretched link": thẻ <a> phủ
    // toàn thẻ bằng ::after, nên vẫn bấm được ở đâu cũng vào, mà không phải
    // lồng nút trong liên kết (HTML không hợp lệ).
    const name = document.createElement('a');
    name.className = 'galaxy-name';
    name.href = `/portal/galaxy.html?galaxyId=${g._id}`;
    name.textContent = g.name;

    const viewQuick = document.createElement('button');
    viewQuick.type = 'button';
    viewQuick.className = 'btn-view-quick';
    viewQuick.dataset.action = 'view';
    viewQuick.title = window.t.btnView || 'Xem';
    viewQuick.textContent = '↗';
    viewQuick.addEventListener('click', (e) => {
      e.stopPropagation();
      window.open(`/view/?galaxyId=${g._id}`, '_blank');
    });

    // Cụm hành động phụ nằm cạnh tiêu đề, không chiếm thêm một hàng riêng.
    const quick = document.createElement('div');
    quick.className = 'galaxy-quick';
    quick.appendChild(viewQuick);

    header.appendChild(name);
    header.appendChild(quick);

    // ── Meta: template + status ────────────────────────
    const meta = document.createElement('div');
    meta.className = 'galaxy-meta';

    const tmpl = document.createElement('div');
    tmpl.className = 'galaxy-template-badge';
    // Bỏ emoji khỏi nhãn: mỗi emoji tự mang bảng màu riêng của font hệ thống —
    // 🌌 là tím, 🍂 là cam — nên chúng chọi với sơn mài và guard đo hex không
    // bắt được (chúng là KÝ TỰ, không phải mã màu). Nhãn chữ tự nhận màu theo
    // data-template đã có sẵn trong CSS.
    tmpl.textContent = g.template === 'fall' ? 'Fall' : 'Galaxy';

    const status = document.createElement('div');
    status.className = `galaxy-status${g.status !== 'active' ? ' inactive' : ''}`;
    status.textContent = g.status === 'active'
      ? (window.t.galaxyStatusActive || 'Active')
      : (window.t.galaxyStatusInactive || 'Inactive');

    meta.appendChild(tmpl);
    meta.appendChild(status);

    // Nút "Quản lý" đã bỏ: cả thẻ vốn đã dẫn tới đúng trang đó, nên nó là một
    // nút to chiếm trọn một hàng để làm lại việc mà bấm chỗ nào cũng làm được.
    // Bỏ nó đi thì thẻ ngắn lại một hàng và hết ba lời mời bấm chen nhau.
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'btn-copy-link';
    copyBtn.dataset.action = 'copy';
    copyBtn.title = window.t.portalCopyLink || 'Copy share link';
    copyBtn.setAttribute('aria-label', copyBtn.title);
    // SVG thay 🔗: emoji khoá màu xanh của font, SVG ăn theo currentColor nên
    // đổi màu cùng nút khi hover/copied.
    const LINK_SVG = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>';
    copyBtn.innerHTML = LINK_SVG;
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = `${window.location.origin}/view/?galaxyId=${g._id}`;
      const onCopied = () => {
        copyBtn.textContent = '✓';
        copyBtn.classList.add('copied');
        setTimeout(() => { copyBtn.innerHTML = LINK_SVG; copyBtn.classList.remove('copied'); }, 1800);
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

    quick.appendChild(copyBtn);

    card.appendChild(visual);
    card.appendChild(header);
    card.appendChild(meta);

    grid.appendChild(card);
  });
}

document.getElementById('btn-logout').addEventListener('click', logout);
document.getElementById('btn-open-modal').addEventListener('click', openModal);
document.getElementById('btn-cancel').addEventListener('click', closeModal);
document.getElementById('modal').addEventListener('click', function(event) {
  if (event.target === event.currentTarget) closeModal();
});
document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape' && document.getElementById('modal').classList.contains('open')) closeModal();
});

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
      msg.textContent = window.LumoraErrors.resolve(data, window.t);
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

  // Cùng luật với services/auth.service.js (changePassword, tối thiểu 8 ký tự).
  // Thiếu kiểm ở đây thì server chặn và trả message TIẾNG ANH lên UI tiếng Việt.
  if (!currentPw) { setAccMsg('msg-change-pw', window.t.errPasswordRequired, true); return; }
  if (newPw.length < 8) { setAccMsg('msg-change-pw', window.t.errPasswordShort, true); return; }
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
    if (!res.ok) { setAccMsg('msg-change-pw', window.LumoraErrors.resolve(data, window.t), true); return; }
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
      btn.type = 'button';
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
  // placeholderPassword là nhãn ô nhập ("Mật khẩu"), không phải câu thông báo lỗi.
  if (!pw) { setAccMsg('msg-delete-account', window.t.errPasswordRequired, true); return; }

  var btn = this;
  btn.disabled = true;
  try {
    var res = await fetch('/auth/account', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ password: pw }),
    });
    var data = await res.json();
    if (!res.ok) { setAccMsg('msg-delete-account', window.LumoraErrors.resolve(data, window.t), true); return; }
    setAccMsg('msg-delete-account', window.t.deleteAccountSuccess, false);
    setTimeout(logout, 1500);
  } catch { setAccMsg('msg-delete-account', window.t.errConnect, true); }
  finally { btn.disabled = false; }
});
