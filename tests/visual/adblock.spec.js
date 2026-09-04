const { test, expect } = require('@playwright/test');

// Lưới an toàn cho trường hợp một tiện ích mở rộng nuốt mất tệp script.
//
// Dùng /auth/ vì nó có <script type="module"> mà KHÔNG cần galaxy trong DB —
// test này phải chạy được trên máy trống. Chặn phòng ngừa theo tên tệp nằm ở
// tests/adblock-assets.test.js (chạy offline, không cần trình duyệt).
const TRANG = '/auth/';
const MODULE = '**/auth/js/main.js';
const BAO = '#lumora-chan-tep';

test('bình thường: không có lời nhắn nào', async ({ page }) => {
  await page.goto(TRANG, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await expect(page.locator(BAO)).toHaveCount(0);
});

test('module CÙNG NGUỒN bị chặn: hiện lời nhắn thay vì im lặng', async ({ page }) => {
  // blockedbyclient là đúng mã mà uBlock Origin dùng khi huỷ một yêu cầu.
  await page.route(MODULE, r => r.abort('blockedbyclient'));
  await page.goto(TRANG, { waitUntil: 'domcontentloaded' });
  const bao = page.locator(BAO);
  await expect(bao).toBeVisible({ timeout: 5000 });
  await expect(bao).toContainText('bộ chặn quảng cáo');
});

// Đã xảy ra thật trên production: Cloudflare tự chèn
// static.cloudflareinsights.com/beacon.min.js vào mọi trang, CSP của chính ta
// chặn nó, và bản đầu của lưới an toàn hô hoán "hãy tắt bộ chặn quảng cáo" với
// MỌI khách. Cảnh báo sai còn tệ hơn không cảnh báo.
test('script BÊN THỨ BA hỏng: KHÔNG được hô hoán', async ({ page }) => {
  await page.goto(TRANG, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.evaluate(() => new Promise(res => {
    const s = document.createElement('script');
    // Tên miền không tồn tại -> chắc chắn hỏng, không phụ thuộc mạng ngoài.
    s.src = 'https://static.cloudflareinsights.invalid/beacon.min.js';
    s.onerror = () => setTimeout(res, 250);
    document.head.appendChild(s);
  }));
  await expect(page.locator(BAO),
    'script bên thứ ba hỏng lại làm hiện cảnh báo — báo động sai').toHaveCount(0);
});
