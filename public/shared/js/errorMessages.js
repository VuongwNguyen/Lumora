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

    // hasOwnProperty, không tra thẳng: errors là object literal nên `errorCode`
    // trùng tên thuộc tính của Object.prototype sẽ lấy nhầm từ prototype chain.
    // 'toString' cho ra chuỗi "[object Undefined]" và hiển thị thẳng cho người
    // dùng như một thông báo lỗi; 'constructor' cho ra một object.
    var entry = data.errorCode && dictionary.errors
      && Object.prototype.hasOwnProperty.call(dictionary.errors, data.errorCode)
      ? dictionary.errors[data.errorCode] : null;
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
