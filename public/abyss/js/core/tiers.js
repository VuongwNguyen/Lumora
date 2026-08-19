export function detectPerformanceTier() {
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const pixelRatio = window.devicePixelRatio || 1;
  const lowPower = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent || '') && (cores <= 4 || memory <= 4);
  if (lowPower || cores <= 2 || memory <= 2) return 'low';
  if (pixelRatio > 1.5 || cores >= 8 || memory >= 8) return 'high';
  return 'mid';
}

// texture: cạnh dài nhất sau khi relics.js thu nhỏ ảnh. Ngân sách mục 13.7 là
// 48 MB. RGBA8 + mipmap = w*h*4*4/3. Worst case là ảnh vuông, và số texture là
// (near + mid) relic mang ảnh + 1 tấm trên whale fall = 12 ở high/mid, 7 ở low;
// đường stream của relics.js dựng texture mới TRƯỚC khi dispose tấm cũ nên có
// khoảnh khắc giữ 13. high 832 => 44.3 MB thường, 48.0 MB lúc swap.
export const TIER_CONFIG = Object.freeze({
  // Mục 14.4 — burglar alarm chỉ tồn tại ở lớp plankton GẦN. Đo trên 4 quãng lặn
  // (180/320/500/620 m), 5 seed mỗi quãng, đếm khung hình có ít nhất một hạt còn
  // sáng: near 400 / far 800 cho 61.5–82.6% (median 1 hạt) — vệt sáng đứt quãng,
  // trong khi mid đạt 88.8–99.3%. Tổng số hạt của tier low KHÔNG được tăng (máy
  // yếu mới rơi xuống đây), nên lấy từ lớp far — lớp phông rộng 70×48 mà sương
  // mù đằng nào cũng nuốt phần lớn — chuyển sang lớp near 20×14:
  //   near 700 / far 500 -> 80.6–94.9%, median 2 hạt, tổng vẫn 1200 hạt.
  // Chi phí: cùng số điểm gửi lên GPU, chỉ tăng ~1000 px² fill mỗi khung (hạt
  // gần thì to hơn) — dưới 0.1% của một khung 1080p.
  low: Object.freeze({ relics: 6, rocks: 40, near: 700, far: 500, snow: 300, fauna: 2, texture: 512, pixelRatio: 1, antialias: false, caustics: 0, fps: 30 }),
  mid: Object.freeze({ relics: 12, rocks: 90, near: 900, far: 1800, snow: 900, fauna: 5, texture: 768, pixelRatio: 1.5, antialias: true, caustics: 3, fps: 50 }),
  high: Object.freeze({ relics: 16, rocks: 120, near: 1500, far: 3000, snow: 1600, fauna: 8, texture: 832, pixelRatio: 2, antialias: true, caustics: 7, fps: 60 }),
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
