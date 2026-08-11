const params   = new URLSearchParams(location.search);
const galaxyId = params.get('galaxyId');
const token    = localStorage.getItem('token');
const activity = window.LumoraActivity;
const isVietnamese = document.documentElement.lang === 'vi';

function tr(key, ...args) {
  const value = window.t?.[key];
  return typeof value === 'function' ? value(...args) : (value || key);
}

function typeLabel(id, config) {
  return isVietnamese ? (config.labelVi || config.label || id) : (config.label || id);
}

function occasionLabel(id, config) {
  return tr('storySetupOccasionLabel', id, config?.label || id);
}

function chapterLabel(chapter) {
  return tr('storySetupChapterLabel', chapter.id, chapter.label || chapter.id);
}

function chapterPrompt(chapter) {
  return tr('storySetupChapterPrompt', chapter.id, chapterLabel(chapter), chapter.hooks?.[0] || chapter.label);
}

function storyResult(action, ok, metadata, error) {
  activity?.logResult(action, ok, metadata || {}, error, { galaxyId });
}

if (!token) window.location.href = '/auth/';
if (!galaxyId) window.location.href = '/portal/';

const chat = document.getElementById('chat');

let STORY_CONFIG = null;
let selectedStoryType = null;
let selectedOccasion = null;
const chapterFiles = {};
const chapterHooks = {};

// ── Chip prompt helper ────────────────────────────────────────────────────────

function askChips(options) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'chips-wrap';
    options.forEach(opt => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = opt.label;
      chip.dataset.trackAction = opt.id === '__cancel__' ? 'Story Action Cancel' : 'Story Wizard Choice Select';
      chip.dataset.trackId = 'choice_' + opt.id;
      chip.addEventListener('click', () => {
        wrap.querySelectorAll('.chip').forEach(c => { c.classList.remove('on'); c.style.pointerEvents = 'none'; });
        chip.classList.add('on');
        if (opt.id !== '__cancel__') appendUMsg(opt.label);
        setTimeout(() => resolve(opt.id), 200);
      });
      wrap.appendChild(chip);
    });
    chat.appendChild(wrap);
    scrollBottom();
  });
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function scrollBottom() {
  chat.scrollTo({ top: chat.scrollHeight, behavior: 'smooth' });
}

function makeLRow() {
  const row = document.createElement('div');
  row.className = 'lmsg';
  const av = document.createElement('div');
  av.className = 'av';
  av.textContent = 'L';
  row.appendChild(av);
  return row;
}

function appendLMsg(text, italicText) {
  const row = makeLRow();
  const bubble = document.createElement('div');
  bubble.className = 'lbubble';
  if (italicText) {
    const em = document.createElement('em');
    em.textContent = italicText;
    bubble.appendChild(em);
    if (text) {
      bubble.appendChild(document.createTextNode(' ' + text));
    }
  } else {
    bubble.textContent = text;
  }
  row.appendChild(bubble);
  chat.appendChild(row);
  scrollBottom();
  return row;
}

function appendLMsgWithNote(text, noteText) {
  const row = makeLRow();
  const bubble = document.createElement('div');
  bubble.className = 'lbubble';
  bubble.textContent = text;
  const note = document.createElement('span');
  note.className = 'done-note';
  note.textContent = noteText;
  bubble.appendChild(note);
  row.appendChild(bubble);
  chat.appendChild(row);
  scrollBottom();
}

function appendUMsg(text) {
  const row = document.createElement('div');
  row.className = 'umsg';
  const bubble = document.createElement('div');
  bubble.className = 'ububble';
  bubble.textContent = text;
  row.appendChild(bubble);
  chat.appendChild(row);
  scrollBottom();
}

function appendEl(el) {
  chat.appendChild(el);
  scrollBottom();
}

function appendErrMsg(text) {
  const row = makeLRow();
  const bubble = document.createElement('div');
  bubble.className = 'lbubble err-bubble';
  bubble.textContent = text;
  row.appendChild(bubble);
  chat.appendChild(row);
  scrollBottom();
}

const wait = ms => new Promise(r => setTimeout(r, ms));

async function typingThen(text, italicText, delayMs = 700) {
  const row = makeLRow();
  const dots = document.createElement('div');
  dots.className = 'typing-dots';
  for (let i = 0; i < 3; i++) {
    const s = document.createElement('span');
    dots.appendChild(s);
  }
  row.appendChild(dots);
  chat.appendChild(row);
  scrollBottom();
  await wait(delayMs);
  row.remove();
  appendLMsg(text, italicText);
}

// ── API ───────────────────────────────────────────────────────────────────────

const MAX_UPLOAD_SIZE = 20 * 1024 * 1024; // 20MB — must match server limit

async function saveChapter(chapterId) {
  const files = chapterFiles[chapterId] || [];
  if (!files.length) return; // no new files — keep existing

  activity?.log({ action: 'Story Chapter Photo Upload Submit', feature: 'story', galaxyId, description: { chapterId, count: files.length } });

  const oversized = files.find(f => f.size > MAX_UPLOAD_SIZE);
  if (oversized) throw new Error(tr('storySetupPhotoTooLarge', oversized.name));

  // Delete old photos for this chapter before uploading new ones (replace semantics)
  const oldIds = window._galleryIdsByChapter?.[chapterId] || [];
  await Promise.all(oldIds.map(id =>
    fetch(`/gallary/items/${id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token },
    })
  ));

  const form = new FormData();
  form.append('galaxyId', galaxyId);
  form.append('title', 'Uploaded image');
  form.append('description', 'Image uploaded from story setup');
  form.append('stage', chapterId);
  files.forEach(f => form.append('files', f));
  const res = await fetch('/gallary/upload', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: form,
  });
  if (!res.ok) {
    let msg = tr('storySetupUploadFail', res.status);
    try {
      const body = await res.json();
      if (body.message) msg = body.message;
    } catch {}
    const error = new Error(msg);
    storyResult('Story Chapter Photo Upload Result', false, { chapterId, count: files.length, errorType: 'story_photo_upload_fail' }, error);
    throw error;
  }
  storyResult('Story Chapter Photo Upload Result', true, { chapterId, count: files.length });
}

let _hookSaveTimer;
async function saveHookText() {
  clearTimeout(_hookSaveTimer);
  _hookSaveTimer = setTimeout(async () => {
    const chapters = STORY_CONFIG[selectedStoryType].occasions[selectedOccasion].chapters.map(ch => ({
      id: ch.id,
      hookText: chapterHooks[ch.id] || null,
    }));
    const res = await fetch(`/galaxies/${galaxyId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ chapters }),
    });
    storyResult('Story Chapter Hook Change', res.ok, {
      chapterCount: chapters.length,
      textLength: Object.values(chapterHooks).reduce((sum, value) => sum + String(value || '').length, 0),
      ...(!res.ok && { errorType: 'story_save_fail' }),
    });
  }, 800);
}

async function saveStoryMeta(occasion) {
  const chapters = STORY_CONFIG[selectedStoryType].occasions[occasion].chapters.map(ch => ({
    id: ch.id,
    hookText: chapterHooks[ch.id] || null,
  }));
  activity?.log({ action: 'Story Save Submit', feature: 'story', galaxyId, description: { storyType: selectedStoryType, occasion } });
  const res = await fetch(`/galaxies/${galaxyId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ storyType: selectedStoryType, occasion, chapters }),
  });
  if (!res.ok) {
    const error = new Error(`Save story failed: ${res.status}`);
    storyResult('Story Save Result', false, { storyType: selectedStoryType, occasion, errorType: 'story_save_fail' }, error);
    throw error;
  }
  storyResult('Story Save Result', true, { storyType: selectedStoryType, occasion });
}

function setupNameEditor(initialName) {
  const button = document.getElementById('galaxy-name-button');
  const nameEl = document.getElementById('galaxy-name');
  const input = document.getElementById('galaxy-name-input');
  const status = document.getElementById('galaxy-name-status');
  let savedName = initialName;
  let saving = false;
  let cancelled = false;

  function showEditor() {
    if (saving) { activity?.logBlocked('Story Rename Blocked', 'operation_in_progress', {}, { galaxyId }); return; }
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
    if (saving) { activity?.logBlocked('Story Rename Blocked', 'operation_in_progress', {}, { galaxyId }); return; }
    if (cancelled) {
      cancelled = false;
      input.hidden = true;
      button.hidden = false;
      button.focus();
      activity?.log({ action: 'Story Rename Cancel', feature: 'story', level: 'warn', galaxyId });
      return;
    }

    const nextName = input.value.trim();
    if (!nextName) {
      activity?.logBlocked('Story Rename Blocked', 'missing_input', {}, { galaxyId });
      status.textContent = tr('storySetupNameEmpty');
      status.classList.add('error');
      input.focus();
      return;
    }
    if (nextName === savedName) {
      input.hidden = true;
      button.hidden = false;
      return;
    }

    saving = true;
    activity?.log({ action: 'Story Rename Submit', feature: 'story', galaxyId });
    input.disabled = true;
    status.textContent = tr('setupSaving');
    status.classList.remove('error');
    try {
      const res = await fetch(`/galaxies/${galaxyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ name: nextName }),
      });
      if (!res.ok) throw new Error(`Rename failed: ${res.status}`);
      const body = await res.json();
      savedName = body.meta?.name || nextName;
      nameEl.textContent = savedName;
      window.updateSEPreview?.(null, null, savedName);
      status.textContent = '';
      input.hidden = true;
      button.hidden = false;
      storyResult('Story Rename Result', true);
    } catch (err) {
      storyResult('Story Rename Result', false, { errorType: 'galaxy_update_fail' }, err);
      input.value = savedName;
      status.textContent = tr('storySetupNameSaveFail');
      status.classList.add('error');
      input.hidden = true;
      button.hidden = false;
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
      input.value = savedName;
      input.blur();
    }
  });
}

// ── Left preview helpers ──────────────────────────────────────────────────────

function showChapterPreview(chapter, chapterIdx, totalChapters) {
  activity?.log({ action: 'Story Chapter Preview Open', feature: 'story', galaxyId, description: { chapterId: chapter.id, chapterIndex: chapterIdx, totalChapters } });
  const localFiles = chapterFiles[chapter.id];
  if (localFiles && localFiles.length) {
    // Local selection takes priority — clear immediately, then load async
    window.setPreviewPhotoUrls?.([]); // clears slideshow + increments gen counter
    window.setPreviewPhotos?.(localFiles);
  } else {
    // Show server photos for THIS chapter only (keyed by stage = chapter.id)
    const serverUrls = window._galleryByChapter?.[chapter.id] || [];
    window.setPreviewPhotoUrls?.(serverUrls);
  }
  // Set bottom text directly — skip window bridge to avoid timing issues
  const occasionCfg = STORY_CONFIG?.[selectedStoryType]?.occasions?.[selectedOccasion];
  const hookText = chapterHooks[chapter.id]
    || window._dbChapterHooks?.[chapter.id]
    || chapterPrompt(chapter);
  const labelEl = document.getElementById('se-bottom-label');
  const hookEl  = document.getElementById('se-bottom-hook');
  if (labelEl) {
    const num = String(chapterIdx + 1).padStart(2, '0');
    const tot = String(totalChapters).padStart(2, '0');
    labelEl.textContent = [occasionLabel(selectedOccasion, occasionCfg).toUpperCase(), `${num} / ${tot}`].filter(Boolean).join(' · ');
  }
  if (hookEl) hookEl.textContent = hookText || '';
}

// ── Chapter card builder ──────────────────────────────────────────────────────

function buildChapterCard(chapter, chapterIdx, totalChapters, editMode = false) {
  const wrap = document.createElement('div');

  const card = document.createElement('div');
  card.className = 'ch-card';

  const head = document.createElement('div');
  head.className = 'ch-head';
  head.dataset.trackAction = 'Story Chapter Preview Open';
  head.dataset.trackId = 'chapter_preview_' + chapter.id;
  const num = document.createElement('div');
  num.className = 'ch-num';
  num.textContent = tr('storySetupChapterNumber', chapterIdx + 1, totalChapters);
  const title = document.createElement('div');
  title.className = 'ch-title';
  title.textContent = chapterLabel(chapter);
  head.appendChild(num);
  head.appendChild(title);
  head.style.cursor = 'pointer';
  head.tabIndex = 0;
  head.setAttribute('role', 'button');
  head.addEventListener('click', () => showChapterPreview(chapter, chapterIdx, totalChapters));
  head.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      showChapterPreview(chapter, chapterIdx, totalChapters);
    }
  });
  card.appendChild(head);

  const photosEl = document.createElement('div');
  photosEl.className = 'ch-photos';
  card.appendChild(photosEl);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.multiple = chapter.photoCount.max > 1;
  fileInput.style.display = 'none';
  fileInput.dataset.trackAction = 'Story Chapter Photo Picker Open';
  fileInput.dataset.trackId = 'chapter_' + chapter.id;
  card.appendChild(fileInput);

  function fileToDataUrl(file) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  async function renderPhotos() {
    photosEl.replaceChildren();
    const files = chapterFiles[chapter.id] || [];
    for (const file of files) {
      const ph = document.createElement('div');
      ph.className = 'ch-ph';
      const img = document.createElement('img');
      img.src = await fileToDataUrl(file);
      img.alt = '';
      ph.appendChild(img);
      photosEl.appendChild(ph);
    }
    if (files.length < chapter.photoCount.max) {
      const addPh = document.createElement('button');
      addPh.type = 'button';
      addPh.className = 'ch-ph';
      addPh.textContent = '+';
      addPh.setAttribute('aria-label', tr('setupUploadLabel'));
      addPh.dataset.trackAction = 'Story Chapter Photo Picker Open';
      addPh.dataset.trackId = 'chapter_photo_' + chapter.id;
      addPh.addEventListener('click', () => fileInput.click());
      photosEl.appendChild(addPh);
    }
  }

  renderPhotos();

  fileInput.addEventListener('change', () => {
    const existing = chapterFiles[chapter.id] || [];
    const incoming = Array.from(fileInput.files);
    const merged = [...existing, ...incoming].slice(0, chapter.photoCount.max);
    chapterFiles[chapter.id] = merged;
    renderPhotos();
    nextBtn.disabled = false;
    if (!editMode) scrollBottom();
    showChapterPreview(chapter, chapterIdx, totalChapters);
  });

  const hookInput = document.createElement('textarea');
  hookInput.className = 'ch-hook-input';
  hookInput.rows = 2;
  hookInput.placeholder = chapterPrompt(chapter) || tr('storySetupHookPlaceholder');
  hookInput.value = chapterHooks[chapter.id] || window._dbChapterHooks?.[chapter.id] || '';
  hookInput.addEventListener('input', () => {
    chapterHooks[chapter.id] = hookInput.value;
    // Update left preview hook text live
    const hookEl = document.getElementById('se-bottom-hook');
    if (hookEl) hookEl.textContent = hookInput.value || hookInput.placeholder;
    saveHookText();
  });
  card.appendChild(hookInput);

  wrap.appendChild(card);

  const actionRow = document.createElement('div');
  actionRow.className = 'action-row';
  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.dataset.trackAction = editMode ? 'Story Save Submit' : 'Story Wizard Next Click';
  nextBtn.dataset.trackId = 'chapter_next_' + chapter.id;

  if (editMode) {
    nextBtn.className = 'btn-next';
    nextBtn.disabled = true;
    nextBtn.textContent = tr('storySetupSavePhotos');
    nextBtn.addEventListener('click', async () => {
      nextBtn.disabled = true;
      nextBtn.textContent = tr('setupSaving');
      try {
        await saveChapter(chapter.id);
        nextBtn.textContent = tr('storySetupSaved');
        chapterFiles[chapter.id] = [];
        setTimeout(() => { nextBtn.textContent = tr('storySetupSavePhotos'); nextBtn.disabled = true; }, 2000);
      } catch {
        nextBtn.disabled = false;
        nextBtn.textContent = tr('storySetupSavePhotos');
      }
    });
  } else {
    nextBtn.className = 'btn-next';
    nextBtn.disabled = chapter.required;
    nextBtn.textContent = tr('storySetupNext');
  }

  actionRow.appendChild(nextBtn);
  wrap.appendChild(actionRow);

  return { wrap, nextBtn, fileInput };
}

// ── Chapter runners ───────────────────────────────────────────────────────────

async function runChapter(chapter, chapterIdx, totalChapters) {
  showChapterPreview(chapter, chapterIdx, totalChapters);
  await typingThen(null, window._dbChapterHooks?.[chapter.id] || chapterPrompt(chapter));
  const { wrap, nextBtn } = buildChapterCard(chapter, chapterIdx, totalChapters);
  appendEl(wrap);
  await new Promise(resolve => {
    async function attempt() {
      nextBtn.disabled = true;
      nextBtn.textContent = tr('setupSaving');
      try {
        await saveChapter(chapter.id);
        resolve();
      } catch (err) {
        appendErrMsg(err.message);
        nextBtn.disabled = false;
        nextBtn.textContent = tr('storySetupNext');
        nextBtn.addEventListener('click', attempt, { once: true });
      }
    }
    nextBtn.addEventListener('click', attempt, { once: true });
  });
}

async function runOptionalChapter(chapter, chapterIdx, totalChapters, occasion) {
  showChapterPreview(chapter, chapterIdx, totalChapters);
  const question = tr('storySetupOptionalQuestion', occasion, chapterLabel(chapter));
  await typingThen(question);

  const yesno = document.createElement('div');
  yesno.className = 'btn-yesno';
  const btnYes = document.createElement('button');
  btnYes.type = 'button';
  btnYes.className = 'btn-yes';
  btnYes.textContent = tr('storySetupYes');
  btnYes.dataset.trackAction = 'Story Optional Chapter Include';
  btnYes.dataset.trackId = 'optional_' + chapter.id + '_yes';
  const btnNo = document.createElement('button');
  btnNo.type = 'button';
  btnNo.className = 'btn-no';
  btnNo.textContent = tr('storySetupNo');
  btnNo.dataset.trackAction = 'Story Optional Chapter Skip';
  btnNo.dataset.trackId = 'optional_' + chapter.id + '_no';
  yesno.appendChild(btnYes);
  yesno.appendChild(btnNo);
  appendEl(yesno);

  const userSaidYes = await new Promise(resolve => {
    btnYes.addEventListener('click', () => { yesno.replaceChildren(); appendUMsg(tr('storySetupYes')); resolve(true); }, { once: true });
    btnNo.addEventListener('click',  () => { yesno.replaceChildren(); appendUMsg(tr('storySetupNo')); resolve(false); }, { once: true });
  });

  if (userSaidYes) {
    const { wrap, nextBtn } = buildChapterCard(chapter, chapterIdx, totalChapters);
    nextBtn.disabled = false;
    appendEl(wrap);
    await new Promise(resolve => {
      async function attempt() {
        nextBtn.disabled = true;
        nextBtn.textContent = tr('setupSaving');
        try {
          await saveChapter(chapter.id);
          resolve();
        } catch (err) {
          appendErrMsg(err.message);
          nextBtn.disabled = false;
          nextBtn.textContent = tr('storySetupNext');
          nextBtn.addEventListener('click', attempt, { once: true });
        }
      }
      nextBtn.addEventListener('click', attempt, { once: true });
    });
  }
}

async function runLastChapter(chapter, chapterIdx, totalChapters) {
  showChapterPreview(chapter, chapterIdx, totalChapters);
  await typingThen(null, window._dbChapterHooks?.[chapter.id] || chapterPrompt(chapter));
  const { wrap, nextBtn } = buildChapterCard(chapter, chapterIdx, totalChapters);
  nextBtn.textContent = tr('storySetupFinish');
  nextBtn.classList.add('done');
  appendEl(wrap);
  await new Promise(resolve => {
    async function attempt() {
      nextBtn.disabled = true;
      nextBtn.textContent = tr('setupSaving');
      try {
        await saveChapter(chapter.id);
        await saveStoryMeta(selectedOccasion);
        activity?.log({ action: 'Story Wizard Complete', feature: 'story', status: 1, galaxyId, description: { storyType: selectedStoryType, occasion: selectedOccasion } });
        appendLMsgWithNote(tr('storySetupReady'), tr('storySetupRedirecting'));
        await wait(1800);
        window.location.href = `/portal/galaxy.html?galaxyId=${galaxyId}`;
        resolve();
      } catch (err) {
        appendErrMsg(err.message);
        nextBtn.disabled = false;
        nextBtn.textContent = tr('storySetupFinish');
        nextBtn.addEventListener('click', attempt, { once: true });
      }
    }
    nextBtn.addEventListener('click', attempt, { once: true });
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function init() {
  const [cfgRes, galaxyRes] = await Promise.all([
    fetch('/shared/story-config.json'),
    fetch(`/galaxies/${galaxyId}`, { headers: { Authorization: 'Bearer ' + token } }),
  ]);

  if (!galaxyRes.ok || !cfgRes.ok) { window.location.href = '/portal/'; return; }

  STORY_CONFIG = await cfgRes.json();
  const galaxy = (await galaxyRes.json()).meta;
  storyResult('Story Setup Loaded', true, { editMode: Boolean(galaxy.storyType) });

  const gName = galaxy.name || 'Galaxy';
  document.getElementById('galaxy-name').textContent = gName;
  setupNameEditor(gName);
  document.getElementById('back-link').href = `/portal/galaxy-setup.html?galaxyId=${galaxyId}`;
  window.updateSEPreview?.(null, null, gName);

  // Store DB hookText per chapter (user customized in v1, null in v2)
  window._dbChapterHooks = {};
  (galaxy.chapters || []).forEach(ch => {
    if (ch.hookText) window._dbChapterHooks[ch.id] = ch.hookText;
  });

  // Load gallery grouped by chapter (stage)
  const galleryRes = await fetch(`/gallary/my-items?galaxyId=${galaxyId}`, {
    headers: { Authorization: 'Bearer ' + token },
  });
  if (galleryRes.ok) {
    const items = (await galleryRes.json()).meta || [];
    const byChapter = {};
    const idsByChapter = {};
    items.forEach(item => {
      const s = item.stage || '__none__';
      if (!byChapter[s]) byChapter[s] = [];
      if (!idsByChapter[s]) idsByChapter[s] = [];
      byChapter[s].push(item.imageUrl);
      idsByChapter[s].push(item._id);
    });
    window._galleryByChapter = byChapter;
    window._galleryIdsByChapter = idsByChapter;
  }

  // ── Edit mode: galaxy đã có story → skip setup, vào edit chapters ──
  if (galaxy.storyType && galaxy.occasion) {
    selectedStoryType = galaxy.storyType;
    selectedOccasion  = galaxy.occasion;

    const typeCfg = STORY_CONFIG[galaxy.storyType];
    const occasionCfg = typeCfg?.occasions?.[galaxy.occasion];
    const occLabel = occasionLabel(galaxy.occasion, occasionCfg);
    window.updateSEPreview?.(galaxy.storyType, occLabel, gName);

    await typingThen(tr('storySetupExisting', occLabel), null, 400);

    let chapters = STORY_CONFIG[galaxy.storyType].occasions[galaxy.occasion].chapters;
    showChapterPreview(chapters[0], 0, chapters.length);

    // ── Conversational edit loop ──
    while (true) {
      await typingThen(tr('storySetupEditQuestion'));

      const action = await askChips([
        { id: 'photos', label: tr('storySetupEditPhotos') },
        { id: 'hook',   label: tr('storySetupEditHook') },
        { id: 'story',  label: tr('storySetupEditStory') },
        { id: 'done',   label: tr('storySetupDone') },
      ]);

      if (action === 'done') {
        await typingThen(tr('storySetupGalaxyReady'));
        await wait(1200);
        window.location.href = `/portal/galaxy-setup.html?galaxyId=${galaxyId}`;
        return;
      }

      // ── Story type / occasion change ──
      if (action === 'story') {
        await typingThen(tr('storySetupChooseType'));
        const typeOpts = Object.entries(STORY_CONFIG).map(([id, cfg]) => ({ id, label: typeLabel(id, cfg) }));
        typeOpts.push({ id: '__cancel__', label: tr('storySetupCancel') });
        const newType = await askChips(typeOpts);
        if (newType === '__cancel__') continue;

        await typingThen(tr('storySetupChooseOccasion'));
        const occOpts = Object.entries(STORY_CONFIG[newType].occasions).map(([id, cfg]) => ({ id, label: occasionLabel(id, cfg) }));
        occOpts.push({ id: '__cancel__', label: tr('storySetupCancel') });
        const newOcc = await askChips(occOpts);
        if (newOcc === '__cancel__') continue;

        const newOccLabel = occasionLabel(newOcc, STORY_CONFIG[newType].occasions[newOcc]);
        await fetch(`/galaxies/${galaxyId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify({ storyType: newType, occasion: newOcc, chapters: [] }),
        });
        selectedStoryType = newType;
        selectedOccasion  = newOcc;
        chapters = STORY_CONFIG[newType].occasions[newOcc].chapters;
        window.updateSEPreview?.(newType, newOccLabel, null);
        showChapterPreview(chapters[0], 0, chapters.length);
        await typingThen(tr('storySetupChangedTo', newOccLabel));
        continue;
      }

      // Pick chapter
      await typingThen(action === 'photos' ? tr('storySetupWhichPhotos') : tr('storySetupWhichHook'));

      const chOpts = chapters.map((ch, i) => ({ id: String(i), label: chapterLabel(ch) }));
      chOpts.push({ id: '__cancel__', label: tr('storySetupCancel') });

      const chChoice = await askChips(chOpts);
      if (chChoice === '__cancel__') continue;

      const chIdx = parseInt(chChoice);
      const ch = chapters[chIdx];
      showChapterPreview(ch, chIdx, chapters.length);

      // Show chapter card (photos + hook input)
      const { wrap } = buildChapterCard(ch, chIdx, chapters.length, true);
      appendEl(wrap);

      if (action === 'hook') {
        const ta = wrap.querySelector('.ch-hook-input');
        if (ta) setTimeout(() => ta.focus(), 150);
      }

      // Ask what next
      await typingThen(tr('storySetupEditFinished'));
      const next = await askChips([
        { id: 'more', label: tr('storySetupEditMore') },
        { id: 'done', label: tr('storySetupDone') },
      ]);

      if (next === 'done') {
        await typingThen(tr('storySetupGalaxyReady'));
        await wait(1200);
        window.location.href = `/portal/galaxy-setup.html?galaxyId=${galaxyId}`;
        return;
      }
      // else continue loop
    }
  }

  // Step 1 — Story type (new setup)
  await typingThen(tr('storySetupTypeQuestion'), null, 500);

  const typeWrap = document.createElement('div');
  typeWrap.className = 'chips-wrap';
  Object.entries(STORY_CONFIG).forEach(([id, type]) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = typeLabel(id, type);
    chip.dataset.id = id;
    chip.dataset.trackAction = 'Story Type Select';
    chip.dataset.trackId = 'story_type_' + id;
    typeWrap.appendChild(chip);
  });
  appendEl(typeWrap);

  selectedStoryType = await new Promise(resolve => {
    typeWrap.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        typeWrap.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
        chip.classList.add('on');
        setTimeout(() => {
          appendUMsg(chip.textContent);
          typeWrap.querySelectorAll('.chip').forEach(c => { c.style.pointerEvents = 'none'; });
          window.updateSEPreview?.(chip.dataset.id, null, null);
          resolve(chip.dataset.id);
        }, 200);
      });
    });
  });

  // Step 2 — Occasion
  await typingThen(tr('storySetupOccasionQuestion'));

  const occasions = STORY_CONFIG[selectedStoryType].occasions;
  const chipsWrap = document.createElement('div');
  chipsWrap.className = 'chips-wrap';
  Object.entries(occasions).forEach(([id, occ]) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = occasionLabel(id, occ);
    chip.dataset.id = id;
    chip.dataset.trackAction = 'Story Occasion Select';
    chip.dataset.trackId = 'story_occasion_' + id;
    chipsWrap.appendChild(chip);
  });
  appendEl(chipsWrap);

  selectedOccasion = await new Promise(resolve => {
    chipsWrap.querySelectorAll('.chip').forEach(chip => {
      chip.addEventListener('click', () => {
        chipsWrap.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
        chip.classList.add('on');
        setTimeout(() => {
          appendUMsg(chip.textContent);
          chipsWrap.querySelectorAll('.chip').forEach(c => { c.style.pointerEvents = 'none'; });
          window.updateSEPreview?.(selectedStoryType, chip.textContent, null);
          resolve(chip.dataset.id);
        }, 200);
      });
    });
  });

  // Step 3..N — Chapters
  const chapters = occasions[selectedOccasion].chapters;
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const isLast = i === chapters.length - 1;
    if (isLast) {
      await runLastChapter(ch, i, chapters.length);
    } else if (ch.required) {
      await runChapter(ch, i, chapters.length);
    } else {
      await runOptionalChapter(ch, i, chapters.length, selectedOccasion);
    }
  }
}

init().catch(err => {
  storyResult('Story Setup Failed', false, { errorType: 'story_save_fail' }, err);
  console.error('[story-setup] init failed:', err);
});
