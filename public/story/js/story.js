import { createEffect } from './effects.js';

const galaxyId = new URLSearchParams(location.search).get('galaxyId');
const canonicalViewUrl = `/view/?galaxyId=${encodeURIComponent(galaxyId || '')}`;
const internalUniverseUrl = `${canonicalViewUrl}&skip_se=true`;
const activity = window.LumoraActivity;
const storyEmotion = window.LumoraStoryEmotion;
const experienceTransition = window.LumoraExperienceTransition;
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
const isVietnamese = navigator.language?.toLowerCase().startsWith('vi') ?? true;
let activeScheduler = null;
let activeEffect = null;
let activeSoundscapeRenderer = null;
let activeStoryRenderer = null;
let removeVisibilityHandler = () => {};
let cancelFinaleWait = () => {};
let playbackStarted = false;
let playbackCompleted = false;
let navigationCommitted = false;
let effectWasRunningBeforeHidden = false;
let lastDisplayedImageUrl = '';

const viewerCopy = isVietnamese
  ? {
    introEyebrow: 'Một câu chuyện dành cho bạn',
    introLabel: 'Chạm để bắt đầu câu chuyện',
    tapToBegin: 'Chạm để bắt đầu',
    finaleEyebrow: 'Điều còn ở lại',
    finaleFallback: 'Và đây là tất cả ký ức của chúng ta...',
    replay: 'Xem lại',
    continue: 'Bước vào vũ trụ →',
    imageAlt: (current, chapter) => `Kỷ niệm ${current} · ${chapter}`,
  }
  : {
    introEyebrow: 'A story made for you',
    introLabel: 'Tap to begin the story',
    tapToBegin: 'Tap to begin',
    finaleEyebrow: 'What remains',
    finaleFallback: 'And these are all the memories we carry...',
    replay: 'Replay',
    continue: 'Enter the universe →',
    imageAlt: (current, chapter) => `Memory ${current} · ${chapter}`,
  };

async function fetchAll() {
  if (!galaxyId) return null;
  try {
    const [cfgRes, viewRes, itemsRes, emotionRes] = await Promise.all([
      fetch('/shared/story-config.json'),
      fetch(`/galaxies/${galaxyId}/view`),
      fetch(`/gallary/items?galaxyId=${encodeURIComponent(galaxyId)}`),
      fetch('/media/story-emotions').catch(() => null),
    ]);
    return {
      config: await cfgRes.json(),
      view:   viewRes.ok  ? (await viewRes.json()).meta  : null,
      items:  itemsRes.ok ? (await itemsRes.json()).meta : [],
      emotionCatalog: emotionRes?.ok ? (await emotionRes.json()).meta : null,
    };
  } catch { return null; }
}

function groupByStage(items) {
  const map = {};
  items.forEach(item => {
    if (!item.stage) return;
    (map[item.stage] = map[item.stage] || []).push(item.imageUrl);
  });
  return map;
}

function resolveHook(chapterId, userChapters, configChapters) {
  const found = (userChapters || []).find(c => c.id === chapterId);
  if (found?.hookText) return found.hookText;
  return configChapters.find(c => c.id === chapterId)?.hooks[0] || '';
}

const elIntro          = document.getElementById('se-intro');
const elIntroEyebrow   = document.getElementById('se-intro-eyebrow');
const elIntroTitle     = document.getElementById('se-intro-title');
const elIntroOccasion  = document.getElementById('se-intro-occasion');
const elIntroMessage   = document.getElementById('se-intro-message');
const elProgressFill   = document.getElementById('se-progress-fill');
const elPhoto          = document.getElementById('se-photo');
const elPhotoBg        = document.getElementById('se-photo-bg');
const elPhotoImg       = document.getElementById('se-photo-img');
const elMemoryCamera   = document.getElementById('se-memory-camera');
const elMemoryFrames   = document.getElementById('se-memory-frames');
const elEnvironment    = document.getElementById('se-environment-overlay');
const elHookOverlay    = document.getElementById('se-hook-overlay');
const elChapterTag     = document.getElementById('se-chapter-tag');
const elHookText       = document.getElementById('se-hook-text');
const elFinale         = document.getElementById('se-finale');
const elFinaleMemory   = document.getElementById('se-finale-memory');
const elFinaleEyebrow  = document.getElementById('se-finale-eyebrow');
const elFinaleTitle    = document.getElementById('se-finale-title');
const elFinaleText     = document.getElementById('se-finale-text');
const elReplay         = document.getElementById('se-replay');
const elContinue       = document.getElementById('se-continue');
const elAudio          = document.getElementById('btn-audio');

elIntroEyebrow.textContent = viewerCopy.introEyebrow;
elIntro.setAttribute('aria-label', viewerCopy.introLabel);
document.querySelector('.se-tap-hint').textContent = viewerCopy.tapToBegin;
elFinaleEyebrow.textContent = viewerCopy.finaleEyebrow;
elFinaleText.textContent = viewerCopy.finaleFallback;
elReplay.textContent = viewerCopy.replay;
elContinue.textContent = viewerCopy.continue;

const wait = ms => new Promise(res => setTimeout(res, ms));
const fadeIn  = el => el.classList.add('visible');
const fadeOut = el => el.classList.remove('visible');

function preloadImage(url) {
  return new Promise(resolve => {
    const image = new Image();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve();
    };
    const timeoutId = setTimeout(finish, 3500);
    image.onload = finish;
    image.onerror = finish;
    image.src = url;
  });
}

function setBackgroundImage(element, url) {
  element.style.backgroundImage = url ? `url(${JSON.stringify(url)})` : '';
}

function emotionCopy(catalog, emotionId, field) {
  const emotion = catalog?.emotions?.find(item => item.id === emotionId);
  if (!emotion) return '';
  return emotion[`${field}${isVietnamese ? 'Vi' : 'En'}`] || '';
}

function resolveOpeningMessage(caption, catalog, emotionId) {
  const captions = (Array.isArray(caption) ? caption : [caption])
    .map(value => typeof value === 'string' ? value.trim() : '')
    .filter(Boolean);
  return captions.at(-1) || emotionCopy(catalog, emotionId, 'opening');
}

function setProgress(chapterIdx, totalChapters) {
  const pct = totalChapters > 0 ? ((chapterIdx + 1) / totalChapters) * 100 : 0;
  elProgressFill.style.width = pct + '%';
}

function clearMemoryScene() {
  elMemoryFrames.replaceChildren();
  elMemoryCamera.setAttribute('aria-hidden', 'true');
  elPhoto.classList.remove(
    'scene-mode', 'scene-spotlight', 'scene-constellation', 'scene-cascade', 'scene-crescendo', 'scene-horizon',
    'scene-directed', 'scene-embrace', 'scene-duet', 'scene-archive', 'scene-stillness', 'scene-orbit', 'scene-ascent',
  );
}

function buildMemoryScene(photoUrls, composition, chapterLabel) {
  clearMemoryScene();
  const safeComposition = [
    'spotlight', 'constellation', 'cascade', 'crescendo', 'horizon',
    'embrace', 'duet', 'archive', 'stillness', 'orbit', 'ascent',
  ].includes(composition)
    ? composition
    : 'constellation';
  const scenePhotoUrls = photoUrls.slice(0, 6);
  const frameLayout = storyEmotion.resolveSceneFrameLayout(safeComposition, scenePhotoUrls.length);
  elPhoto.classList.add('scene-mode', `scene-${safeComposition}`);
  if (frameLayout.length) elPhoto.classList.add('scene-directed');
  elMemoryCamera.setAttribute('aria-hidden', 'false');

  scenePhotoUrls.forEach((url, index) => {
    const frame = document.createElement('figure');
    frame.className = 'se-memory-frame';
    const frameDirection = frameLayout[index];
    if (frameDirection) {
      frame.style.setProperty('--scene-x', `${frameDirection.x}%`);
      frame.style.setProperty('--scene-y', `${frameDirection.y}%`);
      frame.style.setProperty('--scene-w', `${frameDirection.width}%`);
      frame.style.setProperty('--scene-h', `${frameDirection.height}%`);
      frame.style.setProperty('--scene-rotate', `${frameDirection.rotate}deg`);
      frame.style.setProperty('--scene-opacity', frameDirection.opacity);
      frame.style.setProperty('--scene-z', frameDirection.z);
    }
    const inner = document.createElement('div');
    inner.className = 'se-memory-frame-inner';
    const image = document.createElement('img');
    image.src = url;
    image.alt = viewerCopy.imageAlt(index + 1, chapterLabel);
    image.decoding = 'async';
    inner.appendChild(image);
    frame.appendChild(inner);
    elMemoryFrames.appendChild(frame);
  });
}

function createStoryRenderer(effect, soundscapeRenderer) {
  const animations = new Set();
  const transition = (element, duration) => {
    if (Number.isFinite(duration)) element.style.transitionDuration = `${duration}ms`;
  };
  const animateVisual = (element, keyframes, duration, delay = 0) => {
    if (reducedMotion || typeof element.animate !== 'function') {
      const finalFrame = keyframes.at(-1) || {};
      Object.assign(element.style, finalFrame);
      return;
    }
    const animation = element.animate(keyframes, {
      duration: Math.max(250, Number(duration) || 1000),
      delay: Math.max(0, Number(delay) || 0),
      easing: 'cubic-bezier(.22,.61,.36,1)',
      fill: 'forwards',
    });
    animations.add(animation);
  };
  const resetAnimations = () => {
    animations.forEach(animation => animation.cancel());
    animations.clear();
  };
  const isSceneMode = () => elPhoto.classList.contains('scene-mode');
  const cameraTarget = () => isSceneMode() ? elMemoryCamera : elPhotoImg;
  const sceneImages = () => [...elMemoryFrames.querySelectorAll('img')];
  const revealSceneFrames = duration => {
    const frames = [...elMemoryFrames.querySelectorAll('.se-memory-frame-inner')];
    const stagger = Math.min(420, Math.max(180, (Number(duration) || 900) * 0.38));
    frames.forEach((frame, index) => {
      const direction = index % 2 === 0 ? -1 : 1;
      animateVisual(frame, [
        { opacity: 0, transform: `translate3d(${direction * 18}px,30px,0) scale(.9)`, filter: 'blur(5px)' },
        { opacity: 1, transform: 'translate3d(0,0,0) scale(1)', filter: 'blur(0)' },
      ], Math.max(900, Number(duration) || 900), index * stagger);
    });
  };
  return {
    execute(action) {
      if (action.type.startsWith('audio.')) return soundscapeRenderer.execute(action);
      switch (action.type) {
        case 'camera.pushIn':
          animateVisual(cameraTarget(), [
            { transform: `scale(${1 + action.params.intensity * 0.02})` },
            { transform: `scale(${1.04 + action.params.intensity * 0.12})` },
          ], action.params.duration);
          break;
        case 'camera.pullOut':
          animateVisual(cameraTarget(), [
            { transform: `scale(${1.1 + action.params.intensity * 0.08})` },
            { transform: 'scale(1.01)' },
          ], action.params.duration);
          break;
        case 'camera.drift':
          animateVisual(cameraTarget(), [
            { transform: `scale(1.07) translateX(${-1.5 - action.params.intensity * 2}%)` },
            { transform: `scale(1.07) translateX(${1.5 + action.params.intensity * 2}%)` },
          ], action.params.duration);
          break;
        case 'camera.freeze': cameraTarget().style.transform = 'scale(1.015)'; break;
        case 'image.fadeIn':
          transition(elPhoto, action.params.duration);
          fadeIn(elPhoto);
          if (isSceneMode()) revealSceneFrames(action.params.duration);
          break;
        case 'image.fadeOut': transition(elPhoto, action.params.duration); fadeOut(elPhoto); break;
        case 'image.desaturate':
          (isSceneMode() ? sceneImages() : [elPhotoImg]).forEach(image => {
            transition(image, action.params.duration);
            image.style.filter = `grayscale(${action.params.intensity})`;
          });
          break;
        case 'image.focus':
          (isSceneMode() ? sceneImages() : [elPhotoImg]).forEach(image => {
            transition(image, action.params.duration);
            image.style.filter = 'blur(0)';
          });
          break;
        case 'text.reveal': transition(elHookOverlay, action.params.duration); fadeIn(elHookOverlay); break;
        case 'text.fade': transition(elHookOverlay, action.params.duration); fadeOut(elHookOverlay); break;
        case 'text.disappear': transition(elHookOverlay, action.params.duration); fadeOut(elHookOverlay); break;
        case 'text.hold':
        case 'wait':
        case 'hold':
        case 'pause':
        case 'silence':
        case 'delay': break;
        case 'effect.start': effect.start(); break;
        case 'effect.stop': effect.stop(); break;
        case 'effect.intensity': effect.setIntensity(action.params.intensity); break;
        case 'effect.fadeIn': effect.fadeIn(action.params.duration); break;
        case 'effect.fadeOut': effect.fadeOut(action.params.duration); break;
        case 'environment.dim': transition(elEnvironment, action.params.duration); elEnvironment.style.background = '#020207'; elEnvironment.style.opacity = String(action.params.intensity); break;
        case 'environment.brighten': transition(elEnvironment, action.params.duration); elEnvironment.style.background = 'rgba(244,177,131,.18)'; elEnvironment.style.opacity = String(action.params.intensity * 0.45); break;
        case 'environment.blackout': transition(elEnvironment, action.params.duration); elEnvironment.style.background = '#000'; elEnvironment.style.opacity = '1'; break;
        default: throw new Error(`Story renderer does not support action ${action.type}`);
      }
    },
    resetAnimations,
    destroy: resetAnimations,
  };
}

function resetPhotoVisualState() {
  activeStoryRenderer?.resetAnimations();
  elPhotoImg.style.transitionDuration = '';
  elPhotoImg.style.transform = '';
  elPhotoImg.style.filter = '';
  elMemoryCamera.style.transform = '';
  elMemoryFrames.querySelectorAll('img').forEach(image => {
    image.style.transitionDuration = '';
    image.style.filter = '';
  });
  elEnvironment.style.transitionDuration = '';
  elEnvironment.style.opacity = '0';
  fadeOut(elHookOverlay);
}

function playTimelineWithAdvance(scheduler, timeline) {
  const onAdvance = () => scheduler.skipToEnd();
  elPhoto.addEventListener('pointerup', onAdvance, { once: true });
  return scheduler.play(timeline).finally(() => {
    elPhoto.removeEventListener('pointerup', onAdvance);
  });
}

async function playChapter(hookText, chapterTag, photoUrls, chapterIdx, totalChapters, scheduler, direction) {
  activity?.log({ action: 'Viewer Story Chapter Start', feature: 'viewer', galaxyId, description: { template: 'story', chapterIndex: chapterIdx, photoCount: photoUrls.length, role: direction?.role, primaryEmotion: direction?.plan?.primaryEmotion } });
  setProgress(chapterIdx, totalChapters);

  elChapterTag.textContent = chapterTag;
  elHookText.textContent   = hookText;

  if (direction?.plan) {
    resetPhotoVisualState();
    await preloadImage(photoUrls[0]);
    const sourcePhotoUrls = direction.role === 'ending' && direction.echoPhotoUrls?.length
      ? [...direction.echoPhotoUrls.slice(-2), ...photoUrls]
      : photoUrls;
    const scenePhotoUrls = storyEmotion.directScenePhotos(sourcePhotoUrls, direction.mediaStrategy);
    buildMemoryScene(scenePhotoUrls, direction.composition, direction.chapterLabel);
    setBackgroundImage(elPhotoBg, photoUrls[Math.min(2, photoUrls.length - 1)]);
    lastDisplayedImageUrl = photoUrls.at(-1) || photoUrls[0];
    const sourceTimeline = storyEmotion.buildEmotionalChapterTimeline({
      catalog: direction.catalog,
      emotionConfig: direction.emotionConfig,
      context: direction.context,
      role: direction.role,
      photoCount: scenePhotoUrls.length,
      capabilities: 'story',
    });
    const timeline = storyEmotion.applyReducedMotion(sourceTimeline, reducedMotion);
    await playTimelineWithAdvance(scheduler, timeline);
    await wait(reducedMotion ? 20 : 650);
    activeStoryRenderer?.resetAnimations();
    clearMemoryScene();
  } else {
    clearMemoryScene();
    for (let i = 0; i < photoUrls.length; i++) {
      resetPhotoVisualState();
      await preloadImage(photoUrls[i]);
      if (photoUrls[i + 1]) preloadImage(photoUrls[i + 1]);
      elPhotoImg.src = photoUrls[i];
      elPhotoImg.alt = viewerCopy.imageAlt(i + 1, direction.chapterLabel);
      setBackgroundImage(elPhotoBg, photoUrls[i]);
      lastDisplayedImageUrl = photoUrls[i];

      const sourceTimeline = storyEmotion.createLegacyPhotoTimeline({ firstPhoto: i === 0 });
      const timeline = storyEmotion.applyReducedMotion(sourceTimeline, reducedMotion);
      await playTimelineWithAdvance(scheduler, timeline);
      await wait(380);
    }
  }
  activity?.log({ action: 'Viewer Story Chapter Complete', feature: 'viewer', galaxyId, status: 1, description: { template: 'story', chapterIndex: chapterIdx } });
  return true;
}

function preserveFullscreenForUniverse() {
  if (window.parent !== window || document.fullscreenElement || document.webkitFullscreenElement) return;
  const root = document.documentElement;
  try {
    const request = root.requestFullscreen
      ? root.requestFullscreen({ navigationUI: 'hide' })
      : root.webkitRequestFullscreen?.();
    Promise.resolve(request).catch(() => {});
  } catch {}
}

function mountUniverseInCurrentExperience(title, departureTransition) {
  return new Promise(resolve => {
    const host = document.createElement('div');
    host.className = 'se-universe-host';
    const frame = document.createElement('iframe');
    frame.title = title || 'Lumora Universe';
    frame.allow = 'autoplay; fullscreen';
    frame.setAttribute('allowfullscreen', '');
    host.appendChild(frame);

    let settled = false;
    let failed = false;
    const finish = async ready => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
      if (failed) {
        host.remove();
        resolve(false);
        return;
      }
      await departureTransition?.reveal({ duration: reducedMotion ? 180 : ready ? 1100 : 320 });
      resolve(true);
    };
    const onMessage = event => {
      if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
      if (event.data?.type !== 'lumora:universe-ready' || event.data?.galaxyId !== galaxyId) return;
      finish(true);
    };
    const timeout = setTimeout(() => finish(false), 12000);
    window.addEventListener('message', onMessage);
    frame.addEventListener('error', () => {
      failed = true;
      finish(false);
    }, { once: true });

    elAudio?.classList.add('hidden');
    elAudio?.setAttribute('aria-hidden', 'true');
    document.body.appendChild(host);
    history.replaceState({ lumoraExperience: 'universe' }, '', canonicalViewUrl);
    document.title = title ? `${title} — Lumora` : 'Lumora Universe';
    frame.src = `${internalUniverseUrl}&se_hosted=true`;
  });
}

async function main() {
  if (!storyEmotion) throw new Error('Story Emotion foundation failed to load');
  const data = await fetchAll();
  if (!data || !data.view?.storyType) {
    navigationCommitted = true;
    await mountUniverseInCurrentExperience('', null);
    return;
  }

  const { config, view, items, emotionCatalog } = data;
  const occasionConf = config[view.storyType]?.occasions[view.occasion];
  if (!occasionConf) {
    navigationCommitted = true;
    await mountUniverseInCurrentExperience(view.name, null);
    return;
  }

  const configChapters = occasionConf.chapters;
  const grouped        = groupByStage(items);
  const chaptersWithPhotos = configChapters.filter(ch => (grouped[ch.id] || []).length > 0);
  const experiencePlan = view.emotionConfig && emotionCatalog
    ? storyEmotion.buildExperiencePlan({
      catalog: emotionCatalog,
      emotionConfig: view.emotionConfig,
      context: { storyType: view.storyType, occasion: view.occasion },
      chapters: chaptersWithPhotos.map(chapter => ({
        ...chapter,
        photoCount: (grouped[chapter.id] || []).length,
      })),
    })
    : null;
  const directionByChapter = new Map((experiencePlan?.chapters || []).map(chapter => [chapter.chapterId, chapter]));
  if (experiencePlan?.accent) document.documentElement.style.setProperty('--se-emotion-accent', experiencePlan.accent);

  activeEffect = createEffect(
    experiencePlan?.effect || view.seEffect || 'none',
    document.getElementById('se-effect-canvas'),
    { reducedMotion },
  );
  activeEffect.start();
  activeSoundscapeRenderer = storyEmotion.createSoundscapeRenderer(window.musicManager);
  activeStoryRenderer = createStoryRenderer(activeEffect, activeSoundscapeRenderer);
  activeScheduler = new storyEmotion.TimelineScheduler(activeStoryRenderer, {
    onError(error, action) {
      activity?.logResult?.('Viewer Story Action Failed', false, {
        errorType: 'story_action_fail', actionType: action.type,
      }, error, { galaxyId });
    },
  });
  const onVisibilityChange = () => {
    if (document.hidden) {
      activeScheduler?.pause();
      effectWasRunningBeforeHidden = Boolean(activeEffect?.running);
      if (effectWasRunningBeforeHidden) activeEffect?.stop();
    } else {
      if (effectWasRunningBeforeHidden) activeEffect?.start();
      effectWasRunningBeforeHidden = false;
      activeScheduler?.resume();
    }
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  removeVisibilityHandler = () => document.removeEventListener('visibilitychange', onVisibilityChange);

  elIntroTitle.textContent    = view.name || 'Lumora';
  elIntroOccasion.textContent = occasionConf.label || '';
  elIntroMessage.textContent = resolveOpeningMessage(view.caption, emotionCatalog, experiencePlan?.primaryEmotion);
  window.musicManager.init(view.soundscape || null);

  await new Promise(resolve => {
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      elIntro.classList.add('hidden');
      window.musicManager.play?.().catch?.(() => {});
      preserveFullscreenForUniverse();
      playbackStarted = true;
      activity?.log({
        action: 'Viewer Story Started', feature: 'viewer', galaxyId, status: 1,
        description: { template: 'story', primaryEmotion: experiencePlan?.primaryEmotion || null, intensity: experiencePlan?.intensity ?? null, reducedMotion },
      });
      if (reducedMotion) activity?.log({ action: 'Viewer Story Reduced Motion Applied', feature: 'viewer', galaxyId, status: 1, description: { template: 'story' } });
      resolve();
    };
    elIntro.addEventListener('click', start, { once: true });
    elIntro.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      start();
    }, { once: true });
  });

  await wait(900);

  const rememberedPhotos = [];
  for (let i = 0; i < chaptersWithPhotos.length; i++) {
    const chapter = chaptersWithPhotos[i];
    const chapterDirection = directionByChapter.get(chapter.id);
    const photos  = grouped[chapter.id] || [];
    const hook    = resolveHook(chapter.id, view.chapters, configChapters);
    const tag     = `${chapter.label} · ${String(i + 1).padStart(2, '0')}`;
    const shouldContinue = await playChapter(hook, tag, photos, i, chaptersWithPhotos.length, activeScheduler, {
      plan: experiencePlan,
      catalog: emotionCatalog,
      emotionConfig: chapterDirection?.emotion
        ? { mode: 'manual', primaryEmotion: chapterDirection.emotion, intensity: chapterDirection.intensity }
        : view.emotionConfig,
      context: { storyType: view.storyType, occasion: view.occasion },
      role: chapterDirection?.role || 'memory',
      composition: chapterDirection?.composition || 'constellation',
      mediaStrategy: chapterDirection?.mediaStrategy || 'chronological',
      chapterLabel: chapter.label,
      echoPhotoUrls: rememberedPhotos,
    });
    if (!shouldContinue) return;
    rememberedPhotos.push(...photos);
    await wait(280);
  }

  // Fill progress to 100% on finale
  elProgressFill.style.width = '100%';
  elFinaleTitle.textContent = view.name || 'Lumora';
  elFinaleText.textContent = emotionCopy(emotionCatalog, experiencePlan?.primaryEmotion, 'closing')
    || viewerCopy.finaleFallback;
  setBackgroundImage(elFinaleMemory, lastDisplayedImageUrl);
  activeSoundscapeRenderer?.execute({ type: 'audio.duck', params: { duration: 1800, volume: 0.3 } });
  activeEffect?.fadeOut(reducedMotion ? 0 : 1200);
  fadeIn(elFinale);
  playbackCompleted = true;
  activity?.log({ action: 'Viewer Story Completed', feature: 'viewer', galaxyId, status: 1, description: { template: 'story', chapterCount: chaptersWithPhotos.length, primaryEmotion: experiencePlan?.primaryEmotion || null } });
  const nextAction = await waitForFinaleAction({ autoAdvance: !experiencePlan });
  if (!nextAction) return;
  if (nextAction === 'replay') {
    navigationCommitted = true;
    cleanupExperience();
    activity?.log({ action: 'Viewer Story Replayed', feature: 'viewer', galaxyId, status: 1, description: { template: 'story' } });
    window.location.replace(`/view/?galaxyId=${galaxyId}`);
  } else {
    if (experiencePlan) storyEmotion.saveExperienceHandoff(sessionStorage, galaxyId, experiencePlan);
    activeSoundscapeRenderer?.execute({ type: 'audio.fadeOut', params: { duration: reducedMotion ? 180 : 900 } });
    activeEffect?.fadeOut(reducedMotion ? 0 : 700);
    let departureTransition = null;
    if (experiencePlan && experienceTransition) {
      departureTransition = await experienceTransition.beginDeparture({
        storage: sessionStorage,
        galaxyId,
        accent: experiencePlan.accent,
        document,
        duration: reducedMotion ? 180 : 900,
      });
    }
    navigationCommitted = true;
    cleanupExperience();
    const mounted = await mountUniverseInCurrentExperience(view.name, departureTransition);
    if (!mounted) {
      if (experiencePlan) storyEmotion.saveExperienceHandoff(sessionStorage, galaxyId, experiencePlan);
      experienceTransition?.saveTransition(sessionStorage, galaxyId, { accent: experiencePlan?.accent });
      window.location.replace(canonicalViewUrl);
    }
  }
}

function waitForFinaleAction({ autoAdvance = true } = {}) {
  return new Promise(resolve => {
    let settled = false;
    const finish = action => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      elReplay.removeEventListener('click', replay);
      elContinue.removeEventListener('click', proceed);
      cancelFinaleWait = () => {};
      resolve(action);
    };
    const replay = () => finish('replay');
    const proceed = () => {
      // Safari/iOS requires requestFullscreen inside the original tap handler.
      preserveFullscreenForUniverse();
      finish('continue');
    };
    const timer = autoAdvance ? setTimeout(proceed, 5200) : null;
    elReplay.addEventListener('click', replay);
    elContinue.addEventListener('click', proceed);
    cancelFinaleWait = () => finish(null);
  });
}

function cleanupExperience() {
  cancelFinaleWait();
  activeScheduler?.destroy();
  activeScheduler = null;
  activeEffect?.destroy();
  activeEffect = null;
  activeSoundscapeRenderer?.destroy();
  activeSoundscapeRenderer = null;
  activeStoryRenderer?.destroy();
  activeStoryRenderer = null;
  clearMemoryScene();
  removeVisibilityHandler();
  removeVisibilityHandler = () => {};
}

window.addEventListener('pagehide', () => {
  if (playbackStarted && !playbackCompleted && !navigationCommitted) {
    activity?.log({ action: 'Viewer Story Abandoned', feature: 'viewer', galaxyId, level: 'warn', description: { template: 'story' } });
  }
  cleanupExperience();
}, { once: true });

main().catch(async (error) => {
  navigationCommitted = true;
  cleanupExperience();
  activity?.logResult?.('Viewer Story Failed', false, { errorType: 'story_playback_fail' }, error, { galaxyId });
  console.error('[story] playback failed:', error);
  await mountUniverseInCurrentExperience('', null);
});
