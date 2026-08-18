import * as THREE from 'three';

export function createFauna(theme, tier, reducedMotion) {
  const group = new THREE.Group();
  const actors = [];
  let whaleFall;
  let memoryPool;
  function jellyfish(z, x, scale = 1) {
    const g = new THREE.Group(); g.position.set(x, 3, z); g.scale.setScalar(scale);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: theme.rareViolet, transparent: true, opacity: .22, blending: THREE.AdditiveBlending }));
    bell.scale.y = .65; g.add(bell);
    for (let i = 0; i < 4; i++) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(.025, .06, 1.8, 5), new THREE.MeshBasicMaterial({ color: theme.bioluminescent, transparent: true, opacity: .4, blending: THREE.AdditiveBlending })); arm.position.set((i - 1.5) * .25, -.85, 0); g.add(arm); }
    g.userData.fauna = { type: 'jellyfish', baseX: x, phase: Math.random() * 6, startPhase: 1 }; actors.push(g); group.add(g);
  }
  function fishSchool(z) {
    const g = new THREE.Group(); g.position.set(-9, 1, z);
    for (let i = 0; i < Math.min(18, tier.fauna >= 8 ? 18 : 10); i++) { const fish = new THREE.Mesh(new THREE.ConeGeometry(.08, .55, 5), new THREE.MeshBasicMaterial({ color: theme.bioluminescent, transparent: true, opacity: .55, blending: THREE.AdditiveBlending })); fish.position.set((Math.random() - .5) * 5, (Math.random() - .5) * 2, (Math.random() - .5) * 3); fish.rotation.z = Math.PI / 2; g.add(fish); }
    g.userData.fauna = { type: 'fish', phase: Math.random() * 6, startPhase: 4 }; actors.push(g); group.add(g);
  }
  function anemones() {
    for (let i = 0; i < 10; i++) { const g = new THREE.Group(); g.position.set((Math.random() - .5) * 30, -7.8, -75 - Math.random() * 360); for (let j = 0; j < 7; j++) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(.025, .09, 1.1 + Math.random() * 1.6, 5), new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: .3, blending: THREE.AdditiveBlending })); arm.position.x = (Math.random() - .5) * .6; arm.position.y = .5; g.add(arm); } g.userData.fauna = { type: 'anemone', phase: Math.random() * 6, startPhase: 1 }; actors.push(g); group.add(g); }
  }
  function memoryShrimp() {
    const shrimp = new THREE.Group(); shrimp.position.set(2.4, -5.8, -288);
    const body = new THREE.Mesh(new THREE.SphereGeometry(.24, 8, 6), new THREE.MeshBasicMaterial({ color: theme.warmMemory, transparent: true, opacity: .65, blending: THREE.AdditiveBlending }));
    body.scale.set(1.8, .7, .7); shrimp.add(body);
    for (let i = 0; i < 3; i++) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(.018, .025, .5, 5), new THREE.MeshBasicMaterial({ color: theme.warmMemory, transparent: true, opacity: .5 })); leg.position.set((i - 1) * .18, -.18, .08); leg.rotation.z = .8; shrimp.add(leg); }
    shrimp.userData.fauna = { type: 'shrimp', phase: Math.random() * 6, startPhase: 3, baseX: 2.4 }; actors.push(shrimp); group.add(shrimp);
  }
  function deepSilhouettes() {
    [-230, -410].forEach((z, index) => {
      const silhouette = new THREE.Mesh(new THREE.CapsuleGeometry(2.8 - index * .4, 12 + index * 4, 6, 12), new THREE.MeshBasicMaterial({ color: theme.trench, transparent: true, opacity: 0, side: THREE.DoubleSide }));
      silhouette.position.set(index ? 14 : -16, 5, z); silhouette.rotation.z = .35; silhouette.userData.fauna = { type: 'silhouette', phase: Math.random() * 6, startPhase: 2 + index, baseOpacity: .16 }; actors.push(silhouette); group.add(silhouette);
    });
  }
  function driftRibbon() {
    const points = new THREE.CatmullRomCurve3([new THREE.Vector3(-34, 8, -390), new THREE.Vector3(-12, 10, -405), new THREE.Vector3(8, 5, -422), new THREE.Vector3(32, 11, -440)]);
    const ribbon = new THREE.Mesh(new THREE.TubeGeometry(points, 32, .12, 6, false), new THREE.MeshBasicMaterial({ color: theme.bioluminescent, transparent: true, opacity: .28, blending: THREE.AdditiveBlending }));
    ribbon.userData.fauna = { type: 'ribbon', phase: Math.random() * 6, startPhase: 4 }; actors.push(ribbon); group.add(ribbon);
  }
  function whaleFallLandmark() {
    whaleFall = new THREE.Group(); whaleFall.position.set(0, -7.8, -505);
    const boneMaterial = new THREE.MeshBasicMaterial({ color: theme.trench, transparent: true, opacity: .78 });
    for (let i = 0; i < 7; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(2 + Math.sin(i) * .25, .16, 6, 16, Math.PI), boneMaterial); rib.position.set((i - 3) * 1.5, 1.2 + Math.sin(i) * .3, 0); rib.rotation.z = Math.PI / 2; whaleFall.add(rib); }
    whaleFall.userData.fauna = { type: 'whaleFall', phase: 0, startPhase: 4 }; actors.push(whaleFall); group.add(whaleFall);
  }
  function brineMemoryPool() {
    memoryPool = new THREE.Mesh(new THREE.CircleGeometry(7, 32), new THREE.MeshBasicMaterial({ color: theme.rareViolet, transparent: true, opacity: .08, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    memoryPool.position.set(0, -8.25, -570); memoryPool.rotation.x = -Math.PI / 2; memoryPool.userData.fauna = { type: 'memoryPool', startPhase: 5 }; actors.push(memoryPool); group.add(memoryPool);
  }
  if (tier.fauna >= 2) jellyfish(-170, 12, 1.2);
  if (tier.fauna >= 4) jellyfish(-280, -14, .8);
  if (tier.fauna >= 5) fishSchool(-390);
  anemones();
  memoryShrimp(); deepSilhouettes();
  if (tier.fauna >= 5) driftRibbon();
  whaleFallLandmark();
  brineMemoryPool();
  function update(elapsed, phase, camera) {
    actors.forEach(actor => {
      const meta = actor.userData.fauna; const visible = phase.index >= meta.startPhase - 1;
      actor.visible = visible;
      if (!visible) return;
      if (meta.type === 'jellyfish' || meta.type === 'fish' || meta.type === 'shrimp') actor.position.x = meta.baseX + Math.sin(elapsed * .12 + meta.phase) * 2;
      if (!reducedMotion && ['jellyfish', 'fish', 'shrimp'].includes(meta.type)) actor.position.y += Math.sin(elapsed * .3 + meta.phase) * .0008;
      if (meta.type === 'anemone') actor.rotation.z = Math.sin(elapsed * .45 + meta.phase) * .08;
      if (meta.type === 'silhouette') actor.material.opacity = phase.index >= meta.startPhase ? meta.baseOpacity * Math.min(1, phase.progress * 2) : 0;
      if (meta.type === 'ribbon') actor.rotation.y = Math.sin(elapsed * .08 + meta.phase) * .08;
      if (meta.type === 'memoryPool') actor.material.opacity = phase.index >= meta.startPhase ? .08 * Math.min(1, phase.progress * 2) : 0;
    });
  }
  return { group, update };
}
