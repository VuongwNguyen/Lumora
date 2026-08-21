# CLAUDE.md — Lumora

`AGENTS.md` là nguồn sự thật cho quy tắc sản phẩm, backend, auth, payment và compliance. **Đọc nó trước.** File này chỉ bổ sung phần `AGENTS.md` chưa nói: cách làm việc với UI, Three.js và cách *nhìn thấy* kết quả trước khi báo xong.

---

## 1. Stack thật — đừng giả định

| | |
|---|---|
| Backend | Express 5, CommonJS, Node 20 |
| Frontend | **JS thuần, không bundler, không build step** — HTML tĩnh phục vụ từ `public/` |
| 3D | `three@0.152.2` nạp qua **importmap từ unpkg**, cố ý không nằm trong `package.json` |
| TypeScript | không có |
| React / R3F | **không có** |
| Test logic | `node --test` |
| Test thị giác | Playwright (`tests/visual/`) |

Hệ quả quan trọng:

- **Không có bước build cho frontend.** Sửa file trong `public/` là xong. `npm run build` không tồn tại và không phải bằng chứng gì cả.
- **Mỗi universe là một HTML tự chứa.** `abyss`, `aurora`, `fall`, `galaxy-moon`, `story`.
- **Không thêm React, R3F, TypeScript hay bundler** nếu chưa có quyết định kiến trúc riêng. Đó là thay đổi cả hệ thống deploy và 5 template, không phải một bước setup.
- Module ES import lẫn nhau **không có cache-buster riêng**. Bump `?v=` trên thẻ `<script>` của entry **không** làm mới các module nó import.

---

## 2. Điểm vào thật là `/view/`, không phải `/{template}/`

```text
/abyss/?galaxyId=X   →  302  →  /view/?galaxyId=X     (nuốt hết query khác)
/view/?galaxyId=X    →  storyType có?  →  template `story`
                     →  không          →  galaxy.template
/view/?galaxyId=X&skip_se=true  →  ép về universe gốc
```

Test thẳng vào `/{template}/` là test một đường người dùng không bao giờ đi qua. Đã có một lần test PASS trong khi màn hình hiển thị overlay Story chứ không phải scene cần kiểm.

Query hữu ích: `autostart=true` bỏ qua `#intro`, `debug=1` bật telemetry, `skip_se=true` bỏ Story Emotion.

---

## 3. Workflow bắt buộc cho việc UI / 3D

```text
Hiểu yêu cầu
    ↓
Đọc code hiện có          ← đừng viết lại thứ đã có abstraction
    ↓
Lập kế hoạch
    ↓
Implement
    ↓
Chạy server               npm run dev
    ↓
Mở browser bằng Playwright
    ↓
CHỤP MÀN HÌNH VÀ NHÌN NÓ  ← không phải chỉ chụp rồi báo xong
    ↓
Đọc telemetry             draw call, tam giác, fps, texture MB
    ↓
Kiểm tương tác + responsive
    ↓
Sửa → lặp lại
    ↓
node --test + Playwright xanh
    ↓
Mới được nói DONE
```

**Không được coi những thứ sau là bằng chứng UI đã xong:**

- `node --test` xanh
- không có lỗi console
- "code đọc thì đúng"
- đã chụp screenshot (mà không nhìn)

Bộ 40 test `node --test` của `abyss` xanh toàn bộ trong khi scene có sáu lỗi hình học: ảnh xuyên qua camera, hai landmark nằm ngoài tầm với, 41/59 ảnh không bao giờ hiện. **Test logic không thay được mắt.**

---

## 4. Lệnh

```bash
npm run dev                  # server tại :3030
npm test                     # toàn bộ node --test, 142 test
npm run test:abyss           # chỉ module thuần của abyss
npm run test:visual          # Playwright, Firefox + Chromium, 4 viewport
npm run test:visual:firefox  # chỉ Firefox (ưu tiên: hay lệch nhất)
npm run test:visual:ui       # chế độ UI để soi từng bước
npm run test:visual:report   # mở báo cáo HTML
```

`npm test` **không** bao gồm visual — visual cần server chạy và browser binary. Chạy riêng.

Galaxy để test: `LUMORA_TEST_GALAXY=<id> npm run test:visual`

---

## 5. Telemetry — biến "trông ổn" thành số đọc được

Thêm `?debug=1` để bật `window.__lumora` (chỉ khi có query đó, production không lộ gì):

```js
window.__lumora = {
  template,              // universe nào ĐANG render — assert cái này
  scene, camera, renderer,
  info,                  // renderer.info: draw call, tam giác, texture
  fps, depth, phase, plan,
  textureBytes,          // tổng MB texture đang giữ
  seek(depth),           // nhảy tới độ sâu để chụp mốc cụ thể
}
```

Hiện mới có ở `abyss`. Khi làm universe khác, thêm hook tương tự — harness tự degrade nếu thiếu.

**Assert `template` khớp universe mong đợi.** `draw calls > 0` không chứng minh đang xem đúng thứ cần xem.

---

## 6. Ngưỡng chất lượng 3D

Đánh giá scene theo những mục này, không phải theo "code trông đúng":

**Bố cục** — camera, khuôn hình, tỉ lệ, phân cấp thị giác. Vật thể đặt bằng hằng số toạ độ gần như luôn sai: đối chiếu với **điểm dừng thật của camera**, không phải chiều dài scene.

**Vật liệu** — scene unlit thì khối không có bóng; muốn có hình khối phải nướng shading vào vertex color.

**Chuyển động** — easing, nhịp, liên tục. Mọi easing phải độc lập frame rate (`easeTowards`, hoặc `1 - Math.pow(1 - k, dt * 60)`), không nhân thẳng hệ số mỗi frame.

**Render** — antialias, tone mapping, color space.

**Hiệu năng** — draw call, tam giác, texture MB, fps. Đo trước, tối ưu sau.

### Bẫy `three@0.152.2` đã cắn thật, đừng dẫm lại

| Bẫy | Hệ quả |
|---|---|
| `ColorManagement` bật mặc định — `THREE.Color` giữ giá trị **linear** | Lerp trong linear rồi xuất sRGB cho màu **sáng hơn** tính nhẩm. Đặt hex tường minh thay vì lerp từ theme |
| `ShaderMaterial.fog` mặc định **`false`** (`PointsMaterial` là `true`) | Chuyển sang shader tự viết là mất fog — hạt xa thành bức tường đục |
| `Points.boundingSphere` chỉ tính **một lần** | Lớp hạt cuộn quanh camera bị frustum-cull mất sạch. Đặt `frustumCulled = false` |
| `PointsMaterial` không có `map` | Mỗi hạt là **ô vuông** sắc cạnh, không phải chấm tròn |
| `Vector3.project` khi vật ở sau camera | Toạ độ bị **lật**; `z > 1` bắt được sau camera nhưng **không** bắt khe giữa camera và near plane, ở đó `x` vọt lên hàng chục nghìn px và thành `NaN`. Kiểm bằng độ sâu view-space |
| `camera.matrixWorldInverse` chỉ refresh trong `renderer.render` | Chiếu toạ độ **trước** khi render sẽ dùng ma trận frame trước, overlay trễ một nhịp |
| `:focus-visible` với focus bằng script | Là heuristic của trình duyệt, không đảm bảo. Dùng `:focus` cho phần tử focus bằng code |

---

## 7. Skill nào dùng khi nào

| Việc | Skill |
|---|---|
| Tạo/redesign page, component, landing, polish UI | `frontend-design` |
| Review UI trước khi xong | `/web-interface-guidelines` |
| Three.js: hình học, vật liệu, ánh sáng, texture, animation, loader, shader, post-processing, tương tác | `threejs-*` |
| Nguyên tắc chung Three.js | `three-best-practices` |
| Nâng chất lượng hình ảnh | `threejs-aaa-graphics-builder` |
| Đo và gỡ hiệu năng | `threejs-debug-profiler` |
| Kiểm thị giác, scorecard trước khi bàn giao | `threejs-qa-release` |

Các skill `threejs-*` viết cho Three.js thuần — khớp Lumora. **Không có skill R3F** vì Lumora không dùng R3F; đừng áp pattern R3F vào đây.

---

## 8. Tránh UI kiểu AI sinh sẵn

Không mặc định: gradient tím, bo góc quá đà, glassmorphism ngẫu nhiên, đổ bóng thừa, pill khắp nơi, Inter cho mọi thứ, card grid cho mọi bố cục, dashboard SaaS chung chung.

Mỗi giao diện phải có phân cấp thị giác, hệ typography, hệ spacing, bố cục có chủ đích, trạng thái tương tác rõ, hành vi responsive, và bản sắc hợp với Lumora — dark, trầm, ưu tiên khoảng lặng.

`AGENTS.md` mục 11 là ràng buộc bắt buộc; phần này bổ sung chứ không thay thế.

---

## 9. HTML/CSS vs WebGL — ranh giới

**HTML/CSS chịu trách nhiệm:** chữ, form, điều hướng, accessibility, SEO, tương tác chuẩn.

**Three.js chịu trách nhiệm:** scene 3D, hạt, shader, camera, vật liệu, tương tác không gian, hiệu ứng điện ảnh.

Không đưa toàn bộ UI vào canvas. Không viết WebGL thuần khi Three.js giải quyết sạch hơn.

---

## 10. Trước khi thêm dependency

Kiểm theo thứ tự: đã có chưa → có thật sự cần không → tương thích không → còn được bảo trì không → tốn bao nhiêu runtime → license.

**Nếu chỉ là tài liệu hoặc hướng dẫn → cài dạng skill, không phải dependency runtime.**

Không thêm: UI library ngẫu nhiên, animation library trùng chức năng, test runner thứ hai, state manager, framework WebGL khác.

---

## 11. Vệ sinh thao tác

- Repo có **cả `package-lock.json` lẫn `yarn.lock`** — nguồn sự thật mơ hồ, cần dọn. Trong lúc chưa dọn, dùng `npm`.
- Working tree thường có việc dở dang của người khác. **Chỉ stage đúng file mình sửa**, không `git add -A`.
- `tests/tmdt-compliance.test.js` là guard test dùng regex trên source. Đổi tên hàm hoặc chuyển logic sang file khác sẽ làm nó đỏ — **sửa assertion trỏ sang bất biến mới trong cùng commit**, đừng xoá.
- Mutation test trên code **chưa commit** thì dùng `cp` để sao lưu, **không dùng `git checkout --`** — nó reset về HEAD và xoá mất việc đang làm.
- Test xanh chưa chắc khoá được gì. Đổi hằng số rồi xác nhận test **đỏ**; nếu vẫn xanh thì test đó rỗng.
