import { createEffect } from '../../story/js/effects.js';

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
let EMOTION_CATALOG = null;
let selectedStoryType = null;
let selectedOccasion = null;
let emotionConfigState = null;
let emotionConfigPersisted = false;
let emotionPreviewScheduler = null;
let emotionPreviewEffect = null;
let emotionPreviewEffectName = null;
let emotionPreviewRunId = 0;
let emotionPreviewInProgress = false;
let emotionStepAvailable = false;
let emotionFinishDestination = null;
let emotionFinishInProgress = false;
let currentPreviewChapterId = null;
let sceneRefreshGeneration = 0;
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

function emotionLabel(emotion) {
  return isVietnamese ? emotion.labelVi : emotion.labelEn;
}

function emotionDescription(emotion) {
  return isVietnamese ? emotion.descriptionVi : emotion.descriptionEn;
}

function activeEmotion() {
  const id = window.LumoraStoryEmotion?.resolvePrimaryEmotion(
    emotionConfigState,
    EMOTION_CATALOG,
    { storyType: selectedStoryType, occasion: selectedOccasion },
  );
  return EMOTION_CATALOG?.emotions?.find(emotion => emotion.id === id) || null;
}

function applyEmotionMood() {
  const emotion = activeEmotion();
  const pane = document.getElementById('preview-pane');
  if (!emotion || !pane) return;
  pane.style.setProperty('--emotion-accent', emotion.accent);
  pane.style.boxShadow = `inset 0 0 120px color-mix(in srgb, ${emotion.accent} 14%, transparent)`;
  if (emotionPreviewEffectName !== emotion.effect) {
    emotionPreviewEffect?.destroy();
    emotionPreviewEffect = createEffect(emotion.effect, document.getElementById('se-canvas'), {
      intensity: emotionConfigState.intensity,
      reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false,
    });
    emotionPreviewEffectName = emotion.effect;
    emotionPreviewEffect.start();
  } else {
    emotionPreviewEffect?.setIntensity(emotionConfigState.intensity);
  }
}

function updateEmotionControls() {
  const autoButton = document.getElementById('emotion-auto');
  const intensity = document.getElementById('emotion-intensity');
  const output = document.getElementById('emotion-intensity-value');
  if (!autoButton || !emotionConfigState) return;
  autoButton.setAttribute('aria-pressed', String(emotionConfigState.mode === 'auto' && !emotionConfigState.primaryEmotion));
  document.querySelectorAll('.emotion-card').forEach(card => {
    card.setAttribute('aria-pressed', String(
      emotionConfigState.primaryEmotion === card.dataset.emotion,
    ));
  });
  const percent = Math.round(emotionConfigState.intensity * 100);
  intensity.value = String(percent);
  output.textContent = `${percent}%`;
  applyEmotionMood();
}

let emotionSaveGeneration = 0;
async function persistEmotionConfig() {
  if (!emotionConfigState) return false;
  const generation = ++emotionSaveGeneration;
  const status = document.getElementById('emotion-status');
  status.textContent = tr('setupSaving');
  status.classList.remove('error');
  try {
    const response = await fetch(`/galaxies/${galaxyId}/emotion`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(emotionConfigState),
    });
    if (!response.ok) throw new Error(`Emotion save failed: ${response.status}`);
    const body = await response.json();
    if (generation === emotionSaveGeneration) {
      emotionConfigState = body.meta;
      emotionConfigPersisted = true;
      status.textContent = tr('storyEmotionSaved');
      updateEmotionControls();
    }
    return true;
  } catch (error) {
    if (generation === emotionSaveGeneration) {
      emotionConfigPersisted = false;
      status.textContent = tr('storyEmotionSaveFailed');
      status.classList.add('error');
    }
    storyResult('Story Emotion Save Result', false, {
      mode: emotionConfigState.mode,
      primaryEmotion: emotionConfigState.primaryEmotion,
      intensity: emotionConfigState.intensity,
      errorType: 'story_emotion_save_fail',
    }, error);
    throw error;
  }
}

function resetEmotionPreviewVisuals() {
  const pane = document.getElementById('preview-pane');
  const photos = document.getElementById('preview-photos');
  const bottom = document.getElementById('se-bottom');
  const canvas = document.getElementById('se-canvas');
  photos.style.opacity = '';
  bottom.style.opacity = '';
  pane.style.filter = '';
  emotionPreviewEffect?.setIntensity(emotionConfigState?.intensity ?? 0.65);
  photos.querySelectorAll('img').forEach(image => {
    image.style.transition = '';
    image.style.transform = '';
    image.style.filter = '';
  });
  photos.querySelectorAll('.preview-memory-camera').forEach(camera => {
    camera.getAnimations?.().forEach(animation => animation.cancel());
    camera.style.transform = '';
  });
}

function createEmotionPreviewRenderer() {
  const pane = document.getElementById('preview-pane');
  const photos = document.getElementById('preview-photos');
  const bottom = document.getElementById('se-bottom');
  const images = () => photos.querySelectorAll('img');
  const cameras = () => photos.querySelectorAll('.preview-memory-camera');
  const duration = action => `${action.params.duration || 0}ms`;
  const moveCamera = (from, to, action) => cameras().forEach(camera => {
    if (typeof camera.animate === 'function') {
      camera.animate([{ transform: from }, { transform: to }], {
        duration: Math.max(250, action.params.duration || 1000),
        easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'forwards',
      });
    } else {
      camera.style.transition = `transform ${duration(action)} ease`;
      camera.style.transform = to;
    }
  });
  return {
    execute(action) {
      if (action.type.startsWith('audio.') || ['wait', 'hold', 'pause', 'silence', 'delay'].includes(action.type)) return;
      switch (action.type) {
        case 'image.fadeIn': photos.style.transition = `opacity ${duration(action)} ease`; photos.style.opacity = '1'; break;
        case 'image.fadeOut': photos.style.transition = `opacity ${duration(action)} ease`; photos.style.opacity = '0'; break;
        case 'image.desaturate': images().forEach(image => { image.style.transition = `filter ${duration(action)} ease`; image.style.filter = `grayscale(${action.params.intensity})`; }); break;
        case 'text.reveal': bottom.style.transition = `opacity ${duration(action)} ease`; bottom.style.opacity = '1'; break;
        case 'text.fade':
        case 'text.disappear': bottom.style.transition = `opacity ${duration(action)} ease`; bottom.style.opacity = '0'; break;
        case 'camera.pushIn': moveCamera('scale(1)', `scale(${1.04 + action.params.intensity * 0.12})`, action); break;
        case 'camera.pullOut': moveCamera(`scale(${1.1 + action.params.intensity * 0.08})`, 'scale(1.01)', action); break;
        case 'camera.drift': moveCamera(`scale(1.06) translateX(${-2 - action.params.intensity * 2}%)`, `scale(1.06) translateX(${2 + action.params.intensity * 2}%)`, action); break;
        case 'camera.freeze': break;
        case 'effect.intensity': emotionPreviewEffect?.setIntensity(action.params.intensity); break;
        case 'effect.start': emotionPreviewEffect?.start(); break;
        case 'effect.stop': emotionPreviewEffect?.stop(); break;
        case 'effect.fadeIn': emotionPreviewEffect?.fadeIn(action.params.duration); break;
        case 'effect.fadeOut': emotionPreviewEffect?.fadeOut(action.params.duration); break;
        case 'environment.dim': pane.style.transition = `filter ${duration(action)} ease`; pane.style.filter = `brightness(${1 - action.params.intensity * 0.35})`; break;
        case 'environment.brighten': pane.style.transition = `filter ${duration(action)} ease`; pane.style.filter = `brightness(${1 + action.params.intensity * 0.22})`; break;
        default: break;
      }
    },
  };
}

function chapterPreviewHook(chapter) {
  return chapterHooks[chapter.id]
    || window._dbChapterHooks?.[chapter.id]
    || chapterPrompt(chapter);
}

function updateChapterPreviewCopy(chapter, chapterIdx, totalChapters) {
  const occasionCfg = STORY_CONFIG?.[selectedStoryType]?.occasions?.[selectedOccasion];
  const labelEl = document.getElementById('se-bottom-label');
  const hookEl = document.getElementById('se-bottom-hook');
  if (labelEl) {
    const num = String(chapterIdx + 1).padStart(2, '0');
    const total = String(totalChapters).padStart(2, '0');
    labelEl.textContent = [occasionLabel(selectedOccasion, occasionCfg).toUpperCase(), `${num} / ${total}`].filter(Boolean).join(' · ');
  }
  if (hookEl) hookEl.textContent = chapterPreviewHook(chapter) || '';
}

function previewFileAsDataUrl(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = event => resolve(event.target.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function getDirectedPreviewChapters() {
  const configured = STORY_CONFIG?.[selectedStoryType]?.occasions?.[selectedOccasion]?.chapters || [];
  const chapters = await Promise.all(configured.map(async chapter => {
    const localFiles = chapterFiles[chapter.id] || [];
    const urls = localFiles.length
      ? (await Promise.all(localFiles.map(previewFileAsDataUrl))).filter(Boolean)
      : [...(window._galleryByChapter?.[chapter.id] || [])];
    const stored = window._dbChaptersById?.[chapter.id] || {};
    return { ...chapter, emotion: stored.emotion, intensity: stored.intensity, urls };
  }));
  return chapters.filter(chapter => chapter.urls.length > 0);
}

async function refreshCurrentPreviewComposition() {
  if (!currentPreviewChapterId || !emotionConfigState || emotionPreviewInProgress) return;
  const generation = ++sceneRefreshGeneration;
  const directedChapters = await getDirectedPreviewChapters();
  if (generation !== sceneRefreshGeneration || emotionPreviewInProgress) return;
  const currentIndex = directedChapters.findIndex(chapter => chapter.id === currentPreviewChapterId);
  if (currentIndex < 0) return;
  const experiencePlan = window.LumoraStoryEmotion.buildExperiencePlan({
    catalog: EMOTION_CATALOG,
    emotionConfig: emotionConfigState,
    context: { storyType: selectedStoryType, occasion: selectedOccasion },
    chapters: directedChapters.map(chapter => ({ ...chapter, photoCount: chapter.urls.length })),
  });
  const chapter = directedChapters[currentIndex];
  const direction = experiencePlan.chapters.find(item => item.chapterId === chapter.id) || {};
  const sceneUrls = window.LumoraStoryEmotion.directScenePhotos(chapter.urls, direction.mediaStrategy);
  window.setPreviewPhotoUrls?.(sceneUrls, {
    role: direction.role || 'memory',
    composition: direction.composition || 'constellation',
  });
  updateChapterPreviewCopy(chapter, currentIndex, directedChapters.length);
}

function requestCurrentPreviewComposition() {
  refreshCurrentPreviewComposition().catch(error => {
    storyResult('Story Emotion Scene Refresh Result', false, { errorType: 'story_action_fail' }, error);
  });
}

function restoreEmotionPreviewButton() {
  const button = document.getElementById('emotion-preview');
  button.disabled = false;
  button.setAttribute('aria-pressed', 'false');
  button.textContent = tr('storyEmotionPreview');
  button.hidden = true;
}

function stopEmotionPreview({ log = true } = {}) {
  if (!emotionPreviewInProgress) return false;
  emotionPreviewRunId += 1;
  emotionPreviewInProgress = false;
  emotionPreviewScheduler?.cancel();
  resetEmotionPreviewVisuals();
  restoreEmotionPreviewButton();
  const status = document.getElementById('emotion-status');
  status.textContent = emotionConfigPersisted ? tr('storyEmotionSaved') : '';
  if (log) activity?.log({ action: 'Story Emotion Preview Stopped', feature: 'story', level: 'warn', galaxyId });
  return true;
}

async function runEmotionPreview() {
  if (!EMOTION_CATALOG || !emotionConfigState || !window.LumoraStoryEmotion) return;
  const button = document.getElementById('emotion-preview');
  const status = document.getElementById('emotion-status');
  if (emotionPreviewInProgress) {
    stopEmotionPreview();
    return;
  }

  const directedChapters = await getDirectedPreviewChapters();
  if (!directedChapters.length) {
    status.textContent = tr('storyEmotionPreviewEmpty');
    status.classList.add('error');
    return;
  }

  const experiencePlan = window.LumoraStoryEmotion.buildExperiencePlan({
    catalog: EMOTION_CATALOG,
    emotionConfig: emotionConfigState,
    context: { storyType: selectedStoryType, occasion: selectedOccasion },
    chapters: directedChapters.map(chapter => ({
      ...chapter,
      photoCount: chapter.urls.length,
    })),
  });
  const directionByChapter = new Map(experiencePlan.chapters.map(chapter => [chapter.chapterId, chapter]));
  const runId = ++emotionPreviewRunId;
  emotionPreviewInProgress = true;
  emotionPreviewScheduler?.destroy();
  resetEmotionPreviewVisuals();
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
  emotionPreviewScheduler = new window.LumoraStoryEmotion.TimelineScheduler(createEmotionPreviewRenderer());
  button.hidden = false;
  button.setAttribute('aria-pressed', 'true');
  button.textContent = tr('storyEmotionPreviewing');
  status.classList.remove('error');
  activity?.log({
    action: 'Story Emotion Preview Started', feature: 'story', galaxyId,
    description: {
      mode: emotionConfigState.mode, primaryEmotion: experiencePlan.primaryEmotion,
      intensity: emotionConfigState.intensity, reducedMotion: reduced, chapterCount: directedChapters.length,
    },
  });
  try {
    window.setPreviewPhotoUrls?.([]);
    status.textContent = tr('storyEmotionPreviewOpening');
    await wait(reduced ? 20 : 900);
    if (runId !== emotionPreviewRunId) return;
    const rememberedUrls = [];
    for (let index = 0; index < directedChapters.length; index += 1) {
      if (runId !== emotionPreviewRunId) return;
      const chapter = directedChapters[index];
      currentPreviewChapterId = chapter.id;
      const direction = directionByChapter.get(chapter.id) || {};
      const chapterEmotionConfig = direction.emotion
        ? { mode: 'manual', primaryEmotion: direction.emotion, intensity: direction.intensity }
        : emotionConfigState;
      const sourceUrls = direction.role === 'ending' && rememberedUrls.length
        ? [...rememberedUrls.slice(-2), ...chapter.urls]
        : chapter.urls;
      const sceneUrls = window.LumoraStoryEmotion.directScenePhotos(sourceUrls, direction.mediaStrategy);
      resetEmotionPreviewVisuals();
      window.setPreviewPhotoUrls?.(sceneUrls, {
        role: direction.role || 'memory',
        composition: direction.composition || 'constellation',
      });
      updateChapterPreviewCopy(chapter, index, directedChapters.length);
      status.textContent = tr('storyEmotionPreviewProgress', index + 1, directedChapters.length, chapterLabel(chapter));
      await wait(reduced ? 20 : 320);
      if (runId !== emotionPreviewRunId) return;
      const timeline = window.LumoraStoryEmotion.buildEmotionalChapterTimeline({
        catalog: EMOTION_CATALOG,
        emotionConfig: chapterEmotionConfig,
        context: { storyType: selectedStoryType, occasion: selectedOccasion },
        role: direction.role || 'memory',
        photoCount: sceneUrls.length,
        capabilities: 'story',
      });
      const result = await emotionPreviewScheduler.play(window.LumoraStoryEmotion.applyReducedMotion(timeline, reduced));
      if (result.status !== 'completed' || runId !== emotionPreviewRunId) return;
      rememberedUrls.push(...chapter.urls);
      await wait(reduced ? 20 : 280);
    }
    status.textContent = tr('storyEmotionPreviewComplete');
    activity?.log({
      action: 'Story Emotion Preview Completed', feature: 'story', status: 1, galaxyId,
      description: { chapterCount: directedChapters.length, primaryEmotion: experiencePlan.primaryEmotion },
    });
  } catch (error) {
    if (runId === emotionPreviewRunId) {
      status.textContent = tr('storyEmotionPreviewFailed');
      status.classList.add('error');
      storyResult('Story Emotion Preview Result', false, { errorType: 'story_action_fail' }, error);
    }
  } finally {
    if (runId !== emotionPreviewRunId) return;
    resetEmotionPreviewVisuals();
    emotionPreviewInProgress = false;
    restoreEmotionPreviewButton();
  }
}

async function persistAndRunEmotionPreview() {
  const persistence = persistEmotionConfig().catch(() => false);
  await runEmotionPreview();
  await persistence;
}

function makeEmotionStepAvailable(destination, { open = false, select = false } = {}) {
  if (!emotionStepAvailable) return false;
  emotionFinishDestination = destination || `/portal/galaxy-setup.html?galaxyId=${galaxyId}`;
  const section = document.getElementById('emotion-director');
  const tab = document.getElementById('story-mobile-emotion-tab');
  section.hidden = false;
  section.open = open;
  tab.disabled = false;
  tab.setAttribute('aria-disabled', 'false');
  if (select) {
    tab.click();
    requestAnimationFrame(() => section.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }
  return true;
}

function logStoryComplete() {
  activity?.log({
    action: 'Story Wizard Complete', feature: 'story', status: 1, galaxyId,
    description: { storyType: selectedStoryType, occasion: selectedOccasion },
  });
}

async function redirectCompletedStory(destination) {
  logStoryComplete();
  await wait(800);
  window.location.href = destination;
}

async function continueToEmotionStep(destination) {
  appendLMsg(tr('storyEmotionAfterStory'));
  if (makeEmotionStepAvailable(destination, { open: true, select: true })) return;
  appendLMsgWithNote(tr('storySetupReady'), tr('storySetupRedirecting'));
  await redirectCompletedStory(destination);
}

async function finishEmotionStep() {
  if (emotionFinishInProgress) return;
  const button = document.getElementById('emotion-finish');
  const status = document.getElementById('emotion-status');
  if (emotionPreviewInProgress) {
    stopEmotionPreview({ log: false });
  }
  emotionFinishInProgress = true;
  button.disabled = true;
  button.textContent = tr('storyEmotionFinishing');
  try {
    if (!emotionConfigPersisted) await persistEmotionConfig();
    status.classList.remove('error');
    status.textContent = tr('storySetupReady');
    await redirectCompletedStory(emotionFinishDestination || `/portal/galaxy-setup.html?galaxyId=${galaxyId}`);
  } catch {
    emotionFinishInProgress = false;
    button.disabled = false;
    button.textContent = tr('storyEmotionFinish');
  }
}

function setupEmotionDirector(galaxy) {
  const section = document.getElementById('emotion-director');
  if (!EMOTION_CATALOG?.emotions?.length || !window.LumoraStoryEmotion) {
    emotionStepAvailable = false;
    section.hidden = true;
    document.getElementById('story-mobile-story-tab')?.click();
    return;
  }
  emotionStepAvailable = true;
  emotionConfigPersisted = Boolean(galaxy.emotionConfig);
  emotionConfigState = galaxy.emotionConfig || { ...EMOTION_CATALOG.defaultConfig };
  const grid = document.getElementById('emotion-grid');
  EMOTION_CATALOG.emotions.forEach(emotion => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'emotion-card';
    card.dataset.emotion = emotion.id;
    card.style.setProperty('--emotion-accent', emotion.accent);
    const label = document.createElement('span');
    label.textContent = emotionLabel(emotion);
    const description = document.createElement('small');
    description.textContent = emotionDescription(emotion);
    card.append(label, description);
    card.addEventListener('click', async () => {
      stopEmotionPreview({ log: false });
      emotionConfigState = { ...emotionConfigState, mode: 'auto', primaryEmotion: emotion.id };
      emotionConfigPersisted = false;
      updateEmotionControls();
      activity?.log({ action: 'Story Emotion Selected', feature: 'story', galaxyId, description: { primaryEmotion: emotion.id, intensity: emotionConfigState.intensity } });
      await persistAndRunEmotionPreview();
    });
    grid.appendChild(card);
  });
  document.getElementById('emotion-auto').addEventListener('click', async () => {
    stopEmotionPreview({ log: false });
    emotionConfigState = { ...emotionConfigState, mode: 'auto', primaryEmotion: null };
    emotionConfigPersisted = false;
    updateEmotionControls();
    activity?.log({ action: 'Story Emotion Auto Enabled', feature: 'story', galaxyId, description: { intensity: emotionConfigState.intensity } });
    await persistAndRunEmotionPreview();
  });
  const intensity = document.getElementById('emotion-intensity');
  intensity.addEventListener('input', () => {
    stopEmotionPreview({ log: false });
    emotionConfigState = { ...emotionConfigState, intensity: Number(intensity.value) / 100 };
    emotionConfigPersisted = false;
    updateEmotionControls();
  });
  intensity.addEventListener('change', async () => {
    activity?.log({ action: 'Story Emotion Intensity Changed', feature: 'story', galaxyId, description: { intensity: emotionConfigState.intensity } });
    await persistAndRunEmotionPreview();
  });
  document.getElementById('emotion-preview').addEventListener('click', runEmotionPreview);
  document.getElementById('emotion-finish').addEventListener('click', finishEmotionStep);
  updateEmotionControls();
  if (galaxy.storyType && galaxy.occasion) {
    makeEmotionStepAvailable(`/portal/galaxy-setup.html?galaxyId=${galaxyId}`);
  }
}

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

let imageUploadPolicyPromise;

function getImageUploadPolicy() {
  if (!imageUploadPolicyPromise) {
    imageUploadPolicyPromise = fetch('/gallary/upload-policy')
      .then(response => {
        if (!response.ok) throw new Error(tr('setupUploadPolicyFail'));
        return response.json();
      })
      .then(body => body.meta);
  }
  return imageUploadPolicyPromise;
}

async function saveChapter(chapterId) {
  const files = chapterFiles[chapterId] || [];
  if (!files.length) return; // no new files — keep existing

  activity?.log({ action: 'Story Chapter Photo Upload Submit', feature: 'story', galaxyId, description: { chapterId, count: files.length } });

  const uploadPolicy = await getImageUploadPolicy();
  if (files.length > uploadPolicy.maxFiles) throw new Error(tr('setupUploadTooMany', uploadPolicy.maxFiles));
  const unsupported = files.find(file => !uploadPolicy.mimeTypes.includes(file.type));
  if (unsupported) throw new Error(tr('setupUploadUnsupported', unsupported.name));
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > uploadPolicy.maxTotalSize) {
    throw new Error(tr('setupUploadTotalTooLarge', uploadPolicy.maxTotalSize / 1024 / 1024));
  }

  // Delete old photos for this chapter before uploading new ones (replace semantics)
  const oldIds = window._galleryIdsByChapter?.[chapterId] || [];
  await Promise.all(oldIds.map(id =>
    fetch(`/gallary/items/${id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token },
    })
  ));

  const form = new FormData();
  form.append('title', 'Uploaded image');
  form.append('description', 'Image uploaded from story setup');
  form.append('stage', chapterId);
  files.forEach(file => form.append('files', file));
  const response = await fetch(`/gallary/upload?galaxyId=${encodeURIComponent(galaxyId)}`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token },
    body: form,
  });
  if (!response.ok) {
    let message = tr('storySetupUploadFail', response.status);
    try {
      const body = await response.json();
      if (body.message) message = body.message;
    } catch {}
    const error = new Error(message);
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
  currentPreviewChapterId = chapter.id;
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
  updateChapterPreviewCopy(chapter, chapterIdx, totalChapters);
  if (emotionConfigState) requestCurrentPreviewComposition();
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
  fileInput.accept = 'image/jpeg,image/png,image/webp';
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
        await continueToEmotionStep(`/portal/galaxy.html?galaxyId=${galaxyId}`);
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
  const [cfgRes, galaxyRes, emotionRes] = await Promise.all([
    fetch('/shared/story-config.json'),
    fetch(`/galaxies/${galaxyId}`, { headers: { Authorization: 'Bearer ' + token } }),
    fetch('/media/story-emotions').catch(() => null),
  ]);

  if (!galaxyRes.ok || !cfgRes.ok) { window.location.href = '/portal/'; return; }

  STORY_CONFIG = await cfgRes.json();
  EMOTION_CATALOG = emotionRes?.ok ? (await emotionRes.json()).meta : null;
  const galaxy = (await galaxyRes.json()).meta;
  storyResult('Story Setup Loaded', true, { editMode: Boolean(galaxy.storyType) });

  const gName = galaxy.name || 'Galaxy';
  document.getElementById('galaxy-name').textContent = gName;
  setupNameEditor(gName);
  document.getElementById('back-link').href = `/portal/galaxy-setup.html?galaxyId=${galaxyId}`;
  window.updateSEPreview?.(null, null, gName);
  setupEmotionDirector(galaxy);

  // Store DB hookText per chapter (user customized in v1, null in v2)
  window._dbChapterHooks = {};
  window._dbChaptersById = {};
  (galaxy.chapters || []).forEach(ch => {
    window._dbChaptersById[ch.id] = ch;
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
    updateEmotionControls();

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
        await continueToEmotionStep(`/portal/galaxy-setup.html?galaxyId=${galaxyId}`);
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
        updateEmotionControls();
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
        await continueToEmotionStep(`/portal/galaxy-setup.html?galaxyId=${galaxyId}`);
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
          updateEmotionControls();
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
          updateEmotionControls();
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

window.addEventListener('pagehide', () => {
  emotionPreviewRunId += 1;
  emotionPreviewInProgress = false;
  emotionPreviewScheduler?.destroy();
  emotionPreviewEffect?.destroy();
}, { once: true });
