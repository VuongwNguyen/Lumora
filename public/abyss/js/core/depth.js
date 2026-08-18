// Không import three. Module này phải chạy được trong Node để test.

export const D0 = 40;
export const START_Z = 5;

// 1 - exp(-(density * d)^2) = 0.9  =>  density * d = sqrt(ln 10)
const DENSITY_TIMES_D90 = Math.sqrt(Math.log(10));

export function densityFromD90(d90) {
  return DENSITY_TIMES_D90 / d90;
}

// Mốc nội suy density theo độ sâu lặn (m). Density lấy nguyên từ bảng 13.2, ở đó
// mỗi dải độ sâu ứng với một D90 = tầm nhìn (KHÔNG phải độ sâu):
//   D90 140 / 100 / 70 / 50 m  =>  densityFromD90 = 0.0108 / 0.0152 / 0.0217 / 0.0304.
// Riêng mốc 40 m là giá trị ngoại suy sát mặt nước, không sinh ra từ D90.
export const FOG_DENSITY_STOPS = Object.freeze([
  Object.freeze({ depth: 40, density: 0.0080 }),
  Object.freeze({ depth: 120, density: 0.0108 }),
  Object.freeze({ depth: 210, density: 0.0152 }),
  Object.freeze({ depth: 330, density: 0.0217 }),
  Object.freeze({ depth: 430, density: 0.0304 }),
]);

export function densityForDepth(depth) {
  if (depth <= FOG_DENSITY_STOPS[0].depth) return FOG_DENSITY_STOPS[0].density;
  for (let i = 1; i < FOG_DENSITY_STOPS.length; i++) {
    const stop = FOG_DENSITY_STOPS[i];
    const previous = FOG_DENSITY_STOPS[i - 1];
    if (depth <= stop.depth) {
      const t = (depth - previous.depth) / (stop.depth - previous.depth);
      return previous.density + (stop.density - previous.density) * t;
    }
  }
  return FOG_DENSITY_STOPS[FOG_DENSITY_STOPS.length - 1].density;
}

export function depthFromZ(z, startZ = START_Z, d0 = D0) {
  return d0 + (startZ - z);
}

// tau = hằng số thời gian tính bằng giây.
export function easeTowards(current, target, dt, tau) {
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}
