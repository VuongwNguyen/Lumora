// Vỏ ứng dụng — KHÔNG phải universe. Không có canvas, không có telemetry, nên
// helper này cố ý tách khỏi helpers/universe.js thay vì nhét thêm nhánh if vào đó.
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

// 13 trang vỏ. `auth` cần bỏ qua lỗi mạng vì nó gọi API khi chưa đăng nhập.
// `needsSession: true` là portal/admin — chưa đăng nhập thì các trang này tự
// window.location.href sang /auth/, và nếu cứ chụp thẳng thì ta chụp trúng
// trang auth rồi dán nhãn portal. seedSession() gieo phiên giả trước khi vào.
// galaxy-setup và story-setup bắt buộc có ?galaxyId=, nếu không chúng tự đá về
// /portal/ (`if (!galaxyId) window.location.href = '/portal/'`). Id chỉ cần TỒN
// TẠI để qua được cửa đó — mọi API đằng sau đều bị seedSession() chặn lại, nên
// harness không phụ thuộc dữ liệu thật trong DB.
const TEST_GALAXY = process.env.LUMORA_TEST_GALAXY || '000000000000000000000000';

// KHÔNG có portal/galaxy.html trong danh sách: file đó dài 759 dòng nhưng dòng 6
// là `location.replace('/portal/galaxy-setup.html' + location.search)` — một
// stub chuyển hướng thuần, phần markup còn lại không bao giờ render. Chụp nó là
// chụp galaxy-setup lần thứ hai.
const CHROME_PAGES = [
  { name: 'landing', path: '/' },
  { name: 'auth', path: '/auth/' },
  { name: 'portal', path: '/portal/', needsSession: true },
  { name: 'portal-galaxy-setup', path: `/portal/galaxy-setup.html?galaxyId=${TEST_GALAXY}`, needsSession: true },
  { name: 'portal-story-setup', path: `/portal/story-setup.html?galaxyId=${TEST_GALAXY}`, needsSession: true },
  { name: 'admin', path: '/admin/', needsSession: true },
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

// Trang portal chuyển hướng sang /auth/ khi chưa đăng nhập, nên nếu cứ thế mà
// chụp thì ta chụp trang auth và dán nhãn "portal" — 4 ảnh giống hệt nhau tới
// từng byte. Gieo phiên giả rồi chặn API để trang tự dựng khung của nó.
//
// Không dùng tài khoản thật: harness sẽ phụ thuộc trạng thái DB, và mục đích ở
// đây là kiểm MÀU với BỐ CỤC, không phải kiểm luồng đăng nhập.
async function seedSession(page) {
  await page.addInitScript(() => {
    localStorage.setItem('token', 'visual-test-token');
    // role: 'admin' để trang /admin/ (kiểm user.role !== 'admin' trước khi vẽ)
    // không tự đá về /portal/. Trang portal chỉ dùng field này để QUYẾT ĐỊNH có
    // hiện thêm nút "Admin panel" hay không — vô hại với ảnh chụp portal.
    localStorage.setItem('user', JSON.stringify({
      email: 'visual-test@lumora.test', name: 'Visual Test', role: 'admin',
    }));
  });
  const json = body => route => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(body),
  });
  await page.route('**/galaxies**', json({ meta: [] }));
  await page.route('**/auth/sessions**', json({ meta: [] }));
  // /payment/status trả 401 với phiên giả. Firefox nuốt êm, Chromium ghi thành
  // lỗi console — và thông điệp của Chromium KHÔNG kèm URL ("Failed to load
  // resource: ... 401") nên bộ lọc IGNORED theo URL không với tới. Chặn tại
  // nguồn thay vì nới bộ lọc: nới thì mọi 401 thật sau này cũng bị nuốt theo.
  await page.route('**/payment/**', json({ meta: {} }));
  // Ảnh của galaxy — trang setup nạp qua /gallary/ (đúng, chính tả gốc của
  // codebase là 'gallary'). Cũng 401 với phiên giả.
  //
  // upload-policy phải trả ĐÚNG HÌNH DẠNG chứ không phải mảng rỗng: trang gọi
  // `imageUploadPolicy.mimeTypes.join(',')` ngay lúc khởi tạo, nên stub sai hình
  // làm cả trang chết với "Cannot read properties of undefined (reading 'join')".
  // Stub trả sai hình còn tệ hơn không stub — nó biến lỗi hạ tầng test thành
  // thứ trông y như lỗi ứng dụng.
  await page.route('**/gallary/upload-policy**', json({ meta: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    maxFileSize: 10 * 1024 * 1024,
    maxFiles: 60,
    maxBulkDeleteItems: 50,
  } }));
  await page.route('**/gallary/**', json({ meta: [] }));
  // KHÔNG chặn '**/subscription**': không có endpoint API nào tên vậy trong
  // codebase (subscription.js thật ra gọi /compliance/public, /payment/status,
  // /payment/history — cả hai 401 đều bị nuốt êm, không console.error). Glob đó
  // từng vô tình khớp CẢ file tĩnh /portal/js/subscription.js và
  // /shared/css/subscription.css, trả JSON đè lên nội dung JS thật → SyntaxError
  // "unexpected token: ':'" khi trình duyệt cố parse `{"meta":{}}` như script.
}

module.exports = {
  VIEWPORTS, CHROME_PAGES, collectErrors, horizontalOverflow, seedSession,
};
