// Không import three.

export function createPhaseDirector(table) {
  if (!Array.isArray(table) || table.length === 0) throw new Error('phase table rỗng');
  let currentIndex = 0;
  return {
    get table() { return table; },
    update(depth) {
      // Chốt biên "kế tiếp" TRƯỚC khi phase tiến: nếu chốt sau, đúng lúc
      // currentIndex vừa nhảy qua biên thì "next" sẽ trỏ sang biên xa hơn
      // phía sau (của phase mới), khiến nextBlend rơi thẳng về 0 ngay tại
      // biên thay vì 0.5 — tức mất luôn cross-fade ở đúng chỗ cần nó nhất.
      const upcoming = table[currentIndex + 1];
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
        nextBlend: upcoming ? phaseBlend(depth, upcoming.start) : 0,
      };
    },
    reset() { currentIndex = 0; },
  };
}

// 0 trước cửa sổ, 0.5 đúng biên, 1 sau cửa sổ. Width = nửa bề rộng cross-fade.
export function phaseBlend(depth, boundary, width = 8) {
  return Math.min(1, Math.max(0, (depth - (boundary - width)) / (width * 2)));
}
