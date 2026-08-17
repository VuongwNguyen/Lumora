(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LumoraStoryEmotion = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ACTION_TYPES = Object.freeze([
    'camera.pushIn', 'camera.pullOut', 'camera.pan', 'camera.orbit', 'camera.drift', 'camera.freeze', 'camera.shake',
    'image.fadeIn', 'image.fadeOut', 'image.blur', 'image.focus', 'image.desaturate', 'image.saturate', 'image.zoom', 'image.parallax', 'image.dim',
    'text.reveal', 'text.fade', 'text.typewriter', 'text.wordReveal', 'text.hold', 'text.disappear',
    'audio.fadeIn', 'audio.fadeOut', 'audio.duck', 'audio.restore', 'audio.swell', 'audio.pause',
    'effect.start', 'effect.stop', 'effect.intensity', 'effect.fadeIn', 'effect.fadeOut',
    'environment.dim', 'environment.brighten', 'environment.blackout', 'environment.freeze', 'environment.breathe',
    'wait', 'hold', 'pause', 'silence', 'delay',
  ]);
  const ACTION_TYPE_SET = new Set(ACTION_TYPES);
  const CAMERA_MOVEMENT_ACTIONS = new Set(['camera.pushIn', 'camera.pullOut', 'camera.pan', 'camera.orbit', 'camera.drift', 'camera.shake']);
  const EMOTION_SCENE_PROFILES = new Set(['embrace', 'duet', 'archive', 'stillness', 'orbit', 'ascent']);
  const MEDIA_STRATEGIES = new Set(['anchor-first', 'bookend-pair', 'chronological', 'isolate-last', 'center-reveal', 'forward-rise']);
  const NUMBER_PARAM_RULES = Object.freeze({
    duration: Object.freeze({ min: 0, max: 30000 }),
    intensity: Object.freeze({ min: 0, max: 1 }),
    volume: Object.freeze({ min: 0, max: 1 }),
  });
  const ACTION_PARAM_KEYS = Object.freeze({
    'camera.pushIn': ['duration', 'intensity'],
    'camera.pullOut': ['duration', 'intensity'],
    'camera.pan': ['duration', 'intensity'],
    'camera.orbit': ['duration', 'intensity'],
    'camera.drift': ['duration', 'intensity'],
    'camera.freeze': ['duration'],
    'camera.shake': ['duration', 'intensity'],
    'image.fadeIn': ['duration'],
    'image.fadeOut': ['duration'],
    'image.blur': ['duration', 'intensity'],
    'image.desaturate': ['duration', 'intensity'],
    'image.saturate': ['duration', 'intensity'],
    'image.focus': ['duration', 'intensity'],
    'image.zoom': ['duration', 'intensity'],
    'image.parallax': ['duration', 'intensity'],
    'image.dim': ['duration', 'intensity'],
    'text.reveal': ['duration'],
    'text.fade': ['duration'],
    'text.typewriter': ['duration'],
    'text.wordReveal': ['duration'],
    'text.hold': ['duration'],
    'text.disappear': ['duration'],
    'audio.fadeIn': ['duration', 'volume'],
    'audio.fadeOut': ['duration'],
    'audio.duck': ['duration', 'volume'],
    'audio.restore': ['duration'],
    'audio.swell': ['duration', 'intensity'],
    'audio.pause': [],
    'effect.start': [],
    'effect.stop': [],
    'effect.intensity': ['intensity'],
    'effect.fadeIn': ['duration'],
    'effect.fadeOut': ['duration'],
    'environment.dim': ['duration', 'intensity'],
    'environment.brighten': ['duration', 'intensity'],
    'environment.blackout': ['duration'],
    'environment.freeze': ['duration'],
    'environment.breathe': ['duration', 'intensity'],
    wait: ['duration'],
    hold: ['duration'],
    pause: ['duration'],
    silence: ['duration'],
    delay: ['duration'],
  });
  const REQUIRED_ACTION_PARAMS = Object.freeze({
    'camera.pushIn': ['intensity'],
    'camera.pullOut': ['intensity'],
    'camera.pan': ['intensity'],
    'camera.orbit': ['intensity'],
    'camera.drift': ['intensity'],
    'camera.shake': ['intensity'],
    'image.blur': ['intensity'],
    'image.desaturate': ['intensity'],
    'image.saturate': ['intensity'],
    'image.zoom': ['intensity'],
    'image.parallax': ['intensity'],
    'image.dim': ['intensity'],
    'audio.swell': ['intensity'],
    'effect.intensity': ['intensity'],
    'environment.dim': ['intensity'],
    'environment.brighten': ['intensity'],
    'environment.breathe': ['intensity'],
    hold: ['duration'],
    'text.hold': ['duration'],
    wait: ['duration'],
    pause: ['duration'],
    silence: ['duration'],
    delay: ['duration'],
  });
  const CAPABILITIES = Object.freeze({
    story: Object.freeze([
      'camera.pushIn', 'camera.pullOut', 'camera.drift', 'camera.freeze',
      'image.fadeIn', 'image.fadeOut', 'image.desaturate', 'image.focus',
      'text.reveal', 'text.fade', 'text.hold', 'text.disappear',
      'audio.fadeIn', 'audio.fadeOut', 'audio.duck', 'audio.restore', 'audio.swell', 'audio.pause',
      'effect.start', 'effect.stop', 'effect.intensity', 'effect.fadeIn', 'effect.fadeOut',
      'environment.dim', 'environment.brighten', 'environment.blackout',
      'wait', 'hold', 'pause', 'silence', 'delay',
    ]),
    galaxy: Object.freeze([
      'camera.pushIn', 'camera.pullOut', 'camera.orbit', 'camera.drift', 'camera.freeze',
      'audio.fadeIn', 'audio.duck', 'audio.restore', 'audio.swell',
      'environment.dim', 'environment.brighten', 'environment.freeze', 'environment.breathe',
      'wait', 'hold', 'pause', 'silence', 'delay',
    ]),
    fall: Object.freeze([
      'camera.pushIn', 'camera.drift', 'camera.freeze',
      'audio.fadeIn', 'audio.duck', 'audio.restore', 'audio.swell',
      'environment.dim', 'environment.brighten', 'environment.freeze', 'environment.breathe',
      'wait', 'hold', 'pause', 'silence', 'delay',
    ]),
  });

  function isPlainObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function boundedNumber(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function normalizeActionParams(type, params = {}) {
    if (!isPlainObject(params)) throw new TypeError('Timeline action.params must be an object');
    const allowedKeys = ACTION_PARAM_KEYS[type] || [];
    const requiredKeys = REQUIRED_ACTION_PARAMS[type] || [];
    for (const key of Object.keys(params)) {
      if (!allowedKeys.includes(key)) throw new TypeError(`Unsupported parameter ${key} for ${type}`);
    }
    for (const key of requiredKeys) {
      if (!Object.hasOwn(params, key)) throw new TypeError(`Missing parameter ${key} for ${type}`);
    }
    return Object.fromEntries(Object.entries(params).map(([key, value]) => {
      const rule = NUMBER_PARAM_RULES[key];
      if (!rule || !Number.isFinite(value) || value < rule.min || value > rule.max) {
        throw new TypeError(`Invalid parameter ${key} for ${type}`);
      }
      return [key, value];
    }));
  }

  function validateAction(action) {
    if (!isPlainObject(action)) throw new TypeError('Timeline action must be an object');
    if (!ACTION_TYPE_SET.has(action.type)) throw new TypeError(`Unsupported timeline action: ${String(action.type)}`);
    if (!Number.isFinite(action.at) || action.at < 0) throw new TypeError('Timeline action.at must be a non-negative number');
    return {
      at: action.at,
      type: action.type,
      params: normalizeActionParams(action.type, action.params),
    };
  }

  function normalizeTimeline(timeline) {
    if (!isPlainObject(timeline)) throw new TypeError('Timeline must be an object');
    if (!Number.isFinite(timeline.duration) || timeline.duration < 0) {
      throw new TypeError('Timeline duration must be a non-negative number');
    }
    if (!Array.isArray(timeline.actions)) throw new TypeError('Timeline actions must be an array');
    const actions = timeline.actions.map(validateAction)
      .map((action, index) => ({ ...action, _order: index }))
      .sort((left, right) => left.at - right.at || left._order - right._order)
      .map(({ _order, ...action }) => action);
    if (actions.some(action => action.at > timeline.duration)) {
      throw new TypeError('Timeline action cannot occur after timeline duration');
    }
    return { duration: timeline.duration, actions };
  }

  function applyReducedMotion(timeline, enabled = true) {
    const normalized = normalizeTimeline(timeline);
    if (!enabled) return normalized;
    return {
      duration: normalized.duration,
      actions: normalized.actions.map((action) => {
        if (CAMERA_MOVEMENT_ACTIONS.has(action.type)) {
          return {
            at: action.at,
            type: 'camera.freeze',
            params: Number.isFinite(action.params.duration) ? { duration: action.params.duration } : {},
          };
        }
        if (action.type === 'effect.intensity') {
          return {
            ...action,
            params: {
              ...action.params,
              intensity: Math.round(boundedNumber(action.params.intensity, 0, 1, 1) * 350) / 1000,
            },
          };
        }
        return action;
      }),
    };
  }

  function emotionFromCatalog(catalog, emotionId) {
    if (!isPlainObject(catalog) || !Array.isArray(catalog.emotions)) return null;
    return catalog.emotions.find(emotion => emotion?.id === emotionId) || null;
  }

  function normalizeEmotionConfig(config, catalog) {
    const fallback = isPlainObject(catalog?.defaultConfig)
      ? catalog.defaultConfig
      : { mode: 'auto', primaryEmotion: null, intensity: 0.65 };
    const mode = config?.mode === 'manual' ? 'manual' : 'auto';
    const requestedEmotion = typeof config?.primaryEmotion === 'string' ? config.primaryEmotion : null;
    const primaryEmotion = emotionFromCatalog(catalog, requestedEmotion) ? requestedEmotion : null;
    return {
      mode,
      primaryEmotion,
      intensity: Math.round(boundedNumber(config?.intensity, 0, 1, fallback.intensity ?? 0.65) * 100) / 100,
    };
  }

  function resolvePrimaryEmotion(config, catalog, context = {}) {
    const normalized = normalizeEmotionConfig(config, catalog);
    if (normalized.primaryEmotion) return normalized.primaryEmotion;
    const automatic = catalog?.autoByStoryType?.[context.storyType];
    if (emotionFromCatalog(catalog, automatic)) return automatic;
    if (normalized.primaryEmotion) return normalized.primaryEmotion;
    return catalog?.emotions?.[0]?.id || null;
  }

  function resolveChapterRoles(chapters, rules = {}) {
    const realized = Array.isArray(chapters) ? chapters.filter(chapter => chapter && chapter.id) : [];
    if (realized.length === 0) return [];
    if (realized.length === 1) return [{ chapterId: realized[0].id, role: 'climax' }];
    const explicitIds = Array.isArray(rules.explicitClimaxChapterIds) ? rules.explicitClimaxChapterIds : ['highlight'];
    const explicitHighlight = realized.findIndex(chapter => explicitIds.includes(chapter.id));
    const climaxIndex = explicitHighlight >= 0
      ? explicitHighlight
      : Math.max(1, Math.min(realized.length - 2, Math.round((realized.length - 1) * boundedNumber(rules.climaxPosition, 0.4, 0.85, 0.68))));
    return realized.map((chapter, index) => {
      let role;
      if (index === 0) role = 'intro';
      else if (index === realized.length - 1) role = 'ending';
      else if (index === climaxIndex) role = 'climax';
      else if (index < climaxIndex - 1) role = 'build';
      else if (index < climaxIndex) role = 'memory';
      else if (index === climaxIndex + 1) role = 'release';
      else role = 'shift';
      return { chapterId: chapter.id, role };
    });
  }

  function resolveSceneComposition(role, photoCount = 1, sceneProfile = null) {
    const count = Math.max(1, Math.floor(Number(photoCount) || 1));
    if (EMOTION_SCENE_PROFILES.has(sceneProfile)) return sceneProfile;
    if (role === 'ending') return 'horizon';
    if (count === 1) return 'spotlight';
    const compositionByRole = {
      intro: 'spotlight',
      build: 'constellation',
      memory: 'constellation',
      shift: 'cascade',
      climax: 'crescendo',
      release: 'cascade',
      ending: 'horizon',
    };
    return compositionByRole[role] || 'constellation';
  }

  function directScenePhotos(photoUrls, mediaStrategy = 'chronological') {
    const urls = Array.isArray(photoUrls) ? [...photoUrls] : [];
    if (urls.length < 2 || !MEDIA_STRATEGIES.has(mediaStrategy)) return urls;
    if (mediaStrategy === 'bookend-pair' && urls.length > 2) {
      return [urls[0], urls.at(-1), ...urls.slice(1, -1)];
    }
    if (mediaStrategy === 'isolate-last') {
      return [urls.at(-1), ...urls.slice(0, -1)];
    }
    if (mediaStrategy === 'center-reveal' && urls.length > 2) {
      return [urls[0], urls[1], urls.at(-1), ...urls.slice(2, -1)];
    }
    return urls;
  }

  function resolveSceneFrameLayout(sceneProfile, photoCount = 1) {
    if (!EMOTION_SCENE_PROFILES.has(sceneProfile)) return [];
    const count = Math.max(1, Math.min(6, Math.floor(Number(photoCount) || 1)));
    const frame = (x, y, width, height, rotate = 0, opacity = 1, z = 1) => ({
      x, y, width, height, rotate, opacity, z,
    });
    const centered = () => [frame(50, 46, 46, 66, 0, 1, 4)];

    if (sceneProfile === 'embrace') {
      if (count === 1) return centered();
      if (count === 2) return [
        frame(42, 47, 36, 58, -2, 1, 4),
        frame(70, 49, 24, 44, 4, 0.82, 2),
      ];
      const satelliteSlots = count === 3
        ? [[18, 47], [82, 47]]
        : count === 4
          ? [[18, 45], [82, 45], [50, 9]]
          : [[18, 29], [82, 29], [18, 69], [82, 69], [50, 9]];
      return [frame(50, 48, 40, 56, 0, 1, 4)].concat(
        satelliteSlots.slice(0, count - 1).map(([x, y], index) => (
          frame(x, y, y < 12 ? 18 : 21, y < 12 ? 17 : 30, x < 50 ? -4 : x > 50 ? 4 : 0, 0.72, 2)
        )),
      );
    }

    if (sceneProfile === 'duet') {
      if (count === 1) return centered();
      if (count === 2) return [
        frame(31, 48, 31, 58, -2, 1, 3),
        frame(69, 48, 31, 58, 2, 1, 3),
      ];
      const detailSlots = count === 3
        ? [[50, 12]]
        : count === 4
          ? [[38, 12], [62, 12]]
          : [[29, 12], [50, 12], [71, 12], [50, 86]];
      return [
        frame(29, 50, 29, 48, -2, 1, 3),
        frame(71, 50, 29, 48, 2, 1, 3),
        ...detailSlots.slice(0, count - 2).map(([x, y], index) => (
          frame(x, y, 16, y > 50 ? 18 : 20, index === 0 ? -2 : index === 1 ? 2 : 0, 0.84, 2)
        )),
      ];
    }

    if (sceneProfile === 'archive') {
      if (count === 1) return centered();
      const width = Math.min(30, 84 / count);
      const margin = width / 2 + 2;
      const step = count > 1 ? (100 - margin * 2) / (count - 1) : 0;
      const rotations = [-6, -3.5, -1, 1.5, 4, 6];
      return Array.from({ length: count }, (_, index) => frame(
        margin + step * index,
        46 + (index % 2 === 0 ? -2 : 2),
        width,
        56 - (index % 2) * 3,
        rotations[index],
        0.72 + index * (0.28 / Math.max(1, count - 1)),
        index + 1,
      ));
    }

    if (sceneProfile === 'stillness') {
      if (count === 1) return centered();
      const quietSlots = [[17, 28], [83, 28], [17, 69], [83, 69], [50, 9]];
      return [frame(50, 48, 40, 58, 0, 1, 4)].concat(
        quietSlots.slice(0, count - 1).map(([x, y], index) => (
          frame(x, y, index === 4 ? 17 : 20, index === 4 ? 16 : 28, x < 50 ? -2 : x > 50 ? 2 : 0, 0.46, 1)
        )),
      );
    }

    if (sceneProfile === 'orbit') {
      if (count === 1) return centered();
      const focalIndex = count >= 3 ? 2 : 0;
      const orbitSlots = [[18, 27], [82, 26], [18, 70], [82, 69], [50, 9]];
      let satelliteIndex = 0;
      return Array.from({ length: count }, (_, index) => {
        if (index === focalIndex) return frame(50, 48, 34, 52, 0, 1, 4);
        const [x, y] = orbitSlots[satelliteIndex++];
        return frame(x, y, y < 12 ? 17 : 20, y < 12 ? 16 : 28, x < 50 ? -4 : x > 50 ? 4 : 0, 0.78, 2);
      });
    }

    if (count === 1) return centered();
    const ascentPresets = {
      2: { xs: [33, 67], ys: [62, 34], width: 28, height: 48 },
      3: { xs: [22, 50, 78], ys: [66, 45, 24], width: 23, height: 42 },
      4: { xs: [12, 37, 62, 87], ys: [68, 53, 37, 21], width: 20, height: 38 },
      5: { xs: [8, 29, 50, 71, 92], ys: [69, 56, 43, 30, 17], width: 16, height: 34 },
      6: { xs: [7, 24, 41, 59, 76, 93], ys: [70, 59, 48, 37, 26, 16], width: 14, height: 31 },
    };
    const preset = ascentPresets[count];
    return preset.xs.map((x, index) => frame(
      x, preset.ys[index], preset.width, preset.height,
      -4 + index * (8 / Math.max(1, count - 1)), 0.62 + index * (0.38 / Math.max(1, count - 1)), index + 1,
    ));
  }

  function resolveTimelineCapabilities(timeline, capabilityName = 'story') {
    const normalized = normalizeTimeline(timeline);
    const supported = new Set(Array.isArray(capabilityName) ? capabilityName : (CAPABILITIES[capabilityName] || []));
    const actions = [];
    normalized.actions.forEach((action) => {
      if (supported.has(action.type)) {
        actions.push(action);
        return;
      }
      if (CAMERA_MOVEMENT_ACTIONS.has(action.type) && supported.has('camera.freeze')) {
        actions.push({
          at: action.at,
          type: 'camera.freeze',
          params: Number.isFinite(action.params.duration) ? { duration: action.params.duration } : {},
        });
      }
    });
    return normalizeTimeline({ duration: normalized.duration, actions });
  }

  function resolveCameraDirection(baseCamera, role, photoIndex = 0) {
    const index = Math.max(0, Math.floor(Number(photoIndex) || 0));
    if (role === 'shift') return 'camera.freeze';
    if (role === 'intro') return baseCamera === 'camera.freeze' ? baseCamera : 'camera.drift';
    if (role === 'ending') return baseCamera === 'camera.freeze' ? baseCamera : 'camera.pullOut';
    if (role === 'climax') {
      const climaxPattern = baseCamera === 'camera.freeze'
        ? ['camera.freeze', 'camera.pushIn', 'camera.freeze']
        : ['camera.pushIn', 'camera.drift', 'camera.pullOut'];
      return climaxPattern[index % climaxPattern.length];
    }
    if (index % 3 === 1 && baseCamera !== 'camera.freeze') return 'camera.drift';
    if (index % 3 === 2) {
      if (baseCamera === 'camera.pushIn') return 'camera.pullOut';
      if (baseCamera === 'camera.pullOut') return 'camera.pushIn';
    }
    return baseCamera;
  }

  function buildEmotionalPhotoTimeline(options = {}) {
    const catalog = options.catalog;
    const emotionConfig = normalizeEmotionConfig(options.emotionConfig, catalog);
    const emotionId = resolvePrimaryEmotion(emotionConfig, catalog, options.context);
    const emotion = emotionFromCatalog(catalog, emotionId);
    if (!emotion?.director) return createLegacyPhotoTimeline({ firstPhoto: Boolean(options.firstPhoto) });
    const director = emotion.director;
    const role = catalog?.roles?.[options.role] ? options.role : 'memory';
    const roleMultiplier = boundedNumber(catalog?.roles?.[role]?.intensityMultiplier, 0.4, 1.5, 1);
    const intensity = emotionConfig.intensity;
    const sceneDepthMultiplier = options.sceneMode
      ? 1 + Math.min(0.5, Math.max(0, (Math.floor(Number(options.photoCount) || 1) - 1) * 0.1))
      : 1;
    const fadeDuration = Math.round(boundedNumber(director.fade, 200, 5000, 1000));
    const holdDuration = Math.round(
      boundedNumber(director.hold, 1200, 12000, 4800)
      * boundedNumber(director.pace, 0.6, 1.6, 1)
      * (0.86 + intensity * 0.28)
      * roleMultiplier
      * sceneDepthMultiplier,
    );
    const silenceDuration = Math.round(
      boundedNumber(director.silence, 0, 3000, 0)
      * (role === 'memory' || role === 'shift' ? 1 : 0),
    );
    const duration = fadeDuration + holdDuration + silenceDuration;
    const actions = [
      { at: 0, type: 'image.fadeIn', params: { duration: fadeDuration } },
      { at: 0, type: 'effect.start', params: {} },
      { at: 0, type: 'effect.intensity', params: { intensity: Math.round(boundedNumber(boundedNumber(director.effectIntensity, 0, 1, 0.5) * intensity * roleMultiplier, 0, 1, 0.5) * 1000) / 1000 } },
      { at: fadeDuration, type: 'hold', params: { duration: holdDuration } },
      { at: duration, type: 'image.fadeOut', params: { duration: fadeDuration } },
    ];
    const configuredCamera = ACTION_TYPE_SET.has(director.camera) ? director.camera : 'camera.freeze';
    const cameraType = resolveCameraDirection(configuredCamera, role, options.photoIndex);
    actions.push({
      at: Math.min(250, fadeDuration), type: cameraType,
      params: cameraType === 'camera.freeze'
        ? { duration: holdDuration }
        : { duration: holdDuration, intensity: Math.round(boundedNumber(boundedNumber(director.cameraIntensity, 0, 1, 0.15) * intensity * roleMultiplier, 0, 1, 0.15) * 1000) / 1000 },
    });
    if (ACTION_TYPE_SET.has(director.environment)) {
      actions.push({
        at: 0, type: director.environment,
        params: { duration: fadeDuration, intensity: Math.round(boundedNumber(director.environmentIntensity, 0, 1, 0.2) * intensity * 1000) / 1000 },
      });
    }
    if (Number.isFinite(director.desaturate) && director.desaturate > 0) {
      actions.push({
        at: 0, type: 'image.desaturate',
        params: { duration: fadeDuration, intensity: Math.round(boundedNumber(director.desaturate, 0, 1, 0) * intensity * 1000) / 1000 },
      });
    }
    let audioType = ACTION_TYPE_SET.has(director.audio) ? director.audio : 'audio.restore';
    if (role === 'climax') audioType = 'audio.swell';
    if (role === 'ending') audioType = 'audio.restore';
    const audioParams = { duration: Math.min(1800, fadeDuration) };
    if (audioType === 'audio.swell') audioParams.intensity = Math.round(boundedNumber(intensity * roleMultiplier, 0, 1, intensity) * 1000) / 1000;
    actions.push({ at: 0, type: audioType, params: audioParams });
    if (options.firstPhoto) {
      const revealAt = Math.min(fadeDuration, Math.round(duration * 0.18));
      const fadeAt = Math.max(revealAt + 1200, duration - fadeDuration);
      actions.push(
        { at: revealAt, type: 'text.reveal', params: { duration: Math.min(1200, fadeDuration) } },
        { at: fadeAt, type: 'text.fade', params: { duration: Math.min(1000, fadeDuration) } },
      );
    }
    if (silenceDuration > 0) {
      actions.push({ at: fadeDuration + holdDuration, type: 'silence', params: { duration: silenceDuration } });
    }
    const timeline = normalizeTimeline({ duration, actions });
    return resolveTimelineCapabilities(timeline, options.capabilities || 'story');
  }

  function buildEmotionalChapterTimeline(options = {}) {
    const timeline = buildEmotionalPhotoTimeline({
      ...options,
      firstPhoto: true,
      photoIndex: 0,
      sceneMode: true,
    });
    const revealAt = timeline.actions.find(action => action.type === 'text.reveal')?.at || 0;
    const textReleaseAt = Math.min(
      Math.max(revealAt + 1700, Math.round(timeline.duration * 0.38)),
      Math.max(revealAt + 1200, timeline.duration - 1200),
    );
    return normalizeTimeline({
      duration: timeline.duration,
      actions: timeline.actions.map(action => action.type === 'text.fade'
        ? { ...action, at: textReleaseAt }
        : action),
    });
  }

  function buildExperiencePlan(options = {}) {
    const roles = resolveChapterRoles(options.chapters, options.catalog?.directorRules);
    const emotionConfig = normalizeEmotionConfig(options.emotionConfig, options.catalog);
    const primaryEmotion = resolvePrimaryEmotion(emotionConfig, options.catalog, options.context);
    const emotion = emotionFromCatalog(options.catalog, primaryEmotion);
    return {
      version: 2,
      primaryEmotion,
      intensity: emotionConfig.intensity,
      effect: emotion?.effect || 'none',
      accent: emotion?.accent || null,
      chapters: roles.map((role) => {
        const chapter = options.chapters.find(item => item.id === role.chapterId) || {};
        const overrideEmotion = emotionConfig.mode === 'manual' && emotionFromCatalog(options.catalog, chapter.emotion)
          ? chapter.emotion
          : null;
        const curveDirection = options.catalog?.directorRules?.emotionCurves?.[primaryEmotion]?.[role.role];
        const curveEmotion = emotionFromCatalog(options.catalog, curveDirection?.emotion)
          ? curveDirection.emotion
          : primaryEmotion;
        const chapterEmotionId = overrideEmotion || curveEmotion;
        const chapterEmotion = emotionFromCatalog(options.catalog, chapterEmotionId) || emotion;
        const chapterIntensity = overrideEmotion
          ? boundedNumber(chapter.intensity, 0, 1, emotionConfig.intensity)
          : emotionConfig.intensity * boundedNumber(curveDirection?.intensityMultiplier, 0.25, 1.4, 1);
        return {
          ...role,
          composition: resolveSceneComposition(role.role, chapter.photoCount, chapterEmotion?.director?.sceneProfile),
          mediaStrategy: MEDIA_STRATEGIES.has(chapterEmotion?.director?.mediaStrategy)
            ? chapterEmotion.director.mediaStrategy
            : 'chronological',
          emotion: chapterEmotionId,
          intensity: Math.round(boundedNumber(chapterIntensity, 0, 1, emotionConfig.intensity) * 100) / 100,
        };
      }),
    };
  }

  function createUniverseOpeningTimeline(options = {}) {
    const emotion = emotionFromCatalog(options.catalog, options.primaryEmotion);
    const director = emotion?.director || {};
    const duration = 4200;
    const camera = ACTION_TYPE_SET.has(director.camera) ? director.camera : 'camera.freeze';
    const environment = ACTION_TYPE_SET.has(director.environment) ? director.environment : 'environment.brighten';
    const actions = [
      { at: 0, type: 'audio.restore', params: { duration: 1600 } },
      { at: 0, type: environment, params: { duration: 2400, intensity: boundedNumber(director.environmentIntensity, 0, 1, 0.25) } },
      { at: 200, type: camera, params: camera === 'camera.freeze' ? { duration } : { duration, intensity: boundedNumber(director.cameraIntensity, 0, 1, 0.18) } },
      { at: 2400, type: 'hold', params: { duration: 1800 } },
    ];
    return resolveTimelineCapabilities({ duration, actions }, options.template || 'galaxy');
  }

  function handoffKey(galaxyId) {
    return `lumora:experience-handoff:${String(galaxyId || '')}`;
  }

  function saveExperienceHandoff(storage, galaxyId, value, now = Date.now()) {
    if (!storage || !galaxyId || !value) return false;
    const payload = {
      version: 1,
      primaryEmotion: String(value.primaryEmotion || ''),
      intensity: boundedNumber(value.intensity, 0, 1, 0.65),
      createdAt: now,
    };
    try {
      storage.setItem(handoffKey(galaxyId), JSON.stringify(payload));
      return true;
    } catch { return false; }
  }

  function consumeExperienceHandoff(storage, galaxyId, now = Date.now(), allowedEmotions = null) {
    if (!storage || !galaxyId) return null;
    const key = handoffKey(galaxyId);
    try {
      const raw = storage.getItem(key);
      storage.removeItem(key);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      if (!isPlainObject(payload) || payload.version !== 1 || typeof payload.primaryEmotion !== 'string') return null;
      if (!/^[a-z][a-z_]{1,31}$/.test(payload.primaryEmotion)) return null;
      if (Array.isArray(allowedEmotions) && !allowedEmotions.includes(payload.primaryEmotion)) return null;
      if (!Number.isFinite(payload.createdAt) || now - payload.createdAt < 0 || now - payload.createdAt > 10 * 60 * 1000) return null;
      return {
        version: 1,
        primaryEmotion: payload.primaryEmotion,
        intensity: boundedNumber(payload.intensity, 0, 1, 0.65),
      };
    } catch { return null; }
  }

  function defaultClock() {
    return {
      now: () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now()),
      setTimeout: (callback, delay) => setTimeout(callback, delay),
      clearTimeout: timerId => clearTimeout(timerId),
    };
  }

  class TimelineScheduler {
    constructor(executor, options = {}) {
      const execute = typeof executor === 'function' ? executor : executor?.execute?.bind(executor);
      if (typeof execute !== 'function') throw new TypeError('TimelineScheduler requires an action executor');
      this.execute = execute;
      this.onError = typeof options.onError === 'function' ? options.onError : () => {};
      this.clock = options.clock || defaultClock();
      this.state = 'idle';
      this.timeline = null;
      this.elapsed = 0;
      this.startedAt = 0;
      this.executed = new Set();
      this.timers = new Set();
      this.resolvePlay = null;
      this.destroyed = false;
    }

    _clearTimers() {
      this.timers.forEach(timerId => this.clock.clearTimeout(timerId));
      this.timers.clear();
    }

    _runAction(action, index) {
      if (this.executed.has(index) || this.state !== 'running') return;
      this.executed.add(index);
      try {
        Promise.resolve(this.execute(action)).catch(error => this.onError(error, action));
      } catch (error) {
        this.onError(error, action);
      }
    }

    _schedule() {
      this._clearTimers();
      this.startedAt = this.clock.now();
      this.timeline.actions.forEach((action, index) => {
        if (this.executed.has(index)) return;
        const delay = Math.max(0, action.at - this.elapsed);
        const timerId = this.clock.setTimeout(() => {
          this.timers.delete(timerId);
          this._runAction(action, index);
        }, delay);
        this.timers.add(timerId);
      });
      const completionDelay = Math.max(0, this.timeline.duration - this.elapsed);
      const completionTimer = this.clock.setTimeout(() => {
        this.timers.delete(completionTimer);
        if (this.state === 'running') this._complete('completed');
      }, completionDelay);
      this.timers.add(completionTimer);
    }

    _complete(status) {
      this._clearTimers();
      if (status === 'completed' || status === 'skipped') {
        this.elapsed = this.timeline?.duration || this.elapsed;
      }
      this.state = status;
      const resolve = this.resolvePlay;
      this.resolvePlay = null;
      if (resolve) resolve({ status, elapsed: this.elapsed });
    }

    play(timeline) {
      if (this.destroyed) return Promise.reject(new Error('TimelineScheduler has been destroyed'));
      if (this.state === 'running' || this.state === 'paused') this.cancel();
      this.timeline = normalizeTimeline(timeline);
      this.elapsed = 0;
      this.executed.clear();
      this.state = 'running';
      const completion = new Promise(resolve => { this.resolvePlay = resolve; });
      this._schedule();
      return completion;
    }

    pause() {
      if (this.state !== 'running') return false;
      this.elapsed = Math.min(this.timeline.duration, this.elapsed + Math.max(0, this.clock.now() - this.startedAt));
      this._clearTimers();
      this.state = 'paused';
      return true;
    }

    resume() {
      if (this.destroyed || this.state !== 'paused') return false;
      this.state = 'running';
      this._schedule();
      return true;
    }

    skipToEnd() {
      if (this.state !== 'running' && this.state !== 'paused') return false;
      this._clearTimers();
      this.state = 'running';
      this.timeline.actions.forEach((action, index) => this._runAction(action, index));
      this._complete('skipped');
      return true;
    }

    cancel() {
      if (this.state !== 'running' && this.state !== 'paused') return false;
      if (this.state === 'running') {
        this.elapsed = Math.min(this.timeline.duration, this.elapsed + Math.max(0, this.clock.now() - this.startedAt));
      }
      this._complete('cancelled');
      return true;
    }

    destroy() {
      if (this.destroyed) return;
      this.cancel();
      this._clearTimers();
      this.destroyed = true;
      this.state = 'destroyed';
      this.timeline = null;
      this.executed.clear();
    }
  }

  function createSoundscapeRenderer(manager) {
    if (!manager || typeof manager !== 'object') {
      throw new TypeError('Soundscape renderer requires the existing soundscape manager');
    }
    let baselineVolume = null;
    let duckedFrom = null;
    let destroyed = false;

    function currentVolume() {
      const value = Number(manager.audio?.volume);
      return Number.isFinite(value) ? boundedNumber(value, 0, 1, 1) : 1;
    }

    function baseline() {
      if (baselineVolume === null) baselineVolume = currentVolume();
      return baselineVolume;
    }

    function fadeTo(volume, duration) {
      if (destroyed || typeof manager.fadeTo !== 'function') return false;
      return manager.fadeTo(boundedNumber(volume, 0, 1, baseline()), duration || 0);
    }

    return {
      get destroyed() { return destroyed; },
      execute(action) {
        if (destroyed) return false;
        const params = action.params || {};
        switch (action.type) {
          case 'audio.fadeIn':
            return fadeTo(params.volume ?? baseline(), params.duration);
          case 'audio.fadeOut':
            baseline();
            return fadeTo(0, params.duration);
          case 'audio.duck': {
            if (duckedFrom === null) duckedFrom = currentVolume();
            const target = params.volume ?? duckedFrom * 0.45;
            return fadeTo(target, params.duration);
          }
          case 'audio.restore': {
            const target = duckedFrom ?? baseline();
            duckedFrom = null;
            return fadeTo(target, params.duration);
          }
          case 'audio.swell': {
            const source = duckedFrom ?? baseline();
            const target = source + (1 - source) * boundedNumber(params.intensity, 0, 1, 0.25);
            return fadeTo(target, params.duration);
          }
          case 'audio.pause':
            manager.pause?.();
            return true;
          default:
            throw new TypeError(`Soundscape renderer does not support action ${String(action.type)}`);
        }
      },
      destroy() {
        if (destroyed) return;
        manager.cancelVolumeTransition?.();
        destroyed = true;
      },
    };
  }

  function createLegacyPhotoTimeline({ firstPhoto = false } = {}) {
    const holdStartsAt = firstPhoto ? 2500 : 0;
    const holdDuration = firstPhoto ? 5500 : 4500;
    const duration = holdStartsAt + holdDuration;
    const actions = [
      { at: 0, type: 'image.fadeIn', params: { duration: 550 } },
      { at: holdStartsAt, type: 'hold', params: { duration: holdDuration } },
      { at: duration, type: 'image.fadeOut', params: { duration: 550 } },
    ];
    if (firstPhoto) {
      actions.push(
        { at: 0, type: 'audio.restore', params: { duration: 400 } },
        { at: 0, type: 'text.reveal', params: { duration: 550 } },
        { at: 2500, type: 'text.fade', params: { duration: 550 } },
      );
    }
    return normalizeTimeline({ duration, actions });
  }

  return Object.freeze({
    ACTION_TYPES,
    CAPABILITIES,
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
    resolvePrimaryEmotion,
    resolveTimelineCapabilities,
    saveExperienceHandoff,
    validateAction,
  });
});
