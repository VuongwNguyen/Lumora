// Không import three. Toàn bộ toán màu của abyss sống ở đây để test được.

export const ABYSS_PALETTE = Object.freeze({
  // deepWater là ĐÁY của dải màu nước, không phải màu nước duy nhất. Trước đây
  // fog và background dùng đúng một hex ở mọi độ sâu và chỉ đổi mật độ, nên
  // nước 40 m trông y hệt nước 620 m: một thứ xám xanh đục. Dải màu thật nằm ở
  // WATER_COLOR_STOPS bên dưới; hằng số này giữ nguyên vai trò "màu rãnh sâu
  // nhất" mà mục 13.10 và abyss-palette.test.js đang khoá.
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

// Mốc màu nước theo độ sâu lặn (m), khớp đúng các mốc của FOG_DENSITY_STOPS ở
// core/depth.js — hai dải phải đổi cùng nhịp, nếu không sẽ có quãng nước đặc mà
// vẫn sáng hoặc loãng mà đã tối đen.
//
// Vì sao nước cũ trông "ô nhiễm": #02151B có độ bão hoà HSL tới 86% nhưng độ
// sáng chỉ 5.7%. ACESFilmicToneMapping ở exposure .74 nén tiếp vùng tối và rút
// bão hoà của nó, nên cyan ra màn thành xám xanh. Cách chữa là NÂNG ĐỘ SÁNG ở
// dải nông chứ không phải bơm thêm bão hoà.
//
// Mốc 430 m giữ nguyên deepWater: rãnh sâu vẫn phải là mực đen, chỉ quãng
// 40-330 m mới là nước có màu.
export const WATER_COLOR_STOPS = Object.freeze([
  Object.freeze({ depth: 40, color: '#12707F' }),
  Object.freeze({ depth: 120, color: '#0C5566' }),
  Object.freeze({ depth: 210, color: '#083E52' }),
  Object.freeze({ depth: 330, color: '#042838' }),
  Object.freeze({ depth: 430, color: ABYSS_PALETTE.deepWater }),
]);

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

// Nội suy trong KHÔNG GIAN sRGB rồi mới giao hex cho THREE.Color.set(). Lerp
// hai THREE.Color là lerp trong linear (ColorManagement bật mặc định ở r152),
// cho màu sáng hơn hẳn mức tính nhẩm — đúng cái bẫy CLAUDE.md mục 6 ghi.
export function waterColorForDepth(depth) {
  const stops = WATER_COLOR_STOPS;
  if (!Number.isFinite(depth) || depth <= stops[0].depth) return stops[0].color;
  for (let i = 1; i < stops.length; i++) {
    if (depth > stops[i].depth) continue;
    const previous = stops[i - 1];
    const t = (depth - previous.depth) / (stops[i].depth - previous.depth);
    return mixHex(previous.color, stops[i].color, t);
  }
  return stops[stops.length - 1].color;
}

// Sàn và rặng đáy biển phải TỐI HƠN nước để còn đọc ra là mặt đất, nhưng cùng
// hệ màu với nước — không phải một hằng số đen cố định. #01080C cũ đúng ở rãnh
// sâu và sai hẳn ở 60 m: trên nền teal sáng nó thành một mảng đen phẳng cắt
// ngang khung hình.
//
// 0.58 (sàn = nước × 0.42) chọn để ở mốc sâu nhất công thức trả về gần đúng
// trenchShadow cũ. Nhưng ĐO trên browser thì dải sàn tiền cảnh ở 67 m có
// luminance trung bình 22/255 và độ lệch chuẩn 3.96 — tức caustic chỉ tạo được
// biến thiên ±4 mức, dưới ngưỡng mắt phân biệt trong vùng tối.
//
// Và vì caustic là phép NHÂN, không hệ số nào chữa được: nhân một nền gần đen
// vẫn ra gần đen. Muốn thấy "wave/material response" ở tiền cảnh thì phải nâng
// chính mặt sàn, không phải nâng ánh sáng chiếu lên nó. Đây là chỗ khác nhau
// giữa "làm sáng scene" và "cho nền đủ tầm để ánh sáng có chỗ hiện".
//
// 0.44 (sàn = nước × 0.56) giữ sàn vẫn tối hơn nước rõ rệt; ở rãnh sâu nhất
// cho #010b0f, tức vẫn là mực đen.
const SEABED_DARKEN = 0.44;

export function seabedColorForDepth(depth) {
  return mixHex(waterColorForDepth(depth), '#000000', SEABED_DARKEN);
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
