import * as THREE from 'three';
import { START_Z } from '../core/depth.js';

// ---------------------------------------------------------------------------
// Nước ở đây là CỬA SỔ ĐI THEO CAMERA, không phải một khối nước đứng yên.
//
// Trước đây mỗi lớp hạt là một hộp cố định z ∈ [-zDepth, 0] với zDepth = 180 /
// 500 / 260 m. Camera lặn tới z = 5 - diveDistance - 7.2, mà diveDistance chạy
// tới 620 m (mục 13.11), nên ở galaxy dài nhất lớp plankton gần tắt hẳn sau
// 180 m đầu: 2/3 hành trình bơi trong nước rỗng, và burglar-alarm (mục 14.4)
// — thứ chỉ tồn tại ở lớp plankton gần — chết theo.
//
// Hai cách sửa: (a) kéo dài lớp hạt bằng đúng quãng lặn rồi tăng số hạt cho
// khỏi loãng — ở 620 m thành 5 167 hạt riêng lớp gần, gấp 3.4 lần, và vòng lặp
// CPU của burglar-alarm cũng to lên chừng đó; hoặc (b) cho hạt cuộn vòng quanh
// camera. Chọn (b): số hạt giữ nguyên theo tier, mật độ giữ nguyên, và độ phủ
// đúng bằng cả hành trình dù dài bao nhiêu.
//
// Bề dày cửa sổ vẫn suy từ plan.diveDistance (hiệu chỉnh ở 500 m để trùng đúng
// số cũ), chỉ là nó điều khiển MẬT ĐỘ hạt/mét chứ không còn điều khiển độ phủ.
// ---------------------------------------------------------------------------

const DEFAULT_DIVE = 500;
const LAYER_BEHIND = 6;        // mét sau lưng camera trước khi hạt được cuộn ra trước
const FLASH_FADE = 1.8;        // mục 14.4: tắt dần trong 1.8 s
const WAKE_RADIUS = 2.5;       // mục 14.4: bán kính plankton sáng quanh camera
const ALARM_RADIUS = 3.5;      // bán kính khi thứ khác (con trỏ, relic) khuấy nước

// Chia đôi giữa "cố định" và "tỉ lệ quãng lặn". Tỉ lệ thuần làm quãng 180 m đặc
// gấp 2.8 lần quãng 500 m (cùng số hạt, cửa sổ ngắn hơn 2.8 lần); nửa-nửa giữ
// mật độ trong khoảng 1.47x (180 m) tới 0.89x (620 m) so với hôm nay ở 500 m.
function layerSpan(dive, reference) {
  return reference * (0.5 + 0.5 * (dive / DEFAULT_DIVE));
}

// Cuộn một toạ độ z về cửa sổ [camZ + LAYER_BEHIND - span, camZ + LAYER_BEHIND].
// Dùng ceil thay vì vòng while để lần reset dive (camera nhảy về +5) hay nút
// "Lặn sâu hơn" (nhảy -90 m) cũng về đúng chỗ ngay trong một khung hình.
function wrapZ(z, cameraZ, span) {
  const offset = z - cameraZ - LAYER_BEHIND;
  if (offset > 0 || offset <= -span) return z - span * Math.ceil(offset / span);
  return z;
}

// Mục 14.4 — burglar alarm. Tảo giáp sáng khi BỊ KHUẤY ĐỘNG, và ánh sáng đó tố
// cáo vị trí kẻ khuấy nó; mục 6.3 cấm cả đàn sáng đồng loạt. Vì vậy độ sáng
// nằm ở TỪNG HẠT (attribute aFlash + số hạng khoảng cách tính trong view space),
// không phải ở material.opacity của cả lớp như bản cũ.
const PLANKTON_VERTEX = `
  attribute float aFlash;
  // Mảnh vụn lơ lửng không cùng cỡ và không cùng độ sáng. Bản trước mọi hạt
  // dùng đúng một gl_PointSize và đúng một uBase, nên lớp hạt đọc ra là trường
  // sao — thứ mục 11 cấm đầu tiên. Hai attribute dưới đây phá sự đồng đều đó
  // mà không thêm một draw call hay một hạt nào.
  attribute float aScale;
  attribute float aDim;
  uniform float uPixelRatio;
  varying float vDim;
  varying float vFlash;
  varying float vProximity;
  varying float vFogDepth;
  void main() {
    vFlash = aFlash;
    vDim = aDim;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vFogDepth = -mvPosition.z;
    // Bán kính 2.5 m quanh camera, tính trong view space nên CPU không phải làm gì.
    vProximity = 1.0 - clamp(length(mvPosition.xyz) / 2.5, 0.0, 1.0);
    // PointsMaterial thu nhỏ hạt theo khoảng cách (sizeAttenuation), ShaderMaterial
    // thì không — bỏ trắng thì hạt cách 2 m và hạt cách 80 m to bằng nhau, mất luôn
    // lớp gần/xa của mục 12. Chặn hai đầu để hạt sát mặt không thành đốm loang.
    float attenuation = clamp(14.0 / max(vFogDepth, 0.1), 0.4, 3.0);
    // gl_PointSize tính bằng pixel framebuffer: nhân pixelRatio để hạt giữ nguyên
    // kích thước thị giác trên màn DPR 2.
    gl_PointSize = (2.0 * aScale + 5.0 * max(vFlash, vProximity)) * uPixelRatio * attenuation;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const PLANKTON_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uBase;
  uniform float fogDensity;
  varying float vDim;
  varying float vFlash;
  varying float vProximity;
  varying float vFogDepth;
  void main() {
    float disc = 1.0 - smoothstep(0.35, 0.5, length(gl_PointCoord - vec2(0.5)));
    float glow = uBase * vDim + 0.55 * vFlash + 0.25 * vProximity;
    // PointsMaterial có material.fog = true nên lớp plankton cũ chìm dần vào sương
    // (mục 6.1); ShaderMaterial mặc định fog = false. Hạt cộng dồn nên sương phải
    // NHÂN vào alpha, không phải trộn màu — trộn màu chỉ làm nền sáng thêm.
    float transmittance = exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    gl_FragColor = vec4(uColor, disc * glow * transmittance);
  }
`;

// gl_PointSize tính bằng pixel của framebuffer, nên trên màn DPR 2 một hạt "2.0"
// chỉ còn 1 CSS px. Nhân lại đúng pixelRatio mà abyss.js đưa cho renderer để
// kích thước hạt không đổi theo màn hình.
function planktonLayer(count, spread, span, color, base, pixelRatio) {
  const positions = new Float32Array(count * 3);
  const flash = new Float32Array(count);
  const phase = new Float32Array(count);
  const scale = new Float32Array(count);
  const dim = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - .5) * spread.x;
    positions[i * 3 + 1] = (Math.random() - .5) * spread.y;
    positions[i * 3 + 2] = START_Z + LAYER_BEHIND - Math.random() * span;
    phase[i] = Math.random() * Math.PI * 2;
    // Mũ 2 thiên về hạt NHỎ: phân bố phẳng cho quá nhiều hạt to và lớp hạt
    // đặc lại thành nhiễu. Vật chất lơ lửng thật cũng vậy — nhiều mảnh li ti,
    // thi thoảng mới có một mảnh lớn.
    scale[i] = .45 + Math.pow(Math.random(), 2) * 1.5;
    dim[i] = .35 + Math.random() * .95;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aFlash', new THREE.BufferAttribute(flash, 1));
  geometry.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
  geometry.setAttribute('aDim', new THREE.BufferAttribute(dim, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    // fog: true là bắt buộc — chỉ khi đó renderer mới bơm fogDensity/fogColor của
    // scene vào uniforms mỗi khung (WebGLRenderer.setProgram). Phải khai báo sẵn
    // cả fogColor dù shader không dùng, vì refreshFogUniforms ghi thẳng vào nó.
    fog: true,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uBase: { value: base },
      uPixelRatio: { value: pixelRatio },
      fogColor: { value: new THREE.Color(0x000000) },
      fogDensity: { value: 0.008 },
      fogNear: { value: 1 },
      fogFar: { value: 1000 },
    },
    vertexShader: PLANKTON_VERTEX, fragmentShader: PLANKTON_FRAGMENT,
  });
  const points = new THREE.Points(geometry, material);
  // Bounding sphere chỉ được tính một lần từ vị trí ban đầu; hạt cuộn theo camera
  // nên hình cầu đó lạc hậu ngay và cả lớp bị cull mất sau vài chục mét.
  points.frustumCulled = false;
  points.userData.layerName = 'plankton';
  points.userData.plankton = { count, flash, phase, span, spread, lit: false };
  return points;
}

// Mục 14.1 — marine snow. Bản cũ dùng chung pointsLayer với plankton nên tuyết
// biển trôi LÊN cùng tốc độ, cùng hướng với plankton: không phân biệt nổi. Tuyết
// phải rơi xuống 0.05–0.12 m/s, trôi ngang ~0.3 m, và ngược chiều bubble — mục
// 6.4 và mục 11 nói thẳng bubble không được thay thế lớp này.
// PointsMaterial không có map thì mỗi hạt là một Ô VUÔNG sắc cạnh — thấy rõ
// trong screenshot QA và trái hẳn mô tả "sprite mờ" của mục 14.1. Sinh sẵn một
// sprite gradient tròn để tuyết biển ra mảnh vụn mềm thay vì pixel vuông.
let snowSprite = null;
function softSprite() {
  if (snowSprite) return snowSprite;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(.45, 'rgba(255,255,255,.5)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  snowSprite = new THREE.CanvasTexture(canvas);
  snowSprite.colorSpace = THREE.SRGBColorSpace;
  return snowSprite;
}

function marineSnowLayer(count, spread, span, color, size, opacity, speedScale) {
  const positions = new Float32Array(count * 3);
  const fall = new Float32Array(count);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - .5) * spread.x;
    positions[i * 3 + 1] = (Math.random() - .5) * spread.y;
    positions[i * 3 + 2] = START_Z + LAYER_BEHIND - Math.random() * span;
    fall[i] = (.05 + Math.random() * .07) * speedScale;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // Giữ PointsMaterial: sizeAttenuation cho ra đúng "gần 3–6 px, xa 1–2 px" của
  // mục 14.1 mà không cần lớp thứ hai.
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ map: softSprite(), alphaTest: .01, color, size, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  points.frustumCulled = false;
  points.userData.layerName = 'marineSnow';
  points.userData.marineSnow = { count, fall, phase, span, spread };
  return points;
}

// Cột sáng cũ: một tần số sin duy nhất, mép cắt ở 0.28 và KHÔNG có suy giảm
// theo chiều cao — ra màn thành hình chữ nhật mờ đứng yên, thứ đọc ngay ra là
// "một cái plane". Ba sửa đổi:
//   • hai tần số lệch nhau (5.0 / 9.3) và trôi ngược chiều nhau, tỉ số không
//     hữu tỉ đẹp nên chu kỳ chung dài hơn cả phiên xem — không thấy nhịp lặp;
//   • mép mềm gấp rưỡi (0.42) để cạnh thẳng của plane tan vào nước;
//   • `fall` và `top` cắt mềm hai đầu: tia sáng phải TAN dần khi xuống sâu chứ
//     không dừng đột ngột, và không được có cạnh ngang ở đỉnh.
// Cộng thêm ngả trắng dần lên phía trên: ánh sáng chưa bị nước lọc thì trắng
// hơn, càng xuống càng bị hút về teal.
const SHAFT_FRAGMENT = `
  uniform float uTime;
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    float w1 = sin(vUv.y * 5.0 + uTime * 0.61 + sin(vUv.x * 3.7)) * 0.5 + 0.5;
    float w2 = sin(vUv.y * 9.3 - uTime * 0.37 + cos(vUv.x * 6.1)) * 0.5 + 0.5;
    float wave = w1 * 0.6 + w2 * 0.4;
    // Mép mềm tới tận 0.5, tức KHÔNG có đoạn nào đạt biên độ đầy: cột sáng
    // thành một vệt loang thay vì một dải có cạnh. Đây là chỗ phân biệt
    // "ánh sáng lọt qua nước" với "cột sáng đặt sẵn".
    float edge = smoothstep(0.0, 0.50, vUv.x) * smoothstep(1.0, 0.50, vUv.x);
    float fall = smoothstep(0.0, 0.70, vUv.y);
    float top = smoothstep(1.0, 0.80, vUv.y);
    // Thở rất chậm, chu kỳ riêng từng cột (uIntensity lệch pha qua uTime khởi
    // tạo ngẫu nhiên): cả dàn cột sáng cùng độ đậm là dấu hiệu rõ nhất của
    // "đồ hoạ", vì mặt nước bên trên không bao giờ gợn đều như vậy.
    float breathe = 0.72 + 0.28 * sin(uTime * 0.13);
    vec3 tint = mix(uColor, vec3(1.0), 0.30 * vUv.y);
    // Giảm 35%: khi camera ngẩng lên, các cột này chiếm trọn khung và trở
    // thành thứ đại diện cho "phía trên" — mà chúng chỉ là ánh sáng lọt qua,
    // không phải mặt nước. Tắt hẳn chúng đi thì khung nhìn lên gần như đen,
    // nên chúng vẫn cần thiết; chỉ là không được dẫn dắt.
    gl_FragColor = vec4(tint, (0.007 + 0.034 * wave) * edge * fall * top * uIntensity * breathe);
  }
`;

// Mặt nước ở RẤT XA phía trên, không phải một tấm phủ màu.
//
// Bản cũ là PlaneGeometry(120,100) đặt ở z = -18 với depthTest: false — tức
// một tấm teal dán đè lên toàn khung hình. Đó đúng nghĩa "phủ màu", và là thứ
// làm scene đọc ra là 3D scene tô teal.
//
// Thay bằng một mặt phẳng NẰM NGANG ở y = +46 trải suốt quãng lặn, nhìn từ
// dưới lên. Camera của abyss lặn theo -Z chứ không theo -Y nên không thể bơi
// tới nó được — và đó là chủ ý: mặt nước là thứ ở ngoài tầm với.
//
// uCameraXZ cho cửa sổ Snell đi theo người xem: dưới nước, nhìn thẳng lên thấy
// bầu trời gói trong một hình nón ~97 độ, ngoài nón đó là phản xạ toàn phần và
// mặt nước hoá thành gương tối. Đó là lý do vùng sáng luôn nằm ngay trên đầu
// và mờ dần ra rìa, chứ không sáng đều.
const SURFACE_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uTime;
  uniform float uStrength;
  uniform vec3 uCameraPos;
  uniform vec3 uSunDir;
  varying vec3 vSurfaceWorld;

  // Chỉ cộng dồn ĐẠO HÀM, không cần chiều cao: mặt nước là một tấm phẳng, thứ
  // duy nhất cần là pháp tuyến để bẻ ánh sáng. Rẻ hơn hẳn Gerstner đầy đủ mà
  // mắt không phân biệt được ở khoảng cách 46 m.
  void waveOctave(vec2 p, vec2 dir, float freq, float speed, float amp, float t, inout vec2 slope, inout float height) {
    float phase = dot(p, dir) * freq + t * speed;
    slope += dir * (freq * amp * cos(phase));
    // Cộng dồn CẢ chiều cao, không chỉ đạo hàm. Pháp tuyến một mình chỉ bẻ được
    // BIÊN của cửa sổ Snell, cho ra một đĩa sáng mép gợn — mắt đọc thành "vùng
    // sáng", không phải "mặt nước có sóng". Chiều cao mới là thứ vẽ ra hình
    // sóng: đỉnh sáng, lòng tối.
    height += amp * sin(phase);
  }

  void main() {
    vec2 p = vSurfaceWorld.xz;

    // Ba bậc tần số, ba HƯỚNG khác nhau, ba tốc độ khác nhau. Bước sóng ~34 m,
    // ~11 m, ~3.6 m. Bản trước chỉ có một tần số duy nhất nên ra đúng cái vẻ
    // "texture nhiễu động đậy". Hướng không song song và tỉ số tần số không
    // hữu tỉ đẹp nên không có nhịp lặp nào nhìn ra được.
    vec2 slope = vec2(0.0);
    float height = 0.0;
    waveOctave(p, normalize(vec2( 1.00,  0.30)), 0.185, 0.42, 1.00, uTime, slope, height);
    waveOctave(p, normalize(vec2(-0.35,  1.00)), 0.560, 0.78, 0.34, uTime, slope, height);
    waveOctave(p, normalize(vec2( 1.74, -0.66)), 1.740, 1.55, 0.09, uTime, slope, height);
    // 2.2 = độ "phẳng": số càng lớn sóng càng thoải. Đủ để bẻ ánh sáng mà mặt
    // nước vẫn là mặt nước lặng, không phải biển động.
    vec3 normal = normalize(vec3(-slope.x, 2.2, -slope.y));

    vec3 toSurface = normalize(vSurfaceWorld - uCameraPos);
    float cosTheta = clamp(dot(toSurface, normal), 0.0, 1.0);

    // CỬA SỔ SNELL, không phải một vòng sáng vẽ tay. Nhìn từ dưới nước lên,
    // toàn bộ bầu trời bị nén vào hình nón nửa góc 48.6 độ (sin θc = 1/1.333);
    // ngoài nón đó là phản xạ toàn phần và mặt nước thành gương soi lại vùng
    // nước tối bên dưới. cos(48.6°) = 0.661 — hai mốc dưới đây ôm quanh nó để
    // biên mềm. Vì pháp tuyến do sóng bẻ, chính đường biên này GỢN theo sóng:
    // đó là thứ làm mặt nước "sống" chứ không phải thêm nhiễu.
    float snell = smoothstep(0.56, 0.80, cosTheta);

    // Nắng khúc xạ. refract() trả vec3(0) khi phản xạ toàn phần, nên chấm sáng
    // tự tắt ngoài cửa sổ Snell mà không cần nhánh rẽ nào.
    vec3 refracted = refract(toSurface, normal, 1.333);
    float glint = pow(clamp(dot(refracted, -uSunDir), 0.0, 1.0), 60.0);

    // Tan hẳn ở xa, nếu không nó thành một trần sáng phẳng chạy tới chân trời.
    float reach = 1.0 - smoothstep(80.0, 200.0, distance(p, uCameraPos.xz));

    // BÓNG SÓNG LỚN. Bậc đầu áp đảo (biên độ 1.0 so với 0.34 và 0.09) nên
    // crest chủ yếu vẽ ra sóng bước dài ~34 m — lòng sóng tối, đỉnh sáng.
    //
    // Không có số hạng này thì height được cộng dồn rồi bỏ đi, và pháp tuyến
    // một mình chỉ bẻ được BIÊN của cửa sổ Snell: ra một đĩa sáng mép gợn, mắt
    // đọc thành "một vùng sáng" chứ không phải "mặt nước có sóng".
    // (Không dùng backtick quanh tên biến ở đây — cả khối shader này là một
    // template literal JS, backtick sẽ cắt đứt chuỗi. Đã dẫm phải hai lần.)
    float crest = clamp(height * 0.42 + 0.5, 0.0, 1.0);
    vec3 tint = mix(uColor, vec3(1.0), 0.72 * snell) + vec3(0.34) * glint;
    tint *= 0.68 + 0.32 * crest;
    // Ngoài cửa sổ Snell alpha gần như bằng 0: phản xạ toàn phần soi lại vùng
    // nước tối bên dưới, tức mặt nước ở đó KHÔNG sáng hơn nền. Chênh lệch giữa
    // trong và ngoài nón mới là thứ làm người xem nhận ra đó là mặt nước.
    float alpha = (0.030 + 0.520 * snell + 0.30 * glint) * (0.45 + 0.85 * crest) * reach * uStrength;
    gl_FragColor = vec4(tint, alpha);
  }
`;


// ---------------------------------------------------------------------------
// KHỐI NƯỚC — thay cho `scene.background` một màu phẳng.
//
// Nền phẳng là lý do vùng phía trên đọc ra "một cái gradient teal": mọi hướng
// nhìn đều trả về đúng một màu, nên nhìn lên, nhìn ngang và nhìn xuống giống
// hệt nhau. Dưới nước thì không thể như vậy — ánh sáng đến từ TRÊN, nên nước
// phía trên bao giờ cũng sáng hơn nước phía dưới.
//
// Đây cũng là lý do tôi KHÔNG làm được gradient này bằng cách sửa fog: fog hội
// tụ về `fogColor`, mà nền lại phẳng, nên hễ fog có gradient là chân trời lộ
// một đường nối. Quả cầu này giải quyết đúng chỗ đó — ở phương ngang nó trả về
// ĐÚNG fogColor, nên vật ở xa tan vào nền không còn đường biên nào.
//
// Không phải "ceiling plane": nó là một quả cầu bao quanh camera, không có mặt
// phẳng nào ở ngay trên đầu. Mặt nước thật vẫn là tấm ở y = +46.
const VOLUME_FRAGMENT = `
  uniform vec3 uHorizon;
  uniform vec3 uUp;
  uniform vec3 uDown;
  uniform float uTime;
  varying vec3 vDir;
  void main() {
    float y = clamp(vDir.y, -1.0, 1.0);
    // Mũ < 1 phía trên: độ sáng dâng NHANH ngay trên đường chân trời rồi thoải
    // dần, đúng cách ánh sáng xuyên nước phân bố. Tuyến tính cho ra một dải
    // chuyển đều đọc ra ngay là gradient CSS.
    vec3 col = y > 0.0
      ? mix(uHorizon, uUp, pow(y, 0.62))
      : mix(uHorizon, uDown, pow(-y, 0.80));
    // Vệt sáng cực mờ trôi rất chậm: chỉ để phá sự đồng nhất tuyệt đối của một
    // gradient toán học. 4% — dưới ngưỡng nhận ra là hoa văn.
    float band = 0.5 + 0.5 * sin(vDir.x * 5.0 + uTime * 0.06) * sin(vDir.z * 4.3 - uTime * 0.045);
    col *= 1.0 + 0.04 * band * max(0.0, y);
    gl_FragColor = vec4(col, 1.0);
    // BẮT BUỘC với ShaderMaterial: three chỉ tự chèn hai bước này cho vật liệu
    // dựng sẵn của nó, không chèn cho shader tự viết. Thiếu chúng thì giá trị
    // LINEAR của uniform bị ghi thẳng vào framebuffer sRGB — đo được uHorizon
    // #106878 render ra #012836, tức cả khối nước tối đi 2.6 lần.
    //
    // Và tone mapping ở đây là ĐÚNG chứ không chỉ để bù sáng: mọi vật thể khác
    // đều đi qua ACES, nên nếu nền không đi qua thì vật ở xa hội tụ về fogColor
    // đã tone-map sẽ không bao giờ khớp nền, và chân trời lộ một đường nối.
    #include <tonemapping_fragment>
    // r152 gọi chunk này là encodings_fragment; colorspace_fragment là tên của
    // các bản three sau, và three ném "Can not resolve" ngay lúc compile.
    // (Không viết tên chunk trong dấu backtick ở đây: cả khối shader này nằm
    // trong một template literal JS, backtick sẽ cắt đứt chuỗi.)
    #include <encodings_fragment>
  }
`;

export function createWaterFX(theme, tier, reducedMotion, plan) {
  const dive = Number.isFinite(plan?.diveDistance) && plan.diveDistance > 0 ? plan.diveDistance : DEFAULT_DIVE;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, tier.pixelRatio || 1);
  const group = new THREE.Group();
  const count = value => (reducedMotion ? Math.floor(value * .25) : value);

  // Bán kính 420 < camera.far 900. depthWrite tắt và renderOrder âm để nó luôn
  // là thứ vẽ đầu tiên và không bao giờ che vật gì.
  const volumeMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
    uniforms: {
      uHorizon: { value: new THREE.Color(theme.background ?? '#0c5566') },
      uUp: { value: new THREE.Color('#1f8fa0') },
      uDown: { value: new THREE.Color('#04222c') },
      uTime: { value: 0 },
    },
    vertexShader: 'varying vec3 vDir; void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: VOLUME_FRAGMENT,
  });
  const volume = new THREE.Mesh(new THREE.SphereGeometry(420, 32, 20), volumeMaterial);
  volume.frustumCulled = false;
  volume.renderOrder = -1000;
  group.add(volume);

  // uUp / uDown suy TỪ màu chân trời, không phải hằng số riêng: fogColor đã
  // được core/palette.js chuyển theo độ sâu rồi, nên cả khối nước tự đi theo.
  const volumeHorizon = new THREE.Color();
  function setVolumeColor(hex) {
    volumeHorizon.set(hex);
    volumeMaterial.uniforms.uHorizon.value.copy(volumeHorizon);
    volumeMaterial.uniforms.uUp.value.copy(volumeHorizon).multiplyScalar(2.15);
    volumeMaterial.uniforms.uDown.value.copy(volumeHorizon).multiplyScalar(0.40);
  }

  // Tiết diện lớp gần hẹp hơn hộp cũ 34x24: cùng số hạt, mật độ khối gấp ~2.9
  // lần, nên vệt burglar-alarm (mục 14.4) mới đủ hạt để nhìn ra là một VỆT.
  // Lớp far giữ nguyên 70x48 làm phông rộng — bóp nó lại thì nước thành hành lang.
  const near = planktonLayer(count(tier.near), { x: 20, y: 14 }, layerSpan(dive, 180), theme.memoryGlow, .16, pixelRatio);
  // y 48 -> 26: trải quá cao thì lớp xa nằm trên đầu người xem và đọc thành
  // BẦU TRỜI SAO, đúng thứ mục 11 cấm đầu tiên. Giữ nó trong hành lang lặn.
  const far = planktonLayer(count(tier.far), { x: 70, y: 26 }, layerSpan(dive, 500), theme.bioluminescent, .10, pixelRatio);
  // Mục 13.9: reduced motion chỉ hạ TỐC ĐỘ tuyết xuống ×0.25, số hạt đã giảm ở trên.
  // size .06 -> .10 và opacity .18 -> .30: mục 14.1 muốn tuyết biển là hình ảnh
  // đặc trưng nhất của cảnh, nhưng ở cỡ cũ nó lẫn hẳn vào plankton dạng chấm.
  const snow = marineSnowLayer(count(tier.snow), { x: 44, y: 30 }, layerSpan(dive, 260), theme.memoryGlow, .10, .30, reducedMotion ? .25 : 1);
  const planktonLayers = [near, far];
  group.add(far, snow, near);

  // 34 quả bọt = 34 Mesh, mỗi quả một SphereGeometry và một MeshBasicMaterial
  // riêng, tức 34 draw call cho thứ chiếm vài chục pixel. Hình cầu giống hệt
  // nhau nên đây đúng là ca mẫu của InstancedMesh: một geometry bán kính 1, tỉ
  // lệ nằm trong ma trận từng instance, còn 1 draw call.
  const bubbleSpan = layerSpan(dive, 220);
  const bubbleCount = reducedMotion ? 12 : 34;
  const bubbles = [];
  for (let i = 0; i < bubbleCount; i++) {
    bubbles.push({
      x: (Math.random() - .5) * 34,
      y: -7 + Math.random() * 17,
      z: START_Z - 10 - Math.random() * (bubbleSpan - 10),
      radius: .035 + Math.random() * .09,
      bubbleSpeed: .05 + Math.random() * .1,
      phase: Math.random() * Math.PI * 2,
      // Biên độ chao ngang riêng từng quả: bọt cùng chao một nhịp thì cả đám
      // đọc ra là một tấm lưới trượt ngang, không phải bọt.
      wobble: .12 + Math.random() * .28,
    });
  }
  const bubbleMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 8, 8),
    new THREE.MeshBasicMaterial({ color: theme.memoryGlow, transparent: true, opacity: .26, depthWrite: false, blending: THREE.AdditiveBlending }),
    bubbleCount,
  );
  bubbleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Bọt cuộn theo camera nên bounding sphere tính lúc dựng lạc hậu ngay.
  bubbleMesh.frustumCulled = false;
  group.add(bubbleMesh);

  const causticGroup = new THREE.Group();
  const shaftCount = reducedMotion ? 0 : tier.caustics;
  // Mục 6.2: tia sáng rọi từ trên xuống suốt hành trình. Bản cũ đặt z = -25 - i*34
  // nên ở tier mid cột cuối dừng ở -93 m còn hành trình dài tới 620 m: 85% quãng
  // nước không có tia nào, mà counter-illumination của DeepSilhouette (mục 14.5)
  // lại đo theo các cột này. Giờ trải theo phần của quãng lặn, hai đầu chừa lại
  // 6% để cột đầu không nằm ngay mặt camera và cột cuối không rơi ra sau vạch
  // camera dừng (z = 5 - dive - 7.2).
  const CAUSTIC_FIRST = 0.06;
  const CAUSTIC_LAST = 0.94;
  for (let i = 0; i < shaftCount; i++) {
    const material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: Math.random() * 40 }, uColor: { value: theme.coldTeal }, uIntensity: { value: .55 + Math.random() * .75 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: SHAFT_FRAGMENT,
    });
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(19, 78), material);
    const fraction = shaftCount === 1 ? .5 : CAUSTIC_FIRST + (i / (shaftCount - 1)) * (CAUSTIC_LAST - CAUSTIC_FIRST);
    // Tâm y = 10, cao 78 -> phủ từ -29 (dưới đáy) tới +49 (trên mặt nước): cột
    // sáng chạy suốt cột nước thay vì lơ lửng ở khoảng giữa.
    shaft.position.set((i - (shaftCount - 1) / 2) * 9, 10, -dive * fraction);
    // YXZ: rotation.y là billboard quanh trục đứng, cập nhật mỗi khung trong
    // update(); rotation.z là độ nghiêng cố định của riêng cột này và phải
    // được áp SAU billboard, nếu không nghiêng sẽ quay theo camera.
    shaft.rotation.order = 'YXZ';
    shaft.rotation.z = (Math.random() - .5) * .22;
    causticGroup.add(shaft);
  }
  group.add(causticGroup);
  // Task 8 cần biết các cột sáng nằm ở đâu để làm counter-illumination cho
  // DeepSilhouette (mục 14.5); Task 11 cần tắt chúng khi đổi tier.
  const causticShafts = causticGroup.children.map(shaft => ({ x: shaft.position.x, z: shaft.position.z }));
  function getCausticShafts() { return causticShafts; }
  function setCausticsEnabled(enabled) { causticGroup.visible = enabled; }
  // 34 -> 46 m. Cột nước giờ là 72 m (đáy -26, mặt +46) và camera nằm ở 36%
  // từ đáy lên — mặt nước là một biên giới không gian ở XA, không phải cái
  // trần ngay trên đầu.
  const SURFACE_Y = 46;
  const surfaceLength = dive + 160;
  const surfaceMaterial = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: theme.coldTeal },
      uTime: { value: 0 },
      uStrength: { value: 1 },
      uCameraPos: { value: new THREE.Vector3(0, 0, START_Z) },
      // Nắng chếch, không thẳng đứng: thẳng đứng thì chấm sáng nằm đúng tâm
      // cửa sổ Snell và đối xứng hoàn hảo — đọc ra ngay là hình vẽ.
      uSunDir: { value: new THREE.Vector3(0.28, -1.0, 0.36).normalize() },
    },
    vertexShader: 'varying vec3 vSurfaceWorld; void main(){vSurfaceWorld=(modelMatrix*vec4(position,1.0)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: SURFACE_FRAGMENT,
  });
  // 24x24 segment: shader tính theo world position nên hình học không cần chia
  // nhỏ để có gợn, nhưng chia thô quá thì fog đỉnh-nội-suy của three cho ra
  // dải màu gãy trên một tấm dài hơn 700 m.
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(300, surfaceLength, 24, 24), surfaceMaterial);
  surface.rotation.x = Math.PI / 2;
  surface.position.set(0, SURFACE_Y, START_Z - surfaceLength / 2);
  surface.frustumCulled = false;
  group.add(surface);

  const timedMaterials = [surfaceMaterial, volumeMaterial, ...causticGroup.children.map(shaft => shaft.material)];
  const cameraWorld = new THREE.Vector3(0, 0, START_Z);
  const cameraLocal = new THREE.Vector3(0, 0, START_Z);
  const alarmPoint = new THREE.Vector3();

  // Đánh dấu thẳng vào aFlash thay vì đổi opacity cả lớp: chỉ những hạt bị khuấy
  // mới sáng, đúng mục 6.3 ("sinh vật không được phát sáng đồng loạt").
  function flashAround(point, radius) {
    const radiusSq = radius * radius;
    for (const layer of planktonLayers) {
      const data = layer.userData.plankton;
      const positions = layer.geometry.attributes.position.array;
      for (let i = 0; i < data.count; i++) {
        const index = i * 3;
        const dx = positions[index] - point.x;
        const dy = positions[index + 1] - point.y;
        const dz = positions[index + 2] - point.z;
        if (dx * dx + dy * dy + dz * dz <= radiusSq) { data.flash[i] = 1; data.lit = true; }
      }
      layer.geometry.attributes.aFlash.needsUpdate = true;
    }
  }

  // worldPoint là tuỳ chọn: abyss.js hiện gọi triggerAlarm() không tham số khi
  // con trỏ chạm relic, khi đó chỗ bị khuấy coi như ngay tại camera.
  function triggerAlarm(worldPoint) {
    if (worldPoint) { alarmPoint.copy(worldPoint); group.worldToLocal(alarmPoint); }
    else alarmPoint.copy(cameraLocal);
    flashAround(alarmPoint, ALARM_RADIUS);
  }

  function updatePlankton(layer, dt, elapsed) {
    const data = layer.userData.plankton;
    const positions = layer.geometry.attributes.position.array;
    const flash = data.flash;
    const phase = data.phase;
    const span = data.span;
    const decay = dt / FLASH_FADE;
    const wakeSq = WAKE_RADIUS * WAKE_RADIUS;
    const cx = cameraLocal.x, cy = cameraLocal.y, cz = cameraLocal.z;
    let lit = false;
    for (let i = 0; i < data.count; i++) {
      const index = i * 3;
      // Plankton LƠ LỬNG (tuyết biển mới là thứ rơi): dao động quanh chỗ của nó,
      // biên độ chưa tới nửa mét, và nhân dt để không phụ thuộc frame (mục 13.3).
      positions[index] += Math.cos(elapsed * .21 + phase[i]) * dt * .06;
      positions[index + 1] += Math.sin(elapsed * .5 + phase[i]) * dt * .1;
      positions[index + 2] = wrapZ(positions[index + 2], cz, span);
      const dx = positions[index] - cx;
      const dy = positions[index + 1] - cy;
      const dz = positions[index + 2] - cz;
      let value = flash[i] - decay;
      if (dx * dx + dy * dy + dz * dz <= wakeSq) value = 1;
      flash[i] = value > 0 ? value : 0;
      if (flash[i] > 0) lit = true;
    }
    layer.geometry.attributes.position.needsUpdate = true;
    // Còn tải lên thêm một khung sau hạt cuối tắt, để số 0 kịp sang GPU.
    layer.geometry.attributes.aFlash.needsUpdate = lit || data.lit;
    data.lit = lit;
  }

  function updateSnow(layer, dt, elapsed) {
    const data = layer.userData.marineSnow;
    const positions = layer.geometry.attributes.position.array;
    const span = data.span;
    // Tái sinh theo khoảng nước quanh camera chứ không theo một mốc y cố định.
    const top = cameraLocal.y + data.spread.y / 2;
    const bottom = cameraLocal.y - data.spread.y / 2;
    for (let i = 0; i < data.count; i++) {
      const index = i * 3;
      positions[index + 1] -= data.fall[i] * dt;
      // Trôi ngang: tích phân của .1*sin(.34t) có biên độ ~0.29 m, đúng mục 14.1.
      positions[index] += Math.sin(elapsed * .34 + data.phase[i]) * dt * .1;
      positions[index + 2] = wrapZ(positions[index + 2], cameraLocal.z, span);
      if (positions[index + 1] < bottom) {
        positions[index + 1] = top;
        positions[index] = cameraLocal.x + (Math.random() - .5) * data.spread.x;
      }
    }
    layer.geometry.attributes.position.needsUpdate = true;
  }

  const bubbleMatrix = new THREE.Matrix4();
  const bubblePosition = new THREE.Vector3();
  const bubbleQuaternion = new THREE.Quaternion();
  const bubbleScale = new THREE.Vector3();

  function updateBubbles(dt, elapsed) {
    for (let i = 0; i < bubbles.length; i++) {
      const bubble = bubbles[i];
      const speed = reducedMotion ? bubble.bubbleSpeed * .1 : bubble.bubbleSpeed;
      bubble.y += speed * dt;
      if (bubble.y > cameraLocal.y + 10) bubble.y = cameraLocal.y - 8;
      bubble.z = wrapZ(bubble.z, cameraLocal.z, bubbleSpan);
      // Bọt thật không nổi thẳng đứng — nó lượn theo dòng. Tần số buộc theo
      // bubbleSpeed nên quả nhỏ nổi chậm cũng chao chậm, không phải cả đám
      // rung cùng một nhịp.
      const drift = reducedMotion ? 0 : Math.sin(elapsed * (.5 + bubble.bubbleSpeed * 4) + bubble.phase) * bubble.wobble;
      bubblePosition.set(bubble.x + drift, bubble.y, bubble.z);
      bubbleScale.setScalar(bubble.radius);
      bubbleMatrix.compose(bubblePosition, bubbleQuaternion, bubbleScale);
      bubbleMesh.setMatrixAt(i, bubbleMatrix);
    }
    bubbleMesh.instanceMatrix.needsUpdate = true;
  }

  function update(dt, camera, elapsed) {
    // Đưa camera về hệ toạ độ của group MỘT LẦN mỗi khung, thay vì gọi
    // localToWorld cho từng hạt (tới 4 500 hạt ở tier high).
    group.updateWorldMatrix(true, false);
    camera.getWorldPosition(cameraWorld);
    cameraLocal.copy(cameraWorld);
    group.worldToLocal(cameraLocal);
    updatePlankton(near, dt, elapsed);
    updatePlankton(far, dt, elapsed);
    updateSnow(snow, dt, elapsed);
    updateBubbles(dt, elapsed);
    for (const material of timedMaterials) material.uniforms.uTime.value += dt;

    // Billboard cột sáng quanh trục ĐỨNG. Một tấm plane đứng yên nhìn nghiêng
    // chỉ còn là một vạch mỏng, nhìn chính diện là hình chữ nhật — cả hai đều
    // đọc ra là "một cái plane". Quay theo camera thì tiết diện luôn tối đa và
    // nó đọc ra là một cột sáng có khối.
    for (const shaft of causticGroup.children) {
      shaft.rotation.y = Math.atan2(cameraLocal.x - shaft.position.x, cameraLocal.z - shaft.position.z);
    }

    surfaceMaterial.uniforms.uCameraPos.value.copy(cameraLocal);
    // Khối nước đi theo camera: nó là môi trường, không phải vật thể có chỗ đứng.
    volume.position.copy(cameraLocal);
  }

  // Mặt nước tắt hẳn khi xuống sâu: 40 m còn trọn, tới 240 m thì không còn
  // ánh sáng mặt trời nào lọt xuống nữa (mục 13.2 đặt D90 xuống 50 m ở đó).
  function setSurfaceStrength(depth) {
    // Mặt nước cách camera 46 m, tức nó vẫn là biên giới không gian có thật ở
    // 150 m sâu. 200 -> 300 m và mũ 2 -> 1.5 để nó không biến mất ngay sau
    // phase đầu; ở 87 m cho 0.77 thay vì 0.58.
    const t = Math.min(1, Math.max(0, (depth - 40) / 300));
    surfaceMaterial.uniforms.uStrength.value = Math.pow(1 - t, 1.5);
  }

  // Sau khi hạ tier, framebuffer nhỏ lại nhưng uPixelRatio vẫn là giá trị cũ,
  // nên gl_PointSize tính thừa: hạt TO RA đúng lúc GPU đang đuối.
  function setPixelRatio(ratio) {
    if (!Number.isFinite(ratio) || ratio <= 0) return;
    const next = Math.min(window.devicePixelRatio || 1, ratio);
    for (const layer of [near, far]) layer.material.uniforms.uPixelRatio.value = next;
  }

  return { group, update, triggerAlarm, getCausticShafts, setCausticsEnabled, setPixelRatio, setSurfaceStrength, setVolumeColor };
}
