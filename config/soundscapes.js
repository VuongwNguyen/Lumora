const SOUNDSCAPES = Object.freeze({
  none: Object.freeze({
    label: 'Không âm thanh',
    labelEn: 'No sound',
    description: 'Giữ trải nghiệm hoàn toàn yên lặng.',
    descriptionEn: 'Keep the experience completely silent.',
    defaults: Object.freeze({
      intensity: 0, warmth: 50, motion: 0, instrument: 'auto', tempo: 76, space: 50, variation: 50,
    }),
  }),
  deep_focus: Object.freeze({
    label: 'Deep Focus',
    labelEn: 'Deep Focus',
    description: 'Soft keys, harp và celesta chuyển lớp nhẹ để tập trung.',
    descriptionEn: 'Soft keys, harp and celesta shifting gently for focus.',
    defaults: Object.freeze({
      intensity: 48, warmth: 72, motion: 44, instrument: 'auto', tempo: 76, space: 46, variation: 52,
    }),
  }),
  cosmic_drift: Object.freeze({
    label: 'Cosmic Drift',
    labelEn: 'Cosmic Drift',
    description: 'Glass synth, flute và celesta trôi thưa trong không gian rộng.',
    descriptionEn: 'Glass synth, flute and celesta drifting through a wide space.',
    defaults: Object.freeze({
      intensity: 48, warmth: 58, motion: 38, instrument: 'auto', tempo: 58, space: 82, variation: 58,
    }),
  }),
  aurora_bloom: Object.freeze({
    label: 'Aurora Bloom',
    labelEn: 'Aurora Bloom',
    description: 'Glass, harp và kalimba tạo arpeggio trong trẻo, chuyển động nhanh.',
    descriptionEn: 'Glass, harp and kalimba shape a bright moving arpeggio.',
    defaults: Object.freeze({
      intensity: 46, warmth: 64, motion: 58, instrument: 'auto', tempo: 94, space: 62, variation: 72,
    }),
  }),
  memory_glow: Object.freeze({
    label: 'Memory Glow',
    labelEn: 'Memory Glow',
    description: 'Soft keys, nylon và flute tạo motif ấm dành cho Story.',
    descriptionEn: 'Soft keys, nylon and flute create a warm motif for Story.',
    defaults: Object.freeze({
      intensity: 44, warmth: 76, motion: 28, instrument: 'auto', tempo: 68, space: 42, variation: 44,
    }),
  }),
  falling_stars: Object.freeze({
    label: 'Falling Stars',
    labelEn: 'Falling Stars',
    description: 'Bell, kalimba, harp và marimba bay nhanh trong stereo cho Fall.',
    descriptionEn: 'Bell, kalimba, harp and marimba move quickly in stereo for Fall.',
    defaults: Object.freeze({
      intensity: 54, warmth: 48, motion: 68, instrument: 'auto', tempo: 108, space: 68, variation: 78,
    }),
  }),
});

const SOUNDSCAPE_KEYS = Object.freeze(Object.keys(SOUNDSCAPES));
const SOUNDSCAPE_INSTRUMENTS = Object.freeze({
  auto: Object.freeze({ label: 'Tự động theo preset', labelEn: 'Preset arrangement' }),
  soft_keys: Object.freeze({ label: 'Piano mềm', labelEn: 'Soft keys' }),
  glass: Object.freeze({ label: 'Glass synth', labelEn: 'Glass synth' }),
  harp: Object.freeze({ label: 'Harp', labelEn: 'Harp' }),
  flute: Object.freeze({ label: 'Sáo nhẹ', labelEn: 'Airy flute' }),
  bell: Object.freeze({ label: 'Chuông pha lê', labelEn: 'Crystal bell' }),
  celesta: Object.freeze({ label: 'Celesta', labelEn: 'Celesta' }),
  kalimba: Object.freeze({ label: 'Kalimba', labelEn: 'Kalimba' }),
  nylon: Object.freeze({ label: 'Guitar nylon', labelEn: 'Nylon guitar' }),
  marimba: Object.freeze({ label: 'Marimba', labelEn: 'Marimba' }),
  airy_voice: Object.freeze({ label: 'Giọng ngân không lời', labelEn: 'Wordless airy voice' }),
});
const SOUNDSCAPE_INSTRUMENT_KEYS = Object.freeze(Object.keys(SOUNDSCAPE_INSTRUMENTS));
const DEFAULT_SOUNDSCAPE = Object.freeze({ ...SOUNDSCAPES.none.defaults, preset: 'none' });

function boundedInteger(value, fallback, min = 0, max = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
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
    instrument: SOUNDSCAPE_INSTRUMENTS[value.instrument] ? value.instrument : defaults.instrument,
    tempo: boundedInteger(value.tempo, defaults.tempo, 40, 140),
    space: boundedInteger(value.space, defaults.space),
    variation: boundedInteger(value.variation, defaults.variation),
  };
}

function validateSoundscape(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (!SOUNDSCAPES[value.preset]) return false;
  if (value.instrument !== undefined && !SOUNDSCAPE_INSTRUMENTS[value.instrument]) return false;
  if (value.tempo !== undefined) {
    const tempo = Number(value.tempo);
    if (!Number.isFinite(tempo) || tempo < 40 || tempo > 140) return false;
  }
  return ['intensity', 'warmth', 'motion', 'space', 'variation'].every((field) => {
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

function publicSoundscapeInstruments() {
  return SOUNDSCAPE_INSTRUMENT_KEYS.map((id) => ({
    id,
    label: SOUNDSCAPE_INSTRUMENTS[id].label,
    labelEn: SOUNDSCAPE_INSTRUMENTS[id].labelEn,
  }));
}

module.exports = {
  DEFAULT_SOUNDSCAPE,
  SOUNDSCAPES,
  SOUNDSCAPE_KEYS,
  SOUNDSCAPE_INSTRUMENTS,
  SOUNDSCAPE_INSTRUMENT_KEYS,
  normalizeSoundscape,
  publicSoundscapeInstruments,
  publicSoundscapes,
  validateSoundscape,
};
