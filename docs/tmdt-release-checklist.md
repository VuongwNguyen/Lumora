# Lumora — Checklist release TMĐT và rollback payment

## Trước deploy

- [ ] PO hoàn tất các quyết định trong `docs/tmdt-po-decisions.md`.
- [ ] Không có CCCD, secret, PayOS key hoặc dữ liệu cá nhân ngoài thông tin kinh doanh được duyệt trong Git.
- [ ] Cấu hình `APP_URL=https://lumora.nguyenvuongw.id.vn` và HTTPS production.
- [ ] Cấu hình các biến `OWNER_*`, `SUPPORT_*`, các notice chính sách và PayOS bằng secret/env của môi trường.
- [ ] Giữ `PAYMENTS_ENABLED=false` trong lần deploy kỹ thuật đầu tiên.
- [ ] Xác nhận MongoDB tạo unique index cho `payments.userId + payments.idempotencyKeyHash` và `support_requests.referenceCode`.
- [ ] Chạy `npm test`, `npm run audit:activity` và `git diff --check`.

## Preview QA

- [ ] Các URL `/owner-info/`, `/support/`, `/payment-policy/`, `/refund-policy/`, `/terms/`, `/privacy/` trả HTTP 200.
- [ ] Footer có đủ sáu link pháp lý; không có `undefined` hoặc dữ liệu giả.
- [ ] Giá/feature trên landing, Subscription và review order khớp `config/plans.js`.
- [ ] Free/Plus bị khóa Fall universe; Pro chọn được Galaxy Classic và Fall Through Memories.
- [ ] Nhấn Nâng cấp chỉ mở review order; chưa có payment record.
- [ ] Checkbox điều khoản mặc định bỏ chọn; double-click chỉ tạo tối đa một order.
- [ ] Lịch sử chỉ hiển thị payment của user hiện tại và không lộ PayOS transaction ID/checkout URL.
- [ ] Form support validate, rate limit, trả reference code và gửi notification tới email hỗ trợ.
- [ ] Kiểm tra keyboard, focus, screen reader status trên mobile và desktop.
- [ ] Chạy PayOS test cho success, cancel, pending, provider error và webhook lặp.

## Mở thanh toán

1. Đặt `LEGAL_CONTENT_APPROVED=true` sau khi PO duyệt nội dung.
2. Kiểm tra `/compliance/public`: `payments.configurationComplete=true`.
3. Đặt `PAYMENTS_ENABLED=true`.
4. Kiểm tra `/compliance/public`: `payments.enabled=true`.
5. Thực hiện một giao dịch test được PO cho phép và đối chiếu payment history/subscription.

## Rollback

Rollback nhanh không cần revert code:

1. Đặt `PAYMENTS_ENABLED=false` và redeploy/restart app.
2. Xác nhận backend `/payment/create` trả `503` và frontend vô hiệu hóa nút thanh toán.
3. Không xóa payment đang pending/paid; giữ dữ liệu để đối soát và xử lý webhook hợp lệ.
4. Nếu lỗi chỉ ở UI, giữ payment khóa cho tới khi bản sửa đã qua test.
5. Ghi lại thời điểm khóa, request ID liên quan và danh sách order cần đối soát; không chép webhook/secret vào log hoặc ticket.
