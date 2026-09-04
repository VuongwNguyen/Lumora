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
// Rỗng: mọi file vỏ đã di trú xong.
const PENDING = new Set([]);

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

// Phép đo tím KHÔNG bắt được nền đen-lạnh cũ: #06060e là rgb(6,6,14) — lam chỉ
// hơn đỏ 8, dưới ngưỡng 20, nên nó lọt. Mà chính nó là thứ người dùng nhìn thấy
// đầu tiên: chân trang legal hiện trên MỌI trang, và nó lạc hẳn tông so với nền
// ấm — trông như layout bị rớt chứ không như sai màu.
//
// Trước đây chốt bằng DANH SÁCH nền cũ tường minh — và danh sách đã bỏ lọt
// thật: #0e0d1a (nền hộp thoại rà soát đơn hàng trong subscription.css) không
// có trong danh sách, cũng không qua ngưỡng laTim (lam 26 chỉ hơn đỏ 12). Nó
// sống sót qua mọi lần chạy cho tới khi người dùng tự nhìn thấy hộp thoại lạc
// tông xanh giữa nền ấm.
//
// Nên ĐO thay vì liệt kê: bảng sơn mài ấm ở mọi mức độ sáng — nền #0c0b0a có
// r12 > g11 > b10, mặt thẻ #232120 có r35 > g33 > b32. Mọi màu TỐI mà lam vượt
// đỏ đều là tàn dư của bảng tím-đen cũ. Danh sách dưới đây chỉ còn để bắt thêm
// những mã đã biết mà không tối (phòng khi ai đó dùng chúng làm màu chữ).
const NEN_CU = ['06060e', '060610', '020207', '05050d', '04040c', '0b0a15', '100d1e', '0d0d1e', '0a0015', '090712', '010a18'];

// Tối = kênh sáng nhất <= 64. Trên ngưỡng đó thì lam vượt đỏ là màu xanh có
// chủ đích (trạng thái, link), không phải nền lạc tông.
function laNenLanh([r, g, b]) {
  return Math.max(r, g, b) <= 64 && b > r;
}

// .theme-preview trong galaxy-setup.html cố ý giữ #05050d: đó là đuôi gradient
// của khung XEM TRƯỚC GALAXY, tức màu kỷ vật người dùng, không phải màu vỏ.
const NEN_CU_GIU = { 'public/portal/galaxy-setup.html': 'đuôi gradient của .theme-preview — màu galaxy' };

function boComment(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '');
}

// Story Emotion preview trong story-setup.html vẽ lại CHÍNH cảnh mà người xem
// sẽ thấy — nó là nội dung của người dùng, không phải vỏ ứng dụng, cùng loại
// với .theme-preview đã miễn ở NEN_CU_GIU.
//
// Miễn theo DANH SÁCH TRẮNG chứ không miễn cả file: danh sách đen hỏng khi có
// màu lạ (đúng thứ vừa xảy ra với #0e0d1a), còn danh sách trắng hỏng theo chiều
// AN TOÀN — thêm bất kỳ màu lạnh nào ngoài tám mã này là đỏ ngay. #panel-toggle
// trong chính file đó từng lọt qua vì miễn cả file thì sẽ không bao giờ bị bắt.
const NEN_LANH_GIU = {
  'public/portal/story-setup.html': [
    '3,3,9', '37,25,44', '10,7,15', '1,4,12', '4,12,12', '4,4,12', '5,5,13', '11,8,24',
  ],
};

test('không còn nền đen-lạnh cũ trong file vỏ', () => {
  const conSot = [];
  for (const file of CHROME_FILES) {
    if (PENDING.has(file) || NEN_CU_GIU[file]) continue;
    const src = boComment(read(file));
    const hit = NEN_CU.filter(h => new RegExp('#' + h, 'i').test(src));
    // Phép ĐO là chốt chính; danh sách chỉ bổ sung.
    const duocGiu = new Set(NEN_LANH_GIU[file] || []);
    const doDuoc = docMau(src).filter(laNenLanh)
      .filter(c => !duocGiu.has(c.join(',')))
      .map(c => `rgb(${c})`);
    const tatCa = [...new Set([...hit.map(h => '#' + h), ...doDuoc])];
    if (tatCa.length) conSot.push(`${file} (${tatCa.join(', ')})`);
  }
  assert.deepEqual(conSot, [], `còn nền lạnh cũ:\n  ${conSot.join('\n  ')}`);
});

test('phép đo nền lạnh tự kiểm — không bắt nhầm bảng sơn mài', () => {
  for (const lanh of [[14, 13, 26], [6, 6, 14], [13, 13, 30], [10, 0, 21]]) {
    assert.ok(laNenLanh(lanh), `rgb(${lanh}) phải bị coi là nền lạnh cũ`);
  }
  for (const am of [[12, 11, 10], [35, 33, 32], [48, 45, 43], [158, 68, 56], [185, 154, 94], [232, 220, 204]]) {
    assert.ok(!laNenLanh(am), `rgb(${am}) là bảng sơn mài, KHÔNG được báo động`);
  }
  // Xanh có chủ đích, đủ sáng để thấy rõ là màu chứ không phải nền lạc tông.
  assert.ok(!laNenLanh([57, 182, 255]), 'xanh lam sáng không phải nền lạnh');
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
