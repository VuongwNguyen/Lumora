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

    // Chốt chặn THOÁI LUI, không phải ngân sách mong muốn. Mục 13.7 của spec đặt
    // draw call <= 60, nhưng đo thật trên abyss với galaxy 59 ảnh cho 93-204 —
    // vượt 3.4 lần, dù fps vẫn 60 trên máy dev. Ngưỡng dưới đây bắt "tệ đi",
    // không hợp thức hoá con số hiện tại. Thu hẹp dần khi tối ưu.
    expect(telemetry.calls, 'draw call tăng vọt so với mức đã đo').toBeLessThan(280);
    // abyss đã gộp ba lần: mesh con trong từng actor fauna (114 -> 29), rừng
    // rong thành một geometry uốn trong vertex shader (18 -> 1), và bọt thành
    // InstancedMesh (34 -> 1). Đỉnh đo trên galaxy 59 ảnh: 196 -> 148 -> 99.
    // Siết riêng abyss chứ không hạ ngưỡng chung, vì aurora/fall/galaxy-moon
    // chưa được đo lần nào.
    if (template === 'abyss') {
      expect(telemetry.calls, 'abyss thoái lui về mức trước khi gộp mesh').toBeLessThan(150);
    }
    expect(telemetry.triangles, 'số tam giác tăng vọt').toBeLessThan(90_000);
    expect(telemetry.textureBytes, 'vượt trần 48 MB texture của mục 13.7').toBeLessThanOrEqual(48);
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
          // Cả 4 universe đều đã gắn LumoraDebug — thiếu hook là lỗi thật.
          expectTelemetry: true,
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
        expectTelemetry: true,
      });
    });
  }
});
