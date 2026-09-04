const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { VIEWPORTS, seedSession, collectErrors } = require('./helpers/chrome');

// Hộp thoại rà soát đơn hàng chỉ hiện sau hai cú nhấp, nên nó không nằm trong
// chrome.spec.js (chụp trang tĩnh) và đã trôi khỏi mọi phép kiểm: nền còn là
// tím-đen #0e0d1a của bảng màu cũ, và cột grid bị đảo làm nhãn "Kích hoạt dự
// kiến" tụt thành bốn dòng một chữ. Người dùng tự nhìn thấy mới biết.
test.use({ locale: 'vi-VN' });

// Đếm số DÒNG CHỮ, không phải chiều cao hộp: trong grid, dt giãn theo chiều cao
// của cả hàng (align-items mặc định là stretch), nên khi ô giá trị nở ra bốn
// dòng thì dt.getBoundingClientRect().height cũng là bốn dòng dù chữ chỉ một
// dòng. Range.getClientRects() trả về một hình chữ nhật cho mỗi line box của
// CHỮ, nên nó miễn nhiễm với chuyện đó.
const DEM_DONG = `(el) => {
  const r = document.createRange();
  r.selectNodeContents(el);
  return r.getClientRects().length;
}`;

async function moHopThoai(page) {
  await seedSession(page);
  await page.goto('/portal/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /Gói dịch vụ/ }).click();
  await page.waitForTimeout(700);
  await page.locator('.btn-subscribe').first().click();
  await page.waitForTimeout(900);
  await expect(page.locator('#checkout-overlay:not([hidden])')).toHaveCount(1);
}

for (const viewport of VIEWPORTS) {
  test(`rà soát đơn hàng · ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const errors = collectErrors(page);
    await moHopThoai(page);

    // 1. Nhãn không được xuống dòng.
    //
    // grid-template-columns từng là `1fr auto`: nhãn nhận 1fr, giá trị nhận
    // auto. Giá trị dài ăn hết chỗ rồi bóp nhãn xuống bằng TỪ DÀI NHẤT của nó.
    // Đo số dòng thay vì so ảnh: ảnh đổi theo font và ngày hết hạn, số dòng thì
    // không.
    const nhan = await page.evaluate(demDong => {
      const dem = eval(demDong);
      return [...document.querySelectorAll('.checkout-summary dt')]
        .map(dt => ({ chu: dt.textContent, soDong: dem(dt) }));
    }, DEM_DONG);
    expect(nhan.length, 'không có dòng tóm tắt nào').toBeGreaterThan(4);
    const xuongDong = nhan.filter(n => n.soDong > 1).map(n => n.chu);
    expect(xuongDong, `nhãn bị xuống dòng: ${xuongDong.join(', ')}`).toEqual([]);

    // 1b. Và phải CHỊU ĐƯỢC giá trị dài.
    //
    // Gỡ câu thuế ra khỏi <dl> đã làm nhãn hết xuống dòng, nhưng cột grid vẫn
    // sai chiều thì lỗi chỉ đang ngủ: thêm bất kỳ giá trị dài nào sau này là nó
    // trở lại. Bơm một chuỗi dài vào rồi đo lại — đó mới là bất biến thật.
    const nhanSauKhiBom = await page.evaluate(demDong => {
      const dem = eval(demDong);
      const dd = document.querySelector('.checkout-summary dd:last-of-type');
      const cu = dd.textContent;
      dd.textContent = 'Một giá trị rất dài dùng để kiểm tra rằng cột nhãn không bị bóp lại khi giá trị bên phải nở ra';
      const ra = [...document.querySelectorAll('.checkout-summary dt')]
        .map(dt => ({ chu: dt.textContent, soDong: dem(dt) }));
      dd.textContent = cu;
      return ra;
    }, DEM_DONG);
    const bopNhan = nhanSauKhiBom.filter(n => n.soDong > 1).map(n => n.chu);
    expect(bopNhan, `giá trị dài bóp nhãn xuống dòng: ${bopNhan.join(', ')} — cột grid sai chiều`)
      .toEqual([]);

    // 2. Hộp thoại phải cùng tông ẤM với phần còn lại của ứng dụng.
    // Bảng sơn mài luôn có đỏ >= lam ở mọi mức sáng; lam vượt đỏ là tàn dư cũ.
    const mau = await page.evaluate(() => {
      const rgb = s => (getComputedStyle(document.querySelector(s)).backgroundColor.match(/\d+/g) || []).map(Number);
      return { hopThoai: rgb('.checkout-dialog'), than: rgb('body') };
    });
    expect(mau.hopThoai[2], `nền hộp thoại rgb(${mau.hopThoai}) lạnh hơn nền thân trang — lạc tông`)
      .toBeLessThanOrEqual(mau.hopThoai[0]);

    // 3. Câu thuế nằm NGOÀI <dl>: nó là đoạn chú thích ~150 ký tự, nhét vào
    // danh sách nhãn-giá trị thì bị canh phải trong cột hẹp.
    await expect(page.locator('#checkout-tax')).toBeVisible();
    expect(await page.locator('.checkout-summary').innerText())
      .not.toMatch(/Thuế \/ phí/);

    const shot = path.join(__dirname, '.shots', testInfo.project.name, `checkout-${viewport.name}.png`);
    await page.locator('.checkout-dialog').screenshot({ path: shot });
    await testInfo.attach(`checkout-${viewport.name}`, { path: shot, contentType: 'image/png' });

    expect(errors.filter(e => !/401|403/.test(e)), `lỗi console:\n${errors.join('\n')}`).toEqual([]);
  });
}
