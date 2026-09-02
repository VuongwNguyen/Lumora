const { test, expect } = require('@playwright/test');
const path = require('node:path');
const {
  VIEWPORTS, CHROME_PAGES, collectErrors, horizontalOverflow,
} = require('./helpers/chrome');

const SHOTS = path.join(__dirname, '.shots');

test.describe('vỏ ứng dụng', () => {
  for (const pageDef of CHROME_PAGES) {
    for (const viewport of VIEWPORTS) {
      test(`${pageDef.name} · ${viewport.name}`, async ({ page }, testInfo) => {
        await page.setViewportSize(viewport);
        const errors = collectErrors(page);

        await page.goto(pageDef.path, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1200);

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
