const crypto = require('crypto');
const SupportRequestModel = require('../models/supportRequest');
const { errorResponse } = require('../context/responseHandle');
const EmailService = require('./email.service');

const REQUEST_TYPES = new Set(['technical', 'payment', 'refund', 'data_rights', 'complaint']);

function sanitizePlainText(value, maxLength) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/[<>]/g, '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .slice(0, maxLength);
}

function validatePayload(body = {}) {
  if (body.website) throw new errorResponse({ message: 'Không thể gửi yêu cầu', statusCode: 400 });
  const payload = {
    name: sanitizePlainText(body.name, 120),
    email: sanitizePlainText(body.email, 254).toLowerCase(),
    type: sanitizePlainText(body.type, 30),
    orderCode: sanitizePlainText(body.orderCode, 40),
    message: sanitizePlainText(body.message, 5000),
    accuracyConfirmed: body.accuracyConfirmed === true,
  };

  if (payload.name.length < 2) throw new errorResponse({ message: 'Họ tên không hợp lệ', statusCode: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
    throw new errorResponse({ message: 'Email không hợp lệ', statusCode: 400 });
  }
  if (!REQUEST_TYPES.has(payload.type)) {
    throw new errorResponse({ message: 'Loại yêu cầu không hợp lệ', statusCode: 400 });
  }
  if (payload.orderCode && !/^[A-Za-z0-9_-]{4,40}$/.test(payload.orderCode)) {
    throw new errorResponse({ message: 'Mã đơn hàng không hợp lệ', statusCode: 400 });
  }
  if (payload.message.length < 10) {
    throw new errorResponse({ message: 'Nội dung yêu cầu phải có ít nhất 10 ký tự', statusCode: 400 });
  }
  if (!payload.accuracyConfirmed) {
    throw new errorResponse({ message: 'Bạn cần xác nhận nội dung đã cung cấp là chính xác', statusCode: 400 });
  }
  return payload;
}

function createReferenceCode(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `LM-${date}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

class SupportService {
  async create(body, requestId) {
    const payload = validatePayload(body);
    const record = await SupportRequestModel.create({
      referenceCode: createReferenceCode(),
      name: payload.name,
      email: payload.email,
      type: payload.type,
      orderCode: payload.orderCode,
      message: payload.message,
      requestId: sanitizePlainText(requestId, 100),
    });
    try {
      await EmailService.sendSupportRequest(record);
    } catch {
      // The persisted reference remains valid even if the notification provider is unavailable.
      // Do not log request content or contact details.
    }
    return { referenceCode: record.referenceCode, status: record.status, createdAt: record.createdAt };
  }
}

module.exports = new SupportService();
module.exports.REQUEST_TYPES = REQUEST_TYPES;
module.exports.createReferenceCode = createReferenceCode;
module.exports.sanitizePlainText = sanitizePlainText;
module.exports.validatePayload = validatePayload;
