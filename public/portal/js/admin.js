const API = window.location.origin;
const authToken = localStorage.getItem('token');
const configuredPlansPromise = fetch('/compliance/public')
  .then(response => response.ok ? response.json() : Promise.reject(new Error('Cannot load plans')))
  .then(body => Object.entries(body.meta?.plans || {})
    .filter(([key]) => key !== 'free')
    .sort(([, left], [, right]) => (left.rank || 0) - (right.rank || 0)))
  .catch(() => []);

// ── Toast ─────────────────────────────────────────
function showAdminToast(msg, type) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className = 'toast ' + (type || '');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3500);
}

// ── Skeleton loading ──────────────────────────────
function setTableLoading(tbodyId, cols) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  tbody.textContent = '';
  for (let i = 0; i < 3; i++) {
    const tr = document.createElement('tr');
    for (let j = 0; j < cols; j++) {
      const td = document.createElement('td');
      td.style.padding = '12px';
      const skel = document.createElement('div');
      skel.className = 'skel';
      td.appendChild(skel);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
}

// ── Button loading state ──────────────────────────
function setBtnLoading(btnId, loading, label) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = '';
  if (loading) {
    const spin = document.createElement('span');
    spin.style.cssText = 'display:inline-block;width:12px;height:12px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;margin-right:6px;vertical-align:middle';
    btn.appendChild(spin);
  }
  btn.appendChild(document.createTextNode(label));
}

// ── Color field sync ──────────────────────────────
function setupColorField(pickerId, textId) {
  const picker = document.getElementById(pickerId);
  const text = document.getElementById(textId);
  if (!picker || !text) return;
  picker.addEventListener('input', () => { text.value = picker.value; });
  text.addEventListener('input', () => {
    if (/^#[0-9a-fA-F]{6}$/.test(text.value)) picker.value = text.value;
  });
}

// ── Load themes ───────────────────────────────────
async function loadThemes() {
  setTableLoading('theme-table', 4);
  try {
    const res = await fetch(`${API}/media/themes`);
    const data = await res.json();
    const themes = data.meta || [];
    const tbody = document.getElementById('theme-table');
    tbody.textContent = '';

    if (themes.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.style.cssText = 'padding:24px;text-align:center;color:rgba(255,255,255,0.3);font-size:13px';
      td.textContent = 'No themes yet';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    themes.forEach(t => {
      const tr = document.createElement('tr');

      const tdName = document.createElement('td');
      tdName.style.padding = '12px';
      tdName.textContent = t.name;

      const tdColors = document.createElement('td');
      tdColors.style.padding = '12px';
      const colors = [t.colors?.primary, t.colors?.secondary, t.colors?.background].filter(Boolean);
      colors.forEach(c => {
        const swatch = document.createElement('span');
        swatch.className = 'color-swatch';
        swatch.style.background = c;
        swatch.title = c;
        tdColors.appendChild(swatch);
      });

      const tdStatus = document.createElement('td');
      tdStatus.style.padding = '12px';
      tdStatus.style.color = 'rgba(255,255,255,0.45)';
      tdStatus.style.fontSize = '12px';
      tdStatus.textContent = t.status;

      const tdAction = document.createElement('td');
      tdAction.style.padding = '12px';
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-delete-row';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => deleteTheme(t._id));
      tdAction.appendChild(delBtn);

      tr.appendChild(tdName);
      tr.appendChild(tdColors);
      tr.appendChild(tdStatus);
      tr.appendChild(tdAction);
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    showAdminToast('Failed to load themes', 'error');
  }
}

// ── Load musics ───────────────────────────────────
async function loadMusics() {
  setTableLoading('music-table', 4);
  try {
    const res = await fetch(`${API}/media/musics`);
    const data = await res.json();
    const musics = data.meta || [];
    const tbody = document.getElementById('music-table');
    tbody.textContent = '';

    if (musics.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.style.cssText = 'padding:24px;text-align:center;color:rgba(255,255,255,0.3);font-size:13px';
      td.textContent = 'No music yet';
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    musics.forEach(m => {
      const tr = document.createElement('tr');

      const tdName = document.createElement('td');
      tdName.style.padding = '12px';
      tdName.textContent = m.name;

      const tdUrl = document.createElement('td');
      tdUrl.style.cssText = 'padding:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:rgba(255,255,255,0.4);font-size:12px';
      tdUrl.textContent = m.url;
      tdUrl.title = m.url;

      const tdStatus = document.createElement('td');
      tdStatus.style.cssText = 'padding:12px;color:rgba(255,255,255,0.45);font-size:12px';
      tdStatus.textContent = m.status;

      const tdAction = document.createElement('td');
      tdAction.style.padding = '12px';
      const delBtn = document.createElement('button');
      delBtn.className = 'btn-delete-row';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => deleteMusic(m._id));
      tdAction.appendChild(delBtn);

      tr.appendChild(tdName);
      tr.appendChild(tdUrl);
      tr.appendChild(tdStatus);
      tr.appendChild(tdAction);
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    showAdminToast('Failed to load music', 'error');
  }
}

// ── Theme modal ───────────────────────────────────
document.getElementById('btn-add-theme')?.addEventListener('click', () => {
  document.getElementById('theme-modal').classList.add('open');
  document.getElementById('theme-modal-msg').textContent = '';
  setupColorField('theme-primary-picker', 'theme-primary');
  setupColorField('theme-secondary-picker', 'theme-secondary');
  setupColorField('theme-bg-picker', 'theme-bg');
});

document.getElementById('btn-cancel-theme')?.addEventListener('click', () => {
  document.getElementById('theme-modal').classList.remove('open');
  ['theme-name', 'theme-primary', 'theme-secondary', 'theme-bg'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
});

document.getElementById('btn-save-theme')?.addEventListener('click', async () => {
  const name = document.getElementById('theme-name').value.trim();
  const primary = document.getElementById('theme-primary').value.trim() ||
                  document.getElementById('theme-primary-picker').value;
  const secondary = document.getElementById('theme-secondary').value.trim() ||
                    document.getElementById('theme-secondary-picker').value;
  const bg = document.getElementById('theme-bg').value.trim() ||
             document.getElementById('theme-bg-picker').value;

  const msgEl = document.getElementById('theme-modal-msg');
  if (!name) { msgEl.textContent = 'Theme name is required'; return; }

  setBtnLoading('btn-save-theme', true, 'Saving…');
  try {
    const res = await fetch(`${API}/media/themes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ name, colors: { primary, secondary, background: bg } }),
    });
    if (res.ok) {
      document.getElementById('theme-modal').classList.remove('open');
      ['theme-name', 'theme-primary', 'theme-secondary', 'theme-bg'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      showAdminToast('Theme added!', 'success');
      loadThemes();
    } else {
      const d = await res.json();
      msgEl.textContent = d.message || 'Failed to save';
    }
  } catch {
    msgEl.textContent = 'Connection error';
  }
  setBtnLoading('btn-save-theme', false, 'Save');
});

async function deleteTheme(id) {
  if (!confirm('Delete this theme?')) return;
  try {
    const res = await fetch(`${API}/media/themes/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) { showAdminToast('Theme deleted', 'success'); loadThemes(); }
    else showAdminToast('Failed to delete', 'error');
  } catch { showAdminToast('Connection error', 'error'); }
}

// ── Music modal ───────────────────────────────────
document.getElementById('btn-add-music')?.addEventListener('click', () => {
  document.getElementById('music-modal').classList.add('open');
});

document.getElementById('btn-cancel-music')?.addEventListener('click', () => {
  document.getElementById('music-modal').classList.remove('open');
  document.getElementById('music-name').value = '';
  document.getElementById('music-file').value = '';
});

document.getElementById('btn-save-music')?.addEventListener('click', async () => {
  const name = document.getElementById('music-name').value.trim();
  const file = document.getElementById('music-file').files[0];
  if (!name || !file) { showAdminToast('Name and file required', 'error'); return; }

  setBtnLoading('btn-save-music', true, 'Uploading…');
  try {
    const formData = new FormData();
    formData.append('file', file);
    const uploadRes = await fetch(`${API}/media/upload-music`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: formData,
    });
    if (!uploadRes.ok) { showAdminToast('Upload failed', 'error'); return; }

    const uploadData = await uploadRes.json();
    setBtnLoading('btn-save-music', true, 'Saving…');

    const res = await fetch(`${API}/media/musics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ name, url: uploadData.meta.url }),
    });
    if (res.ok) {
      document.getElementById('music-modal').classList.remove('open');
      document.getElementById('music-name').value = '';
      document.getElementById('music-file').value = '';
      showAdminToast('Music added!', 'success');
      loadMusics();
    } else {
      showAdminToast('Failed to save music', 'error');
    }
  } catch { showAdminToast('Connection error', 'error'); }
  setBtnLoading('btn-save-music', false, 'Save');
});

async function deleteMusic(id) {
  if (!confirm('Delete this music?')) return;
  try {
    const res = await fetch(`${API}/media/musics/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (res.ok) { showAdminToast('Music deleted', 'success'); loadMusics(); }
    else showAdminToast('Failed to delete', 'error');
  } catch { showAdminToast('Connection error', 'error'); }
}

// ── Nav + init ────────────────────────────────────
document.querySelectorAll('.admin-nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    const section = document.getElementById('admin-' + item.dataset.section);
    if (section) section.classList.add('active');
  });
});

const adminTab = document.querySelector('[data-tab="admin"]');
if (adminTab) {
  adminTab.addEventListener('click', () => { loadThemes(); loadMusics(); });
}

window.deleteTheme = deleteTheme;
window.deleteMusic = deleteMusic;

// ── Admin API helper ──────────────────────────────
async function adminApi(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Error');
  return data;
}

function fmtVND(n) { return Number(n).toLocaleString('vi-VN') + 'đ'; }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('vi-VN') : '—'; }
function auIsBanned(u) { return u.lockedUntil && new Date(u.lockedUntil) > new Date(); }

// ── DOM helpers ───────────────────────────────────
function makeEl(tag, styles, text) {
  const el = document.createElement(tag);
  if (styles) el.style.cssText = styles;
  if (text !== undefined) el.textContent = text;
  return el;
}

function makeSpanBadge(text, bg, color) {
  return makeEl('span', `font-size:11px;padding:2px 8px;border-radius:99px;background:${bg};color:${color}`, text);
}

function makeDetailRow(labelText, valueNode) {
  const row = makeEl('div', 'display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:13px');
  row.appendChild(makeEl('span', 'color:rgba(255,255,255,0.4)', labelText));
  row.appendChild(valueNode);
  return row;
}

function makeSection(titleText) {
  const wrap = makeEl('div', 'margin-bottom:18px');
  wrap.appendChild(makeEl('div', 'font-size:11px;color:rgba(255,255,255,0.3);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px', titleText));
  return wrap;
}

// ── Users ─────────────────────────────────────────
let auPage = 1, auTotal = 0;

async function loadAdminUsers() {
  const search = document.getElementById('au-search')?.value.trim() || '';
  const plan = document.getElementById('au-plan')?.value || '';
  const tbody = document.getElementById('au-tbody');
  if (!tbody) return;

  const loadingTr = document.createElement('tr');
  const loadingTd = document.createElement('td');
  loadingTd.colSpan = 6;
  loadingTd.style.cssText = 'padding:28px;text-align:center;color:rgba(255,255,255,0.3);font-size:13px';
  loadingTd.textContent = window.t.adminLoading;
  loadingTr.appendChild(loadingTd);
  tbody.textContent = '';
  tbody.appendChild(loadingTr);

  try {
    const data = await adminApi(`/admin/users?page=${auPage}&limit=15&search=${encodeURIComponent(search)}&plan=${encodeURIComponent(plan)}`);
    const { users, total } = data.meta;
    auTotal = total;
    tbody.textContent = '';

    if (!users.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 6;
      td.style.cssText = 'padding:28px;text-align:center;color:rgba(255,255,255,0.3);font-size:13px';
      td.textContent = window.t.adminEmpty;
      tr.appendChild(td);
      tbody.appendChild(tr);
    } else {
      const selfEmail = (JSON.parse(localStorage.getItem('user') || '{}')).email;
      users.forEach(u => {
        const banned = auIsBanned(u);
        const isSelf = u.email === selfEmail;
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';

        // Email
        const tdEmail = makeEl('td', 'padding:11px 12px;font-size:13px', u.email);

        // Role
        const tdRole = makeEl('td', 'padding:11px 12px;font-size:12px;color:rgba(255,255,255,0.45)', u.role);

        // Plan
        const tdPlan = makeEl('td', 'padding:11px 12px');
        if (u.subscription) {
          tdPlan.appendChild(makeSpanBadge(u.subscription.plan.toUpperCase(), 'rgba(139,92,246,0.2)', '#a78bfa'));
        } else {
          tdPlan.appendChild(makeEl('span', 'color:rgba(255,255,255,0.25);font-size:12px', '—'));
        }

        // Expiry
        const tdExp = makeEl('td', 'padding:11px 12px;font-size:12px;color:rgba(255,255,255,0.4)', u.subscription ? fmtDate(u.subscription.expiredAt) : '—');

        // Status badge: banned > inactive > active
        const tdStatus = makeEl('td', 'padding:11px 12px');
        if (banned) {
          tdStatus.appendChild(makeSpanBadge('Banned', 'rgba(239,68,68,0.2)', '#f87171'));
        } else if (!u.isVerified) {
          tdStatus.appendChild(makeSpanBadge('Inactive', 'rgba(239,68,68,0.15)', '#f87171'));
        } else {
          tdStatus.appendChild(makeSpanBadge('Active', 'rgba(34,197,94,0.15)', '#4ade80'));
        }

        // Actions
        const tdActions = makeEl('td', 'padding:11px 12px;display:flex;gap:6px;flex-wrap:wrap');

        const btnDetail = document.createElement('button');
        btnDetail.className = 'btn-view';
        btnDetail.style.cssText = 'padding:4px 10px;font-size:12px';
        btnDetail.textContent = 'Chi tiết';
        btnDetail.addEventListener('click', () => openAuDetail(u._id, u.email));

        const btnGrant = document.createElement('button');
        btnGrant.className = 'btn-view';
        btnGrant.style.cssText = 'padding:4px 10px;font-size:12px;background:rgba(124,58,237,0.2)';
        btnGrant.textContent = 'Cấp sub';
        btnGrant.addEventListener('click', () => openAuGrant(u._id, u.email));

        tdActions.appendChild(btnDetail);
        tdActions.appendChild(btnGrant);

        if (!isSelf) {
          const btnBan = document.createElement('button');
          btnBan.className = 'btn-delete-row';
          btnBan.textContent = banned ? 'Unban' : 'Ban';
          if (banned) btnBan.style.cssText = 'background:rgba(245,158,11,0.15);color:#fbbf24;border-color:rgba(245,158,11,0.3)';
          btnBan.addEventListener('click', () => auBan(u._id, u.email, !banned));
          tdActions.appendChild(btnBan);
        }

        tr.appendChild(tdEmail);
        tr.appendChild(tdRole);
        tr.appendChild(tdPlan);
        tr.appendChild(tdExp);
        tr.appendChild(tdStatus);
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
      });
    }

    const from = total === 0 ? 0 : (auPage - 1) * 15 + 1;
    const to = Math.min(auPage * 15, total);
    const info = document.getElementById('au-page-info');
    if (info) info.textContent = `${from}–${to} / ${total}`;
    const prev = document.getElementById('au-prev');
    const next = document.getElementById('au-next');
    if (prev) prev.disabled = auPage <= 1;
    if (next) next.disabled = auPage * 15 >= total;
  } catch (e) { showAdminToast(e.message, 'error'); }
}

let auSearchTimer;
document.getElementById('au-search')?.addEventListener('input', () => { clearTimeout(auSearchTimer); auSearchTimer = setTimeout(() => { auPage = 1; loadAdminUsers(); }, 400); });
document.getElementById('au-plan')?.addEventListener('change', () => { auPage = 1; loadAdminUsers(); });
document.getElementById('au-prev')?.addEventListener('click', () => { if (auPage > 1) { auPage--; loadAdminUsers(); } });
document.getElementById('au-next')?.addEventListener('click', () => { if (auPage * 15 < auTotal) { auPage++; loadAdminUsers(); } });

async function auBan(userId, email, ban) {
  if (!confirm(ban ? `Ban user "${email}"?` : `Unban user "${email}"?`)) return;
  try {
    await adminApi(`/admin/users/${userId}/ban`, { method: 'PATCH', body: JSON.stringify({ banned: ban }) });
    showAdminToast(ban ? `Đã ban ${email}` : `Đã unban ${email}`, 'success');
    loadAdminUsers();
  } catch (e) { showAdminToast(e.message, 'error'); }
}

// Grant sub modal (inline)
let auGrantId = null;
function openAuGrant(userId, email) {
  auGrantId = userId;
  let modal = document.getElementById('au-grant-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'au-grant-modal';
    modal.className = 'modal-overlay';

    const box = makeEl('div');
    box.className = 'modal';

    const title = makeEl('h3', null, 'Cấp Subscription');

    const info = makeEl('div', 'font-size:13px;color:rgba(255,255,255,0.5);margin-bottom:14px');
    info.appendChild(document.createTextNode('User: '));
    const emailStrong = makeEl('strong', 'color:#c4b5fd');
    emailStrong.id = 'au-grant-email';
    info.appendChild(emailStrong);

    const labelPlan = makeEl('label', 'font-size:12px;color:rgba(255,255,255,0.4);display:block;margin-bottom:6px', 'Plan');
    const selPlan = document.createElement('select');
    selPlan.id = 'au-grant-plan';
    selPlan.style.cssText = 'width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:9px 12px;color:#fff;font-size:13px;outline:none;margin-bottom:14px';
    const loadingPlan = document.createElement('option');
    loadingPlan.textContent = 'Đang tải plan…'; loadingPlan.disabled = true; loadingPlan.selected = true;
    selPlan.appendChild(loadingPlan);
    configuredPlansPromise.then(entries => {
      if (!entries.length) { loadingPlan.textContent = 'Không tải được plan'; return; }
      selPlan.replaceChildren(...entries.map(([key, plan]) => {
        const option = document.createElement('option'); option.value = key; option.textContent = plan.label; return option;
      }));
    });

    const labelDays = makeEl('label', 'font-size:12px;color:rgba(255,255,255,0.4);display:block;margin-bottom:6px', 'Số ngày');
    const inputDays = document.createElement('input');
    inputDays.type = 'number'; inputDays.id = 'au-grant-days'; inputDays.value = '30'; inputDays.min = '1';
    inputDays.style.cssText = 'width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:9px 12px;color:#fff;font-size:13px;outline:none;margin-bottom:18px';

    const actions = makeEl('div', 'display:flex;gap:8px;justify-content:flex-end');
    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn-cancel'; btnCancel.id = 'au-grant-cancel'; btnCancel.textContent = 'Huỷ';
    const btnConfirm = document.createElement('button');
    btnConfirm.className = 'btn-create'; btnConfirm.id = 'au-grant-confirm'; btnConfirm.textContent = 'Cấp';
    actions.appendChild(btnCancel);
    actions.appendChild(btnConfirm);

    box.appendChild(title); box.appendChild(info);
    box.appendChild(labelPlan); box.appendChild(selPlan);
    box.appendChild(labelDays); box.appendChild(inputDays);
    box.appendChild(actions);
    modal.appendChild(box);
    document.body.appendChild(modal);

    btnCancel.addEventListener('click', () => modal.classList.remove('open'));
    btnConfirm.addEventListener('click', async () => {
      const plan = document.getElementById('au-grant-plan').value;
      const days = parseInt(document.getElementById('au-grant-days').value);
      try {
        await adminApi(`/admin/users/${auGrantId}/subscription`, { method: 'PATCH', body: JSON.stringify({ plan, days }) });
        modal.classList.remove('open');
        showAdminToast(window.t.adminGranted, 'success');
        loadAdminUsers();
      } catch (e) { showAdminToast(e.message, 'error'); }
    });
  }
  document.getElementById('au-grant-email').textContent = email;
  modal.classList.add('open');
}

// ── User Detail Modal ─────────────────────────────
function openAuDetail(userId, email) {
  let overlay = document.getElementById('au-detail-modal');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'au-detail-modal';
    overlay.className = 'modal-overlay';

    const box = makeEl('div');
    box.className = 'modal';
    box.style.cssText = 'width:480px;max-height:85vh;overflow-y:auto';

    const title = makeEl('h3', 'color:#c4b5fd;font-size:15px;margin-bottom:18px');
    title.id = 'au-detail-title';

    const body = makeEl('div');
    body.id = 'au-detail-body';

    const footer = makeEl('div', 'display:flex;justify-content:flex-end;margin-top:16px');
    const btnClose = document.createElement('button');
    btnClose.className = 'btn-cancel';
    btnClose.textContent = 'Đóng';
    btnClose.addEventListener('click', () => overlay.classList.remove('open'));
    footer.appendChild(btnClose);

    box.appendChild(title); box.appendChild(body); box.appendChild(footer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  document.getElementById('au-detail-title').textContent = email;
  const body = document.getElementById('au-detail-body');
  body.textContent = '';
  const loadingMsg = makeEl('div', 'text-align:center;padding:32px;color:rgba(255,255,255,0.3);font-size:13px', window.t.adminLoading);
  body.appendChild(loadingMsg);
  overlay.classList.add('open');

  adminApi(`/admin/users/${userId}`).then(data => {
    const { user, subscription, galaxies, payments } = data.meta;
    const banned = auIsBanned(user);
    body.textContent = '';

    // ── Info section ──
    const infoSec = makeSection('Thông tin');

    // Role row
    const roleWrap = makeEl('div', 'display:flex;gap:6px;align-items:center');
    const roleSelect = document.createElement('select');
    roleSelect.style.cssText = 'background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;padding:4px 8px;color:#fff;font-size:12px;outline:none';
    ['user', 'partner', 'admin'].forEach(r => {
      const opt = document.createElement('option');
      opt.value = r; opt.textContent = r;
      if (user.role === r) opt.selected = true;
      roleSelect.appendChild(opt);
    });
    const roleSaveBtn = document.createElement('button');
    roleSaveBtn.className = 'btn-view';
    roleSaveBtn.style.cssText = 'padding:4px 10px;font-size:12px';
    roleSaveBtn.textContent = 'Lưu';
    roleSaveBtn.addEventListener('click', async () => {
      try {
        await adminApi(`/admin/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role: roleSelect.value }) });
        showAdminToast(window.t.adminRoleUpdated, 'success');
        loadAdminUsers();
      } catch (e) { showAdminToast(e.message, 'error'); }
    });
    roleWrap.appendChild(roleSelect);
    roleWrap.appendChild(roleSaveBtn);
    infoSec.appendChild(makeDetailRow('Role', roleWrap));

    // Verified row
    const verifiedWrap = makeEl('div', 'display:flex;align-items:center;gap:8px');
    verifiedWrap.appendChild(makeEl('span', null, user.isVerified ? '✅ Active' : '❌ Inactive'));
    const verifiedBtn = document.createElement('button');
    verifiedBtn.className = 'btn-view';
    verifiedBtn.style.cssText = 'padding:4px 10px;font-size:12px';
    verifiedBtn.textContent = user.isVerified ? 'Khoá' : 'Mở';
    verifiedBtn.addEventListener('click', async () => {
      try {
        await adminApi(`/admin/users/${userId}/status`, { method: 'PATCH', body: JSON.stringify({ isVerified: !user.isVerified }) });
        showAdminToast(user.isVerified ? window.t.adminLocked : window.t.adminUnlocked, 'success');
        openAuDetail(userId, email);
        loadAdminUsers();
      } catch (e) { showAdminToast(e.message, 'error'); }
    });
    verifiedWrap.appendChild(verifiedBtn);
    infoSec.appendChild(makeDetailRow('Verified', verifiedWrap));

    // Joined row
    infoSec.appendChild(makeDetailRow('Tham gia', makeEl('span', null, fmtDate(user.createdAt))));

    // Ban row
    const banWrap = makeEl('div', 'display:flex;align-items:center;gap:8px');
    if (banned) {
      banWrap.appendChild(makeEl('span', 'font-size:12px;color:#f87171', 'Banned đến ' + fmtDate(user.lockedUntil)));
    } else {
      banWrap.appendChild(makeEl('span', 'font-size:12px;color:rgba(255,255,255,0.35)', 'Bình thường'));
    }
    const banBtn = document.createElement('button');
    banBtn.className = 'btn-delete-row';
    banBtn.textContent = banned ? 'Unban' : 'Ban';
    if (banned) banBtn.style.cssText = 'background:rgba(245,158,11,0.15);color:#fbbf24;border-color:rgba(245,158,11,0.3)';
    banBtn.addEventListener('click', async () => {
      if (!confirm(banned ? `Unban "${email}"?` : `Ban "${email}"?`)) return;
      try {
        await adminApi(`/admin/users/${userId}/ban`, { method: 'PATCH', body: JSON.stringify({ banned: !banned }) });
        showAdminToast(!banned ? `Đã ban ${email}` : `Đã unban ${email}`, 'success');
        openAuDetail(userId, email);
        loadAdminUsers();
      } catch (e) { showAdminToast(e.message, 'error'); }
    });
    banWrap.appendChild(banBtn);
    infoSec.appendChild(makeDetailRow('Ban', banWrap));
    body.appendChild(infoSec);

    // ── Subscription section ──
    const subSec = makeSection('Subscription hiện tại');
    if (subscription) {
      subSec.appendChild(makeDetailRow('Plan', makeSpanBadge(subscription.plan.toUpperCase(), 'rgba(139,92,246,0.2)', '#a78bfa')));
      subSec.appendChild(makeDetailRow(window.t.adminExpiry, makeEl('span', null, fmtDate(subscription.expiredAt))));
      const revokeBtn = document.createElement('button');
      revokeBtn.className = 'btn-delete-row';
      revokeBtn.style.marginTop = '10px';
      revokeBtn.textContent = window.t.adminRevokeBtn;
      revokeBtn.addEventListener('click', async () => {
        if (!confirm(window.t.adminConfirmRevoke)) return;
        try {
          await adminApi(`/admin/users/${userId}/subscription`, { method: 'DELETE' });
          showAdminToast(window.t.adminRevoked, 'success');
          openAuDetail(userId, email);
          loadAdminUsers();
        } catch (e) { showAdminToast(e.message, 'error'); }
      });
      subSec.appendChild(revokeBtn);
    } else {
      subSec.appendChild(makeEl('div', 'font-size:13px;color:rgba(255,255,255,0.3)', window.t.adminNoSub));
    }
    body.appendChild(subSec);

    // ── Galaxies section ──
    const galSec = makeSection(`Galaxies (${galaxies.length})`);
    if (galaxies.length) {
      galaxies.forEach(g => {
        const badge = makeSpanBadge(g.status, g.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', g.status === 'active' ? '#4ade80' : '#f87171');
        galSec.appendChild(makeDetailRow(g.name, badge));
      });
    } else {
      galSec.appendChild(makeEl('div', 'font-size:13px;color:rgba(255,255,255,0.3)', window.t.adminNoGalaxy));
    }
    body.appendChild(galSec);

    // ── Payments section ──
    const paySec = makeSection('Lịch sử thanh toán');
    if (payments.length) {
      payments.forEach(p => {
        const valWrap = makeEl('span', 'font-size:12px');
        valWrap.appendChild(makeEl('span', null, p.plan + ' ' + fmtVND(p.amount) + ' '));
        const statusColor = p.status === 'paid' ? '#4ade80' : p.status === 'cancelled' ? '#f87171' : '#fbbf24';
        valWrap.appendChild(makeEl('span', `color:${statusColor}`, p.status));
        paySec.appendChild(makeDetailRow(fmtDate(p.paidAt || p.createdAt), valWrap));
      });
    } else {
      paySec.appendChild(makeEl('div', 'font-size:13px;color:rgba(255,255,255,0.3)', window.t.adminNoPayment));
    }
    body.appendChild(paySec);

  }).catch(e => {
    body.textContent = '';
    body.appendChild(makeEl('div', 'text-align:center;padding:32px;color:#f87171;font-size:13px', e.message));
  });
}

// ── Analytics ─────────────────────────────────────
let cancelChart = null;

async function loadAnalytics() {
  try {
    const [statsData, paymentsData, chartData] = await Promise.all([
      adminApi('/admin/stats'),
      adminApi('/admin/payments?page=1&limit=10'),
      adminApi('/admin/cancellation-chart?days=30'),
    ]);
    const s = statsData.meta;
    document.getElementById('aa-total-users').textContent = s.totalUsers;
    document.getElementById('aa-active-subs').textContent = s.activeSubs;
    document.getElementById('aa-revenue').textContent = fmtVND(s.monthRevenue);
    document.getElementById('aa-payments').textContent = s.totalPayments;

    // Chart
    const canvas = document.getElementById('aa-cancel-chart');
    if (canvas) {
      const labels = chartData.meta.map(d => d.date.slice(5));
      const rates = chartData.meta.map(d => d.rate);
      const successRates = chartData.meta.map(d => d.total > 0 ? Math.round((d.total - d.cancelled) / d.total * 100) : 0);
      if (cancelChart) cancelChart.destroy();
      cancelChart = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Tỉ lệ thành công (%)', data: successRates, borderColor: '#4ade80', backgroundColor: 'rgba(74,222,128,0.08)', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#4ade80', fill: true, tension: 0.3 },
            { label: 'Tỉ lệ hủy (%)', data: rates, borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.08)', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#f87171', fill: true, tension: 0.3 },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { labels: { color: 'rgba(255,255,255,0.5)', font: { size: 12 } } } },
          scales: {
            x: { ticks: { color: 'rgba(255,255,255,0.35)', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
            y: { min: 0, max: 100, ticks: { color: 'rgba(255,255,255,0.35)', font: { size: 11 }, callback: v => v + '%' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          },
        },
      });
    }

    const tbody = document.getElementById('aa-payments-tbody');
    const payments = paymentsData.meta.payments;
    tbody.textContent = '';
    if (!payments.length) {
      const tr = document.createElement('tr');
      const td = makeEl('td', 'padding:28px;text-align:center;color:rgba(255,255,255,0.3);font-size:13px', window.t.adminNoPayment);
      td.colSpan = 5;
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    payments.forEach(p => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';

      tr.appendChild(makeEl('td', 'padding:11px 12px;font-size:13px', p.buyerEmail));
      const tdPlan = makeEl('td', 'padding:11px 12px');
      tdPlan.appendChild(makeSpanBadge(p.plan.toUpperCase(), 'rgba(139,92,246,0.2)', '#a78bfa'));
      const bg = p.status === 'paid' ? 'rgba(34,197,94,0.15)' : p.status === 'cancelled' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)';
      const color = p.status === 'paid' ? '#4ade80' : p.status === 'cancelled' ? '#f87171' : '#fbbf24';
      const tdStatus = makeEl('td', 'padding:11px 12px');
      tdStatus.appendChild(makeSpanBadge(p.status, bg, color));
      tr.appendChild(tdPlan);
      tr.appendChild(makeEl('td', 'padding:11px 12px;font-size:13px', fmtVND(p.amount)));
      tr.appendChild(tdStatus);
      tr.appendChild(makeEl('td', 'padding:11px 12px;font-size:12px;color:rgba(255,255,255,0.4)', fmtDate(p.paidAt || p.createdAt)));
      tbody.appendChild(tr);
    });
  } catch (e) { showAdminToast(e.message, 'error'); }
}

// Hook vào nav
document.querySelectorAll('.admin-nav-item').forEach(item => {
  item.addEventListener('click', () => {
    if (item.dataset.section === 'users') loadAdminUsers();
    if (item.dataset.section === 'analytics') loadAnalytics();
  });
});

window.auToggle = () => {};
window.openAuGrant = openAuGrant;
window.openAuDetail = openAuDetail;
window.auBan = auBan;
