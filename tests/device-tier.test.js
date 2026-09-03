const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// public/shared/js/deviceTier.js là ES module dùng /shared/... trong import của
// abyss, nên require() thẳng không chạy. Nạp nguồn rồi đánh giá trong sandbox
// có `location` và `URL` giả — vẫn là ĐÚNG mã đang phục vụ, không phải bản chép.
const SRC = fs.readFileSync(path.join(__dirname, '../public/shared/js/deviceTier.js'), 'utf8');

function nap(navigatorGia = {}, dpr = 1) {
  const sandbox = {
    URL, navigator: navigatorGia, window: { devicePixelRatio: dpr },
    location: { href: 'https://lumora.test/view/' },
  };
  // Bỏ đúng từ khoá `export` ở đầu dòng: khai báo hàm còn lại trở thành biến
  // toàn cục của sandbox. Không viết lại thân hàm, nên đây vẫn là mã đang chạy.
  vm.runInNewContext(SRC.replace(/^export /gm, ''), sandbox);
  return sandbox;
}

test('sizedImageUrl chặn cạnh dài nhất cho ảnh ImageKit', () => {
  const { sizedImageUrl } = nap();
  const u = sizedImageUrl('https://ik.imagekit.io/g1v8sjzcr/moon/a.jpg', 640);
  assert.match(u, /[?&]tr=w-640%2Ch-640%2Cc-at_max|[?&]tr=w-640,h-640,c-at_max/);
});

test('không đụng vào ảnh KHÔNG nằm trên ImageKit', () => {
  const { sizedImageUrl } = nap();
  const goc = 'https://cdn.khac.com/a.jpg';
  assert.strictEqual(sizedImageUrl(goc, 640), goc);
});

test('tôn trọng transform có sẵn, không đè lên', () => {
  const { sizedImageUrl } = nap();
  const goc = 'https://ik.imagekit.io/x/a.jpg?tr=w-100';
  assert.strictEqual(sizedImageUrl(goc, 640), goc);
});

test('URL rác hoặc maxEdge rỗng thì trả nguyên, không ném', () => {
  const { sizedImageUrl } = nap();
  assert.strictEqual(sizedImageUrl('://hong', 640), '://hong');
  assert.strictEqual(sizedImageUrl('https://ik.imagekit.io/x/a.jpg', 0), 'https://ik.imagekit.io/x/a.jpg');
  assert.strictEqual(sizedImageUrl(null, 640), null);
});

test('detectPerformanceTier hạ tier theo máy, không theo ý muốn', () => {
  // Điện thoại: 4 nhân / 3 GB -> low, dù dpr 3 (dpr cao KHÔNG có nghĩa máy khoẻ,
  // đó chính là bẫy của mọi điện thoại tầm trung màn hình đẹp).
  assert.strictEqual(nap({ hardwareConcurrency: 4, deviceMemory: 3, userAgent: 'Android Mobile' }, 3)
    .detectPerformanceTier(), 'low');
  assert.strictEqual(nap({ hardwareConcurrency: 4, deviceMemory: 4, userAgent: 'X11' }, 1)
    .detectPerformanceTier(), 'mid');
  assert.strictEqual(nap({ hardwareConcurrency: 12, deviceMemory: 16, userAgent: 'X11' }, 1)
    .detectPerformanceTier(), 'high');
});

test('abyss dùng CHUNG phép dò, không giữ bản chép riêng', () => {
  const tiers = fs.readFileSync(path.join(__dirname, '../public/abyss/js/core/tiers.js'), 'utf8');
  assert.match(tiers, /export \{ detectPerformanceTier \} from '\/shared\/js\/deviceTier\.js'/);
  assert.doesNotMatch(tiers, /hardwareConcurrency/,
    'abyss định nghĩa lại phép dò — hai bản sẽ trôi khỏi nhau');
});

// Guard đọc nguồn thì PHẢI bỏ comment trước. Lần đầu viết test này nó đỏ oan
// vì chính đoạn comment giải thích "bản cũ dùng await Promise.all(images.map)"
// bị đếm là mã. Cùng cái bẫy tests/chrome-palette.test.js đã dính.
function boComment(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

test('fall đặt trần texture theo tier, không nạp ảnh nguyên gốc', () => {
  const fall = boComment(fs.readFileSync(path.join(__dirname, '../public/fall/js/fall.js'), 'utf8'));
  assert.match(fall, /sizedImageUrl\(url, BUDGET\.texture\)/,
    'fall nạp ảnh không qua trần kích thước — 489 MB texture sẽ quay lại');
  assert.doesNotMatch(fall, /await Promise\.all\(images\.map/,
    'fall lại chặn màn hình chờ toàn bộ ảnh');
  for (const [tier, tran] of [['low', 448], ['mid', 640], ['high', 832]]) {
    assert.match(fall, new RegExp(`${tier}:\\s*\\{\\s*texture:\\s*${tran}`), `trần của tier ${tier} đã đổi`);
  }
});
