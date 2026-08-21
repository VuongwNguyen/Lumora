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
let soundscapes  = [];
let currentAudio = null;
let previewTake  = 0;
let userPlan     = 'free'; // 'free' | 'plus' | 'pro'
let userFeatures = new Set();
let isAdmin      = false;
let soundscapeInstruments = [];
let imageUploadPolicy = null;
let gallerySelectionMode = false;
let galleryBulkDeleting = false;
const selectedPhotoIds = new Set();

function canUseFeature(feature) { return userFeatures.has(feature); }

function applySubLocks() {
  const locks = [
    { tabId: 'tab-theme', paneId: 'tab-theme', feature: 'themes', label: 'Plus', descKey: 'setupFeatureTheme' },
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
const previewController = (() => {
  const refreshDelay = 160;
  let refreshTimer = null;
  let revision = 0;

  function setLoading(loading) {
    frame.classList.toggle('is-refreshing', loading);
    frame.setAttribute('aria-busy', String(loading));
  }

  function buildUrl() {
    const previewUrl = new URL('/view/', window.location.origin);
    previewUrl.searchParams.set('galaxyId', galaxyId);
    previewUrl.searchParams.set('skip_se', 'true');
    previewUrl.searchParams.set('autostart', 'true');
    previewUrl.searchParams.set('preview_rev', String(++revision));
    return previewUrl.href;
  }

  function navigate() {
    refreshTimer = null;
    setLoading(true);
    // Iframe navigations join the browser session history. replace() refreshes
    // the live preview without trapping Back inside previous iframe documents.
    frame.contentWindow.location.replace(buildUrl());
  }

  function refresh({ immediate = false } = {}) {
    clearTimeout(refreshTimer);
    if (immediate) navigate();
    else refreshTimer = setTimeout(navigate, refreshDelay);
  }

  function cancel() {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }

  frame.addEventListener('load', () => setLoading(false));
  return Object.freeze({ cancel, refresh });
})();

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
      previewController.refresh();
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
    { id: 'check-music',  done: galaxy.soundscape?.preset && galaxy.soundscape.preset !== 'none' },
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
  document.getElementById('gallery-bulk-toolbar').hidden = galleryItems.length === 0;
  galleryItems.forEach(item => {
    const wrap = el('div', 'gallery-thumb');
    const isSelected = selectedPhotoIds.has(item._id);
    wrap.classList.toggle('selecting', gallerySelectionMode);
    wrap.classList.toggle('selected', isSelected);
    const img  = el('img');
    img.src = item.imageUrl; img.alt = '';
    const delBtn = el('button', 'del-btn', '✕');
    delBtn.type = 'button';
    delBtn.dataset.trackAction = 'Galaxy Photo Delete Click';
    delBtn.onclick = (e) => { e.stopPropagation(); deletePhoto(item._id); };
    wrap.appendChild(img);
    if (gallerySelectionMode) {
      const selectBtn = el('button', 'select-btn', isSelected ? '✓' : '');
      selectBtn.type = 'button';
      selectBtn.setAttribute('aria-label', tr(isSelected ? 'setupBulkDeselectPhoto' : 'setupBulkSelectPhoto'));
      selectBtn.setAttribute('aria-pressed', String(isSelected));
      selectBtn.onclick = event => {
        event.stopPropagation();
        togglePhotoSelection(item._id);
      };
      wrap.appendChild(selectBtn);
      wrap.onclick = () => togglePhotoSelection(item._id);
    }
    if (!gallerySelectionMode) wrap.appendChild(delBtn);
    grid.appendChild(wrap);
  });
  updateGalleryBulkActions();
}

function updateGalleryBulkActions() {
  const selectModeButton = document.getElementById('gallery-select-mode');
  const actions = document.getElementById('gallery-bulk-actions');
  const count = selectedPhotoIds.size;
  selectModeButton.hidden = gallerySelectionMode;
  actions.hidden = !gallerySelectionMode;
  document.getElementById('gallery-bulk-count').textContent = tr('setupBulkSelected', count);
  const deleteButton = document.getElementById('gallery-bulk-delete');
  deleteButton.textContent = tr('setupBulkDelete', count);
  deleteButton.disabled = count === 0 || galleryBulkDeleting;
  const allSelected = galleryItems.length > 0 && count === galleryItems.length;
  const selectAllButton = document.getElementById('gallery-bulk-all');
  selectAllButton.textContent = tr(allSelected ? 'setupBulkDeselectAll' : 'setupBulkSelectAll');
  selectAllButton.disabled = galleryBulkDeleting;
}

function setGallerySelectionMode(enabled) {
  gallerySelectionMode = enabled;
  if (!enabled) selectedPhotoIds.clear();
  renderGallery();
}

function togglePhotoSelection(imageId) {
  if (galleryBulkDeleting) return;
  if (selectedPhotoIds.has(imageId)) selectedPhotoIds.delete(imageId);
  else selectedPhotoIds.add(imageId);
  renderGallery();
}

function toggleAllPhotoSelections() {
  if (galleryBulkDeleting) return;
  if (selectedPhotoIds.size === galleryItems.length) selectedPhotoIds.clear();
  else galleryItems.forEach(item => selectedPhotoIds.add(item._id));
  renderGallery();
}

async function deleteSelectedPhotos() {
  const ids = [...selectedPhotoIds];
  if (!ids.length || galleryBulkDeleting) return;
  if (!confirm(tr('setupBulkDeleteConfirm', ids.length))) return;
  if (!imageUploadPolicy?.maxBulkDeleteItems) {
    showToast(tr('setupBulkDeleteFail'));
    return;
  }

  galleryBulkDeleting = true;
  updateGalleryBulkActions();
  const deletedIds = [];
  const failedIds = [];
  try {
    for (let offset = 0; offset < ids.length; offset += imageUploadPolicy.maxBulkDeleteItems) {
      const batch = ids.slice(offset, offset + imageUploadPolicy.maxBulkDeleteItems);
      const response = await fetch(`/gallary/items/bulk-delete?galaxyId=${encodeURIComponent(galaxyId)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + token,
        },
        body: JSON.stringify({ ids: batch }),
      });
      if (!response.ok) throw new Error('bulk photo delete failed');
      const result = (await response.json()).meta || {};
      deletedIds.push(...(result.deletedIds || []));
      failedIds.push(...(result.failedIds || []));
    }

    const deletedSet = new Set(deletedIds);
    galleryItems = galleryItems.filter(item => !deletedSet.has(item._id));
    selectedPhotoIds.clear();
    failedIds.forEach(id => selectedPhotoIds.add(id));
    gallerySelectionMode = failedIds.length > 0;
    trackResult('Galaxy Photo Bulk Delete Result', failedIds.length === 0, {
      requestedCount: ids.length,
      deletedCount: deletedIds.length,
      failedCount: failedIds.length,
      ...(failedIds.length && { errorType: 'photo_delete_fail' }),
    });
    showToast(failedIds.length
      ? tr('setupBulkDeletePartial', deletedIds.length, failedIds.length)
      : tr('setupBulkDeleteSuccess', deletedIds.length));
    updateChecklist();
    previewController.refresh();
  } catch (error) {
    if (deletedIds.length) {
      const deletedSet = new Set(deletedIds);
      galleryItems = galleryItems.filter(item => !deletedSet.has(item._id));
      deletedIds.forEach(id => selectedPhotoIds.delete(id));
      updateChecklist();
      previewController.refresh();
    }
    trackResult('Galaxy Photo Bulk Delete Result', false, {
      requestedCount: ids.length,
      deletedCount: deletedIds.length,
      errorType: 'photo_delete_fail',
    }, error);
    showToast(tr('setupBulkDeleteFail'));
  } finally {
    galleryBulkDeleting = false;
    renderGallery();
  }
}

async function deletePhoto(imageId) {
  try {
    const response = await fetch(`/gallary/items/${imageId}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token },
    });
    if (!response.ok) throw new Error('photo delete failed');
    galleryItems = galleryItems.filter(i => i._id !== imageId);
    renderGallery();
    updateChecklist();
    previewController.refresh();
  } catch { showToast(tr('setupDeletePhotoFail')); }
}

function validateUploadFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return [];
  if (!imageUploadPolicy) {
    showToast(tr('setupUploadPolicyFail'));
    return [];
  }
  if (files.length > imageUploadPolicy.maxFiles) {
    showToast(tr('setupUploadTooMany', imageUploadPolicy.maxFiles));
    return [];
  }
  const unsupported = files.find(file => !imageUploadPolicy.mimeTypes.includes(file.type));
  if (unsupported) {
    showToast(tr('setupUploadUnsupported', unsupported.name));
    return [];
  }
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > imageUploadPolicy.maxTotalSize) {
    showToast(tr('setupUploadTotalTooLarge', imageUploadPolicy.maxTotalSize / 1024 / 1024));
    return [];
  }
  return files;
}

function handleUpload(fileList) {
  const files = validateUploadFiles(fileList);
  if (!files.length) return;
  const form = new FormData();
  form.append('title', 'Uploaded image');
  form.append('description', 'Image uploaded from portal');
  files.forEach(file => form.append('files', file));

  const progBar  = document.getElementById('upload-progress');
  const progFill = document.getElementById('upload-progress-fill');
  progBar.style.display = 'block';

  const xhr = new XMLHttpRequest();
  xhr.upload.onprogress = event => {
    if (event.lengthComputable) progFill.style.width = Math.round(event.loaded / event.total * 100) + '%';
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
      previewController.refresh();
      showToast(tr('setupUploadSuccess'));
    } else {
      try {
        showToast(JSON.parse(xhr.responseText).message || tr('setupUploadFail'));
      } catch {
        showToast(tr('setupUploadFail'));
      }
    }
    fileInput.value = '';
  };
  xhr.onerror = () => {
    progBar.style.display = 'none';
    fileInput.value = '';
    showToast(tr('errConnect'));
  };
  xhr.open('POST', `/gallary/upload?galaxyId=${encodeURIComponent(galaxyId)}`);
  xhr.setRequestHeader('Authorization', 'Bearer ' + token);
  xhr.send(form);
}

// ── Theme ──────────────────────────────────────────────────

function safeThemeColor(value, fallback) {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value.trim())
    ? value.trim()
    : fallback;
}

function createThemePreview(theme) {
  const colors = theme?.colors || {};
  const preview = el('div', 'theme-preview');
  preview.setAttribute('aria-hidden', 'true');
  preview.style.setProperty('--theme-primary', safeThemeColor(colors.primary, '#8b5cf6'));
  preview.style.setProperty('--theme-secondary', safeThemeColor(colors.secondary, '#c4b5fd'));
  preview.style.setProperty('--theme-background', safeThemeColor(colors.background, '#090712'));
  preview.appendChild(el('div', 'theme-preview-orbit'));
  preview.appendChild(el('div', 'theme-preview-memory'));
  const copy = el('div', 'theme-preview-copy');
  copy.appendChild(el('span'));
  copy.appendChild(el('span'));
  preview.appendChild(copy);
  return preview;
}

function renderThemes() {
  const wrap = document.getElementById('theme-content');
  clear(wrap);

  if (!themes.length) {
    const empty = el('div', 'empty-state');
    empty.appendChild(el('div', 'empty-state-icon', '◐'));
    empty.appendChild(el('div', null, tr('setupNoThemes')));
    wrap.appendChild(empty);
    return;
  }

  const grid = el('div', 'theme-grid');

  const noTheme = el('button', 'theme-no' + (!galaxy.themeId ? ' selected' : ''));
  noTheme.type = 'button';
  noTheme.dataset.trackAction = 'Galaxy Theme Select';
  noTheme.dataset.trackId = 'theme_none';
  noTheme.onclick = () => applyTheme(null);
  const noThemePreview = el('div', 'theme-preview theme-preview-none');
  noThemePreview.setAttribute('aria-hidden', 'true');
  noThemePreview.appendChild(el('span', 'theme-preview-none-mark', '—'));
  noTheme.appendChild(noThemePreview);
  noTheme.appendChild(el('div', 'theme-name', tr('setupNoTheme')));
  grid.appendChild(noTheme);

  themes.forEach(th => {
    const card = el('button', 'theme-card' + (galaxy.themeId === th._id ? ' selected' : ''));
    card.type = 'button';
    card.dataset.trackAction = 'Galaxy Theme Select';
    card.dataset.trackId = 'theme_option';
    card.appendChild(createThemePreview(th));
    card.appendChild(el('div', 'theme-name', th.name));
    card.onclick = () => applyTheme(th._id, th.name);
    grid.appendChild(card);
  });

  wrap.appendChild(grid);
}

async function applyTheme(themeId, name) {
  const previous = galaxy.themeId || null;
  galaxy.themeId = themeId;
  renderThemes();
  updateChecklist();
  // Instant live update
  try {
    const response = await fetch(`/galaxies/${galaxyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ themeId }),
    });
    if (!response.ok) throw new Error('theme save failed');
    showToast(themeId ? tr('setupSelected', name) : tr('setupThemeRemoved'));
    trackResult('Galaxy Theme Result', true, { selected: Boolean(themeId) });
    previewController.refresh();
  } catch (error) {
    galaxy.themeId = previous;
    renderThemes();
    updateChecklist();
    trackResult('Galaxy Theme Result', false, { errorType: 'theme_save_fail' }, error);
    showToast(tr('setupSaveFail'));
  }
}

// ── Original Lumora soundscapes ────────────────────────────

function renderSoundscapes() {
  const wrap = document.getElementById('music-content');
  clear(wrap);

  if (!soundscapes.length) {
    const empty = el('div', 'empty-state');
    empty.appendChild(el('div', 'empty-state-icon', '〰'));
    empty.appendChild(el('div', null, tr('setupNoSoundscapesAvailable')));
    wrap.appendChild(empty);
    return;
  }

  const selectedPreset = galaxy.soundscape?.preset || 'none';
  soundscapes.forEach(soundscape => {
    const item = el('div', 'music-item' + (selectedPreset === soundscape.id ? ' selected' : ''));
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.dataset.trackAction = 'Soundscape Select';
    item.dataset.trackId = `soundscape_${soundscape.id}`;

    if (soundscape.id !== 'none') {
      const playBtn = el('button', 'music-play', '▶');
      playBtn.type = 'button';
      playBtn.setAttribute('aria-label', tr('setupSoundscapePreview', soundscape.label));
      playBtn.dataset.idleLabel = '▶';
      playBtn.dataset.playingLabel = '■';
      playBtn.dataset.soundscapePreview = soundscape.id;
      playBtn.dataset.trackAction = 'Soundscape Preview Started';
      playBtn.dataset.trackId = `soundscape_preview_${soundscape.id}`;
      playBtn.onclick = (event) => {
        event.stopPropagation();
        togglePreviewSoundscape(soundscape, playBtn);
      };
      item.appendChild(playBtn);
    } else {
      item.appendChild(el('span', 'music-play', '—'));
    }

    const info = el('div', 'music-info');
    info.appendChild(el('div', 'music-name', userLang === 'en' ? soundscape.labelEn : soundscape.label));
    info.appendChild(el('div', 'soundscape-description', userLang === 'en' ? soundscape.descriptionEn : soundscape.description));

    item.appendChild(info);
    item.onclick = () => {
      if (selectedPreset !== soundscape.id) applySoundscape(soundscape);
    };
    item.onkeydown = event => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target === item) {
        event.preventDefault();
        if (selectedPreset !== soundscape.id) applySoundscape(soundscape);
      }
    };
    wrap.appendChild(item);
  });

  if (selectedPreset !== 'none') renderSoundscapeControls(wrap);
}

function soundscapeConfig(entry, overrides = {}) {
  const defaults = entry?.defaults || {
    intensity: 50, warmth: 50, motion: 40, instrument: 'auto', tempo: 76, space: 50, variation: 50,
  };
  return {
    preset: entry?.id || 'none',
    intensity: overrides.intensity ?? defaults.intensity,
    warmth: overrides.warmth ?? defaults.warmth,
    motion: overrides.motion ?? defaults.motion,
    instrument: overrides.instrument ?? defaults.instrument,
    tempo: overrides.tempo ?? defaults.tempo,
    space: overrides.space ?? defaults.space,
    variation: overrides.variation ?? defaults.variation,
    seed: `preview:${galaxyId}:${entry?.id || 'none'}`,
  };
}

function resetPreviewButtons() {
  document.querySelectorAll('[data-soundscape-preview]').forEach(button => {
    button.textContent = button.dataset.idleLabel || '▶';
  });
}

function stopSoundscapePreview() {
  currentAudio?.destroy();
  currentAudio = null;
  resetPreviewButtons();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopSoundscapePreview();
});

function togglePreviewSoundscape(entry, btn) {
  if (currentAudio && !currentAudio.paused) {
    currentAudio.pause();
    resetPreviewButtons();
    if (currentAudio.previewPreset === entry.id) { currentAudio.destroy(); currentAudio = null; return; }
  }
  currentAudio?.destroy();
  const current = galaxy.soundscape?.preset === entry.id ? galaxy.soundscape : {};
  const previewConfig = soundscapeConfig(entry, current);
  previewConfig.seed += `:take:${++previewTake}`;
  currentAudio = window.LumoraSoundscape.create(previewConfig);
  const previewAudio = currentAudio;
  previewAudio.previewPreset = entry.id;
  previewAudio.onplay = () => {
    if (currentAudio !== previewAudio) return;
    resetPreviewButtons();
    btn.textContent = btn.dataset.playingLabel || '■';
  };
  previewAudio.onpause = resetPreviewButtons;
  btn.textContent = '…';
  previewAudio.play().catch(() => {
    if (currentAudio === previewAudio) {
      previewAudio.destroy();
      currentAudio = null;
    }
    resetPreviewButtons();
    showToast(tr('setupSoundscapePreviewFail'));
  });
}

function renderSoundscapeControls(wrap) {
  const entry = soundscapes.find(item => item.id === galaxy.soundscape?.preset);
  if (!entry) return;
  const controls = el('div', 'soundscape-controls');
  const heading = el('div', 'soundscape-controls-heading');
  const headingCopy = el('div');
  headingCopy.appendChild(el('div', 'soundscape-controls-title', tr('setupSoundscapeCustomTitle')));
  headingCopy.appendChild(el('div', 'soundscape-controls-copy', tr('setupSoundscapeCustomDescription')));
  const currentConfig = soundscapeConfig(entry, galaxy.soundscape || {});
  const customized = Object.entries(entry.defaults || {}).some(([field, value]) => currentConfig[field] !== value);
  if (customized) heading.appendChild(el('span', 'soundscape-custom-badge', tr('setupSoundscapeCustomized')));
  heading.prepend(headingCopy);
  controls.appendChild(heading);

  const instrumentRow = el('label', 'soundscape-control soundscape-control-select');
  instrumentRow.appendChild(el('span', null, tr('setupSoundscapeInstrument')));
  const instrumentSelect = document.createElement('select');
  instrumentSelect.setAttribute('aria-label', tr('setupSoundscapeInstrument'));
  instrumentSelect.dataset.trackAction = 'Soundscape Instrument Change';
  instrumentSelect.dataset.trackId = 'soundscape_instrument';
  soundscapeInstruments.forEach(instrument => {
    const option = document.createElement('option');
    option.value = instrument.id;
    option.textContent = userLang === 'en' ? instrument.labelEn : instrument.label;
    instrumentSelect.appendChild(option);
  });
  instrumentSelect.value = currentConfig.instrument;
  instrumentSelect.onchange = () => applySoundscapeControls('instrument', instrumentSelect.value);
  instrumentRow.appendChild(instrumentSelect);
  controls.appendChild(instrumentRow);

  const fields = [
    ['intensity', tr('setupSoundscapeIntensity'), 0, 100, ''],
    ['warmth', tr('setupSoundscapeWarmth'), 0, 100, ''],
    ['motion', tr('setupSoundscapeMotion'), 0, 100, ''],
    ['tempo', tr('setupSoundscapeTempo'), 40, 140, ' BPM'],
    ['space', tr('setupSoundscapeSpace'), 0, 100, ''],
    ['variation', tr('setupSoundscapeVariation'), 0, 100, ''],
  ];
  fields.forEach(([field, label, min, max, suffix]) => {
    const row = el('label', 'soundscape-control');
    const name = el('span', null, label);
    const currentValue = currentConfig[field];
    const value = el('output', null, `${currentValue}${suffix}`);
    const input = document.createElement('input');
    input.type = 'range'; input.min = String(min); input.max = String(max); input.value = String(currentValue);
    input.dataset.trackAction = 'Soundscape Control Change';
    input.dataset.trackId = `soundscape_${field}`;
    input.oninput = () => { value.textContent = `${input.value}${suffix}`; };
    input.onchange = () => applySoundscapeControls(field, Number(input.value));
    row.append(name, value, input);
    controls.appendChild(row);
  });

  const actions = el('div', 'soundscape-controls-actions');
  const preview = el('button', 'soundscape-action primary', tr('setupSoundscapePreviewCustom'));
  preview.type = 'button';
  preview.dataset.idleLabel = tr('setupSoundscapePreviewCustom');
  preview.dataset.playingLabel = tr('setupSoundscapeStopPreview');
  preview.dataset.soundscapePreview = 'custom';
  preview.dataset.trackAction = 'Soundscape Custom Preview Started';
  preview.dataset.trackId = 'soundscape_custom_preview';
  preview.onclick = () => togglePreviewSoundscape(entry, preview);
  const reset = el('button', 'soundscape-action', tr('setupSoundscapeReset'));
  reset.type = 'button';
  reset.dataset.trackAction = 'Soundscape Custom Reset';
  reset.dataset.trackId = 'soundscape_custom_reset';
  reset.onclick = () => resetSoundscapeControls(entry);
  actions.append(preview, reset);
  controls.appendChild(actions);
  wrap.appendChild(controls);
}

async function applySoundscape(entry) {
  stopSoundscapePreview();
  const previous = galaxy.soundscape;
  galaxy.soundscape = soundscapeConfig(entry);
  delete galaxy.soundscape.seed;
  renderSoundscapes();
  updateChecklist();
  try {
    const response = await fetch(`/galaxies/${galaxyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ soundscape: galaxy.soundscape }),
    });
    if (!response.ok) throw new Error('soundscape save failed');
    const name = userLang === 'en' ? entry.labelEn : entry.label;
    showToast(tr('setupSelected', name));
    trackResult('Soundscape Saved', true, { preset: entry.id });
    previewController.refresh();
  } catch (error) {
    galaxy.soundscape = previous;
    renderSoundscapes();
    updateChecklist();
    trackResult('Soundscape Saved', false, { errorType: 'soundscape_save_fail' }, error);
    showToast(tr('setupSaveFail'));
  }
}

async function applySoundscapeControls(field, value) {
  stopSoundscapePreview();
  const previous = { ...galaxy.soundscape };
  galaxy.soundscape = { ...galaxy.soundscape, [field]: value };
  try {
    const response = await fetch(`/galaxies/${galaxyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ soundscape: galaxy.soundscape }),
    });
    if (!response.ok) throw new Error('soundscape controls save failed');
    trackResult('Soundscape Control Saved', true, { preset: galaxy.soundscape.preset, control: field });
    renderSoundscapes();
    previewController.refresh();
  } catch (error) {
    galaxy.soundscape = previous;
    renderSoundscapes();
    trackResult('Soundscape Control Saved', false, { errorType: 'soundscape_save_fail', control: field }, error);
    showToast(tr('setupSaveFail'));
  }
}

async function resetSoundscapeControls(entry) {
  stopSoundscapePreview();
  const previous = { ...galaxy.soundscape };
  galaxy.soundscape = soundscapeConfig(entry);
  delete galaxy.soundscape.seed;
  renderSoundscapes();
  try {
    const response = await fetch(`/galaxies/${galaxyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ soundscape: galaxy.soundscape }),
    });
    if (!response.ok) throw new Error('soundscape reset failed');
    showToast(tr('setupSoundscapeResetDone'));
    trackResult('Soundscape Custom Reset', true, { preset: entry.id });
    previewController.refresh();
  } catch (error) {
    galaxy.soundscape = previous;
    renderSoundscapes();
    trackResult('Soundscape Custom Reset', false, { errorType: 'soundscape_save_fail' }, error);
    showToast(tr('setupSaveFail'));
  }
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
    { id: 'abyss', icon: '🌊', name: 'Abyss of Memories', desc: tr('setupAbyssDescription'), comingSoon: true, adminOnly: true, tier: 3 },
  ].sort((left, right) => {
    const leftLocked = left.feature && !canUseFeature(left.feature) ? 1 : 0;
    const rightLocked = right.feature && !canUseFeature(right.feature) ? 1 : 0;
    return leftLocked - rightLocked || left.tier - right.tier;
  });
  options.forEach(option => {
    const locked = Boolean(
      (option.feature && !canUseFeature(option.feature))
      || (option.adminOnly && !isAdmin),
    );
    const selected = (galaxy.template || 'galaxy') === option.id;
    const button = el('button', 'theme-card universe-card' + (selected ? ' selected' : '') + (locked ? ' locked' : ''));
    button.type = 'button';
    button.dataset.trackAction = 'Galaxy Universe Select';
    button.dataset.trackId = 'universe_' + option.id;
    if (locked) button.dataset.blockedReason = 'plan_required';
    const header = el('div', 'universe-card-header');
    header.appendChild(el('span', 'universe-card-name', option.icon + ' ' + option.name));
    if (option.requiredPlan) header.appendChild(el('span', 'universe-plan-badge', (locked ? '🔒 ' : '') + option.requiredPlan));
    if (option.comingSoon) header.appendChild(el('span', 'universe-plan-badge', 'COMING SOON'));
    button.appendChild(header);
    button.appendChild(el('div', 'universe-card-desc', option.desc));
    button.onclick = () => applyUniverse(option.id);
    wrap.appendChild(button);
  });
}

async function applyUniverse(template) {
  if (template === 'abyss') {
    if (!isAdmin) {
      activity?.logBlocked('Galaxy Universe Change Blocked', 'admin_only', { template }, { galaxyId });
      showToast(tr('setupAbyssComingSoon'));
      return;
    }
  }
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
    previewController.refresh();
    trackResult('Galaxy Universe Change Result', true, { template });
    showToast(tr('setupUniverseChanged'));
  } catch (error) {
    galaxy.template = previous; renderUniverses();
    trackResult('Galaxy Universe Change Result', false, { template, errorType: 'universe_save_fail' }, error);
    showToast(error.message || tr('setupUniverseChangeFail'));
  }
}

async function saveCaption(captions) {
  const response = await fetch(`/galaxies/${galaxyId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ caption: captions }),
  });
  if (!response.ok) throw new Error('caption save failed');
  previewController.refresh();
}

async function addCaption() {
  const input = document.getElementById('caption-input');
  const text = input.value.trim();
  if (!text) { activity?.logBlocked('Galaxy Caption Add Blocked', 'missing_input', {}, { galaxyId }); return; }
  const previous = [...(galaxy.caption || [])];
  galaxy.caption = [...previous, text];
  input.value = '';
  renderCaptions();
  try { await saveCaption(galaxy.caption); trackResult('Galaxy Caption Add Result', true, { count: galaxy.caption.length }); showToast(tr('setupCaptionAdded')); }
  catch (error) {
    galaxy.caption = previous;
    input.value = text;
    renderCaptions();
    trackResult('Galaxy Caption Add Result', false, { errorType: 'caption_save_fail' }, error);
    showToast(tr('setupSaveFail'));
  }
}

async function deleteCaption(idx) {
  const previous = [...(galaxy.caption || [])];
  galaxy.caption = (galaxy.caption || []).filter((_, i) => i !== idx);
  renderCaptions();
  try { await saveCaption(galaxy.caption); trackResult('Galaxy Caption Delete Result', true, { count: galaxy.caption.length }); }
  catch (error) {
    galaxy.caption = previous;
    renderCaptions();
    trackResult('Galaxy Caption Delete Result', false, { errorType: 'caption_save_fail' }, error);
    showToast(tr('setupSaveFail'));
  }
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
    const [galaxyRes, galleryRes, themesRes, soundscapesRes, instrumentsRes, subRes, uploadPolicyRes] = await Promise.all([
      fetch(`/galaxies/${galaxyId}`, { headers: { Authorization: 'Bearer ' + token } }),
      fetch(`/gallary/my-items?galaxyId=${galaxyId}`, { headers: { Authorization: 'Bearer ' + token } }),
      fetch('/media/themes'),
      fetch('/media/soundscapes'),
      fetch('/media/soundscape-instruments'),
      fetch('/payment/status', { headers: { Authorization: 'Bearer ' + token } }),
      fetch('/gallary/upload-policy'),
    ]);

    if (!galaxyRes.ok) { window.location.href = '/portal/'; return; }

    const galaxyData   = await galaxyRes.json();
    const galleryData  = galleryRes.ok  ? await galleryRes.json()  : {};
    const themesData   = themesRes.ok   ? await themesRes.json()   : {};
    const soundscapesData = soundscapesRes.ok ? await soundscapesRes.json() : {};
    const instrumentsData = instrumentsRes.ok ? await instrumentsRes.json() : {};
    const subData      = subRes.ok      ? await subRes.json()      : {};
    const uploadPolicyData = uploadPolicyRes.ok ? await uploadPolicyRes.json() : {};

    galaxy       = galaxyData.meta;
    galleryItems = galleryData.meta  || [];
    themes       = themesData.meta   || [];
    soundscapes  = soundscapesData.meta || [];
    soundscapeInstruments = instrumentsData.meta || [];
    userPlan     = subData.meta?.plan || 'free';
    userFeatures = new Set(subData.meta?.features || []);
    isAdmin      = subData.meta?.accessMode === 'admin';
    imageUploadPolicy = uploadPolicyData.meta || null;
    if (imageUploadPolicy) {
      const maxSizeMb = imageUploadPolicy.maxTotalSize / 1024 / 1024;
      document.getElementById('upload-limits').textContent = tr(
        'setupUploadLimits', imageUploadPolicy.maxFiles, maxSizeMb,
      );
      document.getElementById('file-input').accept = imageUploadPolicy.mimeTypes.join(',');
    }

    document.getElementById('galaxy-name').textContent = galaxy.name || 'Galaxy';
    document.getElementById('preview-caption').textContent = galaxy.name || 'Galaxy';
    document.title = `${galaxy.name || 'Galaxy'} — Lumora`;
    setupNameEditor(galaxy.name || 'Galaxy');

    previewController.refresh({ immediate: true });

    renderGallery();
    renderUniverses();
    renderThemes();
    renderSoundscapes();
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

document.getElementById('gallery-select-mode').onclick = () => setGallerySelectionMode(true);
document.getElementById('gallery-bulk-cancel').onclick = () => setGallerySelectionMode(false);
document.getElementById('gallery-bulk-all').onclick = toggleAllPhotoSelections;
document.getElementById('gallery-bulk-delete').onclick = deleteSelectedPhotos;

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

function filesFromDrop(dataTransfer) {
  const itemFiles = Array.from(dataTransfer?.items || [])
    .filter(item => item.kind === 'file')
    .map(item => item.getAsFile())
    .filter(Boolean);
  return itemFiles.length ? itemFiles : Array.from(dataTransfer?.files || []);
}

zone.ondragenter = event => {
  event.preventDefault();
  event.stopPropagation();
  zone.classList.add('dragover');
};
zone.ondragover = event => {
  event.preventDefault();
  event.stopPropagation();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  zone.classList.add('dragover');
};
zone.ondragleave = event => {
  if (!zone.contains(event.relatedTarget)) zone.classList.remove('dragover');
};
zone.ondrop = event => {
  event.preventDefault();
  event.stopPropagation();
  zone.classList.remove('dragover');
  handleUpload(filesFromDrop(event.dataTransfer));
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

window.addEventListener('pagehide', () => {
  previewController.cancel();
  stopSoundscapePreview();
});

init();
