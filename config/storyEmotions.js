const EMOTION_MODES = Object.freeze(['auto', 'manual']);
const EMOTION_KEYS = Object.freeze(['warm', 'romantic', 'nostalgia', 'melancholy', 'wonder', 'hope']);

const EMOTIONS = Object.freeze({
  warm: Object.freeze({
    labelVi: 'Ấm áp', labelEn: 'Warm',
    descriptionVi: 'Gần gũi, dịu dàng và có cảm giác được chở che.',
    descriptionEn: 'Close, gentle, and quietly reassuring.',
    openingVi: 'Có những điều bình thường, đến khi nhìn lại mới biết mình đã thương nhiều đến thế.',
    openingEn: 'Some ordinary moments only reveal how much they meant when we look back.',
    closingVi: 'Có những điều trở nên quý giá chỉ vì ta đã cùng đi qua.',
    closingEn: 'Some things become precious simply because we went through them together.',
    accent: '#f4b183', effect: 'firefly',
    director: Object.freeze({ sceneProfile: 'embrace', mediaStrategy: 'anchor-first', pace: 1, fade: 900, hold: 4600, camera: 'camera.pushIn', cameraIntensity: 0.18, effectIntensity: 0.55, audio: 'audio.restore', environment: 'environment.brighten', environmentIntensity: 0.22 }),
  }),
  romantic: Object.freeze({
    labelVi: 'Lãng mạn', labelEn: 'Romantic',
    descriptionVi: 'Mềm mại, thân mật và để từng khoảnh khắc ở lại lâu hơn.',
    descriptionEn: 'Soft, intimate, and willing to let moments linger.',
    openingVi: 'Giữa rất nhiều ngày đã qua, có một người khiến vài khoảnh khắc ở lại lâu hơn.',
    openingEn: 'Among all the days that passed, one person made a few moments stay longer.',
    closingVi: 'Có những người khiến những ngày bình thường trở thành điều ta muốn nhớ mãi.',
    closingEn: 'Some people turn ordinary days into the ones we want to remember forever.',
    accent: '#f09ac0', effect: 'firefly',
    director: Object.freeze({ sceneProfile: 'duet', mediaStrategy: 'bookend-pair', pace: 1.1, fade: 1200, hold: 5200, camera: 'camera.drift', cameraIntensity: 0.16, effectIntensity: 0.62, audio: 'audio.swell', environment: 'environment.dim', environmentIntensity: 0.12 }),
  }),
  nostalgia: Object.freeze({
    labelVi: 'Hoài niệm', labelEn: 'Nostalgia',
    descriptionVi: 'Chậm, sâu và gợi cảm giác đang chạm lại một ký ức cũ.',
    descriptionEn: 'Slow, deep, and shaped like returning to an old memory.',
    openingVi: 'Mọi chuyện đã đi qua, nhưng đôi khi một tấm ảnh vẫn biết cách đưa ta trở lại.',
    openingEn: 'Everything has passed, yet sometimes a photograph still knows the way back.',
    closingVi: 'Thời gian đi qua. Điều từng chạm vào ta thì vẫn ở lại.',
    closingEn: 'Time moves on. What once touched us remains.',
    accent: '#c4a7e7', effect: 'stardust',
    director: Object.freeze({ sceneProfile: 'archive', mediaStrategy: 'chronological', pace: 1.18, fade: 1400, hold: 5600, camera: 'camera.pushIn', cameraIntensity: 0.14, effectIntensity: 0.48, audio: 'audio.duck', environment: 'environment.dim', environmentIntensity: 0.2, desaturate: 0.24 }),
  }),
  melancholy: Object.freeze({
    labelVi: 'Man mác', labelEn: 'Melancholy',
    descriptionVi: 'Tĩnh, mong manh và có những khoảng lặng để cảm xúc tự cất lời.',
    descriptionEn: 'Still, fragile, with room for silence to speak.',
    openingVi: 'Có những ký ức chỉ cần chạm khẽ thôi cũng đủ làm lòng mình chậm lại.',
    openingEn: 'Some memories need only the lightest touch to make the heart slow down.',
    closingVi: 'Có những điều không cần nói hết, chỉ cần được nhớ.',
    closingEn: 'Some things do not need to be fully said, only remembered.',
    accent: '#8fa4ca', effect: 'aurora',
    director: Object.freeze({ sceneProfile: 'stillness', mediaStrategy: 'isolate-last', pace: 1.3, fade: 1700, hold: 6200, camera: 'camera.freeze', cameraIntensity: 0, effectIntensity: 0.34, audio: 'audio.duck', environment: 'environment.dim', environmentIntensity: 0.38, desaturate: 0.48, silence: 900 }),
  }),
  wonder: Object.freeze({
    labelVi: 'Kỳ diệu', labelEn: 'Wonder',
    descriptionVi: 'Trong trẻo, rộng mở và như đang bước vào điều chưa từng thấy.',
    descriptionEn: 'Clear, expansive, and full of discovery.',
    openingVi: 'Mỗi khoảnh khắc nhỏ đều từng mở ra một thế giới mà ta chưa biết trước.',
    openingEn: 'Every small moment once opened a world we could not have imagined.',
    closingVi: 'Mỗi ký ức nhỏ đều từng là cả một thế giới.',
    closingEn: 'Every small memory was once an entire world.',
    accent: '#79d9f2', effect: 'aurora',
    director: Object.freeze({ sceneProfile: 'orbit', mediaStrategy: 'center-reveal', pace: 0.92, fade: 850, hold: 4500, camera: 'camera.pullOut', cameraIntensity: 0.3, effectIntensity: 0.74, audio: 'audio.swell', environment: 'environment.brighten', environmentIntensity: 0.38 }),
  }),
  hope: Object.freeze({
    labelVi: 'Hy vọng', labelEn: 'Hope',
    descriptionVi: 'Nhẹ dần, sáng dần và hướng câu chuyện về phía trước.',
    descriptionEn: 'Growing lighter and carrying the story forward.',
    openingVi: 'Nhìn lại không phải để đứng yên, mà để biết mình đã mang theo những gì.',
    openingEn: 'We look back not to remain there, but to know what we carry forward.',
    closingVi: 'Những gì đẹp đã qua không khép lại — nó soi đường cho điều phía trước.',
    closingEn: 'What was beautiful does not end — it lights the way ahead.',
    accent: '#8fe3bd', effect: 'aurora',
    director: Object.freeze({ sceneProfile: 'ascent', mediaStrategy: 'forward-rise', pace: 0.98, fade: 1000, hold: 4800, camera: 'camera.pushIn', cameraIntensity: 0.24, effectIntensity: 0.68, audio: 'audio.swell', environment: 'environment.brighten', environmentIntensity: 0.5 }),
  }),
});

const AUTO_EMOTION_BY_STORY_TYPE = Object.freeze({
  couple: 'romantic', birthday: 'warm', friendship: 'warm', school: 'nostalgia',
  family: 'warm', self: 'hope', travel: 'wonder', special: 'wonder',
});

const EMOTIONAL_ROLES = Object.freeze({
  intro: Object.freeze({ intensityMultiplier: 0.76 }),
  build: Object.freeze({ intensityMultiplier: 0.9 }),
  memory: Object.freeze({ intensityMultiplier: 1 }),
  shift: Object.freeze({ intensityMultiplier: 0.66 }),
  climax: Object.freeze({ intensityMultiplier: 1.25 }),
  release: Object.freeze({ intensityMultiplier: 0.86 }),
  ending: Object.freeze({ intensityMultiplier: 0.72 }),
});

function curveDirection(emotion, intensityMultiplier) {
  return Object.freeze({ emotion, intensityMultiplier });
}

// Supporting emotions create contrast around the selected primary emotion.
// The memory and climax remain faithful to the user's intent; other roles shape the journey.
const EMOTIONAL_CURVES = Object.freeze({
  warm: Object.freeze({
    intro: curveDirection('warm', 0.68), build: curveDirection('warm', 0.84),
    memory: curveDirection('warm', 0.92), shift: curveDirection('melancholy', 0.5),
    climax: curveDirection('warm', 1.12), release: curveDirection('hope', 0.76),
    ending: curveDirection('warm', 0.72),
  }),
  romantic: Object.freeze({
    intro: curveDirection('warm', 0.44), build: curveDirection('romantic', 0.72),
    memory: curveDirection('romantic', 0.84), shift: curveDirection('nostalgia', 0.5),
    climax: curveDirection('romantic', 1.24), release: curveDirection('warm', 0.82),
    ending: curveDirection('warm', 0.84),
  }),
  nostalgia: Object.freeze({
    intro: curveDirection('warm', 0.54), build: curveDirection('nostalgia', 0.72),
    memory: curveDirection('nostalgia', 0.9), shift: curveDirection('melancholy', 0.48),
    climax: curveDirection('nostalgia', 1.12), release: curveDirection('warm', 0.68),
    ending: curveDirection('nostalgia', 0.72),
  }),
  melancholy: Object.freeze({
    intro: curveDirection('nostalgia', 0.54), build: curveDirection('melancholy', 0.68),
    memory: curveDirection('melancholy', 0.84), shift: curveDirection('melancholy', 0.42),
    climax: curveDirection('melancholy', 1.04), release: curveDirection('warm', 0.52),
    ending: curveDirection('hope', 0.62),
  }),
  wonder: Object.freeze({
    intro: curveDirection('wonder', 0.58), build: curveDirection('wonder', 0.78),
    memory: curveDirection('wonder', 0.9), shift: curveDirection('nostalgia', 0.46),
    climax: curveDirection('wonder', 1.18), release: curveDirection('hope', 0.74),
    ending: curveDirection('hope', 0.8),
  }),
  hope: Object.freeze({
    intro: curveDirection('nostalgia', 0.5), build: curveDirection('warm', 0.68),
    memory: curveDirection('hope', 0.84), shift: curveDirection('melancholy', 0.44),
    climax: curveDirection('hope', 1.18), release: curveDirection('warm', 0.76),
    ending: curveDirection('hope', 0.88),
  }),
});

const DIRECTOR_RULES = Object.freeze({
  climaxPosition: 0.68,
  explicitClimaxChapterIds: Object.freeze(['highlight']),
  emotionCurves: EMOTIONAL_CURVES,
});

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateEmotionConfig(value) {
  if (!isPlainObject(value)) return false;
  if (Object.keys(value).some(key => !['mode', 'primaryEmotion', 'intensity'].includes(key))) return false;
  if (!EMOTION_MODES.includes(value.mode)) return false;
  if (!Number.isFinite(value.intensity) || value.intensity < 0 || value.intensity > 1) return false;
  if (value.mode === 'manual' && value.primaryEmotion !== null && value.primaryEmotion !== undefined && !EMOTION_KEYS.includes(value.primaryEmotion)) return false;
  return value.primaryEmotion === null || value.primaryEmotion === undefined || EMOTION_KEYS.includes(value.primaryEmotion);
}

function normalizeEmotionConfig(value) {
  if (!validateEmotionConfig(value)) return null;
  return {
    mode: value.mode,
    primaryEmotion: value.primaryEmotion || null,
    intensity: Math.round(value.intensity * 100) / 100,
  };
}

function publicStoryEmotionConfig() {
  return {
    modes: [...EMOTION_MODES],
    defaultConfig: { mode: 'auto', primaryEmotion: null, intensity: 0.65 },
    autoByStoryType: { ...AUTO_EMOTION_BY_STORY_TYPE },
    roles: Object.fromEntries(Object.entries(EMOTIONAL_ROLES).map(([id, role]) => [id, { ...role }])),
    directorRules: {
      ...DIRECTOR_RULES,
      explicitClimaxChapterIds: [...DIRECTOR_RULES.explicitClimaxChapterIds],
      emotionCurves: Object.fromEntries(Object.entries(EMOTIONAL_CURVES).map(([emotion, curve]) => [
        emotion,
        Object.fromEntries(Object.entries(curve).map(([role, direction]) => [role, { ...direction }])),
      ])),
    },
    emotions: EMOTION_KEYS.map(id => ({ id, ...EMOTIONS[id] })),
  };
}

module.exports = {
  AUTO_EMOTION_BY_STORY_TYPE,
  DIRECTOR_RULES,
  EMOTIONAL_CURVES,
  EMOTIONS,
  EMOTIONAL_ROLES,
  EMOTION_KEYS,
  EMOTION_MODES,
  normalizeEmotionConfig,
  publicStoryEmotionConfig,
  validateEmotionConfig,
};
