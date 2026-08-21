// Helper dùng chung cho visual QA của các universe Lumora.
//
// Lumora không có bundler: mỗi universe là một HTML tự chứa nạp three@0.152.2
// qua importmap từ unpkg. Nghĩa là scene chỉ tồn tại trong browser thật, và
// cách duy nhất để BIẾT nó đúng là mở ra xem — không phải đọc code.

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

// Universe có scene WebGL. `galaxyId` để trống nghĩa là chạy empty state.
const UNIVERSES = ['abyss', 'aurora', 'fall', 'galaxy-moon'];

const TEST_GALAXY = process.env.LUMORA_TEST_GALAXY || '';
// /view/ chọn template theo cấu hình của galaxy, không theo URL. Muốn test
// universe khác thì cần galaxy được cấu hình universe đó.
const TEST_TEMPLATE = process.env.LUMORA_TEST_TEMPLATE || 'abyss';

// Điểm vào THẬT của Lumora là /view/?galaxyId=..., không phải /{template}/.
// `/abyss/?galaxyId=X` trả 302 sang /view/ và nuốt luôn mọi query khác, nên test
// thẳng vào thư mục template là test một đường người dùng không bao giờ đi qua.
//
// Trong /view/, nếu galaxy có `storyType` thì server phục vụ template `story`
// bất kể `galaxy.template` — chỉ `skip_se=true` mới ép về universe gốc.
function universeUrl(template, { galaxyId = TEST_GALAXY, debug = true, autostart = true } = {}) {
  const params = new URLSearchParams();
  if (debug) params.set('debug', '1');
  if (autostart) params.set('autostart', 'true');
  if (!galaxyId) return `/${template}/?${params}`;
  params.set('galaxyId', galaxyId);
  params.set('skip_se', 'true'); // bỏ qua Story Emotion để test đúng universe
  return `/view/?${params}`;
}

// Đường mặc định người nhận link thật sẽ đi: không skip_se, không autostart.
function shareUrl(galaxyId = TEST_GALAXY) {
  return `/view/?galaxyId=${encodeURIComponent(galaxyId)}`;
}

// Cổng "Tap to begin" của Story Emotion và #intro của universe đều chặn scene.
// Người dùng bấm qua chúng, nên harness cũng phải bấm — nếu không ta chỉ chụp
// được overlay và tưởng là đã thấy scene.
async function dismissGates(page) {
  const gates = ['#intro:not(.hidden)', '[data-arrival-gate]', '.story-gate', '#story-intro'];
  for (const selector of gates) {
    const gate = page.locator(selector).first();
    if (await gate.count() && await gate.isVisible().catch(() => false)) {
      await gate.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(400);
    }
  }
  // Overlay không có selector ổn định thì bấm giữa màn hình một lần.
  await page.mouse.click(10, 10).catch(() => {});
}

// Gom lỗi console và lỗi trang. Bỏ qua tiếng ồn không phải lỗi thật của ta:
// unpkg đôi khi trả cảnh báo, và WebGL báo context loss khi tab bị ẩn.
const IGNORED = [
  /favicon/i,
  /Download the React DevTools/i,
  /\[vite\]/i,
];

function collectErrors(page) {
  const errors = [];
  page.on('console', message => {
    if (message.type() !== 'error') return;
    const text = message.text();
    if (IGNORED.some(pattern => pattern.test(text))) return;
    errors.push(`console: ${text}`);
  });
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', request => {
    const url = request.url();
    if (IGNORED.some(pattern => pattern.test(url))) return;
    errors.push(`requestfailed: ${url} — ${request.failure()?.errorText}`);
  });
  return errors;
}

// Chờ scene thật sự vẽ được frame, không chỉ chờ DOM. Điều kiện là renderer đã
// phát ra draw call — canvas tồn tại mà 0 draw call nghĩa là scene rỗng.
async function waitForScene(page, { timeout = 30_000 } = {}) {
  await page.waitForSelector('canvas', { timeout });
  const telemetry = await page.waitForFunction(
    () => {
      const lumora = window.__lumora;
      if (!lumora) return 'no-hook';
      return lumora.info.render.calls > 0 ? 'ready' : false;
    },
    null,
    { timeout },
  ).then(handle => handle.jsonValue()).catch(() => 'timeout');
  return telemetry;
}

async function readTelemetry(page) {
  return page.evaluate(() => {
    const lumora = window.__lumora;
    if (!lumora) return null;
    const info = lumora.info;
    return {
      template: lumora.template,
      calls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? null,
      fps: lumora.fps,
      depth: lumora.depth,
      phase: lumora.phase,
      textureBytes: lumora.textureBytes,
    };
  });
}

// Trang không bao giờ được cuộn ngang. Với scene toàn màn hình, tràn ngang
// nghĩa là một overlay HTML bị đẩy ra ngoài viewport.
async function horizontalOverflow(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
}

// Canvas phải PHỦ HẾT viewport. Kiểm tràn ngang không bắt được lỗi ngược lại:
// canvas nhỏ hơn viewport để lộ nền trắng quanh mép — chói gắt trên scene tối và
// là dấu hiệu resize handler không chạy. Đã bắt được aurora theo cách này.
async function canvasCoverage(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      canvas: { w: Math.round(rect.width), h: Math.round(rect.height) },
      viewport: { w: window.innerWidth, h: window.innerHeight },
      gapX: Math.round(window.innerWidth - rect.width),
      gapY: Math.round(window.innerHeight - rect.height),
    };
  });
}

module.exports = {
  VIEWPORTS,
  UNIVERSES,
  TEST_GALAXY,
  TEST_TEMPLATE,
  universeUrl,
  shareUrl,
  dismissGates,
  collectErrors,
  waitForScene,
  readTelemetry,
  horizontalOverflow,
  canvasCoverage,
};
