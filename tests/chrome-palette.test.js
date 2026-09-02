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

// Chưa di trú. Xoá dần theo các task sau. Khi rỗng là xong.
const PENDING = new Set([
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
  const conSot = [];
  for (const file of CHROME_FILES) {
    if (PENDING.has(file)) continue;
    if (VIOLET.test(read(file))) conSot.push(file);
  }
  assert.deepEqual(conSot, [], `còn màu tím trong: ${conSot.join(', ')}`);
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
    '--lum-son', '--lum-son-tham', '--lum-son-mo',
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

test('mọi trang vỏ đều nạp tokens.css', () => {
  const pages = CHROME_FILES.filter(f => f.endsWith('.html'));
  const thieu = pages.filter(f => !read(f).includes('/shared/css/tokens.css'));
  assert.deepEqual(thieu, [], `chưa nạp tokens.css: ${thieu.join(', ')}`);
});
