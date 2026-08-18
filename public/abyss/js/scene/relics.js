import * as THREE from 'three';
import { relicDistanceAt, relicSpawnRange } from '../core/layout.js';

// Ảnh gốc từ ImageKit có thể vài nghìn pixel. Thu nhỏ trước khi lên GPU để
// giữ ngân sách 48 MB texture ở mục 13.7.
function loadTexture(url, maxSize) {
  return new Promise(resolve => {
    if (!url) return resolve(null);
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const longest = Math.max(image.width, image.height);
      let source = image;
      if (longest > maxSize) {
        const scale = maxSize / longest;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        source = canvas;
      }
      const texture = new THREE.Texture(source);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.needsUpdate = true;
      resolve(texture);
    };
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

const FIELD_SIZE = {
  near: { frame: [4.9, 6.3], image: [4.45, 5.75], radius: [5.2, 1.5], spread: 2.6 },
  mid: { frame: [2.5, 3.25], image: [2.18, 2.85], radius: [7, 5], spread: 4 },
  far: { frame: [1.4, 1.85], image: [1.2, 1.6], radius: [11, 7], spread: 6 },
};

function fieldOf(plan, index) {
  if (index < plan.near) return 'near';
  if (index < plan.near + plan.mid) return 'mid';
  return 'far';
}

export async function createRelics(images, captions, theme, tier, reducedMotion, plan) {
  const group = new THREE.Group();
  const relics = [];
  const { span } = relicSpawnRange(plan);
  const pending = [];

  for (let i = 0; i < plan.relicCount; i++) {
    const field = fieldOf(plan, i);
    const size = FIELD_SIZE[field];
    const angle = i * 2.399;
    const radius = size.radius[0] + Math.random() * size.radius[1];
    const frame = new THREE.Group();
    // Quãng đường tới relic đo bằng mét, đổi sang -Z vì camera lặn theo -Z.
    frame.position.set(
      Math.cos(angle) * radius,
      (Math.random() - 0.5) * size.spread,
      -relicDistanceAt(plan, i),
    );
    frame.rotation.set((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.12);

    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(size.frame[0], size.frame[1]),
      new THREE.MeshBasicMaterial({ color: theme.trench, transparent: true, opacity: field === 'far' ? 0.34 : 0.5, side: THREE.DoubleSide }),
    );
    glass.material.color.lerp(theme.accent, 0.14);
    frame.add(glass);

    let imageMesh = null;
    // Far field cố ý KHÔNG có ảnh: nó là silhouette tạo chiều sâu (mục 4.4),
    // không phải chỗ trống chờ nội dung.
    if (field !== 'far') {
      imageMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(size.image[0], size.image[1]),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: field === 'near' ? 0.94 : 0.8, side: THREE.DoubleSide }),
      );
      imageMesh.position.z = 0.02;
      frame.add(imageMesh);
      pending.push(loadTexture(images[i], tier.texture).then(texture => {
        if (texture) { imageMesh.material.map = texture; imageMesh.material.needsUpdate = true; }
      }));
    }

    frame.userData = {
      relic: true, field, index: i, sequence: i,
      url: field === 'far' ? null : images[i],
      caption: field === 'far' ? '' : (captions[i] || ''),
      base: frame.position.clone(), phase: Math.random() * 6,
      imageMesh, focused: false, hovered: false,
    };
    group.add(frame);
    relics.push(frame);
  }

  await Promise.all(pending);

  let visibleCount = relics.length;

  function update(dt, elapsed, camera) {
    relics.forEach((frame, i) => {
      const data = frame.userData;
      if (data.focused) {
        const target = camera.position.clone().add(new THREE.Vector3(0, 0, -5));
        frame.position.lerp(target, 1 - Math.pow(0.001, dt));
        return;
      }
      const hoverPull = data.hovered ? 0.32 : 0;
      frame.position.y = data.base.y + Math.sin(elapsed * 0.3 + data.phase) * (reducedMotion ? 0.03 : 0.18);
      frame.position.z = data.base.z + hoverPull;
      if (!reducedMotion) frame.rotation.z += Math.sin(elapsed * 0.25 + i) * 0.0007;

      if (frame.position.z > camera.position.z + 12) {
        data.base.z -= span;
        frame.position.z = data.base.z;
        if (plan.streamed && data.imageMesh) {
          data.sequence = (data.sequence + plan.relicCount) % images.length;
          data.url = images[data.sequence];
          data.caption = captions[data.sequence] || '';
          const mesh = data.imageMesh;
          loadTexture(data.url, tier.texture).then(texture => {
            if (texture) { mesh.material.map = texture; mesh.material.needsUpdate = true; }
          });
        }
      }
    });
  }

  function getRelics() { return relics.slice(0, visibleCount); }

  function setVisibleCount(count) {
    visibleCount = Math.max(0, Math.min(relics.length, count));
    relics.forEach((frame, i) => { frame.visible = i < visibleCount; });
  }

  return { group, update, getRelics, setVisibleCount };
}
