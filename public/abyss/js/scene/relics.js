import * as THREE from 'three';
import { relicDistanceAt, relicWrapDistance } from '../core/layout.js';
import { FLOOR_Y } from './seabed.js';

// Ảnh gốc từ ImageKit có thể vài nghìn pixel. Thu nhỏ trước khi lên GPU để
// giữ ngân sách 48 MB texture ở mục 13.7.
export function loadTexture(url, maxSize) {
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

// radius = khoảng cách từ trục camera ra tâm relic. Phải đủ lớn để camera đi
// NGANG QUA chứ không xuyên thẳng vào: FOV ngang ~103 độ nên relic chỉ lọt khung
// khi radius/dz < 1.26, tức nó lớn dần khi tiến tới rồi trượt ra rìa. Với
// radius 5.2 và khung rộng 4.9, mép trong chỉ cách trục 2.75 — camera bay sát
// bên và tấm ảnh chiếm 156% chiều cao khung hình.
// `rise` = phần bán kính vòng được dùng cho trục Y. Trước đây góc vàng chỉ nuôi
// trục X (`Math.cos(angle) * radius`) còn Y là nhiễu +-spread/2, nên với near
// spread 2.6 mọi tấm ảnh nằm trong dải cao 2.6 m giữa một khung nhìn cao ~24 m
// ở khoảng cách 18 m: chụp ở cả 5 độ sâu đều cho một DÂY PHƠI ngang đúng tầm
// mắt, trên và dưới trống trơn. Cho `sin(angle)` nuôi Y là biến dây phơi thành
// vòng quanh trục lặn — có tấm trên đầu, có tấm dưới chân.
//
// rise < 1 vì khung 16:10 và FOV dọc 68 độ hẹp hơn FOV ngang ~103 độ; near
// thấp nhất vì tấm gần phải đọc được, không phải để lướt qua đỉnh đầu.
const FIELD_SIZE = {
  near: { frame: [4.9, 6.3], image: [4.45, 5.75], radius: [8.5, 3], spread: 2.6, rise: 0.42 },
  mid: { frame: [2.5, 3.25], image: [2.18, 2.85], radius: [13, 6], spread: 4, rise: 0.58 },
  far: { frame: [1.4, 1.85], image: [1.2, 1.6], radius: [22, 10], spread: 6, rise: 0.72 },
};

// Sàn đáy biển ở y = -8.5 (scene/seabed.js) và đá nhô lên khỏi nó. Relic rơi
// xuống dưới mốc này bị đá xuyên qua khung ảnh, nên vòng bị kẹp ở dưới —
// lệch lên trên là có chủ đích: nhìn ngược lên phía ánh sáng là hình ảnh của
// biển sâu, nhìn xuống bùn thì không.
const FLOOR_CLEARANCE = 4.2;

function fieldOf(plan, index) {
  if (index < plan.near) return 'near';
  if (index < plan.near + plan.mid) return 'mid';
  return 'far';
}

export async function createRelics(images, captions, theme, tier, reducedMotion, plan) {
  const group = new THREE.Group();
  const relics = [];
  const span = relicWrapDistance(plan);
  // Stride của stream = số relic THỰC SỰ mang ảnh. Far field không có ảnh nên
  // plan.relicCount đếm thừa: với planContent(8, 6) stride sai thành 9 % 8 = 1,
  // mỗi lần cuộn lại hiện đúng tấm vừa đi qua và ảnh cuối không bao giờ xuất hiện.
  // Lưu ý: nếu imageRelicCount và images.length có ước chung, mỗi relic bị khoá
  // trong một lớp thặng dư (planContent(20, 16): gcd(11, 20) = 1 nên không sao,
  // nhưng gcd > 1 vẫn xảy ra ở cấu hình khác). Chấp nhận: "số ô có ảnh" là quy
  // tắc đọc được, còn đi tìm stride nguyên tố cùng nhau thì sau này không ai lần ra.
  const imageRelicCount = plan.near + plan.mid;
  const pending = [];

  for (let i = 0; i < plan.relicCount; i++) {
    const field = fieldOf(plan, i);
    const size = FIELD_SIZE[field];
    const angle = i * 2.399;
    const radius = size.radius[0] + Math.random() * size.radius[1];
    const frame = new THREE.Group();
    // Góc vàng 2.399 rad nuôi CẢ HAI trục: liên tiếp hai relic lệch nhau 137.5
    // độ quanh trục lặn nên không bao giờ xếp thành hàng hay thành nan quạt.
    const rise = Math.sin(angle) * radius * size.rise + (Math.random() - 0.5) * size.spread;
    // Quãng đường tới relic đo bằng mét, đổi sang -Z vì camera lặn theo -Z.
    frame.position.set(
      Math.cos(angle) * radius,
      Math.max(rise, FLOOR_Y + FLOOR_CLEARANCE + size.frame[1] / 2),
      -relicDistanceAt(plan, i),
    );
    frame.rotation.set((Math.random() - 0.5) * 0.12, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.12);

    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(size.frame[0], size.frame[1]),
      new THREE.MeshBasicMaterial({ color: theme.trench, transparent: true, opacity: field === 'far' ? 0.34 : 0.5, side: THREE.DoubleSide }),
    );
    glass.material.color.lerp(theme.accent, 0.14);
    // Far field không mở được lightbox (không có url), nên cũng không được ăn
    // raycast: nếu ăn thì nó vẫn kéo 0.32 khi hover và bật alarm của waterFX,
    // hứa một tương tác không tồn tại.
    if (field === 'far') glass.raycast = () => {};
    frame.add(glass);

    let imageMesh = null;
    // Far field cố ý KHÔNG có ảnh: nó là silhouette tạo chiều sâu (mục 4.4),
    // không phải chỗ trống chờ nội dung.
    if (field !== 'far') {
      imageMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(size.image[0], size.image[1]),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: field === 'near' ? 0.94 : 0.88, side: THREE.DoubleSide }),
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
      base: frame.position.clone(), spawn: frame.position.clone(), phase: Math.random() * 6,
      imageMesh, focused: false, hovered: false,
    };
    group.add(frame);
    relics.push(frame);
  }

  await Promise.all(pending);

  let visibleCount = relics.length;
  // Trần texture phải đọc được lúc chạy: module giữ tham chiếu `tier` từ lúc
  // dựng, nên sau khi hạ tier đường stream vẫn nạp ảnh thay thế ở cỡ tier cũ.
  let textureCap = tier.texture;
  function setTextureCap(size) { if (Number.isFinite(size) && size > 0) textureCap = size; }

  function update(dt, elapsed, camera) {
    relics.forEach((frame, i) => {
      // setVisibleCount được gọi CHÍNH VÌ GPU đang đuối; chạy tiếp vòng recycle
      // cho relic đã ẩn nghĩa là vẫn tải và upload texture cho thứ không ai thấy.
      if (i >= visibleCount) return;
      const data = frame.userData;
      if (data.focused) {
        const target = camera.position.clone().add(new THREE.Vector3(0, 0, -5));
        frame.position.lerp(target, 1 - Math.pow(0.001, dt));
        return;
      }
      const hoverPull = data.hovered ? 0.32 : 0;
      // x cũng phải trả về base: nhánh focused lerp cả ba trục, nên nếu bỏ sót
      // thì đóng lightbox xong relic đứng lại giữa màn hình như lỗi render.
      frame.position.x = data.base.x;
      frame.position.y = data.base.y + Math.sin(elapsed * 0.3 + data.phase) * (reducedMotion ? 0.03 : 0.18);
      frame.position.z = data.base.z + hoverPull;
      if (!reducedMotion) frame.rotation.z += Math.sin(elapsed * 0.25 + i) * 0.0007;

      if (frame.position.z > camera.position.z + 12) {
        data.base.z -= span;
        frame.position.z = data.base.z;
        if (plan.streamed && data.imageMesh) {
          data.sequence = (data.sequence + imageRelicCount) % images.length;
          data.url = images[data.sequence];
          data.caption = captions[data.sequence] || '';
          const mesh = data.imageMesh;
          loadTexture(data.url, textureCap).then(texture => {
            // three không tự giải phóng texture bị thay: không dispose là rò
            // đúng thứ ngân sách 48 MB ở mục 13.7 đang cố giữ.
            if (texture) { mesh.material.map?.dispose(); mesh.material.map = texture; mesh.material.needsUpdate = true; }
          });
        }
      }
    });
  }

  function getRelics() { return relics.slice(0, visibleCount); }

  // base.z bị trừ dần mỗi lần cuộn, nên sau một lần lặn hết hành trình mọi relic
  // đều nằm sâu hơn điểm dừng của camera. Không có reset thì lần lặn thứ hai là
  // nước trống hoàn toàn. spawn giữ nguyên vị trí sinh ra để khôi phục.
  function reset() {
    relics.forEach(frame => {
      const data = frame.userData;
      data.base.copy(data.spawn);
      frame.position.copy(data.spawn);
      data.focused = false;
      data.hovered = false;
    });
  }

  function setVisibleCount(count) {
    visibleCount = Math.max(0, Math.min(relics.length, count));
    relics.forEach((frame, i) => { frame.visible = i < visibleCount; });
  }

  return { group, update, getRelics, setVisibleCount, setTextureCap, reset };
}
