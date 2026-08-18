import * as THREE from 'three';

// Vị trí sinh vật đo theo PHẦN của quãng đường lặn, không phải z tuyệt đối.
// plan.diveDistance chạy từ 180 m tới 620 m theo số ảnh (mục 13.11), nên hằng
// số z làm galaxy nhỏ bơi qua vùng nước trống, còn whale fall (z = -505) và
// memory pool (z = -570) thì nằm ngoài tầm camera của MỌI galaxy — hai thứ đó
// chưa từng render lần nào.
//
// Mỗi phần số dưới đây được chọn sao cho ở cả bốn quãng đường 180/320/500/620 m:
//   (a) độ sâu của actor nằm trong cửa sổ phase mà nó xuất hiện, và
//   (b) cross-fade 8 m kết thúc TRƯỚC khi camera đi tới nơi — nếu không actor
//       chỉ sáng lên sau lưng người xem.
// Biên phase dịch theo quãng đường (descent chiếm 16% hành trình đủ 6 phase
// nhưng 21% hành trình 5 phase), nên dải hợp lệ hẹp hơn nhiều so với trực giác.
const PLACEMENT = Object.freeze({
  anemoneFirst: 0.27, anemoneLast: 0.85,
  jellyfishNear: 0.50, jellyfishFar: 0.56,
  silhouetteTrench: 0.53, silhouetteDeep: 0.82,
  fishSchool: 0.86,
  ribbon: [0.88, 0.9067, 0.9333, 0.96],
  memoryShrimp: 0.90,
  whaleFall: 0.93,
});

// Memory pool là hình ảnh kết bài (mục 14.6): nó phải nằm PHÍA TRƯỚC chỗ camera
// dừng hẳn, không phải chỗ camera bơi qua. Release bắt đầu ở đúng cuối quãng
// đường lặn rồi camera chỉ trôi thêm ~7.2 m, mà cross-fade cần 8 m — nên không
// tồn tại phần số nào < 1 vừa hiện kịp vừa đi qua được. Đặt hồ ra sau vạch đích
// 20 m: camera dừng cách nó ~9.8 m và nhìn xuống thấy mặt hồ sáng dần tới 95%.
const POOL_BEYOND_DIVE = 20;

const DEFAULT_DIVE = 500;

export function createFauna(theme, tier, reducedMotion, plan) {
  const dive = Number.isFinite(plan?.diveDistance) && plan.diveDistance > 0 ? plan.diveDistance : DEFAULT_DIVE;
  const at = fraction => -(dive * fraction);
  const group = new THREE.Group();
  const actors = [];
  let whaleFall;
  let memoryPool;
  function jellyfish(z, x, scale = 1) {
    const g = new THREE.Group(); g.position.set(x, 3, z); g.scale.setScalar(scale);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: theme.rareViolet, transparent: true, opacity: .22, blending: THREE.AdditiveBlending }));
    bell.scale.y = .65; g.add(bell);
    for (let i = 0; i < 4; i++) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(.025, .06, 1.8, 5), new THREE.MeshBasicMaterial({ color: theme.bioluminescent, transparent: true, opacity: .4, blending: THREE.AdditiveBlending })); arm.position.set((i - 1.5) * .25, -.85, 0); g.add(arm); }
    g.userData.fauna = { type: 'jellyfish', baseX: x, phase: Math.random() * 6, startPhaseId: 'memory_trench' }; actors.push(g); group.add(g);
  }
  function fishSchool(z) {
    const g = new THREE.Group(); g.position.set(-9, 1, z);
    for (let i = 0; i < Math.min(18, tier.fauna >= 8 ? 18 : 10); i++) { const fish = new THREE.Mesh(new THREE.ConeGeometry(.08, .55, 5), new THREE.MeshBasicMaterial({ color: theme.bioluminescent, transparent: true, opacity: .55, blending: THREE.AdditiveBlending })); fish.position.set((Math.random() - .5) * 5, (Math.random() - .5) * 2, (Math.random() - .5) * 3); fish.rotation.z = Math.PI / 2; g.add(fish); }
    // baseX bắt buộc: update() đặt lại position.x theo meta.baseX, thiếu nó thì
    // đàn cá nhận NaN ngay khung hình đầu tiên nó hiện ra và biến mất hẳn.
    g.userData.fauna = { type: 'fish', baseX: -9, phase: Math.random() * 6, startPhaseId: 'living_ocean' }; actors.push(g); group.add(g);
  }
  function anemones() {
    const count = 10;
    for (let i = 0; i < count; i++) { const g = new THREE.Group(); g.position.set((Math.random() - .5) * 30, -7.8, at(PLACEMENT.anemoneFirst + (i / (count - 1)) * (PLACEMENT.anemoneLast - PLACEMENT.anemoneFirst))); for (let j = 0; j < 7; j++) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(.025, .09, 1.1 + Math.random() * 1.6, 5), new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: .3, blending: THREE.AdditiveBlending })); arm.position.x = (Math.random() - .5) * .6; arm.position.y = .5; g.add(arm); } g.userData.fauna = { type: 'anemone', phase: Math.random() * 6, startPhaseId: 'first_glow' }; actors.push(g); group.add(g); }
  }
  function memoryShrimp() {
    const shrimp = new THREE.Group(); shrimp.position.set(2.4, -5.8, at(PLACEMENT.memoryShrimp));
    const body = new THREE.Mesh(new THREE.SphereGeometry(.24, 8, 6), new THREE.MeshBasicMaterial({ color: theme.warmMemory, transparent: true, opacity: .65, blending: THREE.AdditiveBlending }));
    body.scale.set(1.8, .7, .7); shrimp.add(body);
    for (let i = 0; i < 3; i++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(.018, .025, .5, 5), new THREE.MeshBasicMaterial({ color: theme.warmMemory, transparent: true, opacity: .5 })); leg.position.set((i - 1) * .18, -.18, .08); leg.rotation.z = .8; shrimp.add(leg); }
    shrimp.userData.fauna = { type: 'shrimp', phase: Math.random() * 6, startPhaseId: 'beacon_reveal', baseX: 2.4 }; actors.push(shrimp); group.add(shrimp);
  }
  function deepSilhouettes() {
    [
      { fraction: PLACEMENT.silhouetteTrench, startPhaseId: 'memory_trench' },
      { fraction: PLACEMENT.silhouetteDeep, startPhaseId: 'living_ocean' },
    ].forEach((spot, index) => {
      const silhouette = new THREE.Mesh(new THREE.CapsuleGeometry(2.8 - index * .4, 12 + index * 4, 6, 12), new THREE.MeshBasicMaterial({ color: theme.trench, transparent: true, opacity: 0, side: THREE.DoubleSide }));
      silhouette.position.set(index ? 14 : -16, 5, at(spot.fraction)); silhouette.rotation.z = .35; silhouette.userData.fauna = { type: 'silhouette', phase: Math.random() * 6, startPhaseId: spot.startPhaseId, baseOpacity: .16 }; actors.push(silhouette); group.add(silhouette);
    });
  }
  function driftRibbon() {
    const points = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-34, 8, at(PLACEMENT.ribbon[0])),
      new THREE.Vector3(-12, 10, at(PLACEMENT.ribbon[1])),
      new THREE.Vector3(8, 5, at(PLACEMENT.ribbon[2])),
      new THREE.Vector3(32, 11, at(PLACEMENT.ribbon[3])),
    ]);
    const ribbon = new THREE.Mesh(new THREE.TubeGeometry(points, 32, .12, 6, false), new THREE.MeshBasicMaterial({ color: theme.bioluminescent, transparent: true, opacity: .28, blending: THREE.AdditiveBlending }));
    ribbon.userData.fauna = { type: 'ribbon', phase: Math.random() * 6, startPhaseId: 'living_ocean' }; actors.push(ribbon); group.add(ribbon);
  }
  function whaleFallLandmark() {
    whaleFall = new THREE.Group(); whaleFall.position.set(0, -7.8, at(PLACEMENT.whaleFall));
    const boneMaterial = new THREE.MeshBasicMaterial({ color: theme.trench, transparent: true, opacity: .78 });
    for (let i = 0; i < 7; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(2 + Math.sin(i) * .25, .16, 6, 16, Math.PI), boneMaterial); rib.position.set((i - 3) * 1.5, 1.2 + Math.sin(i) * .3, 0); rib.rotation.z = Math.PI / 2; whaleFall.add(rib); }
    whaleFall.userData.fauna = { type: 'whaleFall', phase: 0, startPhaseId: 'living_ocean' }; actors.push(whaleFall); group.add(whaleFall);
  }
  function brineMemoryPool() {
    memoryPool = new THREE.Mesh(new THREE.CircleGeometry(7, 32), new THREE.MeshBasicMaterial({ color: theme.rareViolet, transparent: true, opacity: .08, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    memoryPool.position.set(0, -8.25, -(dive + POOL_BEYOND_DIVE)); memoryPool.rotation.x = -Math.PI / 2; memoryPool.userData.fauna = { type: 'memoryPool', startPhaseId: 'release' }; actors.push(memoryPool); group.add(memoryPool);
  }
  if (tier.fauna >= 2) jellyfish(at(PLACEMENT.jellyfishNear), 12, 1.2);
  if (tier.fauna >= 4) jellyfish(at(PLACEMENT.jellyfishFar), -14, .8);
  if (tier.fauna >= 5) fishSchool(at(PLACEMENT.fishSchool));
  anemones();
  memoryShrimp(); deepSilhouettes();
  if (tier.fauna >= 5) driftRibbon();
  whaleFallLandmark();
  brineMemoryPool();
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

      // Mục 13.9: reduced motion tắt HẾT fauna drift, kể cả trôi ngang.
      if (!reducedMotion) {
        if (meta.type === 'jellyfish' || meta.type === 'fish' || meta.type === 'shrimp') {
          actor.position.x = meta.baseX + Math.sin(elapsed * 0.12 + meta.phase) * 2;
          actor.position.y += Math.sin(elapsed * 0.3 + meta.phase) * 0.0008;
        }
        if (meta.type === 'anemone') actor.rotation.z = Math.sin(elapsed * 0.45 + meta.phase) * 0.08;
        if (meta.type === 'ribbon') actor.rotation.y = Math.sin(elapsed * 0.08 + meta.phase) * 0.08;
      }
      // Task 8 thay dòng dưới bằng counter-illumination theo caustic.
      if (meta.type === 'silhouette') actor.material.opacity = meta.baseOpacity * reveal;
      if (meta.type === 'memoryPool') actor.material.opacity = 0.08 * reveal;
    });
  }

  // Mốc opacity phải cache trên VẬT LIỆU, không trên mesh: whale fall dùng chung
  // một boneMaterial cho cả 7 xương sườn nên traverse chạm đúng vật liệu đó 7
  // lần. Cache theo child thì lần chạm thứ hai ghi lại giá trị vừa bị nhân với
  // reveal, kết quả là base * reveal^7 và landmark tắt ngóm.
  function applyFade(actor, reveal) {
    const meta = actor.userData.fauna;
    if (meta.type === 'silhouette' || meta.type === 'memoryPool') return; // tự quản opacity
    actor.traverse(child => {
      if (!child.material) return;
      if (child.material.userData.baseOpacity === undefined) child.material.userData.baseOpacity = child.material.opacity;
      child.material.opacity = child.material.userData.baseOpacity * reveal;
    });
  }
  return { group, update };
}
