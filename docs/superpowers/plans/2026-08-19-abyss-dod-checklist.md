# Abyss — Definition of Done

Đối chiếu mục 11, 12 và 13.10 của `docs/abyss-universe-visual-spec.md`.

Phần **Tự động** chạy được ngay. Phần **Trong trình duyệt** cần người mở thật — không agent nào trong quá trình làm mở được trình duyệt, nên đây là phần chưa từng được kiểm chứng bằng mắt.

---

## 1. Tự động — chạy ngay

```bash
npm run test:abyss     # 37 tests
npm test               # 139 tests, 7 suite
```

- [ ] `npm run test:abyss` — 37 pass, 0 fail (7 depth + 8 palette + 14 layout + 8 phases)
- [ ] `npm test` — 139 pass, 0 fail, không suite nào đỏ thêm so với trước plan
- [ ] Test ΔE trong `tests/abyss-palette.test.js`: theme `#FF00AA` cho ΔE = 0 trên cả 8 màu scene — đây là dòng biến *"theme không được nhuộm scene"* từ ý kiến thành assertion
- [ ] Test bố cục: N = 0 / 1 / 3 / 4 / 8 / 9 / 16 / 40 đều cho plan hợp lệ, bất biến `relicCount === near + mid + far` giữ ở mọi nhánh

Kiểm bằng lệnh:

```bash
# 0 dynamic light (mục 13.5) — phải không in ra gì
grep -rn "PointLight\|DirectionalLight\|SpotLight\|AmbientLight\|HemisphereLight" public/abyss/js/

# không tải model 3D nào (mục 11) — phải không in ra gì
grep -rn "GLTFLoader\|OBJLoader\|FBXLoader\|\.glb\|\.gltf" public/abyss/js/

# không còn file abyss nào ngoài git
git status --short public/abyss/
```

- [ ] Cả ba lệnh trên đều không in ra dòng nào

### Mutation test — chứng minh test không rỗng

Bốn lần trong quá trình làm, một test xanh hoá ra không khoá gì cả. Trước khi tin bộ test, đổi giá trị rồi xác nhận nó đỏ:

| Đổi | File | Kỳ vọng |
|---|---|---|
| `ACCENT_MIX` 0.12 → 0.25 | `core/palette.js` | `abyss-palette` đỏ |
| `streamed: withImages < n` → `false` | `core/layout.js` | `abyss-layout` đỏ |
| bỏ `Math.min(620, …)` | `core/layout.js` | `abyss-layout` đỏ |
| `blendInto` dùng `table[currentIndex + 1]` | `core/phases.js` | `abyss-phases` đỏ 2 test |

- [ ] Cả bốn mutation đều làm đỏ đúng suite; `git checkout --` khôi phục xong về lại 139 pass

### Ngân sách texture — phải đếm, không được tính nhẩm

Con số này bị sửa **ba lần** (1024 → 896 → 832), mỗi lần vì phát hiện thêm một texture chưa được đếm. Đừng tin phép tính trong đầu; đếm thật trong trình duyệt (xem mục 2).

Công thức: RGBA8 + mipmap = `w · h · 4 · 4/3`. Worst case là ảnh vuông. Số texture = `plan.near + plan.mid` relic mang ảnh **+ 1 tấm trên whale fall**, và đường stream dựng texture mới *trước* khi dispose tấm cũ nên có khoảnh khắc giữ thêm 1.

| tier | texture | cap | thường | lúc swap | trần 48 MB |
|---|---|---|---|---|---|
| high | 12 | 832 | 44.3 MB | 48.0 MB | đạt |
| mid | 12 | 768 | 37.7 MB | 40.9 MB | đạt |
| low | 7 | 512 | 9.8 MB | 11.2 MB | đạt |

---

## 2. Trong trình duyệt — chưa ai kiểm

```bash
npm run dev
```

### Ba mốc bắt buộc, chụp 1440×900

- [ ] depth 60 M — chỉ nước tối, marine snow rơi xuống, chưa thấy relic
- [ ] depth 350 M — beacon rõ, relic ba lớp gần/giữa/xa
- [ ] depth 560 M — beacon tắt dần, còn một relic và khoảng tối

### Galaxy ít ảnh — nơi nhiều bug nhất từng ẩn

- [ ] `/abyss/` (không galaxyId) → hiện empty state, không lỗi console
- [ ] galaxy **2 ảnh** → HUD dừng quanh 220 M, **gặp được cả hai relic** (trước plan chúng nằm ngoài hành trình)
- [ ] galaxy **2 ảnh** → thấy beacon (trước plan nó ở z −292, ngoài tầm với)
- [ ] galaxy **4–8 ảnh** → thấy 3 silhouette far tối, nhỏ, **không có ảnh**, và không click được
- [ ] galaxy **12+ ảnh** → HUD tới 540 M, đủ 6 phase, thấy xác cá voi mang ảnh **cũ nhất**
- [ ] galaxy **> 16 ảnh** → relic vòng lại nhận ảnh mới; không ảnh nào bị bỏ sót

### Đếm texture thật

Dán vào console (thêm tạm `window.__abyssScene = scene;` cuối `init()`, rồi gỡ):

```js
let n = 0, bytes = 0;
window.__abyssScene.traverse(o => {
  const img = o.material?.map?.image;
  if (!img) return;
  n++; bytes += img.width * img.height * 4 * 4 / 3;
});
console.log(n, 'texture,', (bytes / 1e6).toFixed(1), 'MB');
```

- [ ] Số MB ≤ 48 và số texture khớp bảng trên
- [ ] Không texture nào có cạnh dài hơn `tier.texture`

### Hiệu năng

- [ ] FPS ≥ 50 trên tier MID (máy chuẩn: laptop Intel Iris tích hợp)
- [ ] FPS ≥ 30 trên tier LOW (mobile tầm trung)
- [ ] Draw calls ≤ 60 trên HIGH, ≤ 30 trên LOW (`renderer.info.render.calls`)
- [ ] First frame < 2.5 s với DevTools throttle "Fast 4G"
- [ ] Ép tụt tier (dán đoạn chặn frame ở Task 11) → log `Viewer Performance Downgrade`, số relic giảm **nhưng không giấu ảnh nào**, caustic tắt, hạt plankton **không to ra**

### Mục 11 — tám điều cấm

- [ ] Không starfield
- [ ] Không orbit ring thống trị bố cục
- [ ] Không quả cầu trung tâm màu trắng
- [ ] Không ảnh dựng thành hàng phẳng
- [ ] Không theme màu trực tiếp lên toàn scene
- [ ] Không scene sáng đều từ mọi phía
- [ ] Không toàn bộ sinh vật pulse cùng lúc — vệt burglar alarm chỉ sáng quanh camera
- [ ] Bubble nổi **lên**, marine snow rơi **xuống**, phân biệt được bằng mắt

### Trợ năng

- [ ] Tab từ lúc tải trang → focus vào **cổng intro**, Enter hoặc Space mở được (trước plan không vào được bằng bàn phím)
- [ ] Tab tiếp → nhãn caption hiện ở đáy màn hình, vòng sáng bám đúng relic
- [ ] Không có điểm dừng Tab chết (silhouette far đã bị lọc khỏi danh sách)
- [ ] Enter mở lightbox, focus ở nút đóng và **thấy được viền focus**
- [ ] Tab trong lightbox không thoát ra ngoài
- [ ] Esc đóng, focus quay lại đúng nút vừa bấm
- [ ] Vòng focus không nhảy sang vị trí đối xứng khi relic trôi ra sau lưng camera
- [ ] `prefers-reduced-motion`: camera đứng yên, nút "Lặn sâu hơn" hoạt động, sinh vật không trôi, caustic tắt — **nhưng silhouette vẫn hiện được** (fallback 45 m)
- [ ] Contrast caption ≥ 4.5:1; vòng focus có viền tối hai phía nên đọc được cả trên nền tia caustic sáng

### Parity

- [ ] Preview admin và `/view/` public dùng cùng scene graph, cùng kết quả

---

## 3. Còn treo — cần quyết định sản phẩm

- **Hành trình đầy đủ 4 phút 38 giây** (500 m ở 1.8 m/s). Nếu đổi, sửa `diveDistance` trong `core/layout.js`; test ở Task 3 sẽ bắt được.
- **Theme không màu mất hoàn toàn ảnh hưởng accent.** Theme xám/đen/trắng không có hue để nudge trong dải teal, nên hiện trả về accent gốc — kết quả không khác gì không chọn theme. Phương án mềm hơn: cho tác động vào *lightness*. Chi tiết và số đo trong plan, mục "Quyết định còn treo".
- **Ảnh trên xác cá voi không mở được.** Chốt theo mục 14.3 (*"không giải thích bằng chữ, cứ để nó ở đó"*), nhưng người dùng thấy ảnh sẽ thử click. Nếu đổi ý, cần thêm guard theo opacity, nếu không sẽ mở được lightbox bằng cách click nước đen 80 m trước khi xác cá voi hiện ra.

## 4. Chưa làm — ghi rõ để không tưởng là quên

- `MemoryLattice` (mục 14.2) — cần khái niệm "favourite" ở tầng dữ liệu mà `models/galaxy.js` chưa có
- `MemoryPool` phản chiếu thật (mục 14.6) — hiện là đĩa additive phẳng
- `DriftRibbon` chuyển động ngang 0.15 m/s (mục 14.7) — hình dạng đã có
- Hydrothermal shimmer hiệu chỉnh cường độ (mục 14.8)
- Audio theo phase — mục 8 nhắc soundscape nhưng chưa nối vào `phaseDirector`
- Tia caustic vẫn trải đều theo quãng đường nhưng **không** theo mật độ ánh sáng bề mặt; mục 6.2 muốn chúng thưa dần theo độ sâu
