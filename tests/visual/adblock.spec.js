const { test, expect } = require('@playwright/test');

// Lưới an toàn cho trường hợp một tiện ích mở rộng nuốt mất tệp script.
//
// Dùng /auth/ vì nó có <script type="module"> mà KHÔNG cần galaxy trong DB —
// test này phải chạy được trên máy trống. Chặn phòng ngừa theo tên tệp nằm ở
// tests/adblock-assets.test.js (chạy offline, không cần trình duyệt).
const TRANG = '/auth/';
const MODULE = '**/auth/js/main.js';

test('bình thường: không có lời nhắn nào', async ({ page }) => {
  await page.goto(TRANG, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await expect(page.locator('#lumora-chan-tep')).toHaveCount(0);
});

test('module bị chặn: hiện lời nhắn thay vì im lặng', async ({ page }) => {
  // blockedbyclient là đúng mã mà uBlock Origin dùng khi huỷ một yêu cầu.
  await page.route(MODULE, r => r.abort('blockedbyclient'));
  await page.goto(TRANG, { waitUntil: 'domcontentloaded' });
  const bao = page.locator('#lumora-chan-tep');
  await expect(bao).toBeVisible({ timeout: 5000 });
  await expect(bao).toContainText('bộ chặn quảng cáo');
});
