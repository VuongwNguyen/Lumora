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
