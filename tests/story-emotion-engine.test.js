const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  ACTION_TYPES,
  TimelineScheduler,
  applyReducedMotion,
  buildEmotionalChapterTimeline,
  buildEmotionalPhotoTimeline,
  buildExperiencePlan,
  consumeExperienceHandoff,
  createLegacyPhotoTimeline,
  createSoundscapeRenderer,
  createUniverseOpeningTimeline,
  directScenePhotos,
  normalizeTimeline,
  resolveChapterRoles,
  resolveSceneComposition,
  resolveSceneFrameLayout,
  resolveTimelineCapabilities,
  saveExperienceHandoff,
} = require('../public/shared/js/storyEmotionEngine');
const {
  TRANSITION_TYPE,
  TRANSITION_TTL_MS,
  consumeTransition,
  saveTransition,
} = require('../public/shared/js/experienceTransition');
const { publicStoryEmotionConfig } = require('../config/storyEmotions');

function fakeClock() {
  let now = 0;
  let nextId = 1;
  const tasks = new Map();
  return {
    now: () => now,
    setTimeout(callback, delay) {
      const id = nextId++;
      tasks.set(id, { at: now + delay, callback, order: id });
      return id;
    },
    clearTimeout(id) { tasks.delete(id); },
    tick(milliseconds) {
      const target = now + milliseconds;
      while (true) {
        const due = [...tasks.entries()]
          .filter(([, task]) => task.at <= target)
          .sort((left, right) => left[1].at - right[1].at || left[1].order - right[1].order)[0];
        if (!due) break;
        const [id, task] = due;
        tasks.delete(id);
        now = task.at;
        task.callback();
      }
      now = target;
    },
    pending: () => tasks.size,
  };
}

test('cinematic actions are allowlisted and timelines are normalized deterministically', () => {
  assert.ok(ACTION_TYPES.includes('camera.pushIn'));
  assert.ok(ACTION_TYPES.includes('audio.duck'));
  assert.ok(ACTION_TYPES.includes('audio.fadeIn'));
  assert.ok(ACTION_TYPES.includes('audio.pause'));
  assert.ok(ACTION_TYPES.includes('hold'));
  const timeline = normalizeTimeline({
    duration: 1000,
    actions: [
      { at: 700, type: 'image.fadeOut' },
      { at: 0, type: 'image.fadeIn' },
      { at: 700, type: 'text.fade' },
    ],
  });
  assert.deepEqual(timeline.actions.map(action => action.type), [
    'image.fadeIn', 'image.fadeOut', 'text.fade',
  ]);
  assert.throws(
    () => normalizeTimeline({ duration: 100, actions: [{ at: 0, type: 'javascript.eval' }] }),
    /Unsupported timeline action/,
  );
  assert.throws(
    () => normalizeTimeline({ duration: 100, actions: [{ at: 101, type: 'hold', params: { duration: 0 } }] }),
    /after timeline duration/,
  );
  assert.throws(
    () => normalizeTimeline({ duration: 100, actions: [{ at: 0, type: 'effect.start', params: { node: 'oscillator' } }] }),
    /Unsupported parameter/,
  );
  assert.throws(
    () => normalizeTimeline({ duration: 100, actions: [{ at: 0, type: 'effect.intensity', params: { intensity: 2 } }] }),
    /Invalid parameter/,
  );
});

test('timeline scheduler supports deterministic pause, resume and completion', async () => {
  const clock = fakeClock();
  const executed = [];
  const scheduler = new TimelineScheduler(action => executed.push(action.type), { clock });
  const completion = scheduler.play({
    duration: 100,
    actions: [
      { at: 0, type: 'image.fadeIn' },
      { at: 50, type: 'text.reveal' },
      { at: 100, type: 'image.fadeOut' },
    ],
  });

  clock.tick(0);
  assert.deepEqual(executed, ['image.fadeIn']);
  clock.tick(40);
  assert.equal(scheduler.pause(), true);
  clock.tick(500);
  assert.deepEqual(executed, ['image.fadeIn']);
  assert.equal(scheduler.resume(), true);
  clock.tick(10);
  assert.deepEqual(executed, ['image.fadeIn', 'text.reveal']);
  clock.tick(50);
  assert.deepEqual(executed, ['image.fadeIn', 'text.reveal', 'image.fadeOut']);
  assert.deepEqual(await completion, { status: 'completed', elapsed: 100 });
  assert.equal(clock.pending(), 0);
});

test('timeline skip and destroy execute final state once and clear every timer', async () => {
  const clock = fakeClock();
  const executed = [];
  const scheduler = new TimelineScheduler(action => executed.push(action.type), { clock });
  const completion = scheduler.play({
    duration: 500,
    actions: [
      { at: 0, type: 'image.fadeIn' },
      { at: 250, type: 'text.fade' },
      { at: 500, type: 'image.fadeOut' },
    ],
  });
  clock.tick(0);
  assert.equal(scheduler.skipToEnd(), true);
  assert.deepEqual(executed, ['image.fadeIn', 'text.fade', 'image.fadeOut']);
  assert.deepEqual(await completion, { status: 'skipped', elapsed: 500 });
  assert.equal(clock.pending(), 0);
  scheduler.destroy();
  scheduler.destroy();
  assert.equal(scheduler.state, 'destroyed');
});

test('legacy photo timing is data-driven and reduced motion removes camera movement', () => {
  const first = createLegacyPhotoTimeline({ firstPhoto: true });
  const next = createLegacyPhotoTimeline({ firstPhoto: false });
  assert.equal(first.duration, 8000);
  assert.equal(next.duration, 4500);
  assert.deepEqual(first.actions.filter(action => action.type.startsWith('text.')).map(action => action.at), [0, 2500]);
  assert.equal(first.actions.find(action => action.type === 'audio.restore').at, 0);
  assert.equal(first.actions.at(-1).type, 'image.fadeOut');

  const reduced = applyReducedMotion({
    duration: 1000,
    actions: [
      { at: 0, type: 'camera.pushIn', params: { intensity: 0.8 } },
      { at: 10, type: 'effect.intensity', params: { intensity: 0.8 } },
    ],
  });
  assert.equal(reduced.actions[0].type, 'camera.freeze');
  assert.equal(reduced.actions[1].params.intensity, 0.28);
});

test('Director builds deterministic contrast from realized chapters and emotion intent', () => {
  const catalog = publicStoryEmotionConfig();
  const chapters = [{ id: 'intro' }, { id: 'memory' }, { id: 'highlight' }, { id: 'ending' }];
  assert.deepEqual(resolveChapterRoles(chapters), [
    { chapterId: 'intro', role: 'intro' },
    { chapterId: 'memory', role: 'memory' },
    { chapterId: 'highlight', role: 'climax' },
    { chapterId: 'ending', role: 'ending' },
  ]);
  const options = {
    catalog,
    emotionConfig: { mode: 'auto', primaryEmotion: 'nostalgia', intensity: 0.72 },
    context: { storyType: 'couple' },
    role: 'memory', firstPhoto: true, capabilities: 'story',
  };
  const first = buildEmotionalPhotoTimeline(options);
  const second = buildEmotionalPhotoTimeline(options);
  assert.deepEqual(first, second);
  assert.ok(first.actions.some(action => action.type === 'image.desaturate'));
  assert.ok(first.actions.some(action => action.type === 'audio.duck'));
  assert.ok(first.actions.some(action => action.type === 'camera.pushIn'));

  const melancholy = buildEmotionalPhotoTimeline({
    ...options,
    emotionConfig: { mode: 'auto', primaryEmotion: 'melancholy', intensity: 0.72 },
  });
  const wonder = buildEmotionalPhotoTimeline({
    ...options,
    emotionConfig: { mode: 'auto', primaryEmotion: 'wonder', intensity: 0.72 },
  });
  assert.ok(melancholy.actions.some(action => action.type === 'silence'));
  assert.notDeepEqual(melancholy, wonder);
  assert.ok(melancholy.duration > wonder.duration);
});

test('Director varies camera language across photos while preserving the chapter role', () => {
  const catalog = publicStoryEmotionConfig();
  const cameraFor = photoIndex => buildEmotionalPhotoTimeline({
    catalog,
    emotionConfig: { mode: 'auto', primaryEmotion: 'wonder', intensity: 0.72 },
    context: { storyType: 'special' },
    role: 'climax',
    photoIndex,
    capabilities: 'story',
  }).actions.find(action => action.type.startsWith('camera.'))?.type;

  assert.deepEqual([cameraFor(0), cameraFor(1), cameraFor(2), cameraFor(3)], [
    'camera.pushIn', 'camera.drift', 'camera.pullOut', 'camera.pushIn',
  ]);
  assert.equal(buildEmotionalPhotoTimeline({
    catalog,
    emotionConfig: { mode: 'auto', primaryEmotion: 'wonder', intensity: 0.72 },
    context: { storyType: 'special' },
    role: 'ending',
    photoIndex: 0,
    capabilities: 'story',
  }).actions.find(action => action.type.startsWith('camera.'))?.type, 'camera.pullOut');
});

test('SE v2 directs a whole chapter as a spatial scene instead of per-photo slides', () => {
  const catalog = publicStoryEmotionConfig();
  assert.equal(resolveSceneComposition('intro', 1), 'spotlight');
  assert.equal(resolveSceneComposition('memory', 4), 'constellation');
  assert.equal(resolveSceneComposition('climax', 5), 'crescendo');
  assert.equal(resolveSceneComposition('ending', 3), 'horizon');
  assert.equal(resolveSceneComposition('ending', 1), 'horizon');
  assert.equal(resolveSceneComposition('memory', 4, 'orbit'), 'orbit');
  const emotionCompositions = catalog.emotions.map(emotion => buildExperiencePlan({
    catalog,
    emotionConfig: { mode: 'auto', primaryEmotion: emotion.id, intensity: 0.7 },
    context: { storyType: 'special' },
    chapters: [{ id: 'memory', photoCount: 4 }],
  }).chapters[0].composition);
  assert.equal(new Set(emotionCompositions).size, 6);
  assert.deepEqual(directScenePhotos(['a', 'b', 'c', 'd'], 'bookend-pair'), ['a', 'd', 'b', 'c']);
  assert.deepEqual(directScenePhotos(['a', 'b', 'c', 'd'], 'isolate-last'), ['d', 'a', 'b', 'c']);
  assert.deepEqual(directScenePhotos(['a', 'b', 'c', 'd'], 'center-reveal'), ['a', 'b', 'd', 'c']);

  const sceneProfiles = ['embrace', 'duet', 'archive', 'stillness', 'orbit', 'ascent'];
  [1, 2, 3, 4, 5, 6].forEach(count => {
    sceneProfiles.forEach(profile => {
      const layout = resolveSceneFrameLayout(profile, count);
      assert.equal(layout.length, count);
      layout.forEach(item => {
        assert.ok(item.x - item.width / 2 >= 0);
        assert.ok(item.x + item.width / 2 <= 100);
        assert.ok(item.y - item.height / 2 >= 0);
        assert.ok(item.y + item.height / 2 <= 100);
        assert.ok(item.opacity >= 0 && item.opacity <= 1);
      });
    });
  });
  [2, 4, 5].forEach(count => {
    const signatures = sceneProfiles.map(profile => JSON.stringify(resolveSceneFrameLayout(profile, count)));
    assert.equal(new Set(signatures).size, sceneProfiles.length);
  });
  const twoPhotoHope = resolveSceneFrameLayout('ascent', 2);
  assert.ok(twoPhotoHope[0].x > 20 && twoPhotoHope[1].x < 80);
  assert.ok(twoPhotoHope[0].y > twoPhotoHope[1].y);

  const chapter = buildEmotionalChapterTimeline({
    catalog,
    emotionConfig: { mode: 'auto', primaryEmotion: 'wonder', intensity: 0.72 },
    context: { storyType: 'special' },
    role: 'climax',
    photoCount: 5,
    capabilities: 'story',
  });
  const photo = buildEmotionalPhotoTimeline({
    catalog,
    emotionConfig: { mode: 'auto', primaryEmotion: 'wonder', intensity: 0.72 },
    context: { storyType: 'special' },
    role: 'climax',
    photoCount: 5,
    capabilities: 'story',
  });
  assert.ok(chapter.duration > photo.duration);
  assert.ok(chapter.actions.find(action => action.type === 'text.fade').at < chapter.duration * 0.5);
});

test('all six emotions and seven roles produce deterministic, observably directed timelines', () => {
  const catalog = publicStoryEmotionConfig();
  const roles = ['intro', 'build', 'memory', 'shift', 'climax', 'release', 'ending'];
  const emotionSignatures = new Set();
  catalog.emotions.forEach((emotion) => {
    const roleTimelines = roles.map(role => buildEmotionalPhotoTimeline({
      catalog,
      emotionConfig: { mode: 'auto', primaryEmotion: emotion.id, intensity: 0.7 },
      context: { storyType: 'special' },
      role,
      firstPhoto: true,
      capabilities: 'story',
    }));
    roleTimelines.forEach((timeline, index) => {
      assert.deepEqual(timeline, buildEmotionalPhotoTimeline({
        catalog,
        emotionConfig: { mode: 'auto', primaryEmotion: emotion.id, intensity: 0.7 },
        context: { storyType: 'special' },
        role: roles[index],
        firstPhoto: true,
        capabilities: 'story',
      }));
    });
    assert.ok(roleTimelines[roles.indexOf('climax')].duration > roleTimelines[roles.indexOf('memory')].duration);
    emotionSignatures.add(JSON.stringify(roleTimelines[roles.indexOf('memory')]));
  });
  assert.equal(emotionSignatures.size, 6);
});

test('experience plan auto-directs by Story type and capability fallback is controlled', () => {
  const catalog = publicStoryEmotionConfig();
  const plan = buildExperiencePlan({
    catalog,
    emotionConfig: { mode: 'auto', primaryEmotion: null, intensity: 0.65 },
    context: { storyType: 'travel' },
    chapters: [{ id: 'intro' }, { id: 'memory' }, { id: 'ending' }],
  });
  assert.equal(plan.primaryEmotion, 'wonder');
  assert.equal(plan.effect, 'aurora');
  assert.equal(plan.chapters.length, 3);
  assert.deepEqual(plan.chapters.map(chapter => chapter.emotion), ['wonder', 'wonder', 'hope']);
  assert.ok(plan.chapters[1].intensity > plan.chapters[0].intensity);

  const resolved = resolveTimelineCapabilities({
    duration: 1000,
    actions: [
      { at: 0, type: 'camera.shake', params: { duration: 1000, intensity: 0.8 } },
      { at: 10, type: 'image.parallax', params: { duration: 900, intensity: 0.5 } },
      { at: 20, type: 'hold', params: { duration: 500 } },
    ],
  }, 'story');
  assert.deepEqual(resolved.actions.map(action => action.type), ['camera.freeze', 'hold']);

  const opening = createUniverseOpeningTimeline({
    catalog, primaryEmotion: 'wonder', intensity: 0.8, template: 'fall',
  });
  assert.ok(opening.actions.every(action => action.type !== 'camera.pullOut'));
  assert.ok(opening.actions.some(action => action.type === 'camera.freeze'));

  const manual = buildExperiencePlan({
    catalog,
    emotionConfig: { mode: 'manual', primaryEmotion: 'warm', intensity: 0.6 },
    context: { storyType: 'family' },
    chapters: [
      { id: 'intro', emotion: null, intensity: null },
      { id: 'memory', emotion: 'melancholy', intensity: 0.82 },
      { id: 'ending', emotion: null, intensity: null },
    ],
  });
  assert.deepEqual(manual.chapters[1], {
    chapterId: 'memory', role: 'climax', composition: 'stillness', mediaStrategy: 'isolate-last', emotion: 'melancholy', intensity: 0.82,
  });
});

test('Auto Director creates a distinct emotional curve for every primary intent', () => {
  const catalog = publicStoryEmotionConfig();
  const chapters = [
    { id: 'intro', photoCount: 3 },
    { id: 'build', photoCount: 3 },
    { id: 'memory', photoCount: 4 },
    { id: 'highlight', photoCount: 5 },
    { id: 'ending', photoCount: 3 },
  ];
  const signatures = catalog.emotions.map(emotion => {
    const plan = buildExperiencePlan({
      catalog,
      emotionConfig: { mode: 'auto', primaryEmotion: emotion.id, intensity: 0.7 },
      context: { storyType: 'special' },
      chapters,
    });
    assert.equal(plan.chapters.find(chapter => chapter.role === 'memory').emotion, emotion.id);
    assert.equal(plan.chapters.find(chapter => chapter.role === 'climax').emotion, emotion.id);
    assert.ok(new Set(plan.chapters.map(chapter => chapter.intensity)).size > 2);
    return JSON.stringify(plan.chapters.map(chapter => [chapter.emotion, chapter.intensity, chapter.composition, chapter.mediaStrategy]));
  });
  assert.equal(new Set(signatures).size, 6);
});

test('Story-to-Universe handoff is allowlisted, single-use and expires', () => {
  const values = new Map();
  const storage = {
    setItem(key, value) { values.set(key, value); },
    getItem(key) { return values.get(key) || null; },
    removeItem(key) { values.delete(key); },
  };
  assert.equal(saveExperienceHandoff(storage, 'g1', {
    primaryEmotion: 'hope', intensity: 0.74, arbitraryAction: 'javascript.eval',
  }, 1000), true);
  assert.deepEqual(consumeExperienceHandoff(storage, 'g1', 2000), {
    version: 1, primaryEmotion: 'hope', intensity: 0.74,
  });
  assert.equal(consumeExperienceHandoff(storage, 'g1', 2000), null);
  saveExperienceHandoff(storage, 'g1', { primaryEmotion: 'hope', intensity: 0.7 }, 1000);
  assert.equal(consumeExperienceHandoff(storage, 'g1', 1000 + 11 * 60 * 1000), null);
  saveExperienceHandoff(storage, 'g1', { primaryEmotion: 'hope', intensity: 0.7 }, 1000);
  assert.equal(consumeExperienceHandoff(storage, 'g1', 1100, ['warm']), null);
});

test('SE-to-Universe visual transition is strict, short-lived and single-use', () => {
  const values = new Map();
  const storage = {
    setItem(key, value) { values.set(key, value); },
    getItem(key) { return values.get(key) || null; },
    removeItem(key) { values.delete(key); },
  };
  assert.equal(saveTransition(storage, 'g1', {
    accent: '#A78BFA', type: 'javascript.eval', arbitraryUrl: 'https://example.com/audio.mp3',
  }, 1000), true);
  assert.deepEqual(consumeTransition(storage, 'g1', 1400), {
    version: 1, type: TRANSITION_TYPE, accent: '#a78bfa',
  });
  assert.equal(consumeTransition(storage, 'g1', 1400), null);

  assert.equal(saveTransition(storage, 'g1', { accent: 'url(javascript:alert(1))' }, 1000), true);
  assert.deepEqual(consumeTransition(storage, 'g1', 1100), {
    version: 1, type: TRANSITION_TYPE, accent: '#a78bfa',
  });

  saveTransition(storage, 'g1', { accent: '#22d3ee' }, 1000);
  assert.equal(consumeTransition(storage, 'g1', 1000 + TRANSITION_TTL_MS + 1), null);
});

test('soundscape renderer translates semantic audio actions through one existing manager', () => {
  const fades = [];
  let pauses = 0;
  let cancellations = 0;
  const manager = {
    audio: { volume: 0.8 },
    fadeTo(volume, duration) {
      fades.push({ volume, duration });
      this.audio.volume = volume;
      return volume;
    },
    pause() { pauses += 1; },
    cancelVolumeTransition() { cancellations += 1; },
  };
  const renderer = createSoundscapeRenderer(manager);
  renderer.execute({ type: 'audio.duck', params: { duration: 500, volume: 0.3 } });
  renderer.execute({ type: 'audio.restore', params: { duration: 700 } });
  renderer.execute({ type: 'audio.swell', params: { duration: 300, intensity: 0.5 } });
  renderer.execute({ type: 'audio.fadeOut', params: { duration: 250 } });
  renderer.execute({ type: 'audio.fadeIn', params: { duration: 450 } });
  renderer.execute({ type: 'audio.pause', params: {} });
  assert.deepEqual(fades, [
    { volume: 0.3, duration: 500 },
    { volume: 0.8, duration: 700 },
    { volume: 0.9, duration: 300 },
    { volume: 0, duration: 250 },
    { volume: 0.8, duration: 450 },
  ]);
  assert.equal(pauses, 1);
  renderer.destroy();
  renderer.destroy();
  assert.equal(cancellations, 1);
  assert.equal(renderer.destroyed, true);
  assert.equal(renderer.execute({ type: 'audio.pause', params: {} }), false);
});

test('primitive effects expose idempotent lifecycle and clean RAF/resize resources', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/story/js/effects.js'), 'utf8');
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${Date.now()}`;
  const previous = {
    window: global.window,
    requestAnimationFrame: global.requestAnimationFrame,
    cancelAnimationFrame: global.cancelAnimationFrame,
  };
  const listeners = new Map();
  const cancelledFrames = [];
  let nextFrame = 1;
  let arcCount = 0;
  const context = {
    clearRect() {}, beginPath() {}, fill() {},
    arc() { arcCount += 1; },
    createRadialGradient() { return { addColorStop() {} }; },
    createLinearGradient() { return { addColorStop() {} }; },
    save() {}, restore() {}, moveTo() {}, lineTo() {}, closePath() {},
    set fillStyle(value) { this._fillStyle = value; },
  };
  const canvas = {
    width: 0,
    height: 0,
    style: {},
    parentElement: { clientWidth: 320, clientHeight: 640 },
    getContext: () => context,
  };

  global.window = {
    innerWidth: 320,
    innerHeight: 640,
    matchMedia: () => ({ matches: true }),
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); },
  };
  global.requestAnimationFrame = () => nextFrame++;
  global.cancelAnimationFrame = frame => cancelledFrames.push(frame);

  try {
    const { createEffect, initEffect } = await import(moduleUrl);
    const effect = createEffect('stardust', canvas);
    assert.equal(effect.reducedMotion, true);
    assert.equal(effect.start(), true);
    assert.equal(effect.start(), false);
    assert.equal(arcCount, 46);
    assert.equal(listeners.has('resize'), true);
    assert.equal(effect.setIntensity(0.5), 0.5);
    effect.fadeOut(120);
    assert.equal(canvas.style.opacity, '0');
    effect.fadeIn(80);
    assert.equal(canvas.style.opacity, '0.5');
    effect.destroy();
    effect.destroy();
    assert.equal(effect.destroyed, true);
    assert.equal(listeners.has('resize'), false);
    assert.ok(cancelledFrames.length >= 1);

    const cleanup = initEffect('none', canvas);
    assert.equal(typeof cleanup, 'function');
    assert.equal(cleanup.effect.name, 'none');
    cleanup();
  } finally {
    global.window = previous.window;
    global.requestAnimationFrame = previous.requestAnimationFrame;
    global.cancelAnimationFrame = previous.cancelAnimationFrame;
  }
});

test('public Story viewer executes legacy playback through the timeline boundary', () => {
  const page = fs.readFileSync(path.join(__dirname, '../public/story/index.html'), 'utf8');
  const viewer = fs.readFileSync(path.join(__dirname, '../public/story/js/story.js'), 'utf8');
  assert.ok(page.indexOf('/shared/js/storyEmotionEngine.js') < page.indexOf('./js/story.js'));
  assert.ok(page.indexOf('/shared/js/experienceTransition.js') < page.indexOf('./js/story.js'));
  assert.match(viewer, /new storyEmotion\.TimelineScheduler\(activeStoryRenderer/);
  assert.match(viewer, /createLegacyPhotoTimeline\(\{ firstPhoto: i === 0 \}\)/);
  assert.match(viewer, /createStoryRenderer\(activeEffect, activeSoundscapeRenderer\)/);
  assert.match(viewer, /createSoundscapeRenderer\(window\.musicManager\)/);
  assert.match(viewer, /activeScheduler\?\.destroy\(\)/);
  assert.match(viewer, /activeStoryRenderer\?\.destroy\(\)/);
  assert.match(viewer, /await preloadImage\(photoUrls\[i\]\)/);
  assert.doesNotMatch(viewer, /Object\.values\(grouped\)\.flat\(\)\.forEach/);
  assert.doesNotMatch(viewer, /waitTapOrTimer/);
  assert.doesNotMatch(viewer, /romantic|nostalgia|melancholy|wonder|hope/);
});

test('SE and both Universe renderers share a seamless handoff boundary', () => {
  const story = fs.readFileSync(path.join(__dirname, '../public/story/js/story.js'), 'utf8');
  const galaxyPage = fs.readFileSync(path.join(__dirname, '../public/galaxy-moon/index.html'), 'utf8');
  const galaxy = fs.readFileSync(path.join(__dirname, '../public/galaxy-moon/js/script.js'), 'utf8');
  const fallPage = fs.readFileSync(path.join(__dirname, '../public/fall/index.html'), 'utf8');
  const fall = fs.readFileSync(path.join(__dirname, '../public/fall/js/fall.js'), 'utf8');

  assert.match(story, /saveExperienceHandoff\(sessionStorage, galaxyId, experiencePlan\)/);
  assert.match(story, /experienceTransition\.beginDeparture\(/);
  assert.match(story, /preserveFullscreenForUniverse\(\)/);
  assert.match(story, /const proceed = \(\) => \{[\s\S]*preserveFullscreenForUniverse\(\);[\s\S]*finish\('continue'\)/);
  assert.match(story, /requestFullscreen\(\{ navigationUI: 'hide' \}\)/);
  assert.match(story, /webkitRequestFullscreen\?\.\(\)/);
  assert.match(story, /mountUniverseInCurrentExperience\(/);
  assert.match(story, /history\.replaceState\(\{ lumoraExperience: 'universe' \}, '', canonicalViewUrl\)/);
  assert.doesNotMatch(story, /location\.replace\([^\n]*skip_se=true/);
  assert.match(story, /elAudio\?\.classList\.add\('hidden'\)/);
  [galaxyPage, fallPage].forEach(page => {
    assert.match(page, /LumoraExperienceTransition\.bootstrapArrival\(/);
  });
  assert.match(galaxy, /if \(handoff\) startUniverse\(\)/);
  assert.match(galaxy, /arrivalTransition\?\.reveal/);
  assert.match(galaxy, /type: 'lumora:universe-ready'/);
  assert.match(fall, /if \(handoff\) startExperience\(\{ enterFullscreen: false \}\)/);
  assert.match(fall, /arrivalTransition\?\.reveal/);
  assert.match(fall, /type: 'lumora:universe-ready'/);
});
