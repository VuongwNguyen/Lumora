import * as THREE from 'three';

function makeRockGeometry(scale = 1) {
  const geometry = new THREE.DodecahedronGeometry(scale, 1);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const n = 0.72 + Math.random() * .55;
    position.setXYZ(i, position.getX(i) * n, position.getY(i) * (.65 + Math.random() * .45), position.getZ(i) * n);
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function createSeabed(theme, tier) {
  const group = new THREE.Group();
  const floorGeometry = new THREE.PlaneGeometry(90, 640, 30, 160);
  const floorPosition = floorGeometry.attributes.position;
  for (let i = 0; i < floorPosition.count; i++) {
    const x = floorPosition.getX(i); const y = floorPosition.getY(i);
    floorPosition.setZ(i, Math.sin(x * .18) * .18 + Math.sin(y * .1) * .24 + (Math.random() - .5) * .08);
  }
  floorGeometry.computeVertexNormals();
  const floor = new THREE.Mesh(floorGeometry, new THREE.MeshBasicMaterial({ color: theme.trench, transparent: true, opacity: .96, side: THREE.DoubleSide }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -8.5, -300); group.add(floor);

  const rockMaterial = new THREE.MeshBasicMaterial({ color: theme.coldTeal, transparent: true, opacity: .19 });
  const rockGeometry = makeRockGeometry(1);
  const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, tier.rocks);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < tier.rocks; i++) {
    const side = i % 3 === 0 ? 1 : -1;
    const x = side * (7 + Math.random() * 28);
    const z = -14 - Math.random() * 570;
    const scale = .3 + Math.random() * 1.4;
    matrix.compose(new THREE.Vector3(x, -8.2 + Math.random() * .3, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random(), Math.random(), Math.random())), new THREE.Vector3(scale * (1 + Math.random()), scale * .6, scale));
    rocks.setMatrixAt(i, matrix);
  }
  rocks.instanceMatrix.needsUpdate = true; group.add(rocks);

  const ridgeMaterial = new THREE.MeshBasicMaterial({ color: theme.trench, transparent: true, opacity: .92, side: THREE.DoubleSide });
  const ridgeGeometry = new THREE.BufferGeometry();
  const ridgeVertices = [];
  for (let i = 0; i < 18; i++) {
    const z = -12 - i * 34; const width = 8 + Math.sin(i * 1.2) * 2;
    ridgeVertices.push(-width, -8.4, z, width, -8.4, z, 0, -5.7 + Math.sin(i) * .5, z - 14);
  }
  ridgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(ridgeVertices, 3));
  const ridge = new THREE.Mesh(ridgeGeometry, ridgeMaterial); group.add(ridge);

  const kelp = [];
  const kelpMaterial = new THREE.MeshBasicMaterial({ color: theme.coldTeal, transparent: true, opacity: .38 });
  for (let i = 0; i < Math.min(18, tier.rocks / 5); i++) {
    const height = 3 + Math.random() * 8;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.05, .16, height, 6), kelpMaterial);
    stem.position.set((Math.random() - .5) * 40, -8.5 + height / 2, -18 - Math.random() * 470);
    stem.rotation.z = (Math.random() - .5) * .25; stem.userData.kelp = { phase: Math.random() * Math.PI * 2, base: stem.rotation.z };
    kelp.push(stem); group.add(stem);
  }

  function update(elapsed) {
    kelp.forEach(stem => { stem.rotation.z = stem.userData.kelp.base + Math.sin(elapsed * .45 + stem.userData.kelp.phase) * .08; });
  }
  return { group, update };
}
