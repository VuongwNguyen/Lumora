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
const relicFocusRing = document.getElementById('relic-focus-ring');
const lightboxClose = document.getElementById('lightbox-close');
const resetButton = document.getElementById('reset-dive');
const manualDiveButton = document.getElementById('manual-dive');
const emptyState = document.getElementById('empty-state');

const BASE_SPEED = reducedMotion ? 0 : 1.8;
let plan = null;
let phaseDirector = null;
let endDepth = D0 + 500;

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

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, .1, 900);
camera.position.set(0, 0, START_Z);
camera.rotation.order = 'YXZ';
const initialTier = detectPerformanceTier();
const adaptiveTier = createAdaptiveTier(initialTier);
const renderer = new THREE.WebGLRenderer({ antialias: adaptiveTier.config.antialias, alpha: false });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, adaptiveTier.config.pixelRatio));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .74;
document.getElementById('canvas-container').appendChild(renderer.domElement);
window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const root = new THREE.Group();
scene.add(root);
let waterFX; let seabed; let beacon; let fauna; let relics;
let lookX = 0; let lookY = 0; let dragging = false; let didMove = false; let lastX = 0; let lastY = 0;
// keyboardRelic = relic gắn với nút nav ĐANG giữ focus (nguồn của focus ring).
// navReturnTarget = nút đã mở lightbox, giữ riêng vì focus rời nav ngay khi
// lightbox mở nên không thể hỏi lại document.activeElement lúc đóng.
let keyboardRelic = null; let navReturnTarget = null;
let focusedRelic = null; let pausedForReading = false; let finished = false; let elapsed = 0; let lastFrame = performance.now();
let releaseElapsed = 0;
let averageFrame = 60;
// Cột caustic bị ẩn khi hạ tier vẫn nằm nguyên trong getCausticShafts(), mà mục
// 14.5 dùng chính danh sách đó để quyết định bóng sinh vật có lộ diện hay không.
// Không theo dõi cờ này thì sau khi hạ tier, silhouette sáng lên vì "cắt ngang"
// một cột sáng KHÔNG CÒN ĐƯỢC VẼ. Danh sách rỗng đưa fauna về nhánh dự phòng
// (lộ diện theo lúc camera đi ngang) — đúng thứ tier low vốn dùng.
let causticsVisible = adaptiveTier.config.caustics > 0;

function currentDepth() { return depthFromZ(camera.position.z, START_Z, D0); }

function updateDepthAtmosphere(depth, dt) {
  scene.fog.density = easeTowards(scene.fog.density, densityForDepth(depth), dt, 6);
}

function moveLook(dx, dy) {
  lookX += dx * .004;
  lookY = THREE.MathUtils.clamp(lookY + dy * .003, -Math.PI * .32, Math.PI * .32);
}

renderer.domElement.addEventListener('pointerdown', event => { dragging = true; didMove = false; lastX = event.clientX; lastY = event.clientY; renderer.domElement.setPointerCapture?.(event.pointerId); });
renderer.domElement.addEventListener('pointermove', event => {
  const rect = renderer.domElement.getBoundingClientRect();
  if (dragging) { const dx = event.clientX - lastX; const dy = event.clientY - lastY; didMove ||= Math.abs(dx) + Math.abs(dy) > 4; moveLook(dx, dy); lastX = event.clientX; lastY = event.clientY; }
  if (!relics) return;
  const ndc = { x: ((event.clientX - rect.left) / rect.width) * 2 - 1, y: -((event.clientY - rect.top) / rect.height) * 2 + 1 };
  const hit = raycastRelic(ndc);
  if (hit) waterFX?.triggerAlarm();
  relics.getRelics().forEach(item => { item.userData.hovered = item === hit; });
});
renderer.domElement.addEventListener('pointerup', event => { dragging = false; renderer.domElement.releasePointerCapture?.(event.pointerId); });
renderer.domElement.addEventListener('click', event => { if (didMove) { didMove = false; return; } const rect = renderer.domElement.getBoundingClientRect(); const hit = raycastRelic({ x: ((event.clientX - rect.left) / rect.width) * 2 - 1, y: -((event.clientY - rect.top) / rect.height) * 2 + 1 }); if (hit) openRelic(hit); });

const raycaster = new THREE.Raycaster();
function raycastRelic(ndc) { if (!relics) return null; raycaster.setFromCamera(ndc, camera); const meshes = []; relics.getRelics().forEach(item => item.traverse(child => { if (child.isMesh) meshes.push(child); })); const hit = raycaster.intersectObjects(meshes)[0]?.object; let parent = hit; while (parent && !parent.userData?.relic) parent = parent.parent; return parent || null; }

// Nhãn dự phòng đếm theo sequence chứ không theo index: index là Ô MESH, còn
// sequence là tấm ảnh ô đó đang mang — với galaxy streamed hai số này tách nhau
// sau vòng cuộn đầu tiên.
function relicLabel(relic) { return relic.userData.caption || `Ký ức ${(relic.userData.sequence ?? relic.userData.index) + 1}`; }

function renderRelicNav() {
  if (!relicNav || !relics) return;
  relicNav.replaceChildren();
  // Far silhouette vẫn mang userData.relic nhưng url = null (mục 4.4), nên
  // openRelic bỏ qua chúng. Không lọc thì galaxy 4 ảnh có thêm ba điểm dừng Tab
  // chết mang nhãn "Ký ức 5/6/7" — số vượt quá số ảnh thật.
  const stops = relics.getRelics().filter(item => item.userData.url);
  // Gần nhất trước: camera lặn theo -Z nên z LỚN hơn là gần hơn. Đọc spawn.z chứ
  // không phải position.z vì relic bập bềnh mỗi frame. (Hiện thứ tự này trùng
  // đúng thứ tự index vì relicDistanceAt tăng đơn điệu theo index — sort là để
  // giữ đúng ý "nearest-first" nếu bố cục đổi, không phải để sửa thứ tự hôm nay.)
  stops.sort((a, b) => (b.userData.spawn?.z ?? b.position.z) - (a.userData.spawn?.z ?? a.position.z));
  stops.forEach(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = relicLabel(item);
    button.dataset.index = String(item.userData.index);
    button.addEventListener('click', () => openRelic(item, button));
    // Nav KHÔNG được dựng lại khi relic cuộn về cuối rãnh hay khi hạ tier: thay
    // node đang giữ focus sẽ ném focus về <body> giữa lúc người dùng đang Tab.
    // Đổi lại, nhãn của galaxy streamed có thể lệch sau một vòng cuộn, nên cập
    // nhật ngay tại chỗ lúc nút nhận focus — sửa chữ, không thay node.
    button.addEventListener('focus', () => { keyboardRelic = item; button.textContent = relicLabel(item); });
    button.addEventListener('blur', () => { if (keyboardRelic === item) keyboardRelic = null; });
    relicNav.appendChild(button);
  });
}

function openRelic(relic, trigger = null) {
  if (!relic?.userData?.url) return;
  navReturnTarget = trigger;
  focusedRelic = relic; relic.userData.focused = true; pausedForReading = true; lightboxImage.src = relic.userData.url; lightboxCaption.textContent = relic.userData.caption || 'Một mảnh ký ức dưới đáy biển';
  lightbox.setAttribute('role', 'dialog'); lightbox.setAttribute('aria-modal', 'true'); lightbox.setAttribute('aria-labelledby', 'lightbox-caption');
  // Phải thêm .open TRƯỚC khi focus: lightbox đóng là display:none, phần tử trong
  // cây display:none không nhận được focus.
  lightbox.classList.add('open');
  lightboxClose?.focus();
  beacon?.triggerPulse();
  activity?.log({ action: 'Viewer Photo Open', feature: 'viewer', galaxyId, description: { template: 'abyss', photoIndex: relic.userData.index } });
}

function closeRelic() {
  const wasOpen = lightbox.classList.contains('open');
  lightbox.classList.remove('open'); lightbox.removeAttribute('aria-modal'); lightboxImage.removeAttribute('src');
  if (focusedRelic) focusedRelic.userData.focused = false;
  focusedRelic = null; pausedForReading = false;
  const target = navReturnTarget; navReturnTarget = null;
  // Trả focus về đúng nút đã mở. Mở bằng chuột (click relic 3D) thì không có nút
  // nguồn — nút đóng vừa rơi vào cây display:none nên focus tự về <body>, ép đi
  // đâu khác sẽ bật ra một focus ring mà người dùng chuột không hề gọi.
  if (wasOpen && target?.isConnected) target.focus();
}
lightboxClose?.addEventListener('click', closeRelic);
lightbox.addEventListener('click', event => { if (event.target === lightbox) closeRelic(); });
// MỘT listener keydown duy nhất cho cả Escape lẫn bẫy Tab — hai listener cùng
// bắt Escape sẽ gọi closeRelic hai lần và lần hai xoá mất navReturnTarget.
document.addEventListener('keydown', event => {
  if (!lightbox.classList.contains('open')) return;
  if (event.key === 'Escape') { event.preventDefault(); closeRelic(); return; }
  // Bên trong #lightbox chỉ có ĐÚNG MỘT control nhận focus: #lightbox-close.
  // <img> và <figcaption> không focus được và không có tabindex. Nên bẫy Tab
  // chỉ cần giữ nguyên focus tại nút đóng, cho cả Tab lẫn Shift+Tab.
  if (event.key === 'Tab') { event.preventDefault(); lightboxClose?.focus(); }
});

// Kích thước thật của khung relic, đọc một lần từ PlaneGeometry rồi nhớ lại: ring
// phải khớp bề ngang thật trên màn hình chứ không phải một hằng số đoán.
const relicExtents = new WeakMap();
function relicExtentOf(relic) {
  let extent = relicExtents.get(relic);
  if (!extent) {
    extent = { width: 1, height: 1 };
    relic.traverse(child => {
      const size = child.geometry?.parameters;
      if (size?.width > 0 && size?.height > 0) { extent.width = Math.max(extent.width, size.width); extent.height = Math.max(extent.height, size.height); }
    });
    relicExtents.set(relic, extent);
  }
  return extent;
}

const ringVector = new THREE.Vector3();
// Gọi SAU renderer.render: chỉ render mới cập nhật camera.matrixWorldInverse và
// matrixWorld của relic, gọi trước thì ring trễ đúng một frame so với ảnh.
function updateFocusRing() {
  if (!relicFocusRing) return;
  if (!keyboardRelic || lightbox.classList.contains('open')) { relicFocusRing.classList.remove('visible'); return; }
  keyboardRelic.getWorldPosition(ringVector).applyMatrix4(camera.matrixWorldInverse);
  const viewDepth = -ringVector.z;
  // Vector3.project chia cho (-z_view). Điểm SAU lưng camera cho z_ndc > 1 nên
  // phép thử z > 1 bắt được, NHƯNG điểm nằm giữa camera và near plane cho
  // z_ndc < -1 (lọt lưới) trong khi x_ndc bắn lên hàng chục nghìn px, và đúng
  // mặt phẳng camera thì ra Infinity/NaN. Chặn thẳng bằng độ sâu view bắt cả ba.
  if (!(viewDepth > camera.near)) { relicFocusRing.classList.remove('visible'); return; }
  ringVector.applyMatrix4(camera.projectionMatrix);
  if (Math.abs(ringVector.x) > 1.5 || Math.abs(ringVector.y) > 1.5) { relicFocusRing.classList.remove('visible'); return; }
  const extent = relicExtentOf(keyboardRelic);
  // e[5] = 1/tan(fov/2). Kích thước trên màn = kích thước thật * e[5] * H / (2*d)
  // cho CẢ hai trục, vì e[0] = e[5]/aspect và aspect = W/H triệt tiêu nhau.
  const scale = camera.projectionMatrix.elements[5] * innerHeight / (2 * viewDepth);
  const width = Math.max(18, extent.width * scale + 14);
  const height = Math.max(18, extent.height * scale + 14);
  relicFocusRing.style.width = `${Math.round(width)}px`;
  relicFocusRing.style.height = `${Math.round(height)}px`;
  relicFocusRing.style.left = `${Math.round((ringVector.x * .5 + .5) * innerWidth - width / 2)}px`;
  relicFocusRing.style.top = `${Math.round((-ringVector.y * .5 + .5) * innerHeight - height / 2)}px`;
  relicFocusRing.classList.add('visible');
}

function resetDive() {
  // relics.reset() xoá userData.focused của MỌI relic. Nếu lightbox đang mở thì
  // focusedRelic và pausedForReading ở đây còn treo lại: camera đứng yên vĩnh
  // viễn (speed = 0) và ảnh vẫn phủ màn hình. Đóng trước rồi mới reset.
  if (lightbox.classList.contains('open')) closeRelic();
  camera.position.set(0, 0, START_Z); camera.rotation.set(0, 0, 0); lookX = 0; lookY = 0; phaseDirector?.reset(); finished = false; releaseElapsed = 0; resetButton.classList.remove('visible'); if (reducedMotion) manualDiveButton.classList.add('visible');
  relics?.reset();
}
resetButton.addEventListener('click', resetDive);
if (reducedMotion) manualDiveButton.classList.add('visible');
manualDiveButton.addEventListener('click', () => { if (reducedMotion && !finished) camera.position.z -= 90; });

async function init() {
  const data = await fetchData();
  plan = planContent(data.images.length, adaptiveTier.config.relics);
  endDepth = D0 + plan.diveDistance;
  phaseDirector = createPhaseDirector(buildPhaseTable(plan.phaseIds, D0, endDepth));
  if (plan.empty && emptyState) emptyState.classList.add('visible');
  const theme = createAbyssTheme(data.theme);
  const renderTheme = { ...theme.scene, accent: theme.accent, accentSecondary: theme.accentSecondary };
  scene.background = theme.scene.background;
  scene.fog = new THREE.FogExp2(theme.scene.background, densityForDepth(D0));
  waterFX = createWaterFX(renderTheme, adaptiveTier.config, reducedMotion, plan); root.add(waterFX.group);
  seabed = createSeabed(renderTheme, adaptiveTier.config, plan); root.add(seabed.group);
  beacon = createMemoryBeacon(renderTheme, plan); root.add(beacon.group);
  fauna = createFauna(renderTheme, adaptiveTier.config, reducedMotion, plan); root.add(fauna.group);
  relics = await createRelics(data.images, data.captions, renderTheme, adaptiveTier.config, reducedMotion, plan);
  root.add(relics.group);
  renderRelicNav();
  // attachOldestMemory được thêm ở Task 10; gọi tuỳ chọn để plan chạy được theo thứ tự.
  fauna.attachOldestMemory?.(oldestMemory(data));
  window.musicManager?.init(data.soundscape || null);
  document.getElementById('title').textContent = `LUMORA · ${data.name || 'ABYSS OF MEMORIES'}`;
  try { window.parent.postMessage({ type: 'lumora:universe-ready', galaxyId, template: 'abyss' }, location.origin); } catch {}
  activity?.log({ action: 'Viewer Universe Start', feature: 'viewer', galaxyId, description: { template: 'abyss', photoCount: data.images.length, tier: initialTier, diveDistance: plan.diveDistance, reducedMotion } });
  requestAnimationFrame(loop);
}

// Cổng vào phải mở được bằng bàn phím: trước đây #intro là div chỉ nghe click,
// nên người dùng bàn phím không có cách nào vào trải nghiệm. role/tabindex nằm
// trong index.html; ở đây xử lý Enter/Space và gỡ nó khỏi tab order sau khi mở.
function enterUniverse() {
  if (intro.classList.contains('hidden')) return;
  intro.classList.add('hidden');
  intro.tabIndex = -1;
  intro.setAttribute('aria-hidden', 'true');
  window.musicManager?.play?.().catch?.(() => {});
  activity?.log({ action: 'Viewer Universe Enter', feature: 'viewer', galaxyId, description: { template: 'abyss' } });
}
intro.addEventListener('click', enterUniverse);
intro.addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault(); // Space cuộn trang nếu không chặn
  enterUniverse();
});
// Autostart đã ẩn intro ngay trong index.html trước khi module này chạy.
if (intro.classList.contains('hidden')) { intro.tabIndex = -1; intro.setAttribute('aria-hidden', 'true'); }
else intro.focus({ preventScroll: true });

// Hạ tier không dựng lại scene (quá tốn) — nó cắt bớt thứ đang vẽ.
function applyTier(config) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, config.pixelRatio));
  // Các module scene giữ tham chiếu config từ lúc dựng. Hai giá trị này còn được
  // đọc sau khi dựng nên phải đẩy xuống, phần còn lại đành đóng băng vì hạ tier
  // cố ý KHÔNG dựng lại scene.
  relics?.setTextureCap?.(config.texture);
  waterFX?.setPixelRatio?.(config.pixelRatio);
  // config.relics là NGÂN SÁCH của tier, không phải số relic đã dựng: plan được
  // lập theo tier ban đầu nên relicCount có thể lớn hơn (far silhouette) hoặc
  // nhỏ hơn ngân sách. Cắt thẳng theo ngân sách sẽ giấu luôn ẢNH: galaxy 20 ảnh
  // rơi xuống low chỉ còn 6 ô trong khi 11 ô đầu đều mang ảnh — mất 5 tấm.
  // Sàn là số relic mang ảnh, nên hạ tier chỉ bao giờ bỏ bớt far silhouette.
  const imageRelics = plan ? plan.near + plan.mid : config.relics;
  relics?.setVisibleCount(Math.min(plan?.relicCount ?? config.relics, Math.max(config.relics, imageRelics)));
  // Không dựng lại relicNav: với cái sàn ở trên, thứ duy nhất bị ẩn là far
  // silhouette — vốn không có url nên nút của nó đằng nào cũng không mở được
  // lightbox. Dựng lại chỉ để đồng bộ sẽ cướp focus của người đang tab qua nav.
  causticsVisible = config.caustics > 0;
  waterFX?.setCausticsEnabled(causticsVisible);
  activity?.log({
    action: 'Viewer Performance Downgrade', feature: 'viewer', galaxyId,
    description: { template: 'abyss', tier: adaptiveTier.tier, fps: Math.round(averageFrame) },
  });
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastFrame) / 1000, 1 / 30); lastFrame = now; elapsed += dt; averageFrame = averageFrame * .95 + (1 / Math.max(dt, .001)) * .05;
  const depth = currentDepth();
  const phase = phaseDirector.update(depth);
  if (phase.id === 'release') releaseElapsed += dt; else releaseElapsed = 0;
  phase.releaseProgress = phase.id === 'release' ? Math.min(1, releaseElapsed / 8) : 0;
  const releaseEase = phase.id === 'release' ? 1 - phase.releaseProgress : 1;
  const speedTarget = finished || pausedForReading ? 0 : BASE_SPEED * releaseEase;
  const speed = speedTarget * (reducedMotion ? 0 : 1);
  camera.position.z -= speed * dt;
  camera.position.x += (Math.sin(elapsed * (Math.PI * 2 / 21)) * .3 - camera.position.x) * (1 - Math.pow(1 - .035, dt * 60));
  camera.position.y += (Math.cos(elapsed * (Math.PI * 2 / 14)) * .18 - camera.position.y) * (1 - Math.pow(1 - .035, dt * 60));
  const targetYaw = Math.atan2(Math.sin(-lookX), Math.cos(-lookX)); const targetPitch = -lookY; const damping = 1 - Math.pow(1 - .12, dt * 60);
  camera.rotation.y += Math.atan2(Math.sin(targetYaw - camera.rotation.y), Math.cos(targetYaw - camera.rotation.y)) * damping;
  camera.rotation.x += (targetPitch - camera.rotation.x) * damping; camera.rotation.z += (0 - camera.rotation.z) * damping;
  updateDepthAtmosphere(depth, dt); waterFX?.update(dt, camera, elapsed); seabed?.update(elapsed); beacon?.update(dt, elapsed, phase); fauna?.update(elapsed, phase, camera, index => phaseDirector.blendInto(index), phaseDirector.table, causticsVisible ? waterFX?.getCausticShafts?.() || [] : []); relics?.update(dt, elapsed, camera);
  depthLabel.textContent = `DEPTH ${String(Math.round(depth)).padStart(3, '0')} M`;
  if (phase.id === 'release' && releaseElapsed >= 8 && !finished) { finished = true; resetButton.classList.add('visible'); manualDiveButton.classList.remove('visible'); beacon?.triggerPulse(); }
  if (adaptiveTier.update(dt, averageFrame)) applyTier(adaptiveTier.config);
  renderer.render(scene, camera);
  updateFocusRing();
}

init().catch(error => { console.error('[abyss] initialization failed:', error); activity?.log({ action: 'Viewer Universe Error', feature: 'viewer', galaxyId, level: 'error', description: { template: 'abyss', errorType: 'initialization' } }); });
