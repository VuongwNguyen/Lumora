import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { easeTowards } from '../core/depth.js';
import { BEACON_DIVE_FRACTION } from './lighthouse.js';
import { loadTexture } from './relics.js';
import { FLOOR_Y, terrainHeight } from './seabed.js';

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
  // MemoryShrimp là "sinh vật nhỏ gần beacon" (mục 5) nên nó phải đi theo beacon,
  // không giữ phần số riêng: 0.90 làm nó ngồi NGOÀI cửa sổ beacon_reveal ở quãng
  // 500 và 620 m. Không đẩy được beacon xuống 0.90 vì cửa sổ đó đóng ở 0.770,
  // nên tôm phải về với beacon. Cùng phần số, chỉ lệch ngang: dải hợp lệ chỉ rộng
  // 0.017 (~8.5 m ở quãng 500 m), không đủ chỗ xếp hai vật trước sau theo z mà
  // cả hai còn kịp cross-fade.
  memoryShrimp: BEACON_DIVE_FRACTION,
  whaleFall: 0.93,
});

// Tôm đứng cạnh beacon (x = 0, y = -2.2) chứ không chồng lên: 6.5 m ngang cộng
// 3.6 m dưới là 7.4 m, ngoài quả aura bán kính 5.6 m. Trôi ngang +-2 m vẫn ngoài.
const SHRIMP_BESIDE_BEACON = 6.5;

// Mục 14.5 — counter-illumination. Sinh vật biển sâu tự phát sáng bụng để xoá
// bóng của chính nó; ở đây bóng chỉ hiện ra khi cắt ngang một cột caustic, tối
// đa 2 lần mỗi phiên, và KHÔNG BAO GIỜ hiện trọn hình.
const SILHOUETTE_BUDGET = 2;
const SILHOUETTE_PEAK = 0.75;   // đạt tới đây là tính một lần lộ diện rồi tắt dần
const SILHOUETTE_SIGHT = 120;   // camera phải ở trong tầm này mới coi là "thấy"
const SILHOUETTE_GLIMPSE = 45;  // cửa sổ dự phòng khi tier không có caustic
const SILHOUETTE_TAU = 0.4;     // hằng số thời gian, tương đương lerp .04/khung 60fps
const SILHOUETTE_DRIFT = 16;    // biên độ trôi ngang, đủ để cắt qua vài cột sáng
// Task 8 đặt trôi ngang là sin(elapsed * 0.05): chu kỳ 126 s. Quãng lặn 180 m
// chỉ kéo dài 100 s và cửa sổ mà silhouette CÓ THỂ lộ diện (inRange > 0.75, tức
// camera cách nó dưới 30 m) chỉ dài 33 s — con vật có thể đứng nguyên ở một đầu
// biên độ suốt cửa sổ đó và không cắt qua cột caustic nào, thế là mục 14.5 lại
// chết đúng như trước Task 8. Chu kỳ phải co theo quãng lặn.
//
// Và tính theo QUÃNG ĐƯỜNG CAMERA ĐÃ ĐI, không theo elapsed: camera dừng hẳn
// khi người xem mở ảnh đọc caption (abyss.js: pausedForReading) và chậm dần ở
// phase release. Đo theo thời gian thì một lần dừng 30 s làm lệch pha ~1 rad ở
// quãng 500 m, đủ để đẩy con vật ra rìa biên độ đúng lúc camera đi ngang. Đo
// theo (camera.z - actor.z) thì pha tự khớp: sin = 0 đúng khi camera tới nơi,
// tức là lúc đó nó đang lướt ngang NHANH NHẤT qua rừng cột sáng.
// 2 vòng chứ không phải 1.5: ở tier mid chỉ có 3 cột sáng (x = -9, 0, 9) nên
// trench (baseX = -16) phải trôi 7 m mới chạm mép cột gần nhất, và với 1.5 vòng
// điểm chạm đó rơi vào lúc camera còn cách 30 m — inRange tụt xuống 0.75, tích
// inShaft*inRange chỉ đạt 0.752 và opacity dừng ở 0.118, THIẾU 0.002 so với
// ngưỡng tính một lần lộ diện. Đo trên cả 9 tổ hợp tier x quãng đường: 1.5 vòng
// trượt 1 lần, 2 vòng đạt tối thiểu 0.813, 3 vòng tụt lại còn 0.782 và trôi
// nhanh hơn (1.6 m/s so với 1.1 m/s).
const SILHOUETTE_SWEEPS = 2;    // số vòng quét trọn trên cả quãng lặn
// Nửa bề rộng cột sáng của fx/water.js. Cột đã nở 11 -> 13 -> 19 m khi làm mềm
// mép (mục 5 vòng refinement), nhưng hằng số này còn kẹt ở 5.5 nên phép đo
// "silhouette có nằm trong cột sáng không" hụt 1.7 lần: con vật phải trôi vào
// gần trục cột hơn thực tế mới được tính, và mục 14.5 lộ diện thưa hơn thiết kế.
// Số này PHẢI khớp PlaneGeometry(19, 78) trong fx/water.js.
const SHAFT_HALF_WIDTH = 9.5;

// Memory pool là hình ảnh kết bài (mục 14.6): nó phải nằm PHÍA TRƯỚC chỗ camera
// dừng hẳn, không phải chỗ camera bơi qua. Release bắt đầu ở đúng cuối quãng
// đường lặn rồi camera chỉ trôi thêm ~7.2 m, mà cross-fade cần 8 m — nên không
// tồn tại phần số nào < 1 vừa hiện kịp vừa đi qua được. Đặt hồ ra sau vạch đích
// 20 m: camera dừng cách nó ~9.8 m và nhìn xuống thấy mặt hồ sáng dần tới 95%.
const POOL_BEYOND_DIVE = 20;

const DEFAULT_DIVE = 500;

// Đàn cá 18 con, hải quỳ 10 cụm x 7 tua, sứa 4 tua, xác cá voi 7 xương: mỗi
// phần là một Mesh riêng, nên fauna một mình chiếm 114 mesh / 108 material
// trong 196 draw call đo được ở first_glow — ngân sách mục 13.7 là <= 60.
//
// Không phần nào trong số đó động đậy riêng: update() chỉ xoay/dịch CẢ actor
// (rotation.z của hải quỳ, position.x của đàn cá), nên nướng transform vào
// geometry rồi gộp không mất một nhịp chuyển động nào.
//
// Chỉ gộp TRONG PHẠM VI MỘT ACTOR. applyFade cache baseOpacity trên VẬT LIỆU
// rồi nhân theo `reveal` của từng actor, nên gộp chéo actor sẽ làm hai con
// ghi đè fade của nhau — 10 cụm hải quỳ vào cùng lúc chỉ là trùng hợp của
// startPhaseId, không phải bất biến.
function mergedMesh(geometries, material) {
  const merged = mergeGeometries(geometries, false);
  geometries.forEach(geometry => geometry.dispose());
  return new THREE.Mesh(merged, material);
}

export function createFauna(theme, tier, reducedMotion, plan) {
  const dive = Number.isFinite(plan?.diveDistance) && plan.diveDistance > 0 ? plan.diveDistance : DEFAULT_DIVE;
  const at = fraction => -(dive * fraction);
  // rad trên mỗi mét camera đi được: trọn SILHOUETTE_SWEEPS vòng trên cả quãng
  // lặn, tức chu kỳ dive / 2 mét ~ (dive / 1.8) / 2 giây ở tốc độ lặn danh định
  // 1.8 m/s — 90 s ở quãng 320 m và 172 s ở quãng 620 m.
  const driftRate = (Math.PI * 2 * SILHOUETTE_SWEEPS) / dive;
  const group = new THREE.Group();
  const actors = [];
  let whaleFall;
  let memoryPool;
  function jellyfish(z, x, scale = 1) {
    const g = new THREE.Group(); g.position.set(x, 3, z); g.scale.setScalar(scale);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: theme.rareViolet, transparent: true, opacity: .22, blending: THREE.AdditiveBlending }));
    bell.scale.y = .65; g.add(bell);
    const arms = [];
    for (let i = 0; i < 4; i++) arms.push(new THREE.CylinderGeometry(.025, .06, 1.8, 5).translate((i - 1.5) * .25, -.85, 0));
    g.add(mergedMesh(arms, new THREE.MeshBasicMaterial({ color: theme.bioluminescent, transparent: true, opacity: .4, blending: THREE.AdditiveBlending })));
    g.userData.fauna = { type: 'jellyfish', baseX: x, phase: Math.random() * 6, startPhaseId: 'memory_trench' }; actors.push(g); group.add(g);
  }
  function fishSchool(z) {
    const g = new THREE.Group(); g.position.set(-9, 1, z);
    const bodies = [];
    // rotateZ TRƯỚC translate: Mesh áp rotation rồi mới tới position, nướng
    // ngược thứ tự sẽ quay cả vị trí của con cá quanh gốc cụm.
    for (let i = 0; i < (tier.fauna >= 8 ? 18 : 10); i++) {
      bodies.push(new THREE.ConeGeometry(.08, .55, 5)
        .rotateZ(Math.PI / 2)
        .translate((Math.random() - .5) * 5, (Math.random() - .5) * 2, (Math.random() - .5) * 3));
    }
    g.add(mergedMesh(bodies, new THREE.MeshBasicMaterial({ color: theme.bioluminescent, transparent: true, opacity: .55, blending: THREE.AdditiveBlending })));
    // baseX bắt buộc: update() đặt lại position.x theo meta.baseX, thiếu nó thì
    // đàn cá nhận NaN ngay khung hình đầu tiên nó hiện ra và biến mất hẳn.
    g.userData.fauna = { type: 'fish', baseX: -9, phase: Math.random() * 6, startPhaseId: 'living_ocean' }; actors.push(g); group.add(g);
  }
  function anemones() {
    const count = 10;
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      // Hải quỳ BÁM ĐÁY: phải theo cả cao độ đáy lẫn địa hình tại chỗ nó mọc,
      // nếu không nó lơ lửng giữa nước hoặc chìm trong gờ.
      const anemoneX = (Math.random() - .5) * 30;
      const anemoneZ = at(PLACEMENT.anemoneFirst + (i / (count - 1)) * (PLACEMENT.anemoneLast - PLACEMENT.anemoneFirst));
      g.position.set(anemoneX, FLOOR_Y + terrainHeight(anemoneX, anemoneZ) + .7, anemoneZ);
      const arms = [];
      for (let j = 0; j < 7; j++) arms.push(new THREE.CylinderGeometry(.025, .09, 1.1 + Math.random() * 1.6, 5).translate((Math.random() - .5) * .6, .5, 0));
      g.add(mergedMesh(arms, new THREE.MeshBasicMaterial({ color: theme.accent, transparent: true, opacity: .3, blending: THREE.AdditiveBlending })));
      g.userData.fauna = { type: 'anemone', phase: Math.random() * 6, startPhaseId: 'first_glow' };
      actors.push(g); group.add(g);
    }
  }
  function memoryShrimp() {
    const shrimp = new THREE.Group();
    // -5.8 đi theo BEACON (y = -2.2), không theo mặt đáy: tôm là "sinh vật nhỏ
    // cạnh beacon" của mục 5, và beacon cố ý đặt ở tầm mắt chứ không neo đáy —
    // xem chú thích trong scene/lighthouse.js. Neo tôm vào FLOOR_Y sẽ đẩy nó xuống
    // -26 trong khi beacon vẫn ở -2.2, tức tách rời đúng cặp phải đi cùng nhau.
    shrimp.position.set(SHRIMP_BESIDE_BEACON, -5.8, at(PLACEMENT.memoryShrimp));
    const body = new THREE.Mesh(new THREE.SphereGeometry(.24, 8, 6), new THREE.MeshBasicMaterial({ color: theme.warmMemory, transparent: true, opacity: .65, blending: THREE.AdditiveBlending }));
    body.scale.set(1.8, .7, .7); shrimp.add(body);
    const legs = [];
    for (let i = 0; i < 3; i++) legs.push(new THREE.CylinderGeometry(.018, .025, .5, 5).rotateZ(.8).translate((i - 1) * .18, -.18, .08));
    shrimp.add(mergedMesh(legs, new THREE.MeshBasicMaterial({ color: theme.warmMemory, transparent: true, opacity: .5 })));
    shrimp.userData.fauna = { type: 'shrimp', phase: Math.random() * 6, startPhaseId: 'beacon_reveal', baseX: SHRIMP_BESIDE_BEACON }; actors.push(shrimp); group.add(shrimp);
  }
  function deepSilhouettes() {
    [
      { fraction: PLACEMENT.silhouetteTrench, startPhaseId: 'memory_trench' },
      { fraction: PLACEMENT.silhouetteDeep, startPhaseId: 'living_ocean' },
    ].forEach((spot, index) => {
      const silhouette = new THREE.Mesh(new THREE.CapsuleGeometry(2.8 - index * .4, 12 + index * 4, 6, 12), new THREE.MeshBasicMaterial({ color: theme.trench, transparent: true, opacity: 0, side: THREE.DoubleSide }));
      const baseX = index ? 14 : -16;
      // driftPhase KHÔNG ngẫu nhiên: 0 và pi cho hai con quét ngược chiều nhau
      // (không đồng bộ), mà cả hai vẫn đi qua baseX đúng lúc camera tới nơi.
      // Pha ngẫu nhiên biến mục 14.5 thành xổ số — đúng thứ Task 8 muốn bỏ.
      silhouette.position.set(baseX, 5, at(spot.fraction)); silhouette.rotation.z = .35; silhouette.userData.fauna = { type: 'silhouette', phase: Math.random() * 6, driftPhase: index * Math.PI, startPhaseId: spot.startPhaseId, baseOpacity: .16, baseX }; actors.push(silhouette); group.add(silhouette);
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
    whaleFall = new THREE.Group();
    const whaleZ = at(PLACEMENT.whaleFall);
    whaleFall.position.set(0, FLOOR_Y + terrainHeight(0, whaleZ) + .7, whaleZ);
    const boneMaterial = new THREE.MeshBasicMaterial({ color: theme.trench, transparent: true, opacity: .78 });
    const ribs = [];
    for (let i = 0; i < 7; i++) ribs.push(new THREE.TorusGeometry(2 + Math.sin(i) * .25, .16, 6, 16, Math.PI).rotateZ(Math.PI / 2).translate((i - 3) * 1.5, 1.2 + Math.sin(i) * .3, 0));
    whaleFall.add(mergedMesh(ribs, boneMaterial));
    // essential: whale fall là landmark MANG NỘI DUNG (ảnh cũ nhất, mục 14.3),
    // không phải sinh vật trang trí — nó không được phép biến mất chỉ vì galaxy
    // nhỏ không có living_ocean, nếu không ảnh cũ nhất không còn chỗ để treo.
    whaleFall.userData.fauna = { type: 'whaleFall', phase: 0, startPhaseId: 'living_ocean', essential: true }; actors.push(whaleFall); group.add(whaleFall);
  }
  function brineMemoryPool() {
    memoryPool = new THREE.Mesh(new THREE.CircleGeometry(7, 32), new THREE.MeshBasicMaterial({ color: theme.rareViolet, transparent: true, opacity: .08, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    const poolZ = -(dive + POOL_BEYOND_DIVE);
    memoryPool.position.set(0, FLOOR_Y + terrainHeight(0, poolZ) + .25, poolZ); memoryPool.rotation.x = -Math.PI / 2; memoryPool.userData.fauna = { type: 'memoryPool', startPhaseId: 'release' }; actors.push(memoryPool); group.add(memoryPool);
  }
  if (tier.fauna >= 2) jellyfish(at(PLACEMENT.jellyfishNear), 12, 1.2);
  if (tier.fauna >= 4) jellyfish(at(PLACEMENT.jellyfishFar), -14, .8);
  if (tier.fauna >= 5) fishSchool(at(PLACEMENT.fishSchool));
  anemones();
  memoryShrimp(); deepSilhouettes();
  if (tier.fauna >= 5) driftRibbon();
  whaleFallLandmark();
  brineMemoryPool();
  let silhouetteReveals = 0;
  let lastElapsed = 0;
  let lastCameraZ = null;

  function update(elapsed, phase, camera, blendInto, phaseTable, causticShafts = []) {
    // update() không nhận dt (abyss.js truyền elapsed), nhưng easing phải độc lập
    // frame-rate như Task 1/5 đã chuẩn hoá. elapsed là tổng dt nên hiệu hai lần
    // gọi chính là dt; abyss.js đã kẹp dt <= 1/30 nên không cần kẹp lại.
    const dt = Math.max(0, elapsed - lastElapsed);
    lastElapsed = elapsed;
    // Camera chỉ đi theo -Z; nhảy ngược về START_Z nghĩa là người xem bấm "lặn
    // lại". Lần lặn mới là một phiên mới nên ngân sách 2 lần lộ diện phải được
    // trả lại, nếu không lần lặn thứ hai trở đi sẽ không còn silhouette nào.
    if (lastCameraZ !== null && camera.position.z > lastCameraZ + 1) reset();
    lastCameraZ = camera.position.z;
    actors.forEach(actor => {
      const meta = actor.userData.fauna;
      const startIndex = resolveStartIndex(phaseTable, meta);
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
        // Silhouette phải TRÔI thì mới có chuyện "cắt ngang" cột sáng; đứng yên
        // thì khoảng cách tới cột là hằng số và hiệu ứng chỉ còn là bật/tắt.
        if (meta.type === 'silhouette' && !meta.spent) actor.position.x = meta.baseX + Math.sin((camera.position.z - actor.position.z) * driftRate + meta.driftPhase) * SILHOUETTE_DRIFT;
        if (meta.type === 'ribbon') actor.rotation.y = Math.sin(elapsed * 0.08 + meta.phase) * 0.08;
      }
      if (meta.type === 'silhouette') updateSilhouette(actor, meta, camera, causticShafts, dt);
      if (meta.type === 'memoryPool') actor.material.opacity = 0.08 * reveal;
    });
  }

  // startPhase phải tra theo ID, không theo index. Bảng phase co lại theo số ảnh
  // (mục 13.11), nên galaxy 3 ảnh chỉ có 3 phase — index 4-5 không tồn tại.
  // Với fauna thường, phase vắng mặt nghĩa là actor đó không thuộc hành trình
  // này và bị ẩn hẳn: galaxy 3 ảnh thật sự không có Living Ocean nên thật sự
  // không có đàn cá. Actor `essential` thì ngược lại — nó lùi về phase cuối
  // trước release để vẫn có một chỗ đứng ở cuối rãnh dù bảng phase ngắn tới đâu.
  function resolveStartIndex(phaseTable, meta) {
    const preferred = phaseTable.findIndex(entry => entry.id === meta.startPhaseId);
    if (preferred >= 0 || !meta.essential) return preferred;
    for (let i = phaseTable.length - 1; i >= 0; i--) if (phaseTable[i].id !== 'release') return i;
    return -1;
  }

  // Mục 14.5: bóng sinh vật chỉ hiện khi cắt ngang một tia caustic, tối đa 2 lần
  // mỗi phiên, và không bao giờ hiện trọn hình — người xem không chắc mình vừa
  // thấy gì. Đó là mục tiêu.
  //
  // KHÔNG so khoảng cách theo cả (x, z) tới shaft: shaft đứng ở z = -25 - i*34,
  // xa nhất -229 m ở tier high, còn silhouette nằm ở 53% và 82% quãng lặn — gần
  // nhất là z = -169.6 (quãng 320 m), cách cột gần nhất 22 m, còn ở quãng 500 m
  // thì cách 53 m. Với bán kính 14 m, phép đo hai chiều KHÔNG BAO GIỜ khớp ở bất
  // kỳ tier hay quãng đường nào — silhouette sẽ vĩnh viễn opacity 0.
  // Shaft là tấm rèm sáng đứng (cao 52 m, tâm y = 17): thứ đo được là silhouette
  // có nằm trong CỘT sáng đó theo x hay không; z của tấm rèm chỉ là chỗ nó được
  // vẽ, không phải giới hạn của cột sáng rọi xuống.
  function updateSilhouette(actor, meta, camera, causticShafts, dt) {
    if (meta.spent) { actor.visible = false; actor.material.opacity = 0; return; }
    const distanceZ = Math.abs(actor.position.z - camera.position.z);
    const inRange = Math.max(0, 1 - distanceZ / SILHOUETTE_SIGHT);
    // Tier low và reduced motion đều có 0 shaft (fx/water.js). Im lặng không hiện
    // gì là bỏ hẳn một sinh vật mục 5 yêu cầu, mà reduced motion là thiết lập trợ
    // năng chứ không phải mức đồ hoạ — nên vẫn cho một thoáng lộ diện, chỉ là
    // theo lúc camera đi ngang thay vì theo cột sáng.
    let inShaft = Math.max(0, 1 - distanceZ / SILHOUETTE_GLIMPSE);
    if (causticShafts.length) {
      let nearest = Infinity;
      for (const shaft of causticShafts) nearest = Math.min(nearest, Math.abs(actor.position.x - shaft.x));
      inShaft = Math.max(0, 1 - nearest / SHAFT_HALF_WIDTH);
    }
    // Đã tính một lần lộ diện thì tắt hẳn: đó là thứ giữ cho hình không bao giờ
    // sáng trọn vẹn (đỉnh ~0.75 * baseOpacity) và bảo đảm actor tự chuyển sang
    // spent thay vì đứng sáng lờ mờ khi camera dừng gần nó.
    const target = meta.counted || silhouetteReveals >= SILHOUETTE_BUDGET ? 0 : meta.baseOpacity * inShaft * inRange;
    actor.material.opacity = easeTowards(actor.material.opacity, target, dt, SILHOUETTE_TAU);
    if (!meta.counted && actor.material.opacity > meta.baseOpacity * SILHOUETTE_PEAK) { meta.counted = true; silhouetteReveals += 1; }
    if (meta.counted && actor.material.opacity < 0.005) { meta.spent = true; actor.material.opacity = 0; actor.visible = false; }
  }

  function reset() {
    silhouetteReveals = 0;
    actors.forEach(actor => {
      const meta = actor.userData.fauna;
      if (meta.type !== 'silhouette') return;
      meta.counted = false; meta.spent = false; actor.material.opacity = 0; actor.visible = false;
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
  // Mục 14.3: cái đã mất vẫn tiếp tục nuôi. Ảnh cũ nhất trong galaxy được neo
  // vào xác cá voi, không phải chọn ngẫu nhiên.
  //
  // Vật liệu RIÊNG cho tấm ảnh, không dùng chung boneMaterial: applyFade cache
  // baseOpacity trên vật liệu nên dùng chung sẽ kéo ảnh về đúng .78 của xương.
  // Thêm con sau khi dựng xong vẫn an toàn — cache là lazy theo từng vật liệu,
  // traverse ở khung kế tiếp tự bắt được tấm mới với base .5 của chính nó.
  function attachOldestMemory(memory) {
    // Gọi lần hai không được treo thêm tấm nữa: hai plane trùng z sẽ z-fight và
    // opacity cộng dồn thành ảnh đậm gấp đôi phần còn lại của landmark.
    if (!memory?.url || !whaleFall || whaleFall.userData.memoryPlane) return;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 4.1),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    );
    plane.position.set(0, 2.6, 0.4);
    plane.rotation.x = -0.18;
    // Dùng chung đường thu nhỏ với relic: TextureLoader thô nạp ảnh gốc nguyên
    // cỡ, một tấm 4032x3024 tốn 65 MB — nhiều hơn cả trần 48 MB của mục 13.7,
    // và tính trên mọi tier kể cả low.
    loadTexture(memory.url, tier.texture).then(texture => {
      if (texture) { plane.material.map = texture; plane.material.needsUpdate = true; }
    });
    // Ảnh này CỐ Ý chỉ để nhìn, không mở được: mục 14.3 nói "không giải thích
    // bằng chữ, cứ để nó ở đó". raycastRelic chỉ quét relics.getRelics() nên
    // plane không nằm trong danh sách — đừng thêm userData.relic/url vào đây.
    whaleFall.add(plane);
    whaleFall.userData.memoryPlane = plane;
  }

  // Silhouette là BÓNG con vật, không phải lỗ thủng. Nó dùng theme.trench cố
  // định (#01080c) — hồi nước cũng gần đen thì không ai nhận ra, nhưng khi nước
  // ở 350 m sáng lên #041e28 thì cái nang 2.8x12 m cách camera 19 m hiện thành
  // một mảng đen mép cứng chiếm nửa khung hình. Giữ nó tối HƠN nước cùng một
  // tỉ lệ như sàn đáy biển thì nó đọc ra là bóng.
  //
  // Không đụng tới opacity: trần ~0.75 * baseOpacity của mục 14.5 vẫn là thứ
  // quyết định "không bao giờ hiện trọn hình".
  function setDepthColor(hex) {
    actors.forEach(actor => {
      if (actor.userData.fauna?.type === 'silhouette') actor.material.color.set(hex);
    });
  }

  return { group, update, reset, attachOldestMemory, setDepthColor };
}
