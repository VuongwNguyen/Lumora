const SOUNDSCAPES = Object.freeze({
  none: Object.freeze({
    label: 'Không âm thanh',
    labelEn: 'No sound',
    description: 'Giữ trải nghiệm hoàn toàn yên lặng.',
    descriptionEn: 'Keep the experience completely silent.',
    defaults: Object.freeze({ intensity: 0, warmth: 50, motion: 0 }),
  }),
  deep_focus: Object.freeze({
    label: 'Deep Focus',
    labelEn: 'Deep Focus',
    description: 'Soft keys, harp và celesta chuyển lớp nhẹ để tập trung.',
    descriptionEn: 'Soft keys, harp and celesta shifting gently for focus.',
    defaults: Object.freeze({ intensity: 48, warmth: 72, motion: 44 }),
  }),
  cosmic_drift: Object.freeze({
    label: 'Cosmic Drift',
    labelEn: 'Cosmic Drift',
    description: 'Glass synth, flute và celesta trôi thưa trong không gian rộng.',
    descriptionEn: 'Glass synth, flute and celesta drifting through a wide space.',
    defaults: Object.freeze({ intensity: 48, warmth: 58, motion: 38 }),
  }),
  aurora_bloom: Object.freeze({
    label: 'Aurora Bloom',
    labelEn: 'Aurora Bloom',
    description: 'Glass, harp và kalimba tạo arpeggio trong trẻo, chuyển động nhanh.',
    descriptionEn: 'Glass, harp and kalimba shape a bright moving arpeggio.',
    defaults: Object.freeze({ intensity: 46, warmth: 64, motion: 58 }),
  }),
  memory_glow: Object.freeze({
    label: 'Memory Glow',
    labelEn: 'Memory Glow',
    description: 'Soft keys, nylon và flute tạo motif ấm dành cho Story.',
    descriptionEn: 'Soft keys, nylon and flute create a warm motif for Story.',
    defaults: Object.freeze({ intensity: 44, warmth: 76, motion: 28 }),
  }),
  falling_stars: Object.freeze({
    label: 'Falling Stars',
    labelEn: 'Falling Stars',
    description: 'Bell, kalimba, harp và marimba bay nhanh trong stereo cho Fall.',
    descriptionEn: 'Bell, kalimba, harp and marimba move quickly in stereo for Fall.',
    defaults: Object.freeze({ intensity: 54, warmth: 48, motion: 68 }),
  }),
});

const SOUNDSCAPE_KEYS = Object.freeze(Object.keys(SOUNDSCAPES));
const DEFAULT_SOUNDSCAPE = Object.freeze({ preset: 'none', intensity: 0, warmth: 50, motion: 0 });

function boundedInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalizeSoundscape(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...DEFAULT_SOUNDSCAPE };
  }
  const preset = SOUNDSCAPES[value.preset] ? value.preset : DEFAULT_SOUNDSCAPE.preset;
  const defaults = SOUNDSCAPES[preset].defaults;
  return {
    preset,
    intensity: preset === 'none' ? 0 : boundedInteger(value.intensity, defaults.intensity),
    warmth: boundedInteger(value.warmth, defaults.warmth),
    motion: preset === 'none' ? 0 : boundedInteger(value.motion, defaults.motion),
  };
}

function validateSoundscape(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (!SOUNDSCAPES[value.preset]) return false;
  return ['intensity', 'warmth', 'motion'].every((field) => {
    if (value[field] === undefined) return true;
    const number = Number(value[field]);
    return Number.isFinite(number) && number >= 0 && number <= 100;
  });
}

function publicSoundscapes() {
  return SOUNDSCAPE_KEYS.map((id) => ({
    id,
    label: SOUNDSCAPES[id].label,
    labelEn: SOUNDSCAPES[id].labelEn,
    description: SOUNDSCAPES[id].description,
    descriptionEn: SOUNDSCAPES[id].descriptionEn,
    defaults: { ...SOUNDSCAPES[id].defaults },
  }));
}

module.exports = {
  DEFAULT_SOUNDSCAPE,
  SOUNDSCAPES,
  SOUNDSCAPE_KEYS,
  normalizeSoundscape,
  publicSoundscapes,
  validateSoundscape,
};
