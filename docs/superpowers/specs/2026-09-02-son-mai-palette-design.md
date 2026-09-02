# Bảng màu sơn mài cho vỏ ứng dụng Lumora

Ngày: 2026-09-02

## 1. Vấn đề

Vỏ ứng dụng Lumora (landing, auth, portal, admin, legal) đang dùng **bảng màu mặc định của
Tailwind**, không phải một lựa chọn thiết kế:

| hex | số lần dùng | thực chất |
|---|---|---|
| `#8b5cf6` | 29 | `violet-500` |
| `#f87171` | 26 | `red-400` |
| `#c4b5fd` | 21 | `violet-300` |
| `#7c3aed` | 19 | `violet-600` |
| `#4ade80` | 12 | `green-400` |
| `#fbbf24` | 9 | `amber-400` |
| `#a78bfa` | 8 | `violet-400` |
| `#6d28d9` | 8 | `violet-700` |

Violet-500/600 trên nền gần đen là bảng màu bị lặp nhiều nhất trong UI do AI sinh, nên sản
phẩm đọc ra là "một trang landing" chứ không phải "Lumora". `CLAUDE.md` mục 8 vốn đã cấm
đúng thứ này ("Không mặc định: gradient tím…").

Vấn đề thứ hai, lớn hơn: **`public/` có 136 màu hex riêng biệt**, riêng nền gần-đen đã có 12
sắc khác nhau (`#06060e`, `#060610`, `#020207`, `#05050d`, `#04040c`, `#010a18`, `#0d0d1e`,
`#0a0015`, `#090712`…). Đó không phải hệ màu, đó là 136 quyết định rời rạc. `index.html`
còn có **hai khối `:root` chồng nhau**, khai báo `--bg` hai lần.

Đo phân bố màu tím:

| file | tổng chỗ tím | nằm trong `:root` |
|---|---|---|
| `public/index.html` | 53 | 10 |
| `public/auth/index.html` | 24 | 5 |
| `public/portal/index.html` | 28 | 5 |
| `public/admin/index.html` | 17 | 0 |
| `public/shared/css/legal.css` | 5 | 2 |
| **tổng** | **~127** | **22** |

**82% màu tím không đi qua biến.** Nên phương án "chỉ đổi giá trị trong `:root`" chỉ sửa
được 18% và bị loại.

### Thứ KHÔNG hỏng và phải giữ

Typography không phải đồ mặc định: `Cormorant Garamond` + `Jost`. AI mặc định là
Inter/system-ui. Đây là lựa chọn có gu và là phần mạnh nhất của trang chủ. Giọng chữ tiếng
Việt ("ánh sáng của ký ức", "Ký ức không chỉ để xem") cũng là bản sắc riêng.

Kết luận: Lumora **đã có bản sắc ở tầng chữ**, đang bị bọc trong lớp vỏ màu + hiệu ứng mặc
định. Đây không phải redesign, mà là gỡ lớp vỏ mặc định và dựng hệ token.

## 2. Quyết định

**Bảng màu: sơn mài trầm (phương án G1 "Son trầm").**

Sơn mài có bốn chất: **đen** (nền), **son** (đỏ chu), **vàng kim**, **vỏ trứng** (trắng ngà —
sơn ta không có màu trắng nên nghệ nhân dán vỏ trứng thật). Bốn chất này map thẳng sang bốn
nhóm vai trò trong UI.

Chọn bản **trầm** chứ không phải bản rực: đồ sơn mài cũ lên nước thì son ngả nâu, vàng xỉn
thành đồng. Yêu cầu "không chói mà vẫn dịu mắt" trùng với sơn mài thật hơn là sơn mài mới
ra lò.

"Dịu mắt" đạt bằng bốn việc, không phải chỉ hạ độ sáng:

1. **Hạ bão hoà accent** — son từ S 60% xuống S 49%.
2. **Nền ngả ấm** — `#14090a` thay vì đen ngả xanh/tím. Mắt ít nhạy với bước sóng dài nên
   đen ngả nâu đỡ mỏi hơn.
3. **Hạ tương phản chữ** — vỏ trứng `#e8dccc`, không dùng `#fff`. Vẫn thừa ngưỡng đọc nhưng
   bỏ được cái gắt của chữ gần-trắng trên nền gần-đen.
4. **Accent chiếm ít diện tích** — chỉ nút chính và một gạch dẫn; chip trạng thái dùng
   accent ở độ đục thấp, không phải nền đặc.

**Ba thứ bỏ đi cùng lúc với màu** (đây mới là dấu hiệu AI mạnh nhất, mạnh hơn bản thân màu tím):

- **Glow tím dưới nút** — `rgba(139,92,246,.35/.4/.2/.1)`, 4 chỗ trong `index.html`. Nút
  thành nền đặc, chữ tối, không đổ bóng màu.
- **Pill bo tròn + ✦** ("✦ GỬI ĐẾN NGƯỜI BẠN MUỐN") — hình pill có sparkle dẫn đầu là badge
  "AI-powered" kinh điển. Thay bằng một gạch ngang dẫn vào chữ.
- **Gradient trên chữ nhấn** — dòng nghiêng thành một màu đặc, để typography tự đứng.

### Phạm vi

**Trong phạm vi** — 13 file HTML của vỏ ứng dụng:

| nhóm | file |
|---|---|
| Landing | `public/index.html` |
| Auth | `public/auth/index.html` |
| Portal | `public/portal/index.html`, `galaxy.html`, `galaxy-setup.html`, `story-setup.html` |
| Admin | `public/admin/index.html` |
| Legal | `public/terms/index.html`, `privacy/index.html`, `support/index.html`, `payment-policy/index.html`, `refund-policy/index.html`, `owner-info/index.html` |
| CSS dùng chung | `public/shared/css/legal.css`, `subscription.css` |
| JS có màu giao diện | `public/portal/js/admin.js` |

**Ranh giới: đổi màu GIAO DIỆN, không đổi màu HIỂN THỊ CỦA GALAXY.** Mọi thứ người dùng nhìn
thấy *về galaxy của họ* — universe, tinh vân, hạt, theme — giữ nguyên tuyệt đối. Chỉ vỏ ứng
dụng đổi.

**Ngoài phạm vi:**

- **5 universe** (`abyss`, `aurora`, `fall`, `galaxy-moon`, `story`) — mỗi cái đã có thế giới
  màu riêng. Vai trò của màu thương hiệu ở đây là làm *khung* cho 5 thế giới đó, không phải
  làm thế giới thứ 6.
- **`portal/js/galaxy-viewer.js`** — dù nằm trong `portal/`, đây **không phải giao diện**.
  Chú thích đầu file: *"Live galaxy viewer for galaxy-setup — mirrors galaxy-moon aesthetic"*.
  Mảng `nebulaColors` ở dòng 110 là màu **tinh vân của chính galaxy**, cố ý bám thẩm mỹ
  universe `galaxy-moon`. Đổi nó là đổi diện mạo galaxy, không phải đổi UI. **Giữ nguyên.**
- **`galaxy-setup.js:505`** — `safeThemeColor(colors.primary, '#8b5cf6')` là màu theme mặc
  định cho galaxy người dùng. **Giữ nguyên `#8b5cf6`.** Đổi nó sẽ làm mọi galaxy chưa tự
  chọn màu — kể cả galaxy đã chia sẻ link đi rồi — đổi diện mạo.
- Gom toàn bộ 136 màu về token. Đợt này chỉ gom màu của vỏ; màu universe giữ nguyên.

Quy tắc phân định khi gặp chỗ chưa rõ: hỏi *"cái này mô tả sản phẩm, hay mô tả kỷ vật của
người dùng?"* Mô tả sản phẩm thì đổi; mô tả kỷ vật thì giữ.

## 3. Bảng token

File mới: `public/shared/css/tokens.css`, một khối `:root` duy nhất.

### Đen — nền

| token | giá trị | dùng ở đâu |
|---|---|---|
| `--lum-nen` | `#14090a` | nền trang |
| `--lum-mat` | `#1f1012` | thẻ, panel |
| `--lum-mat-noi` | `#2a1719` | hover, lớp nổi |

### Vỏ trứng — chữ

| token | giá trị | dùng ở đâu |
|---|---|---|
| `--lum-trung` | `#e8dccc` | chữ chính |
| `--lum-trung-mo` | `rgba(232,220,204,.62)` | chữ phụ |
| `--lum-trung-nhat` | `rgba(232,220,204,.40)` | chữ mờ, placeholder |

### Son — hành động

| token | giá trị | dùng ở đâu |
|---|---|---|
| `--lum-son` | `#9e4438` | nút chính, link, tab active |
| `--lum-son-sang` | `#b8564a` | hover của nút chính |
| `--lum-son-mo` | `rgba(158,68,56,.14)` | nền chip, nền tint |

### Đồng — nét và nhấn

| token | giá trị | dùng ở đâu |
|---|---|---|
| `--lum-dong` | `#b99a5e` | chữ nhấn (dòng nghiêng), viền active, icon |
| `--lum-dong-mo` | `rgba(185,154,94,.16)` | nền badge |

### Đường nét

| token | giá trị |
|---|---|
| `--lum-vien` | `rgba(232,220,204,.10)` |
| `--lum-vien-manh` | `rgba(232,220,204,.18)` |

### Trạng thái

Son là đỏ, mà đỏ cũng là màu báo lỗi. Tách bằng **cả sắc độ lẫn cách trình bày**:

| vai trò | token | giá trị | phân biệt bằng |
|---|---|---|---|
| lỗi | `--lum-loi` | `#d9604a` | sáng và bão hoà hơn son rõ rệt; **luôn kèm icon**; nền tint, không bao giờ là nút đặc |
| thành công | `--lum-ok` | `#7d9468` | lá trầm, không phải `green-400` |
| lưu ý | `--lum-luuy` | `#c2903f` | nghệ |

Bất biến: **nút chính luôn là nền son đặc; lỗi luôn là chữ/viền `--lum-loi` kèm icon.** Khác
vai, khác cách vẽ — không bao giờ trông giống nhau dù cùng họ đỏ.

## 4. Kiến trúc

- `tokens.css` nạp **trước** thẻ `<style>` của từng trang.
- Các biến cũ của từng trang (`--accent`, `--bg`, `--text`, `--border`…) **giữ nguyên tên**
  nhưng trỏ sang token mới. Nhờ vậy 22 chỗ đang dùng biến đúng ngay ở bước 1 mà không phải
  sửa chỗ dùng.
- Hai khối `:root` chồng nhau trong `index.html` gộp làm một.
- Màu hardcode trong JS đổi sang đọc token qua `getComputedStyle` nếu cần động, hoặc hằng số
  đặt cạnh token nếu tĩnh.

## 5. Thứ tự thực hiện

Mỗi bước một commit, mỗi bước có ảnh trước/sau chụp bằng Playwright.

| # | việc | số chỗ tím |
|---|---|---|
| 1 | `tokens.css` + nạp vào 13 trang + alias biến cũ | ăn ngay 22 |
| 2 | `index.html` — gồm bỏ glow, bỏ pill ✦, bỏ gradient chữ | 53 |
| 3 | `auth/index.html` | 24 |
| 4 | `portal/` × 4 file | 28+ |
| 5 | `admin/index.html` + `portal/js/admin.js` | 17 + 5 |
| 6 | `legal.css` + `subscription.css` + `terms` + `privacy` | 5 |

Bước 2 làm trước vì đó là mặt tiền và là chỗ tập trung nhiều nhất; nếu bảng màu sai thì sai
lộ ra sớm nhất ở đó.

## 6. Test

Vỏ ứng dụng **hiện không có một test thị giác nào** — `tests/visual/universes.spec.js` chỉ
phủ 4 universe. Đổi 127 chỗ màu mà không có ảnh đối chiếu thì "có làm vỡ layout không" là
câu không trả lời được.

Thêm hai thứ:

1. **`tests/visual/chrome.spec.js`** — dựng theo đúng khuôn `universes.spec.js`: 13 trang ×
   4 viewport; chụp ảnh đính vào report; chặn tràn ngang; chặn lỗi console. Trang cần đăng
   nhập (`portal`, `admin`) chụp ở trạng thái chưa đăng nhập hoặc qua tài khoản test.

2. **Guard regex chống trôi** — thêm vào `tests/` một test kiểu `tmdt-compliance`: khẳng
   định **không còn hex tím nào** (`8b5cf6`, `7c3aed`, `a78bfa`, `c4b5fd`, `6d28d9`) trong
   13 file chrome, và `tokens.css` có đủ các token đã liệt kê ở mục 3. Đây là thứ giữ cho
   bảng màu không trôi lại sau vài tháng.

Guard phải **trừ ra** hai file cố ý giữ màu tím: `galaxy-setup.js` (màu theme mặc định của
galaxy) và `galaxy-viewer.js` (màu tinh vân của bản xem trước galaxy). Trừ bằng danh sách
tường minh có ghi lý do, không trừ bằng pattern thư mục — để lần sau ai thêm file mới vào
`portal/js/` vẫn bị guard bắt.

## 7. Rủi ro

| rủi ro | xử lý |
|---|---|
| `tmdt-compliance.test.js` khẳng định **cấu trúc** trang legal (link `/terms/`, `/privacy/`, `/refund-policy/`, `/support/`, `/owner-info/`, `/payment-policy/`) | Chỉ đổi màu, **không đụng markup** của các trang này. Chạy `npm run test:tmdt` sau mỗi bước. |
| Đã kiểm: **không test nào ghim hex tím**, và `tmdt` chỉ khẳng định lời gọi `safeThemeColor(colors.primary`, không khẳng định giá trị màu | Đổi màu chrome an toàn về mặt test |
| Đỏ thương hiệu lẫn với đỏ báo lỗi | Tách sắc độ + bắt buộc icon cho lỗi (mục 3) |
| Merge vào `main` là **deploy thẳng production** (`.github/workflows/deploy.yml`) | Làm trên nhánh `agent/son-mai-palette`, chỉ merge khi cả `npm test` lẫn `chrome.spec.js` xanh |
| Trang cần đăng nhập khó chụp tự động | Chụp trạng thái chưa đăng nhập trước; nếu thiếu phủ thì dùng tài khoản test qua biến môi trường, theo đúng cách `LUMORA_TEST_GALAXY` đang làm |

## 8. Định nghĩa hoàn thành

- [ ] `tokens.css` tồn tại, có đủ token mục 3, được 13 trang nạp.
- [ ] Không còn hex tím trong 13 file chrome (trừ `galaxy-setup.js` cố ý giữ).
- [ ] Glow tím dưới nút, pill ✦, gradient chữ nhấn: đã bỏ.
- [ ] `index.html` chỉ còn một khối `:root`.
- [ ] `chrome.spec.js` xanh trên Firefox + Chromium, 4 viewport.
- [ ] Guard regex chống trôi xanh.
- [ ] `npm test` 8/8 suite, đặc biệt `test:tmdt`.
- [ ] Universe không đổi một pixel nào — `universes.spec.js` vẫn 40/40.
- [ ] Galaxy người dùng chưa chọn theme vẫn ra `#8b5cf6` như cũ.
- [ ] `galaxy-viewer.js` không đổi một dòng nào — bản xem trước galaxy giữ nguyên tinh vân.
