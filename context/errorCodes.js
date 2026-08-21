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
