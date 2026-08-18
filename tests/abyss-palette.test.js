const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const modulePath = pathToFileURL(path.join(__dirname, '../public/abyss/js/core/palette.js')).href;

// --- Trợ giúp: khoảng cách màu CIE76 trong không gian Lab ---
function srgbToLinear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function hexToLab(hex) {
  const value = parseInt(hex.replace('#', ''), 16);
  const r = srgbToLinear((value >> 16) & 255);
  const g = srgbToLinear((value >> 8) & 255);
  const b = srgbToLinear(value & 255);
  const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  const y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
  const z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function deltaE(hexA, hexB) {
  const a = hexToLab(hexA);
  const b = hexToLab(hexB);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

test('trợ giúp deltaE tự kiểm: màu giống nhau cho 0, đen với trắng cho > 90', () => {
  assert.ok(deltaE('#02151B', '#02151B') < 1e-9);
  assert.ok(deltaE('#000000', '#FFFFFF') > 90);
});

test('theme hồng chói không đổi được bất kỳ màu scene nào (mục 13.10)', async () => {
  const { resolveSceneColors } = await import(modulePath);
  const baseline = resolveSceneColors();
  const poisoned = resolveSceneColors({ primary: '#FF00AA', secondary: '#FF00AA' });
  // Spec 13.10 cho phép ngưỡng 2, nhưng resolveSceneColors trả về chuỗi
  // byte-identical nên deltaE thật sự luôn là 0. Ghim sát để một thay đổi
  // sau này lỡ tô màu scene lệch hơn 1 JND vẫn còn nằm dưới 2 sẽ bị bắt.
  for (const key of Object.keys(baseline)) {
    assert.ok(deltaE(baseline[key], poisoned[key]) < 1e-9, `${key} bị theme làm lệch`);
  }
});

test('fog và background luôn là deepWater bất kể theme', async () => {
  const { resolveSceneColors, ABYSS_PALETTE } = await import(modulePath);
  const colors = resolveSceneColors({ primary: '#FF00AA' });
  assert.equal(colors.background, ABYSS_PALETTE.deepWater);
  assert.equal(colors.fog, ABYSS_PALETTE.deepWater);
});

test('accent bị kẹp trong dải hue 150-210 độ dù theme là hồng', async () => {
  const { resolveAccents, hexToHsl } = await import(modulePath);
  const accents = resolveAccents({ primary: '#FF00AA', secondary: '#7B00FF' });
  for (const hex of [accents.accent, accents.accentSecondary]) {
    const hue = hexToHsl(hex).h * 360;
    assert.ok(hue >= 149.5 && hue <= 210.5, `hue ${hue} nằm ngoài dải teal`);
  }
});

test('accent chỉ dịch 12% về phía theme, không thay thế hoàn toàn', async () => {
  const { resolveAccents, ABYSS_PALETTE } = await import(modulePath);
  const neutral = resolveAccents({});
  const themed = resolveAccents({ primary: '#00FFFF' });
  assert.ok(deltaE(neutral.accent, ABYSS_PALETTE.bioluminescent) < 1);
  const shift = deltaE(themed.accent, ABYSS_PALETTE.bioluminescent);
  // mix 0.12 -> dE 2.51; 0.25 -> dE 5.18. Dải này ghim mix vào khoảng 0.05-0.19.
  assert.ok(shift > 1 && shift < 4, `accent lệch ${shift}, mix đã vượt 12%`);
  assert.notEqual(themed.accent, neutral.accent);
});

test('theme không màu không kéo accent ra khỏi palette', async () => {
  const { resolveAccents, ABYSS_PALETTE } = await import(modulePath);
  for (const grey of ['#000000', '#808080', '#FFFFFF']) {
    const accents = resolveAccents({ primary: grey, secondary: grey });
    assert.equal(accents.accent.toLowerCase(), ABYSS_PALETTE.bioluminescent.toLowerCase());
    assert.equal(accents.accentSecondary.toLowerCase(), ABYSS_PALETTE.memoryGlow.toLowerCase());
  }
});

test('theme rác hoặc thiếu không làm vỡ pipeline màu', async () => {
  const { resolveAccents } = await import(modulePath);
  for (const bad of [undefined, null, {}, { primary: 'không-phải-màu' }, { primary: 123 }]) {
    const accents = resolveAccents(bad);
    assert.match(accents.accent, /^#[0-9a-f]{6}$/i);
    assert.match(accents.accentSecondary, /^#[0-9a-f]{6}$/i);
  }
});

test('hexToHsl và hslToHex khứ hồi không mất màu', async () => {
  const { hexToHsl, hslToHex } = await import(modulePath);
  for (const hex of ['#2E9E9B', '#78E6D0', '#B8FFF0', '#D98F75', '#01080C']) {
    assert.ok(deltaE(hslToHex(hexToHsl(hex)), hex) < 1);
  }
});
