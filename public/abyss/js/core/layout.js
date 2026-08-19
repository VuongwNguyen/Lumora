// Không import three.

export const FULL_PHASE_IDS = Object.freeze([
  'descent', 'first_glow', 'memory_trench', 'beacon_reveal', 'living_ocean', 'release',
]);

// Trọng số = số mét mỗi phase chiếm trong hành trình 500 m đầy đủ (mục 13.4).
const PHASE_WEIGHTS = Object.freeze({
  descent: 80, first_glow: 90, memory_trench: 120, beacon_reveal: 100, living_ocean: 110,
});

// Pool trần 16 mesh relic — cố ý khớp TIER_CONFIG.high.relics ở core/tiers.js.
// Không import tiers.js ở đây để hai module giữ tách rời.
const MAX_POOL = 16;

// Nhánh 4-8 ảnh luôn cần 3 silhouette rỗng ở far field để giữ chiều sâu,
// bất kể tier hay số ảnh thật (mục 13.11).
const SPARSE_FAR_SILHOUETTES = 3;

export function buildPhaseTable(phaseIds, startDepth, endDepth) {
  const body = phaseIds.filter(id => id !== 'release');
  // ?? 0: phase id lạ không được để làm NaN lan sang các phase hợp lệ khác.
  const totalWeight = body.reduce((sum, id) => sum + (PHASE_WEIGHTS[id] ?? 0), 0);
  const span = endDepth - startDepth;
  let cursor = startDepth;
  const table = body.map(id => {
    const start = cursor;
    cursor += span * ((PHASE_WEIGHTS[id] ?? 0) / totalWeight);
    return { id, start, end: cursor };
  });
  table.push({ id: 'release', start: cursor, end: Infinity });
  return table;
}

// Khoảng cách tối thiểu giữa hai relic liên tiếp. Dưới ngưỡng này chúng chồng
// lên nhau trong sương và mất hẳn cảm giác từng tấm một.
const MIN_RELIC_SPACING = 9;

export function planContent(imageCount, tierRelics = MAX_POOL) {
  const n = Number.isFinite(imageCount) && imageCount > 0 ? Math.floor(imageCount) : 0;

  if (n === 0) {
    return frozen({
      relicCount: 0, near: 0, mid: 0, far: 0, streamed: false, imageCount: n, empty: true,
      diveDistance: 200, phaseIds: ['descent', 'first_glow', 'release'],
    });
  }

  if (n <= 3) {
    // Không áp tierRelics ở đây một cách cố ý: tier thấp nhất vẫn cấp 6 relic
    // (core/tiers.js), lớn hơn 3, nên nhánh này không bao giờ bị tier bó hẹp.
    return frozen({
      relicCount: n, near: n, mid: 0, far: 0, streamed: false, imageCount: n, empty: false,
      diveDistance: 180, phaseIds: ['descent', 'beacon_reveal', 'release'],
    });
  }

  if (n <= 8) {
    const withImages = Math.min(n, tierRelics);
    const near = Math.min(2, withImages);
    const mid = withImages - near;
    const far = SPARSE_FAR_SILHOUETTES;
    return frozen({
      relicCount: near + mid + far, near, mid, far, imageCount: n,
      streamed: withImages < n, empty: false,
      diveDistance: 320,
      phaseIds: ['descent', 'first_glow', 'memory_trench', 'beacon_reveal', 'release'],
    });
  }

  const relicCount = Math.min(n, tierRelics);
  const near = Math.min(3, relicCount);
  const mid = Math.min(8, relicCount - near);
  return frozen({
    relicCount, near, mid, far: relicCount - near - mid, imageCount: n,
    streamed: n > relicCount, empty: false,
    // Trần 620 m khớp công thức clamp(180, 40×N, 620) của mục 13.11 — pool
    // relic vẫn chặn ở MAX_POOL nên thêm quãng đường sau đó chỉ kéo dài thời
    // gian bơi mà không thêm nội dung.
    diveDistance: Math.min(620, 500 + Math.max(0, n - MAX_POOL) * 12),
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

// Chỉ số 0..near-1 là near field, near..near+mid-1 là mid field, phần còn
// lại là far field (mục 4.4) — Task 6 phải map mesh theo đúng thứ tự này.
// Khoảng cách giữa hai relic. Trải đều trên spawn range là sai khi galaxy có
// nhiều ảnh hơn pool: 59 ảnh / 16 relic cho 30.6 m một tấm, và vì mỗi relic chỉ
// vòng lại được một lần trong quãng lặn nên CHỈ 18 trên 59 tấm từng hiện ra.
// Lấy theo số ảnh để cả album đi qua được camera đúng một lượt.
export function relicSpacing(plan) {
  const { span } = relicSpawnRange(plan);
  const spread = plan.relicCount > 1 ? span / (plan.relicCount - 1) : span;
  if (!plan.imageCount) return spread;
  const needed = plan.diveDistance / plan.imageCount;
  return Math.max(MIN_RELIC_SPACING, Math.min(spread, needed));
}

// Quãng đường một relic lùi lại khi bị camera bỏ qua: đúng chiều dài đoàn relic,
// nên chúng tạo thành băng chuyền liên tục thay vì tái xuất hiện thành cụm.
export function relicWrapDistance(plan) {
  return relicSpacing(plan) * plan.relicCount;
}

export function relicDistanceAt(plan, index) {
  const { first } = relicSpawnRange(plan);
  if (plan.relicCount <= 1) return first;
  // Kẹp index để một pool mesh cố định lớn hơn relicCount không ngoại suy
  // quá "last" hay quá diveDistance.
  const clampedIndex = Math.min(Math.max(index, 0), plan.relicCount - 1);
  return first + relicSpacing(plan) * clampedIndex;
}

function frozen(plan) {
  return Object.freeze({ ...plan, phaseIds: Object.freeze(plan.phaseIds) });
}
