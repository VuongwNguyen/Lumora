# Error Code + i18n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backend trả kèm mã lỗi ổn định, frontend tra mã đó ra chuỗi đã dịch — để người dùng tiếng Việt không còn nhận thông báo lỗi tiếng Anh, và để luồng điều khiển của FE không còn phụ thuộc vào nội dung chuỗi.

**Architecture:** `errorResponse` nhận thêm `code` (tuỳ chọn) và `details` (tham số cho message có biến). Handler lỗi toàn cục đưa `errorCode` / `errorDetails` vào JSON. FE có một resolver thuần tra `errorCode` → key i18n, và **luôn fallback về `message` của server** khi không có mã — nên mọi endpoint chưa migrate vẫn chạy y như cũ. Migrate dần từng service.

**Tech Stack:** Express 5 (CommonJS), JS thuần phía client, `node --test`, không thêm dependency.

---

## Bối cảnh

### Vì sao làm việc này

`index.js` từng che mọi message ở production thành `"Internal server error"`; đã sửa để chỉ che lỗi ngoài dự kiến. Hệ quả: message thật hiện lên, **nhưng phần lớn là tiếng Anh trên giao diện tiếng Việt**.

| Service | Tổng message | Tiếng Anh |
|---|---|---|
| `auth.service.js` | 30 | **25** |
| `galaxy.service.js` | 27 | 9 |
| `soundcloud.service.js` | 5 | 5 |
| `support.service.js` | 7 | 0 |
| `payment.service.js` | 13 | 0 |
| `gallery.service.js` | 7 | 0 |

Validate ở FE đã bịt các lỗi FE tự biết (email sai định dạng, mật khẩu ngắn). Còn lại thì không thể: `Invalid credentials`, `Email already exists`, `OTP expired`, `Current password is incorrect` — chỉ server biết.

### Lý do mạnh nhất, không phải i18n

`public/auth/js/main.js:190`:

```js
if (res.status === 403 && data.message && data.message.includes('not verified')) {
  showOtpScreen(email);
  return;
}
```

**Luồng điều khiển của FE đang phụ thuộc vào chuỗi tiếng Anh.** Dịch message sang tiếng Việt sẽ làm màn hình OTP không bao giờ hiện ra — hỏng âm thầm, không lỗi, không test nào bắt. Đây là lý do phải làm mã lỗi trước khi làm i18n, không phải ngược lại.

### Ràng buộc

- **Tương thích ngược tuyệt đối.** Endpoint chưa có `code` phải chạy y hệt hôm nay. Không migrate một lượt.
- **Không đổi `message` tiếng Anh ở backend** trong plan này. Chúng vẫn là fallback và là thứ hiện trong log. Đổi chúng là việc riêng, sau khi mã lỗi đã phủ hết.
- `i18n.js` đã hỗ trợ giá trị là hàm (`btnResendCountdown: (s) => ...`), nên message có tham số dùng được cơ chế sẵn có.
- Chỉ có hai ngôn ngữ: `LANG.vi` và `LANG.en` trong `public/shared/js/i18n.js`.

---

## File Structure

**Tạo mới:**

| File | Trách nhiệm |
|---|---|
| `context/errorCodes.js` | Danh sách mã lỗi chuẩn (backend, CommonJS). Nguồn sự thật duy nhất. |
| `public/shared/js/errorMessages.js` | Resolver phía client: `errorCode` → chuỗi đã dịch, fallback về `message`. Không phụ thuộc DOM. |
| `tests/error-codes.test.js` | Mã lỗi phải khớp giữa backend, i18n vi, i18n en; resolver phải fallback đúng. |

**Sửa:**

| File | Thay đổi |
|---|---|
| `context/responseHandle.js` | `errorResponse` nhận `code` và `details` |
| `index.js` | Handler lỗi đưa `errorCode` / `errorDetails` vào JSON |
| `services/auth.service.js` | Gắn `code` cho 30 chỗ throw |
| `public/shared/js/i18n.js` | Thêm nhánh `errors` cho vi và en |
| `public/auth/js/main.js` | Dùng resolver; đổi so chuỗi thành so mã |
| `public/portal/js/main.js` | Dùng resolver cho đổi mật khẩu và xoá tài khoản |
| `public/auth/index.html`, `public/portal/index.html` | Nạp `errorMessages.js` |
| `package.json` | Thêm `test:errors` vào `npm test` |

Ranh giới: `context/errorCodes.js` **không** import gì và **không** chứa chuỗi hiển thị — chỉ là danh sách mã. Chuỗi sống trong `i18n.js`. Nhờ vậy test có thể đối chiếu hai bên mà không kéo theo Express hay DOM.

---

### Task 1: `context/errorCodes.js` — danh sách mã chuẩn

**Files:**
- Create: `context/errorCodes.js`
- Test: `tests/error-codes.test.js`

- [ ] **Step 1: Viết test thất bại**

Tạo `tests/error-codes.test.js`:

```js
const test = require('node:test');
const assert = require('node:assert/strict');

test('ERROR_CODES là object phẳng, giá trị trùng khoá', () => {
  const { ERROR_CODES } = require('../context/errorCodes');
  assert.ok(Object.keys(ERROR_CODES).length > 0);
  for (const [key, value] of Object.entries(ERROR_CODES)) {
    // Giá trị trùng khoá để đọc log ra là biết ngay mã nào, không phải tra ngược.
    assert.equal(value, key, `${key} có giá trị ${value}`);
    assert.match(key, /^[A-Z][A-Z0-9_]*$/, `${key} sai định dạng`);
  }
});

test('ERROR_CODES bị đóng băng, không sửa được lúc chạy', () => {
  const { ERROR_CODES } = require('../context/errorCodes');
  assert.ok(Object.isFrozen(ERROR_CODES));
});

test('isErrorCode nhận mã hợp lệ và từ chối mã lạ', () => {
  const { ERROR_CODES, isErrorCode } = require('../context/errorCodes');
  assert.equal(isErrorCode(ERROR_CODES.INVALID_CREDENTIALS), true);
  assert.equal(isErrorCode('KHONG_TON_TAI'), false);
  assert.equal(isErrorCode(undefined), false);
  assert.equal(isErrorCode(''), false);
});

test('có đủ mã cho mọi lỗi auth đang tồn tại', () => {
  const { ERROR_CODES } = require('../context/errorCodes');
  const required = [
    'INVALID_EMAIL_FORMAT', 'PASSWORD_TOO_SHORT', 'EMAIL_ALREADY_EXISTS',
    'EMAIL_NOT_VERIFIED', 'EMAIL_ALREADY_VERIFIED', 'EMAIL_NOT_FOUND',
    'INVALID_REQUEST', 'OTP_NOT_FOUND', 'OTP_EXPIRED', 'OTP_INVALID',
    'OTP_TOO_MANY_ATTEMPTS', 'OTP_RESEND_COOLDOWN', 'INVALID_CREDENTIALS',
    'INCORRECT_PASSWORD', 'CURRENT_PASSWORD_INCORRECT', 'USER_NOT_FOUND',
    'ACCOUNT_LOCKED', 'RESET_SESSION_INVALID',
  ];
  for (const code of required) {
    assert.ok(ERROR_CODES[code], `thiếu mã ${code}`);
  }
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `node --test tests/error-codes.test.js`
Expected: FAIL — `Cannot find module '../context/errorCodes'`

- [ ] **Step 3: Viết implementation**

Tạo `context/errorCodes.js`:

```js
/**
 * Mã lỗi chuẩn của Lumora.
 *
 * Đây là nguồn sự thật duy nhất. File này KHÔNG chứa chuỗi hiển thị và KHÔNG
 * import gì — chuỗi sống trong public/shared/js/i18n.js, và tests/error-codes
 * đối chiếu hai bên. Tách như vậy để test chạy được mà không cần Express hay DOM.
 *
 * Giá trị luôn trùng khoá: đọc log thấy "OTP_EXPIRED" là biết ngay mã nào, không
 * phải tra ngược qua một bảng số.
 */
const ERROR_CODES = Object.freeze({
  // Đăng ký / định dạng đầu vào
  INVALID_EMAIL_FORMAT: 'INVALID_EMAIL_FORMAT',
  PASSWORD_TOO_SHORT: 'PASSWORD_TOO_SHORT',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  INVALID_REQUEST: 'INVALID_REQUEST',

  // Xác thực email
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  EMAIL_ALREADY_VERIFIED: 'EMAIL_ALREADY_VERIFIED',
  EMAIL_NOT_FOUND: 'EMAIL_NOT_FOUND',

  // OTP
  OTP_NOT_FOUND: 'OTP_NOT_FOUND',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_INVALID: 'OTP_INVALID',
  OTP_TOO_MANY_ATTEMPTS: 'OTP_TOO_MANY_ATTEMPTS',
  OTP_RESEND_COOLDOWN: 'OTP_RESEND_COOLDOWN',

  // Đăng nhập / mật khẩu
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INCORRECT_PASSWORD: 'INCORRECT_PASSWORD',
  CURRENT_PASSWORD_INCORRECT: 'CURRENT_PASSWORD_INCORRECT',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  RESET_SESSION_INVALID: 'RESET_SESSION_INVALID',

  // Tài khoản
  USER_NOT_FOUND: 'USER_NOT_FOUND',
});

function isErrorCode(value) {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(ERROR_CODES, value);
}

module.exports = { ERROR_CODES, isErrorCode };
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `node --test tests/error-codes.test.js`
Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add context/errorCodes.js tests/error-codes.test.js
git commit -m "feat(errors): danh sách mã lỗi chuẩn cho auth"
```

---

### Task 2: `errorResponse` mang mã lỗi

**Files:**
- Modify: `context/responseHandle.js`
- Modify: `index.js` (handler lỗi)
- Test: `tests/error-codes.test.js` (bổ sung)

- [ ] **Step 1: Viết test thất bại**

Thêm vào cuối `tests/error-codes.test.js`:

```js
test('errorResponse giữ code và details, mặc định là undefined', () => {
  const { errorResponse } = require('../context/responseHandle');
  const { ERROR_CODES } = require('../context/errorCodes');

  const plain = new errorResponse({ message: 'x', statusCode: 400 });
  assert.equal(plain.code, undefined);
  assert.equal(plain.details, undefined);

  const coded = new errorResponse({
    message: 'OTP expired', statusCode: 400,
    code: ERROR_CODES.OTP_EXPIRED, details: { wait: 30 },
  });
  assert.equal(coded.code, 'OTP_EXPIRED');
  assert.deepEqual(coded.details, { wait: 30 });
  assert.equal(coded.message, 'OTP expired');
  assert.ok(coded instanceof Error);
});

test('errorResponse từ chối mã không có trong danh sách', () => {
  const { errorResponse } = require('../context/responseHandle');
  assert.throws(
    () => new errorResponse({ message: 'x', statusCode: 400, code: 'BIA_RA' }),
    /mã lỗi không hợp lệ/i,
  );
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `node --test tests/error-codes.test.js`
Expected: FAIL — `coded.code` là `undefined`

- [ ] **Step 3: Sửa `context/responseHandle.js`**

Thay class `errorResponse` bằng:

```js
  const { isErrorCode } = require("./errorCodes");

  class errorResponse extends Error {
    constructor({ message = "", statusResponse = false, statusCode = 500, code, details }) {
      super(message);
      this.statusResponse = statusResponse;
      this.statusCode = statusCode;
      // Ném ngay khi gõ sai mã, thay vì để FE âm thầm fallback về message tiếng
      // Anh và không ai biết mã đó chưa bao giờ tồn tại.
      if (code !== undefined && !isErrorCode(code)) {
        throw new Error(`errorResponse: mã lỗi không hợp lệ "${code}"`);
      }
      this.code = code;
      // Tham số cho message có biến, ví dụ { wait: 30 } cho OTP_RESEND_COOLDOWN.
      this.details = details;
    }
  }
```

Đặt dòng `require` ở đầu file, trên `class successfullyResponse`.

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `node --test tests/error-codes.test.js`
Expected: PASS — 6 tests

- [ ] **Step 5: Đưa mã vào response JSON**

Trong `index.js`, thay khối `res.status(...).json({...})` cuối handler lỗi bằng:

```js
  const safeMessage = err instanceof errorResponse ? err.message : "Internal server error";
  const payload = {
    statusResponse: err.statusResponse || false,
    message: isDev ? err.message : safeMessage,
    statusCode: err.statusCode || 500,
  };
  // Chỉ gắn khi có, để response của endpoint chưa migrate không đổi một byte nào.
  // Và CHỈ cho errorResponse: lỗi thư viện cũng mang .code (fs cho 'ENOENT',
  // MongoDB cho 11000 khi trùng khoá) và chúng đi thẳng vào handler này khi
  // không được bọc. Thiếu guard là rò rỉ chi tiết nội bộ ra client — đúng thứ
  // safeMessage sinh ra để chặn.
  if (err instanceof errorResponse) {
    if (err.code) payload.errorCode = err.code;
    if (err.details) payload.errorDetails = err.details;
  }
  res.status(err.statusCode || 500).json(payload);
```

- [ ] **Step 6: Kiểm response chưa migrate không đổi**

Run:
```bash
npm run dev &
sleep 4
curl -s -X POST http://localhost:3030/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"a@b.co","password":"123"}'
```
Expected: `{"statusResponse":false,"message":"Password must be at least 8 characters","statusCode":400}` — **không có** `errorCode`, vì `auth.service.js` chưa gắn mã.

- [ ] **Step 7: Commit**

```bash
git add context/responseHandle.js index.js tests/error-codes.test.js
git commit -m "feat(errors): errorResponse mang code/details, handler trả errorCode"
```

---

### Task 3: Resolver phía client + i18n

**Files:**
- Create: `public/shared/js/errorMessages.js`
- Modify: `public/shared/js/i18n.js`
- Test: `tests/error-codes.test.js` (bổ sung)

- [ ] **Step 1: Viết test thất bại**

Thêm vào cuối `tests/error-codes.test.js`:

```js
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadBrowserGlobal(relativePath, globalName, context = {}) {
  const source = fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
  const sandbox = { window: {}, navigator: { languages: ['vi'] }, localStorage: { getItem: () => null }, ...context };
  sandbox.window = sandbox.window || {};
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window[globalName] ?? sandbox[globalName];
}

test('mọi mã lỗi đều có chuỗi ở CẢ vi lẫn en', () => {
  const { ERROR_CODES } = require('../context/errorCodes');
  const source = fs.readFileSync(path.join(__dirname, '../public/shared/js/i18n.js'), 'utf8');
  const viBlock = source.slice(source.indexOf('vi: {'), source.indexOf('en: {'));
  const enBlock = source.slice(source.indexOf('en: {'));
  for (const code of Object.keys(ERROR_CODES)) {
    assert.ok(viBlock.includes(code + ':'), `vi thiếu chuỗi cho ${code}`);
    assert.ok(enBlock.includes(code + ':'), `en thiếu chuỗi cho ${code}`);
  }
});

test('resolver tra mã ra chuỗi đã dịch', () => {
  const resolve = loadBrowserGlobal('../public/shared/js/errorMessages.js', 'LumoraErrors').resolve;
  const dict = { errors: { OTP_EXPIRED: 'Mã OTP đã hết hạn' }, errGeneric: 'Có lỗi xảy ra' };
  assert.equal(resolve({ errorCode: 'OTP_EXPIRED', message: 'OTP expired' }, dict), 'Mã OTP đã hết hạn');
});

test('resolver truyền details vào chuỗi dạng hàm', () => {
  const resolve = loadBrowserGlobal('../public/shared/js/errorMessages.js', 'LumoraErrors').resolve;
  const dict = { errors: { OTP_RESEND_COOLDOWN: (d) => `Vui lòng đợi ${d.wait} giây` }, errGeneric: 'x' };
  const out = resolve({ errorCode: 'OTP_RESEND_COOLDOWN', errorDetails: { wait: 30 }, message: 'Please wait 30 seconds' }, dict);
  assert.equal(out, 'Vui lòng đợi 30 giây');
});

test('không có mã thì fallback về message của server', () => {
  const resolve = loadBrowserGlobal('../public/shared/js/errorMessages.js', 'LumoraErrors').resolve;
  const dict = { errors: {}, errGeneric: 'Có lỗi xảy ra' };
  assert.equal(resolve({ message: 'Email already exists' }, dict), 'Email already exists');
});

test('mã lạ hoặc thiếu chuỗi thì vẫn fallback, không ra undefined', () => {
  const resolve = loadBrowserGlobal('../public/shared/js/errorMessages.js', 'LumoraErrors').resolve;
  const dict = { errors: {}, errGeneric: 'Có lỗi xảy ra' };
  assert.equal(resolve({ errorCode: 'MA_LA', message: 'raw' }, dict), 'raw');
  assert.equal(resolve({ errorCode: 'MA_LA' }, dict), 'Có lỗi xảy ra');
  assert.equal(resolve(null, dict), 'Có lỗi xảy ra');
  assert.equal(resolve(undefined, dict), 'Có lỗi xảy ra');
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `node --test tests/error-codes.test.js`
Expected: FAIL — không đọc được `public/shared/js/errorMessages.js`

- [ ] **Step 3: Viết resolver**

Tạo `public/shared/js/errorMessages.js`:

```js
/**
 * Tra mã lỗi từ server ra chuỗi đã dịch.
 *
 * Thứ tự ưu tiên, và thứ tự này là điểm mấu chốt của tương thích ngược:
 *   1. errorCode có chuỗi trong từ điển  → dùng chuỗi đã dịch
 *   2. server có message                 → dùng nguyên message đó
 *   3. còn lại                           → thông báo chung
 *
 * Nhờ bước 2, mọi endpoint CHƯA gắn mã vẫn hiển thị y như trước khi có file này.
 * Migrate được từng endpoint một, không phải đổi một lượt.
 */
(function (root) {
  function resolve(data, dict, fallback) {
    var dictionary = dict || root.t || {};
    var generic = fallback || dictionary.errGeneric || 'Error';
    if (!data) return generic;

    var entry = data.errorCode && dictionary.errors ? dictionary.errors[data.errorCode] : null;
    // Chuỗi dạng hàm nhận details, ví dụ (d) => `Đợi ${d.wait} giây`.
    if (typeof entry === 'function') return entry(data.errorDetails || {});
    if (typeof entry === 'string') return entry;

    return data.message || generic;
  }

  // So mã thay vì so chuỗi. FE từng rẽ nhánh bằng message.includes('not
  // verified') — dịch message sang tiếng Việt là luồng đó hỏng âm thầm.
  function is(data, code) {
    return !!data && data.errorCode === code;
  }

  root.LumoraErrors = { resolve: resolve, is: is };
})(window);
```

- [ ] **Step 4: Thêm nhánh `errors` vào i18n**

Trong `public/shared/js/i18n.js`, thêm vào **cuối khối `vi:`** (ngay trước dấu `},` đóng khối vi):

```js
    errors: {
      INVALID_EMAIL_FORMAT: 'Email không đúng định dạng',
      PASSWORD_TOO_SHORT: 'Mật khẩu phải có ít nhất 8 ký tự',
      EMAIL_ALREADY_EXISTS: 'Email này đã được đăng ký',
      INVALID_REQUEST: 'Yêu cầu không hợp lệ',
      EMAIL_NOT_VERIFIED: 'Email chưa được xác thực. Mã OTP mới đã được gửi.',
      EMAIL_ALREADY_VERIFIED: 'Email này đã được xác thực',
      EMAIL_NOT_FOUND: 'Không tìm thấy email này',
      OTP_NOT_FOUND: 'Không tìm thấy mã OTP, vui lòng đăng ký lại',
      OTP_EXPIRED: 'Mã OTP đã hết hạn, vui lòng yêu cầu mã mới',
      OTP_INVALID: 'Mã OTP không đúng',
      OTP_TOO_MANY_ATTEMPTS: 'Bạn đã thử sai quá nhiều lần, vui lòng bắt đầu lại',
      OTP_RESEND_COOLDOWN: (d) => `Vui lòng đợi ${d.wait} giây trước khi gửi lại`,
      INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng',
      INCORRECT_PASSWORD: 'Mật khẩu không đúng',
      CURRENT_PASSWORD_INCORRECT: 'Mật khẩu hiện tại không đúng',
      ACCOUNT_LOCKED: (d) => `Tài khoản tạm khoá. Thử lại sau ${d.wait} phút.`,
      RESET_SESSION_INVALID: 'Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
      USER_NOT_FOUND: 'Không tìm thấy người dùng',
    },
```

và vào **cuối khối `en:`**:

```js
    errors: {
      INVALID_EMAIL_FORMAT: 'Invalid email format',
      PASSWORD_TOO_SHORT: 'Password must be at least 8 characters',
      EMAIL_ALREADY_EXISTS: 'This email is already registered',
      INVALID_REQUEST: 'Invalid request',
      EMAIL_NOT_VERIFIED: 'Email not verified. A new OTP has been sent.',
      EMAIL_ALREADY_VERIFIED: 'This email is already verified',
      EMAIL_NOT_FOUND: 'Email not found',
      OTP_NOT_FOUND: 'No OTP found, please register again',
      OTP_EXPIRED: 'OTP expired, please request a new one',
      OTP_INVALID: 'Invalid OTP',
      OTP_TOO_MANY_ATTEMPTS: 'Too many failed attempts, please start again',
      OTP_RESEND_COOLDOWN: (d) => `Please wait ${d.wait} seconds before requesting again`,
      INVALID_CREDENTIALS: 'Incorrect email or password',
      INCORRECT_PASSWORD: 'Incorrect password',
      CURRENT_PASSWORD_INCORRECT: 'Current password is incorrect',
      ACCOUNT_LOCKED: (d) => `Account locked. Try again in ${d.wait} minute(s).`,
      RESET_SESSION_INVALID: 'Invalid or expired reset session',
      USER_NOT_FOUND: 'User not found',
    },
```

- [ ] **Step 5: Chạy test để xác nhận pass**

Run: `node --test tests/error-codes.test.js`
Expected: PASS — 11 tests

- [ ] **Step 6: Commit**

```bash
git add public/shared/js/errorMessages.js public/shared/js/i18n.js tests/error-codes.test.js
git commit -m "feat(errors): resolver phía client và chuỗi vi/en cho mã lỗi"
```

---

### Task 4: Gắn mã cho `auth.service.js`

**Files:**
- Modify: `services/auth.service.js`
- Test: `tests/error-codes.test.js` (bổ sung guard)

- [ ] **Step 1: Viết guard test thất bại**

Thêm vào `tests/error-codes.test.js`:

```js
test('mọi errorResponse trong auth.service.js đều có code', () => {
  const source = fs.readFileSync(path.join(__dirname, '../services/auth.service.js'), 'utf8');
  // Bắt từng lời gọi `new errorResponse({ ... })`, kể cả xuống dòng.
  const calls = source.match(/new errorResponse\(\{[\s\S]*?\}\)/g) || [];
  assert.ok(calls.length >= 25, `chỉ tìm thấy ${calls.length} lời gọi, nghi regex sai`);
  const missing = calls.filter(call => !/\bcode:\s*ERROR_CODES\./.test(call));
  assert.deepEqual(missing, [], `còn ${missing.length} chỗ chưa gắn code`);
});
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

Run: `node --test tests/error-codes.test.js`
Expected: FAIL — 30 chỗ chưa gắn `code`

- [ ] **Step 3: Gắn mã**

Ở đầu `services/auth.service.js`, cạnh dòng require sẵn có:

```js
const { ERROR_CODES } = require("../context/errorCodes");
```

Rồi thêm `code:` cho từng chỗ throw. Bảng ánh xạ đầy đủ — **giữ nguyên `message` và `statusCode`**, chỉ thêm `code`:

| `message` hiện tại | `code` |
|---|---|
| `Invalid email format` | `INVALID_EMAIL_FORMAT` |
| `Password must be at least 8 characters` | `PASSWORD_TOO_SHORT` |
| `Email already exists` | `EMAIL_ALREADY_EXISTS` |
| `Invalid request` | `INVALID_REQUEST` |
| `Email not verified. A new OTP has been sent.` | `EMAIL_NOT_VERIFIED` |
| `Email already verified` | `EMAIL_ALREADY_VERIFIED` |
| `Email not found` | `EMAIL_NOT_FOUND` |
| `No OTP found, please register again` | `OTP_NOT_FOUND` |
| `OTP expired, please request again` | `OTP_EXPIRED` |
| `OTP expired, please request a new one` | `OTP_EXPIRED` |
| `Invalid OTP` | `OTP_INVALID` |
| `Too many failed attempts. Please register again.` | `OTP_TOO_MANY_ATTEMPTS` |
| `Too many failed attempts. Please request again.` | `OTP_TOO_MANY_ATTEMPTS` |
| `Invalid credentials` | `INVALID_CREDENTIALS` |
| `Incorrect password` | `INCORRECT_PASSWORD` |
| `Current password is incorrect` | `CURRENT_PASSWORD_INCORRECT` |
| `Invalid or expired reset session` | `RESET_SESSION_INVALID` |
| `User not found` | `USER_NOT_FOUND` |

Ba chỗ dùng template phải chuyển tham số sang `details` (giữ nguyên `message` để log và fallback vẫn đọc được):

```js
// dòng ~113
throw new errorResponse({
  message: `Please wait ${wait} seconds before requesting a new OTP`, statusCode: 429,
  code: ERROR_CODES.OTP_RESEND_COOLDOWN, details: { wait },
});

// dòng ~135
throw new errorResponse({
  message: `Account locked. Try again in ${wait} minute(s).`, statusCode: 423,
  code: ERROR_CODES.ACCOUNT_LOCKED, details: { wait },
});

// dòng ~170
throw new errorResponse({
  message: `Please wait ${wait} seconds before requesting again`, statusCode: 429,
  code: ERROR_CODES.OTP_RESEND_COOLDOWN, details: { wait },
});
```

- [ ] **Step 4: Chạy test để xác nhận pass**

Run: `node --test tests/error-codes.test.js`
Expected: PASS — 12 tests

- [ ] **Step 5: Kiểm response thật**

Run:
```bash
curl -s -X POST http://localhost:3030/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"a@b.co","password":"123"}'
```
Expected: JSON có `"errorCode":"PASSWORD_TOO_SHORT"` **và vẫn giữ** `"message":"Password must be at least 8 characters"`.

- [ ] **Step 6: Chạy toàn bộ test**

Run: `npm test`
Expected: mọi suite PASS. Nếu `tmdt-compliance` đỏ, đọc assertion nào vỡ — có thể nó grep `auth.service.js` — và trỏ sang bất biến mới **trong cùng commit**, đừng xoá.

- [ ] **Step 7: Commit**

```bash
git add services/auth.service.js tests/error-codes.test.js
git commit -m "feat(errors): gắn mã lỗi cho toàn bộ auth.service"
```

---

### Task 5: FE auth dùng mã thay vì chuỗi

**Files:**
- Modify: `public/auth/index.html`
- Modify: `public/auth/js/main.js`

- [ ] **Step 1: Nạp resolver**

Trong `public/auth/index.html`, thêm ngay **trước** thẻ nạp `./js/main.js`:

```html
  <script src="/shared/js/errorMessages.js?v=20260821-1"></script>
```

Xác nhận `i18n.js` đã được nạp trước đó — resolver đọc `window.t` khi không truyền từ điển.

- [ ] **Step 2: Thay so chuỗi bằng so mã**

Trong `public/auth/js/main.js`, thay:

```js
    if (res.status === 403 && data.message && data.message.includes('not verified')) {
      showOtpScreen(email);
      return;
    }
```

bằng:

```js
    // So MÃ, không so chuỗi: luồng này từng phụ thuộc message.includes('not
    // verified') nên dịch message sang tiếng Việt là màn hình OTP không bao giờ
    // hiện, hỏng âm thầm và không test nào bắt được.
    if (window.LumoraErrors.is(data, 'EMAIL_NOT_VERIFIED')) {
      showOtpScreen(email);
      return;
    }
```

- [ ] **Step 3: Dùng resolver cho ba chỗ hiển thị lỗi**

Thay lần lượt:

```js
      setMsg('msg-auth', data.message || window.t.errGeneric, 'error');
```
→
```js
      setMsg('msg-auth', window.LumoraErrors.resolve(data, window.t), 'error');
```

```js
      setMsg('msg-otp', data.message || window.t.errOtp, 'error');
```
→
```js
      setMsg('msg-otp', window.LumoraErrors.resolve(data, window.t, window.t.errOtp), 'error');
```

```js
      setMsg('msg-otp', data.message || window.t.errOtpSend, 'error');
```
→
```js
      setMsg('msg-otp', window.LumoraErrors.resolve(data, window.t, window.t.errOtpSend), 'error');
```

- [ ] **Step 4: Kiểm bằng browser thật**

Tạo `tests/visual/.errprobe.js`:

```js
const { firefox } = require('@playwright/test');
(async () => {
  const b = await firefox.launch();
  for (const loc of ['vi-VN', 'en-US']) {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 }, locale: loc });
    await p.goto('http://localhost:3030/auth/');
    await p.waitForTimeout(900);
    const tab = p.locator('text=Đăng ký').first();
    if (await tab.count()) await tab.click().catch(() => {});
    await p.waitForTimeout(400);
    await p.fill('#email', 'test@galaxy.com');
    await p.fill('#password', 'abcdefgh');
    await p.click('#submit-btn');
    await p.waitForTimeout(1500);
    console.log(loc, '->', (await p.locator('#msg-auth').textContent()).trim());
    await p.close();
  }
  await b.close();
})();
```

Run: `node tests/visual/.errprobe.js`
Expected: `vi-VN -> Email này đã được đăng ký` và `en-US -> This email is already registered`. Trước thay đổi này cả hai đều ra `Email already exists`.

- [ ] **Step 5: Xoá probe và chạy test**

Run: `rm -f tests/visual/.errprobe.js && npm test`
Expected: mọi suite PASS

- [ ] **Step 6: Commit**

```bash
git add public/auth/index.html public/auth/js/main.js
git commit -m "feat(errors): FE auth tra mã lỗi ra chuỗi đã dịch"
```

---

### Task 6: Portal dùng resolver

**Files:**
- Modify: `public/portal/index.html`
- Modify: `public/portal/js/main.js`

- [ ] **Step 1: Nạp resolver**

Trong `public/portal/index.html`, thêm ngay sau thẻ nạp `/shared/js/i18n.js`:

```html
  <script src="/shared/js/errorMessages.js?v=20260821-1"></script>
```

- [ ] **Step 2: Thay ba chỗ hiển thị lỗi**

Trong `public/portal/js/main.js`, thay:

```js
      msg.textContent = data.message || window.t.errGeneric;
```
→
```js
      msg.textContent = window.LumoraErrors.resolve(data, window.t);
```

```js
    if (!res.ok) { setAccMsg('msg-change-pw', data.message || window.t.errGeneric, true); return; }
```
→
```js
    if (!res.ok) { setAccMsg('msg-change-pw', window.LumoraErrors.resolve(data, window.t), true); return; }
```

```js
    if (!res.ok) { setAccMsg('msg-delete-account', data.message || window.t.errGeneric, true); return; }
```
→
```js
    if (!res.ok) { setAccMsg('msg-delete-account', window.LumoraErrors.resolve(data, window.t), true); return; }
```

- [ ] **Step 3: Kiểm thứ tự nạp script**

Phải so theo **thẻ `<script src>`**, không phải `indexOf` trên cả file: chuỗi
`js/main.js` còn xuất hiện ở chỗ khác trong HTML và làm phép đo sai lệch.

Run:
```bash
node -e "
const fs=require('fs');
for (const f of ['public/auth/index.html','public/portal/index.html']) {
  const lines=fs.readFileSync(f,'utf8').split('\n');
  const at=(n)=>lines.findIndex(l=>l.includes('<script') && l.includes(n));
  const i18n=at('i18n.js'), res=at('errorMessages.js'), main=at('js/main.js');
  console.log(f, {i18n, res, main}, (res>i18n && res<main) ? 'OK' : 'SAI THỨ TỰ');
}"
```
Expected: cả hai in `OK` — resolver nạp **sau** `i18n.js` và **trước** `main.js`.

Ghi chú: `main.js` là `type="module"` nên bị hoãn tới sau mọi script thường,
tức thứ tự vẫn an toàn kể cả khi resolver nằm sau nó. Phép kiểm này là để giữ
thứ tự đọc được rõ ràng, không phải vì runtime sẽ vỡ.

- [ ] **Step 4: Chạy test**

Run: `npm test`
Expected: mọi suite PASS

- [ ] **Step 5: Commit**

```bash
git add public/portal/index.html public/portal/js/main.js
git commit -m "feat(errors): portal tra mã lỗi ra chuỗi đã dịch"
```

---

### Task 7: Nối vào `npm test` và ghi tài liệu

**Files:**
- Modify: `package.json`
- Modify: `CLAUDE.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Thêm script**

Trong `package.json`, thêm vào `"scripts"` ngay trước `"test"`:

```json
    "test:errors": "node --test tests/error-codes.test.js",
```

và nối ` && npm run test:errors` vào cuối giá trị của `"test"`.

- [ ] **Step 2: Chạy**

Run: `npm run test:errors && npm test`
Expected: `test:errors` 12 tests PASS; `npm test` mọi suite PASS

- [ ] **Step 3: Ghi quy ước vào `CLAUDE.md`**

Thêm mục mới trước phần "10. Trước khi thêm dependency":

```markdown
## Lỗi trả về người dùng

Backend ném `errorResponse` kèm `code` lấy từ `context/errorCodes.js`; frontend
tra mã đó ra chuỗi đã dịch bằng `window.LumoraErrors.resolve(data, window.t)`.

- **Thêm lỗi mới:** thêm mã vào `context/errorCodes.js`, thêm chuỗi vào **cả**
  `LANG.vi.errors` và `LANG.en.errors` trong `public/shared/js/i18n.js`, rồi gắn
  `code:` chỗ throw. `tests/error-codes.test.js` bắt nếu thiếu một trong ba.
- **Message tiếng Anh ở backend giữ nguyên** — nó là fallback cho endpoint chưa
  migrate, và là thứ hiện trong log server.
- **Không rẽ nhánh bằng nội dung message.** Dùng `LumoraErrors.is(data, 'MÃ')`.
  FE từng dùng `message.includes('not verified')`; dịch message là luồng đó hỏng
  âm thầm, không lỗi, không test nào bắt.
- Service chưa migrate vẫn chạy bình thường: không có `errorCode` thì resolver
  fallback về `message` như cũ.
```

- [ ] **Step 4: Ghi vào `AGENTS.md`**

Trong mục `## 11. Frontend và UX`, thêm gạch đầu dòng:

```markdown
- Lỗi từ server hiển thị qua `window.LumoraErrors.resolve(data, window.t)`, không đọc thẳng `data.message`. Chi tiết và cách thêm mã mới: xem `CLAUDE.md`.
```

- [ ] **Step 5: Commit**

```bash
git add package.json CLAUDE.md AGENTS.md
git commit -m "chore(errors): nối test:errors vào npm test và ghi quy ước"
```

---

## Ngoài phạm vi plan này

- **`galaxy.service.js` (9 message tiếng Anh) và `soundcloud.service.js` (5).** Cùng cách làm, nhưng bề mặt người dùng khác và cần bảng mã riêng. Làm sau khi auth chạy ổn định trên production.
- **Dịch `message` tiếng Anh ở backend sang tiếng Việt.** Chỉ nên làm sau khi mã lỗi phủ hết — lúc đó `message` thuần tuý là log, không còn là thứ người dùng thấy.
- **`support.service.js`, `payment.service.js`, `gallery.service.js`** đã trả message tiếng Việt và FE xử lý đúng. **Không đụng vào.** `support/index.html:50` nhìn như nhánh locale bị ngược nhưng thực ra đúng: backend trả tiếng Việt nên `vi` hiện message thật, `en` hiện thông báo chung.
- **`reportValidity()` ở `support-form`** vẫn dùng tooltip mặc định của trình duyệt, không đồng bộ với style lỗi của auth. Quyết định riêng về UX, không thuộc việc mã lỗi.
