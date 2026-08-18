const PHASES = Object.freeze([
  { id: 'descent', start: 40, end: 120 },
  { id: 'first_glow', start: 120, end: 210 },
  { id: 'memory_trench', start: 210, end: 330 },
  { id: 'beacon_reveal', start: 330, end: 430 },
  { id: 'living_ocean', start: 430, end: 540 },
  { id: 'release', start: 540, end: Infinity },
]);

export function createPhaseDirector() {
  let currentIndex = 0;
  return {
    get phases() { return PHASES; },
    update(depth) {
      while (currentIndex < PHASES.length - 1 && depth >= PHASES[currentIndex + 1].start) currentIndex += 1;
      const phase = PHASES[currentIndex];
      const span = Number.isFinite(phase.end) ? phase.end - phase.start : 100;
      const progress = Math.min(1, Math.max(0, (depth - phase.start) / span));
      return { ...phase, index: currentIndex, progress, id: phase.id };
    },
    reset() { currentIndex = 0; },
  };
}

export function phaseBlend(depth, boundary, width = 8) {
  return Math.min(1, Math.max(0, (depth - (boundary - width)) / (width * 2)));
}
