const { test, expect } = require('@playwright/test');
const path = require('node:path');
const {
  VIEWPORTS, CHROME_PAGES, collectErrors, horizontalOverflow, seedSession,
} = require('./helpers/chrome');

const SHOTS = path.join(__dirname, '.shots');

test.describe('vỏ ứng dụng', () => {
  for (const pageDef of CHROME_PAGES) {
    for (const viewport of VIEWPORTS) {
      test(`${pageDef.name} · ${viewport.name}`, async ({ page }, testInfo) => {
        // LỖI CÓ SẴN, không phải do đổi màu: trang admin tràn ngang 74px ở
        // 390px. Đánh dấu "dự kiến đỏ" thay vì nới ngưỡng tràn — nới ngưỡng là
        // tắt đèn báo cho cả 51 test còn lại. test.fail() cũng sẽ ĐỎ NGƯỢC nếu
        // sau này ai đó sửa xong bố cục admin, tức nó tự nhắc gỡ dòng này.
        if (pageDef.name === 'admin' && viewport.name === 'mobile') test.fail();

        await page.setViewportSize(viewport);
        const errors = collectErrors(page);
        if (pageDef.needsSession) await seedSession(page);

        await page.goto(pageDef.path, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1200);

        // Nếu trang tự chuyển hướng đi nơi khác thì mọi thứ chụp được sau đó là
        // của trang KHÁC. Chốt lại đường dẫn trước khi chụp — thiếu bước này,
        // 4 test portal từng "xanh" trong khi chụp đúng trang /auth/: cả bốn
        // ảnh trùng md5 với chrome-auth-desktop.png tới từng byte.
        //
        // So theo pathname, bỏ query: trang setup cần ?galaxyId= nên đường dẫn
        // khai báo có query, còn thứ cần chốt là "có bị đá sang trang khác không".
        const finalPath = new URL(page.url()).pathname;
        const wantPath = new URL(pageDef.path, 'http://localhost').pathname;
        expect(finalPath, `${pageDef.path} đã chuyển hướng sang ${finalPath}`)
          .toBe(wantPath);

        const shot = path.join(SHOTS, testInfo.project.name, `chrome-${pageDef.name}-${viewport.name}.png`);
        await page.screenshot({ path: shot, fullPage: false });
        await testInfo.attach(`${pageDef.name}-${viewport.name}`, { path: shot, contentType: 'image/png' });

        const overflow = await horizontalOverflow(page);
        expect(overflow, `tràn ngang ${overflow}px`).toBeLessThanOrEqual(1);

        expect(errors, `lỗi console:\n${errors.join('\n')}`).toEqual([]);
      });
    }
  }
});
