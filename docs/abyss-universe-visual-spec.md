# Abyss of Memories — Visual & Interaction Specification

**Trạng thái:** Concept approved for internal admin preview  
**Template:** `abyss`  
**Mục tiêu:** biến Abyss thành một universe đáy biển sâu thực sự, không phải Galaxy Classic đổi màu.

## 1. Tầm nhìn trải nghiệm

Người xem không bay trong vũ trụ. Người xem đang lặn xuống một rãnh biển sâu, nơi ký ức phát sáng giữa một hệ sinh thái im lặng.

Cảm xúc cần dẫn dắt:

```text
Tò mò → cô độc → phát hiện → thân mật → giải phóng
```

Không gian phải có khoảng tối, khoảng thở và một nguồn sáng dẫn đường. Bóng tối là một phần của trải nghiệm chứ không phải vùng thiếu nội dung.

## 2. Reference và nguyên tắc thị giác

Reference nên lấy cảm hứng từ rãnh biển sâu, vách đá, sinh vật phát quang, tia sáng xuyên nước và vùng sáng cục bộ:

- [DNEG — Bioluminescent Underwater Environment](https://www.dneg.com/art)
- [CG Channel — Undersea Bioluminescent Canyon](https://www.cgchannel.com/2015/09/step-by-step-create-an-underwater-digital-matte-painting/)
- [VFX Voice — Deep-Sea Trench Concept](https://vfxvoice.com/entrenched-in-the-deep-dark-depths-with-the-meg/)
- [NOAA — What is bioluminescence?](https://oceanexplorer.noaa.gov/ocean-fact/bioluminescence/)
- [Smithsonian Ocean — Bioluminescence](https://ocean.si.edu/ocean-life/fish/bioluminescence)

Các reference chỉ định hướng art direction. Không sao chép trực tiếp artwork có bản quyền; asset mới phải là procedural geometry, asset được cấp phép hoặc artwork nội bộ.

Deep-sea visual nên giữ màu xanh-lục và contrast thấp: ánh sáng dưới nước bị tán xạ/hấp thụ theo khoảng cách, tạo blue cast và làm giảm độ tương phản. Tham khảo [GeoMar — Simulating Deep Sea Underwater Images](https://www.geomar.de/fileadmin/personal/fb2/mg/ajordt/vmvPaper.pdf) và [DeepSea — Underwater Lighting](https://www.deepsea.com/understanding-underwater-lighting/).

## 3. Palette

```text
Deep water:       #02151B
Trench shadow:    #01080C
Cold teal:        #2E9E9B
Bioluminescent:   #78E6D0
Memory glow:      #B8FFF0
Rare violet:      #7566A8
Warm memory:      #D98F75
```

Theme của người dùng chỉ ảnh hưởng 10–15% vào accent. Theme không được nhuộm toàn bộ nước, fog hoặc ảnh.

## 4. Scene composition

### 4.1 Background và water volume

- Không dùng starfield.
- Dùng water fog xanh đen theo khoảng cách.
- Thêm silhouette vách đá ở xa.
- Tạo vùng surface light rất mờ phía trên.
- Phía dưới camera phải tối hơn phía trên.
- Particle gần camera lớn hơn particle ở xa.

### 4.2 Seafloor

Đáy biển chiếm khoảng một phần ba khung hình phía dưới:

- Nền cát tối, không phẳng hoàn toàn.
- Rãnh trung tâm dẫn tới beacon.
- Đá basalt lớn hai bên khung hình.
- Cụm đá nhỏ có glow rất nhẹ.
- Rong biển thấp chuyển động theo dòng nước.

Model groups:

```text
BasaltRock_A
BasaltPillar_B
TrenchRidge
SedimentPatch
KelpCluster
```

### 4.3 Memory Beacon

Không dùng quả cầu trắng hoặc vòng torus kiểu hành tinh. Beacon là một memory coral/hydrothermal vent:

```text
MemoryBeacon
├── dark basalt base
├── translucent coral branches
├── inner cyan crystal
├── floating memory motes
└── soft point light
```

Hành vi:

- Core phát sáng cyan dịu.
- Sợi ánh sáng chạy dọc nhánh coral.
- Aura mềm, không bloom trắng.
- Khi ảnh được mở, beacon pulse một nhịp rồi hạ về baseline.

### 4.4 Memory relics

Ảnh không dựng thành các tấm phẳng đứng cạnh nhau. Mỗi ảnh là một relic:

- Khung kính mờ, vỏ sò hoặc mảnh vật liệu biển.
- Nghiêng nhẹ và trôi theo dòng nước.
- Ảnh gần camera lớn, rõ và có độ tương phản cao hơn.
- Ảnh xa nhỏ dần và bị fog nuốt bớt.
- Hover/click kéo relic nhẹ về phía người xem trước khi mở chi tiết.

Phân bố:

```text
Near field:    2–3 ảnh lớn, rõ
Mid field:     6–8 ảnh quanh rãnh
Far field:     ảnh nhỏ, silhouette để tạo chiều sâu
```

## 5. Sinh vật và model xuất hiện

Chỉ dùng một số model có vai trò cảm xúc, tránh biến cảnh thành aquarium:

### `JellyfishDrifter`

- 1–2 con ở xa.
- Trôi ngang rất chậm.
- Glow tím/xanh nhẹ.

### `LanternFishSchool`

- Nhóm cá nhỏ chạy ngang trong cao trào.
- Chỉ xuất hiện khi beacon được kích hoạt.

### `BioluminescentAnemone`

- Cụm tua phát sáng ở đáy biển.
- Tua sway bằng shader hoặc sin wave.

### `MemoryShrimp`

- Sinh vật nhỏ gần beacon.
- Khi người xem đến gần, phát sáng rồi chạy vào khe đá.

### `DeepSilhouette`

- Bóng sinh vật lớn ở xa.
- Không render rõ hình dạng; chỉ gợi ý đại dương còn sự sống.

Ưu tiên low-poly geometry, billboard sprite và instancing. Không tải model 3D nặng cho các sinh vật ở xa.

## 6. Hiệu ứng

### 6.1 Water fog và attenuation

```text
0–30m:    còn ánh sáng mặt nước
30–80m:   xanh lạnh, ít chi tiết
80–150m:  chủ yếu còn beacon và sinh vật
150m+:    tối, chỉ thấy memory glow
```

### 6.2 Caustic light

- Tia sáng hẹp từ phía trên.
- Chuyển động bằng noise texture, không dùng cone tĩnh.
- Chỉ chạm một phần vách đá và beacon.
- Opacity thấp; không biến thành spotlight sân khấu.

### 6.3 Bioluminescence pulse

```text
base glow:     0.15
pulse peak:    0.42
duration:      1.8–2.6s
stagger:       random 0.3–1.2s
```

Sinh vật không được phát sáng đồng loạt.

### 6.4 Bubble field

- Bong bóng lớn gần camera.
- Hạt nhỏ ở giữa cảnh.
- Một số bong bóng lệch dòng.
- Bubble đi **lên**; không để bubble lơ lửng tại chỗ như starfield.
- Bubble không thay thế marine snow (mục 14.1) — hai lớp khác nhau, ngược chiều nhau.

## 7. Camera language

Không auto-rotate kiểu Galaxy Classic.

- Camera lặn chậm về phía trước.
- Sway trái/phải rất nhẹ.
- Drag để nhìn tự do.
- Nhìn xuống thấy đáy biển và relic gần.
- Nhìn lên thấy caustic rays và mặt nước xa.
- Quay lưng vẫn giữ camera upright, không lộn khung hình.

```text
forward drift: 0.006–0.012
vertical sway: 0.12–0.22
look damping: 0.10–0.14
photo drift: 0.002–0.006
```

## 8. Emotional timeline

### Phase 1 — Descent

Chỉ có nước tối, particles và soundscape trầm.

### Phase 2 — First Glow

Một cụm anemone bật sáng, cho người xem biết có sự sống.

### Phase 3 — Memory Trench

Relic bắt đầu xuất hiện hai bên rãnh. Chưa hiển thị quá nhiều ảnh.

### Phase 4 — Beacon Reveal

Memory coral xuất hiện rõ, lớn và có ánh sáng dẫn đường.

### Phase 5 — Living Ocean

Jellyfish hoặc fish school đi qua; các relic phản sáng nhẹ.

### Phase 6 — Release

Beacon tắt dần, chỉ còn một relic cuối gần camera và khoảng tối.

## 9. Interaction states

```text
Idle       → water drift + low bioluminescence
Hover      → relic moves 0.25–0.4 units toward viewer
Focus      → background dims 12%, relic glow rises
Open       → image/caption detail appears
Close      → glow releases back into water
Beacon hit → coral pulse + nearby fauna reaction
```

Interaction phải giữ nhịp chậm; không dùng bounce, flash hoặc modal bật đột ngột.

## 10. Performance budget

```text
Visible photo relics:       12–16
Instanced rock objects:      ≤ 120
Near particles:              ≤ 1,500
Far particles:               ≤ 3,000
Animated fauna:              ≤ 8 entities
Dynamic lights:              ≤ 4
Texture target:              1024px max per photo
Reduced motion:              disable fauna drift and strong pulses
```

## 11. Những điều không được lặp lại

- Không starfield.
- Không orbit rings thống trị bố cục.
- Không quả cầu trung tâm màu trắng.
- Không ảnh dựng thành hàng phẳng.
- Không theme màu trực tiếp lên toàn scene.
- Không làm scene sáng đều từ mọi phía.
- Không cho tất cả sinh vật pulse cùng lúc.
- Không dùng model nặng khi billboard/procedural geometry đủ tốt.

## 12. Definition of Done cho visual pass

- Nhìn screenshot tĩnh vẫn nhận ra ngay đây là đáy biển sâu.
- Có foreground, midground và background rõ ràng.
- Beacon là memory coral/vent, không còn là planet.
- Ít nhất một model sinh vật xuất hiện có chủ đích.
- Ảnh relic có hierarchy gần/giữa/xa.
- Caustic, fog và particle cùng hỗ trợ chiều sâu thay vì cạnh tranh nhau.
- Theme hồng/tím không thể biến toàn cảnh thành không gian vũ trụ.
- Preview admin và public `/view/` dùng cùng scene graph.

---

## 13. Implementation contract

Mục 1–12 mô tả *cảnh phải trông như thế nào*. Mục 13 chốt *cách dựng nó* để hai người implement độc lập vẫn ra cùng kết quả. Khi mục 13 mâu thuẫn với mục 1–12, mục 13 thắng và phải ghi rõ lý do tại chỗ.

### 13.1 Đơn vị và hệ quy chiếu

```text
1 world unit        = 1 mét
Trục lặn            = -Z (camera tiến về -Z)
Mặt nước danh nghĩa = y = +40
Đáy rãnh            = y = -10
Độ sâu bắt đầu D0   = 40 m
depth(t)            = D0 + (z0 - camera.position.z)
```

Depth hiển thị trên HUD **phải** dẫn xuất từ vị trí camera, không từ `elapsed`. Code hiện tại (`abyss.js:211`) đang tính depth theo thời gian trong khi camera đứng yên — đó là số giả, phải bỏ.

### 13.2 Fog: từ bảng attenuation ra số thật

`FogExp2` có công thức `factor = 1 - exp(-(density × d)²)`. Định nghĩa `D90` = khoảng cách mà vật thể bị nuốt 90%:

```text
density = 1.5174 / D90
```

Bảng attenuation ở mục 6.1 quy đổi thành:

| Dải độ sâu | Cảm giác | D90 | `fog.density` |
|---|---|---|---|
| 40–120 m | còn ánh sáng mặt nước | 140 m | 0.0108 |
| 120–210 m | xanh lạnh, ít chi tiết | 100 m | 0.0152 |
| 210–430 m | chủ yếu còn beacon và sinh vật | 70 m | 0.0217 |
| 430 m+ | tối, chỉ còn memory glow | 50 m | 0.0304 |

Density lerp mượt theo depth, không nhảy bậc. Thời gian chuyển: 6 s.
`fog.color === scene.background` luôn luôn, nếu không sẽ thấy đường chân trời giả.

### 13.3 Time base — mọi chuyển động theo giây

```js
const dt = Math.min((now - last) / 1000, 1 / 30); // clamp chống tab-switch
```

Các số ở mục 7 là **per-frame @60fps**; contract chuyển hết sang per-second:

```text
forward drift:   1.8 m/s          (reduced motion: 0)
vertical sway:   biên độ 0.18 m, chu kỳ 14 s
lateral sway:    biên độ 0.30 m, chu kỳ 21 s   (lệch pha, không cộng hưởng)
photo drift:     0.004 rad/s
look damping:    k = 0.12
```

Damping phải độc lập frame rate:

```js
const a = 1 - Math.pow(1 - k, dt * 60);
camera.rotation.x += (target - camera.rotation.x) * a;
```

Code hiện tại nhân trực tiếp `* .12` mỗi frame (`abyss.js:200-204`) → trên màn 120 Hz camera phản ứng nhanh gấp đôi. Phải sửa.

### 13.4 Phase state machine — trigger theo độ sâu, không theo thời gian

```text
P1 Descent        40 – 120 m
P2 First Glow    120 – 210 m
P3 Memory Trench 210 – 330 m
P4 Beacon Reveal 330 – 430 m
P5 Living Ocean  430 – 540 m
P6 Release       540 m+
```

Quy tắc:

- **Đơn hướng.** Phase không lùi. Drag chỉ xoay hướng nhìn, không đổi độ sâu — nên không có đường nào để user "bơi ngược".
- **Cross-fade 8 m** ở mỗi biên; không bật/tắt đột ngột.
- **Tạm dừng khi đọc.** Mở relic → `forward drift` ease về 0 trong 0.6 s; đóng → ease lại trong 1.2 s. Không để thế giới trôi qua trong lúc user đang đọc caption.
- **Kết thúc.** Vào P6: drift ease về 0 trong 8 s, beacon tắt dần, giữ lại một relic gần camera. Scene **không loop**. Hiện nút `Trở lên mặt nước` → reset về D0 với fade 2 s.
- Toàn bộ thế giới **recycle**: object có `z > camera.z + 12` được teleport về `camera.z - farBound`. Nhờ vậy quãng đường 500 m không cần scene dài 500 m.

Ở 1.8 m/s, hành trình 40 → 540 m ≈ **4 phút 38 giây**. Đây là con số cần chốt với product trước khi code.

### 13.5 Lighting model — unlit, và budget đổi theo

**Chốt: toàn bộ scene là unlit.** `MeshBasicMaterial` / `ShaderMaterial` + fog + vertex color. Số dynamic light thực tế là **0**.

Lý do: "blue cast + contrast thấp" ở mục 2 là *color grading*, không phải *shading*. PBR không tạo ra được cảm giác đó rẻ hơn, mà lại kéo theo shadow map và cost per-light. Chiều sâu đến từ fog, từ tint theo khoảng cách và từ additive glow — không đến từ đèn.

Sửa mục 10:

```diff
- Dynamic lights:              ≤ 4
+ Dynamic lights:              0
+ Additive glow sprites:       ≤ 24
+ Shader materials:            ≤ 6 (dùng chung, không mỗi object một cái)
```

`PointLight` ở `abyss.js:133` đang chiếu vào toàn `MeshBasicMaterial` — nó không làm gì cả ngoài việc tốn một uniform. Bỏ.

### 13.6 Mapping: tên trong spec → hàm trong code

Các tên viết hoa ở mục 4 và 5 là **tên hàm factory**, không phải file `.glb`. Universe này không tải một model 3D nào.

| Tên trong spec | Hàm | Vị trí | Trạng thái |
|---|---|---|---|
| Water fog | `scene.fog` | `abyss.js:27` | có, thiếu điều chỉnh theo depth (13.2) |
| `SedimentPatch` | `buildSeabed()` | `abyss.js:65` | plane phẳng — cần displacement noise |
| `BasaltRock_A` / `BasaltPillar_B` | `buildSeabed()` | `abyss.js:74` | 36 mesh rời — chuyển `InstancedMesh`, tách 2 dáng |
| `TrenchRidge` | — | — | **chưa có** |
| `KelpCluster` | `addKelp()` | `abyss.js:109` | có, thiếu sway |
| `MemoryBeacon` | `addBeacon()` | `abyss.js:123` | **viết lại** — đang là sphere trắng + 3 torus, vi phạm mục 11 |
| Memory relic | `addPhoto()` | `abyss.js:137` | **viết lại** — plane phẳng, vi phạm mục 11 |
| Caustic light | `buildWaterDetails()` | `abyss.js:86` | **viết lại** — cone tĩnh, mục 6.2 cấm rõ |
| Bubble field | `buildWaterDetails()` | `abyss.js:97` | có |
| Plankton | `buildPlankton()` | `abyss.js:48` | có, dùng lại cho burglar-alarm (14.4) |
| `JellyfishDrifter` | — | — | **chưa có** |
| `LanternFishSchool` | — | — | **chưa có** |
| `BioluminescentAnemone` | — | — | **chưa có** |
| `MemoryShrimp` | — | — | **chưa có** |
| `DeepSilhouette` | — | — | **chưa có** |
| Marine snow | — | — | **chưa có** (14.1) |

Cấu trúc file đề xuất — `abyss.js` 215 dòng hiện tại không đủ chỗ:

```text
public/abyss/js/
├── abyss.js            bootstrap + loop
├── core/phases.js      state machine 13.4
├── core/tiers.js       detect + adaptive downgrade 13.7
├── core/theme.js       ràng buộc theme 13.8
├── scene/seabed.js
├── scene/lighthouse.js
├── scene/relics.js
├── scene/fauna.js
└── fx/water.js         fog, caustic, bubble, marine snow
```

### 13.7 Performance tiers

Detect lúc khởi tạo: `devicePixelRatio`, `navigator.hardwareConcurrency`, `WEBGL_debug_renderer_info`, `navigator.deviceMemory`.

| | LOW | MID | HIGH |
|---|---|---|---|
| Visible relics | 6 | 12 | 16 |
| Instanced rocks | 40 | 90 | 120 |
| Near particles | 400 | 900 | 1 500 |
| Far particles | 800 | 1 800 | 3 000 |
| Marine snow | 300 | 900 | 1 600 |
| Animated fauna | 2 | 5 | 8 |
| Texture / ảnh | 512 px | 768 px | 1 024 px |
| `pixelRatio` cap | 1.0 | 1.5 | 2.0 |
| Antialias | off | on | on |
| Caustic | tắt | 3 shaft | 7 shaft |
| FPS mục tiêu | 30 | 50 | 60 |

**Adaptive downgrade:** đo FPS trung bình mỗi 3 s. Hai cửa sổ liên tiếp dưới ngưỡng → hạ một tier. **Không bao giờ tự nâng tier** — dao động qua lại còn khó chịu hơn tier thấp.

Ngân sách còn thiếu ở mục 10, bổ sung:

```text
Draw calls:        ≤ 60 (HIGH), ≤ 30 (LOW)
Texture memory:    ≤ 48 MB  → ảnh phải nén, lazy theo khoảng cách
First frame:       < 2.5 s trên 4G throttle
```

### 13.8 Ràng buộc theme — cụ thể hoá "10–15%"

Tách hai bảng màu, không dùng chung:

```text
sceneColor   ← palette mục 3, KHÔNG chịu ảnh hưởng theme
accentColor  ← lerp(palette, userTheme, 0.12)
```

`accentColor` chỉ được áp vào đúng ba chỗ:

1. Viền relic frame
2. Hue của beacon core
3. Memory motes quanh beacon

Không bao giờ áp vào: fog, background, nước, marine snow, đá, kelp, bản thân ảnh.

Thêm một guard cứng — sau khi lerp, ép hue về cung teal:

```js
// Trừ Warm memory (#D98F75), mọi accent bị kẹp trong 150°–210°
hsl.h = clamp(hsl.h, 150 / 360, 210 / 360);
```

Đây chính là cơ chế bảo đảm dòng DoD *"theme hồng/tím không thể biến toàn cảnh thành vũ trụ"*, và nó test được (13.10).

Code hiện tại `abyss.js:175-183` lerp `.18` rồi truyền `primary` cho seabed, kelp, plankton, bubble và beacon light — tức là theme đang nhuộm gần như toàn scene. Đây là vi phạm nặng nhất so với mục 3.

### 13.9 Reduced motion và accessibility

`prefers-reduced-motion: reduce`:

```text
forward drift    → 0   (hiện nút "Lặn sâu hơn" để chuyển phase thủ công)
camera sway      → 0
fauna drift      → 0
pulse peak       → 0.42 hạ xuống 0.22
marine snow      → ×0.25 tốc độ
caustic          → tắt
```

Mục 10 mới chỉ tắt fauna drift và pulse. Thứ gây khó chịu nhất là camera tự lặn về phía trước — phải là thứ tắt đầu tiên.

Ngoài motion:

- **Keyboard.** Hiện chỉ có raycast hover/click — không có đường nào tới relic bằng bàn phím. Cần một DOM layer song song (`<ul>` ẩn về mặt thị giác, mỗi relic một `<button>`), sắp theo thứ tự gần → xa. `Tab` duyệt, `Enter` mở, `Esc` đóng. Focus ring 2 px `#B8FFF0` vẽ trên canvas theo vị trí projected của relic.
- **Focus trap** trong lightbox; trả focus về đúng relic khi đóng.
- **Contrast.** Caption trên nền `#01080C` dùng `#B8FFF0` — đạt thoải mái. Nhưng caption đè lên ảnh phải có scrim `rgba(1,8,12,.72)`, không dựa vào ảnh.
- **Audio** giữ nguyên cổng click ở intro; không autoplay.

### 13.10 Nghiệm thu đo được

Bổ sung cho mục 12, phần này phải chạy được chứ không phải nhìn bằng mắt:

```text
[ ] Screenshot 1440×900 tại depth 60 / 350 / 560 m, đối chiếu reference board
[ ] FPS ≥ 50 trên tier MID (máy chuẩn: laptop Intel Iris tích hợp)
[ ] FPS ≥ 30 trên tier LOW (mobile tầm trung)
[ ] First frame < 2.5 s, 4G throttle
[ ] Test tự động: theme = #FF00AA → ΔE(fog, baseline) < 2 và ΔE(background, baseline) < 2
[ ] Test tự động: N = 0 / 1 / 3 / 8 / 40 ảnh đều render không lỗi
[ ] Checklist mục 11: 8/8 PASS
```

Dòng ΔE là dòng quan trọng nhất — nó biến *"theme không được nhuộm scene"* từ ý kiến thành assertion.

### 13.11 Khi galaxy có ít ảnh

Phân bố near/mid/far ở mục 4.4 giả định ≥ 12 ảnh. Với `N` = số ảnh thật:

| N | Bố cục | Quãng đường | Phase |
|---|---|---|---|
| 0 | beacon + fauna, empty state *"Rãnh biển này chưa có ký ức nào"* | 200 m | P1, P2, P6 |
| 1–3 | tất cả ở near field | 180 m | P1, P4, P6 |
| 4–8 | near 2, còn lại mid, far là relic rỗng không texture để giữ chiều sâu | 320 m | bỏ P5 |
| 9–16 | đúng mục 4.4 | 500 m | đủ 6 |
| > 16 | pool 16 mesh, relic bị recycle sẽ nhận texture tiếp theo | 500 m + 12 m/ảnh dư | đủ 6 |

```text
diveDistance = min(620, 500 + max(0, N - 16) × 12)   với N ≥ 9
```

Bảng trên là nguồn duy nhất; công thức này chỉ diễn giải lại dòng cuối của nó. Trần 620 m là bắt buộc: pool relic chặn ở 16 bất kể N, nên quãng đường dài thêm chỉ tốn thời gian di chuyển. Không có trần, N = 200 cho 2708 m — ở 1.8 m/s là hành trình 25 phút.

Relic rỗng ở far field là chủ ý: nó là silhouette tạo chiều sâu, không phải chỗ trống chờ ảnh.

---

## 14. Concept mở rộng — lấy từ hải dương học thật

Bảy hiện tượng dưới đây đều có thật, đều rẻ để render, và đều mang sẵn một tầng nghĩa hợp với một app ký ức. Mục 5 hiện chỉ có sinh vật; phần này thêm *hiện tượng*, thứ làm cảnh có chất riêng.

### 14.1 `MarineSnow` — tuyết biển

Thứ đặc trưng nhất của biển sâu mà spec đang thiếu hoàn toàn. Marine snow là mưa mảnh vụn hữu cơ rơi xuống không ngừng từ tầng nước phía trên: xác sinh vật, phân, mảnh vỡ — và đó là **nguồn thức ăn chính** của cả tầng đáy. Cả một hệ sinh thái sống bằng thứ rơi xuống từ một thế giới nó không bao giờ thấy.

Với một universe ký ức thì hình ảnh này gần như tự viết lấy nghĩa.

```text
hướng:      rơi xuống -Y, 0.05–0.12 m/s
nhiễu:      trôi ngang theo curl noise biên độ 0.3 m
lớp:        2 (gần: sprite 3–6 px mờ; xa: point 1–2 px)
màu:        #B8FFF0 ở opacity 0.10–0.22, không bao giờ trắng thuần
mật độ:     đặc hơn theo độ sâu, đậm nhất ở P5–P6
```

Bắt buộc phân biệt với bubble: **snow rơi xuống, bubble nổi lên**. Hai lớp ngược chiều nhau chính là thứ tạo cảm giác "đang ở giữa cột nước" — mục 11 đã sửa lại cho khớp.

Ưu tiên: **cao nhất**. Rẻ nhất, thay đổi nhiều nhất.

### 14.2 `MemoryLattice` — Venus' flower basket

*Euplectella aspergillum*, hải miên thuỷ tinh sống dưới 500 m. Bộ khung của nó là lưới silica dẫn ánh sáng **đúng như sợi quang**, và bên trong hầu như luôn có **một đôi tôm bị nhốt trọn đời** — chui vào lúc còn nhỏ, lớn lên thì không ra được nữa. Con tôm dọn dẹp cho hải miên, hải miên che chở cho tôm. Ở Nhật, bộ khung này được tặng trong đám cưới như biểu tượng của tình yêu không rời.

Một cái lồng thuỷ tinh dẫn sáng, giam giữ một đôi, cả đời. Khó tìm được metaphor nào hợp hơn cho một app lưu ký ức chung.

```text
MemoryLattice  (relic đặc biệt, dùng cho ảnh được đánh dấu favourite)
├── lưới silica: CylinderGeometry wireframe xoắn, 2 chiều đối nhau
├── sợi sáng chạy dọc lưới, pha lệch — tái hiện tính dẫn quang
├── hai đốm sáng nhỏ chuyển động bên trong, không bao giờ ra ngoài
└── ảnh nằm giữa lồng, nhìn qua lưới
```

Ưu tiên: **cao**. Đây là thứ khiến người ta chụp màn hình.

### 14.3 `WhaleFall` — xác cá voi

Một xác cá voi chìm xuống đáy nuôi sống nguyên một hệ sinh thái: giai đoạn xác mềm ~2 năm, rồi giun ăn xương duy trì cộng đồng đó **tới 80 năm**. Một con vật 40 tấn mang xuống đáy lượng carbon tương đương khoảng 2 000 năm marine snow rơi vào cùng diện tích đó.

Cái đã mất vẫn tiếp tục nuôi sống thứ khác, rất lâu sau khi nó ngừng tồn tại.

```text
Vị trí:  landmark cuối rãnh, xuất hiện ở P5, đi qua ở P6
Render:  bộ xương sườn silhouette low-poly, cực tối, rim-light lạnh rất nhẹ
Fauna:   MemoryShrimp tụ đông nhất quanh đây
Nội dung: gắn ảnh CŨ NHẤT trong galaxy vào đây, không random
```

Không giải thích bằng chữ. Cứ để nó ở đó.

Ưu tiên: **cao**. Là landmark duy nhất khiến P5–P6 có đích đến.

### 14.4 Burglar alarm — plankton phản ứng

Tảo giáp phát sáng khi bị khuấy động. Cơ chế thật: ánh sáng đó **tố cáo vị trí kẻ tấn công**, kéo kẻ săn mồi lớn hơn tới ăn nó. Đèn báo trộm.

Đây là cách rẻ nhất để scene có phản hồi sống, thay cho hiệu ứng hover thông thường:

```text
Camera hoặc con trỏ đi qua vùng plankton
  → plankton trong bán kính 2.5 m sáng lên trong 0.4 s
  → tắt dần trong 1.8 s
  → để lại một vệt sáng sau lưng người xem
```

Làm bằng shader attribute (khoảng cách tới camera → intensity), không cần cập nhật CPU. Dùng lại `buildPlankton()` sẵn có.

Ưu tiên: **cao**. Chi phí gần bằng không, cảm giác khác hẳn.

### 14.5 Counter-illumination cho `DeepSilhouette`

Nhiều sinh vật biển sâu phát sáng ở **bụng** để khớp với ánh sáng rọi từ trên xuống, nhờ đó xoá bóng của chính nó. Chúng tự phát sáng để trở nên vô hình.

Áp dụng đúng tinh thần mục 5 — chỉ *gợi ý* rằng đại dương còn sự sống:

```text
DeepSilhouette chỉ hiện hình khi cắt ngang một tia caustic.
Ngoài khoảnh khắc đó, opacity = 0.
Không bao giờ hiện trọn vẹn hình dáng. Không lặp lại quá 2 lần mỗi phiên.
```

Người xem sẽ không chắc mình vừa thấy gì. Đó là mục tiêu.

Ưu tiên: trung bình.

### 14.6 `MemoryPool` — brine pool

Dưới đáy vịnh Mexico có những hồ nước muối đậm đặc tới mức **không hoà lẫn** với nước biển quanh nó: có mặt hồ riêng, có bờ, có sóng riêng. Một cái hồ nằm dưới đáy biển. Một tấm gương ở nơi lẽ ra không thể có gương.

```text
Vị trí:  P6 (Release)
Render:  1 plane + bản sao lật của relic cuối, opacity 0.35, distort nhẹ theo noise
Hành vi: beacon tắt dần → chỉ còn ảnh phản chiếu trên mặt hồ
```

Đây là kết bài cho mục 8: ký ức không biến mất, nó lắng xuống.

Ưu tiên: trung bình. Đắt hơn phần còn lại nếu làm reflection thật — nên chỉ làm bản sao lật.

### 14.7 `DriftRibbon` — siphonophore Apolemia

Năm 2020 tại hẻm ngầm Ningaloo, người ta ghi hình một siphonophore *Apolemia* dài khoảng 45 m, có ước tính lên tới 120 m — sinh vật dài nhất từng được ghi nhận. Nó không phải một con vật, mà là **hàng nghìn cá thể nhỏ** nối nhau thành một chuỗi, cuộn thành vòng xoắn giữa vùng nước tối.

Nhiều mảnh rời tự tổ chức thành một thứ duy nhất, rất dài. Về mặt hình ảnh nó cũng chính là một album ảnh.

```text
Render:  TubeGeometry theo CatmullRomCurve3, additive, 1 draw call
Vị trí:  far field, P5
Chuyển động: trôi ngang 0.15 m/s, xoắn rất chậm
Kích thước: dài 60–90 m — phải đủ dài để không thấy được cả hai đầu
```

Thay cho con jellyfish thứ hai ở mục 5 — ấn tượng hơn, cùng chi phí.

Ưu tiên: trung bình.

### 14.8 Hydrothermal shimmer

Nước nóng thoát ra từ miệng phun thuỷ nhiệt có chiết suất khác nước lạnh quanh nó, tạo hiệu ứng gợn sóng giống hơi nóng bốc trên mặt đường. Một quad phía trên beacon với UV distortion theo noise là đủ.

Nó cho `MemoryBeacon` chất "vật lý thật" thay vì chỉ là một vật phát sáng.

Ưu tiên: thấp. Làm sau cùng.

### 14.9 Nếu chỉ làm được ba thứ

```text
1. MarineSnow          (14.1) — rẻ nhất, đổi bầu không khí nhiều nhất
2. Burglar alarm       (14.4) — gần như miễn phí, scene trở nên có phản hồi
3. WhaleFall           (14.3) — landmark duy nhất khiến hành trình có đích
```

`MemoryLattice` (14.2) là thứ đáng làm ngay sau đó, khi `MemoryBeacon` được viết lại — hai cái dùng chung kỹ thuật lưới dẫn sáng.

### 14.10 Nguồn

- [NOAA — What is marine snow?](https://oceanexplorer.noaa.gov/facts/marine-snow.html) · [MBARI — Whale falls](https://www.mbari.org/news/whale-falls-islands-of-abundance-and-diversity-in-the-deep-sea/) · [Monterey Bay Aquarium — Whale falls explained](https://www.montereybayaquarium.org/about-us/stories/whale-remains-build-ecosystems)
- [Wikipedia — Venus' flower basket](https://en.wikipedia.org/wiki/Venus%27_flower_basket) · [Deep Sea News — Venus's Flower Basket](https://deepseanews.com/2008/10/the-27-best-deep-sea-species-11-venuss-flower-basket/) · [NIWA — Euplectellidae](https://niwa.co.nz/coasts/critter-week/critter-week-venus-flower-baskets-euplectellidae)
- [Latz Lab UCSD — Bioluminescence as a burglar alarm](https://latzlab.ucsd.edu/2014/08/21/bioluminescence-as-a-burglar-alarm/) · [Smithsonian Ocean — Bioluminescence](https://ocean.si.edu/ocean-life/fish/bioluminescence) · [Wikipedia — Counter-illumination](https://en.wikipedia.org/wiki/Counter-illumination)
- [Amusing Planet — Brine pools](https://www.amusingplanet.com/2018/11/brine-pools-lakes-under-ocean.html) · [Discovery — Jacuzzi of Despair](https://www.discovery.com/exploration/Jacuzzi-of-Despair-Deadly-Lake-Gulf-of-Mexico)
- [Schmidt Ocean Institute — Ningaloo canyons expedition](https://schmidtocean.org/new-species-discovered-during-exploration-of-abyssal-deep-sea-canyons-off-ningaloo/) · [Science — Longest deep-sea animal](https://www.science.org/content/article/longest-deep-sea-animal-spotted-australian-coast)
