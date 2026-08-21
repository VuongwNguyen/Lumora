const { isErrorCode } = require("./errorCodes");

class successfullyResponse {
    constructor({ meta, message, statusResponse = true, statusCode = 200 }) {
      this.meta = meta;
      this.message = message;
      this.statusResponse = statusResponse;
      this.statusCode = statusCode;
    }
    json(res) {
      res.status(this.statusCode).json({
        statusResponse: this.statusResponse,
        message: this.message,
        statusCode: this.statusCode,
        meta: this.meta,
      });
    }
  }
  
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
  
  module.exports = {
    successfullyResponse,
    errorResponse,
  };
  