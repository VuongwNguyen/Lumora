// Không import three.

export const FULL_PHASE_IDS = Object.freeze([
  'descent', 'first_glow', 'memory_trench', 'beacon_reveal', 'living_ocean', 'release',
]);

// Trọng số = số mét mỗi phase chiếm trong hành trình 500 m đầy đủ (mục 13.4).
const PHASE_WEIGHTS = Object.freeze({
  descent: 80, first_glow: 90, memory_trench: 120, beacon_reveal: 100, living_ocean: 110,
});

const MAX_POOL = 16;

export function buildPhaseTable(phaseIds, startDepth, endDepth) {
  const body = phaseIds.filter(id => id !== 'release');
  const totalWeight = body.reduce((sum, id) => sum + PHASE_WEIGHTS[id], 0);
  const span = endDepth - startDepth;
  let cursor = startDepth;
  const table = body.map(id => {
    const start = cursor;
    cursor += span * (PHASE_WEIGHTS[id] / totalWeight);
    return { id, start, end: cursor };
  });
  table.push({ id: 'release', start: cursor, end: Infinity });
  return table;
}

export function planContent(imageCount, tierRelics = MAX_POOL) {
  const n = Number.isFinite(imageCount) && imageCount > 0 ? Math.floor(imageCount) : 0;

  if (n === 0) {
    return frozen({
      relicCount: 0, near: 0, mid: 0, far: 0, streamed: false, empty: true,
      diveDistance: 200, phaseIds: ['descent', 'first_glow', 'release'],
    });
  }

  if (n <= 3) {
    return frozen({
      relicCount: n, near: n, mid: 0, far: 0, streamed: false, empty: false,
      diveDistance: 180, phaseIds: ['descent', 'beacon_reveal', 'release'],
    });
  }

  if (n <= 8) {
    const withImages = Math.min(n, tierRelics);
    const near = Math.min(2, withImages);
    const mid = withImages - near;
    const far = 3; // silhouette rỗng, không nhận ảnh
    return frozen({
      relicCount: near + mid + far, near, mid, far, streamed: false, empty: false,
      diveDistance: 320,
      phaseIds: ['descent', 'first_glow', 'memory_trench', 'beacon_reveal', 'release'],
    });
  }

  const relicCount = Math.min(n, tierRelics);
  const near = Math.min(3, relicCount);
  const mid = Math.min(8, relicCount - near);
  return frozen({
    relicCount, near, mid, far: relicCount - near - mid,
    streamed: n > relicCount, empty: false,
    diveDistance: 500 + Math.max(0, n - MAX_POOL) * 12,
    phaseIds: FULL_PHASE_IDS.slice(),
  });
}

// Relic phải nằm trọn trong quãng đường lặn: bắt đầu sau 18% và kết thúc
// trước 92% để người xem còn khoảng thở ở đầu và cuối hành trình.
export function relicSpawnRange(plan) {
  const first = plan.diveDistance * 0.18;
  const last = plan.diveDistance * 0.92;
  return { first, last, span: last - first };
}

export function relicDistanceAt(plan, index) {
  const { first, span } = relicSpawnRange(plan);
  if (plan.relicCount <= 1) return first;
  return first + span * (index / (plan.relicCount - 1));
}

function frozen(plan) {
  return Object.freeze({ ...plan, phaseIds: Object.freeze(plan.phaseIds) });
}
