# Lumora — Spec hoàn thiện website trước thông báo TMĐT

**Trạng thái:** Technical implementation completed; PO decisions and release QA pending
**Chủ sở hữu yêu cầu:** Vương — PO, CEO, Maintainer
**Phạm vi:** Lumora production tại `https://lumora.nguyenvuongw.id.vn/`
**Mục tiêu:** Hoàn thiện thông tin công khai, chính sách giao dịch và luồng thanh toán trước khi chủ sở hữu nộp thông báo nền tảng thương mại điện tử kinh doanh trực tiếp có chức năng đặt hàng trực tuyến.

> Ghi chú triển khai 11/08/2026: phần kỹ thuật FR-01 đến FR-10 đã được xây dựng. Payment giữ trạng thái khóa mặc định. Các dữ liệu/nội dung chưa được chủ sở hữu xác nhận nằm tại `docs/tmdt-po-decisions.md`; checklist phát hành và rollback nằm tại `docs/tmdt-release-checklist.md`. Definition of Done chỉ hoàn tất sau khi PO duyệt và QA môi trường preview/PayOS test đạt.

> Tài liệu này là yêu cầu sản phẩm/kỹ thuật, không thay thế tư vấn pháp lý. Agents không được tự suy diễn hoặc điền dữ liệu định danh thật của chủ sở hữu.

## 1. Bối cảnh và phân loại

Lumora bán trực tiếp gói sử dụng dịch vụ do chính Lumora cung cấp; không cho bên thứ ba mở gian hàng hay bán sản phẩm. Phạm vi triển khai hiện tại được xác định là nền tảng TMĐT kinh doanh trực tiếp có chức năng đặt hàng trực tuyến.

Các điểm cần khắc phục đã xác định:

- Chưa công khai đầy đủ thông tin chủ quản nền tảng.
- Điều khoản và chính sách bảo mật dẫn tới một “form liên hệ” chưa tồn tại.
- Chưa có chính sách thanh toán và chính sách hủy/hoàn tiền riêng.
- Một lần nhấn nút nâng cấp hiện tạo đơn và chuyển thẳng sang PayOS, chưa có bước rà soát/xác nhận đơn.
- Nội dung “tính theo chu kỳ” và “hủy bất cứ lúc nào” chưa phản ánh chính xác cơ chế thanh toán từng lần hiện có.
- Chưa nói rõ giá hiển thị đã bao gồm các khoản thuế/phí áp dụng hay chưa.
- Backend có API lịch sử thanh toán nhưng user chưa có giao diện tra cứu đầy đủ.

## 2. Nguyên tắc bắt buộc cho agents

1. Không ghi trực tiếp CCCD, mã số thuế, địa chỉ cư trú, số điện thoại cá nhân hoặc bí mật khác vào Git.
2. Dùng cấu hình môi trường hoặc placeholder cho dữ liệu chủ sở hữu:
   - `OWNER_NAME`
   - `OWNER_TAX_ID`
   - `OWNER_ADDRESS`
   - `SUPPORT_EMAIL`
   - `SUPPORT_PHONE`
3. Không log các biến trên, token JWT, dữ liệu PayOS, nội dung webhook hoặc dữ liệu cá nhân của khách hàng.
4. Không thay đổi bảng giá, quyền lợi gói, thời hạn subscription hoặc hành vi webhook ngoài phần được yêu cầu.
5. Không triển khai tự động gia hạn. Luồng hiện tại phải được mô tả đúng là thanh toán riêng cho từng kỳ, trừ khi PO phê duyệt một spec khác.
6. Không gắn logo “Đã thông báo Bộ Công Thương” khi chưa có URL xác nhận chính thức.
7. Mọi nội dung pháp lý phải có cả tiếng Việt; bản tiếng Anh nếu giữ lại phải tương đương về ý nghĩa.
8. Không đưa website về trạng thái nhận tiền production nếu thiếu cấu hình chủ sở hữu bắt buộc.

## 3. Phạm vi chức năng

### FR-01 — Khối thông tin chủ quản

Tạo một trang công khai, ví dụ `/owner-info/`, và liên kết từ footer của mọi trang public.

Nội dung tối thiểu:

- Tên sản phẩm: Lumora.
- Tên chủ quản: lấy từ `OWNER_NAME`.
- Địa chỉ liên hệ/kinh doanh: lấy từ `OWNER_ADDRESS`.
- Mã số thuế của cá nhân: lấy từ `OWNER_TAX_ID`.
- Email hỗ trợ có `mailto:`: lấy từ `SUPPORT_EMAIL`.
- Số điện thoại hỗ trợ có `tel:`: lấy từ `SUPPORT_PHONE`.
- Tên miền: `https://lumora.nguyenvuongw.id.vn/`.
- Người chịu trách nhiệm quản lý và vận hành: lấy từ `OWNER_NAME`.

Thông tin này cũng phải xuất hiện dạng rút gọn trong footer. Nếu một biến bắt buộc chưa được cấu hình ở production, không được render chuỗi `undefined`, placeholder kỹ thuật hoặc dữ liệu giả.

### FR-02 — Kênh liên hệ và khiếu nại thực tế

Tạo trang `/support/` hoặc `/contact/` và liên kết từ footer, Điều khoản, Chính sách bảo mật, Chính sách thanh toán và Chính sách hoàn tiền.

Form tối thiểu:

- Họ tên.
- Email.
- Loại yêu cầu: hỗ trợ kỹ thuật, thanh toán, hoàn tiền, quyền dữ liệu cá nhân, khiếu nại khác.
- Mã đơn hàng, không bắt buộc.
- Nội dung yêu cầu.
- Checkbox xác nhận nội dung cung cấp là chính xác.

Yêu cầu xử lý:

- Validate cả client và server.
- Rate limit và chống spam ở mức hợp lý.
- Không đưa dữ liệu form vào log ứng dụng.
- Trả mã yêu cầu để người dùng đối chiếu.
- Công khai thời hạn phản hồi dự kiến và các bước tiếp nhận, xác minh, xử lý, phản hồi.
- Có phương án liên hệ trực tiếp qua email nếu form lỗi.

### FR-03 — Chính sách thanh toán riêng

Tạo trang `/payment-policy/` với các nội dung:

- Phương thức thanh toán hiện hỗ trợ và vai trò của PayOS.
- Đơn vị tiền tệ VND.
- Giá gói, kỳ sử dụng và thời điểm kích hoạt.
- Khẳng định mỗi giao dịch thanh toán cho một kỳ riêng và không tự động trừ tiền/gia hạn, nếu đây vẫn là hành vi thực tế.
- Cách xử lý thanh toán thành công, thất bại, hủy hoặc pending.
- Cách tra cứu lịch sử giao dịch.
- Cách liên hệ khi đã bị trừ tiền nhưng gói chưa kích hoạt.
- Câu về thuế/phí sử dụng placeholder do PO duyệt; không tự khẳng định khi chưa xác định nghĩa vụ thuế.

### FR-04 — Chính sách hủy dịch vụ và hoàn tiền riêng

Tạo trang `/refund-policy/` và thay nội dung thanh toán/hoàn tiền trong Điều khoản bằng bản tóm tắt dẫn đến trang này.

Chính sách phải phân biệt:

- Hủy một yêu cầu thanh toán chưa hoàn tất.
- Không tiếp tục mua kỳ tiếp theo.
- Chấm dứt sử dụng tài khoản/dịch vụ.
- Yêu cầu hoàn tiền.

Các trường hợp cần có quy trình xem xét tối thiểu:

- Thanh toán trùng.
- PayOS báo thành công nhưng Lumora không kích hoạt gói.
- Lumora không cung cấp được dịch vụ trả phí do lỗi hệ thống kéo dài.
- Giao dịch không được chủ tài khoản cho phép.
- Trường hợp khác theo quy định pháp luật áp dụng.

Nêu rõ cách gửi yêu cầu, bằng chứng cần cung cấp, thời hạn tiếp nhận, thời hạn phản hồi và phương thức hoàn tiền. Con số thời hạn cuối cùng phải được PO duyệt trước khi release.

### FR-05 — Cập nhật Điều khoản sử dụng

Sửa `/terms/` để:

- Xác định rõ hợp đồng dịch vụ giữa người dùng và chủ quản Lumora.
- Dẫn link đến thông tin chủ quản, thanh toán, hoàn tiền, bảo mật và hỗ trợ.
- Xóa hoặc sửa các câu mô tả sai hành vi thực tế, đặc biệt “tính theo chu kỳ”, “hủy bất cứ lúc nào” và tự động gia hạn.
- Nêu rõ thời điểm gói bắt đầu, thời hạn quyền sử dụng và hậu quả khi hết hạn.
- Nêu quy trình thông báo khi thay đổi điều khoản.
- Không dùng điều khoản miễn trừ tuyệt đối đối với trách nhiệm mà pháp luật không cho phép miễn trừ.
- Thay “form liên hệ trên website” bằng link/kênh đang hoạt động thật.

### FR-06 — Cập nhật Chính sách bảo mật

Sửa `/privacy/` để công khai tối thiểu:

- Mục đích và phạm vi thu thập cho từng nhóm dữ liệu.
- Phạm vi sử dụng.
- Thời gian lưu hoặc cách xác định thời gian lưu.
- Nhóm tổ chức/cá nhân có thể tiếp cận dữ liệu; nêu các nhà cung cấp chính theo vai trò nếu phù hợp.
- Biện pháp bảo mật.
- Cách xem, sửa, xóa, hạn chế xử lý và khiếu nại.
- Kênh thực hiện quyền dữ liệu hoạt động thật.
- Việc xử lý ảnh và nội dung do user tải lên; catalog nhạc upload legacy đang bị quarantine và không được phát public.
- Việc xử lý dữ liệu thanh toán bởi PayOS; Lumora không tuyên bố lưu dữ liệu thẻ/tài khoản nếu thực tế không lưu.
- Cookie/analytics đang dùng trên thực tế.

Không cam kết kỹ thuật không tồn tại. Agents phải kiểm tra source và hạ tầng trước khi giữ các tuyên bố như “sao lưu định kỳ”, “máy chủ an toàn” hoặc “mức độ bảo vệ tương đương ở mọi quốc gia”.

### FR-07 — Màn hình rà soát và xác nhận đơn hàng

Không được tạo payment record hoặc gọi `/payment/create` ngay khi user nhấn nút “Nâng cấp/Gia hạn”. Thay bằng modal hoặc trang review order.

Màn hình phải hiển thị:

- Tên gói.
- Chu kỳ: tháng hoặc năm.
- Số tiền VND.
- Ngày/thời điểm dự kiến bắt đầu.
- Thời hạn sử dụng.
- Trạng thái không tự động gia hạn.
- Tóm tắt quyền lợi chính.
- Link mở Điều khoản, Chính sách thanh toán và Chính sách hoàn tiền.
- Nút quay lại/sửa lựa chọn.
- Checkbox đồng ý điều khoản, mặc định không chọn.
- Nút cuối cùng có nhãn cụ thể, ví dụ `Thanh toán 29.000đ`.

Chỉ sau khi user chủ động xác nhận thì mới gọi `/payment/create` và chuyển sang checkout PayOS. Chống double submit và hiển thị lỗi có thể phục hồi.

Backend phải tiếp tục tự lấy giá từ `config/plans.js`; tuyệt đối không tin số tiền do client gửi lên.

### FR-08 — Lịch sử thanh toán dành cho user

Dùng API `GET /payment/history` hiện có để thêm bảng lịch sử trong tab Subscription.

Mỗi dòng gồm:

- Mã đơn hàng.
- Gói.
- Kỳ sử dụng.
- Số tiền.
- Trạng thái: pending, paid, cancelled hoặc trạng thái thực tế khác.
- Thời điểm tạo/thanh toán.
- Link hỗ trợ gắn sẵn mã đơn hàng.

Không hiển thị PayOS transaction ID nội bộ nếu không cần cho người dùng. Có empty state, loading state, error state và phân trang nếu dữ liệu lớn.

### FR-09 — Footer và điều hướng pháp lý thống nhất

Footer public tối thiểu phải có link đến:

- Thông tin chủ quản.
- Điều khoản sử dụng.
- Chính sách bảo mật.
- Chính sách thanh toán.
- Chính sách hủy và hoàn tiền.
- Liên hệ/khiếu nại.

Chuẩn bị sẵn vị trí `MOIT_NOTIFICATION_URL` và ảnh/logo xác nhận, nhưng chỉ render khi biến đã được cấu hình bằng URL xác nhận thật sau khi hồ sơ được duyệt.

### FR-10 — Chế độ an toàn trước khi hoàn tất hồ sơ

Thêm feature flag, ví dụ `PAYMENTS_ENABLED`:

- `false`: vẫn cho đăng ký và dùng Free; ẩn hoặc vô hiệu hóa hành động thanh toán với thông báo “Tính năng thanh toán đang được hoàn thiện”.
- `true`: chỉ bật khi các biến chủ quản bắt buộc đã có và PO quyết định mở thanh toán.

Backend phải từ chối `/payment/create` khi flag tắt, không chỉ khóa ở frontend.

Ngoại lệ kiểm thử đã được xác nhận: admin đã xác thực có thể gọi `/payment/create` khi flag public đang tắt để kiểm tra PayOS end-to-end, với điều kiện server đã có đủ PayOS credentials. Ngoại lệ này không áp dụng cho user/partner, không bỏ bước rà soát đơn, idempotency, giá từ server hay xác minh webhook. Admin cũng có thể chọn `/payment/admin-simulate`; giao dịch mô phỏng không gọi PayOS, không thu tiền và không được tính vào số liệu kinh doanh thật.

## 4. Yêu cầu phi chức năng

- Responsive trên mobile và desktop.
- Accessibility: label form, focus state, keyboard navigation, thông báo lỗi có thể đọc bởi screen reader.
- Không làm giảm CSP/Helmet hiện tại.
- Không thêm third-party tracker nếu chưa có phê duyệt.
- Không làm lộ dữ liệu cá nhân trong HTML source ngoài các thông tin mà PO chủ động xác định là thông tin kinh doanh công khai.
- Nội dung và giá trên landing page, portal, backend config phải nhất quán.
- Sử dụng format tiền `vi-VN`, không dùng `d` thay cho ký hiệu/chuỗi `đ` nếu UI tiếng Việt.

## 5. API/data đề xuất

Agents được phép điều chỉnh thiết kế chi tiết nhưng phải giữ các invariant dưới đây:

- `POST /payment/create` chỉ nhận `plan` và `period`; server tự tính giá.
- Thêm idempotency hoặc cơ chế chống tạo nhiều pending order do double click/retry.
- `GET /payment/history` chỉ trả giao dịch thuộc user hiện tại.
- Nếu tạo support API, mọi request phải có request ID và dữ liệu đầu vào được sanitize.
- Không lưu bản chụp CCCD trong ứng dụng Lumora.

## 6. Test cases bắt buộc

### Public/legal

- Tất cả link footer trả HTTP 200 và không còn link tới form không tồn tại.
- Không có `undefined`, placeholder hoặc dữ liệu giả trên production.
- Thông tin gói/giá giống nhau giữa landing page, portal và backend.
- Logo thông báo TMĐT không xuất hiện khi chưa có `MOIT_NOTIFICATION_URL`.

### Checkout

- Nhấn nâng cấp chỉ mở review order, chưa tạo payment.
- Có thể quay lại và đổi gói/kỳ.
- Không thể tiếp tục khi chưa đồng ý điều khoản.
- Nút xác nhận hiển thị đúng số tiền.
- Double click chỉ tạo tối đa một order hợp lệ.
- Server từ chối plan/period không hợp lệ.
- Server từ chối tạo payment khi `PAYMENTS_ENABLED=false`.
- Thành công, hủy, pending và lỗi kết nối đều có trạng thái UI rõ ràng.

### History/security

- User A không đọc được giao dịch của user B.
- Lịch sử hiển thị đúng mã đơn, gói, kỳ, giá, trạng thái và thời gian.
- Không có secret hoặc dữ liệu PayOS nhạy cảm trong client bundle/log.
- Form hỗ trợ được validate, rate limit và không phản chiếu HTML/script.

## 7. Definition of Done

Chỉ coi là hoàn thành khi:

1. Toàn bộ FR-01 đến FR-10 được triển khai hoặc có quyết định scope-out bằng văn bản của PO.
2. Test tự động liên quan chạy pass; có bổ sung test cho payment guard, authorization và idempotency.
3. Agents kiểm thử thủ công trên bản preview bằng viewport mobile và desktop.
4. Không có lỗi console nghiêm trọng hoặc link pháp lý hỏng.
5. PO duyệt nội dung pháp lý, dữ liệu chủ sở hữu công khai và câu về thuế/phí.
6. PayOS sandbox/test chạy đủ success/cancel/error; không tạo giao dịch tiền thật trong quá trình QA.
7. Có rollback plan cho thay đổi checkout/payment.
8. Có checklist deploy gồm env vars mới và xác nhận `PAYMENTS_ENABLED`.

## 8. Ngoài phạm vi

- Tự động nộp hồ sơ hành chính hoặc ký/xác thực thay chủ sở hữu.
- Tự đăng ký thuế, hộ kinh doanh hoặc doanh nghiệp.
- Tự động gia hạn/thanh toán định kỳ.
- Phát hành hóa đơn điện tử.
- Gắn logo thông báo TMĐT trước khi được xác nhận.
- Thay đổi giá hoặc quyền lợi gói.

## 9. Thứ tự triển khai đề nghị

1. Feature flag thanh toán và server guard.
2. Cấu hình thông tin chủ quản, footer và trang owner info.
3. Support/contact flow.
4. Chính sách thanh toán, hoàn tiền, cập nhật terms/privacy.
5. Review order và chống tạo trùng payment.
6. Payment history cho user.
7. Automated tests, security review và preview QA.
8. PO điền dữ liệu thật ngoài Git, duyệt nội dung và quyết định bật payment.

## 10. Handoff cho PO

Agents phải bàn giao:

- Danh sách file đã thay đổi.
- Danh sách env vars cần cấu hình, không kèm giá trị nhạy cảm.
- Kết quả test.
- URL preview của từng trang pháp lý.
- Video hoặc ảnh minh họa luồng review order nếu môi trường hỗ trợ.
- Những câu pháp lý còn cần PO xác nhận.
- Hướng dẫn gắn `MOIT_NOTIFICATION_URL` sau khi nhận xác nhận chính thức.
