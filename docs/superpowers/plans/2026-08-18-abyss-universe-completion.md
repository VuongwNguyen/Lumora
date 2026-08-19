# Abyss Universe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện template `abyss` để đạt đủ Definition of Done ở mục 12 và Implementation contract ở mục 13 của `docs/abyss-universe-visual-spec.md`, với phần logic thuần được tách ra thành module test được bằng `node --test`.

**Architecture:** Scene đã có sẵn cấu trúc module (`core/`, `fx/`, `scene/`) nhưng toàn bộ logic đang trộn với `three`, nên không có dòng nào test được. Plan này rút phần *quyết định* (fog theo độ sâu, bố cục theo số ảnh, bảng phase, ràng buộc màu) ra thành 3 module thuần JavaScript không import `three`, viết test cho chúng trước, rồi mới nối vào lớp render. Phần còn lại là vá các lỗ hổng đã xác định giữa spec và code hiện tại.

**Tech Stack:** ES modules trong trình duyệt, `three@0.152.2` qua importmap (unpkg, không có trong `package.json`), test bằng `node --test` (CommonJS + dynamic `import()`), không thêm dependency mới.

---

## Bối cảnh: trạng thái hiện tại

`public/abyss/` là thư mục **chưa được commit** (`?? public/abyss/` trong `git status`). Đã có:

```text
public/abyss/index.html          53 dòng  — đã có #relic-nav, #reset-dive, #manual-dive
public/abyss/js/abyss.js        177 dòng  — bootstrap + loop
public/abyss/js/core/phases.js   27 dòng  — bảng phase cứng theo độ sâu tuyệt đối
public/abyss/js/core/theme.js    39 dòng  — kẹp hue 150–210°, lerp .12
public/abyss/js/core/tiers.js    37 dòng  — 3 tier + adaptive downgrade
public/abyss/js/fx/water.js      89 dòng  — plankton, marine snow, bubble, caustic, veil
public/abyss/js/scene/seabed.js  64 dòng  — floor, InstancedMesh rock, ridge, kelp
public/abyss/js/scene/beacon.js  49 dòng  — coral + lattice + shimmer + motes
public/abyss/js/scene/relics.js  49 dòng  — relic near/mid, recycle, texture stream
public/abyss/js/scene/fauna.js   73 dòng  — jellyfish, fish, anemone, shrimp, silhouette,
                                            driftRibbon, whaleFall, memoryPool
```

Mục 13.1–13.8 phần lớn đã làm. **Không có test nào.** Các lỗ hổng đã xác minh bằng cách đọc code:

| # | Lỗ hổng | Bằng chứng |
|---|---|---|
| 1 | Không có test, `npm test` không chạy abyss | `package.json` không có `test:abyss` |
| 2 | `phaseBlend()` export nhưng không ai gọi → cross-fade 8 m ở 13.4 chưa có | `core/phases.js:25`, không xuất hiện trong `abyss.js` |
| 3 | Bảng phase cứng ở độ sâu tuyệt đối, không co theo số ảnh | `core/phases.js:1-8` |
| 4 | `FULL_DIVE_DEPTH = 620` khai báo rồi không dùng | `abyss.js:26` |
| 5 | Relic đầu tiên ở `z = -180` (≈ depth 215 m) — galaxy 2 ảnh lặn 180 m sẽ không bao giờ tới | `relics.js:20` |
| 6 | Không có far-field relic silhouette (mục 4.4) | `relics.js:17` chỉ có `near` / không-near |
| 7 | `N = 0` không có empty state | `relics.js:16` vòng lặp chạy 0 lần, không báo gì |
| 8 | `loadTexture(url, maxSize)` nhận `maxSize` rồi bỏ qua → ngân sách 48 MB ở 13.7 không được thực thi | `relics.js:3-8` |
| 9 | Burglar alarm đổi opacity **cả lớp** → mọi plankton sáng cùng lúc, vi phạm mục 6.3 | `water.js:85-86` |
| 10 | Marine snow dùng chung `pointsLayer` với plankton, cùng hướng cùng tốc độ → không phân biệt được | `water.js:21-23` |
| 11 | `DeepSilhouette` hiện theo `phase.progress`, không theo caustic (mục 14.5) | `fauna.js:67` |
| 12 | `adaptiveTier.update()` trả về `true` nhưng giá trị bị bỏ → hạ tier không có tác dụng gì | `abyss.js:174` |
| 13 | `closeRelic()` không trả focus, lightbox không có focus trap (13.9) | `abyss.js:119-123` |
| 14 | Không có focus ring vẽ trên canvas cho relic đang focus (13.9) | `renderRelicNav()` chỉ tạo button ẩn |
| 15 | `whaleFall` không nhận ảnh cũ nhất (mục 14.3) | `fauna.js:41-46` |

Task 1–4 xử lý nền móng test được. Task 5–13 vá lần lượt các lỗ hổng trên.

### Baseline

`public/abyss/` ban đầu **chưa vào git** (`?? public/abyss/` trong `git status`). Điều đó khiến mọi commit của plan tham chiếu tới file không tồn tại trong repo — cụ thể guard test dưới đây `readFileSync` năm file untracked, nên clone sạch sẽ fail `ENOENT`, và `git bisect` trên nhánh này vô nghĩa.

Commit `7032923` đưa toàn bộ thư mục vào git ở **trạng thái trước plan**. Mọi task từ đây là diff thật trên nền thật. Đừng lặp lại `git add public/abyss/` hàng loạt ở bất kỳ task nào — chỉ stage đúng file mình sửa.

Hai hệ quả đã xảy ra trước khi baseline được tạo, ghi lại để không ai đi tìm lại:

- Guard test ở `tests/tmdt-compliance.test.js` cũng **chưa được commit** lúc Task 2 chạy, nên bước "thay dòng assertion" của Task 2 không thể thực hiện như mô tả — cả block 32 dòng buộc phải vào commit `bb1755d` như một addition. Từ Task 4 trở đi block đã có trong repo, nên các bước "thay dòng" hoạt động đúng như viết.
- `bb1755d` do đó là một commit **fail trên clean checkout** (guard test đọc 5 file chưa track). `7032923` sửa tình trạng này nhưng nằm *sau* nó, nên `bb1755d` vẫn là điểm hỏng nếu `git bisect`. Không rebase để sửa: working tree đang có 22 file dirty không liên quan, rủi ro rebase lớn hơn lợi ích.

### Guard test phải cập nhật cùng lúc

`tests/tmdt-compliance.test.js:905-929` có một test dùng **regex trên source** để khoá các bất biến kiến trúc của abyss. Plan này thay đổi 5 chỗ mà nó đang canh, nên mỗi task làm vỡ phải sửa assertion **trong cùng commit** — không phải xoá, mà là trỏ sang bất biến mới:

| Dòng | Assertion hiện tại | Vỡ ở | Bất biến mới |
|---|---|---|---|
| `:913` | `abyss` khớp `/const D0 = 40/` | Task 5 | `D0` chuyển sang import từ `core/depth.js` |
| `:914` | `abyss` khớp `/depthFromCamera\(\)/` | Task 5 | đổi tên thành `currentDepth()` |
| `:921` | `theme` khớp `/hsl\.h = Math\.min\(210 \/ 360, Math\.max\(150 \/ 360/` | Task 2 | logic kẹp hue chuyển sang `core/palette.js` |
| `:922` | `phases` khớp `/first_glow.*start: 120/s` | Task 4 | bảng phase chuyển sang `core/layout.js` |
| `:923` | `phases` khớp `/release.*start: 540/s` | Task 4 | như trên |

Các assertion còn lại (`densityForDepth(depth)`, `marineSnow`, `bubbleSpeed`, `ShaderMaterial`, `whaleFallLandmark`, `memoryShrimp`, `doesNotMatch PointLight`) đều sống sót qua plan này — **không được đụng vào**.

Lưu ý `tests/tmdt-compliance.test.js` đang ở trạng thái modified chưa commit trong working tree. Khi một task sửa file này, chỉ stage đúng phần thay đổi của mình.

---

## File Structure

**Tạo mới:**

| File | Trách nhiệm |
|---|---|
| `public/abyss/js/core/palette.js` | Bảng màu + toàn bộ toán màu (hex ↔ rgb ↔ hsl, kẹp hue accent). **Không import `three`.** |
| `public/abyss/js/core/depth.js` | Quy đổi z ↔ độ sâu, bảng fog density, easing theo thời gian. **Không import `three`.** |
| `public/abyss/js/core/layout.js` | Từ số ảnh → bố cục relic, quãng đường lặn, danh sách phase, bảng biên phase. **Không import `three`.** |
| `tests/abyss-palette.test.js` | Bao gồm assertion ΔE ở 13.10 |
| `tests/abyss-depth.test.js` | Bảng fog khớp công thức `1.5174 / D90` |
| `tests/abyss-layout.test.js` | Bố cục cho N = 0/1/3/8/16/40 |
| `tests/abyss-phases.test.js` | State machine đơn hướng + cross-fade |

**Sửa:**

| File | Thay đổi |
|---|---|
| `core/theme.js` | Rút toán màu sang `palette.js`, giữ lại lớp bọc `THREE.Color` |
| `core/phases.js` | Nhận bảng phase từ `layout.js` thay vì bảng cứng |
| `core/tiers.js` | Không đổi (đã đúng) |
| `fx/water.js` | Tách marine snow khỏi plankton, burglar alarm cục bộ, expose caustic shafts |
| `scene/relics.js` | Nhận `plan`, thêm far silhouette, downscale texture, `setVisibleCount` |
| `scene/fauna.js` | Counter-illumination cho silhouette, `attachOldestMemory` |
| `abyss.js` | Nối layout + depth, cross-fade, áp dụng hạ tier, a11y focus |
| `public/abyss/index.html` | Thêm `#empty-state`, `#relic-focus-ring`, bump `?v=` |
| `package.json` | Thêm `test:abyss`, nối vào `npm test` |

Nguyên tắc chia: mọi thứ **quyết định điều gì xảy ra** nằm trong `core/` và không import `three`; mọi thứ **vẽ ra hình** nằm trong `fx/` và `scene/`. Ranh giới này là thứ làm cho test tồn tại được.

---

### Task 1: `core/depth.js` — độ sâu và fog

**Files:**
- Create: `public/abyss/js/core/depth.js`
- Test: `tests/abyss-depth.test.js`

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/abyss-depth.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const modulePath = pathToFileURL(path.join(__dirname, '../public/abyss/js/core/depth.js')).href;

test('densityFromD90 khớp công thức FogExp2 nuốt 90%', async () => {
  const { densityFromD90 } = await import(modulePath);
  // 1 - exp(-(k*d)^2) = 0.9  =>  k*d = sqrt(ln 10) = 1.5174
  assert.ok(Math.abs(densityFromD90(140) - 0.01084) < 1e-4);
  assert.ok(Math.abs(densityFromD90(50) - 0.03035) < 1e-4);
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
  assert.equal(densityForDepth(900), densityForDepth(430));
});

test('depthFromZ dẫn xuất từ vị trí camera, không từ thời gian', async () => {
  const { depthFromZ, D0, START_Z } = await import(modulePath);
  assert.equal(D0, 40);
  assert.equal(depthFromZ(START_Z), 40);
  assert.equal(depthFromZ(START_Z - 100), 140);
});

test('easeTowards độc lập frame rate', async () => {
  const { easeTowards } = await import(modulePath);
  // Một bước 1 s phải bằng 60 bước 1/60 s trong sai số nhỏ.
  const oneStep = easeTowards(0, 1, 1, 6);
  let many = 0;
  for (let i = 0; i < 60; i++) many = easeTowards(many, 1, 1 / 60, 6);
  assert.ok(Math.abs(oneStep - many) < 1e-9);
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `node --test tests/abyss-depth.test.js`
Expected: FAIL — `Cannot find module .../core/depth.js`

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo `public/abyss/js/core/depth.js`:

```js
// Không import three. Module này phải chạy được trong Node để test.

export const D0 = 40;
export const START_Z = 5;

// 1 - exp(-(density * d)^2) = 0.9  =>  density * d = sqrt(ln 10)
const NINETY_PERCENT = Math.sqrt(Math.log(10));

export function densityFromD90(d90) {
  return NINETY_PERCENT / d90;
}

// Mục 6.1 quy đổi qua densityFromD90, làm tròn về giá trị đã chốt trong spec 13.2.
export const FOG_BANDS = Object.freeze([
  Object.freeze({ depth: 40, density: 0.0080 }),
  Object.freeze({ depth: 120, density: 0.0108 }),
  Object.freeze({ depth: 210, density: 0.0152 }),
  Object.freeze({ depth: 330, density: 0.0217 }),
  Object.freeze({ depth: 430, density: 0.0304 }),
]);

export function densityForDepth(depth) {
  if (depth <= FOG_BANDS[0].depth) return FOG_BANDS[0].density;
  for (let i = 1; i < FOG_BANDS.length; i++) {
    const band = FOG_BANDS[i];
    const previous = FOG_BANDS[i - 1];
    if (depth <= band.depth) {
      const t = (depth - previous.depth) / (band.depth - previous.depth);
      return previous.density + (band.density - previous.density) * t;
    }
  }
  return FOG_BANDS[FOG_BANDS.length - 1].density;
}

export function depthFromZ(z, startZ = START_Z, d0 = D0) {
  return d0 + (startZ - z);
}

// tau = hằng số thời gian tính bằng giây; 6 s cho fog theo mục 13.2.
export function easeTowards(current, target, dt, tau) {
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `node --test tests/abyss-depth.test.js`
Expected: PASS — 6 tests

- [ ] **Step 5: Commit**

```bash
git add public/abyss/js/core/depth.js tests/abyss-depth.test.js
git commit -m "feat(abyss): tách logic độ sâu và fog thành module test được"
```

---

### Task 2: `core/palette.js` — toán màu và ràng buộc theme

**Files:**
- Create: `public/abyss/js/core/palette.js`
- Test: `tests/abyss-palette.test.js`

Đây là task chứa assertion quan trọng nhất của mục 13.10: chứng minh theme của user không thể nhuộm scene.

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/abyss-palette.test.js`:

```js
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
  for (const key of Object.keys(baseline)) {
    assert.ok(deltaE(baseline[key], poisoned[key]) < 2, `${key} bị theme làm lệch`);
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
  assert.ok(deltaE(themed.accent, ABYSS_PALETTE.bioluminescent) < 12);
  assert.notEqual(themed.accent, neutral.accent);
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
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `node --test tests/abyss-palette.test.js`
Expected: FAIL — `Cannot find module .../core/palette.js`

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo `public/abyss/js/core/palette.js`:

```js
// Không import three. Toàn bộ toán màu của abyss sống ở đây để test được.

export const ABYSS_PALETTE = Object.freeze({
  deepWater: '#02151B',
  trenchShadow: '#01080C',
  coldTeal: '#2E9E9B',
  bioluminescent: '#78E6D0',
  memoryGlow: '#B8FFF0',
  rareViolet: '#7566A8',
  warmMemory: '#D98F75',
});

// Accent bị nhốt trong dải teal của biển sâu. Đây là cơ chế thực thi
// dòng DoD "theme hồng/tím không thể biến toàn cảnh thành vũ trụ".
export const ACCENT_HUE_MIN = 150 / 360;
export const ACCENT_HUE_MAX = 210 / 360;
export const ACCENT_MIX = 0.12;

const HEX_PATTERN = /^#?([0-9a-f]{6})$/i;

export function hexToRgb(hex) {
  const match = typeof hex === 'string' ? hex.trim().match(HEX_PATTERN) : null;
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return { r: ((value >> 16) & 255) / 255, g: ((value >> 8) & 255) / 255, b: (value & 255) / 255 };
}

export function rgbToHex({ r, g, b }) {
  const channel = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function hexToHsl(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return { h: 0, s: 0, l: 0 };
  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const delta = max - min;
  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let h;
  if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / delta + 2) / 6;
  else h = ((r - g) / delta + 4) / 6;
  return { h, s, l };
}

export function hslToHex({ h, s, l }) {
  if (s === 0) return rgbToHex({ r: l, g: l, b: l });
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t) => {
    let value = t;
    if (value < 0) value += 1;
    if (value > 1) value -= 1;
    if (value < 1 / 6) return p + (q - p) * 6 * value;
    if (value < 1 / 2) return q;
    if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
    return p;
  };
  return rgbToHex({ r: channel(h + 1 / 3), g: channel(h), b: channel(h - 1 / 3) });
}

export function constrainAccentHsl(hsl) {
  return {
    h: Math.min(ACCENT_HUE_MAX, Math.max(ACCENT_HUE_MIN, hsl.h)),
    s: Math.min(0.78, hsl.s),
    l: Math.min(0.72, Math.max(0.32, hsl.l)),
  };
}

function mixHex(fromHex, toHex, amount) {
  const from = hexToRgb(fromHex);
  const to = hexToRgb(toHex);
  if (!from || !to) return fromHex;
  return rgbToHex({
    r: from.r + (to.r - from.r) * amount,
    g: from.g + (to.g - from.g) * amount,
    b: from.b + (to.b - from.b) * amount,
  });
}

// Màu scene KHÔNG nhận tham số theme một cách có chủ đích. Chữ ký vẫn nhận
// đối số để chỗ gọi đọc tự nhiên, và để test chứng minh nó bị bỏ qua.
export function resolveSceneColors(_userTheme) {
  return Object.freeze({
    background: ABYSS_PALETTE.deepWater,
    fog: ABYSS_PALETTE.deepWater,
    trench: ABYSS_PALETTE.trenchShadow,
    coldTeal: ABYSS_PALETTE.coldTeal,
    bioluminescent: ABYSS_PALETTE.bioluminescent,
    memoryGlow: ABYSS_PALETTE.memoryGlow,
    rareViolet: ABYSS_PALETTE.rareViolet,
    warmMemory: ABYSS_PALETTE.warmMemory,
  });
}

function accentFrom(candidate, base) {
  const rgb = hexToRgb(candidate);
  if (!rgb) return base;
  const constrained = hslToHex(constrainAccentHsl(hexToHsl(candidate)));
  return mixHex(base, constrained, ACCENT_MIX);
}

export function resolveAccents(userTheme) {
  const theme = userTheme && typeof userTheme === 'object' ? userTheme : {};
  return Object.freeze({
    accent: accentFrom(theme.primary, ABYSS_PALETTE.bioluminescent),
    accentSecondary: accentFrom(theme.secondary, ABYSS_PALETTE.memoryGlow),
  });
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `node --test tests/abyss-palette.test.js`
Expected: PASS — 7 tests

- [ ] **Step 5: Nối `core/theme.js` vào palette**

Thay toàn bộ `public/abyss/js/core/theme.js` bằng:

```js
import * as THREE from 'three';
import { ABYSS_PALETTE, resolveAccents, resolveSceneColors } from './palette.js';

export { ABYSS_PALETTE };

export function createAbyssTheme(userTheme = {}) {
  const sceneHex = resolveSceneColors(userTheme);
  const accents = resolveAccents(userTheme);
  const scene = {};
  for (const [key, hex] of Object.entries(sceneHex)) scene[key] = new THREE.Color(hex);
  return Object.freeze({
    scene,
    sceneHex,
    accent: new THREE.Color(accents.accent),
    accentSecondary: new THREE.Color(accents.accentSecondary),
  });
}
```

- [ ] **Step 6: Cập nhật guard test `tmdt-compliance`**

Logic kẹp hue vừa rời `theme.js` sang `palette.js`, nên assertion cũ không còn khớp. Trong `tests/tmdt-compliance.test.js`, thêm biến đọc file mới cạnh các dòng `readFileSync` khác trong test `'Abyss visual implementation follows the depth-driven underwater contract'`:

```js
  const palette = fs.readFileSync(path.join(__dirname, '../public/abyss/js/core/palette.js'), 'utf8');
```

rồi thay dòng:

```js
  assert.match(theme, /hsl\.h = Math\.min\(210 \/ 360, Math\.max\(150 \/ 360/);
```

bằng:

```js
  // Ràng buộc hue accent đã chuyển sang palette.js; theme.js giờ chỉ bọc THREE.Color.
  assert.match(palette, /ACCENT_HUE_MIN = 150 \/ 360/);
  assert.match(palette, /ACCENT_HUE_MAX = 210 \/ 360/);
  assert.match(palette, /Math\.min\(ACCENT_HUE_MAX, Math\.max\(ACCENT_HUE_MIN/);
  assert.doesNotMatch(theme, /150 \/ 360/);
```

Không đụng vào bất kỳ assertion nào khác trong test đó.

- [ ] **Step 7: Chạy lại test và kiểm tra không còn tham chiếu cũ**

Run: `node --test tests/abyss-palette.test.js tests/tmdt-compliance.test.js && grep -rn "constrainedAccent\|parseColor" public/abyss/js/`
Expected: cả hai suite PASS, `grep` không in ra dòng nào (exit code 1 là đúng)

- [ ] **Step 8: Thêm file test vào `test:abyss`**

Trong `package.json`, nối `tests/abyss-palette.test.js` vào cuối script `test:abyss` (Task 1 đã tạo script này).

- [ ] **Step 9: Commit**

```bash
git add public/abyss/js/core/palette.js public/abyss/js/core/theme.js tests/abyss-palette.test.js tests/tmdt-compliance.test.js package.json
git commit -m "feat(abyss): tách toán màu ra palette.js và khoá ràng buộc theme bằng test"
```

---

### Task 3: `core/layout.js` — bố cục theo số ảnh

**Files:**
- Create: `public/abyss/js/core/layout.js`
- Test: `tests/abyss-layout.test.js`

Thực thi mục 13.11. Đây cũng là chỗ sửa lỗi #5 (relic nằm ngoài quãng đường lặn).

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/abyss-layout.test.js`:

```js
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
  assert.equal(plan.diveDistance, 620, 'quãng đường phải bị chặn ở 620 m');
  assert.equal(planContent(26, 16).diveDistance, 620, 'n=26 là điểm chạm trần');
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
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `node --test tests/abyss-layout.test.js`
Expected: FAIL — `Cannot find module .../core/layout.js`

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo `public/abyss/js/core/layout.js`:

```js
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

export function relicDistanceAt(plan, index) {
  const { first, span } = relicSpawnRange(plan);
  if (plan.relicCount <= 1) return first;
  return first + span * (index / (plan.relicCount - 1));
}

function frozen(plan) {
  return Object.freeze({ ...plan, phaseIds: Object.freeze(plan.phaseIds) });
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `node --test tests/abyss-layout.test.js`
Expected: PASS — 11 tests

- [ ] **Step 5: Thêm file test vào `test:abyss`**

Trong `package.json`, nối `tests/abyss-layout.test.js` vào cuối script `test:abyss`.

- [ ] **Step 6: Commit**

```bash
git add public/abyss/js/core/layout.js tests/abyss-layout.test.js package.json
git commit -m "feat(abyss): bố cục relic và quãng đường lặn co theo số ảnh"
```

---

### Task 4: `core/phases.js` — nhận bảng phase động

**Files:**
- Modify: `public/abyss/js/core/phases.js` (thay toàn bộ)
- Test: `tests/abyss-phases.test.js`

Sửa lỗi #2 (cross-fade chưa dùng) và #3 (bảng phase cứng).

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/abyss-phases.test.js`:

```js
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
  assert.equal(director.update(200).id, 'first_glow');
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
  const director = await fullDirector();
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
  const director = await fullDirector();
  director.update(124);
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
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `node --test tests/abyss-phases.test.js`
Expected: FAIL — `createPhaseDirector` hiện không nhận đối số, `blendInto` chưa tồn tại

- [ ] **Step 3: Thay toàn bộ `public/abyss/js/core/phases.js`**

```js
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
      return { id: phase.id, index: currentIndex, start: phase.start, end: phase.end, progress, depth };
    },
    // Blend liên tục 0->1 quanh biên vào phase `phaseIndex`, KHÔNG phụ thuộc
    // director đang ở phase nào. Một scalar gắn với currentIndex không dùng được:
    // index đổi ngay giữa cửa sổ cross-fade nên ramp sẽ đứt ở đúng chỗ cần liền,
    // và một scalar cũng chỉ mô tả được một biên trong khi nhiều actor fade ở
    // nhiều biên khác nhau.
    blendInto(phaseIndex) {
      const target = table[phaseIndex];
      return target ? phaseBlend(lastDepth, target.start) : 1;
    },
    reset() { currentIndex = 0; lastDepth = table[0].start; },
  };
}

// 0 trước cửa sổ, 0.5 đúng biên, 1 sau cửa sổ. Width = nửa bề rộng cross-fade.
export function phaseBlend(depth, boundary, width = 8) {
  return Math.min(1, Math.max(0, (depth - (boundary - width)) / (width * 2)));
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `node --test tests/abyss-phases.test.js`
Expected: PASS — 7 tests

- [ ] **Step 5: Cập nhật guard test `tmdt-compliance`**

Bảng phase vừa rời `phases.js` sang `layout.js`, nên hai assertion cũ không còn khớp. Trong `tests/tmdt-compliance.test.js`, thêm biến đọc file cạnh các dòng `readFileSync` khác:

```js
  const layout = fs.readFileSync(path.join(__dirname, '../public/abyss/js/core/layout.js'), 'utf8');
```

rồi thay hai dòng:

```js
  assert.match(phases, /first_glow.*start: 120/s);
  assert.match(phases, /release.*start: 540/s);
```

bằng:

```js
  // Biên phase giờ tính từ trọng số trong layout.js, không còn là hằng số trong phases.js.
  assert.match(layout, /first_glow: 90/);
  assert.match(layout, /'release'/);
  assert.match(phases, /while \(currentIndex < table\.length - 1/); // đơn hướng
  assert.doesNotMatch(phases, /start: 120/);
```

Không đụng vào bất kỳ assertion nào khác trong test đó.

- [ ] **Step 6: Chạy toàn bộ test abyss**

Run: `node --test tests/abyss-depth.test.js tests/abyss-palette.test.js tests/abyss-layout.test.js tests/abyss-phases.test.js tests/tmdt-compliance.test.js`
Expected: 4 suite abyss PASS — 32 tests (7 depth + 7 palette + 11 layout + 7 phases), 0 fail; `tmdt-compliance` cũng PASS

- [ ] **Step 7: Thêm file test vào `test:abyss`**

Trong `package.json`, nối `tests/abyss-phases.test.js` vào cuối script `test:abyss`.

- [ ] **Step 8: Commit**

```bash
git add public/abyss/js/core/phases.js tests/abyss-phases.test.js tests/tmdt-compliance.test.js package.json
git commit -m "feat(abyss): phase director nhận bảng động và expose cross-fade"
```

---

### Task 5: Nối layout, depth và phase vào `abyss.js`

**Files:**
- Modify: `public/abyss/js/abyss.js`

Không có test tự động cho task này (nó chạm `three` và DOM). Nghiệm thu bằng quan sát trong trình duyệt.

- [ ] **Step 1: Đổi phần import và hằng số đầu file**

Thay các dòng 1–27 của `public/abyss/js/abyss.js` bằng:

```js
import * as THREE from 'three';
import { createAbyssTheme } from './core/theme.js';
import { createPhaseDirector } from './core/phases.js';
import { createAdaptiveTier, detectPerformanceTier } from './core/tiers.js';
import { D0, START_Z, densityForDepth, depthFromZ, easeTowards } from './core/depth.js';
import { buildPhaseTable, planContent } from './core/layout.js';
import { createWaterFX } from './fx/water.js';
import { createSeabed } from './scene/seabed.js';
import { createMemoryBeacon } from './scene/beacon.js';
import { createRelics } from './scene/relics.js';
import { createFauna } from './scene/fauna.js';

const params = new URLSearchParams(location.search);
const galaxyId = params.get('galaxyId');
const activity = window.LumoraActivity;
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false;
const intro = document.getElementById('intro');
const depthLabel = document.getElementById('depth');
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightbox-image');
const lightboxCaption = document.getElementById('lightbox-caption');
const relicNav = document.getElementById('relic-nav');
const resetButton = document.getElementById('reset-dive');
const manualDiveButton = document.getElementById('manual-dive');
const emptyState = document.getElementById('empty-state');

const BASE_SPEED = reducedMotion ? 0 : 1.8;
let plan = null;
let phaseDirector = null;
let endDepth = D0 + 500;
```

- [ ] **Step 2: Bắt `createdAt` trong `fetchData` để tìm ảnh cũ nhất**

Thay hàm `fetchData` bằng:

```js
async function fetchData() {
  const empty = { images: [], captions: [], createdAt: [], name: '', soundscape: null, theme: null };
  if (!galaxyId) return empty;
  try {
    const [viewRes, imageRes] = await Promise.all([
      fetch(`/galaxies/${encodeURIComponent(galaxyId)}/view`),
      fetch(`/gallary/items?galaxyId=${encodeURIComponent(galaxyId)}`),
    ]);
    const view = viewRes.ok ? (await viewRes.json()).meta || {} : {};
    const items = (imageRes.ok ? (await imageRes.json()).meta || [] : []).filter(item => item?.imageUrl);
    return {
      images: items.map(item => item.imageUrl),
      // /gallary/items sắp xếp createdAt giảm dần rồi có thể sắp lại theo stage,
      // nên không suy ra được ảnh cũ nhất từ thứ tự mảng. Giữ lại mốc thời gian.
      createdAt: items.map(item => item.createdAt || null),
      captions: view.caption || [],
      name: view.name || '',
      soundscape: view.soundscape || null,
      theme: view.theme?.colors || null,
    };
  } catch { return empty; }
}

function oldestMemory(data) {
  let best = -1;
  let bestTime = Infinity;
  data.createdAt.forEach((stamp, index) => {
    const time = stamp ? Date.parse(stamp) : NaN;
    if (Number.isFinite(time) && time < bestTime) { bestTime = time; best = index; }
  });
  if (best < 0) best = data.images.length - 1;
  return best >= 0 ? { url: data.images[best], caption: data.captions[best] || '' } : null;
}
```

- [ ] **Step 3: Xoá `densityForDepth` cục bộ và dùng module**

Xoá hàm `densityForDepth` (khối `abyss.js:68-77`) và hàm `depthFromCamera`, thay `updateDepthAtmosphere` bằng:

```js
function currentDepth() { return depthFromZ(camera.position.z, START_Z, D0); }

function updateDepthAtmosphere(depth, dt) {
  scene.fog.density = easeTowards(scene.fog.density, densityForDepth(depth), dt, 6);
}
```

- [ ] **Step 4: Dựng plan và phase table trong `init`**

Trong `init()`, ngay sau `const data = await fetchData();`, chèn:

```js
  plan = planContent(data.images.length, adaptiveTier.config.relics);
  endDepth = D0 + plan.diveDistance;
  phaseDirector = createPhaseDirector(buildPhaseTable(plan.phaseIds, D0, endDepth));
  if (plan.empty && emptyState) emptyState.classList.add('visible');
```

Đổi lời gọi `createRelics` thành:

```js
  relics = await createRelics(data.images, data.captions, renderTheme, adaptiveTier.config, reducedMotion, plan);
  root.add(relics.group);
  renderRelicNav();
  // attachOldestMemory được thêm ở Task 10; gọi tuỳ chọn để plan chạy được theo thứ tự.
  fauna.attachOldestMemory?.(oldestMemory(data));
```

Bổ sung `plan` vào log khởi tạo:

```js
  activity?.log({ action: 'Viewer Universe Start', feature: 'viewer', galaxyId, description: { template: 'abyss', photoCount: data.images.length, tier: initialTier, diveDistance: plan.diveDistance, reducedMotion } });
```

- [ ] **Step 5: Dùng `phaseDirector` và `phaseBlend` trong loop**

Trong `loop`, thay dòng tính depth/phase bằng:

```js
  const depth = currentDepth();
  const phase = phaseDirector.update(depth);
```

và truyền blend xuống scene — thay lời gọi `fauna?.update(...)`:

```js
  fauna?.update(elapsed, phase, camera, index => phaseDirector.blendInto(index), phaseDirector.table, waterFX?.getCausticShafts?.() || []);
```

Bỏ hằng số `FULL_DIVE_DEPTH` cũ nếu còn sót.

- [ ] **Step 6: Thêm `#empty-state` vào HTML**

Trong `public/abyss/index.html`, thêm vào block `<style>`:

```css
    #empty-state { display: none; position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); max-width: 74vw; text-align: center; font: 15px/1.7 Georgia, serif; color: rgba(184,255,240,.66); }
    #empty-state.visible { display: block; }
```

và ngay sau `<nav id="relic-nav" ...></nav>`:

```html
  <div id="empty-state">Rãnh biển này chưa có ký ức nào.<br />Hãy thả xuống đây tấm ảnh đầu tiên.</div>
```

- [ ] **Step 7: Kiểm chứng trong trình duyệt**

Run: `npm run dev`

Mở lần lượt và xác nhận bằng mắt:

```text
http://localhost:<port>/abyss/                              → hiện empty state, không lỗi console
http://localhost:<port>/abyss/?galaxyId=<galaxy 2 ảnh>      → HUD depth dừng quanh 220 M, gặp được cả 2 relic
http://localhost:<port>/abyss/?galaxyId=<galaxy 12+ ảnh>    → HUD depth chạy tới 540 M, đủ 6 phase
```

Expected: không có lỗi đỏ trong console; `DEPTH` tăng đều từ 040 M.

- [ ] **Step 8: Cập nhật guard test `tmdt-compliance`**

`D0` vừa chuyển sang import và `depthFromCamera` đã đổi tên. Trong `tests/tmdt-compliance.test.js`, thay hai dòng:

```js
  assert.match(abyss, /const D0 = 40/);
  assert.match(abyss, /depthFromCamera\(\)/);
```

bằng:

```js
  // D0 và toán độ sâu giờ đến từ core/depth.js; abyss.js không định nghĩa lại.
  assert.match(abyss, /import \{[^}]*D0[^}]*\} from '\.\/core\/depth\.js'/);
  assert.match(abyss, /function currentDepth\(\)/);
  assert.match(abyss, /depthFromZ\(camera\.position\.z/);
  assert.doesNotMatch(abyss, /const D0 = 40/);
```

Ba assertion còn lại về abyss (`Math.min((now - lastFrame) / 1000, 1 / 30)`, `camera.position.z -= speed * dt`, `densityForDepth(depth)`, `prefers-reduced-motion`, `doesNotMatch elapsed * 2).padStart`) vẫn đúng — không đụng vào.

- [ ] **Step 9: Chạy guard test**

Run: `node --test tests/tmdt-compliance.test.js`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add public/abyss/js/abyss.js public/abyss/index.html tests/tmdt-compliance.test.js
git commit -m "feat(abyss): hành trình lặn co theo số ảnh và empty state cho galaxy rỗng"
```

---

### Task 6: Relic — far silhouette, giới hạn texture, `setVisibleCount`

**Files:**
- Modify: `public/abyss/js/scene/relics.js` (thay toàn bộ)

Sửa lỗi #5, #6, #8. Đây là task nặng nhất về render.

- [ ] **Step 1: Thay toàn bộ `public/abyss/js/scene/relics.js`**

```js
import * as THREE from 'three';
import { relicDistanceAt, relicSpawnRange } from '../core/layout.js';

// Ảnh gốc từ ImageKit có thể vài nghìn pixel. Thu nhỏ trước khi lên GPU để
// giữ ngân sách 48 MB texture ở mục 13.7.
function loadTexture(url, maxSize) {
  return new Promise(resolve => {
    if (!url) return resolve(null);
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const longest = Math.max(image.width, image.height);
      let source = image;
      if (longest > maxSize) {
        const scale = maxSize / longest;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        source = canvas;
      }
      const texture = new THREE.Texture(source);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      resolve(texture);
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

const FIELD_SIZE = {
  near: { frame: [4.9, 6.3], image: [4.45, 5.75], radius: [5.2, 1.5], spread: 2.6 },
  mid: { frame: [2.5, 3.25], image: [2.18, 2.85], radius: [7, 5], spread: 4 },
  far: { frame: [1.4, 1.85], image: [1.2, 1.6], radius: [11, 7], spread: 6 },
};

function fieldOf(plan, index) {
  if (index < plan.near) return 'near';
  if (index < plan.near + plan.mid) return 'mid';
  return 'far';
}

export async function createRelics(images, captions, theme, tier, reducedMotion, plan) {
  const group = new THREE.Group();
  const relics = [];
  const { span } = relicSpawnRange(plan);
  const pending = [];

  for (let i = 0; i < plan.relicCount; i++) {
    const field = fieldOf(plan, i);
    const size = FIELD_SIZE[field];
    const angle = i * 2.399;
    const radius = size.radius[0] + Math.random() * size.radius[1];
    const frame = new THREE.Group();
    // Quãng đường tới relic đo bằng mét, đổi sang -Z vì camera lặn theo -Z.
    frame.position.set(
      Math.cos(angle) * radius,
      (Math.random() - 0.5) * size.spread,
      -relicDistanceAt(plan, i),
    );
    frame.rotation.set((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.12);

    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(size.frame[0], size.frame[1]),
      new THREE.MeshBasicMaterial({ color: theme.trench, transparent: true, opacity: field === 'far' ? 0.34 : 0.5, side: THREE.DoubleSide }),
    );
    glass.material.color.lerp(theme.accent, 0.14);
    frame.add(glass);

    let imageMesh = null;
    // Far field cố ý KHÔNG có ảnh: nó là silhouette tạo chiều sâu (mục 4.4),
    // không phải chỗ trống chờ nội dung.
    if (field !== 'far') {
      imageMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(size.image[0], size.image[1]),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: field === 'near' ? 0.94 : 0.8, side: THREE.DoubleSide }),
      );
      imageMesh.position.z = 0.02;
      frame.add(imageMesh);
      pending.push(loadTexture(images[i], tier.texture).then(texture => {
        if (texture) { imageMesh.material.map = texture; imageMesh.material.needsUpdate = true; }
      }));
    }

    frame.userData = {
      relic: true, field, index: i, sequence: i,
      url: field === 'far' ? null : images[i],
      caption: field === 'far' ? '' : (captions[i] || ''),
      base: frame.position.clone(), phase: Math.random() * 6,
      imageMesh, focused: false, hovered: false,
    };
    group.add(frame);
    relics.push(frame);
  }

  await Promise.all(pending);

  let visibleCount = relics.length;

  function update(dt, elapsed, camera) {
    relics.forEach((frame, i) => {
      const data = frame.userData;
      if (data.focused) {
        const target = camera.position.clone().add(new THREE.Vector3(0, 0, -5));
        frame.position.lerp(target, 1 - Math.pow(0.001, dt));
        return;
      }
      const hoverPull = data.hovered ? 0.32 : 0;
      frame.position.y = data.base.y + Math.sin(elapsed * 0.3 + data.phase) * (reducedMotion ? 0.03 : 0.18);
      frame.position.z = data.base.z + hoverPull;
      if (!reducedMotion) frame.rotation.z += Math.sin(elapsed * 0.25 + i) * 0.0007;

      if (frame.position.z > camera.position.z + 12) {
        data.base.z -= span;
        frame.position.z = data.base.z;
        if (plan.streamed && data.imageMesh) {
          data.sequence = (data.sequence + plan.relicCount) % images.length;
          data.url = images[data.sequence];
          data.caption = captions[data.sequence] || '';
          const mesh = data.imageMesh;
          loadTexture(data.url, tier.texture).then(texture => {
            if (texture) { mesh.material.map = texture; mesh.material.needsUpdate = true; }
          });
        }
      }
    });
  }

  function getRelics() { return relics.slice(0, visibleCount); }

  function setVisibleCount(count) {
    visibleCount = Math.max(0, Math.min(relics.length, count));
    relics.forEach((frame, i) => { frame.visible = i < visibleCount; });
  }

  return { group, update, getRelics, setVisibleCount };
}
```

- [ ] **Step 2: Kiểm chứng texture thực sự bị thu nhỏ**

Run: `npm run dev`, mở `/abyss/?galaxyId=<galaxy có ảnh lớn>`, dán vào console:

```js
const sizes = [];
window.__abyssScene?.traverse?.(o => { if (o.material?.map?.image) sizes.push(Math.max(o.material.map.image.width, o.material.map.image.height)); });
console.log(sizes);
```

Nếu `window.__abyssScene` chưa tồn tại, thêm tạm `window.__abyssScene = scene;` vào cuối `init()` trong `abyss.js` để kiểm tra, rồi gỡ đi.

Expected: mọi giá trị ≤ `tier.texture` (1024 ở HIGH, 768 ở MID, 512 ở LOW)

- [ ] **Step 3: Kiểm chứng far field bằng mắt**

Mở `/abyss/?galaxyId=<galaxy 14 ảnh>`, nhìn về phía trước ở phase `memory_trench`.

Expected: thấy 2–3 hình chữ nhật tối, nhỏ, **không có ảnh**, nằm xa hơn các relic có ảnh; chúng không click được ra lightbox.

- [ ] **Step 4: Commit**

```bash
git add public/abyss/js/scene/relics.js
git commit -m "feat(abyss): far-field relic silhouette và giới hạn kích thước texture theo tier"
```

---

### Task 7: Cross-fade phase thay cho bật/tắt đột ngột

**Files:**
- Modify: `public/abyss/js/scene/fauna.js:59-71` (hàm `update`)

Sửa lỗi #2 và #11 phần hiển thị. Hiện `actor.visible = visible` làm sinh vật xuất hiện tức thì.

- [ ] **Step 1: Thay hàm `update` trong `scene/fauna.js`**

```js
  function update(elapsed, phase, camera, blendInto, phaseTable, causticShafts = []) {
    actors.forEach(actor => {
      const meta = actor.userData.fauna;
      // startPhase phải tra theo ID, không theo index. Bảng phase co lại theo số
      // ảnh (mục 13.11), nên galaxy 3 ảnh chỉ có 3 phase — index 4-5 không tồn
      // tại. Phase vắng mặt nghĩa là actor đó không thuộc hành trình này.
      const startIndex = phaseTable.findIndex(entry => entry.id === meta.startPhaseId);
      if (startIndex < 0) { actor.visible = false; return; }
      // Cross-fade thay vì bật/tắt: hỏi director về ĐÚNG biên mà actor này
      // xuất hiện. blendInto liên tục 0->1 quanh biên đó bất kể phase hiện tại,
      // nên không bị đứt khi index nhảy (mục 13.4).
      const reveal = blendInto(startIndex);
      actor.visible = reveal > 0.001;
      if (!actor.visible) return;
      applyFade(actor, reveal);

      if (meta.type === 'jellyfish' || meta.type === 'fish' || meta.type === 'shrimp') {
        actor.position.x = meta.baseX + Math.sin(elapsed * 0.12 + meta.phase) * 2;
        if (!reducedMotion) actor.position.y += Math.sin(elapsed * 0.3 + meta.phase) * 0.0008;
      }
      if (meta.type === 'anemone') actor.rotation.z = Math.sin(elapsed * 0.45 + meta.phase) * 0.08;
      if (meta.type === 'ribbon') actor.rotation.y = Math.sin(elapsed * 0.08 + meta.phase) * 0.08;
      // Task 8 thay dòng dưới bằng counter-illumination theo caustic.
      if (meta.type === 'silhouette') actor.material.opacity = meta.baseOpacity * reveal * Math.min(1, phase.progress * 2);
      if (meta.type === 'memoryPool') actor.material.opacity = 0.08 * reveal * Math.min(1, phase.progress * 2);
    });
  }

  function applyFade(actor, reveal) {
    const meta = actor.userData.fauna;
    if (meta.type === 'silhouette' || meta.type === 'memoryPool') return; // tự quản opacity
    actor.traverse(child => {
      if (!child.material) return;
      if (child.userData.baseOpacity === undefined) child.userData.baseOpacity = child.material.opacity;
      child.material.opacity = child.userData.baseOpacity * reveal;
    });
  }
```

- [ ] **Step 2: Kiểm chứng**

Run: `npm run dev`, mở galaxy 14 ảnh, quan sát lúc HUD depth đi qua 210 M và 430 M.

Expected: anemone và fish school **mờ dần vào** trong khoảng vài mét, không hiện ra tức thì.

- [ ] **Step 3: Commit**

```bash
git add public/abyss/js/scene/fauna.js
git commit -m "feat(abyss): sinh vật cross-fade theo biên phase thay vì bật tắt đột ngột"
```

---

### Task 8: Counter-illumination cho `DeepSilhouette`

**Files:**
- Modify: `public/abyss/js/fx/water.js` (thêm `getCausticShafts`)
- Modify: `public/abyss/js/scene/fauna.js` (thêm `updateSilhouette`)

Thực thi mục 14.5. Sửa lỗi #11.

- [ ] **Step 1: Expose vị trí caustic shaft từ `fx/water.js`**

Trong `createWaterFX`, sau vòng lặp tạo `causticGroup`, thêm:

```js
  const causticShafts = causticGroup.children.map(shaft => ({ x: shaft.position.x, z: shaft.position.z }));
  function getCausticShafts() { return causticShafts; }
```

và đổi `return` cuối hàm thành:

```js
  return { group, update, triggerAlarm, getCausticShafts, setCausticsEnabled };
```

Thêm ngay trước `return`:

```js
  function setCausticsEnabled(enabled) { causticGroup.visible = enabled; }
```

- [ ] **Step 2: Thêm `updateSilhouette` vào `scene/fauna.js`**

Trong `createFauna`, thêm biến đếm và hàm (đặt ngay trước `function update`):

```js
  // Mục 14.5: sinh vật chỉ lộ ra khi cắt ngang một tia caustic, tối đa 2 lần
  // mỗi phiên. Người xem sẽ không chắc mình vừa nhìn thấy gì.
  let silhouetteReveals = 0;

  function updateSilhouette(actor, meta, camera, causticShafts) {
    if (meta.spent) { actor.material.opacity = 0; return; }
    let nearest = Infinity;
    for (const shaft of causticShafts) {
      const distance = Math.hypot(actor.position.x - shaft.x, actor.position.z - shaft.z);
      if (distance < nearest) nearest = distance;
    }
    const inShaft = Math.max(0, 1 - nearest / 14);
    const inRange = Math.max(0, 1 - Math.abs(actor.position.z - camera.position.z) / 120);
    const target = silhouetteReveals < 2 ? meta.baseOpacity * inShaft * inRange : 0;
    actor.material.opacity += (target - actor.material.opacity) * 0.04;
    if (!meta.counted && actor.material.opacity > meta.baseOpacity * 0.5) {
      meta.counted = true;
      silhouetteReveals += 1;
    }
    if (meta.counted && actor.material.opacity < 0.005) meta.spent = true;
  }
```

- [ ] **Step 3: Nối `updateSilhouette` vào `update`**

Trong hàm `update` của `scene/fauna.js`, thay dòng tạm đặt ở Task 7:

```js
      if (meta.type === 'silhouette') actor.material.opacity = meta.baseOpacity * reveal * Math.min(1, phase.progress * 2);
```

bằng:

```js
      if (meta.type === 'silhouette') updateSilhouette(actor, meta, camera, causticShafts);
```

- [ ] **Step 4: Đặt silhouette gần các shaft để chúng có cơ hội gặp nhau**

Trong `deepSilhouettes()`, thay dòng đặt vị trí bằng:

```js
      // Shaft caustic nằm ở x = (i - shaftCount/2) * 9, z = -25 - i*34.
      // Đặt silhouette lệch nhẹ khỏi shaft để nó chỉ "quét qua", không đứng trong sáng.
      silhouette.position.set(index ? 11 : -13, 5, z);
```

- [ ] **Step 5: Kiểm chứng**

Run: `npm run dev`, mở galaxy 14 ảnh trên tier HIGH, lặn qua depth 210–430 M, nhìn sang hai bên.

Expected: bóng lớn hiện mờ rồi tắt trong vài giây; sau hai lần, không hiện lại trong cùng phiên. Trên tier LOW (caustic tắt) silhouette không bao giờ hiện — đúng chủ ý.

- [ ] **Step 6: Commit**

```bash
git add public/abyss/js/fx/water.js public/abyss/js/scene/fauna.js
git commit -m "feat(abyss): DeepSilhouette chỉ lộ khi cắt ngang tia caustic"
```

---

### Task 9: Burglar alarm cục bộ và marine snow tách lớp

**Files:**
- Modify: `public/abyss/js/fx/water.js` (thay `pointsLayer` và phần plankton)

Sửa lỗi #9 và #10. Mục 6.3 cấm sinh vật phát sáng đồng loạt; mục 14.1 và 14.4.

- [ ] **Step 1: Thay `pointsLayer` bằng hai hàm riêng biệt**

Thay khối `function pointsLayer(...)` (dòng 3–17) trong `fx/water.js` bằng:

```js
const PLANKTON_VERTEX = `
  attribute float aFlash;
  varying float vFlash;
  varying float vProximity;
  void main() {
    vFlash = aFlash;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Bán kính 2.5 m quanh camera, tính trong view space nên CPU không phải làm gì.
    vProximity = 1.0 - clamp(length(mvPosition.xyz) / 2.5, 0.0, 1.0);
    gl_PointSize = 2.0 + 5.0 * max(vFlash, vProximity);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const PLANKTON_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uBase;
  varying float vFlash;
  varying float vProximity;
  void main() {
    float disc = 1.0 - smoothstep(0.35, 0.5, length(gl_PointCoord - vec2(0.5)));
    float glow = uBase + 0.55 * vFlash + 0.25 * vProximity;
    gl_FragColor = vec4(uColor, disc * glow);
  }
`;

// Plankton lơ lửng, phản ứng cục bộ với camera (mục 14.4).
function plankton(count, spread, zDepth, color, baseOpacity) {
  const positions = new Float32Array(count * 3);
  const flashes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * spread.x;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread.y;
    positions[i * 3 + 2] = -Math.random() * zDepth;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aFlash', new THREE.BufferAttribute(flashes, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: color }, uBase: { value: baseOpacity } },
    vertexShader: PLANKTON_VERTEX, fragmentShader: PLANKTON_FRAGMENT,
  });
  const points = new THREE.Points(geometry, material);
  points.userData.plankton = { flashes, spread, zDepth };
  return points;
}

// Marine snow rơi XUỐNG, chậm và đều. Đây là lớp ngược chiều với bubble.
function marineSnow(count, spread, zDepth, color, speedScale) {
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * spread.x;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread.y;
    positions[i * 3 + 2] = -Math.random() * zDepth;
    speeds[i] = (0.05 + Math.random() * 0.07) * speedScale;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({
    color, size: 0.06, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  points.userData.snow = { speeds, spread };
  return points;
}
```

- [ ] **Step 2: Thay phần khởi tạo ba lớp hạt**

Thay các dòng tạo `near` / `far` / `snow` (dòng 21–25 cũ) bằng:

```js
  const near = plankton(reducedMotion ? Math.floor(tier.near * 0.25) : tier.near, { x: 34, y: 24 }, 180, theme.memoryGlow, 0.16);
  const far = plankton(reducedMotion ? Math.floor(tier.far * 0.25) : tier.far, { x: 70, y: 48 }, 500, theme.bioluminescent, 0.1);
  const snow = marineSnow(reducedMotion ? Math.floor(tier.snow * 0.25) : tier.snow, { x: 44, y: 30 }, 260, theme.memoryGlow, reducedMotion ? 0.25 : 1);
  group.add(far, snow, near);
```

- [ ] **Step 3: Thay hàm `update`**

```js
  const cameraLocal = new THREE.Vector3();

  function triggerAlarm(worldPoint) { pendingAlarm = worldPoint ? worldPoint.clone() : null; }

  function update(dt, camera, elapsed) {
    // Marine snow: rơi xuống, tái sinh ở trên khi chạm đáy.
    for (const layer of [snow]) {
      const meta = layer.userData.snow;
      const positions = layer.geometry.attributes.position.array;
      for (let i = 0; i < meta.speeds.length; i++) {
        const y = i * 3 + 1;
        positions[y] -= meta.speeds[i] * dt;
        positions[i * 3] += Math.sin(elapsed * 0.2 + i) * 0.0006;
        if (positions[y] < -meta.spread.y / 2) positions[y] = meta.spread.y / 2;
      }
      layer.geometry.attributes.position.needsUpdate = true;
    }

    // Burglar alarm: chỉ những hạt trong 2.5 m quanh camera bật sáng, rồi tắt
    // dần trong 1.8 s, để lại một vệt sáng phía sau (mục 14.4).
    for (const layer of [near, far]) {
      const meta = layer.userData.plankton;
      const positions = layer.geometry.attributes.position.array;
      const flashes = meta.flashes;
      let touched = false;
      for (let i = 0; i < flashes.length; i++) {
        if (flashes[i] > 0) { flashes[i] = Math.max(0, flashes[i] - dt / 1.8); touched = true; }
        cameraLocal.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        layer.localToWorld(cameraLocal);
        if (cameraLocal.distanceTo(camera.position) < 2.5) { flashes[i] = 1; touched = true; }
      }
      if (touched) layer.geometry.attributes.aFlash.needsUpdate = true;
    }

    if (pendingAlarm) {
      const meta = near.userData.plankton;
      const positions = near.geometry.attributes.position.array;
      for (let i = 0; i < meta.flashes.length; i++) {
        cameraLocal.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
        near.localToWorld(cameraLocal);
        if (cameraLocal.distanceTo(pendingAlarm) < 3.5) meta.flashes[i] = 1;
      }
      near.geometry.attributes.aFlash.needsUpdate = true;
      pendingAlarm = null;
    }

    group.traverse(object => {
      if (object.userData.bubbleSpeed) {
        object.position.y += (reducedMotion ? object.userData.bubbleSpeed * 0.1 : object.userData.bubbleSpeed) * dt;
        if (object.position.y > 10) object.position.y = -8;
      }
      if (object.material?.uniforms?.uTime) object.material.uniforms.uTime.value += dt;
    });
  }
```

Thay dòng khai báo `let alarm = 0;` bằng `let pendingAlarm = null;`.

- [ ] **Step 4: Cập nhật chỗ gọi trong `abyss.js`**

Trong handler `pointermove`, thay `if (hit) waterFX?.triggerAlarm();` bằng:

```js
  if (hit) waterFX?.triggerAlarm(hit.getWorldPosition(new THREE.Vector3()));
```

- [ ] **Step 5: Kiểm chứng**

Run: `npm run dev`, mở bất kỳ galaxy nào, di chuyển camera.

Expected:
- Chỉ vùng hạt quanh camera sáng lên, phần còn lại giữ nguyên độ sáng nền — **không** cả màn hình sáng cùng lúc.
- Sau khi camera đi qua, vệt sáng còn lại khoảng 1.8 giây rồi tắt.
- Marine snow rơi xuống, bubble nổi lên; hai lớp phân biệt được bằng mắt.

- [ ] **Step 6: Commit**

```bash
git add public/abyss/js/fx/water.js public/abyss/js/abyss.js
git commit -m "feat(abyss): burglar alarm cục bộ và marine snow thành lớp riêng"
```

---

### Task 10: Whale fall nhận ảnh cũ nhất

**Files:**
- Modify: `public/abyss/js/scene/fauna.js` (thêm `attachOldestMemory`)

Thực thi mục 14.3. Sửa lỗi #15.

- [ ] **Step 1: Thêm `attachOldestMemory` vào `createFauna`**

Thêm ngay trước `return { group, update }`:

```js
  // Mục 14.3: cái đã mất vẫn tiếp tục nuôi. Ảnh cũ nhất trong galaxy được neo
  // vào xác cá voi, không phải chọn ngẫu nhiên.
  function attachOldestMemory(memory) {
    if (!memory?.url || !whaleFall) return;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 4.1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    );
    plane.position.set(0, 2.6, 0.4);
    plane.rotation.x = -0.18;
    new THREE.TextureLoader().load(memory.url, texture => {
      texture.colorSpace = THREE.SRGBColorSpace;
      plane.material.map = texture;
      plane.material.needsUpdate = true;
    }, undefined, () => {});
    plane.userData.relic = true;
    plane.userData.url = memory.url;
    plane.userData.caption = memory.caption || 'Ký ức đầu tiên';
    plane.userData.index = -1;
    whaleFall.add(plane);
    whaleFall.userData.memoryPlane = plane;
  }
```

- [ ] **Step 2: Đổi giá trị trả về**

```js
  return { group, update, attachOldestMemory };
```

- [ ] **Step 3: Kiểm chứng**

Run: `npm run dev`, mở galaxy 14 ảnh, lặn tới depth ~505 M (phase `living_ocean`).

Expected: thấy bộ xương sườn với một tấm ảnh mờ đặt giữa; ảnh đó là ảnh có `createdAt` sớm nhất — đối chiếu bằng cách gọi `/gallary/items?galaxyId=<id>` và sắp theo `createdAt` tăng dần.

- [ ] **Step 4: Commit**

```bash
git add public/abyss/js/scene/fauna.js
git commit -m "feat(abyss): neo ảnh cũ nhất của galaxy vào whale fall"
```

---

### Task 11: Hạ tier thực sự có tác dụng

**Files:**
- Modify: `public/abyss/js/abyss.js` (loop + hàm mới)

Sửa lỗi #12. `adaptiveTier.update()` đang trả `true` mà không ai đọc.

- [ ] **Step 1: Thêm hàm áp dụng tier**

Thêm vào `abyss.js`, trước `function loop`:

```js
// Hạ tier không dựng lại scene (quá tốn) — nó cắt bớt thứ đang vẽ.
function applyTier(config) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, config.pixelRatio));
  relics?.setVisibleCount(config.relics);
  waterFX?.setCausticsEnabled(config.caustics > 0);
  activity?.log({
    action: 'Viewer Performance Downgrade', feature: 'viewer', galaxyId,
    description: { template: 'abyss', tier: adaptiveTier.tier, fps: Math.round(averageFrame) },
  });
}
```

- [ ] **Step 2: Đọc giá trị trả về trong loop**

Thay dòng `adaptiveTier.update(dt, averageFrame); renderer.render(scene, camera);` bằng:

```js
  if (adaptiveTier.update(dt, averageFrame)) applyTier(adaptiveTier.config);
  renderer.render(scene, camera);
```

- [ ] **Step 3: Kiểm chứng bằng cách ép tier tụt**

Run: `npm run dev`, mở galaxy 14 ảnh, dán vào console để giả lập máy yếu:

```js
// Ép loop chậm lại để adaptive tier phải hạ xuống.
const block = () => { const end = performance.now() + 28; while (performance.now() < end); requestAnimationFrame(block); };
block();
```

Expected: sau khoảng 6–9 giây, log `Viewer Performance Downgrade` xuất hiện trong Network/console, số relic hiển thị giảm, caustic biến mất. Tải lại trang để dừng.

- [ ] **Step 4: Commit**

```bash
git add public/abyss/js/abyss.js
git commit -m "fix(abyss): áp dụng thật kết quả hạ tier thay vì bỏ qua"
```

---

### Task 12: Keyboard và focus (mục 13.9)

**Files:**
- Modify: `public/abyss/index.html` (thêm `#relic-focus-ring`, style cho `#relic-nav`)
- Modify: `public/abyss/js/abyss.js` (focus ring, focus trap, trả focus)

Sửa lỗi #13 và #14.

- [ ] **Step 1: Thêm markup và style**

Trong `<style>` của `public/abyss/index.html`, thay dòng `#relic-nav { ... }` bằng:

```css
    #relic-nav { position: fixed; left: 10px; bottom: 10px; z-index: 6; display: flex; gap: 6px; }
    #relic-nav button { width: 1px; height: 1px; padding: 0; overflow: hidden; border: 0; clip-path: inset(50%); background: transparent; color: transparent; }
    #relic-nav button:focus-visible { position: fixed; left: 50%; bottom: 84px; transform: translateX(-50%); width: auto; height: auto; clip-path: none; padding: 8px 14px; border: 1px solid rgba(184,255,240,.5); border-radius: 999px; background: rgba(1,8,12,.86); color: #b8fff0; font: 12px system-ui, sans-serif; }
    #relic-focus-ring { display: none; position: fixed; z-index: 7; pointer-events: none; border: 2px solid #b8fff0; border-radius: 4px; box-shadow: 0 0 18px rgba(184,255,240,.4); transition: opacity .2s ease; }
    #relic-focus-ring.visible { display: block; }
```

Thêm ngay sau `<nav id="relic-nav" ...></nav>`:

```html
  <div id="relic-focus-ring" aria-hidden="true"></div>
```

- [ ] **Step 2: Vẽ focus ring theo vị trí projected của relic**

Thêm vào `abyss.js`, sau `renderRelicNav`:

```js
const focusRing = document.getElementById('relic-focus-ring');
const projected = new THREE.Vector3();
let keyboardRelic = null;

function updateFocusRing() {
  if (!keyboardRelic || !focusRing) { focusRing?.classList.remove('visible'); return; }
  keyboardRelic.getWorldPosition(projected);
  projected.project(camera);
  if (projected.z > 1) { focusRing.classList.remove('visible'); return; }
  const x = (projected.x * 0.5 + 0.5) * innerWidth;
  const y = (-projected.y * 0.5 + 0.5) * innerHeight;
  const size = Math.max(48, 260 / Math.max(1, camera.position.distanceTo(keyboardRelic.getWorldPosition(new THREE.Vector3())) * 0.12));
  focusRing.style.left = `${Math.round(x - size / 2)}px`;
  focusRing.style.top = `${Math.round(y - size * 0.65)}px`;
  focusRing.style.width = `${Math.round(size)}px`;
  focusRing.style.height = `${Math.round(size * 1.3)}px`;
  focusRing.classList.add('visible');
}
```

- [ ] **Step 3: Thay `renderRelicNav` để sắp theo khoảng cách và nối focus**

```js
function renderRelicNav() {
  if (!relicNav || !relics) return;
  relicNav.replaceChildren();
  // Thứ tự Tab đi từ relic gần nhất ra xa nhất (mục 13.9).
  const ordered = relics.getRelics()
    .filter(item => item.userData.url)
    .sort((a, b) => b.position.z - a.position.z);
  ordered.forEach(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = item.userData.caption || `Ký ức ${item.userData.index + 1}`;
    button.addEventListener('focus', () => { keyboardRelic = item; item.userData.hovered = true; });
    button.addEventListener('blur', () => { if (keyboardRelic === item) keyboardRelic = null; item.userData.hovered = false; });
    button.addEventListener('click', () => { lastFocusedButton = button; openRelic(item); });
    relicNav.appendChild(button);
  });
}
```

Khai báo `let lastFocusedButton = null;` cạnh `let focusedRelic = null;`.

- [ ] **Step 4: Focus trap và trả focus trong lightbox**

Thay `openRelic` / `closeRelic` bằng:

```js
function openRelic(relic) {
  if (!relic?.userData?.url) return;
  focusedRelic = relic;
  relic.userData.focused = true;
  pausedForReading = true;
  lightboxImage.src = relic.userData.url;
  lightboxCaption.textContent = relic.userData.caption || 'Một mảnh ký ức dưới đáy biển';
  lightbox.classList.add('open');
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-modal', 'true');
  document.getElementById('lightbox-close')?.focus();
  beacon?.triggerPulse();
  activity?.log({ action: 'Viewer Photo Open', feature: 'viewer', galaxyId, description: { template: 'abyss', photoIndex: relic.userData.index } });
}

function closeRelic() {
  if (!lightbox.classList.contains('open')) return;
  lightbox.classList.remove('open');
  lightbox.removeAttribute('aria-modal');
  lightboxImage.removeAttribute('src');
  if (focusedRelic) {
    focusedRelic.userData.focused = false;
    // Relic bị kéo về phía camera lúc mở — trả nó về chỗ cũ.
    focusedRelic.position.copy(focusedRelic.userData.base);
  }
  focusedRelic = null;
  pausedForReading = false;
  lastFocusedButton?.focus();
}

// Focus trap: Tab trong lightbox chỉ quẩn quanh nút đóng.
document.addEventListener('keydown', event => {
  if (!lightbox.classList.contains('open')) return;
  if (event.key === 'Escape') { closeRelic(); return; }
  if (event.key === 'Tab') { event.preventDefault(); document.getElementById('lightbox-close')?.focus(); }
});
```

Xoá handler `keydown` cũ chỉ bắt `Escape` để không đăng ký hai lần.

- [ ] **Step 5: Gọi `updateFocusRing` trong loop**

Thêm ngay trước `renderer.render(scene, camera);`:

```js
  updateFocusRing();
```

- [ ] **Step 6: Kiểm chứng bằng bàn phím, không chạm chuột**

Run: `npm run dev`, mở galaxy 8 ảnh, chỉ dùng bàn phím:

```text
Tab      → nhãn caption hiện ở đáy màn hình, vòng sáng bám đúng relic tương ứng
Tab tiếp → chuyển sang relic xa hơn
Enter    → mở lightbox, focus nằm ở nút đóng
Tab      → focus không thoát khỏi lightbox
Esc      → đóng, focus quay lại đúng nút vừa bấm
```

Expected: cả 5 bước đạt. Kiểm tra contrast của `#b8fff0` trên `#01080C` bằng DevTools → ≥ 4.5:1.

- [ ] **Step 7: Commit**

```bash
git add public/abyss/index.html public/abyss/js/abyss.js
git commit -m "feat(abyss): điều hướng relic bằng bàn phím, focus ring và focus trap"
```

---

### Task 13: Nối vào `npm test` và chốt nghiệm thu

**Files:**
- Modify: `package.json`
- Modify: `public/abyss/index.html` (bump `?v=`)
- Create: `docs/superpowers/plans/2026-08-18-abyss-dod-checklist.md`

- [ ] **Step 1: Hoàn tất danh sách file trong `test:abyss`**

`test:abyss` đã được tạo và nối vào `"test"` từ Task 1, nhưng mỗi task sau đó phải tự thêm file test của mình vào. Xác nhận `package.json` giờ liệt kê đủ bốn file:

```json
    "test:abyss": "node --test tests/abyss-depth.test.js tests/abyss-palette.test.js tests/abyss-layout.test.js tests/abyss-phases.test.js",
```

và dòng `"test"` kết thúc bằng ` && npm run test:abyss`.

Nếu task nào đó quên thêm file của mình, thêm nốt ở đây.

- [ ] **Step 2: Chạy riêng suite abyss**

Run: `npm run test:abyss`
Expected: PASS — 32 tests, 0 fail

- [ ] **Step 3: Chạy toàn bộ test để chắc không làm hỏng gì khác**

Run: `npm test`
Expected: tất cả suite PASS. Nếu một suite khác đã đỏ từ trước khi bắt đầu, ghi lại kết quả gốc và so sánh — không được thêm lỗi mới.

- [ ] **Step 4: Bump version asset**

Trong `public/abyss/index.html`, đổi:

```html
  <script type="module" src="./js/abyss.js?v=20260818-abyss4"></script>
```

thành:

```html
  <script type="module" src="./js/abyss.js?v=20260818-abyss5"></script>
```

- [ ] **Step 5: Tạo checklist nghiệm thu**

Tạo `docs/superpowers/plans/2026-08-18-abyss-dod-checklist.md`:

```markdown
# Abyss — Definition of Done

Đối chiếu mục 11, 12 và 13.10 của `docs/abyss-universe-visual-spec.md`.

## Tự động

- [ ] `npm run test:abyss` — 32 tests PASS
- [ ] `npm test` — không có suite nào đỏ thêm so với trước
- [ ] Test ΔE: theme `#FF00AA` không làm lệch màu scene quá 2 (trong `tests/abyss-palette.test.js`)
- [ ] Test bố cục: N = 0 / 1 / 3 / 8 / 16 / 40 đều cho plan hợp lệ

## Thủ công — screenshot

Chụp 1440×900 tại ba mốc, đối chiếu reference board ở mục 2:

- [ ] depth 60 M — chỉ nước tối, marine snow, chưa thấy relic
- [ ] depth 350 M — beacon rõ, relic ba lớp gần/giữa/xa
- [ ] depth 560 M — beacon tắt dần, còn một relic và khoảng tối

## Thủ công — hiệu năng

- [ ] Lighting model unlit, 0 dynamic light (mục 13.5). Kiểm bằng:
      `grep -rn "PointLight\|DirectionalLight\|SpotLight\|AmbientLight\|HemisphereLight" public/abyss/js/`
      → không in ra dòng nào
- [ ] Draw calls ≤ 60 trên HIGH, ≤ 30 trên LOW (DevTools → `renderer.info.render.calls`)
- [ ] FPS ≥ 50 trên tier MID (máy chuẩn: laptop Intel Iris tích hợp)
- [ ] FPS ≥ 30 trên tier LOW (mobile tầm trung)
- [ ] First frame < 2.5 s với DevTools throttle "Fast 4G"
- [ ] Texture không vượt `tier.texture` (kiểm bằng snippet ở Task 6 Step 2)

## Thủ công — mục 11, tám điều cấm

- [ ] Không starfield
- [ ] Không orbit ring thống trị bố cục
- [ ] Không quả cầu trung tâm màu trắng
- [ ] Không ảnh dựng thành hàng phẳng
- [ ] Không theme màu trực tiếp lên toàn scene
- [ ] Không scene sáng đều từ mọi phía
- [ ] Không toàn bộ sinh vật pulse cùng lúc
- [ ] Không model 3D nặng khi procedural đủ tốt (xác nhận: 0 file `.glb` được tải)

## Thủ công — accessibility

- [ ] `prefers-reduced-motion` tắt forward drift, sway, fauna drift, caustic
- [ ] Tab → Enter → Esc đi hết một vòng bằng bàn phím
- [ ] Focus ring bám đúng relic
- [ ] Focus quay về đúng nút sau khi đóng lightbox
- [ ] Contrast caption ≥ 4.5:1

## Thủ công — parity

- [ ] Preview admin và `/view/` public dùng cùng scene graph, cùng kết quả
```

- [ ] **Step 6: Commit**

```bash
git add package.json public/abyss/index.html docs/superpowers/plans/2026-08-18-abyss-dod-checklist.md
git commit -m "chore(abyss): nối suite test abyss vào npm test và thêm checklist nghiệm thu"
```

- [ ] **Step 7: Xác nhận không còn file abyss nào ngoài git**

Toàn bộ `public/abyss/` đã được đưa vào git ở commit baseline `7032923` (xem mục "Baseline" ở đầu plan), nên bước này chỉ còn là kiểm tra:

Run: `git status --short public/abyss/`
Expected: không in ra dòng nào.

---

## Ngoài phạm vi plan này

Ghi ra để không ai tưởng là quên:

- **`MemoryLattice` (mục 14.2)** — Venus' flower basket làm relic riêng cho ảnh favourite. Cần một khái niệm "favourite" ở tầng dữ liệu mà `models/galaxy.js` hiện chưa có, nên nó là một plan riêng.
- **`MemoryPool` phản chiếu thật (mục 14.6)** — hiện chỉ là đĩa additive phẳng, chưa có bản sao lật của relic cuối.
- **`DriftRibbon` chuyển động (mục 14.7)** — hình dạng đã có, chưa trôi ngang 0.15 m/s.
- **Hydrothermal shimmer (mục 14.8)** — đã có trong `beacon.js:24-30`, chưa hiệu chỉnh cường độ.
- **Audio theo phase** — mục 8 nhắc soundscape nhưng chưa nối vào `phaseDirector`; thuộc về spec soundscape, không thuộc spec này.
- **Số 4 phút 38 giây** — hành trình đầy đủ ở mục 13.4. Product cần xác nhận trước khi chốt; nếu đổi, sửa `diveDistance` trong `core/layout.js` và test ở Task 3 sẽ bắt được.

## Nợ kỹ thuật Task 5 để lại cho Task 6–10

Task 5 nối bốn module `core/` vào `abyss.js` nhưng **không được phép** chạm `fx/` hay `scene/`. Ba hệ quả, mỗi cái có task chịu trách nhiệm:

1. **Vị trí trong `scene/` vẫn là z tuyệt đối, giả định luôn lặn 500–620 m.** Giờ `diveDistance` xuống tới 180 m. Galaxy 2 ảnh dừng ở z ≈ −175, trong khi relic bắt đầu ở z = −180, whale fall ở −505 và memory pool ở −570 — tất cả nằm ngoài hành trình. Hiện tượng: lặn qua vùng nước trống. **Task 6** sửa relic (dùng `relicDistanceAt`). **Task 10** phải đặt whale fall theo `plan.diveDistance` chứ không phải hằng số, nếu không landmark mang ảnh cũ nhất sẽ không bao giờ xuất hiện với galaxy nhỏ.

2. **`scene/fauna.js` dùng `startPhase` là chỉ số cứng 1–5, giả định bảng 6 phase.** Bảng co lại theo số ảnh, nên galaxy ≤ 3 ảnh chỉ có 3 phase và index 4–5 không tồn tại. **Task 7** đổi sang tra theo `startPhaseId`; phase vắng mặt nghĩa là actor không thuộc hành trình này và bị ẩn hẳn.

3. **`endDepth` ở `abyss.js` chỉ được đọc đúng một lần** (dựng bảng phase), và giá trị khởi tạo `D0 + 500` là code chết. Vô hại, để nguyên.

### Commit trung gian hỏng, lần thứ hai

Task 4 làm `createPhaseDirector(table)` throw khi thiếu bảng, nhưng `abyss.js:59` vẫn gọi `createPhaseDirector()` không tham số cho tới Task 5. Nghĩa là ở commit `15d2bdb`, `abyss.js` **throw ngay khi load module** — template chết hoàn toàn trong trình duyệt. `acf74ba` sửa lại.

Đây là lần thứ hai thứ tự task sinh ra commit không tự đứng vững (lần đầu là `bb1755d`). Bài học cho phần còn lại: khi một task đổi chữ ký hàm mà caller nằm ở task sau, hai task đó phải gộp làm một commit, hoặc task trước phải giữ tương thích ngược.

## Phát hiện Task 6 chuyển cho task sau

- **Ngân sách 48 MB texture không giữ được với ảnh vuông.** Đo ở tier HIGH: 11 relic có ảnh, `texture: 1024`. Ảnh 3:2 thành 1024×683 → 2.67 MiB + mipmap ≈ 3.56 MiB → tổng 39 MiB, đạt. Ảnh vuông thành 1024×1024 → 4 MiB + mipmap ≈ 5.59 MiB → tổng **61 MiB, vượt trần**. Sửa ở `core/tiers.js` (hạ `high.texture` xuống 896 cho ~47 MiB) — **Task 11** sở hữu file đó.

- **`renderRelicNav()` không lọc far relic.** Silhouette far mang `relic: true` nhưng `url: null`, nên chúng nhận nút bàn phím có nhãn `Ký ức 5/6/7` mà bấm không làm gì. Galaxy 4 ảnh có 3 điểm dừng Tab chết. Phá dòng DoD "Tab → Enter → Esc đi hết một vòng". **Task 12** đã có `.filter(item => item.userData.url)` trong bản viết lại — kiểm lại khi tới đó.

- **`beacon.js:26` cất `theme.accent` theo tham chiếu vào shader uniform** (`uniforms.uColor.value`). Vật liệu thì copy màu, uniform thì không. Bất kỳ code nào sau này sửa tại chỗ một `theme.*` Color sẽ nhuộm lây beacon. Hiện chưa ai làm. **Task 8** chạm `beacon.js` — giữ nguyên tắc không mutate màu theme tại chỗ.

## Phát hiện Task 7 chuyển cho task sau

- **`beacon.js` đặt cứng ở `z = -292`.** Nằm ngoài hẳn hành trình 180 m của galaxy ≤ 3 ảnh, và `memoryShrimp` được đặt để sống cạnh nó. Cùng loại nợ mà Task 7 vừa xử cho fauna: neo vào hằng số trong khi `plan.diveDistance` biến thiên 180–620 m. **Task 8** sở hữu file này — đổi sang tỉ lệ của `plan.diveDistance` như `PLACEMENT` trong `fauna.js`.

- **`seabed.js` sàn đáy là `PlaneGeometry(90, 640)` ở `z = -300`,** tức kết thúc ở z −620, trong khi ở `diveDistance = 620` camera trôi tới −622. Người xem ra khỏi mép đáy biển ở đúng cảnh cuối. Chưa task nào sở hữu — xử lý cùng lúc với beacon nếu tiện.

- **Ba concept của mục 14 từng là code chết.** `whaleFall` và `memoryPool` không bao giờ với tới (z −505/−570 vs camera dừng ở −502), và `LanternFishSchool` chưa từng render đúng vì meta thiếu `baseX` khiến `position.x = undefined + sin(...)` cho `NaN`, làm hỏng ma trận của cả group. Bài học: mọi vật thể đặt bằng hằng số z cần được đối chiếu với điểm dừng thật của camera, không phải với chiều dài scene.

## Lỗi đã biết, chưa sửa

**`buildPhaseTable` trả `NaN` khi mọi phase id đều lạ.** `core/layout.js:23` dùng `PHASE_WEIGHTS[id] ?? 0` để một id lạ không làm hỏng các phase hợp lệ khác — nhưng nếu *toàn bộ* id đều lạ thì `totalWeight = 0` và phép chia `0/0` cho `NaN` ở mọi biên. Ví dụ: `buildPhaseTable(['bogus'], 40, 540)`.

Không tới được từ `planContent` (nó chỉ truyền id hợp lệ) và cũng không từ Task 5 (truyền `plan.phaseIds`). Để lại thay vì thêm một vòng review cho một nhánh không có caller. Nếu sau này `buildPhaseTable` nhận danh sách phase từ nguồn ngoài, thêm `if (totalWeight === 0) return ...` trước vòng `map`.

## Quyết định còn treo

**Theme không màu mất hoàn toàn ảnh hưởng accent.** Task 2 phát hiện theme xám/đen/trắng đi vòng qua ràng buộc hue: `hexToHsl` trả `s: 0`, hue được kẹp đúng vào dải teal rồi bị `hslToHex` vứt bỏ ở nhánh `s === 0`, kết quả kéo accent về phía xám — ngược hẳn ý đồ mục 3. Đo được: theme `#000000` kéo accent lệch ΔE 6.84, gấp 2.7 lần theme `#00FFFF` (2.51).

Cách sửa đã áp dụng (`core/palette.js`, `accentFrom`): theme có `s === 0` thì trả về accent gốc của scene, không mix. Lý do chọn cách này thay vì thêm sàn saturation `max(0.25, s)`: bịa ra độ bão hoà mà user không chọn là lời nói dối tệ hơn việc từ chối áp dụng một theme không có hue.

**Hệ quả cần product quyết:** người cố ý chọn theme trắng/xám giờ thấy kết quả không khác gì không chọn theme nào. Có thể lập luận đó là âm thầm bỏ qua lựa chọn hợp lệ. Phương án mềm hơn: cho theme `s === 0` tác động vào *lightness* của accent thay vì hue — giữ được chút cá nhân hoá mà không phá ràng buộc dải teal. Chưa làm; cần quyết định sản phẩm, không phải lỗi đúng/sai.
