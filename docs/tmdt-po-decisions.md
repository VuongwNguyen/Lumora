# Lumora — Các quyết định PO còn chờ xác nhận

**Trạng thái:** Chưa được PO duyệt
**Cập nhật kỹ thuật:** 15/08/2026
**Nguyên tắc:** Không điền dữ liệu định danh thật vào Git. Cấu hình production chỉ thực hiện qua biến môi trường.

## Cơ chế an toàn hiện tại

- `PAYMENTS_ENABLED=false` là mặc định.
- Đặt `PAYMENTS_ENABLED=true` vẫn chưa mở thanh toán nếu thiếu bất kỳ dữ liệu bắt buộc nào bên dưới, thiếu PayOS hoặc `LEGAL_CONTENT_APPROVED` chưa là `true`.
- Website không render `undefined`, dữ liệu giả hoặc logo Bộ Công Thương khi chưa được cấu hình.
- Gói Free và các chức năng không thanh toán vẫn hoạt động khi payment bị khóa.

## Quyết định và dữ liệu cần PO cung cấp

| Mục | Biến/cập nhật | PO cần quyết định | Trạng thái mặc định |
|---|---|---|---|
| Tên chủ quản | `OWNER_NAME` | Tên pháp lý được phép công khai | Trống |
| Mã số thuế | `OWNER_TAX_ID` | Mã số thuế được phép công khai | Trống |
| Địa chỉ | `OWNER_ADDRESS` | Địa chỉ liên hệ/kinh doanh công khai | Trống |
| Email hỗ trợ | `SUPPORT_EMAIL` | Hộp thư thực sự được theo dõi | Trống |
| Điện thoại | `SUPPORT_PHONE` | Số hỗ trợ công khai | Trống |
| Thuế và phí | `PAYMENT_TAX_NOTICE`, `PAYMENT_TAX_NOTICE_EN` | Câu Việt/Anh tương đương về giá đã/chưa bao gồm thuế, phí | Không hiển thị; payment khóa |
| SLA hỗ trợ | `SUPPORT_RESPONSE_NOTICE`, `SUPPORT_RESPONSE_NOTICE_EN` | Thời hạn tiếp nhận và phản hồi dự kiến bằng Việt/Anh | Thông báo chưa chốt; payment khóa |
| Thời hạn hoàn tiền | `REFUND_TIMELINE_NOTICE`, `REFUND_TIMELINE_NOTICE_EN` | Thời hạn tiếp nhận, xác minh và phản hồi bằng Việt/Anh | Thông báo chưa chốt; payment khóa |
| Phương thức hoàn tiền | `REFUND_METHOD_NOTICE`, `REFUND_METHOD_NOTICE_EN` | Chuyển khoản, hoàn về nguồn hay phương án khác bằng Việt/Anh | Thông báo chưa chốt; payment khóa |
| Nội dung pháp lý | `LEGAL_CONTENT_APPROVED` | Duyệt bản cuối Terms, Privacy, Payment và Refund | `false` |
| Logo/xác nhận TMĐT | `MOIT_NOTIFICATION_URL` | URL HTTPS xác nhận chính thức sau khi được duyệt | Không render |
| Mở thanh toán | `PAYMENTS_ENABLED` | Quyết định mở nhận tiền sau QA | `false` |

## Bộ câu cam kết đề xuất để PO tham khảo

> **Chưa được phê duyệt và chưa được đưa vào `.env`.** Các mốc dưới đây là SLA vận hành Lumora tự đề xuất, không được ghi nhận như thời hạn bắt buộc do pháp luật quy định. Chỉ sao chép sang cấu hình production sau khi người vận hành xác nhận có đủ khả năng thực hiện ổn định.

### 1. Thuế và phí

Phương án đề xuất này chỉ phù hợp nếu giá `29.000đ/tháng` và `189.000đ/năm` của Pro (cùng giá Plus đang cấu hình) là số tiền cuối cùng Lumora thu từ người dùng:

```dotenv
PAYMENT_TAX_NOTICE="Giá niêm yết là tổng số tiền Lumora thu cho kỳ sử dụng đã chọn và đã bao gồm các khoản thuế Lumora có nghĩa vụ thu, nếu có. Lumora không thu thêm phí nền tảng tại bước thanh toán; phí riêng của ngân hàng hoặc nhà cung cấp thanh toán, nếu có, sẽ do đơn vị đó thông báo trước khi người dùng xác nhận."
PAYMENT_TAX_NOTICE_EN="The listed price is the total amount Lumora charges for the selected service term and includes any taxes Lumora is required to collect, if applicable. Lumora does not add a platform fee at checkout; any separate bank or payment-provider fee will be disclosed by that provider before the user confirms payment."
```

**Điểm PO phải xác nhận:** cách diễn đạt “đã bao gồm thuế” cần được đối chiếu với tư cách thuế thực tế của chủ quản. Nếu không đúng, không dùng câu này và không mở payment cho tới khi có câu thay thế phù hợp với cách hệ thống tính tiền.

### 2. Tiếp nhận và phản hồi hỗ trợ

```dotenv
SUPPORT_RESPONSE_NOTICE="Lumora cấp mã yêu cầu ngay sau khi form được gửi thành công và phản hồi ban đầu trong tối đa 02 ngày làm việc. Trường hợp cần thêm thời gian xác minh, Lumora sẽ thông báo tình trạng và bước xử lý tiếp theo qua email đã cung cấp."
SUPPORT_RESPONSE_NOTICE_EN="Lumora issues a reference code immediately after the form is submitted successfully and provides an initial response within 2 business days. If additional verification time is needed, Lumora will email the current status and next steps to the address provided."
```

Phản hồi ban đầu có thể là kết quả xử lý hoặc yêu cầu bổ sung thông tin; không đồng nghĩa mọi vụ việc phải hoàn tất trong 02 ngày.

### 3. Thời hạn xem xét và thực hiện hoàn tiền

```dotenv
REFUND_TIMELINE_NOTICE="Lumora thông báo kết quả xem xét yêu cầu hoàn tiền trong tối đa 05 ngày làm việc kể từ khi nhận đủ thông tin cần thiết. Nếu yêu cầu được chấp thuận, Lumora khởi tạo hoàn tiền trong tối đa 03 ngày làm việc tiếp theo. Thời gian tiền thực tế về tài khoản thường từ 05 đến 10 ngày làm việc và có thể thay đổi theo ngân hàng hoặc nhà cung cấp thanh toán."
REFUND_TIMELINE_NOTICE_EN="Lumora communicates the outcome of a refund review within 5 business days after receiving all required information. If approved, Lumora initiates the refund within the next 3 business days. Funds typically reach the account within 5 to 10 business days, but timing may vary by bank or payment provider."
```

### 4. Phương thức hoàn tiền

```dotenv
REFUND_METHOD_NOTICE="Khoản hoàn tiền được ưu tiên trả về phương thức thanh toán ban đầu. Nếu phương thức đó không hỗ trợ hoàn tiền, Lumora sẽ hướng dẫn chuyển khoản tới tài khoản ngân hàng đã được xác minh thuộc người thanh toán hoặc chủ tài khoản Lumora; Lumora không hoàn tiền vào tài khoản của bên thứ ba chưa được xác minh."
REFUND_METHOD_NOTICE_EN="Refunds are returned to the original payment method whenever supported. If that method cannot receive a refund, Lumora will arrange a bank transfer to a verified account belonging to the payer or the Lumora account owner; Lumora does not refund an unverified third-party account."
```

### Tác động vận hành nếu phê duyệt

- Hệ thống đã cấp mã tham chiếu ngay sau khi lưu thành công support request.
- Người vận hành phải theo dõi hộp thư hỗ trợ đủ thường xuyên để đáp ứng mốc 02 ngày làm việc.
- Cần lưu thời điểm “đã nhận đủ thông tin” để tính mốc 05 ngày minh bạch.
- Cần có quy trình xác minh người nhận trước khi chuyển khoản thủ công và tuyệt đối không yêu cầu mật khẩu, OTP hoặc thông tin ngân hàng đầy đủ qua form support.
- Nếu Lumora không đủ nhân lực duy trì các mốc trên, PO phải tăng SLA trước khi phê duyệt thay vì công bố rồi không đáp ứng.

### Căn cứ tham khảo đang có hiệu lực tại thời điểm soạn

- [Luật Thương mại điện tử số 122/2025/QH15](https://vanban.chinhphu.vn/?classid=1&docid=216503&pageid=27160&typegroupid=3), hiệu lực từ 01/07/2026.
- [Nghị định số 248/2026/NĐ-CP](https://vanban.chinhphu.vn/?docid=218747&orggroupid=2&pageid=27160), hiệu lực từ 01/07/2026.
- [Luật Bảo vệ quyền lợi người tiêu dùng số 19/2023/QH15](https://vanban.chinhphu.vn/?classid=1&docid=208363&orggroupid=1&pageid=27160&previousPage=other+articles), hiệu lực từ 01/07/2024.

Các nguồn trên được dùng để định hướng công khai, minh bạch và bảo vệ quyền lợi người dùng. Bộ câu chữ vẫn cần người chịu trách nhiệm kinh doanh/pháp lý rà soát theo mô hình và tư cách thuế thực tế của Lumora.

## Nội dung cần PO rà soát trước khi đặt `LEGAL_CONTENT_APPROVED=true`

1. Xác nhận chủ thể ký kết hợp đồng dịch vụ và thông tin công khai tại `/owner-info/`.
2. Duyệt câu thuế/phí hiển thị tại trang chính sách và màn hình rà soát đơn.
3. Duyệt SLA hỗ trợ, thời hạn hoàn tiền và phương thức hoàn tiền.
4. Xác nhận danh sách nhà cung cấp dữ liệu trong Privacy: hạ tầng lưu trữ, ImageKit, PayOS và Gmail. SoundCloud legacy đang bị quarantine và không còn được nhúng ở bề mặt end-user.
5. Xác nhận thời gian lưu từng nhóm dữ liệu ngoài activity log 180 ngày, đặc biệt tài khoản, media, payment và support request.
6. Duyệt quy trình thay đổi Điều khoản/Chính sách và phương thức thông báo cho user.
7. Duyệt ngôn ngữ Việt/Anh là tương đương về ý nghĩa.

## Quyết định sản phẩm đã được xác nhận trong quá trình triển khai

- Pro: `29.000đ/tháng`, `189.000đ/năm`.
- Mọi bảng giá và quyền lợi user-facing lấy từ `config/plans.js` qua public-config; không sửa giá lặp ở từng màn hình.
- `Fall Through Memories` là tính năng **Chuyển vũ trụ** thuộc gói Pro (`fall_universe`).
- Mỗi giao dịch mua một kỳ riêng, không tự động trừ tiền và không tự động gia hạn.
- Ngày 15/08/2026: tạm ngừng feature `music` và quarantine toàn bộ catalog upload/SoundCloud hiện tại vì chưa có giấy phép; không xóa dữ liệu, không trả URL hoặc phát nhạc qua public viewer.
- Soundscape do Lumora tổng hợp hoàn toàn bằng Web Audio, không dùng sample bên thứ ba, là tính năng cơ bản miễn phí cho mọi user.

## Việc bên ngoài repository

- PO tự nộp hồ sơ thông báo TMĐT và thực hiện thủ tục thuế/đăng ký kinh doanh cần thiết.
- Không gắn xác nhận Bộ Công Thương trước khi có URL chính thức.
- Cần credentials môi trường test/sandbox để QA PayOS success, cancel, pending và error; không dùng giao dịch tiền thật trong QA.
