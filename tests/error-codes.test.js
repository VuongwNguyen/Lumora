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
