const { test, expect } = require('@playwright/test');
const path = require('node:path');
const {
  VIEWPORTS, UNIVERSES, TEST_GALAXY, TEST_TEMPLATE,
  universeUrl, dismissGates, collectErrors,
  waitForScene, readTelemetry, horizontalOverflow, canvasCoverage,
} = require('./helpers/universe');

const SHOTS = path.join(__dirname, '.shots');

async function verify(page, testInfo, { template, url, label, expectTelemetry }) {
  const errors = collectErrors(page);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await dismissGates(page);

  const state = await waitForScene(page);
  expect(state, `${template} không vẽ được frame nào`).not.toBe('timeout');

  // Cho scene chạy để hạt, cross-fade và texture kịp vào.
  await page.waitForTimeout(3000);

  const shot = path.join(SHOTS, testInfo.project.name, `${label}.png`);
  await page.screenshot({ path: shot });
  await testInfo.attach(label, { path: shot, contentType: 'image/png' });

  const overflow = await horizontalOverflow(page);
  expect(overflow, `tràn ngang ${overflow}px`).toBeLessThanOrEqual(1);

  const coverage = await canvasCoverage(page);
  testInfo.annotations.push({ type: 'canvas', description: JSON.stringify(coverage) });
  expect(coverage, 'không tìm thấy canvas').not.toBeNull();
  expect(coverage.gapX, `canvas hụt ${coverage.gapX}px chiều ngang, lộ nền trắng`).toBeLessThanOrEqual(2);
  expect(coverage.gapY, `canvas hụt ${coverage.gapY}px chiều dọc, lộ nền trắng`).toBeLessThanOrEqual(2);

  const telemetry = await readTelemetry(page);
  if (telemetry) {
    testInfo.annotations.push({ type: 'telemetry', description: JSON.stringify(telemetry) });
    // Assertion quan trọng nhất: ĐÚNG universe đã render. Lần chạy đầu tiên của
    // harness này PASS trong khi màn hình là overlay Story — `draw calls > 0`
    // không chứng minh được ta đang xem đúng thứ cần xem.
    expect(telemetry.template, 'render nhầm template').toBe(template);
    expect(telemetry.calls, 'renderer không phát draw call nào').toBeGreaterThan(0);
    expect(telemetry.triangles, 'scene không có tam giác nào').toBeGreaterThan(0);
  } else if (expectTelemetry) {
    throw new Error(`${template} bật ?debug=1 nhưng không expose window.__lumora`);
  }

  expect(errors, `lỗi console:\n${errors.join('\n')}`).toEqual([]);
}

// Mức sàn cho MỌI universe: mở được, vẽ được frame, không lỗi console, không
// tràn ngang. Không cần galaxy — chạy đường empty state qua /{template}/.
test.describe('empty state', () => {
  for (const template of UNIVERSES) {
    for (const viewport of VIEWPORTS) {
      test(`${template} · ${viewport.name}`, async ({ page }, testInfo) => {
        await page.setViewportSize(viewport);
        await verify(page, testInfo, {
          template,
          url: universeUrl(template, { galaxyId: '' }),
          label: `${template}-empty-${viewport.name}`,
          expectTelemetry: false,
        });
      });
    }
  }
});

// Đường có nội dung thật. /view/ phục vụ template theo CẤU HÌNH CỦA GALAXY, nên
// chỉ chạy được cho đúng template của galaxy test — yêu cầu universe khác sẽ
// nhận về template của galaxy và assertion sẽ (đúng đắn) đỏ.
test.describe('galaxy thật', () => {
  test.skip(!TEST_GALAXY, 'đặt LUMORA_TEST_GALAXY để chạy nhóm này');
  for (const viewport of VIEWPORTS) {
    test(`${TEST_TEMPLATE} · ${viewport.name}`, async ({ page }, testInfo) => {
      await page.setViewportSize(viewport);
      await verify(page, testInfo, {
        template: TEST_TEMPLATE,
        url: universeUrl(TEST_TEMPLATE),
        label: `${TEST_TEMPLATE}-${viewport.name}`,
        expectTelemetry: TEST_TEMPLATE === 'abyss',
      });
    });
  }
});
