import * as THREE from 'three';
import { createAbyssTheme } from './core/theme.js';
import { createPhaseDirector } from './core/phases.js';
import { createAdaptiveTier, detectPerformanceTier } from './core/tiers.js';
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

const D0 = 40;
const START_Z = 5;
const FULL_DIVE_DEPTH = 620;
const BASE_SPEED = reducedMotion ? 0 : 1.8;

async function fetchData() {
  if (!galaxyId) return { images: [], captions: [], name: '', soundscape: null, theme: null };
  try {
    const [viewRes, imageRes] = await Promise.all([
      fetch(`/galaxies/${encodeURIComponent(galaxyId)}/view`),
      fetch(`/gallary/items?galaxyId=${encodeURIComponent(galaxyId)}`),
    ]);
    const view = viewRes.ok ? (await viewRes.json()).meta || {} : {};
    const items = imageRes.ok ? (await imageRes.json()).meta || [] : [];
    return { images: items.map(item => item.imageUrl).filter(Boolean), captions: view.caption || [], name: view.name || '', soundscape: view.soundscape || null, theme: view.theme?.colors || null };
  } catch { return { images: [], captions: [], name: '', soundscape: null, theme: null }; }
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
const phaseDirector = createPhaseDirector();
let waterFX; let seabed; let beacon; let fauna; let relics;
let lookX = 0; let lookY = 0; let dragging = false; let didMove = false; let lastX = 0; let lastY = 0;
let focusedRelic = null; let pausedForReading = false; let finished = false; let elapsed = 0; let lastFrame = performance.now();
let releaseElapsed = 0;
let averageFrame = 60;

function depthFromCamera() { return D0 + (START_Z - camera.position.z); }

function densityForDepth(depth) {
  const bands = [[120, .0108], [210, .0152], [330, .0217], [430, .0304]];
  if (depth <= 40) return .008;
  for (let i = 0; i < bands.length; i++) {
    const [end, value] = bands[i];
    const start = i === 0 ? 40 : bands[i - 1][0];
    if (depth <= end) { const t = (depth - start) / (end - start); return THREE.MathUtils.lerp(i === 0 ? .008 : bands[i - 1][1], value, t); }
  }
  return .0304;
}

function updateDepthAtmosphere(depth, dt) {
  const blend = 1 - Math.exp(-dt / 6);
  scene.fog.density += (densityForDepth(depth) - scene.fog.density) * blend;
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

function renderRelicNav() {
  if (!relicNav || !relics) return;
  relicNav.replaceChildren();
  relics.getRelics().forEach(item => { const button = document.createElement('button'); button.type = 'button'; button.textContent = item.userData.caption || `Ký ức ${item.userData.index + 1}`; button.dataset.index = String(item.userData.index); button.addEventListener('click', () => openRelic(item)); relicNav.appendChild(button); });
}

function openRelic(relic) {
  if (!relic?.userData?.url) return;
  focusedRelic = relic; relic.userData.focused = true; pausedForReading = true; lightboxImage.src = relic.userData.url; lightboxCaption.textContent = relic.userData.caption || 'Một mảnh ký ức dưới đáy biển'; lightbox.classList.add('open');
  document.getElementById('lightbox-close')?.focus();
  beacon?.triggerPulse();
  activity?.log({ action: 'Viewer Photo Open', feature: 'viewer', galaxyId, description: { template: 'abyss', photoIndex: relic.userData.index } });
}

function closeRelic() {
  lightbox.classList.remove('open'); lightboxImage.removeAttribute('src');
  if (focusedRelic) focusedRelic.userData.focused = false;
  focusedRelic = null; pausedForReading = false;
}
document.getElementById('lightbox-close')?.addEventListener('click', closeRelic);
lightbox.addEventListener('click', event => { if (event.target === lightbox) closeRelic(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && lightbox.classList.contains('open')) closeRelic(); });

function resetDive() {
  camera.position.set(0, 0, START_Z); camera.rotation.set(0, 0, 0); lookX = 0; lookY = 0; phaseDirector.reset(); finished = false; releaseElapsed = 0; resetButton.classList.remove('visible'); if (reducedMotion) manualDiveButton.classList.add('visible');
  relics?.getRelics().forEach(item => { item.position.copy(item.userData.base); item.userData.focused = false; });
}
resetButton.addEventListener('click', resetDive);
if (reducedMotion) manualDiveButton.classList.add('visible');
manualDiveButton.addEventListener('click', () => { if (reducedMotion && !finished) camera.position.z -= 90; });

async function init() {
  const data = await fetchData();
  const theme = createAbyssTheme(data.theme);
  const renderTheme = { ...theme.scene, accent: theme.accent, accentSecondary: theme.accentSecondary };
  scene.background = theme.scene.background;
  scene.fog = new THREE.FogExp2(theme.scene.background, densityForDepth(D0));
  waterFX = createWaterFX(renderTheme, adaptiveTier.config, reducedMotion); root.add(waterFX.group);
  seabed = createSeabed(renderTheme, adaptiveTier.config); root.add(seabed.group);
  beacon = createMemoryBeacon(renderTheme); root.add(beacon.group);
  fauna = createFauna(renderTheme, adaptiveTier.config, reducedMotion); root.add(fauna.group);
  relics = await createRelics(data.images, data.captions, renderTheme, adaptiveTier.config, reducedMotion); root.add(relics.group); renderRelicNav();
  window.musicManager?.init(data.soundscape || null);
  document.getElementById('title').textContent = `LUMORA · ${data.name || 'ABYSS OF MEMORIES'}`;
  try { window.parent.postMessage({ type: 'lumora:universe-ready', galaxyId, template: 'abyss' }, location.origin); } catch {}
  activity?.log({ action: 'Viewer Universe Start', feature: 'viewer', galaxyId, description: { template: 'abyss', photoCount: data.images.length, tier: initialTier, reducedMotion } });
  requestAnimationFrame(loop);
}

intro.addEventListener('click', () => { intro.classList.add('hidden'); window.musicManager?.play?.().catch?.(() => {}); activity?.log({ action: 'Viewer Universe Enter', feature: 'viewer', galaxyId, description: { template: 'abyss' } }); });

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - lastFrame) / 1000, 1 / 30); lastFrame = now; elapsed += dt; averageFrame = averageFrame * .95 + (1 / Math.max(dt, .001)) * .05;
  const depth = depthFromCamera(); const phase = phaseDirector.update(depth);
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
  updateDepthAtmosphere(depth, dt); waterFX?.update(dt, camera, elapsed); seabed?.update(elapsed); beacon?.update(dt, elapsed, phase); fauna?.update(elapsed, phase, camera); relics?.update(dt, elapsed, camera);
  depthLabel.textContent = `DEPTH ${String(Math.round(depth)).padStart(3, '0')} M`;
  if (phase.id === 'release' && releaseElapsed >= 8 && !finished) { finished = true; resetButton.classList.add('visible'); manualDiveButton.classList.remove('visible'); beacon?.triggerPulse(); }
  adaptiveTier.update(dt, averageFrame); renderer.render(scene, camera);
}

init().catch(error => { console.error('[abyss] initialization failed:', error); activity?.log({ action: 'Viewer Universe Error', feature: 'viewer', galaxyId, level: 'error', description: { template: 'abyss', errorType: 'initialization' } }); });
