// Galaxy customization
const API_BASE = window.location.origin;
const token = localStorage.getItem('token');
const galaxyId = new URLSearchParams(window.location.search).get('galaxyId');
document.getElementById('soundscapeCustomizeLink').href = `/portal/galaxy-setup.html?galaxyId=${encodeURIComponent(galaxyId || '')}`;

let currentCaptions = [];
let themes = [];
let soundscapes = [];
let saveTimer = null;
let dragSrcIndex = null;
let canSelectTemplate = false;
const pendingFields = new Set();

// ── Toast ─────────────────────────────────────────
function showToast(msg, type) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type || ''}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.25s ease forwards';
    setTimeout(() => toast.remove(), 260);
  }, 3200);
}

// ── Save indicator ────────────────────────────────
function setSaveStatus(status) {
  const el = document.getElementById('saveIndicator');
  if (!el) return;
  el.className = 'save-indicator';
  if (status === 'saving') {
    el.textContent = window.t.saving;
  } else if (status === 'saved') {
    el.classList.add('saved');
    el.textContent = window.t.saved;
    setTimeout(() => { el.textContent = ''; el.className = 'save-indicator'; }, 2000);
  } else if (status === 'error') {
    el.classList.add('error');
    el.textContent = window.t.saveFailed;
  } else {
    el.textContent = '';
  }
}

// ── Auto-save (debounced) ─────────────────────────
function scheduleSave(field = 'caption') {
  pendingFields.add(field);
  clearTimeout(saveTimer);
  setSaveStatus('saving');
  saveTimer = setTimeout(performSave, 800);
}

async function performSave() {
  const themeId = document.getElementById('themeSelect').value || null;
  const soundscapeId = document.getElementById('soundscapeSelect').value || 'none';
  const fields = new Set(pendingFields); pendingFields.clear();
  const payload = {};
  if (fields.has('themeId')) payload.themeId = themeId;
  if (fields.has('soundscape')) {
    const selected = soundscapes.find(item => item.id === soundscapeId);
    payload.soundscape = { preset: soundscapeId, ...(selected?.defaults || { intensity: 0, warmth: 50, motion: 0 }) };
  }
  if (fields.has('caption')) payload.caption = currentCaptions;
  if (fields.has('seEffect')) payload.seEffect = document.getElementById('effectSelect').value || 'none';
  if (fields.has('template') && canSelectTemplate) payload.template = document.getElementById('templateSelect').value || 'galaxy';
  try {
    const res = await fetch(`${API_BASE}/galaxies/${galaxyId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setSaveStatus('saved');
    } else if (res.status === 403) {
      const data = await res.json();
      setSaveStatus('error');
      showToast(window.t.needPlanSave(data.message), 'error');
    } else {
      setSaveStatus('error');
    }
  } catch {
    setSaveStatus('error');
  }
}

// ── Subscription lock ─────────────────────────────
function applyLock(sectionId, planLabel) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  section.classList.add('section-locked');

  const msg = document.createElement('div');
  msg.className = 'feature-lock-msg';
  msg.innerHTML = `${window.t.needPlan(planLabel)}&nbsp;&nbsp;<a href="/portal/">${window.t.upgrade}</a>`;
  section.appendChild(msg);
}

async function applySubscriptionLock() {
  try {
    const res = await fetch(`${API_BASE}/payment/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return;
    const data = await res.json();
    const sub = data.meta;
    const features = new Set(sub?.features || []);
    if (features.has('fall_universe')) {
      canSelectTemplate = true;
      document.getElementById('templateSection').style.display = 'block';
    }
    if (!features.has('themes')) applyLock('themeSection', 'Plus');
    if (!features.has('text'))   applyLock('captionSection', 'Pro');
  } catch { /* silent */ }
}

// ── Load themes / original soundscapes ────────────
async function loadOptions() {
  try {
    const [themesRes, soundscapesRes] = await Promise.all([
      fetch(`${API_BASE}/media/themes`),
      fetch(`${API_BASE}/media/soundscapes`),
    ]);
    themes = (await themesRes.json()).meta || [];
    soundscapes = (await soundscapesRes.json()).meta || [];
    populateSelects();
  } catch (err) {
    console.error('Failed to load options:', err);
  }
}

function populateSelects() {
  const themeSelect = document.getElementById('themeSelect');
  const soundscapeSelect = document.getElementById('soundscapeSelect');
  themes.forEach(theme => {
    const opt = document.createElement('option');
    opt.value = theme._id;
    opt.textContent = theme.name;
    themeSelect.appendChild(opt);
  });
  soundscapes.filter(item => item.id !== 'none').forEach(soundscape => {
    const opt = document.createElement('option');
    opt.value = soundscape.id;
    opt.textContent = userLang === 'en' ? soundscape.labelEn : soundscape.label;
    soundscapeSelect.appendChild(opt);
  });
}

// ── Load current galaxy data ──────────────────────
async function loadGalaxyCustomization() {
  try {
    const res = await fetch(`${API_BASE}/galaxies/${galaxyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const galaxy = data.meta;
    if (!galaxy) return;
    if (galaxy.themeId) document.getElementById('themeSelect').value = galaxy.themeId;
    document.getElementById('soundscapeSelect').value = galaxy.soundscape?.preset || 'none';
    if (galaxy.template) document.getElementById('templateSelect').value = galaxy.template;
    const effectEl = document.getElementById('effectSelect');
    if (effectEl) effectEl.value = galaxy.seEffect || 'none';
    if (Array.isArray(galaxy.caption)) {
      currentCaptions = galaxy.caption;
      renderCaptions();
    }
  } catch (err) {
    console.error('Failed to load galaxy:', err);
  }
}

// ── Caption render + drag-and-drop ───────────────
function renderCaptions() {
  const list = document.getElementById('captionList');
  list.textContent = '';
  currentCaptions.forEach((caption, index) => {
    const item = document.createElement('div');
    item.className = 'caption-item';
    item.draggable = true;
    item.dataset.index = String(index);

    const handle = document.createElement('span');
    handle.className = 'drag-handle';
    handle.textContent = '⋮⋮';

    const text = document.createElement('span');
    text.className = 'caption-text';
    text.textContent = caption;

    const btn = document.createElement('button');
    btn.textContent = '\xD7';
    btn.addEventListener('click', () => removeCaption(index));

    item.appendChild(handle);
    item.appendChild(text);
    item.appendChild(btn);

    item.addEventListener('dragstart', onDragStart);
    item.addEventListener('dragover', onDragOver);
    item.addEventListener('dragleave', onDragLeave);
    item.addEventListener('drop', onDrop);
    item.addEventListener('dragend', onDragEnd);

    list.appendChild(item);
  });
}

function onDragStart(e) {
  dragSrcIndex = parseInt(this.dataset.index, 10);
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  this.classList.add('drag-over');
}

function onDragLeave() {
  this.classList.remove('drag-over');
}

function onDrop(e) {
  e.preventDefault();
  this.classList.remove('drag-over');
  const targetIndex = parseInt(this.dataset.index, 10);
  if (dragSrcIndex !== null && dragSrcIndex !== targetIndex) {
    const moved = currentCaptions.splice(dragSrcIndex, 1)[0];
    currentCaptions.splice(targetIndex, 0, moved);
    renderCaptions();
    scheduleSave();
  }
}

function onDragEnd() {
  document.querySelectorAll('.caption-item').forEach(el => {
    el.classList.remove('dragging', 'drag-over');
  });
  dragSrcIndex = null;
}

function removeCaption(index) {
  currentCaptions.splice(index, 1);
  renderCaptions();
  scheduleSave();
}

// ── Add caption ───────────────────────────────────
document.getElementById('addCaptionBtn').addEventListener('click', () => {
  const input = document.getElementById('captionInput');
  const text = input.value.trim();
  if (text) {
    currentCaptions.push(text);
    renderCaptions();
    input.value = '';
    scheduleSave();
  }
});

document.getElementById('captionInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('addCaptionBtn').click();
});

// ── Trigger auto-save on select changes ──────────
document.getElementById('themeSelect').addEventListener('change', () => scheduleSave('themeId'));
document.getElementById('soundscapeSelect').addEventListener('change', () => scheduleSave('soundscape'));
document.getElementById('templateSelect').addEventListener('change', () => scheduleSave('template'));
document.getElementById('effectSelect').addEventListener('change', () => scheduleSave('seEffect'));

// ── Initialize ────────────────────────────────────
(async () => {
  await applySubscriptionLock();
  await loadOptions();
  await loadGalaxyCustomization();
})();

window.removeCaption = removeCaption;

// ── Story Banner ──────────────────────────────────────────────────────────
async function loadStoryBanner() {
  if (!galaxyId) return;
  const res = await fetch(`/galaxies/${galaxyId}`, {
    headers: { Authorization: 'Bearer ' + token }
  });
  if (!res.ok) return;
  const galaxy = (await res.json()).meta;

  const OCCASION_LABELS = {
    anniversary: 'Kỷ niệm', confession: 'Tỏ tình',
    missing: 'Nhớ nhau', proposal: 'Cầu hôn', birthday: 'Sinh nhật',
  };
  const banner   = document.getElementById('story-banner');
  const infoCard = document.getElementById('story-info-card');

  if (galaxy.storyType) {
    const label = document.getElementById('story-occasion-label');
    label.textContent = OCCASION_LABELS[galaxy.occasion] || galaxy.occasion;
    infoCard.style.display = 'flex';
    document.getElementById('btn-story-reset').addEventListener('click', () => {
      window.location.href = `/portal/story-setup.html?galaxyId=${galaxyId}`;
    });
  } else {
    banner.style.display = 'flex';
    document.getElementById('btn-story-add').addEventListener('click', () => {
      window.location.href = `/portal/story-setup.html?galaxyId=${galaxyId}`;
    });
    document.getElementById('btn-story-dismiss').addEventListener('click', () => {
      banner.style.display = 'none';
    });
  }
}

loadStoryBanner();
