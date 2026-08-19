import * as THREE from 'three';
import { D0, START_Z } from '../core/depth.js';

// Beacon là hình ảnh trung tâm của cả cảnh (mục 5), nhưng z = -292 cố định làm
// nó nằm NGOÀI tầm với của mọi galaxy <= 3 ảnh: quãng lặn 180 m chỉ đưa camera
// tới z = -175. Đặt theo PHẦN quãng đường như Task 7 đã làm với fauna.
//
// Dải hợp lệ hẹp hơn trực giác rất nhiều vì phải thoả đồng thời:
//   • nằm trong cửa sổ phase beacon_reveal ở MỌI bảng phase — trần chặt nhất là
//     bảng 6 phase quãng 500 m, cửa sổ đóng ở độ sâu 430 m  =>  F <= 0.770;
//   • cross-fade 8 m phải xong TRƯỚC khi camera tới nơi — sàn chặt nhất là bảng
//     5 phase quãng 320 m, biên phase ở độ sâu 277.9 m      =>  F >= 0.753.
// Lưu ý độ sâu của vật ở z = -(dive*F) là 45 + dive*F chứ không phải 40 + dive*F:
// camera xuất phát ở z = +5 nên đi thêm 5 m nữa mới tới vạch 0 (core/depth.js).
export const BEACON_DIVE_FRACTION = 0.76;

const DEFAULT_DIVE = 500;

// Beacon phải sáng đủ trước khi camera tới nơi. 70 m ramp khớp tầm nhìn ở đáy
// (D90 ≈ 50 m theo bảng 13.2): sáng sớm hơn nữa thì sương nuốt hết, chẳng ai thấy.
const REVEAL_RAMP = 70;
const REVEAL_LEAD = 10;

export function createMemoryBeacon(theme, plan) {
  const dive = Number.isFinite(plan?.diveDistance) && plan.diveDistance > 0 ? plan.diveDistance : DEFAULT_DIVE;
  const distance = dive * BEACON_DIVE_FRACTION;
  const arriveDepth = D0 + START_Z + distance;
  const group = new THREE.Group();
  group.position.set(0, -2.2, -distance);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.6, 2.4, 8), new THREE.MeshBasicMaterial({ color: theme.trench, transparent: true, opacity: .95 }));
  base.position.y = -2; group.add(base);
  const branches = [];
  for (let i = 0; i < 9; i++) {
    const height = 3 + Math.random() * 3.6;
    const material = new THREE.MeshBasicMaterial({ color: i % 3 === 0 ? theme.accentSecondary : theme.accent, transparent: true, opacity: .6, blending: THREE.AdditiveBlending });
    const branch = new THREE.Mesh(new THREE.ConeGeometry(.22 + Math.random() * .2, height, 7), material);
    branch.position.set((Math.random() - .5) * 3.8, Math.random() * 2.2, (Math.random() - .5) * 2.8);
    branch.rotation.set((Math.random() - .5) * .35, Math.random() * Math.PI, (Math.random() - .5) * .35);
    branch.userData.branch = { phase: Math.random() * 6, height };
    branches.push(branch); group.add(branch);
  }
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9, 2), new THREE.MeshBasicMaterial({ color: theme.memoryGlow, transparent: true, opacity: .78, blending: THREE.AdditiveBlending }));
  core.position.y = 1.3; group.add(core);
  const lattice = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 5.4, 18, 8, true), new THREE.MeshBasicMaterial({ color: theme.memoryGlow, wireframe: true, transparent: true, opacity: .22, blending: THREE.AdditiveBlending }));
  lattice.position.y = 1.2; lattice.rotation.z = .12; group.add(lattice);
  const aura = new THREE.Mesh(new THREE.SphereGeometry(5.6, 20, 16), new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: .07, blending: THREE.AdditiveBlending, depthWrite: false }));
  aura.position.y = 1.2; group.add(aura);
  const shimmer = new THREE.Mesh(new THREE.PlaneGeometry(10, 7), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uColor: { value: theme.accent } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'uniform float uTime; uniform vec3 uColor; varying vec2 vUv; void main(){float wave=sin(vUv.x*12.0+uTime*1.4)*sin(vUv.y*9.0-uTime);float edge=smoothstep(.0,.35,vUv.x)*smoothstep(1.,.65,vUv.x);gl_FragColor=vec4(uColor,(.012+.02*wave)*edge);}',
  }));
  shimmer.position.set(0, 5, -1); shimmer.rotation.x = -.32; group.add(shimmer);
  const motes = [];
  for (let i = 0; i < 12; i++) {
    const mote = new THREE.Mesh(new THREE.SphereGeometry(.05 + Math.random() * .08, 6, 6), new THREE.MeshBasicMaterial({ color: theme.memoryGlow, transparent: true, opacity: .6, blending: THREE.AdditiveBlending }));
    mote.userData.mote = { phase: Math.random() * 6, radius: 3 + Math.random() * 3, speed: .3 + Math.random() * .4 }; motes.push(mote); group.add(mote);
  }
  let pulse = 0;
  function triggerPulse() { pulse = 1; }
  function update(dt, elapsed, phase) {
    pulse = Math.max(0, pulse - dt / 2.2);
    // Reveal không được bám vào phase.index: bảng phase co lại theo số ảnh (mục
    // 13.11) nên index 2 là memory_trench ở galaxy lớn nhưng lại là 'release' ở
    // galaxy <= 3 ảnh — beacon mới sáng 75% đúng lúc camera tới nơi. Ramp theo độ
    // sâu của CHÍNH beacon, đủ 1.0 từ 10 m trước khi tới, ở mọi bảng phase.
    const approach = Math.min(1, Math.max(0, (phase.depth - (arriveDepth - REVEAL_RAMP)) / (REVEAL_RAMP - REVEAL_LEAD)));
    const reveal = phase.id === 'release' ? 1 - (phase.releaseProgress || 0) : .35 + approach * .65;
    core.material.opacity = (.55 + pulse * .28) * reveal;
    aura.material.opacity = (.04 + pulse * .08) * reveal;
    branches.forEach((branch, i) => { branch.material.opacity = (.3 + pulse * .3) * reveal; branch.rotation.z = Math.sin(elapsed * .35 + branch.userData.branch.phase) * .08; });
    motes.forEach(mote => { const meta = mote.userData.mote; const t = elapsed * meta.speed + meta.phase; mote.position.set(Math.cos(t) * meta.radius, 1.2 + Math.sin(t * 1.3) * 2, Math.sin(t) * meta.radius); mote.material.opacity = (.22 + pulse * .5) * reveal; });
    shimmer.material.uniforms.uTime.value = elapsed;
    if (phase.id === 'release') group.visible = true;
  }
  return { group, update, triggerPulse, position: group.position };
}
