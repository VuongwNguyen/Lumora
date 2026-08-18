const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const phasesPath = pathToFileURL(path.join(__dirname, '../public/abyss/js/core/phases.js')).href;
const layoutPath = pathToFileURL(path.join(__dirname, '../public/abyss/js/core/layout.js')).href;

async function fullDirector() {
  const { createPhaseDirector } = await import(phasesPath);
  const { buildPhaseTable, FULL_PHASE_IDS } = await import(layoutPath);
  return createPhaseDirector(buildPhaseTable(FULL_PHASE_IDS, 40, 540));
}

test('phase tiến theo độ sâu và không bao giờ lùi', async () => {
  const director = await fullDirector();
  assert.equal(director.update(45).id, 'descent');
  const atFirstGlow = director.update(200);
  assert.equal(atFirstGlow.id, 'first_glow');
  assert.ok(Number.isFinite(atFirstGlow.depth));
  assert.equal(atFirstGlow.depth, 200);
  assert.equal(director.update(600).id, 'release');
  // Kéo camera lên không được đưa phase về lại.
  assert.equal(director.update(45).id, 'release');
});

test('progress chạy từ 0 tới 1 trong một phase', async () => {
  const director = await fullDirector();
  assert.ok(Math.abs(director.update(40).progress - 0) < 1e-6);
  assert.ok(Math.abs(director.update(80).progress - 0.5) < 1e-6);
  assert.ok(director.update(119).progress > 0.98);
});

test('release có progress hữu hạn dù end là Infinity', async () => {
  const director = await fullDirector();
  const phase = director.update(9999);
  assert.equal(phase.id, 'release');
  assert.ok(Number.isFinite(phase.progress));
  assert.ok(phase.progress >= 0 && phase.progress <= 1);
});

test('reset đưa director về phase đầu', async () => {
  const director = await fullDirector();
  director.update(600);
  director.reset();
  assert.equal(director.update(45).id, 'descent');
});

test('phaseBlend cho cross-fade 8 m quanh biên', async () => {
  const { phaseBlend } = await import(phasesPath);
  assert.equal(phaseBlend(100, 120, 8), 0);   // trước cửa sổ
  assert.equal(phaseBlend(120, 120, 8), 0.5); // đúng biên
  assert.equal(phaseBlend(140, 120, 8), 1);   // sau cửa sổ
  assert.ok(phaseBlend(116, 120, 8) > 0 && phaseBlend(116, 120, 8) < 0.5);
});

test('blendInto cho ramp liên tục 0->1 quanh biên, không đứt khi phase nhảy', async () => {
  const { createPhaseDirector } = await import(phasesPath);
  const { buildPhaseTable, FULL_PHASE_IDS } = await import(layoutPath);
  const director = createPhaseDirector(buildPhaseTable(FULL_PHASE_IDS, 40, 540));
  // Biên vào first_glow là 120 m; cửa sổ cross-fade là 112..128.
  const seen = [];
  for (let depth = 100; depth <= 140; depth += 2) {
    director.update(depth);
    seen.push(director.blendInto(1));
  }
  for (let i = 1; i < seen.length; i++) {
    assert.ok(seen[i] >= seen[i - 1], `blend giảm ở bước ${i}: ${seen[i - 1]} -> ${seen[i]}`);
  }
  assert.equal(seen[0], 0);
  assert.equal(seen[seen.length - 1], 1);
  assert.ok(seen.some(v => v > 0 && v < 1), 'ramp nhảy thẳng 0->1, không có cross-fade');
});

test('blendInto đo biên cố định, không đổi theo phase hiện tại', async () => {
  const { createPhaseDirector } = await import(phasesPath);
  const { buildPhaseTable, FULL_PHASE_IDS } = await import(layoutPath);
  const director = createPhaseDirector(buildPhaseTable(FULL_PHASE_IDS, 40, 540));
  director.update(124);
  // Đã ở first_glow, nhưng vẫn hỏi được về biên đã qua và biên chưa tới.
  assert.equal(director.blendInto(1), 0.75);
  assert.equal(director.blendInto(2), 0);
  assert.equal(director.blendInto(99), 1, 'index ngoài bảng coi như đã vào hẳn');
});

test('bảng phase rút gọn vẫn chạy đúng thứ tự', async () => {
  const { createPhaseDirector } = await import(phasesPath);
  const { buildPhaseTable } = await import(layoutPath);
  const director = createPhaseDirector(buildPhaseTable(['descent', 'beacon_reveal', 'release'], 40, 220));
  assert.equal(director.update(50).id, 'descent');
  assert.equal(director.update(219).id, 'beacon_reveal');
  assert.equal(director.update(221).id, 'release');
});
