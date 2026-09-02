# Bảng màu sơn mài cho vỏ Lumora — Kế hoạch triển khai

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay bảng màu mặc định Tailwind (violet-500 trên nền gần đen) của 13 file HTML vỏ ứng dụng bằng hệ token sơn mài trầm, không đụng một pixel nào của galaxy hay universe.

**Architecture:** Một file token dùng chung `public/shared/css/tokens.css` nạp trước `<style>` của từng trang. Biến `:root` sẵn có của mỗi trang giữ nguyên tên nhưng trỏ sang token mới, nên 22 chỗ đang dùng biến tự đúng; 105 chỗ hardcode thay thủ công theo bảng ánh xạ. Một guard test regex có danh sách `PENDING` thu hẹp dần sau mỗi task — mỗi task làm đỏ rồi làm xanh đúng một file.

**Tech Stack:** HTML/CSS thuần (không bundler), `node --test` cho guard, Playwright cho ảnh đối chiếu.

**Spec:** `docs/superpowers/specs/2026-09-02-son-mai-palette-design.md`

**Nhánh:** `agent/son-mai-palette` (đã tạo, spec đã commit)

---

## Cấu trúc file

| file | trách nhiệm | tạo/sửa |
|---|---|---|
| `public/shared/css/tokens.css` | Nguồn sự thật duy nhất cho màu vỏ. Một khối `:root`. | Tạo |
| `tests/chrome-palette.test.js` | Guard regex: file đã di trú không được còn hex tím; tokens.css phải đủ token. | Tạo |
| `tests/visual/chrome.spec.js` | Chụp 13 trang × 4 viewport, chặn tràn ngang, chặn lỗi console. | Tạo |
| `tests/visual/helpers/chrome.js` | Danh sách trang + tiện ích riêng cho vỏ. Tách khỏi `helpers/universe.js` vì vỏ không có canvas/telemetry. | Tạo |
| `public/index.html` | Gộp hai `:root` thành một, alias sang token, bỏ glow/pill ✦/gradient chữ. | Sửa |
| `public/auth/index.html` … `public/portal/*.html` … | Alias + thay hardcode. | Sửa |
| `public/portal/js/admin.js` | 5 chỗ màu giao diện hardcode. | Sửa |
| `public/shared/css/legal.css`, `subscription.css` | Alias + thay hardcode. | Sửa |
| `package.json` | Thêm `test:chrome`, nối vào `npm test`. | Sửa |

**KHÔNG đụng:** `public/abyss/**`, `aurora/**`, `fall/**`, `galaxy-moon/**`, `story/**`,
`public/portal/js/galaxy-viewer.js`, `public/portal/js/galaxy-setup.js`.

---

## Bảng ánh xạ màu (dùng cho mọi task di trú)

| màu cũ | thay bằng | ghi chú |
|---|---|---|
| `#8b5cf6`, `#7c3aed`, `#6d28d9` | `var(--lum-son)` | mọi sắc violet đậm về một token |
| `#a78bfa`, `#c4b5fd`, `#c8b8ff`, `#9a70ff` | `var(--lum-dong)` | violet nhạt từng dùng làm nhấn → đồng |
| `#ede9fe`, `#ede9f8`, `#f1edf9` | `var(--lum-trung)` | chữ chính |
| `#04040c`, `#05050d`, `#06060e`, `#060610`, `#020207` | `var(--lum-nen)` | gom 5 sắc đen về một |
| `#0b0a15`, `#100d1e`, `#0d0d1e` | `var(--lum-mat)` | mặt thẻ |
| `rgba(139,92,246,.28)` / `rgba(154,112,255,.34)` (viền) | `var(--lum-vien-manh)` | |
| `rgba(139,92,246,.1)` / `.045` (nền tint) | `var(--lum-son-mo)` | |
| `rgba(255,255,255,.06)` / `.075` (viền) | `var(--lum-vien)` | |
| `#f87171`, `#fca5a5`, `#ef4444` | `var(--lum-loi)` | |
| `#4ade80`, `#6ee7b7` | `var(--lum-ok)` | |
| `#fbbf24`, `#ffd600` | `var(--lum-luuy)` | |
| `box-shadow: … rgba(139,92,246,…)` | **XOÁ HẲN dòng box-shadow** | glow màu — không remap |
| `linear-gradient(90deg,#8b5cf6,#7c3aed)` | `var(--lum-son)` | gradient nút → nền đặc |

---

## Task 1: Harness chụp ảnh cho vỏ

Làm trước tiên để có ảnh "trước" và để mọi task sau có lưới an toàn phát hiện vỡ layout.

**Files:**
- Create: `tests/visual/helpers/chrome.js`
- Create: `tests/visual/chrome.spec.js`

- [ ] **Step 1: Tạo helper danh sách trang**

Create `tests/visual/helpers/chrome.js`:

```js
// Vỏ ứng dụng — KHÔNG phải universe. Không có canvas, không có telemetry, nên
// helper này cố ý tách khỏi helpers/universe.js thay vì nhét thêm nhánh if vào đó.
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

// 13 trang vỏ. `auth` cần bỏ qua lỗi mạng vì nó gọi API khi chưa đăng nhập.
// portal/admin ở trạng thái CHƯA đăng nhập sẽ chuyển hướng hoặc hiện màn trống —
// vẫn chụp được, và đó chính là màn hình người dùng mới nhìn thấy đầu tiên.
const CHROME_PAGES = [
  { name: 'landing', path: '/' },
  { name: 'auth', path: '/auth/' },
  { name: 'portal', path: '/portal/' },
  { name: 'portal-galaxy', path: '/portal/galaxy.html' },
  { name: 'portal-galaxy-setup', path: '/portal/galaxy-setup.html' },
  { name: 'portal-story-setup', path: '/portal/story-setup.html' },
  { name: 'admin', path: '/admin/' },
  { name: 'terms', path: '/terms/' },
  { name: 'privacy', path: '/privacy/' },
  { name: 'support', path: '/support/' },
  { name: 'payment-policy', path: '/payment-policy/' },
  { name: 'refund-policy', path: '/refund-policy/' },
  { name: 'owner-info', path: '/owner-info/' },
];

const IGNORED = [
  /favicon/i,
  /fonts\.googleapis|fonts\.gstatic/i,
  // Trang vỏ gọi API khi chưa đăng nhập: 401 là hành vi ĐÚNG, không phải lỗi.
  /\/auth\/me|\/galaxies|\/subscription/i,
];

function collectErrors(page) {
  const errors = [];
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (IGNORED.some(p => p.test(text))) return;
    errors.push(`console: ${text}`);
  });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', request => {
    const url = request.url();
    if (IGNORED.some(p => p.test(url))) return;
    errors.push(`requestfailed: ${url}`);
  });
  return errors;
}

async function horizontalOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
}

// Đếm pixel còn ngả tím trong ảnh chụp. Đây là phép đo THỊ GIÁC, bổ sung cho
// guard regex trên source: regex bắt hex viết thẳng, phép đo này bắt màu tím sinh
// ra từ gradient, từ JS, hoặc từ file mà guard chưa phủ.
async function violetPixelRatio(page) {
  return page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    const w = canvas.width = 240;
    const h = canvas.height = 150;
    const ctx = canvas.getContext('2d');
    // html2canvas không có sẵn; thay vào đó lấy mẫu màu nền thực tế của các phần
    // tử lớn nhất trang. Đủ để bắt "còn mảng tím".
    const nodes = [...document.querySelectorAll('body, header, main, section, button, a')].slice(0, 400);
    let violet = 0; let total = 0;
    for (const el of nodes) {
      const cs = getComputedStyle(el);
      for (const prop of ['backgroundColor', 'color', 'borderTopColor']) {
        const m = cs[prop].match(/rgba?\((\d+), *(\d+), *(\d+)/);
        if (!m) continue;
        const [r, g, b] = [+m[1], +m[2], +m[3]];
        if (r + g + b < 30) continue; // gần đen, không tính
        total += 1;
        // Tím = lam trội rõ, lục lép, đỏ ở giữa
        if (b > r + 25 && b > g + 45 && r > g) violet += 1;
      }
    }
    return total ? violet / total : 0;
  });
}

module.exports = { VIEWPORTS, CHROME_PAGES, collectErrors, horizontalOverflow, violetPixelRatio };
```

- [ ] **Step 2: Tạo spec**

Create `tests/visual/chrome.spec.js`:

```js
const { test, expect } = require('@playwright/test');
const path = require('node:path');
const {
  VIEWPORTS, CHROME_PAGES, collectErrors, horizontalOverflow, violetPixelRatio,
} = require('./helpers/chrome');

const SHOTS = path.join(__dirname, '.shots');

test.describe('vỏ ứng dụng', () => {
  for (const pageDef of CHROME_PAGES) {
    for (const viewport of VIEWPORTS) {
      test(`${pageDef.name} · ${viewport.name}`, async ({ page }, testInfo) => {
        await page.setViewportSize(viewport);
        const errors = collectErrors(page);

        await page.goto(pageDef.path, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1200);

        const shot = path.join(SHOTS, testInfo.project.name, `chrome-${pageDef.name}-${viewport.name}.png`);
        await page.screenshot({ path: shot, fullPage: false });
        await testInfo.attach(`${pageDef.name}-${viewport.name}`, { path: shot, contentType: 'image/png' });

        const overflow = await horizontalOverflow(page);
        expect(overflow, `tràn ngang ${overflow}px`).toBeLessThanOrEqual(1);

        expect(errors, `lỗi console:\n${errors.join('\n')}`).toEqual([]);
      });
    }
  }
});
```

- [ ] **Step 3: Chạy để lấy ảnh "trước" và xác nhận harness xanh trên code hiện tại**

Run: `npx playwright test chrome.spec.js --project=firefox`
Expected: 52 test (13 trang × 4 viewport) PASS. Nếu có trang đỏ vì tràn ngang hoặc lỗi console — đó là lỗi CÓ SẴN, ghi lại vào commit message, **không sửa trong task này**.

- [ ] **Step 4: Commit**

```bash
git add tests/visual/helpers/chrome.js tests/visual/chrome.spec.js
git commit -m "test(visual): harness chụp ảnh cho 13 trang vỏ ứng dụng

Vỏ chưa từng có test thị giác — universes.spec.js chỉ phủ 4 universe.
Chạy trước khi đổi màu để có ảnh đối chiếu."
```

---

## Task 2: tokens.css + guard test

**Files:**
- Create: `public/shared/css/tokens.css`
- Create: `tests/chrome-palette.test.js`
- Modify: `package.json`

- [ ] **Step 1: Viết guard test TRƯỚC (sẽ đỏ)**

Create `tests/chrome-palette.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

// Mọi file vỏ. Task di trú sẽ xoá dần khỏi PENDING — mỗi lần xoá một dòng là
// test đỏ, sửa file đó xong là xanh lại.
const CHROME_FILES = [
  'public/index.html',
  'public/auth/index.html',
  'public/portal/index.html',
  'public/portal/galaxy.html',
  'public/portal/galaxy-setup.html',
  'public/portal/story-setup.html',
  'public/admin/index.html',
  'public/terms/index.html',
  'public/privacy/index.html',
  'public/support/index.html',
  'public/payment-policy/index.html',
  'public/refund-policy/index.html',
  'public/owner-info/index.html',
  'public/shared/css/legal.css',
  'public/shared/css/subscription.css',
  'public/portal/js/admin.js',
];

// Chưa di trú. Xoá dần theo Task 3..7. Khi rỗng là xong.
const PENDING = new Set([
  'public/index.html',
  'public/auth/index.html',
  'public/portal/index.html',
  'public/portal/galaxy.html',
  'public/portal/galaxy-setup.html',
  'public/portal/story-setup.html',
  'public/admin/index.html',
  'public/terms/index.html',
  'public/privacy/index.html',
  'public/support/index.html',
  'public/payment-policy/index.html',
  'public/refund-policy/index.html',
  'public/owner-info/index.html',
  'public/shared/css/legal.css',
  'public/shared/css/subscription.css',
  'public/portal/js/admin.js',
]);

// CỐ Ý giữ màu tím — đây là màu HIỂN THỊ CỦA GALAXY, không phải màu giao diện.
// Liệt kê tường minh kèm lý do, KHÔNG trừ bằng pattern thư mục: để file mới thêm
// vào portal/js/ vẫn bị guard bắt.
const KEEP_VIOLET = {
  'public/portal/js/galaxy-setup.js': 'màu theme mặc định của galaxy người dùng',
  'public/portal/js/galaxy-viewer.js': 'màu tinh vân của bản xem trước galaxy',
};

const VIOLET = /#(?:8b5cf6|7c3aed|a78bfa|c4b5fd|6d28d9|c8b8ff|9a70ff)|rgba\(\s*139\s*,\s*92\s*,\s*246|rgba\(\s*154\s*,\s*112\s*,\s*255|rgba\(\s*124\s*,\s*58\s*,\s*237/i;

test('file vỏ đã di trú không còn hex tím nào', () => {
  const doiSot = [];
  for (const file of CHROME_FILES) {
    if (PENDING.has(file)) continue;
    const source = read(file);
    if (VIOLET.test(source)) doiSot.push(file);
  }
  assert.deepEqual(doiSot, [], `còn màu tím trong: ${doiSot.join(', ')}`);
});

test('file giữ màu galaxy vẫn còn nguyên — không bị di trú nhầm', () => {
  for (const [file, lyDo] of Object.entries(KEEP_VIOLET)) {
    assert.ok(VIOLET.test(read(file)), `${file} mất màu tím nhưng phải giữ: ${lyDo}`);
  }
});

test('tokens.css khai báo đủ token của spec', () => {
  const css = read('public/shared/css/tokens.css');
  const required = [
    '--lum-nen', '--lum-mat', '--lum-mat-noi',
    '--lum-trung', '--lum-trung-mo', '--lum-trung-nhat',
    '--lum-son', '--lum-son-sang', '--lum-son-mo',
    '--lum-dong', '--lum-dong-mo',
    '--lum-vien', '--lum-vien-manh',
    '--lum-loi', '--lum-ok', '--lum-luuy',
  ];
  for (const token of required) {
    assert.match(css, new RegExp(`${token}\\s*:`), `thiếu token ${token}`);
  }
});

test('universe không bị đụng vào', () => {
  // Bất biến của spec: đổi màu GIAO DIỆN, không đổi màu HIỂN THỊ CỦA GALAXY.
  const abyss = read('public/abyss/js/core/palette.js');
  assert.match(abyss, /deepWater: '#02151B'/, 'bảng màu abyss đã bị đổi');
});
```

- [ ] **Step 2: Chạy để xác nhận đỏ đúng chỗ**

Run: `node --test tests/chrome-palette.test.js`
Expected: FAIL — `tokens.css` chưa tồn tại (`ENOENT`). Ba test kia chưa chạy tới.

- [ ] **Step 3: Tạo tokens.css**

Create `public/shared/css/tokens.css`:

```css
/* ---------------------------------------------------------------------------
 * Bảng màu sơn mài — nguồn sự thật duy nhất cho VỎ ứng dụng Lumora.
 *
 * Sơn mài có bốn chất: đen (nền), son (đỏ chu), vàng kim, vỏ trứng (trắng ngà).
 * Sơn ta không có màu trắng nên nghệ nhân dán vỏ trứng thật — vì vậy chữ ở đây
 * KHÔNG BAO GIỜ dùng #fff, mà dùng --lum-trung.
 *
 * Bản TRẦM, không phải bản rực: đồ sơn mài cũ lên nước thì son ngả nâu, vàng
 * xỉn thành đồng. Nền ngả ấm (#14090a) vì mắt ít nhạy với bước sóng dài nên đen
 * ngả nâu đỡ mỏi hơn đen ngả xanh/tím.
 *
 * File này KHÔNG áp cho universe (abyss/aurora/fall/galaxy-moon/story) — mỗi
 * universe có thế giới màu riêng, và vai trò của bảng màu này là làm KHUNG cho
 * chúng, không phải làm thế giới thứ sáu.
 * ------------------------------------------------------------------------- */
:root {
  /* Đen — nền */
  --lum-nen: #14090a;
  --lum-mat: #1f1012;
  --lum-mat-noi: #2a1719;

  /* Vỏ trứng — chữ */
  --lum-trung: #e8dccc;
  --lum-trung-mo: rgba(232, 220, 204, .62);
  --lum-trung-nhat: rgba(232, 220, 204, .40);

  /* Son — hành động */
  --lum-son: #9e4438;
  --lum-son-sang: #b8564a;
  --lum-son-mo: rgba(158, 68, 56, .14);

  /* Đồng — nét và nhấn */
  --lum-dong: #b99a5e;
  --lum-dong-mo: rgba(185, 154, 94, .16);

  /* Đường nét */
  --lum-vien: rgba(232, 220, 204, .10);
  --lum-vien-manh: rgba(232, 220, 204, .18);

  /* Trạng thái.
   * Son là đỏ, mà đỏ cũng là màu báo lỗi. Tách bằng CẢ sắc độ LẪN cách vẽ:
   * nút chính luôn là nền son đặc; lỗi luôn là chữ/viền --lum-loi kèm icon,
   * trên nền tint, KHÔNG BAO GIỜ là nút đặc. Khác vai, khác cách vẽ. */
  --lum-loi: #d9604a;
  --lum-ok: #7d9468;
  --lum-luuy: #c2903f;
}
```

- [ ] **Step 4: Chạy lại guard**

Run: `node --test tests/chrome-palette.test.js`
Expected: 4/4 PASS. Test "đã di trú" xanh một cách rỗng (PENDING đang chứa mọi file) — đúng như thiết kế.

- [ ] **Step 5: Nạp tokens.css vào 13 trang**

Với mỗi file trong danh sách dưới đây, chèn dòng này **ngay trước** thẻ `<style>` đầu tiên:

```html
  <link rel="stylesheet" href="/shared/css/tokens.css">
```

Danh sách: `public/index.html`, `public/auth/index.html`, `public/portal/index.html`,
`public/portal/galaxy.html`, `public/portal/galaxy-setup.html`, `public/portal/story-setup.html`,
`public/admin/index.html`, `public/terms/index.html`, `public/privacy/index.html`,
`public/support/index.html`, `public/payment-policy/index.html`, `public/refund-policy/index.html`,
`public/owner-info/index.html`.

Kiểm bằng: `grep -L "tokens.css" public/index.html public/auth/index.html public/portal/*.html public/admin/index.html public/terms/index.html public/privacy/index.html public/support/index.html public/payment-policy/index.html public/refund-policy/index.html public/owner-info/index.html`
Expected: không in ra file nào.

- [ ] **Step 6: Thêm script test và nối vào npm test**

Modify `package.json` — thêm vào `scripts`:

```json
"test:chrome": "node --test tests/chrome-palette.test.js",
```

Và sửa `"test"` để nối `test:chrome` vào cuối chuỗi hiện có:

```json
"test": "npm run test:database && npm run test:soundscape && npm run test:story-emotion && npm run test:upload && npm run test:activity && npm run test:tmdt && npm run test:abyss && npm run test:errors && npm run test:chrome",
```

- [ ] **Step 7: Chạy toàn bộ test**

Run: `npm test`
Expected: 9 suite, 0 fail.

- [ ] **Step 8: Commit**

```bash
git add public/shared/css/tokens.css tests/chrome-palette.test.js package.json public/index.html public/auth/index.html public/portal/index.html public/portal/galaxy.html public/portal/galaxy-setup.html public/portal/story-setup.html public/admin/index.html public/terms/index.html public/privacy/index.html public/support/index.html public/payment-policy/index.html public/refund-policy/index.html public/owner-info/index.html
git commit -m "feat(ui): hệ token màu sơn mài + guard chống trôi

tokens.css là nguồn sự thật duy nhất cho màu vỏ. Guard test có danh sách
PENDING thu hẹp dần: mỗi task di trú xoá một dòng, làm test đỏ rồi xanh.

Hai file cố ý giữ màu tím (galaxy-setup.js, galaxy-viewer.js) được liệt kê
tường minh kèm lý do — đó là màu hiển thị của galaxy, không phải màu UI."
```

---

## Task 3: `public/index.html` — mặt tiền

Làm trước vì đây là chỗ tập trung nhiều nhất (53 chỗ) và là nơi bảng màu sai sẽ lộ ra sớm nhất.

**Files:**
- Modify: `public/index.html`
- Modify: `tests/chrome-palette.test.js` (xoá 1 dòng khỏi PENDING)

- [ ] **Step 1: Xoá `public/index.html` khỏi PENDING để test đỏ**

Trong `tests/chrome-palette.test.js`, xoá dòng `'public/index.html',` khỏi `const PENDING = new Set([...])`. Giữ nguyên trong `CHROME_FILES`.

- [ ] **Step 2: Chạy để xác nhận đỏ**

Run: `node --test tests/chrome-palette.test.js`
Expected: FAIL — `còn màu tím trong: public/index.html`

- [ ] **Step 3: Gộp hai khối `:root` thành một, alias sang token**

`public/index.html` hiện có **hai** khối `:root` khai báo trùng `--bg`, `--accent`, `--text`, `--border`, `--glass`. Xoá cả hai, thay bằng một khối duy nhất:

```css
    /* Alias sang tokens.css — giữ nguyên tên biến cũ để 10 chỗ đang dùng var()
     * tự đúng mà không phải sửa chỗ dùng. Trước đây file này có HAI khối :root
     * khai báo trùng --bg (#04040c rồi #05050d); đã gộp làm một. */
    :root {
      --bg: var(--lum-nen);
      --surface: var(--lum-mat);
      --surface-strong: var(--lum-mat-noi);
      --accent: var(--lum-son);
      --accent-strong: var(--lum-son-sang);
      --accent-light: var(--lum-dong);
      --accent-dim: var(--lum-son-mo);
      --accent-glow: var(--lum-son-mo);
      --text: var(--lum-trung);
      --text-sub: var(--lum-trung-mo);
      --text-muted: var(--lum-trung-nhat);
      --border: var(--lum-vien);
      --border-accent: var(--lum-vien-manh);
      --glass: rgba(232, 220, 204, .032);
      --glass-hover: rgba(232, 220, 204, .055);
      --page: min(1180px, calc(100vw - 64px));
      --r: 24px;
      --r-sm: 12px;
    }
```

- [ ] **Step 4: Xoá 4 dòng glow tím**

Tìm và **xoá hẳn** (không thay bằng gì) mọi dòng khớp `box-shadow` có `rgba(139,92,246`:

```
box-shadow: 0 6px 20px rgba(139,92,246,0.35)
box-shadow: 0 10px 28px rgba(139,92,246,0.4)
box-shadow: 0 0 60px rgba(139,92,246,0.1), inset 0 1px 0 rgba(255,255,255,0.04)
box-shadow: 0 16px 48px rgba(139,92,246,0.2)
```

Riêng dòng thứ ba giữ lại phần `inset`:

```css
box-shadow: inset 0 1px 0 rgba(232, 220, 204, .04);
```

Kiểm: `grep -c "box-shadow.*139,92,246" public/index.html` → `0`

- [ ] **Step 5: Bỏ pill ✦ ở hero**

Tìm phần tử badge chứa `✦ GỬI ĐẾN NGƯỜI BẠN MUỐN` (hoặc `data-i18n` tương ứng). Bỏ `border`, `border-radius`, và ký tự `✦`; thay bằng một gạch dẫn:

```css
    .hero-eyebrow {
      display: flex;
      align-items: center;
      gap: 14px;
      font-size: 11px;
      letter-spacing: .2em;
      text-transform: uppercase;
      color: var(--text-sub);
      margin-bottom: 26px;
      /* Bỏ border + border-radius: hình pill bo tròn có sparkle dẫn đầu là badge
       * "AI-powered" kinh điển — dấu hiệu AI rõ nhất trên trang sau cái glow. */
    }
    .hero-eyebrow::before {
      content: '';
      width: 34px;
      height: 1px;
      background: var(--accent-light);
      opacity: .8;
    }
```

Trong HTML, xoá ký tự `✦` khỏi nội dung badge và đổi class thành `hero-eyebrow`.

- [ ] **Step 6: Bỏ gradient trên dòng chữ nhấn**

Tìm quy tắc tô gradient cho dòng nghiêng (`background: linear-gradient(...)` + `-webkit-background-clip: text`). Thay bằng:

```css
      color: var(--accent-light);
```

Xoá các dòng `background:`, `-webkit-background-clip:`, `background-clip:`, `color: transparent`.

- [ ] **Step 7: Thay hardcode còn lại theo bảng ánh xạ**

Áp bảng ánh xạ ở đầu kế hoạch cho mọi hex/rgba còn sót trong file.

Kiểm: `grep -nE "#(8b5cf6|7c3aed|a78bfa|c4b5fd|6d28d9)|139, *92, *246" public/index.html`
Expected: không in ra gì.

- [ ] **Step 8: Chạy guard**

Run: `node --test tests/chrome-palette.test.js`
Expected: 4/4 PASS.

- [ ] **Step 9: Chụp ảnh và NHÌN**

Run: `npx playwright test chrome.spec.js --project=firefox -g "landing"`
Expected: 4/4 PASS.

Mở `tests/visual/.shots/firefox/chrome-landing-desktop.png` và **nhìn thật**. Kiểm:
nút chính là nền son đặc không có bóng màu; badge là gạch dẫn không phải pill; dòng
nghiêng một màu đồng; không còn vệt tím nào. `npm test` xanh không thay được mắt.

- [ ] **Step 10: Commit**

```bash
git add public/index.html tests/chrome-palette.test.js
git commit -m "feat(ui): trang chủ sang bảng màu sơn mài

Gộp hai khối :root chồng nhau thành một. Bỏ 4 glow tím dưới nút, bỏ pill
sparkle ở hero, bỏ gradient trên chữ nhấn — ba dấu hiệu AI mạnh hơn cả
bản thân màu tím."
```

---

## Task 4: `public/auth/index.html`

**Files:**
- Modify: `public/auth/index.html`
- Modify: `tests/chrome-palette.test.js`

- [ ] **Step 1: Xoá `'public/auth/index.html',` khỏi PENDING**

- [ ] **Step 2: Chạy để xác nhận đỏ**

Run: `node --test tests/chrome-palette.test.js`
Expected: FAIL — `còn màu tím trong: public/auth/index.html`

- [ ] **Step 3: Alias khối `:root` (5 biến)**

Thay khối `:root` hiện có bằng:

```css
    :root {
      --bg: var(--lum-nen);
      --accent: var(--lum-son);
      --accent-light: var(--lum-dong);
      --text: var(--lum-trung);
      --text-sub: var(--lum-trung-mo);
      --border: var(--lum-vien);
    }
```

Giữ nguyên mọi biến không liên quan đến màu (bo góc, khoảng cách) đang có trong khối cũ.

- [ ] **Step 4: Thay 19 chỗ hardcode còn lại theo bảng ánh xạ**

Chú ý đặc biệt: thông báo lỗi đăng nhập đang dùng `#f87171` → `var(--lum-loi)`.
Đảm bảo mọi chỗ báo lỗi **có icon đi kèm** (spec mục 3) — nếu chưa có, thêm ký tự cảnh
báo hoặc phần tử icon vào cùng khối. Đây là thứ tách đỏ-lỗi khỏi đỏ-thương-hiệu.

- [ ] **Step 5: Xoá glow tím nếu có**

Kiểm: `grep -n "box-shadow.*139,92,246" public/auth/index.html` — xoá hẳn dòng nào khớp.

- [ ] **Step 6: Chạy guard + chụp ảnh**

Run: `node --test tests/chrome-palette.test.js && npx playwright test chrome.spec.js --project=firefox -g "auth"`
Expected: guard 4/4 PASS, visual 4/4 PASS.

Mở `tests/visual/.shots/firefox/chrome-auth-desktop.png` và nhìn: form đọc được,
nút son đặc, chữ lỗi phân biệt rõ với nút.

- [ ] **Step 7: Commit**

```bash
git add public/auth/index.html tests/chrome-palette.test.js
git commit -m "feat(ui): trang đăng nhập sang bảng màu sơn mài

Chữ báo lỗi dùng --lum-loi (sáng hơn son rõ rệt) kèm icon, để không lẫn
với nút chính vốn cũng thuộc họ đỏ."
```

---

## Task 5: `public/portal/` — 4 file

**Files:**
- Modify: `public/portal/index.html`, `galaxy.html`, `galaxy-setup.html`, `story-setup.html`
- Modify: `tests/chrome-palette.test.js`

- [ ] **Step 1: Xoá cả 4 dòng portal khỏi PENDING**

Xoá `'public/portal/index.html',`, `'public/portal/galaxy.html',`,
`'public/portal/galaxy-setup.html',`, `'public/portal/story-setup.html',`.

- [ ] **Step 2: Chạy để xác nhận đỏ**

Run: `node --test tests/chrome-palette.test.js`
Expected: FAIL, liệt kê 4 file portal.

- [ ] **Step 3: Alias `:root` của `portal/index.html` (5 biến)**

```css
    :root {
      --bg: var(--lum-nen);
      --surface: var(--lum-mat);
      --accent: var(--lum-son);
      --accent-light: var(--lum-dong);
      --text: var(--lum-trung);
      --text-sub: var(--lum-trung-mo);
      --border: var(--lum-vien);
    }
```

- [ ] **Step 4: Thay hardcode trong cả 4 file theo bảng ánh xạ**

**KHÔNG đụng** `galaxy-setup.html` ở phần khung xem trước galaxy (`#galaxy-frame`,
`.theme-preview-*`) — đó là nơi hiển thị màu theme của người dùng. Chỉ đổi màu của
chính giao diện setup: nhãn, nút, viền, tab.

- [ ] **Step 5: Kiểm không phá guard TMDT**

Run: `npm run test:tmdt`
Expected: 46/46 PASS. `tmdt-compliance` khẳng định cấu trúc `galaxy-setup.html`
(`id="galaxy-frame"`, `.theme-preview-memory`, `data-i18n="setupThemeTitle"`) — nếu đỏ
là đã đụng markup, phải hoàn nguyên phần markup đó.

- [ ] **Step 6: Chạy guard + chụp ảnh**

Run: `node --test tests/chrome-palette.test.js && npx playwright test chrome.spec.js --project=firefox -g "portal"`
Expected: guard 4/4 PASS, visual 16/16 PASS.

Mở 4 ảnh `chrome-portal*-desktop.png` và nhìn: khung xem trước galaxy **vẫn tím như cũ**
(đó là màu galaxy, đúng), phần giao diện quanh nó đã sang son.

- [ ] **Step 7: Commit**

```bash
git add public/portal/index.html public/portal/galaxy.html public/portal/galaxy-setup.html public/portal/story-setup.html tests/chrome-palette.test.js
git commit -m "feat(ui): portal sang bảng màu sơn mài

Khung xem trước galaxy giữ nguyên màu — đó là màu kỷ vật của người dùng,
không phải màu sản phẩm."
```

---

## Task 6: `admin` — trang + JS

`admin/index.html` là file tệ nhất: 17 chỗ tím, **không dùng biến lần nào**.

**Files:**
- Modify: `public/admin/index.html`, `public/portal/js/admin.js`
- Modify: `tests/chrome-palette.test.js`

- [ ] **Step 1: Xoá `'public/admin/index.html',` và `'public/portal/js/admin.js',` khỏi PENDING**

- [ ] **Step 2: Chạy để xác nhận đỏ**

Run: `node --test tests/chrome-palette.test.js`
Expected: FAIL, liệt kê 2 file.

- [ ] **Step 3: Thêm khối `:root` cho `admin/index.html`**

File này chưa có `:root` nào. Thêm ngay đầu thẻ `<style>`:

```css
    :root {
      --bg: var(--lum-nen);
      --surface: var(--lum-mat);
      --accent: var(--lum-son);
      --accent-light: var(--lum-dong);
      --text: var(--lum-trung);
      --text-sub: var(--lum-trung-mo);
      --border: var(--lum-vien);
    }
```

- [ ] **Step 4: Thay 17 chỗ hardcode bằng `var(...)` theo bảng ánh xạ**

- [ ] **Step 5: Sửa 5 chỗ màu trong `portal/js/admin.js`**

Các chỗ hiện tại:

```js
makeSpanBadge(u.subscription.plan.toUpperCase(), 'rgba(139,92,246,0.2)', '#a78bfa')
makeEl('strong', 'color:#c4b5fd')
makeEl('h3', 'color:#c4b5fd;font-size:15px;margin-bottom:18px')
makeSpanBadge(subscription.plan.toUpperCase(), 'rgba(139,92,246,0.2)', '#a78bfa')
makeSpanBadge(p.plan.toUpperCase(), 'rgba(139,92,246,0.2)', '#a78bfa')
```

Thay thành:

```js
makeSpanBadge(u.subscription.plan.toUpperCase(), 'var(--lum-dong-mo)', 'var(--lum-dong)')
makeEl('strong', 'color:var(--lum-dong)')
makeEl('h3', 'color:var(--lum-dong);font-size:15px;margin-bottom:18px')
makeSpanBadge(subscription.plan.toUpperCase(), 'var(--lum-dong-mo)', 'var(--lum-dong)')
makeSpanBadge(p.plan.toUpperCase(), 'var(--lum-dong-mo)', 'var(--lum-dong)')
```

`var()` dùng được trong `style` inline vì token khai báo ở `:root` của tài liệu.

- [ ] **Step 6: Chạy guard + chụp ảnh**

Run: `node --test tests/chrome-palette.test.js && npx playwright test chrome.spec.js --project=firefox -g "admin"`
Expected: guard 4/4 PASS, visual 4/4 PASS.

- [ ] **Step 7: Commit**

```bash
git add public/admin/index.html public/portal/js/admin.js tests/chrome-palette.test.js
git commit -m "feat(ui): admin sang bảng màu sơn mài

admin/index.html trước đây không dùng biến lần nào — thêm khối :root alias.
Badge gói cước trong admin.js chuyển sang var() đọc token."
```

---

## Task 7: Legal — CSS dùng chung + 6 trang

6 trang legal dùng chung `legal.css` nên phần lớn công việc nằm ở một file.

**Files:**
- Modify: `public/shared/css/legal.css`, `public/shared/css/subscription.css`
- Modify: `public/terms/index.html`, `public/privacy/index.html`, `public/support/index.html`, `public/payment-policy/index.html`, `public/refund-policy/index.html`, `public/owner-info/index.html`
- Modify: `tests/chrome-palette.test.js`

- [ ] **Step 1: Xoá 8 dòng còn lại khỏi PENDING**

Xoá `'public/terms/index.html',`, `'public/privacy/index.html',`, `'public/support/index.html',`,
`'public/payment-policy/index.html',`, `'public/refund-policy/index.html',`,
`'public/owner-info/index.html',`, `'public/shared/css/legal.css',`,
`'public/shared/css/subscription.css',`. `PENDING` giờ rỗng.

- [ ] **Step 2: Chạy để xác nhận đỏ**

Run: `node --test tests/chrome-palette.test.js`
Expected: FAIL, liệt kê các file legal còn tím.

- [ ] **Step 3: Alias `:root` của `legal.css`**

Thay khối `:root` hiện có:

```css
:root {
  --legal-bg: var(--lum-nen);
  --legal-surface: rgba(232, 220, 204, .045);
  --legal-border: var(--lum-vien);
  --legal-text: var(--lum-trung);
  --legal-muted: var(--lum-trung-mo);
  --legal-accent: var(--lum-son);
}
```

- [ ] **Step 4: Thay hardcode trong `subscription.css` và 6 trang legal**

**CHỈ đổi màu. KHÔNG đụng markup** — `tmdt-compliance.test.js` khẳng định sự tồn tại
của các link `/owner-info/`, `/terms/`, `/privacy/`, `/payment-policy/`, `/refund-policy/`,
`/support/`, `/auth/` và cấu trúc từng trang.

- [ ] **Step 5: Chạy guard TMDT — bước quan trọng nhất của task này**

Run: `npm run test:tmdt`
Expected: 46/46 PASS. Nếu đỏ: đã đụng markup, hoàn nguyên phần markup, chỉ giữ thay đổi màu.

- [ ] **Step 6: Chạy guard màu — PENDING giờ rỗng**

Run: `node --test tests/chrome-palette.test.js`
Expected: 4/4 PASS. Đây là lần đầu test "đã di trú" chạy trên toàn bộ 16 file.

- [ ] **Step 7: Chụp ảnh 6 trang legal**

Run: `npx playwright test chrome.spec.js --project=firefox -g "terms|privacy|support|policy|owner"`
Expected: 24/24 PASS.

- [ ] **Step 8: Commit**

```bash
git add public/shared/css/legal.css public/shared/css/subscription.css public/terms/index.html public/privacy/index.html public/support/index.html public/payment-policy/index.html public/refund-policy/index.html public/owner-info/index.html tests/chrome-palette.test.js
git commit -m "feat(ui): trang pháp lý sang bảng màu sơn mài

PENDING của guard giờ rỗng — mọi file vỏ đã di trú xong. Chỉ đổi màu,
markup giữ nguyên để tmdt-compliance không đỏ."
```

---

## Task 8: Kiểm chứng toàn bộ

**Files:** không sửa file nào — chỉ chạy và nhìn.

- [ ] **Step 1: Toàn bộ test logic**

Run: `npm test`
Expected: 9 suite, 0 fail. Đặc biệt `test:tmdt` 46/46 và `test:chrome` 4/4.

- [ ] **Step 2: Test thị giác vỏ, cả hai trình duyệt**

Run: `npx playwright test chrome.spec.js`
Expected: 104 test (13 trang × 4 viewport × 2 trình duyệt) PASS.

- [ ] **Step 3: Universe KHÔNG được đổi — bất biến của spec**

Run: `LUMORA_TEST_GALAXY=6a813ad3233b2139a65c5c1d npx playwright test universes.spec.js`
Expected: 40/40 PASS.

- [ ] **Step 4: Xác nhận galaxy giữ nguyên màu tím**

Run: `grep -c "8b5cf6" public/portal/js/galaxy-setup.js public/portal/js/galaxy-viewer.js`
Expected: cả hai đều `>= 1`. Đây là bất biến "không đổi màu hiển thị của galaxy".

- [ ] **Step 5: Không còn màu tím ở đâu trong vỏ**

Run: `grep -rnE "#(8b5cf6|7c3aed|a78bfa|c4b5fd|6d28d9)" public --include=*.html --include=*.css | grep -v abyss | grep -v aurora | grep -v fall | grep -v galaxy-moon | grep -v story`
Expected: không in ra gì.

- [ ] **Step 6: NHÌN ảnh, không chỉ đọc số**

Mở toàn bộ `tests/visual/.shots/firefox/chrome-*-desktop.png` và duyệt bằng mắt. Kiểm:

- Không nút nào còn đổ bóng màu.
- Không còn pill bo tròn có ✦.
- Chữ nhấn một màu đặc, không gradient.
- Chữ báo lỗi phân biệt được với nút chính dù cùng họ đỏ.
- Trang legal đọc được, tương phản chữ đủ.
- Khung xem trước galaxy trong portal **vẫn tím** — đúng chủ ý.

`npm test` xanh không chứng minh giao diện đúng (`CLAUDE.md` mục 3).

- [ ] **Step 7: Commit ảnh nếu harness sinh ra thay đổi cần lưu**

```bash
git status --short
```

Nếu chỉ có file trong `tests/visual/.shots/` (đã ignore) thì không cần commit gì thêm.

---

## Self-review

**Phủ spec:**

| mục spec | task |
|---|---|
| Bảng token mục 3 | Task 2 Step 3 |
| `tokens.css` nạp trước `<style>` | Task 2 Step 5 |
| Gộp hai `:root` của `index.html` | Task 3 Step 3 |
| Bỏ glow tím | Task 3 Step 4 |
| Bỏ pill ✦ | Task 3 Step 5 |
| Bỏ gradient chữ nhấn | Task 3 Step 6 |
| Tách đỏ-lỗi khỏi đỏ-son | Task 2 Step 3 (token) + Task 4 Step 4 (icon) |
| Thứ tự di trú 6 bước | Task 3→7 |
| `chrome.spec.js` | Task 1 |
| Guard regex chống trôi | Task 2 Step 1 |
| Guard trừ 2 file galaxy tường minh | Task 2 Step 1 (`KEEP_VIOLET`) |
| Rủi ro `tmdt-compliance` | Task 5 Step 5, Task 7 Step 5 |
| Universe không đổi | Task 2 Step 1 (test) + Task 8 Step 3 |
| Galaxy giữ `#8b5cf6` | Task 8 Step 4 |

Không mục nào của spec thiếu task.

**Nhất quán tên:** `--lum-*` dùng thống nhất từ Task 2 tới Task 7. Hàm helper
`collectErrors`, `horizontalOverflow` trùng tên với `helpers/universe.js` nhưng nằm ở
module riêng (`helpers/chrome.js`) nên không xung đột.

**Rủi ro còn lại đã ghi trong spec, không giải trong kế hoạch này:**
`violetPixelRatio` viết ở Task 1 Step 1 nhưng **chưa dùng trong assertion nào** — để sẵn
làm công cụ chẩn đoán thủ công. Nếu muốn dùng làm assertion thì cần hiệu chuẩn ngưỡng
trước, và đó là việc riêng.
