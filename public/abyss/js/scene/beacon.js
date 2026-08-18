import * as THREE from 'three';

export function createMemoryBeacon(theme) {
  const group = new THREE.Group();
  group.position.set(0, -2.2, -292);
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
    const reveal = phase.id === 'release' ? 1 - (phase.releaseProgress || 0) : (phase.index >= 2 ? 1 : .35 + phase.progress * .65);
    core.material.opacity = (.55 + pulse * .28) * reveal;
    aura.material.opacity = (.04 + pulse * .08) * reveal;
    branches.forEach((branch, i) => { branch.material.opacity = (.3 + pulse * .3) * reveal; branch.rotation.z = Math.sin(elapsed * .35 + branch.userData.branch.phase) * .08; });
    motes.forEach(mote => { const meta = mote.userData.mote; const t = elapsed * meta.speed + meta.phase; mote.position.set(Math.cos(t) * meta.radius, 1.2 + Math.sin(t * 1.3) * 2, Math.sin(t) * meta.radius); mote.material.opacity = (.22 + pulse * .5) * reveal; });
    shimmer.material.uniforms.uTime.value = elapsed;
    if (phase.id === 'release') group.visible = true;
  }
  return { group, update, triggerPulse, position: group.position };
}
