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
