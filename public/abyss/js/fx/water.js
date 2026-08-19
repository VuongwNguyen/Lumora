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
  uniform float uPixelRatio;
  varying float vFlash;
  varying float vProximity;
  varying float vFogDepth;
  void main() {
    vFlash = aFlash;
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
    gl_PointSize = (2.0 + 5.0 * max(vFlash, vProximity)) * uPixelRatio * attenuation;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const PLANKTON_FRAGMENT = `
  uniform vec3 uColor;
  uniform float uBase;
  uniform float fogDensity;
  varying float vFlash;
  varying float vProximity;
  varying float vFogDepth;
  void main() {
    float disc = 1.0 - smoothstep(0.35, 0.5, length(gl_PointCoord - vec2(0.5)));
    float glow = uBase + 0.55 * vFlash + 0.25 * vProximity;
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
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - .5) * spread.x;
    positions[i * 3 + 1] = (Math.random() - .5) * spread.y;
    positions[i * 3 + 2] = START_Z + LAYER_BEHIND - Math.random() * span;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aFlash', new THREE.BufferAttribute(flash, 1));
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
  const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color, size, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  points.frustumCulled = false;
  points.userData.layerName = 'marineSnow';
  points.userData.marineSnow = { count, fall, phase, span, spread };
  return points;
}

export function createWaterFX(theme, tier, reducedMotion, plan) {
  const dive = Number.isFinite(plan?.diveDistance) && plan.diveDistance > 0 ? plan.diveDistance : DEFAULT_DIVE;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, tier.pixelRatio || 1);
  const group = new THREE.Group();
  const count = value => (reducedMotion ? Math.floor(value * .25) : value);

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

  const bubbleSpan = layerSpan(dive, 220);
  const bubbleGroup = new THREE.Group();
  const bubbles = [];
  const bubbleCount = reducedMotion ? 12 : 34;
  for (let i = 0; i < bubbleCount; i++) {
    const bubble = new THREE.Mesh(new THREE.SphereGeometry(.035 + Math.random() * .09, 8, 8), new THREE.MeshBasicMaterial({ color: theme.memoryGlow, transparent: true, opacity: .26, depthWrite: false, blending: THREE.AdditiveBlending }));
    bubble.position.set((Math.random() - .5) * 34, -7 + Math.random() * 17, START_Z - 10 - Math.random() * (bubbleSpan - 10));
    bubble.userData.bubbleSpeed = .05 + Math.random() * .1;
    bubbles.push(bubble);
    bubbleGroup.add(bubble);
  }
  group.add(bubbleGroup);

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
      uniforms: { uTime: { value: Math.random() * 4 }, uColor: { value: theme.coldTeal } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform float uTime; uniform vec3 uColor; varying vec2 vUv; void main(){float wave=sin(vUv.y*8.0+uTime+sin(vUv.x*5.0))*0.5+0.5;float edge=smoothstep(0.0,.28,vUv.x)*smoothstep(1.0,.72,vUv.x);gl_FragColor=vec4(uColor,(.035+.05*wave)*edge);}',
    });
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(11, 52), material);
    const fraction = shaftCount === 1 ? .5 : CAUSTIC_FIRST + (i / (shaftCount - 1)) * (CAUSTIC_LAST - CAUSTIC_FIRST);
    shaft.position.set((i - (shaftCount - 1) / 2) * 9, 17, -dive * fraction);
    shaft.rotation.z = (Math.random() - .5) * .13;
    causticGroup.add(shaft);
  }
  group.add(causticGroup);
  // Task 8 cần biết các cột sáng nằm ở đâu để làm counter-illumination cho
  // DeepSilhouette (mục 14.5); Task 11 cần tắt chúng khi đổi tier.
  const causticShafts = causticGroup.children.map(shaft => ({ x: shaft.position.x, z: shaft.position.z }));
  function getCausticShafts() { return causticShafts; }
  function setCausticsEnabled(enabled) { causticGroup.visible = enabled; }
  const waterVeil = new THREE.Mesh(new THREE.PlaneGeometry(120, 100), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false,
    uniforms: { uColor: { value: theme.coldTeal }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform vec3 uColor; uniform float uTime; varying vec2 vUv; void main(){float top=smoothstep(0.0,.62,vUv.y);float ripple=.5+.5*sin(vUv.x*9.0+uTime*.25);gl_FragColor=vec4(uColor,(.055+.035*top*ripple));}',
  }));
  waterVeil.position.set(0, 0, -18);
  group.add(waterVeil);

  const timedMaterials = [waterVeil.material, ...causticGroup.children.map(shaft => shaft.material)];
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

  function updateBubbles(dt) {
    for (const bubble of bubbles) {
      const speed = reducedMotion ? bubble.userData.bubbleSpeed * .1 : bubble.userData.bubbleSpeed;
      bubble.position.y += speed * dt;
      if (bubble.position.y > cameraLocal.y + 10) bubble.position.y = cameraLocal.y - 8;
      bubble.position.z = wrapZ(bubble.position.z, cameraLocal.z, bubbleSpan);
    }
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
    updateBubbles(dt);
    for (const material of timedMaterials) material.uniforms.uTime.value += dt;
  }

  // Sau khi hạ tier, framebuffer nhỏ lại nhưng uPixelRatio vẫn là giá trị cũ,
  // nên gl_PointSize tính thừa: hạt TO RA đúng lúc GPU đang đuối.
  function setPixelRatio(ratio) {
    if (!Number.isFinite(ratio) || ratio <= 0) return;
    const next = Math.min(window.devicePixelRatio || 1, ratio);
    for (const layer of [near, far]) layer.material.uniforms.uPixelRatio.value = next;
  }

  return { group, update, triggerAlarm, getCausticShafts, setCausticsEnabled, setPixelRatio };
}
