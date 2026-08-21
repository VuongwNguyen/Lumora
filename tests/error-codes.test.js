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
