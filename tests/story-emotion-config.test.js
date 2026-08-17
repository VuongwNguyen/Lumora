const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const GalaxyModel = require('../models/galaxy');
const GalaxyService = require('../services/galaxy.service');
const {
  EMOTION_KEYS,
  normalizeEmotionConfig,
  publicStoryEmotionConfig,
  validateEmotionConfig,
} = require('../config/storyEmotions');

test('canonical Story emotion config exposes six bounded emotion-first presets', () => {
  const publicConfig = publicStoryEmotionConfig();
  assert.deepEqual(publicConfig.emotions.map(emotion => emotion.id), [...EMOTION_KEYS]);
  assert.equal(publicConfig.emotions.length, 6);
  assert.ok(publicConfig.emotions.every(emotion => emotion.labelVi && emotion.labelEn && emotion.descriptionVi && emotion.descriptionEn));
  assert.ok(publicConfig.emotions.every(emotion => emotion.openingVi && emotion.openingEn && emotion.closingVi && emotion.closingEn));
  assert.equal(new Set(publicConfig.emotions.map(emotion => emotion.director.sceneProfile)).size, 6);
  assert.equal(new Set(publicConfig.emotions.map(emotion => emotion.director.mediaStrategy)).size, 6);
  assert.deepEqual(Object.keys(publicConfig.directorRules.emotionCurves), [...EMOTION_KEYS]);
  Object.values(publicConfig.directorRules.emotionCurves).forEach(curve => {
    assert.deepEqual(Object.keys(curve), ['intro', 'build', 'memory', 'shift', 'climax', 'release', 'ending']);
    assert.ok(Object.values(curve).every(direction => (
      EMOTION_KEYS.includes(direction.emotion)
      && direction.intensityMultiplier >= 0.25
      && direction.intensityMultiplier <= 1.4
    )));
  });
  assert.equal(validateEmotionConfig({ mode: 'auto', primaryEmotion: null, intensity: 0.65 }), true);
  assert.equal(validateEmotionConfig({ mode: 'auto', primaryEmotion: 'nostalgia', intensity: 0.7 }), true);
  assert.equal(validateEmotionConfig({ mode: 'manual', primaryEmotion: 'unknown', intensity: 0.7 }), false);
  assert.equal(validateEmotionConfig({ mode: 'manual', primaryEmotion: 'warm', intensity: 1.1 }), false);
  assert.equal(validateEmotionConfig({ mode: 'auto', intensity: 0.5, action: 'camera.shake' }), false);
  assert.deepEqual(normalizeEmotionConfig({ mode: 'manual', primaryEmotion: 'hope', intensity: 0.666 }), {
    mode: 'manual', primaryEmotion: 'hope', intensity: 0.67,
  });
});

test('emotion persistence is optional and derives schema enums from canonical config', () => {
  const modePath = GalaxyModel.schema.path('emotionConfig.mode');
  const emotionPath = GalaxyModel.schema.path('emotionConfig.primaryEmotion');
  assert.deepEqual(modePath.enumValues, ['auto', 'manual']);
  assert.deepEqual(emotionPath.enumValues.filter(Boolean), [...EMOTION_KEYS]);
  assert.equal(GalaxyModel.schema.path('emotionConfig').defaultValue, undefined);
});

test('emotion mutation scopes ownership and enables query validators', async () => {
  const original = GalaxyModel.findOneAndUpdate;
  let observed;
  GalaxyModel.findOneAndUpdate = async (filter, update, options) => {
    observed = { filter, update, options };
    return { emotionConfig: update.$set.emotionConfig };
  };
  try {
    const result = await GalaxyService.updateEmotionConfig({
      galaxyId: 'galaxy-1', userId: 'user-1',
      emotionConfig: { mode: 'auto', primaryEmotion: 'wonder', intensity: 0.8 },
    });
    assert.deepEqual(result, { mode: 'auto', primaryEmotion: 'wonder', intensity: 0.8 });
    assert.deepEqual(observed.filter, { _id: 'galaxy-1', userId: 'user-1' });
    assert.deepEqual(observed.update, { $set: { emotionConfig: result } });
    assert.equal(observed.options.runValidators, true);
    assert.equal(observed.options.context, 'query');
  } finally {
    GalaxyModel.findOneAndUpdate = original;
  }
});

test('manual chapter override is ownership-scoped, bounded and optional', async () => {
  const original = GalaxyModel.findOneAndUpdate;
  let observed;
  GalaxyModel.findOneAndUpdate = async (filter, update, options) => {
    observed = { filter, update, options };
    return { chapters: [{ id: 'memory', emotion: 'melancholy', intensity: 0.8 }] };
  };
  try {
    const chapter = await GalaxyService.updateChapterEmotion({
      galaxyId: 'galaxy-1', userId: 'user-1', chapterId: 'memory',
      data: { emotion: 'melancholy', intensity: 0.8 },
    });
    assert.equal(chapter.emotion, 'melancholy');
    assert.deepEqual(observed.filter, { _id: 'galaxy-1', userId: 'user-1', 'chapters.id': 'memory' });
    assert.deepEqual(observed.update.$set, {
      'chapters.$.emotion': 'melancholy', 'chapters.$.intensity': 0.8,
    });
    assert.equal(observed.options.runValidators, true);
    await assert.rejects(
      GalaxyService.updateChapterEmotion({
        galaxyId: 'galaxy-1', userId: 'user-1', chapterId: 'memory',
        data: { emotion: 'javascript.eval', intensity: 0.8 },
      }),
      /Invalid chapter emotion/,
    );
  } finally {
    GalaxyModel.findOneAndUpdate = original;
  }
});

test('ordinary Story edits preserve manual emotion overrides and ignore nested override input', async () => {
  const originalFindOne = GalaxyModel.findOne;
  const originalUpdate = GalaxyModel.findByIdAndUpdate;
  let storedUpdate;
  GalaxyModel.findOne = async () => ({
    storyType: 'couple', occasion: 'anniversary',
    chapters: [{ id: 'intro', hookText: 'Old', emotion: 'nostalgia', intensity: 0.78 }],
  });
  GalaxyModel.findByIdAndUpdate = async (_id, update) => {
    storedUpdate = update;
    return update;
  };
  try {
    await GalaxyService.updateGalaxy({
      galaxyId: 'galaxy-1', userId: 'user-1', user: { role: 'admin' },
      data: { chapters: [{ id: 'intro', hookText: '  New hook  ', emotion: 'wonder', intensity: 0.1 }] },
    });
    assert.deepEqual(storedUpdate.chapters, [{
      id: 'intro', hookText: 'New hook', emotion: 'nostalgia', intensity: 0.78,
    }]);
  } finally {
    GalaxyModel.findOne = originalFindOne;
    GalaxyModel.findByIdAndUpdate = originalUpdate;
  }
});

test('emotion API is authenticated and public view only projects normalized config', () => {
  const routes = fs.readFileSync(path.join(__dirname, '../routes/galaxies.routes.js'), 'utf8');
  const service = fs.readFileSync(path.join(__dirname, '../services/galaxy.service.js'), 'utf8');
  assert.match(routes, /router\.patch\("\/:id\/emotion", requireAuth/);
  assert.match(routes, /router\.patch\("\/:id\/chapters\/:chapterId\/emotion", requireAuth/);
  assert.match(service, /findOneAndUpdate\(\s*\{ _id: galaxyId, userId \}/);
  assert.match(service, /emotionConfig: galaxy\.emotionConfig \? normalizeEmotionConfig/);
  assert.doesNotMatch(service, /emotionConfig:\s*data\.emotionConfig/);
});

test('emotion-first workspace persists intent and previews through the shared Director', () => {
  const page = fs.readFileSync(path.join(__dirname, '../public/portal/story-setup.html'), 'utf8');
  const setup = fs.readFileSync(path.join(__dirname, '../public/portal/js/story-setup.js'), 'utf8');
  assert.match(page, /id="emotion-director"/);
  assert.match(page, /id="emotion-auto"/);
  assert.match(page, /id="emotion-intensity"/);
  assert.match(page, /id="emotion-preview"[^>]+hidden/);
  assert.match(page, /id="emotion-finish"/);
  assert.match(page, /class="story-mobile-tabs" role="tablist"/);
  assert.match(page, /id="story-panel" data-mobile-section="story"/);
  assert.ok(page.indexOf('id="story-mobile-story-tab"') < page.indexOf('id="story-mobile-emotion-tab"'));
  assert.match(page, /id="story-mobile-emotion-tab"[^>]+disabled/);
  assert.match(page, /id="emotion-director" class="emotion-director" hidden/);
  assert.match(page, /#preview-pane\.has-photo #se-bottom/);
  assert.ok(page.indexOf('/shared/js/storyEmotionEngine.js') < page.indexOf('./js/story-setup.js'));
  assert.match(setup, /fetch\('\/media\/story-emotions'\)/);
  assert.match(setup, /fetch\(`\/galaxies\/\$\{galaxyId\}\/emotion`/);
  assert.match(setup, /buildEmotionalChapterTimeline\(/);
  assert.match(setup, /buildExperiencePlan\(/);
  assert.match(setup, /directScenePhotos\(/);
  assert.match(setup, /async function persistAndRunEmotionPreview\(\)/);
  assert.match(setup, /Story Emotion Selected[\s\S]+await persistAndRunEmotionPreview\(\)/);
  assert.match(setup, /for \(let index = 0; index < directedChapters\.length; index \+= 1\)/);
  assert.match(setup, /window\.setPreviewPhotoUrls\?\.\(sceneUrls, \{/);
  assert.match(setup, /direction\.role === 'ending'/);
  assert.match(setup, /Story Emotion Preview Completed/);
  assert.match(page, /preview-memory-frame/);
  ['embrace', 'duet', 'archive', 'stillness', 'orbit', 'ascent'].forEach(profile => {
    assert.match(page, new RegExp(`preview-scene-${profile}`));
  });
  assert.match(page, /resolveSceneFrameLayout\(composition, sceneUrls\.length\)/);
  assert.match(page, /preview-scene-directed/);
  assert.doesNotMatch(page, /setInterval\(\(\) =>/);
  assert.match(setup, /new window\.LumoraStoryEmotion\.TimelineScheduler/);
  assert.match(setup, /Story Emotion Selected/);
  assert.match(setup, /Story Emotion Intensity Changed/);
  assert.match(setup, /Story Emotion Auto Enabled/);
  assert.match(setup, /await saveStoryMeta\(selectedOccasion\);\s+await continueToEmotionStep/);
  assert.match(setup, /function makeEmotionStepAvailable/);
  assert.match(setup, /if \(!emotionConfigPersisted\) await persistEmotionConfig\(\)/);
  assert.doesNotMatch(page, /name="seEffect"|id="seEffect"/);
});

test('Story and both Universes share allowlisted emotion direction and handoff', () => {
  const story = fs.readFileSync(path.join(__dirname, '../public/story/js/story.js'), 'utf8');
  const storyPage = fs.readFileSync(path.join(__dirname, '../public/story/index.html'), 'utf8');
  const galaxy = fs.readFileSync(path.join(__dirname, '../public/galaxy-moon/js/script.js'), 'utf8');
  const galaxyPage = fs.readFileSync(path.join(__dirname, '../public/galaxy-moon/index.html'), 'utf8');
  const fall = fs.readFileSync(path.join(__dirname, '../public/fall/js/fall.js'), 'utf8');
  const fallPage = fs.readFileSync(path.join(__dirname, '../public/fall/index.html'), 'utf8');
  assert.match(story, /buildExperiencePlan\(/);
  assert.match(story, /directScenePhotos\(/);
  assert.match(story, /buildEmotionalChapterTimeline\(/);
  assert.match(story, /saveExperienceHandoff\(sessionStorage/);
  assert.match(story, /Viewer Story Started/);
  assert.match(story, /Viewer Story Replayed/);
  assert.match(story, /Viewer Story Abandoned/);
  assert.match(story, /Viewer Story Completed/);
  assert.match(storyPage, /id="se-environment-overlay"/);
  assert.match(storyPage, /id="se-memory-camera"/);
  assert.match(storyPage, /id="se-memory-frames"/);
  ['embrace', 'duet', 'archive', 'stillness', 'orbit', 'ascent'].forEach(profile => {
    assert.match(storyPage, new RegExp(`scene-${profile}`));
  });
  assert.match(story, /resolveSceneFrameLayout\(safeComposition, scenePhotoUrls\.length\)/);
  assert.match(storyPage, /scene-directed/);
  assert.match(storyPage, /id="se-intro-message"/);
  assert.match(storyPage, /id="se-finale-memory"/);
  assert.match(story, /resolveOpeningMessage\(view\.caption/);
  assert.match(story, /waitForFinaleAction\(\{ autoAdvance: !experiencePlan \}\)/);
  assert.match(story, /buildMemoryScene\(scenePhotoUrls, direction\.composition/);
  assert.match(story, /echoPhotoUrls: rememberedPhotos/);
  assert.doesNotMatch(storyPage, /id="se-photo-dots"/);
  [galaxyPage, fallPage].forEach(page => assert.match(page, /\/shared\/js\/storyEmotionEngine\.js/));
  [galaxy, fall].forEach(viewer => {
    assert.match(viewer, /consumeExperienceHandoff\(sessionStorage/);
    assert.match(viewer, /createUniverseOpeningTimeline\(/);
    assert.match(viewer, /Viewer Emotion Handoff Applied/);
  });
});
