const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Trang chủ có chữ ở HAI nơi: dựng sẵn trong public/index.html cho lần vẽ đầu
// tiên, và trong LANG của i18n.js cho lúc JS chạy. Hai bản LỆCH NHAU thì người
// dùng thấy câu cũ nhấp nháy rồi mới đổi — không lỗi, không test nào bắt, chỉ
// trông rẻ tiền. Đã suýt xảy ra khi đổi câu định vị: cùng một câu phải sửa ở
// ba chỗ (vi, en, HTML).
function napLang() {
  const src = fs.readFileSync(path.join(__dirname, '../public/shared/js/i18n.js'), 'utf8');
  const sandbox = { window: {}, localStorage: { getItem: () => null }, navigator: { languages: ['vi'] } };
  vm.runInNewContext(src + '\n;__LANG = LANG;', sandbox);
  return sandbox.__LANG;
}

const HTML = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const LANG = napLang();

// khoá i18n -> đoạn HTML phải chứa đúng chuỗi tiếng Việt của khoá đó
const NEO = {
  landingHeroTag: s => `<div class="hero-tag">${s}</div>`,
  landingHeroDesc: s => `<p>${s}</p>`,
  landingHeroCtaPrimary: s => `data-track-id="hero_start">${s}</a>`,
  landingHeroCtaGhost: s => `data-track-id="hero_demo">${s}</a>`,
};

test('chữ hero dựng sẵn trong HTML khớp bản tiếng Việt của i18n', () => {
  for (const [khoa, dung] of Object.entries(NEO)) {
    const chuoi = LANG.vi[khoa];
    assert.ok(chuoi, `i18n thiếu khoá ${khoa}`);
    assert.ok(HTML.includes(dung(chuoi)),
      `index.html không khớp i18n ở ${khoa}.\n  i18n: ${chuoi}\n  Sửa chữ thì phải sửa CẢ HAI nơi.`);
  }
});

test('mọi khoá hero đều có bản tiếng Anh', () => {
  for (const khoa of Object.keys(NEO)) {
    assert.ok(LANG.en[khoa], `en thiếu khoá ${khoa}`);
    assert.notStrictEqual(LANG.en[khoa], LANG.vi[khoa], `${khoa} chưa dịch, còn nguyên tiếng Việt`);
  }
});

// Khách nhìn trang chủ mà không biết Lumora là gì — toàn bộ màn hình đầu chỉ
// có chữ cảm xúc, không danh từ nào nói sản phẩm LÀ CÁI GÌ. Guard này không
// chấm văn hay; nó chốt rằng câu mô tả còn nêu ĐỦ BA việc cụ thể: lấy gì vào,
// dựng ra cái gì, gửi đi bằng cách nào.
test('câu mô tả hero nói rõ sản phẩm làm gì', () => {
  for (const [ngonNgu, phai] of [
    ['vi', [/ảnh/i, /3D/, /link/i]],
    ['en', [/photo/i, /3D/, /link/i]],
  ]) {
    const cau = LANG[ngonNgu].landingHeroDesc;
    for (const re of phai) {
      assert.match(cau, re,
        `câu mô tả ${ngonNgu} không còn nêu "${re.source}" — trở lại kiểu chỉ có cảm xúc`);
    }
  }
});

test('nút CTA là danh từ cụ thể, không phải chữ rỗng', () => {
  // "khoảnh khắc" / "moment" là chữ rỗng: không nói người dùng sẽ nhận được gì.
  for (const ngonNgu of ['vi', 'en']) {
    for (const khoa of ['landingHeroCtaPrimary', 'landingHeroCtaGhost']) {
      assert.doesNotMatch(LANG[ngonNgu][khoa], /khoảnh khắc|moment/i,
        `${ngonNgu}.${khoa} quay lại chữ rỗng`);
    }
  }
});
