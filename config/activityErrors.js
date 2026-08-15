const ERROR_TYPE_DESCRIPTIONS = Object.freeze({
  auth_unauthorized: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
  auth_forbidden: 'Tài khoản không có quyền thực hiện thao tác.',
  not_found: 'Tài nguyên hoặc API không tồn tại.',
  validation_error: 'Dữ liệu đầu vào không hợp lệ.',
  rate_limited: 'Có quá nhiều yêu cầu trong một khoảng thời gian ngắn.',
  server_error: 'Máy chủ xử lý yêu cầu thất bại.',
  client_error: 'Yêu cầu từ trình duyệt không hợp lệ.',
  timeout: 'Thao tác quá thời gian chờ.',
  network_drop: 'Kết nối mạng bị gián đoạn.',
  request_cancelled: 'Yêu cầu đã bị huỷ trước khi hoàn tất.',
  json_parse_error: 'Phản hồi không phải JSON hợp lệ.',
  javascript_error: 'JavaScript phát sinh lỗi khi chạy.',
  unhandled_rejection: 'Promise bị reject nhưng không được xử lý.',
  resource_load_fail: 'Trình duyệt không tải được tài nguyên.',
  storage_unavailable: 'Không thể đọc hoặc ghi browser storage.',
  clipboard_fail: 'Không thể sao chép dữ liệu vào clipboard.',
  wrong_password: 'Mật khẩu không chính xác.',
  account_not_found: 'Không tìm thấy tài khoản.',
  account_locked: 'Tài khoản đang bị khoá.',
  email_unverified: 'Email chưa được xác thực.',
  email_already_used: 'Email đã được sử dụng.',
  otp_invalid_or_expired: 'OTP không hợp lệ hoặc đã hết hạn.',
  otp_send_fail: 'Không thể gửi OTP.',
  password_change_fail: 'Đổi mật khẩu thất bại.',
  account_delete_fail: 'Xoá tài khoản thất bại.',
  session_revoke_fail: 'Thu hồi phiên đăng nhập thất bại.',
  galaxy_limit_reached: 'Tài khoản đã đạt giới hạn galaxy của gói.',
  galaxy_fetch_fail: 'Không thể tải dữ liệu galaxy.',
  galaxy_create_fail: 'Tạo galaxy thất bại.',
  galaxy_update_fail: 'Cập nhật galaxy thất bại.',
  galaxy_delete_fail: 'Xoá galaxy thất bại.',
  photo_upload_fail: 'Tải ảnh lên thất bại.',
  photo_delete_fail: 'Xoá ảnh thất bại.',
  theme_load_fail: 'Không thể tải danh sách theme.',
  theme_save_fail: 'Không thể lưu theme.',
  music_load_fail: 'Không thể tải danh sách nhạc.',
  music_save_fail: 'Không thể lưu nhạc nền.',
  audio_preview_fail: 'Không thể phát nhạc nghe thử.',
  soundscape_init_fail: 'Không thể khởi tạo Web Audio soundscape.',
  soundscape_save_fail: 'Không thể lưu cấu hình soundscape.',
  caption_save_fail: 'Không thể lưu caption.',
  story_generate_fail: 'Tạo nội dung Story thất bại.',
  story_save_fail: 'Lưu Story thất bại.',
  story_photo_upload_fail: 'Tải ảnh Story lên thất bại.',
  viewer_load_fail: 'Không thể tải trải nghiệm galaxy.',
  viewer_webgl_fail: 'WebGL không thể khởi tạo hoặc đã mất context.',
  viewer_audio_fail: 'Không thể tải hoặc phát âm thanh viewer.',
  image_texture_fail: 'Không thể tải ảnh làm texture.',
  subscription_load_fail: 'Không thể tải trạng thái subscription.',
  checkout_create_fail: 'Không thể tạo phiên thanh toán.',
  checkout_redirect_fail: 'Không thể chuyển tới cổng thanh toán.',
  payment_cancelled: 'Thanh toán đã bị huỷ.',
  payment_provider_rejected: 'Cổng thanh toán từ chối giao dịch.',
  payment_webhook_invalid: 'Webhook thanh toán không hợp lệ.',
  payment_webhook_process_fail: 'Xử lý webhook thanh toán thất bại.',
  payment_pending_timeout: 'Giao dịch chờ thanh toán đã hết hạn.',
  support_request_fail: 'Không thể tiếp nhận yêu cầu hỗ trợ.',
  universe_save_fail: 'Không thể lưu lựa chọn vũ trụ.',
  unknown: 'Chưa phân loại được nguyên nhân lỗi.',
});

const SENSITIVE_KEY_RE = /(password|passphrase|otp|token|authorization|cookie|secret|checksum|api[-_]?key|signature|credential)/i;

function redactString(value, maxLength = 2000) {
  let output = String(value)
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer ***')
    .replace(/(password|otp|token|code|key|signature|checksum)=([^&\s]+)/gi, '$1=***')
    .replace(/(Authorization\s*:\s*)[^\r\n]+/gi, '$1***')
    .replace(/([?&](?:password|otp|token|code|key|signature|checksum)=)[^&#\s]+/gi, '$1***')
    .replace(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\.[A-Z]{2,})/gi, '***@$1');
  if (output.length > maxLength) output = output.slice(0, maxLength) + '…[truncated]';
  return output;
}

function sanitizeMetadata(value, options = {}, depth = 0, state = { keys: 0 }) {
  const maxDepth = options.maxDepth ?? 5;
  const maxKeys = options.maxKeys ?? 50;
  const maxStringLength = options.maxStringLength ?? 2000;
  if (value == null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'string') return redactString(value, maxStringLength);
  if (depth >= maxDepth) return '[max_depth]';
  if (Array.isArray(value)) {
    return value.slice(0, 50).map(item => sanitizeMetadata(item, options, depth + 1, state));
  }
  if (typeof value !== 'object') return redactString(value, maxStringLength);

  const output = {};
  for (const [rawKey, item] of Object.entries(value)) {
    if (state.keys >= maxKeys) break;
    if (['__proto__', 'prototype', 'constructor'].includes(rawKey)) continue;
    const key = redactString(rawKey, 100);
    state.keys += 1;
    output[key] = SENSITIVE_KEY_RE.test(key)
      ? '[REDACTED]'
      : sanitizeMetadata(item, options, depth + 1, state);
  }
  return output;
}

function describeErrorType(errorType) {
  return ERROR_TYPE_DESCRIPTIONS[errorType] || ERROR_TYPE_DESCRIPTIONS.unknown;
}

module.exports = {
  ERROR_TYPE_DESCRIPTIONS,
  SENSITIVE_KEY_RE,
  describeErrorType,
  redactString,
  sanitizeMetadata,
};
