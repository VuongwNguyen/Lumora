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

module.exports = { VIEWPORTS, CHROME_PAGES, collectErrors, horizontalOverflow };
