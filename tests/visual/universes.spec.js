const { test, expect } = require('@playwright/test');
const path = require('node:path');
const {
  VIEWPORTS, UNIVERSES, universeUrl, dismissGates, collectErrors,
  waitForScene, readTelemetry, horizontalOverflow,
} = require('./helpers/universe');

const SHOTS = path.join(__dirname, '.shots');

// Mỗi universe phải mở được, vẽ được frame, không lỗi console, và không tràn
// ngang ở mọi viewport. Đây là mức sàn — không phải bằng chứng đẹp, mà là bằng
// chứng KHÔNG HỎNG.
for (const template of UNIVERSES) {
  test.describe(template, () => {
    for (const viewport of VIEWPORTS) {
      test(`${viewport.name} ${viewport.width}x${viewport.height} mở được và vẽ được`, async ({ page }, testInfo) => {
        const errors = collectErrors(page);
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(universeUrl(template), { waitUntil: 'domcontentloaded' });

        await dismissGates(page);
        const state = await waitForScene(page);
        expect(state, `${template} không vẽ được frame nào`).not.toBe('timeout');

        // Cho scene chạy vài giây để hạt, cross-fade và texture kịp vào.
        await page.waitForTimeout(3000);

        const shot = path.join(SHOTS, testInfo.project.name, `${template}-${viewport.name}.png`);
        await page.screenshot({ path: shot });
        await testInfo.attach(`${template}-${viewport.name}`, { path: shot, contentType: 'image/png' });

        const overflow = await horizontalOverflow(page);
        expect(overflow, `tràn ngang ${overflow}px`).toBeLessThanOrEqual(1);

        const telemetry = await readTelemetry(page);
        if (telemetry) {
          testInfo.annotations.push({ type: 'telemetry', description: JSON.stringify(telemetry) });
          // Assertion quan trọng nhất: đúng universe đã render. Lần chạy đầu
          // tiên test PASS trong khi màn hình là overlay Story — draw call > 0
          // không chứng minh được ta đang xem đúng thứ cần xem.
          expect(telemetry.template, `render nhầm template`).toBe(template);
          expect(telemetry.calls, 'renderer không phát draw call nào').toBeGreaterThan(0);
          expect(telemetry.triangles, 'scene không có tam giác nào').toBeGreaterThan(0);
        }

        expect(errors, `lỗi console:\n${errors.join('\n')}`).toEqual([]);
      });
    }
  });
}
