const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const modulePath = pathToFileURL(path.join(__dirname, '../public/abyss/js/core/layout.js')).href;

test('galaxy rỗng cho empty state, không có relic', async () => {
  const { planContent } = await import(modulePath);
  const plan = planContent(0, 16);
  assert.equal(plan.empty, true);
  assert.equal(plan.relicCount, 0);
  assert.equal(plan.diveDistance, 200);
  assert.deepEqual(plan.phaseIds, ['descent', 'first_glow', 'release']);
});

test('1-3 ảnh: tất cả ở near field, lặn ngắn, bỏ phase giữa', async () => {
  const { planContent } = await import(modulePath);
  for (const n of [1, 2, 3]) {
    const plan = planContent(n, 16);
    assert.equal(plan.relicCount, n);
    assert.equal(plan.near, n);
    assert.equal(plan.mid, 0);
    assert.equal(plan.far, 0);
    assert.equal(plan.diveDistance, 180);
    assert.deepEqual(plan.phaseIds, ['descent', 'beacon_reveal', 'release']);
  }
});

test('4-8 ảnh: near 2, phần còn lại mid, thêm far silhouette rỗng, bỏ living_ocean', async () => {
  const { planContent } = await import(modulePath);
  const plan = planContent(6, 16);
  assert.equal(plan.near, 2);
  assert.equal(plan.mid, 4);
  assert.equal(plan.far, 3);
  // 6 relic có ảnh + 3 silhouette rỗng
  assert.equal(plan.relicCount, 9);
  assert.equal(plan.diveDistance, 320);
  assert.ok(!plan.phaseIds.includes('living_ocean'));
});

test('relicCount luôn bằng near + mid + far ở mọi nhánh', async () => {
  const { planContent } = await import(modulePath);
  for (const n of [0, 1, 3, 4, 8, 9, 16, 40]) {
    for (const tier of [6, 12, 16]) {
      const plan = planContent(n, tier);
      assert.equal(plan.relicCount, plan.near + plan.mid + plan.far, `sai ở n=${n} tier=${tier}`);
    }
  }
});

test('9-16 ảnh: bố cục đầy đủ theo mục 4.4 và đủ 6 phase', async () => {
  const { planContent } = await import(modulePath);
  const plan = planContent(14, 16);
  assert.equal(plan.near, 3);
  assert.equal(plan.mid, 8);
  assert.equal(plan.far, 3);
  assert.equal(plan.near + plan.mid + plan.far, plan.relicCount);
  assert.equal(plan.diveDistance, 500);
  assert.equal(plan.phaseIds.length, 6);
});

test('tier thấp giới hạn số relic hiển thị nhưng không đổi quãng đường', async () => {
  const { planContent } = await import(modulePath);
  const high = planContent(14, 16);
  const low = planContent(14, 6);
  assert.equal(low.relicCount, 6);
  assert.equal(high.relicCount, 14);
  assert.equal(low.diveDistance, high.diveDistance);

  const sparse = planContent(8, 6);
  assert.equal(sparse.streamed, true, 'ảnh bị bỏ mà không bật cờ stream');
});

test('trên 16 ảnh: pool relic bị chặn, quãng đường dài thêm 12 m mỗi ảnh dư rồi chặn ở 620 m', async () => {
  const { planContent } = await import(modulePath);
  const plan = planContent(40, 16);
  assert.equal(plan.relicCount, 16);
  assert.equal(plan.streamed, true);
  assert.equal(plan.diveDistance, 620, 'quãng đường phải bị chặn ở 620 m');
  assert.equal(planContent(26, 16).diveDistance, 620, 'n=26 là điểm chạm trần');
  assert.equal(planContent(25, 16).diveDistance, 608, 'n=25 chưa chạm trần');
  assert.equal(planContent(200, 16).diveDistance, 620);
});

test('relic sâu nhất luôn nằm trong quãng đường lặn', async () => {
  const { planContent, relicDistanceAt } = await import(modulePath);
  for (const n of [1, 2, 3, 6, 14, 40]) {
    const plan = planContent(n, 16);
    const deepest = relicDistanceAt(plan, Math.max(0, plan.relicCount - 1));
    assert.ok(deepest < plan.diveDistance, `n=${n}: relic sâu nhất ${deepest} > lặn ${plan.diveDistance}`);
    assert.ok(relicDistanceAt(plan, 0) > 0);
  }
});

test('relicDistanceAt trải relic đều trong spawn range', async () => {
  const { planContent, relicSpawnRange, relicDistanceAt } = await import(modulePath);
  const plan = planContent(14, 16);
  const { first, last } = relicSpawnRange(plan);
  assert.equal(relicDistanceAt(plan, 0), first);
  assert.equal(relicDistanceAt(plan, plan.relicCount - 1), last);
  let prev = -Infinity;
  for (let i = 0; i < plan.relicCount; i++) {
    const d = relicDistanceAt(plan, i);
    assert.ok(d > prev, `không đơn điệu ở index ${i}`);
    assert.ok(d >= first && d <= last, `index ${i} ra ngoài spawn range`);
    prev = d;
  }
});

test('relicDistanceAt không chia cho 0 khi chỉ có 1 relic', async () => {
  const { planContent, relicSpawnRange, relicDistanceAt } = await import(modulePath);
  for (const n of [0, 1]) {
    const plan = planContent(n, 16);
    const d = relicDistanceAt(plan, 0);
    assert.ok(Number.isFinite(d), `n=${n} cho ${d}`);
    assert.equal(d, relicSpawnRange(plan).first);
  }
});

test('buildPhaseTable tái tạo đúng bảng phase gốc khi lặn đủ 500 m', async () => {
  const { buildPhaseTable, FULL_PHASE_IDS } = await import(modulePath);
  const table = buildPhaseTable(FULL_PHASE_IDS, 40, 540);
  assert.deepEqual(table.map(p => Math.round(p.start)), [40, 120, 210, 330, 430, 540]);
  assert.equal(table[table.length - 1].end, Infinity);
});

test('buildPhaseTable co lại theo tỉ lệ khi lặn ngắn', async () => {
  const { buildPhaseTable } = await import(modulePath);
  const table = buildPhaseTable(['descent', 'beacon_reveal', 'release'], 40, 220);
  assert.equal(table[0].start, 40);
  assert.equal(table[table.length - 1].start, 220);
  for (let i = 1; i < table.length; i++) assert.ok(table[i].start > table[i - 1].start);
});

test('buildPhaseTable không để phase id lạ làm NaN các phase hợp lệ', async () => {
  const { buildPhaseTable } = await import(modulePath);
  const table = buildPhaseTable(['descent', 'bogus', 'release'], 40, 540);
  for (const phase of table) {
    assert.ok(Number.isFinite(phase.start), `${phase.id}.start không hữu hạn`);
  }
});

test('số ảnh âm hoặc không phải số được coi như rỗng', async () => {
  const { planContent } = await import(modulePath);
  for (const bad of [-5, NaN, undefined, null]) {
    assert.equal(planContent(bad, 16).empty, true);
  }
});
