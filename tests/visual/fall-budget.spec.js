const { test, expect } = require('@playwright/test');

// fall với galaxy NHIỀU ẢNH — trường hợp duy nhất phơi ra lỗi ngân sách texture.
//
// universes.spec.js đã assert textureBytes <= 48, nhưng nó chạy fall bằng galaxy
// mặc định (template abyss) nên fall render với 0 ảnh và luôn xanh. Trần 489 MB
// sống sót qua mọi lần chạy đúng vì lỗ hổng đó.
const GALAXY = process.env.LUMORA_FALL_GALAXY || '69eba3057a7d444cdd589f39';

// Đo được: cạnh polaroid lớn nhất trên màn hình là 474 px ở đệm cao 1080. Trần
// texture của mỗi tier suy ra từ đó (xem comment đầu public/fall/js/fall.js).
const MAY = [
  { ten: 'low', cores: 4, mem: 3, ua: 'Mozilla/5.0 (Linux; Android 10) Mobile Safari', vp: { width: 390, height: 844 }, tran: 448, mb: 60 },
  { ten: 'mid', cores: 4, mem: 4, ua: null, vp: { width: 1280, height: 800 }, tran: 640, mb: 90 },
  { ten: 'high', cores: 12, mem: 16, ua: null, vp: { width: 1920, height: 1080 }, tran: 832, mb: 140 },
];

for (const m of MAY) {
  test(`fall · tier ${m.ten}`, async ({ page }) => {
    await page.setViewportSize(m.vp);
    // Đặt lại đúng những thứ detectPerformanceTier đọc, thay vì mock chính hàm
    // đó — mock hàm thì test chỉ kiểm cái mock, không kiểm phép dò thật.
    await page.addInitScript(([cores, mem, ua]) => {
      Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => cores });
      Object.defineProperty(navigator, 'deviceMemory', { get: () => mem });
      if (ua) Object.defineProperty(navigator, 'userAgent', { get: () => ua });
    }, [m.cores, m.mem, m.ua]);

    await page.goto(`/view/?galaxyId=${GALAXY}&autostart=true&skip_se=true&debug=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__lumora?.info.render.calls > 0, null, { timeout: 60000 });
    await page.waitForTimeout(12000);

    const r = await page.evaluate(() => {
      const seen = new Set();
      let canh = 0, soAnh = 0;
      window.__lumora.scene.traverse(o => {
        const map = o.material?.map;
        if (!map?.image?.width || seen.has(map)) return;
        seen.add(map);
        if (map.image.width > 200 && map.image.height > 200) {
          soAnh++;
          canh = Math.max(canh, map.image.width, map.image.height);
        }
      });
      return { tier: window.__lumora.tier, cap: window.__lumora.textureCap,
               mb: window.__lumora.textureBytes, canh, soAnh };
    });

    // Galaxy test có thể bị đổi template hoặc xoá ảnh trong DB — đó là lý do
    // harness hỏng chứ không phải ứng dụng hỏng. Nói thẳng ra thay vì đỏ mập mờ.
    test.skip(r.soAnh === 0, `galaxy ${GALAXY} không còn ảnh nào — đặt LUMORA_FALL_GALAXY`);

    expect(r.tier, 'phép dò thiết bị không ra tier mong đợi').toBe(m.ten);
    expect(r.cap, 'trần texture của tier đã đổi').toBe(m.tran);
    expect(r.canh, `ảnh vào scene với cạnh ${r.canh}px, vượt trần ${m.tran}px`)
      .toBeLessThanOrEqual(m.tran);
    // Chốt THOÁI LUI, không phải ngân sách mong muốn: mục 13.7 đặt 48 MB, đo
    // thật cho 36/50/88 MB. Trước khi có tier là 508-553 MB ở mọi thiết bị.
    expect(r.mb, `texture ${r.mb} MB, thoái lui về mức trước khi có tier`)
      .toBeLessThanOrEqual(m.mb);
  });
}
