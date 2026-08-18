import * as THREE from 'three';

function loadTexture(url, maxSize) {
  return new Promise(resolve => {
    if (!url) return resolve(null);
    new THREE.TextureLoader().load(url, texture => { texture.colorSpace = THREE.SRGBColorSpace; resolve(texture); }, undefined, () => resolve(null));
  });
}

export async function createRelics(images, captions, theme, tier, reducedMotion) {
  const group = new THREE.Group();
  const relics = [];
  const count = Math.min(images.length, tier.relics);
  const trenchLength = Math.min(620, Math.max(180, 40 * Math.max(1, images.length)));
  const pendingTextures = [];
  for (let i = 0; i < count; i++) {
    const near = i < Math.min(3, count); const radius = near ? 5.2 + Math.random() * 1.5 : 7 + Math.random() * 5;
    const angle = i * 2.399;
    const frame = new THREE.Group();
    frame.position.set(Math.cos(angle) * radius, near ? (Math.random() - .5) * 2.6 : (Math.random() - .5) * 4, -180 - i * (trenchLength / Math.max(1, count)));
    frame.rotation.set((Math.random() - .5) * .12, (Math.random() - .5) * .2, (Math.random() - .5) * .12);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(near ? 4.9 : 2.5, near ? 6.3 : 3.25), new THREE.MeshBasicMaterial({ color: 0x0b2b30, transparent: true, opacity: .5, side: THREE.DoubleSide }));
    const image = new THREE.Mesh(new THREE.PlaneGeometry(near ? 4.45 : 2.18, near ? 5.75 : 2.85), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .94, side: THREE.DoubleSide }));
    image.position.z = .02; frame.add(glass, image);
    frame.userData = { relic: true, url: images[i], caption: captions[i] || '', index: i, sequence: i, base: frame.position.clone(), phase: Math.random() * 6, near, focused: false };
    pendingTextures.push(loadTexture(images[i], tier.texture).then(texture => { if (texture) { image.material.map = texture; image.material.needsUpdate = true; } }));
    group.add(frame); relics.push(frame);
  }
  await Promise.all(pendingTextures);
  function update(dt, elapsed, camera) {
    relics.forEach((frame, i) => {
      const data = frame.userData;
      if (data.focused) frame.position.lerp(camera.position.clone().add(new THREE.Vector3(0, 0, -5)), 1 - Math.pow(.001, dt));
      else { frame.position.y = data.base.y + Math.sin(elapsed * .3 + data.phase) * (reducedMotion ? .03 : .18); frame.rotation.z += Math.sin(elapsed * .25 + i) * .0007; }
      if (!data.focused && frame.position.z > camera.position.z + 12) {
        frame.position.z -= trenchLength;
        data.base.z -= trenchLength;
        if (images.length > count) {
          data.sequence = (data.sequence + count) % images.length;
          data.url = images[data.sequence]; data.caption = captions[data.sequence] || '';
          const imageMesh = frame.children[1];
          loadTexture(data.url, tier.texture).then(texture => { if (texture) { imageMesh.material.map = texture; imageMesh.material.needsUpdate = true; } });
        }
      }
    });
  }
  function getRelics() { return relics; }
  return { group, update, getRelics, trenchLength };
}
