export function detectPerformanceTier() {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const pixelRatio = window.devicePixelRatio || 1;
  const lowPower = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || '') && (cores <= 4 || memory <= 4);
  if (lowPower || cores <= 2 || memory <= 2) return 'low';
  if (pixelRatio > 1.5 || cores >= 8 || memory >= 8) return 'high';
  return 'mid';
}

export const TIER_CONFIG = Object.freeze({
  low: Object.freeze({ relics: 6, rocks: 40, near: 400, far: 800, snow: 300, fauna: 2, texture: 512, pixelRatio: 1, antialias: false, caustics: 0, fps: 30 }),
  mid: Object.freeze({ relics: 12, rocks: 90, near: 900, far: 1800, snow: 900, fauna: 5, texture: 768, pixelRatio: 1.5, antialias: true, caustics: 3, fps: 50 }),
  high: Object.freeze({ relics: 16, rocks: 120, near: 1500, far: 3000, snow: 1600, fauna: 8, texture: 1024, pixelRatio: 2, antialias: true, caustics: 7, fps: 60 }),
});

export function createAdaptiveTier(initialTier) {
  let tier = initialTier;
  let elapsed = 0;
  let lowWindows = 0;
  return {
    get tier() { return tier; },
    get config() { return TIER_CONFIG[tier]; },
    update(dt, measuredFps = 60) {
      elapsed += dt;
      if (elapsed < 3) return false;
      elapsed = 0;
      if (measuredFps < TIER_CONFIG[tier].fps) lowWindows += 1; else lowWindows = 0;
      if (lowWindows >= 2 && tier !== 'low') {
        tier = tier === 'high' ? 'mid' : 'low';
        lowWindows = 0;
        return true;
      }
      return false;
    },
  };
}
