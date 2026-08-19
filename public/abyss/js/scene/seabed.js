import * as THREE from 'three';

function makeRockGeometry(scale = 1) {
  const geometry = new THREE.DodecahedronGeometry(scale, 1);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const n = 0.72 + Math.random() * .55;
    position.setXYZ(i, position.getX(i) * n, position.getY(i) * (.65 + Math.random() * .45), position.getZ(i) * n);
  }
  geometry.computeVertexNormals();
  // Scene là unlit (mục 13.5, 0 dynamic light) nên khối đá không có bóng, và ở
  // opacity .19 nó nhìn xuyên qua mặt sau thành nét vẽ chồng chéo. Nướng sẵn số
  // hạng lambert theo ánh sáng rọi từ mặt nước xuống vào vertex color để đá có
  // khối mà vẫn không cần đèn.
  const normal = geometry.attributes.normal;
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const lit = Math.max(0, normal.getY(i)) ** 1.4;
    const shade = .12 + lit * .42;
    colors[i * 3] = shade; colors[i * 3 + 1] = shade; colors[i * 3 + 2] = shade;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

// Đáy biển cũ dài cố định 640 m quanh z = -300, tức là chạy từ z +20 tới -620.
// Ở quãng lặn 620 m camera trôi tới z = -622 và BƠI RA KHỎI MÉP đáy biển ngay
// cảnh kết; ngược lại đá/rặng/rong luôn rải trên ~590 m nên chuyến 180 m gần như
// trống trơn. Mọi kích thước dưới đây vì thế đo theo quãng lặn.
//
// scale = 1 đúng ở mốc 500 m, nên MỌI con số ở mốc đó bằng đúng bản cũ: sàn
// +20..-620, đá trên 570 m, 18 rặng cách nhau 34 m, rong trên 470 m. Số lượng
// nhân theo scale nên mật độ trên mét là hằng số — 180 m không thưa hơn, 620 m
// không dày hơn những gì 500 m đang có.
const DEFAULT_DIVE = 500;
const FLOOR_MARGIN = 120; // mét sàn kéo dài quá vạch đích, > tầm nhìn D90 ở đáy
const REFERENCE_FLOOR = DEFAULT_DIVE + FLOOR_MARGIN;
const FLOOR_START = 20;   // sàn bắt đầu sau lưng chỗ camera xuất phát (z = +5)

export function createSeabed(theme, tier, plan) {
  const dive = Number.isFinite(plan?.diveDistance) && plan.diveDistance > 0 ? plan.diveDistance : DEFAULT_DIVE;
  const floorEnd = dive + FLOOR_MARGIN;
  const scale = floorEnd / REFERENCE_FLOOR;
  const floorLength = floorEnd + FLOOR_START;
  const group = new THREE.Group();
  // Rộng 90 nghĩa là mép hai bên chỉ cách trục 45; với FOV ngang ~103 độ camera
  // thấy tới +-1.26*d nên từ 36 m trở đi MÉP SÀN lọt vào khung hình thành một
  // đường cong rõ. 240 đẩy mép ra 95 m, xa hơn D90 của fog ở mọi dải độ sâu.
  const floorGeometry = new THREE.PlaneGeometry(240, floorLength, 30, Math.max(24, Math.round(floorLength / 4)));
  const floorPosition = floorGeometry.attributes.position;
  for (let i = 0; i < floorPosition.count; i++) {
    const x = floorPosition.getX(i); const y = floorPosition.getY(i);
    floorPosition.setZ(i, Math.sin(x * .18) * .18 + Math.sin(y * .1) * .24 + (Math.random() - .5) * .08);
  }
  floorGeometry.computeVertexNormals();
  const floor = new THREE.Mesh(floorGeometry, new THREE.MeshBasicMaterial({ color: theme.trench, transparent: true, opacity: .96, side: THREE.DoubleSide }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -8.5, FLOOR_START - floorLength / 2); group.add(floor);

  // Đục, không transparent: nhìn xuyên qua đá là thứ tạo ra cảm giác nét vẽ.
  const rockMaterial = new THREE.MeshBasicMaterial({ color: theme.coldTeal, vertexColors: true });
  const rockGeometry = makeRockGeometry(1);
  // Không kẹp theo tier.rocks: giữ mật độ mới là yêu cầu, và đá là MỘT
  // InstancedMesh nên thêm 20% instance ở quãng 620 m chỉ là thêm đỉnh, không
  // thêm draw call.
  const rockCount = Math.max(6, Math.round(tier.rocks * scale));
  const rockSpan = 570 * scale;
  const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, rockCount);
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < rockCount; i++) {
    const side = i % 3 === 0 ? 1 : -1;
    const x = side * (7 + Math.random() * 28);
    const z = -14 - Math.random() * rockSpan;
    const scale = .3 + Math.random() * 1.4;
    matrix.compose(new THREE.Vector3(x, -8.2 + Math.random() * .3, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random(), Math.random(), Math.random())), new THREE.Vector3(scale * (1 + Math.random()), scale * .6, scale));
    rocks.setMatrixAt(i, matrix);
  }
  rocks.instanceMatrix.needsUpdate = true; group.add(rocks);

  const ridgeMaterial = new THREE.MeshBasicMaterial({ color: theme.trench, transparent: true, opacity: .92, side: THREE.DoubleSide });
  const ridgeGeometry = new THREE.BufferGeometry();
  const ridgeVertices = [];
  const ridgeCount = Math.max(3, Math.floor(18 * scale));
  for (let i = 0; i < ridgeCount; i++) {
    const z = -12 - i * 34; const width = 8 + Math.sin(i * 1.2) * 2;
    ridgeVertices.push(-width, -8.4, z, width, -8.4, z, 0, -5.7 + Math.sin(i) * .5, z - 14);
  }
  ridgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(ridgeVertices, 3));
  const ridge = new THREE.Mesh(ridgeGeometry, ridgeMaterial); group.add(ridge);

  const kelp = [];
  const kelpMaterial = new THREE.MeshBasicMaterial({ color: theme.coldTeal, transparent: true, opacity: .38 });
  const kelpCount = Math.max(2, Math.round(Math.min(18, tier.rocks / 5) * scale));
  for (let i = 0; i < kelpCount; i++) {
    const height = 3 + Math.random() * 8;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.05, .16, height, 6), kelpMaterial);
    stem.position.set((Math.random() - .5) * 40, -8.5 + height / 2, -18 - Math.random() * (470 * scale));
    stem.rotation.z = (Math.random() - .5) * .25; stem.userData.kelp = { phase: Math.random() * Math.PI * 2, base: stem.rotation.z };
    kelp.push(stem); group.add(stem);
  }

  function update(elapsed) {
    kelp.forEach(stem => { stem.rotation.z = stem.userData.kelp.base + Math.sin(elapsed * .45 + stem.userData.kelp.phase) * .08; });
  }
  return { group, update };
}
