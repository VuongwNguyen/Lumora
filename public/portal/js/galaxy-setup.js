const params   = new URLSearchParams(location.search);
const galaxyId = params.get('galaxyId');
const token    = localStorage.getItem('token');
const activity = window.LumoraActivity;

function tr(key, ...args) {
  const value = window.t?.[key];
  return typeof value === 'function' ? value(...args) : (value || key);
}

function trackResult(action, ok, metadata, error) {
  activity?.logResult(action, ok, metadata || {}, error, { galaxyId });
}

if (!token) window.location.href = '/auth/';
if (!galaxyId) window.location.href = '/portal/';

let galaxy       = null;
let galleryItems = [];
let themes       = [];
let musics       = [];
let currentAudio = null;
let userPlan     = 'free'; // 'free' | 'plus' | 'pro'
let userFeatures = new Set();

function canUseFeature(feature) { return userFeatures.has(feature); }

function applySubLocks() {
  const locks = [
    { tabId: 'tab-theme', paneId: 'tab-theme', feature: 'themes', label: 'Plus', descKey: 'setupFeatureTheme' },
    { tabId: 'tab-music', paneId: 'tab-music', feature: 'music', label: 'Pro', descKey: 'setupFeatureMusic' },
    { tabId: 'tab-caption', paneId: 'tab-caption', feature: 'text', label: 'Pro', descKey: 'setupFeatureCaption' },
  ];
  locks.forEach(({ tabId, paneId, feature, label, descKey }) => {
    if (canUseFeature(feature)) return;
    // Dim tab button
    const btn = document.querySelector(`.tab-btn[data-tab="${tabId.replace('tab-','')}"]`);
    if (btn) { btn.style.opacity = '0.45'; btn.title = tr('setupRequiresPlan', label); }
    // Replace premium content with a consistent upgrade state while retaining the tab heading.
    const pane = document.getElementById(paneId);
    if (!pane) return;
    const heading = pane.querySelector('.tab-heading');
    const state = el('div', 'feature-lock-state');
    const content = el('div');
    content.appendChild(el('div', 'feature-lock-icon', '◇'));
    content.appendChild(el('div', 'feature-lock-title', tr(descKey)));
    content.appendChild(el('div', 'feature-lock-copy', tr('setupPlanBenefit', label)));
    const action = el('a', 'feature-lock-action', tr('setupViewPlan', label));
    action.href = '/portal/?tab=subscription';
    action.dataset.trackAction = 'Galaxy Upgrade Click';
    action.dataset.trackId = `upgrade_${feature}`;
    content.appendChild(action);
    state.appendChild(content);
    pane.replaceChildren();
    if (heading) pane.appendChild(heading);
    pane.appendChild(state);
  });
}

const frame = document.getElementById('galaxy-frame');

function refreshPreview() {
  frame.src = `/view/?galaxyId=${galaxyId}&skip_se=true&autostart=true&_t=${Date.now()}`;
}

const toast = document.getElementById('toast');

// ── Helpers ────────────────────────────────────────────────

let toastTimer;
function showToast(msg, duration = 2200) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function clear(node) { node.replaceChildren(); }

// ── Inline galaxy name editor ─────────────────────────────

function setupNameEditor(initialName) {
  const button = document.getElementById('galaxy-name-button');
  const nameEl = document.getElementById('galaxy-name');
  const input = document.getElementById('galaxy-name-input');
  const status = document.getElementById('galaxy-name-status');
  let savedName = initialName;
  let saving = false;
  let cancelled = false;

  function closeEditor({ restoreFocus = false } = {}) {
    input.hidden = true;
    button.hidden = false;
    if (restoreFocus) button.focus();
  }

  function showEditor() {
    if (saving) { activity?.logBlocked('Galaxy Rename Blocked', 'operation_in_progress', {}, { galaxyId }); return; }
    cancelled = false;
    status.textContent = '';
    status.classList.remove('error');
    input.value = savedName;
    button.hidden = true;
    input.hidden = false;
    input.focus();
    input.select();
  }

  async function finishEditing() {
    if (saving) { activity?.logBlocked('Galaxy Rename Blocked', 'operation_in_progress', {}, { galaxyId }); return; }
    if (cancelled) {
      cancelled = false;
      input.value = savedName;
      status.textContent = '';
      status.classList.remove('error');
      closeEditor({ restoreFocus: true });
      activity?.log({ action: 'Galaxy Rename Cancel', feature: 'galaxy', level: 'warn', galaxyId });
      return;
    }

    const nextName = input.value.trim();
    if (!nextName) {
      activity?.logBlocked('Galaxy Rename Blocked', 'missing_input', {}, { galaxyId });
      status.textContent = tr('setupNameEmpty');
      status.classList.add('error');
      input.focus();
      return;
    }
    if (nextName === savedName) {
      status.textContent = '';
      status.classList.remove('error');
      closeEditor();
      return;
    }

    saving = true;
    activity?.log({ action: 'Galaxy Rename Submit', feature: 'galaxy', galaxyId });
    input.disabled = true;
    status.textContent = tr('setupSaving');
    status.classList.remove('error');

    try {
      const res = await fetch(`/galaxies/${galaxyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ name: nextName }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const error = new Error(body.message || `Rename failed: ${res.status}`);
        error.status = res.status;
        throw error;
      }

      savedName = body.meta?.name || nextName;
      galaxy.name = savedName;
      nameEl.textContent = savedName;
      document.getElementById('preview-caption').textContent = savedName;
      document.title = `${savedName} — Lumora`;
      status.textContent = '';
      closeEditor();
      showToast(tr('setupRenamed'));
      trackResult('Galaxy Rename Result', true);
    } catch (err) {
      trackResult('Galaxy Rename Result', false, { errorType: 'galaxy_update_fail' }, err);
      input.disabled = false;
      const duplicate = err.status === 409 || /already exists|duplicate/i.test(err.message);
      status.textContent = duplicate ? tr('setupNameDuplicate') : tr('setupNameSaveFail');
      status.classList.add('error');
      input.focus();
      input.select();
    } finally {
      saving = false;
      input.disabled = false;
    }
  }

  button.addEventListener('click', showEditor);
  input.addEventListener('blur', finishEditing);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finishEditing();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelled = true;
      input.blur();
    }
  });
}

// ── Checklist ──────────────────────────────────────────────

function updateChecklist() {
  const hasPhotos = galleryItems.length > 0;
  const checks = [
    { id: 'check-photos', done: hasPhotos },
    { id: 'check-theme',  done: !!galaxy.themeId },
    { id: 'check-music',  done: !!galaxy.backgroundMusicId },
    { id: 'check-story',  done: !!galaxy.storyType },
  ];
  let done = 0;
  checks.forEach(({ id, done: isDone }) => {
    document.getElementById(id).classList.toggle('done', isDone);
    if (isDone) done++;
  });
  document.getElementById('progress-fill').style.width = Math.round(done / checks.length * 100) + '%';
  document.getElementById('progress-label').textContent = tr('setupProgress', done, checks.length);
  document.querySelector('.progress-bar-track')?.setAttribute('aria-valuenow', String(done));

  const shareBtn  = document.getElementById('share-btn');
  const shareHint = document.getElementById('share-hint');
  shareBtn.disabled = !hasPhotos;
  shareHint.style.display = hasPhotos ? 'none' : 'block';

  updateGELock();
}

// ── Gallery ────────────────────────────────────────────────

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  clear(grid);
  galleryItems.forEach(item => {
    const wrap = el('div', 'gallery-thumb');
    const img  = el('img');
    img.src = item.imageUrl; img.alt = '';
    const delBtn = el('button', 'del-btn', '✕');
    delBtn.type = 'button';
    delBtn.dataset.trackAction = 'Galaxy Photo Delete Click';
    delBtn.onclick = (e) => { e.stopPropagation(); deletePhoto(item._id); };
    wrap.appendChild(img);
    wrap.appendChild(delBtn);
    grid.appendChild(wrap);
  });
}

async function deletePhoto(imageId) {
  try {
    await fetch(`/gallary/items/${imageId}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token },
    });
    galleryItems = galleryItems.filter(i => i._id !== imageId);
    renderGallery();
    updateChecklist();
    refreshPreview();
  } catch { showToast(tr('setupDeletePhotoFail')); }
}

function handleUpload(files) {
  if (!files.length) return;
  const form = new FormData();
  form.append('galaxyId', galaxyId);
  form.append('title', 'Uploaded image');
  form.append('description', 'Image uploaded from portal');
  Array.from(files).forEach(f => form.append('files', f));

  const progBar  = document.getElementById('upload-progress');
  const progFill = document.getElementById('upload-progress-fill');
  progBar.style.display = 'block';

  const xhr = new XMLHttpRequest();
  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) progFill.style.width = Math.round(e.loaded / e.total * 100) + '%';
  };
  xhr.onload = async () => {
    progBar.style.display = 'none';
    progFill.style.width = '0%';
    if (xhr.status >= 200 && xhr.status < 300) {
      const res = await fetch(`/gallary/my-items?galaxyId=${galaxyId}`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.ok) galleryItems = (await res.json()).meta || [];
      renderGallery();
      updateChecklist();
      refreshPreview();
      showToast(tr('setupUploadSuccess'));
    } else {
      showToast(tr('setupUploadFail'));
    }
  };
  xhr.onerror = () => { progBar.style.display = 'none'; showToast(tr('errConnect')); };
  xhr.open('POST', '/gallary/upload');
  xhr.setRequestHeader('Authorization', 'Bearer ' + token);
  xhr.send(form);
}

// ── Theme ──────────────────────────────────────────────────

function renderThemes() {
  const wrap = document.getElementById('theme-content');
  clear(wrap);

  if (!themes.length) {
    const empty = el('div', 'empty-state');
    empty.appendChild(el('div', 'empty-state-icon', '🎨'));
    empty.appendChild(el('div', null, tr('setupNoThemes')));
    wrap.appendChild(empty);
    return;
  }

  const grid = el('div', 'theme-grid');

  const noTheme = el('button', 'theme-no' + (!galaxy.themeId ? ' selected' : ''), tr('setupNoTheme'));
  noTheme.type = 'button';
  noTheme.dataset.trackAction = 'Galaxy Theme Select';
  noTheme.dataset.trackId = 'theme_none';
  noTheme.onclick = () => applyTheme(null);
  grid.appendChild(noTheme);

  themes.forEach(th => {
    const card = el('button', 'theme-card' + (galaxy.themeId === th._id ? ' selected' : ''));
    card.type = 'button';
    card.dataset.trackAction = 'Galaxy Theme Select';
    card.dataset.trackId = 'theme_option';
    if (th.previewUrl) {
      const img = el('img'); img.src = th.previewUrl; img.alt = th.name;
      card.appendChild(img);
    } else {
      const ph = el('div');
      ph.style.cssText = 'aspect-ratio:16/9;background:rgba(139,92,246,0.15);display:flex;align-items:center;justify-content:center;font-size:24px;';
      ph.textContent = '🎨';
      card.appendChild(ph);
    }
    card.appendChild(el('div', 'theme-name', th.name));
    card.onclick = () => applyTheme(th._id, th.name);
    grid.appendChild(card);
  });

  wrap.appendChild(grid);
}

async function applyTheme(themeId, name) {
  galaxy.themeId = themeId;
  renderThemes();
  updateChecklist();
  // Instant live update
  const th = themes.find(t => t._id === themeId);
  try {
    await fetch(`/galaxies/${galaxyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ themeId }),
    });
    showToast(themeId ? tr('setupSelected', name) : tr('setupThemeRemoved'));
    trackResult('Galaxy Theme Result', true, { selected: Boolean(themeId) });
    refreshPreview();
  } catch (error) { trackResult('Galaxy Theme Result', false, { errorType: 'theme_save_fail' }, error); showToast(tr('setupSaveFail')); galaxy.themeId = null; renderThemes(); }
}

// ── Music ──────────────────────────────────────────────────

function renderMusics() {
  const wrap = document.getElementById('music-content');
  clear(wrap);

  if (!musics.length) {
    const empty = el('div', 'empty-state');
    empty.appendChild(el('div', 'empty-state-icon', '🎵'));
    empty.appendChild(el('div', null, tr('setupNoMusicAvailable')));
    wrap.appendChild(empty);
    return;
  }

  const noMusic = el('button', 'music-no' + (!galaxy.backgroundMusicId ? ' selected' : ''), tr('setupNoMusic'));
  noMusic.type = 'button';
  noMusic.dataset.trackAction = 'Galaxy Music Select';
  noMusic.dataset.trackId = 'music_none';
  noMusic.onclick = () => applyMusic(null);
  wrap.appendChild(noMusic);

  musics.forEach(m => {
    const item = el('div', 'music-item' + (galaxy.backgroundMusicId === m._id ? ' selected' : ''));
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.dataset.trackAction = 'Galaxy Music Select';
    item.dataset.trackId = 'music_option';

    const playBtn = el('button', 'music-play', '▶');
    playBtn.type = 'button';
    playBtn.setAttribute('aria-label', tr('setupMusicPreview', m.name));
    const previewSrc = m.source === 'soundcloud' ? m.permalink : `/media/musics/${m._id}/stream`;
    playBtn.onclick = (e) => { e.stopPropagation(); togglePreviewMusic(previewSrc, playBtn); };

    const info = el('div', 'music-info');
    info.appendChild(el('div', 'music-name', m.name));

    item.appendChild(playBtn);
    item.appendChild(info);
    item.onclick = () => applyMusic(m._id, m.name);
    item.onkeydown = event => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target === item) {
        event.preventDefault();
        applyMusic(m._id, m.name);
      }
    };
    wrap.appendChild(item);
  });
}

function togglePreviewMusic(url, btn) {
  if (currentAudio && !currentAudio.paused) {
    currentAudio.pause();
    document.querySelectorAll('.music-play').forEach(b => b.textContent = '▶');
    if (currentAudio.src.includes(url)) { currentAudio.destroy?.(); currentAudio = null; return; }
  }
  currentAudio?.destroy?.(); // gỡ iframe/widget cũ trước khi tạo bài mới
  currentAudio = window.createGalaxyAudio(url);
  currentAudio.play();
  btn.textContent = '■';
  currentAudio.onended = () => { btn.textContent = '▶'; };
}

async function applyMusic(musicId, name) {
  galaxy.backgroundMusicId = musicId;
  renderMusics();
  updateChecklist();
  try {
    await fetch(`/galaxies/${galaxyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ backgroundMusicId: musicId }),
    });
    showToast(musicId ? tr('setupSelected', name) : tr('setupMusicRemoved'));
    trackResult('Galaxy Music Result', true, { selected: Boolean(musicId) });
    refreshPreview();
  } catch (error) { trackResult('Galaxy Music Result', false, { errorType: 'music_save_fail' }, error); showToast(tr('setupSaveFail')); }
}

// ── Caption ────────────────────────────────────────────────

function renderCaptions() {
  const list = document.getElementById('caption-list');
  if (!list) return;
  list.replaceChildren();
  (galaxy.caption || []).forEach((text, i) => {
    const item = el('div', 'caption-item');
    item.draggable = true;
    item.dataset.idx = i;

    const handle = el('span', 'caption-drag', '⠿');
    handle.title = tr('setupDragCaption');
    item.appendChild(handle);
    item.appendChild(el('span', null, text));
    const del = el('button', null, '✕');
    del.type = 'button';
    del.setAttribute('aria-label', tr('setupDeleteCaption'));
    del.onclick = () => deleteCaption(i);
    item.appendChild(del);
    list.appendChild(item);
  });

  // Drag-to-reorder
  let dragIdx = null;
  list.querySelectorAll('.caption-item').forEach(item => {
    item.addEventListener('dragstart', e => {
      dragIdx = parseInt(item.dataset.idx);
      item.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    item.addEventListener('dragover', e => {
      e.preventDefault();
      item.classList.add('drag-over');
    });
    item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
    item.addEventListener('drop', async e => {
      e.preventDefault();
      item.classList.remove('drag-over');
      const dropIdx = parseInt(item.dataset.idx);
      if (dragIdx === null || dragIdx === dropIdx) return;
      const arr = [...(galaxy.caption || [])];
      const [moved] = arr.splice(dragIdx, 1);
      arr.splice(dropIdx, 0, moved);
      galaxy.caption = arr;
      renderCaptions();
      try { await saveCaption(galaxy.caption); } catch { showToast(tr('setupSaveFail')); }
    });
  });
}

// ── Universe template ──────────────────────────────────────

function renderUniverses() {
  const wrap = document.getElementById('universe-options');
  if (!wrap) return;
  clear(wrap);
  const options = [
    { id: 'galaxy', icon: '🌌', name: 'Galaxy Classic', desc: tr('setupGalaxyClassicDescription'), tier: 0 },
    { id: 'fall', icon: '🎞', name: 'Fall Through Memories', desc: tr('setupFallDescription'), feature: 'fall_universe', requiredPlan: 'Pro', tier: 2 },
  ].sort((left, right) => {
    const leftLocked = left.feature && !canUseFeature(left.feature) ? 1 : 0;
    const rightLocked = right.feature && !canUseFeature(right.feature) ? 1 : 0;
    return leftLocked - rightLocked || left.tier - right.tier;
  });
  options.forEach(option => {
    const locked = Boolean(option.feature && !canUseFeature(option.feature));
    const selected = (galaxy.template || 'galaxy') === option.id;
    const button = el('button', 'theme-card universe-card' + (selected ? ' selected' : '') + (locked ? ' locked' : ''));
    button.type = 'button';
    button.dataset.trackAction = 'Galaxy Universe Select';
    button.dataset.trackId = 'universe_' + option.id;
    if (locked) button.dataset.blockedReason = 'plan_required';
    const header = el('div', 'universe-card-header');
    header.appendChild(el('span', 'universe-card-name', option.icon + ' ' + option.name));
    if (option.requiredPlan) header.appendChild(el('span', 'universe-plan-badge', (locked ? '🔒 ' : '') + option.requiredPlan));
    button.appendChild(header);
    button.appendChild(el('div', 'universe-card-desc', option.desc));
    button.onclick = () => applyUniverse(option.id);
    wrap.appendChild(button);
  });
}

async function applyUniverse(template) {
  if (template === 'fall' && !canUseFeature('fall_universe')) {
    activity?.logBlocked('Galaxy Universe Change Blocked', 'plan_required', { template }, { galaxyId });
    showToast(tr('setupFallRequiresPro'));
    return;
  }
  const previous = galaxy.template || 'galaxy';
  galaxy.template = template;
  renderUniverses();
  try {
    const response = await fetch(`/galaxies/${galaxyId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ template }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || tr('setupUniverseChangeFail'));
    galaxy = body.meta || galaxy;
    refreshPreview();
    trackResult('Galaxy Universe Change Result', true, { template });
    showToast(tr('setupUniverseChanged'));
  } catch (error) {
    galaxy.template = previous; renderUniverses();
    trackResult('Galaxy Universe Change Result', false, { template, errorType: 'universe_save_fail' }, error);
    showToast(error.message || tr('setupUniverseChangeFail'));
  }
}

async function saveCaption(captions) {
  await fetch(`/galaxies/${galaxyId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ caption: captions }),
  });
  refreshPreview();
}

async function addCaption() {
  const input = document.getElementById('caption-input');
  const text = input.value.trim();
  if (!text) { activity?.logBlocked('Galaxy Caption Add Blocked', 'missing_input', {}, { galaxyId }); return; }
  galaxy.caption = [...(galaxy.caption || []), text];
  input.value = '';
  renderCaptions();
  try { await saveCaption(galaxy.caption); trackResult('Galaxy Caption Add Result', true, { count: galaxy.caption.length }); showToast(tr('setupCaptionAdded')); }
  catch (error) { trackResult('Galaxy Caption Add Result', false, { errorType: 'caption_save_fail' }, error); showToast(tr('setupSaveFail')); }
}

async function deleteCaption(idx) {
  galaxy.caption = (galaxy.caption || []).filter((_, i) => i !== idx);
  renderCaptions();
  try { await saveCaption(galaxy.caption); trackResult('Galaxy Caption Delete Result', true, { count: galaxy.caption.length }); }
  catch (error) { trackResult('Galaxy Caption Delete Result', false, { errorType: 'caption_save_fail' }, error); showToast(tr('setupSaveFail')); }
}

// ── Story ──────────────────────────────────────────────────

function renderStory() {
  const wrap = document.getElementById('story-content');
  clear(wrap);

  if (galaxy.storyType) {
    const status = el('div', 'story-status');
    status.appendChild(el('div', 'story-badge', tr('setupStoryCreated')));
    status.appendChild(el('div', 'story-type-label', galaxy.storyType));
    if (galaxy.occasion) status.appendChild(el('div', 'story-occ', galaxy.occasion));
    wrap.appendChild(status);
  } else {
    const empty = el('div', 'empty-state');
    empty.appendChild(el('div', 'empty-state-icon', '🎭'));
    empty.appendChild(el('div', null, tr('setupStoryEmpty')));
    wrap.appendChild(empty);
  }

  const btn = el('button', 'btn-story', galaxy.storyType ? tr('setupStoryEdit') : tr('setupStoryCreate'));
  btn.type = 'button';
  btn.onclick = () => { window.location.href = `/portal/story-setup.html?galaxyId=${galaxyId}`; };
  wrap.appendChild(btn);
}

// ── GE lock ────────────────────────────────────────────────

function updateGELock() {
  const hasStory = !!galaxy.storyType;
  document.querySelectorAll('.ge-tab').forEach(btn => {
    btn.classList.toggle('locked', !hasStory);
  });
  ['tab-universe', 'tab-photos', 'tab-theme', 'tab-music'].forEach(id => {
    const pane = document.getElementById(id);
    if (!pane) return;
    const existing = pane.querySelector('.ge-lock-banner');
    if (!hasStory) {
      if (!existing) {
        const banner = el('div', 'ge-lock-banner');
        const strong = el('strong', null, tr('setupStoryRecommendation'));
        const link   = el('button', 'ge-lock-action', tr('setupStoryRecommendationAction'));
        link.type = 'button';
        link.onclick = () => switchTab('story');
        const text   = document.createTextNode(tr('setupStoryRecommendationCopy'));
        banner.appendChild(strong);
        banner.appendChild(text);
        banner.appendChild(link);
        pane.insertBefore(banner, pane.firstChild);
      }
    } else {
      if (existing) existing.remove();
    }
  });
}

// ── Tabs ───────────────────────────────────────────────────

function switchTab(tabId) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    const active = b.dataset.tab === tabId;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tabId));
}

// ── Init ───────────────────────────────────────────────────

async function init() {
  try {
    const [galaxyRes, galleryRes, themesRes, musicsRes, subRes] = await Promise.all([
      fetch(`/galaxies/${galaxyId}`, { headers: { Authorization: 'Bearer ' + token } }),
      fetch(`/gallary/my-items?galaxyId=${galaxyId}`, { headers: { Authorization: 'Bearer ' + token } }),
      fetch('/media/themes'),
      fetch('/media/musics'),
      fetch('/payment/status', { headers: { Authorization: 'Bearer ' + token } }),
    ]);

    if (!galaxyRes.ok) { window.location.href = '/portal/'; return; }

    const galaxyData   = await galaxyRes.json();
    const galleryData  = galleryRes.ok  ? await galleryRes.json()  : {};
    const themesData   = themesRes.ok   ? await themesRes.json()   : {};
    const musicsData   = musicsRes.ok   ? await musicsRes.json()   : {};
    const subData      = subRes.ok      ? await subRes.json()      : {};

    galaxy       = galaxyData.meta;
    galleryItems = galleryData.meta  || [];
    themes       = themesData.meta   || [];
    musics       = musicsData.meta   || [];
    userPlan     = subData.meta?.plan || 'free';
    userFeatures = new Set(subData.meta?.features || []);

    document.getElementById('galaxy-name').textContent = galaxy.name || 'Galaxy';
    document.getElementById('preview-caption').textContent = galaxy.name || 'Galaxy';
    document.title = `${galaxy.name || 'Galaxy'} — Lumora`;
    setupNameEditor(galaxy.name || 'Galaxy');

    refreshPreview();

    renderGallery();
    renderUniverses();
    renderThemes();
    renderMusics();
    renderStory();
    renderCaptions();
    updateChecklist();
    applySubLocks();
    trackResult('Galaxy Setup Loaded', true, { photoCount: galleryItems.length, plan: userPlan });

    // Always start on Story tab — SE comes first
    switchTab('story');

  } catch (err) {
    trackResult('Galaxy Setup Failed', false, { errorType: 'galaxy_fetch_fail' }, err);
    console.error('[galaxy-setup] init error:', err);
    showToast(tr('setupLoadFail'));
  }
}

// ── Events ─────────────────────────────────────────────────

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => switchTab(btn.dataset.tab);
});

document.querySelectorAll('.check-item').forEach(item => {
  item.onclick = () => switchTab(item.dataset.tab);
});

const zone      = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
zone.onclick    = () => fileInput.click();
zone.onkeydown = event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    fileInput.click();
  }
};
fileInput.onchange = () => handleUpload(fileInput.files);
zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('dragover'); };
zone.ondragleave = () => zone.classList.remove('dragover');
zone.ondrop = (e) => {
  e.preventDefault();
  zone.classList.remove('dragover');
  handleUpload(e.dataTransfer.files);
};

document.getElementById('share-btn').onclick = () => {
  const url = `${location.origin}/view/?galaxyId=${galaxyId}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => showToast(tr('setupLinkCopied')));
  } else {
    showToast(url);
  }
};

// ── Panel toggle ───────────────────────────────────────────
const toggleBtn = document.getElementById('panel-toggle');
const panel     = document.getElementById('setup-panel');
toggleBtn.onclick = () => {
  const collapsed = panel.classList.toggle('collapsed');
  toggleBtn.textContent = collapsed ? '▶' : '◀';
  toggleBtn.setAttribute('aria-expanded', String(!collapsed));
  toggleBtn.setAttribute('aria-label', collapsed ? tr('setupPanelShow') : tr('setupPanelHide'));
  toggleBtn.title = collapsed ? tr('setupPanelShow') : tr('setupPanelHide');
};

document.getElementById('delete-galaxy-btn').onclick = async () => {
  if (!confirm(tr('setupDeleteConfirm'))) {
    activity?.log({ action: 'Galaxy Delete Cancel', feature: 'galaxy', level: 'warn', galaxyId });
    return;
  }
  activity?.log({ action: 'Galaxy Delete Confirm', feature: 'galaxy', galaxyId });
  try {
    const res = await fetch(`/galaxies/${galaxyId}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token },
    });
    if (res.ok) {
      showToast(tr('setupDeleted'));
      setTimeout(() => { window.location.href = '/portal/'; }, 1000);
    } else {
      showToast(tr('setupDeleteFail'));
    }
  } catch { showToast(tr('errConnect')); }
};

document.getElementById('caption-add-btn').onclick = addCaption;
document.getElementById('caption-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addCaption();
});

init();
