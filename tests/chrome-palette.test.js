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
  'public/terms/index.html',
  'public/privacy/index.html',
  'public/support/index.html',
  'public/payment-policy/index.html',
  'public/refund-policy/index.html',
  'public/owner-info/index.html',
  'public/shared/css/legal.css',
  'public/shared/css/subscription.css',
]);

// CỐ Ý giữ màu tím — đây là màu HIỂN THỊ CỦA GALAXY, không phải màu giao diện.
// Liệt kê tường minh kèm lý do, KHÔNG trừ bằng pattern thư mục: để file mới thêm
// vào portal/js/ vẫn bị guard bắt.
const KEEP_VIOLET = {
  'public/portal/js/galaxy-setup.js': 'màu theme mặc định của galaxy người dùng',
  'public/portal/js/galaxy-viewer.js': 'màu tinh vân của bản xem trước galaxy',
};

// ĐO màu, không liệt kê màu.
//
// Bản đầu của guard này liệt kê tay 7 mã hex và 3 dạng rgba. Nó bỏ lọt 90 chỗ
// tím trong các file chưa di trú — cùng một màu viết ở dạng khác là thoát:
// #c4b5fd bị bắt nhưng rgba(196,181,253) thì không, dù là đúng một màu. Cộng
// thêm #c084fc, rgba(126,58,242), rgba(124,92,252)… mà danh sách không có.
//
// Danh sách liệt kê tay không bao giờ đủ. Đọc RGB ra số rồi hỏi "đây có phải
// họ tím không" thì bắt được cả những sắc chưa ai từng thấy.
function docMau(source) {
  const mau = [];
  const hex = /#([0-9a-f]{6})\b/gi;
  for (let m; (m = hex.exec(source)); ) {
    const n = parseInt(m[1], 16);
    mau.push([n >> 16 & 255, n >> 8 & 255, n & 255]);
  }
  const rgb = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/gi;
  for (let m; (m = rgb.exec(source)); ) mau.push([+m[1], +m[2], +m[3]]);
  return mau;
}

// Tím = lam trội hẳn so với đỏ, và đỏ vẫn trên lục. Ngưỡng 20 để lọc màu xám.
// Kiểm ngược trên chính bảng sơn mài: son (158,68,56), đồng (185,154,94), vỏ
// trứng (232,220,204) và nền (20,9,10) đều KHÔNG khớp. Xanh lam thật như
// (57,182,255) cũng không, vì ở đó lục vượt đỏ.
function laTim([r, g, b]) {
  return b > r + 20 && r > g;
}

function timConSot(source) {
  return docMau(source).filter(laTim);
}

test('file vỏ đã di trú không còn màu họ tím nào', () => {
  const conSot = [];
  for (const file of CHROME_FILES) {
    if (PENDING.has(file)) continue;
    const found = timConSot(read(file));
    if (found.length) conSot.push(`${file} (${found.length} chỗ, vd rgb(${found[0]}))`);
  }
  assert.deepEqual(conSot, [], `còn màu tím trong:\n  ${conSot.join('\n  ')}`);
});

test('file giữ màu galaxy vẫn còn nguyên — không bị di trú nhầm', () => {
  for (const [file, lyDo] of Object.entries(KEEP_VIOLET)) {
    assert.ok(timConSot(read(file)).length > 0, `${file} mất màu tím nhưng phải giữ: ${lyDo}`);
  }
});

test('phép đo màu tím tự kiểm — không bắt nhầm bảng sơn mài', () => {
  // Test rỗng thì vô dụng: chốt lại cả hai chiều của laTim().
  for (const tim of [[139, 92, 246], [196, 181, 253], [167, 139, 250], [109, 40, 217], [192, 132, 252]]) {
    assert.ok(laTim(tim), `rgb(${tim}) phải bị coi là tím`);
  }
  for (const khong of [[158, 68, 56], [185, 154, 94], [232, 220, 204], [20, 9, 10], [217, 96, 74], [57, 182, 255]]) {
    assert.ok(!laTim(khong), `rgb(${khong}) KHÔNG được coi là tím`);
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
