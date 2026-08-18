const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const modulePath = pathToFileURL(path.join(__dirname, '../public/abyss/js/core/depth.js')).href;

test('densityFromD90 khớp công thức FogExp2 nuốt 90%', async () => {
  const { densityFromD90 } = await import(modulePath);
  // 1 - exp(-(k*d)^2) = 0.9  =>  k*d = sqrt(ln 10) = 1.5174
  assert.ok(Math.abs(densityFromD90(140) - 0.01084) < 1e-5);
  assert.ok(Math.abs(densityFromD90(50) - 0.03035) < 1e-5);
});

test('bảng mốc density khớp D90 trong spec 13.2', async () => {
  const { densityFromD90, FOG_DENSITY_STOPS } = await import(modulePath);
  // Mốc 40 m là ngoại suy, không có D90 tương ứng.
  const d90ByDepth = [[120, 140], [210, 100], [330, 70], [430, 50]];
  for (const [depth, d90] of d90ByDepth) {
    const stop = FOG_DENSITY_STOPS.find(item => item.depth === depth);
    assert.ok(Math.abs(stop.density - densityFromD90(d90)) < 6e-5, `depth ${depth}`);
  }
});

test('densityForDepth khớp bảng attenuation mục 6.1', async () => {
  const { densityForDepth } = await import(modulePath);
  assert.ok(Math.abs(densityForDepth(40) - 0.0080) < 1e-6);
  assert.ok(Math.abs(densityForDepth(120) - 0.0108) < 1e-6);
  assert.ok(Math.abs(densityForDepth(210) - 0.0152) < 1e-6);
  assert.ok(Math.abs(densityForDepth(330) - 0.0217) < 1e-6);
  assert.ok(Math.abs(densityForDepth(430) - 0.0304) < 1e-6);
});

test('densityForDepth nội suy tuyến tính giữa hai mốc', async () => {
  const { densityForDepth } = await import(modulePath);
  const midpoint = densityForDepth(80); // giữa 40 và 120
  assert.ok(Math.abs(midpoint - (0.0080 + 0.0108) / 2) < 1e-6);
});

test('densityForDepth tăng đơn điệu và bão hoà dưới sâu', async () => {
  const { densityForDepth } = await import(modulePath);
  let previous = 0;
  for (let depth = 0; depth <= 900; depth += 10) {
    const value = densityForDepth(depth);
    assert.ok(value >= previous, `giảm tại depth ${depth}`);
    previous = value;
  }
  assert.equal(densityForDepth(0), 0.008);
  assert.equal(densityForDepth(900), densityForDepth(430));
});

test('depthFromZ dẫn xuất từ vị trí camera, không từ thời gian', async () => {
  const { depthFromZ, D0, START_Z } = await import(modulePath);
  assert.equal(D0, 40);
  assert.equal(depthFromZ(START_Z), 40);
  assert.equal(depthFromZ(START_Z - 100), 140);
  assert.equal(depthFromZ(0, 10, 100), 110);
});

test('easeTowards độc lập frame rate', async () => {
  const { easeTowards } = await import(modulePath);
  // Một bước 1 s phải bằng 60 bước 1/60 s trong sai số nhỏ.
  const oneStep = easeTowards(0, 1, 1, 6);
  let many = 0;
  for (let i = 0; i < 60; i++) many = easeTowards(many, 1, 1 / 60, 6);
  assert.ok(Math.abs(oneStep - many) < 1e-9);
});
