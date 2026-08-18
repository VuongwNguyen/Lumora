// Không import three.

export function createPhaseDirector(table) {
  if (!Array.isArray(table) || table.length === 0) throw new Error('phase table rỗng');
  let currentIndex = 0;
  let lastDepth = table[0].start;
  return {
    get table() { return table; },
    update(depth) {
      lastDepth = depth;
      // Đơn hướng: chỉ tiến, không bao giờ lùi (mục 13.4).
      while (currentIndex < table.length - 1 && depth >= table[currentIndex + 1].start) currentIndex += 1;
      const phase = table[currentIndex];
      const span = Number.isFinite(phase.end) ? phase.end - phase.start : 100;
      const progress = Math.min(1, Math.max(0, (depth - phase.start) / span));
      return {
        id: phase.id,
        index: currentIndex,
        start: phase.start,
        end: phase.end,
        progress,
        depth,
      };
    },
    // Blend liên tục 0->1 quanh biên vào phase `phaseIndex`, không phụ thuộc
    // director đang ở phase nào — nên cross-fade không bị đứt khi index nhảy.
    blendInto(phaseIndex) {
      const target = table[phaseIndex];
      return target ? phaseBlend(lastDepth, target.start) : 1;
    },
    reset() { currentIndex = 0; },
  };
}

// 0 trước cửa sổ, 0.5 đúng biên, 1 sau cửa sổ. Width = nửa bề rộng cross-fade.
export function phaseBlend(depth, boundary, width = 8) {
  return Math.min(1, Math.max(0, (depth - (boundary - width)) / (width * 2)));
}
