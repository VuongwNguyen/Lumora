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
  assert.ok(plan.mid >= 6 && plan.mid <= 8);
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
});

test('trên 16 ảnh: pool relic bị chặn, quãng đường dài thêm 12 m mỗi ảnh dư', async () => {
  const { planContent } = await import(modulePath);
  const plan = planContent(40, 16);
  assert.equal(plan.relicCount, 16);
  assert.equal(plan.streamed, true);
  assert.equal(plan.diveDistance, 500 + 24 * 12);
});

test('relic gần nhất luôn nằm trong quãng đường lặn', async () => {
  const { planContent, relicSpawnRange } = await import(modulePath);
  for (const n of [1, 3, 8, 16, 40]) {
    const plan = planContent(n, 16);
    const range = relicSpawnRange(plan);
    assert.ok(range.first > 0, `relic đầu ở ${range.first}`);
    assert.ok(range.last <= plan.diveDistance, `relic cuối ở ${range.last} vượt ${plan.diveDistance}`);
    assert.ok(range.first < range.last || plan.relicCount <= 1);
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

test('số ảnh âm hoặc không phải số được coi như rỗng', async () => {
  const { planContent } = await import(modulePath);
  for (const bad of [-5, NaN, undefined, null]) {
    assert.equal(planContent(bad, 16).empty, true);
  }
});
