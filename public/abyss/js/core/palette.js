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
  const channel = (v) => {
    const safe = Number.isFinite(v) ? v : 0;
    return Math.round(Math.min(1, Math.max(0, safe)) * 255).toString(16).padStart(2, '0');
  };
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
// đối số chỉ để khớp cách gọi đối xứng với resolveAccents(userTheme) trong theme.js.
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
  const hsl = hexToHsl(candidate);
  if (!hexToRgb(candidate)) return rgbToHex(hexToRgb(base));
  // Theme không màu (xám/đen/trắng) không nói lên sở thích accent nào:
  // hslToHex sẽ vứt bỏ hue đã kẹp, kéo accent về phía xám thay vì teal.
  if (hsl.s === 0) return rgbToHex(hexToRgb(base));
  return mixHex(base, hslToHex(constrainAccentHsl(hsl)), ACCENT_MIX);
}

export function resolveAccents(userTheme) {
  const theme = userTheme && typeof userTheme === 'object' ? userTheme : {};
  return Object.freeze({
    accent: accentFrom(theme.primary, ABYSS_PALETTE.bioluminescent),
    accentSecondary: accentFrom(theme.secondary, ABYSS_PALETTE.memoryGlow),
  });
}
