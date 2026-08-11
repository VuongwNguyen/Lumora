import { initEffect } from './effects.js';

const galaxyId = new URLSearchParams(location.search).get('galaxyId');
const activity = window.LumoraActivity;

async function fetchAll() {
  if (!galaxyId) return null;
  try {
    const [cfgRes, viewRes, itemsRes] = await Promise.all([
      fetch('/shared/story-config.json'),
      fetch(`/galaxies/${galaxyId}/view`),
      fetch(`/gallary/items?galaxyId=${encodeURIComponent(galaxyId)}`),
    ]);
    return {
      config: await cfgRes.json(),
      view:   viewRes.ok  ? (await viewRes.json()).meta  : null,
      items:  itemsRes.ok ? (await itemsRes.json()).meta : [],
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
const elIntroTitle     = document.getElementById('se-intro-title');
const elIntroOccasion  = document.getElementById('se-intro-occasion');
const elProgressFill   = document.getElementById('se-progress-fill');
const elPhoto          = document.getElementById('se-photo');
const elPhotoBg        = document.getElementById('se-photo-bg');
const elPhotoImg       = document.getElementById('se-photo-img');
const elHookOverlay    = document.getElementById('se-hook-overlay');
const elChapterTag     = document.getElementById('se-chapter-tag');
const elHookText       = document.getElementById('se-hook-text');
const elPhotoDots      = document.getElementById('se-photo-dots');
const elFinale         = document.getElementById('se-finale');

const wait    = ms => new Promise(res => setTimeout(res, ms));
const fadeIn  = el => el.classList.add('visible');
const fadeOut = el => el.classList.remove('visible');

function setProgress(chapterIdx, totalChapters) {
  const pct = totalChapters > 0 ? ((chapterIdx + 1) / totalChapters) * 100 : 0;
  elProgressFill.style.width = pct + '%';
}

function renderDots(total, active) {
  elPhotoDots.replaceChildren();
  for (let i = 0; i < total; i++) {
    const d = document.createElement('div');
    d.className = 'se-dot' + (i === active ? ' active' : '');
    elPhotoDots.appendChild(d);
  }
}

function waitTapOrTimer(ms) {
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    const t = setTimeout(finish, ms);
    const onTap = () => { clearTimeout(t); finish(); };
    elPhoto.addEventListener('click',    onTap, { once: true });
    elPhoto.addEventListener('touchend', onTap, { once: true });
  });
}

async function playChapter(hookText, chapterTag, photoUrls, chapterIdx, totalChapters) {
  activity?.log({ action: 'Viewer Story Chapter Start', feature: 'viewer', galaxyId, description: { template: 'story', chapterIndex: chapterIdx, photoCount: photoUrls.length } });
  setProgress(chapterIdx, totalChapters);

  elChapterTag.textContent = chapterTag;
  elHookText.textContent   = hookText;

  for (let i = 0; i < photoUrls.length; i++) {
    elPhotoImg.src = photoUrls[i];
    elPhotoBg.style.backgroundImage = `url('${photoUrls[i]}')`;
    if (photoUrls.length > 1) renderDots(photoUrls.length, i);
    else elPhotoDots.replaceChildren();

    fadeIn(elPhoto);

    if (i === 0) {
      // Hook fades in with first photo, then fades out after 2500ms
      fadeIn(elHookOverlay);
      await wait(2500);
      fadeOut(elHookOverlay);
    }

    await waitTapOrTimer(i === 0 ? 5500 : 4500);
    fadeOut(elPhoto);
    await wait(380);
  }

  elPhotoDots.replaceChildren();
  activity?.log({ action: 'Viewer Story Chapter Complete', feature: 'viewer', galaxyId, status: 1, description: { template: 'story', chapterIndex: chapterIdx } });
}

async function main() {
  const data = await fetchAll();
  if (!data || !data.view?.storyType) {
    window.location.replace(`/view/?galaxyId=${galaxyId}&skip_se=true`);
    return;
  }

  const { config, view, items } = data;
  const occasionConf = config[view.storyType]?.occasions[view.occasion];
  if (!occasionConf) {
    window.location.replace(`/view/?galaxyId=${galaxyId}&skip_se=true`);
    return;
  }

  const configChapters = occasionConf.chapters;
  const grouped        = groupByStage(items);
  const chaptersWithPhotos = configChapters.filter(ch => (grouped[ch.id] || []).length > 0);

  const stopEffect = initEffect(
    view.seEffect || 'none',
    document.getElementById('se-effect-canvas')
  );

  // Preload images
  Object.values(grouped).flat().forEach(url => { const img = new Image(); img.src = url; });

  elIntroTitle.textContent    = view.name || 'Lumora';
  elIntroOccasion.textContent = occasionConf.label || '';
  window.musicManager.init(view.music?.url || null);

  await new Promise(resolve => {
    const start = () => { elIntro.classList.add('hidden'); resolve(); };
    elIntro.addEventListener('click',    start, { once: true });
    elIntro.addEventListener('touchend', start, { once: true });
  });

  window.musicManager.play?.().catch?.(() => {});
  document.documentElement.requestFullscreen?.().catch?.(() => {});
  await wait(900);

  for (let i = 0; i < chaptersWithPhotos.length; i++) {
    const chapter = chaptersWithPhotos[i];
    const photos  = grouped[chapter.id] || [];
    const hook    = resolveHook(chapter.id, view.chapters, configChapters);
    const tag     = `${chapter.label} · ${String(i + 1).padStart(2, '0')}`;
    await playChapter(hook, tag, photos, i, chaptersWithPhotos.length);
    await wait(280);
  }

  // Fill progress to 100% on finale
  elProgressFill.style.width = '100%';
  fadeIn(elFinale);
  await wait(2800);
  stopEffect();
  activity?.log({ action: 'Viewer Story Complete', feature: 'viewer', galaxyId, status: 1, description: { template: 'story', chapterCount: chaptersWithPhotos.length } });
  window.location.replace(`/view/?galaxyId=${galaxyId}&skip_se=true`);
}

main();
