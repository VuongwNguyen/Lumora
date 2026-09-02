import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
    // .30 là NỀN TỐI, và trong scene unlit thì nó là màu thật chứ không phải
    // bóng đổ — mặt đá quay khỏi mặt nước render ra gần như đen tuyền, nên
    // cụm đá tiền cảnh đọc thành silhouette low-poly cắt dán chứ không phải
    // vật chìm trong nước. Nước biển tán xạ theo mọi hướng, không mặt nào
    // dưới nước tối đến vậy. .52 là mức "tối nhưng vẫn còn màu".
    const lit = Math.max(0, normal.getY(i)) ** 1.4;
    const shade = .42 + lit * .62;
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

// Cao độ đáy biển. -8.5 là con số cũ, và nó chính là lý do scene đọc ra "một
// mặt nước lớn có vật thể" chứ không phải "đáy biển nằm bên dưới": camera ở
// y = 0 với FOV dọc 68 độ, nên đáy chỉ cách 8.5 m là nó chiếm hơn nửa khung
// hình ngay cả khi nhìn thẳng ngang — không còn khoảng nước trống nào ở giữa.
//
// -26 cho một cột nước thật: 26 m nước dưới chân, 46 m lên tới mặt (fx/water.js),
// tổng 72 m và camera nằm ở 36% từ đáy lên. Địa hình biên độ ±5.6 m nên đỉnh
// gờ gần nhất vẫn còn cách camera 20.4 m.
//
// MỌI thứ nằm TRÊN đáy phải nhập hằng số này: đá, rong (dưới đây), hải quỳ,
// xác cá voi và hồ ký ức (scene/fauna.js), mốc kẹp relic (scene/relics.js).
export const FLOOR_Y = -26;

// Mục 4/6.2 gọi "caustic" cho các CỘT SÁNG trong nước (fx/water.js), nhưng thứ
// mắt thật sự nhận ra là nước thì lại là vệt sáng nhảy múa TRÊN ĐÁY — lưới
// sáng do mặt nước gợn hội tụ ánh mặt trời. Scene chưa từng có nó.
//
// Không dùng texture lặp: một tấm caustic tile ở khoảng cách này lộ ngay nhịp
// lặp. Nhưng cũng KHÔNG dùng được hàm caustic kiểu shadertoy quen thuộc (vòng
// lặp `c += 1.0/length(p/(sin(i)/inten))`): hàm đó chia cho chính p nên KHÔNG
// bất biến tịnh tiến — nó chỉ đúng quanh gốc toạ độ. Sàn abyss dài 780 m, phần
// lớn nằm xa gốc, ở đó c phân kỳ và pow() bão hoà về 1 khắp nơi: đo bằng
// screenshot thì cả mặt đáy bị nhấc lên thành một lớp xanh phẳng, không có một
// vệt sáng nào. Đúng thứ cần tránh.
//
// Mọi số hạng dưới đây là sin của một hàm TUYẾN TÍNH theo p, nên hàm bất biến
// tịnh tiến — chỗ nào trên sàn cũng cho vệt như nhau. Tần số 1.7 / 1.9 / 1.3 /
// 1.1 và warp 0.9 / 0.8 cố ý không có ước chung, nên chu kỳ chung dài hơn cả
// quãng lặn: không nhìn ra ô lặp.
//
// `1 - |v|` rồi mũ 6: caustic thật là những ĐƯỜNG hội tụ mảnh và sáng, không
// phải sóng mượt. Mũ cao giữ lại đúng phần đỉnh.
const CAUSTIC_PARS = `
  varying vec3 vAbyssWorld;
  uniform float uCausticTime;
  uniform float uCausticStrength;
  uniform vec3 uCausticColor;

  float causticWeb(vec2 p, float t, float sharpness) {
    vec2 warp = vec2(sin(p.y * 0.9 + t * 0.70), cos(p.x * 0.8 - t * 0.55)) * 0.9;
    vec2 q = p + warp;
    float a = sin(q.x * 1.7 + t * 0.90) + sin(q.y * 1.9 - t * 0.70);
    float b = sin((q.x + q.y) * 1.3 + t * 0.50) + sin((q.x - q.y) * 1.1 - t * 0.63);
    float v = (a + b) * 0.25;
    return pow(clamp(1.0 - abs(v), 0.0, 1.0), sharpness);
  }

  // Một lớp thôi thì ra những SỢI dài liên tục — screenshot đọc thành "mì neon"
  // chứ không phải ánh sáng. Caustic thật là một mạng lưới có nút sáng và đoạn
  // tối xen kẽ, vì mặt nước gợn theo nhiều hướng cùng lúc. Lớp thứ hai lệch tỉ
  // lệ 1.63 (vô tỉ so với lớp một) và chạy chậm hơn, dùng để ĐIỀU BIÊN độ sáng
  // dọc theo sợi của lớp một: sợi bị cắt khúc, chỗ hai lưới trùng nhau thành nút.
  float abyssCaustic(vec2 p, float t) {
    // BẬC RỘNG — cùng hàm, tần số 1/3.4 và mũ 2 thay vì 6. Cho những dải sáng
    // lớn, thoải, chậm.
    //
    // Đây là thứ thiếu ở bản trước và là lý do mặt đáy đọc thành một tấm phẳng
    // tối: mũ 6 làm hàm rất nhọn, hầu hết mặt sàn có giá trị gần 0, chỉ còn
    // những SỢI mảnh. Mà sợi mảnh chỉ đọc được khi chúng ĐANG ĐỘNG — trong một
    // khung hình tĩnh thì mắt không có gì để bám. Dải rộng mới là thứ nói cho
    // người xem biết có một mặt nước đang gợn ở phía trên.
    // 0.29 cho bước sóng ~45 m — dài hơn cả dải sàn nhìn thấy được ở tiền
    // cảnh (~30 m), nên trong khung hình nó gần như một hằng số: đo được
    // sd = 3.6 trên mean 34.5, tức không có biến thiên nào để mắt bám. 0.75
    // cho ~17 m, đủ 2 chu kỳ ngang tầm nhìn gần.
    float broad = causticWeb(p * 0.75, t * 0.55, 2.0);
    // BẬC SỢI — mũ 9 -> 6: sợi dày hơn một chút nên còn đọc được ở tiền cảnh,
    // vẫn là đường chứ chưa thành mảng.
    float web = causticWeb(p, t, 6.0);
    float modulation = causticWeb(p * 1.63 + vec2(17.3, 8.1), t * 0.83, 6.0);
    // Hệ số đo bằng screenshot, không đoán: causticWeb với mũ 2 cho giá trị
    // TRUNG BÌNH ~0.28, nên hệ số 0.40 chỉ nâng nền được 4% — dưới ngưỡng mắt
    // thấy. 1.0 đưa dải rộng lên ~18% sáng hơn nền, đọc được mà không chói.
    // Bậc sợi hạ 0.72 -> 0.55 để dải rộng dẫn dắt, sợi chỉ điểm xuyết.
    return broad * 1.00 + web * (0.30 + 1.15 * modulation) * 0.55;
  }
`;

// TRƯỚC fog_fragment, không phải sau: vệt sáng nằm trên mặt đáy nên nó cũng
// phải bị nước hấp thụ trên đường về mắt. Cộng sau fog thì đáy ở 80 m vẫn sáng
// rực như đáy ngay dưới chân — đúng kiểu overlay dán đè.
const CAUSTIC_APPLY = `
  if (uCausticStrength > 0.001) {
    float cau = abyssCaustic(vAbyssWorld.xz * 0.28, uCausticTime);
    // Mảng đậm nhạt tần số RẤT thấp (bước sóng ~70 m): trường caustic thật
    // không phủ đều — có vạt dày, có vạt gần như trống, vì mặt nước bên trên
    // cũng không gợn đều. Thiếu số hạng này thì mật độ vệt là hằng số trên
    // toàn sàn và mắt đọc ra ngay là một texture trải phẳng.
    vec2 pp = vAbyssWorld.xz;
    float density = 0.42 + 0.58 * (0.5 + 0.5 * sin(pp.x * 0.09 + uCausticTime * 0.21)
                                            * cos(pp.y * 0.07 - uCausticTime * 0.17));
    // NHÂN, không CỘNG. Cộng thẳng là mô hình vật tự phát sáng: chỗ đáy tối
    // nhất cũng bị kéo lên đúng uCausticColor, ra những sợi cyan neon nổi bật
    // hơn cả ảnh kỷ vật. Caustic là ÁNH SÁNG TỚI NHIỀU HƠN trên mặt đáy, nên
    // nhân mới đúng: vệt sáng luôn mang màu của chính mặt đất nó rọi lên, chỗ
    // đáy tối vẫn tối, và độ sáng bị chặn trên bởi một hệ số cố định.
    // clamp bắt buộc: mix() với hệ số > 1 là NGOẠI SUY, đỉnh vệt sẽ vọt quá
    // uCausticColor và quay lại đúng vẻ neon vừa bỏ đi.
    float gain = clamp(cau * density * uCausticStrength, 0.0, 1.0);
    // Hệ số 2.8, không phải 1.75. Đo bằng cách tạm ép uCausticColor thành đỏ
    // thuần: pattern hiện rõ khắp tiền cảnh và sd nhảy 3.6 -> 8.26, tức shader
    // và hình dạng vệt vốn đã đúng — thứ thiếu chỉ là BIÊN ĐỘ. uCausticColor
    // * 1.75 = (0.87, 1.56, 1.47), quá gần (1,1,1) nên chỗ sáng nhất cũng chỉ
    // hơn nền 1.5 lần, sau khi qua sương còn ~10%: dưới ngưỡng đọc được.
    //
    // Nâng hệ số ở đây KHÔNG kéo lại vẻ neon, vì đây là phép NHÂN: đỉnh vệt bị
    // chặn trên bởi chính màu mặt đất nó rọi lên, và nền đen thì nhân bao nhiêu
    // vẫn đen. Ở 2.8, vệt sáng nhất xấp xỉ độ sáng của nước xung quanh — đúng
    // mức caustic thật, và vẫn cùng hệ màu chứ không phải một màu tự phát.
    gl_FragColor.rgb *= mix(vec3(1.0), uCausticColor * 2.8, gain);
  }
`;


// ---------------------------------------------------------------------------
// TRƯỜNG ĐỘ CAO ĐÁY BIỂN — nguồn sự thật duy nhất.
//
// Bản trước: một gợn nhỏ `sin(x*.18)*.18 + sin(y*.1)*.24` cộng 18 cái gò cos².
// Tức chỉ có ĐÚNG HAI bậc tần số, và bậc nhỏ thì quá nhỏ để thấy — nên đáy đọc
// ra là một mặt phẳng có vài cục u. Địa hình thật có phổ liên tục: sườn lớn,
// gờ vừa, gợn nhỏ, rồi vân cát.
//
// Bốn bậc dưới đây có tần số không chia hết cho nhau và đi qua một bước warp
// miền, nên không bậc nào xếp thành lưới và chu kỳ chung dài hơn cả quãng lặn.
//
// QUAN TRỌNG: đá và rong PHẢI lấy độ cao từ chính hàm này. Bản trước đặt đá ở
// y = -8.2 cố định, đúng khi sàn phẳng; với địa hình thật thì chúng sẽ lơ lửng
// trên gờ hoặc chìm trong hõm.
// ---------------------------------------------------------------------------

// Hành lang lặn: camera đi dọc x ~ 0 nên bậc LỚN phải nén lại ở giữa, nếu
// không địa hình dựng thành tường chắn ngang đường bơi. Nén ở giữa và thả ra
// hai bên cho ra một thung lũng — người xem bơi trong lòng nó, và chính hai
// sườn dâng lên mới là thứ tạo cảm giác không gian ba chiều.
function corridorGain(x) {
  const t = Math.min(1, Math.abs(x) / 32);
  return 0.16 + 0.84 * t * t;
}

export function terrainHeight(x, z) {
  // Warp miền: bẻ cong toạ độ trước khi lấy mẫu nên các bậc không chồng nhau
  // thành ô vuông đều.
  const wx = x + Math.sin(z * 0.0131) * 15;
  const wz = z + Math.cos(x * 0.0107) * 13;

  // Bậc LỚN ~ 130 m: sườn thoải, lòng chảo, thềm.
  let h = (Math.sin(wx * 0.0165) * Math.cos(wz * 0.0121) * 3.6
         + Math.sin((wx + wz) * 0.0093 + 1.4) * 2.2) * corridorGain(x);

  // Bậc VỪA ~ 34 m: gờ và hõm. Không nén theo hành lang — hành lang vẫn phải
  // có địa hình, chỉ là không có tường.
  h += Math.sin(wx * 0.061 + 1.7) * Math.cos(wz * 0.048 - 0.6) * 1.15;
  h += Math.sin((wx - wz) * 0.0517 + 0.3) * 0.78;

  // Bậc NHỎ ~ 9 m: gợn mặt đất.
  h += Math.sin(wx * 0.213 + 2.3) * Math.sin(wz * 0.187 - 1.1) * 0.30;

  // Bậc VÂN CÁT ~ 2.5 m: chi tiết chỉ đọc được ở tiền cảnh.
  h += Math.sin(wx * 0.62 + 0.7) * Math.sin(wz * 0.71) * 0.11;

  return h;
}

// Độ dốc bằng sai phân hữu hạn. Dùng cho hai việc: tô đá vào sườn dốc / cát vào
// chỗ thoải, và chặn rong mọc trên vách.
export function terrainSlope(x, z) {
  const d = 1.5;
  const dx = (terrainHeight(x + d, z) - terrainHeight(x - d, z)) / (2 * d);
  const dz = (terrainHeight(x, z + d) - terrainHeight(x, z - d)) / (2 * d);
  return Math.hypot(dx, dz);
}

// Hai trường mật độ LỆCH PHA nhau: đá tụ chỗ này thì rong mọc chỗ khác, và cả
// hai đều chừa ra những vạt trống. Rải đều ngẫu nhiên trên toàn scene là thứ
// làm environment đọc ra "object rắc lung tung" thay vì một hệ sinh thái.
function rockField(x, z) {
  return 0.5 + 0.5 * Math.sin(x * 0.0321 + 1.1) * Math.cos(z * 0.0208 - 0.4);
}
function kelpField(x, z) {
  return 0.5 + 0.5 * Math.sin(x * 0.0192 - 2.6) * Math.cos(z * 0.0263 + 1.3);
}

export function createSeabed(theme, tier, plan) {
  const dive = Number.isFinite(plan?.diveDistance) && plan.diveDistance > 0 ? plan.diveDistance : DEFAULT_DIVE;
  const floorEnd = dive + FLOOR_MARGIN;
  const scale = floorEnd / REFERENCE_FLOOR;
  const floorLength = floorEnd + FLOOR_START;
  const group = new THREE.Group();
  // Rộng 90 nghĩa là mép hai bên chỉ cách trục 45; với FOV ngang ~103 độ camera
  // thấy tới +-1.26*d nên từ 36 m trở đi MÉP SÀN lọt vào khung hình thành một
  // đường cong rõ. 240 đẩy mép ra 95 m, xa hơn D90 của fog ở mọi dải độ sâu.
  // Rặng đáy biển giờ là MỘT PHẦN CỦA SÀN, không phải mesh riêng đặt lên trên.
  //
  // Bản trước dựng gò thành mesh riêng ở đúng y = -8.5 của sàn: hai mặt bán
  // trong suốt ĐỒNG PHẲNG (gò .92, sàn .96) nên vùng chồng nhau bị blend hai
  // lần và hiện ra thành một bậc màu chạy thẳng suốt chiều ngang khung hình —
  // raycast hai bên đường đó cho thấy đúng ranh giới footprint của gò. Không
  // chỉnh alpha nào chữa được: chừng nào còn hai lớp thì còn bậc.
  //
  // Nhấc gò vào chính đỉnh của sàn thì chỉ còn một mặt: không chồng lớp, không
  // z-fight, không đường biên, và bớt luôn một draw call.
  // Lưới 5 m theo cả hai trục: bậc vân cát (~2.5 m) nằm dưới Nyquist nên nó
  // chỉ đóng góp nhiễu nhẹ chứ không hiện thành gợn — cố ý, vì tăng mật độ
  // lưới lên gấp đôi để lấy nó là +40k tam giác cho chi tiết chỉ thấy ở 3 m.
  const floorGeometry = new THREE.PlaneGeometry(240, floorLength, 48, Math.max(24, Math.round(floorLength / 5)));
  const floorPosition = floorGeometry.attributes.position;
  // Sau rotation.x = -PI/2 thì local z -> world y và local y -> -world z.
  const floorOffsetZ = FLOOR_START - floorLength / 2;
  const floorColors = new Float32Array(floorPosition.count * 3);
  for (let i = 0; i < floorPosition.count; i++) {
    const x = floorPosition.getX(i); const y = floorPosition.getY(i);
    const worldZ = floorOffsetZ - y;
    const height = terrainHeight(x, worldZ);
    floorPosition.setZ(i, height);

    // Scene unlit (mục 13.5) nên MỌI thông tin vật liệu phải nướng vào vertex
    // color. Ba số hạng, mỗi số hạng một ý nghĩa vật lý:
    //
    //   lift  — chỗ cao hứng nhiều sáng từ mặt nước hơn chỗ trũng;
    //   rocky — sườn DỐC là đá lộ, chỗ THOẢI là cát bồi. Đây là thứ tạo ra
    //           "sand patches" mà không cần thêm một mesh hay texture nào;
    //   blue  — đá lệch về lam, cát giữ nguyên hệ màu của nền.
    const slope = terrainSlope(x, worldZ);
    const lift = Math.min(1, Math.max(0, (height + 2.4) / 6.4));
    const rocky = Math.min(1, slope * 2.4);
    const shade = (0.86 + lift * 0.42) * (1 - rocky * 0.26);
    const blue = rocky * 0.20;
    floorColors[i * 3] = shade * (1 - blue);
    floorColors[i * 3 + 1] = shade * (1 - blue * 0.45);
    floorColors[i * 3 + 2] = shade;
  }
  floorGeometry.setAttribute('color', new THREE.BufferAttribute(floorColors, 3));
  // MeshBasicMaterial không dùng normal; giữ lại chỉ tốn 270 KB bộ nhớ đỉnh.
  floorGeometry.deleteAttribute('normal');
  const floor = new THREE.Mesh(floorGeometry, new THREE.MeshBasicMaterial({ color: theme.trench, vertexColors: true, transparent: true, opacity: .96, side: THREE.DoubleSide }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, FLOOR_Y, FLOOR_START - floorLength / 2); group.add(floor);

  // Đục, không transparent: nhìn xuyên qua đá là thứ tạo ra cảm giác nét vẽ.
  // Màu là basalt TỐI, không phải coldTeal thuần: mục 4.2 gọi đây là đá basalt,
  // và ở coldTeal đục nó thành vật sáng nhất khung hình, sáng hơn cả ảnh.
  // Đặt hex tường minh, KHÔNG lerp từ theme: ColorManagement bật mặc định từ
  // three r152 nên THREE.Color giữ giá trị ở linear space, và lerp trong linear
  // rồi xuất ra sRGB cho kết quả sáng hơn nhiều so với tính nhẩm trong sRGB —
  // lerp .35 trench->coldTeal ra #196260 chứ không phải #113c3e.
  const rockColor = new THREE.Color('#123f44');
  const rockMaterial = new THREE.MeshBasicMaterial({ color: rockColor, vertexColors: true });
  const rockGeometry = makeRockGeometry(1);
  // Không kẹp theo tier.rocks: giữ mật độ mới là yêu cầu, và đá là MỘT
  // InstancedMesh nên thêm 20% instance ở quãng 620 m chỉ là thêm đỉnh, không
  // thêm draw call.
  const rockCount = Math.max(6, Math.round(tier.rocks * scale));
  const rockSpan = 570 * scale;
  const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, rockCount);
  const matrix = new THREE.Matrix4();
  const rockPos = new THREE.Vector3();
  const rockQuat = new THREE.Quaternion();
  const rockScale = new THREE.Vector3();
  // Lấy mẫu có TỪ CHỐI theo rockField + độ dốc, thay vì rải đều.
  //
  // Bản trước: x = side * (7 + rand*28), z = -14 - rand*span. Phân bố đều nên
  // mật độ đá là hằng số trên toàn scene — không có bãi đá, không có vạt trống,
  // và mắt đọc ra là "vật thể rắc lung tung" chứ không phải một hệ sinh thái.
  //
  // Trần 40 lần thử mỗi viên: ngân sách cố định, không bao giờ treo, và nếu
  // trường mật độ có đổi thì tệ nhất là vài viên rơi vào chỗ thưa.
  for (let i = 0; i < rockCount; i++) {
    let x = 0; let z = 0;
    for (let attempt = 0; attempt < 40; attempt++) {
      x = (Math.random() - .5) * 84;
      z = -14 - Math.random() * rockSpan;
      // Đá lộ ra ở SƯỜN DỐC — chỗ thoải thì cát đã phủ lên. Nhân hai trường
      // nên đá vừa tụ thành bãi vừa bám vào địa hình có lý.
      const chance = rockField(x, z) ** 2 * (0.35 + 0.65 * Math.min(1, terrainSlope(x, z) * 3));
      if (Math.random() < chance) break;
    }
    // Bốn phần năm là đá nhỏ, một phần năm là tảng lớn: "small rocks tần số
    // cao, large rocks tần số thấp". Phân bố phẳng cho quá nhiều tảng to và
    // đáy biển trông như bãi phế liệu.
    const big = i % 5 === 0;
    const size = big ? .95 + Math.random() * 1.35 : .26 + Math.random() * .48;
    // Chìm một phần vào đất: đá nằm TRONG trầm tích, không đặt lên trên.
    rockPos.set(x, FLOOR_Y + terrainHeight(x, z) - size * .34, z);
    rockQuat.setFromEuler(new THREE.Euler(Math.random(), Math.random(), Math.random()));
    rockScale.set(size * (1 + Math.random()), size * .62, size);
    matrix.compose(rockPos, rockQuat, rockScale);
    rocks.setMatrixAt(i, matrix);
  }
  rocks.instanceMatrix.needsUpdate = true; group.add(rocks);


  // Rong biển cũ: mỗi cây là một CylinderGeometry THẲNG, và update() xoay cả
  // mesh quanh TÂM nó. Hai hệ quả nhìn thấy trong screenshot:
  //   • cây rong đọc ra là cái cột/que, không phải lá — rong thật là dải bản
  //     dẹt, thon dần và cong;
  //   • xoay quanh tâm nghĩa là GỐC RONG NHẤC KHỎI ĐÁY rồi lắc như que cắm
  //     lỏng, trong khi rong thật bám chặt đáy và cong dần lên ngọn.
  // Thêm nữa mỗi cây là một draw call — tới 18 cái.
  //
  // Bản mới: dải bản dẹt, gộp hết vào MỘT geometry, và uốn trong vertex shader
  // theo `aRise` (độ cao chuẩn hoá dọc lá). pow(aRise, 1.6) ghim gốc về 0 và
  // cho biên độ lớn dần lên ngọn — đúng cách một vật bám đáy đung đưa. CPU
  // không làm gì mỗi khung, và cả rừng rong còn đúng 1 draw call.
  const kelpMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#1d5c52'), transparent: true, opacity: .46, side: THREE.DoubleSide,
  });
  const clumpCount = Math.max(2, Math.round(Math.min(18, tier.rocks / 5) * scale));
  const kelpUniforms = { uKelpTime: { value: 0 } };
  const blades = [];

  // Một lá đơn độc, dù đã uốn, vẫn không đọc ra là rong: 22 lá rải trên 470 m
  // thì mỗi cái là một nét mảnh lạc lõng. Rong thật mọc THÀNH BỤI từ một gốc
  // bám. Mỗi gốc dưới đây đẻ 5 lá lệch nhau chiều cao, pha và hướng nghiêng —
  // vẫn gộp chung vào một geometry nên không thêm draw call nào.
  const BLADES_PER_CLUMP = 5;

  // Lá là mặt phẳng dẹt: quay ngẫu nhiên quanh Y thì gần một nửa số lá rơi vào
  // thế nhìn nghiêng và biến mất hẳn. Dựng chữ thập — hai bản vuông góc nhau —
  // nên hướng nào cũng còn tiết diện. Đây là cách billboard cây cối cổ điển,
  // và ở đây nó chỉ thêm vài chục đỉnh.
  function bladeCross(height, width, phase, sway, lean, yaw, x, z) {
    for (const extraYaw of [0, Math.PI / 2]) {
      // 10 đoạn dọc: dưới 6 thì đường cong gãy khúc, trên 12 không thấy khác.
      const blade = new THREE.PlaneGeometry(width, height, 1, 10);
      blade.translate(0, height / 2, 0);
      const position = blade.attributes.position;
      const count = position.count;
      const rise = new Float32Array(count);
      const phaseAttr = new Float32Array(count);
      const swayAttr = new Float32Array(count);
      for (let v = 0; v < count; v++) {
        const t = Math.min(1, Math.max(0, position.getY(v) / height));
        rise[v] = t;
        phaseAttr[v] = phase;
        swayAttr[v] = sway;
        // Thon dần về ngọn — bản dẹt đều từ gốc tới ngọn đọc ra là dải băng.
        position.setX(v, position.getX(v) * (1 - .55 * t));
        // Nghiêng TĨNH nướng sẵn: rong không mọc thẳng đứng, và cong sẵn thì
        // lúc đứng yên nó vẫn không phải một cái que.
        position.setZ(v, position.getZ(v) + lean * t * t);
      }
      blade.setAttribute('aRise', new THREE.BufferAttribute(rise, 1));
      blade.setAttribute('aPhase', new THREE.BufferAttribute(phaseAttr, 1));
      blade.setAttribute('aSway', new THREE.BufferAttribute(swayAttr, 1));
      blade.rotateY(yaw + extraYaw);
      blade.translate(x, FLOOR_Y + terrainHeight(x, z) - 0.15, z);
      blades.push(blade);
    }
  }

  for (let i = 0; i < clumpCount; i++) {
    // Rong mọc ở chỗ THOẢI và TRŨNG — vách dốc thì không bám được, và
    // kelpField lệch pha với rockField nên đồng rong không chồng lên bãi đá.
    let rootX = 0; let rootZ = 0;
    for (let attempt = 0; attempt < 40; attempt++) {
      rootX = (Math.random() - .5) * 76;
      rootZ = -18 - Math.random() * (470 * scale);
      const flat = 1 - Math.min(1, terrainSlope(rootX, rootZ) * 2.6);
      if (Math.random() < kelpField(rootX, rootZ) ** 2 * (0.25 + 0.75 * flat)) break;
    }
    for (let b = 0; b < BLADES_PER_CLUMP; b++) {
      const spread = 1.1;
      bladeCross(
        4 + Math.random() * 10,
        .14 + Math.random() * .16,
        Math.random() * Math.PI * 2,
        .35 + Math.random() * .5,
        (Math.random() - .5) * 1.6,
        Math.random() * Math.PI,
        rootX + (Math.random() - .5) * spread,
        rootZ + (Math.random() - .5) * spread,
      );
    }
  }
  const kelpGeometry = mergeGeometries(blades, false);
  blades.forEach(blade => blade.dispose());
  kelpMaterial.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, kelpUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aRise;
        attribute float aPhase;
        attribute float aSway;
        uniform float uKelpTime;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        // Hai tần số lệch nhau trên hai trục -> ngọn vẽ hình số 8 chứ không
        // lắc qua lại trên một mặt phẳng như cần gạt nước.
        float kelpAnchor = pow(aRise, 1.6);
        transformed.x += sin(uKelpTime * 0.55 + aPhase + aRise * 1.8) * aSway * kelpAnchor;
        transformed.z += cos(uKelpTime * 0.31 + aPhase * 1.7) * aSway * 0.45 * aRise * aRise;`);
  };
  // three băm cache program theo mã shader gốc; thiếu khoá riêng thì rong dùng
  // lại program của một MeshBasicMaterial khác và đứng đơ.
  kelpMaterial.customProgramCacheKey = () => 'abyss-kelp-sway';
  const kelpMesh = new THREE.Mesh(kelpGeometry, kelpMaterial);
  // Rong uốn trong vertex shader nên bounding sphere tính từ vị trí gốc là
  // thiếu; rừng rong trải 470 m nên cull nhầm là mất trắng một mảng cảnh.
  kelpMesh.frustumCulled = false;
  group.add(kelpMesh);

  // tier low có caustics: 0 — máy đã đuối thì không thêm 3 vòng lặp lượng giác
  // trên mỗi fragment của một mặt sàn chiếm nửa khung hình.
  let causticUniforms = null;
  if (tier.caustics > 0) {
    causticUniforms = {
      uCausticTime: { value: 0 },
      uCausticStrength: { value: 0 },
      uCausticColor: { value: new THREE.Color('#7fe4d6') },
    };
    floor.material.onBeforeCompile = shader => {
      Object.assign(shader.uniforms, causticUniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vAbyssWorld;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vAbyssWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + CAUSTIC_PARS)
        .replace('#include <fog_fragment>', CAUSTIC_APPLY + '\n#include <fog_fragment>');
    };
    // three băm cache program theo mã shader gốc; không có khoá riêng thì sàn
    // dùng lại program của một MeshBasicMaterial khác và caustic biến mất.
    floor.material.customProgramCacheKey = () => 'abyss-seabed-caustic';
  }

  function update(elapsed) {
    kelpUniforms.uKelpTime.value = elapsed;
    // Chậm hơn hẳn thời gian scene: vệt caustic thật trôi cỡ centimet/giây, và
    // 0.18 là mức mắt còn thấy nó ĐANG động mà không thành nhấp nháy.
    if (causticUniforms) causticUniforms.uCausticTime.value = elapsed * 0.18;
  }

  // Sàn và rặng bám theo màu nước hiện tại (core/palette.js seabedColorForDepth).
  // Đá và rong CỐ Ý đứng yên ở hex riêng: chúng là vật thể nằm TRÊN đáy, tối hơn
  // nền là đúng — chỉ mặt đất mới phải hoà theo nước.
  function setDepthColor(hex) {
    floor.material.color.set(hex);
  }

  // Ánh mặt trời không xuống tới đáy vực: caustic đầy ở 40 m, tắt hẳn ở 260 m.
  // Bình phương để nó nhạt nhanh ở đoạn đầu rồi tan dần, thay vì tuyến tính.
  function setCausticStrength(depth) {
    if (!causticUniforms) return;
    const t = Math.min(1, Math.max(0, (depth - 40) / 220));
    causticUniforms.uCausticStrength.value = (1 - t) * (1 - t) * 1.60;
  }

  return { group, update, setDepthColor, setCausticStrength };
}
