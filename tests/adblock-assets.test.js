const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// Tệp tĩnh của Lumora không được TRÙNG TÊN với thứ mà bộ chặn quảng cáo chặn.
//
// Chuyện đã xảy ra thật: `public/abyss/js/scene/beacon.js` bị uBlock Origin
// chặn với luật `/beacon.js` của EasyPrivacy. Luật đó KHÔNG neo tên miền và
// khớp theo CHUỖI CON, nên nó bắn trúng cả localhost lẫn production, trên máy
// của mọi khách có uBlock — mà server vẫn 200, log vẫn sạch, không có gì để
// truy. Vì abyss.js là ES module, một import bị chặn giết luôn cả module gốc:
// người dùng thấy màn hình đen, không thông báo, không lỗi phía ta.
//
// Đây KHÔNG phải danh sách đoán. `tests/fixtures/adblock-blocked-filenames.json`
// trích thẳng từ EasyList + EasyPrivacy (xem trường `cachTrich`), chỉ giữ luật
// chung dạng `/<tên>.js|css`. So sánh là TRÙNG KHỚP TÊN TỆP, không phải dò từ
// khoá — nên `trackedFetch.js`, `activityAutoTracker.js`, `activityLogger.js`
// không hề bị báo động sai: đã kiểm, không luật nào chạm tới chúng.
const FIXTURE = require('./fixtures/adblock-blocked-filenames.json');
const PUBLIC = path.join(__dirname, '../public');
const PHAN_MO_RONG = new Set(['.js', '.css']);

function duyet(thuMuc, ra = []) {
  for (const muc of fs.readdirSync(thuMuc, { withFileTypes: true })) {
    const p = path.join(thuMuc, muc.name);
    if (muc.isDirectory()) duyet(p, ra);
    else if (PHAN_MO_RONG.has(path.extname(muc.name))) ra.push(p);
  }
  return ra;
}

test('không tệp tĩnh nào trùng tên với luật chặn chung của EasyList/EasyPrivacy', () => {
  const chan = new Set(FIXTURE.tenTep);
  const dinh = duyet(PUBLIC)
    .filter(p => chan.has(path.basename(p).toLowerCase()))
    .map(p => path.relative(PUBLIC, p));

  assert.deepStrictEqual(dinh, [],
    `Tệp bị bộ chặn quảng cáo nuốt mất:\n  ${dinh.join('\n  ')}\n` +
    'Đổi tên tệp sang từ không nằm trong lĩnh vực đo đạc/quảng cáo. ' +
    'Định danh BÊN TRONG code (tên hàm, biến) thì vô hại — bộ lọc chỉ nhìn URL.');
});

test('fixture còn nguyên vẹn — trích từ nguồn công khai, không phải danh sách tự chế', () => {
  assert.ok(FIXTURE.tenTep.length > 900, 'fixture bị cắt cụt');
  assert.ok(FIXTURE.tenTep.includes('beacon.js'), 'thiếu chính luật đã cắn ta');
  assert.ok(FIXTURE.nguon.some(u => u.includes('easyprivacy')), 'thiếu xuất xứ');
});
