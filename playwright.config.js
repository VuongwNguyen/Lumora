const { defineConfig, devices } = require('@playwright/test');

// Lumora phục vụ frontend tĩnh từ public/ qua chính Express server, không có
// bundler hay dev server riêng. Playwright dùng lại server đang chạy nếu có,
// nếu không thì tự bật `npm run dev`.
const PORT = process.env.PORT || 3030;
const BASE_URL = `http://localhost:${PORT}`;

module.exports = defineConfig({
  testDir: './tests/visual',
  // tests/ còn chứa suite `node --test`; chỉ nhận file .spec.js để hai bộ không
  // giẫm lên nhau.
  testMatch: '**/*.spec.js',
  outputDir: './tests/visual/.artifacts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // Texture ảnh tải từ ImageKit qua mạng thật, nên thỉnh thoảng chậm quá ngưỡng.
  // Retry 1 lần ở local, 2 ở CI. Nếu một test đỏ ĐỀU ĐẶN thì đó là lỗi thật,
  // không phải mạng.
  retries: process.env.CI ? 2 : 1,
  fullyParallel: false, // scene WebGL đo FPS — chạy song song làm nhiễu số đo
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'tests/visual/.report', open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    // Firefox đứng đầu: Lumora cần browser compatibility và Firefox là nơi
    // WebGL/importmap hay khác Chromium nhất.
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
