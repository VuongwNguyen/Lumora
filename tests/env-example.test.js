const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

// .env.example là bản mẫu người mới clone repo sẽ chép ra .env. Thêm một
// process.env.X mới mà quên khai báo ở đây thì họ dựng môi trường thiếu biến,
// và triệu chứng thường là im lặng chứ không phải lỗi: PAYMENTS_ENABLED trống
// làm thanh toán tắt mà không báo gì, APP_URL trống làm og:image trỏ sai
// domain khi đứng sau proxy.
//
// KHÔNG đọc .env — đó là file bí mật và không nằm trong git. Chỉ đối chiếu
// .env.example với những gì source code thật sự đọc.
const GOC = path.join(__dirname, '..');

// Biến do môi trường chạy đặt, không thuộc bản mẫu.
const NGOAI_LE = new Set([
  'NODE_ENV',      // do lệnh npm đặt
  'CI',            // do runner đặt
  'PORT',          // hạ tầng đặt; vẫn có trong mẫu nhưng không bắt buộc
  'LUMORA_TEST_GALAXY', 'LUMORA_TEST_TEMPLATE', 'LUMORA_FALL_GALAXY', // chỉ để chạy test
]);

// Không quét: build output (không phải mã nguồn), và web/ — app Next.js đó là
// dự án riêng, có .env.local.example của nó và chỉ đọc BACKEND_API_URL.
// Quên bỏ web/.next thì test lôi về hàng chục biến NEXT_OTEL_* của Next.js.
const BO_QUA_THU_MUC = new Set([
  'node_modules', '.git', 'public', 'web',
  '.next', 'dist', 'build', 'out', 'coverage',
]);

// Đọc qua mảng chuỗi chứ không phải process.env.X, nên regex không thấy.
// config/compliance.js:3 giữ danh sách này.
const DOC_GIAN_TIEP = ['OWNER_NAME', 'OWNER_TAX_ID', 'OWNER_ADDRESS', 'SUPPORT_EMAIL', 'SUPPORT_PHONE'];

function duyet(thuMuc, ra = []) {
  for (const muc of fs.readdirSync(thuMuc, { withFileTypes: true })) {
    if (BO_QUA_THU_MUC.has(muc.name)) continue;
    const p = path.join(thuMuc, muc.name);
    if (muc.isDirectory()) duyet(p, ra);
    else if (muc.name.endsWith('.js')) ra.push(p);
  }
  return ra;
}

function khoaCodeDoc() {
  const ra = new Set(DOC_GIAN_TIEP);
  for (const tep of duyet(GOC)) {
    if (tep.includes(`${path.sep}tests${path.sep}`)) continue;
    const src = fs.readFileSync(tep, 'utf8');
    for (const m of src.matchAll(/process\.env\.([A-Z0-9_]+)/g)) ra.add(m[1]);
    // config/compliance.js và config/database.js nhận `env = process.env` làm
    // tham số rồi đọc `env.X`. Chỉ bắt dạng này ở file THẬT SỰ có khai báo đó,
    // nếu không mọi `env.` bất kỳ đều bị đếm nhầm.
    if (/env\s*=\s*process\.env/.test(src)) {
      for (const m of src.matchAll(/\benv\.([A-Z0-9_]+)/g)) ra.add(m[1]);
    }
  }
  return ra;
}

function khoaTrongMau() {
  const src = fs.readFileSync(path.join(GOC, '.env.example'), 'utf8');
  return new Set([...src.matchAll(/^([A-Z0-9_]+)=/gm)].map(m => m[1]));
}

test('.env.example khai báo đủ mọi biến môi trường code đọc', () => {
  const mau = khoaTrongMau();
  const thieu = [...khoaCodeDoc()].filter(k => !NGOAI_LE.has(k) && !mau.has(k)).sort();
  assert.deepStrictEqual(thieu, [],
    `Code đọc những biến này nhưng .env.example không có:\n  ${thieu.join('\n  ')}\n` +
    'Thêm vào .env.example kèm chú thích: để trống thì chuyện gì xảy ra.');
});

test('.env.example không chứa biến chết', () => {
  const doc = khoaCodeDoc();
  const chet = [...khoaTrongMau()].filter(k => !NGOAI_LE.has(k) && !doc.has(k)).sort();
  assert.deepStrictEqual(chet, [],
    `.env.example khai báo những biến KHÔNG nơi nào đọc:\n  ${chet.join('\n  ')}\n` +
    'Hoặc nối chúng vào code, hoặc bỏ khỏi mẫu — để đó thì người dựng môi trường ' +
    'tưởng mình đã cấu hình xong.');
});

test('.env.example không lỡ chứa giá trị thật', () => {
  const src = fs.readFileSync(path.join(GOC, '.env.example'), 'utf8');
  for (const [dong, khoa, giaTri] of [...src.matchAll(/^([A-Z0-9_]+)=(.*)$/gm)]
      .map(m => [m[0], m[1], m[2].trim()])) {
    if (!giaTri) continue;
    // Mẫu được phép có giá trị mặc định vô hại (số, true/false, tên model).
    // Chuyện đã xảy ra thật: DATABASE_URL trong .env.example từng là chuỗi
    // mongodb+srv CÓ username và password, nằm trong repo PUBLIC từ 2026-04-24.
    // Chốt theo HÌNH DẠNG credential, không theo danh sách khoá.
    const userinfo = (giaTri.match(/:\/\/([^/\s@]+:[^/\s@]+)@/) || [])[1];
    // Placeholder được phép: <user>:<password>, your-user:your-pass, USER:PASS...
    const laPlaceholder = userinfo && /[<>]|your|example|xxx|\.\.\.|^USER:|:PASS/i.test(userinfo);
    assert.ok(!userinfo || laPlaceholder,
      `.env.example chứa credential thật ở ${khoa} (dạng user:pass@host) — bản mẫu phải là placeholder`);
    assert.ok(!/^[A-Za-z0-9+/]{32,}={0,2}$/.test(giaTri),
      `.env.example có vẻ chứa khoá bí mật ở ${khoa} — bản mẫu phải để trống`);
  }
});
