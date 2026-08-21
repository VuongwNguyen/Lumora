# AGENTS.md — Quy tắc làm việc trong Lumora

Tài liệu này áp dụng cho mọi AI agent, coding assistant và automation làm việc trong repository này. Mục tiêu là giữ Lumora nhất quán, an toàn và không làm lệch các quyết định sản phẩm đã được chốt.

## Kim chỉ nam sản phẩm — Sứ mệnh và tầm nhìn

### Product Philosophy

> **Lumora không bán feature. Lumora bán cảm xúc. Feature chỉ tồn tại để tạo ra, truyền tải, dẫn dắt hoặc khuếch đại cảm xúc.**

User nói họ muốn người xem cảm thấy gì. Lumora quyết định cách kể, sắp nhịp và trình bày câu chuyện đó. Người dùng không cần hiểu particle, camera, transition hay renderer để tạo nên một trải nghiệm có cảm xúc.

### Sứ mệnh

Giúp con người biến những ký ức và điều khó nói thành một trải nghiệm có thể được cảm nhận, không chỉ thành một tập hợp ảnh, chữ hoặc hiệu ứng.

```text
User cung cấp ký ức và ý định cảm xúc.
Story Engine hiểu câu chuyện nên được kể như thế nào.
Story Emotion Engine hiểu câu chuyện nên được cảm nhận như thế nào.
Universe quyết định nơi câu chuyện trở nên sống động.
```

### Tầm nhìn

Lumora trở thành người đạo diễn trải nghiệm ký ức: phối hợp narrative, emotion, timing, soundscape, visual identity và không gian để người nhận thực sự đi qua câu chuyện thay vì chỉ xem nội dung.

### North Star

> **Lumora không render ký ức. Lumora đạo diễn cách ký ức được cảm nhận.**

Mọi quyết định sản phẩm và kỹ thuật phải trả lời được:

> **Điều này khiến người xem cảm thấy gì?**

- Nếu câu trả lời chỉ là “trông đẹp hơn”, thay đổi đó chưa đủ để trở thành một Lumora capability có ý nghĩa.
- Primary UX phải emotion-first: user chọn ý định và cảm xúc; hệ thống chịu trách nhiệm chuyển chúng thành hành vi kỹ thuật phù hợp.
- Universe, Story, Emotion, Theme và Soundscape phải giữ đúng ranh giới trách nhiệm; không nhập nhằng layer chỉ để triển khai nhanh.
- Functional correctness là điều kiện cần, không phải đích cuối. Trải nghiệm còn phải có nhịp điệu, contrast, khoảng lặng, climax, release và sự nhất quán cảm xúc khi phù hợp.
- Kim chỉ nam này không cho phép bỏ qua auth, ownership, validation, accessibility, performance, bản quyền, pháp lý, payment safety hoặc quyền riêng tư. Niềm tin của người dùng là một phần của trải nghiệm cảm xúc.

Nguồn định hướng chi tiết: [`docs/Lumora — Story Emotion Engine (SE v2) Specification.md`](./docs/Lumora%20%E2%80%94%20Story%20Emotion%20Engine%20%28SE%20v2%29%20Specification.md).

## 1. Nguyên tắc cao nhất

1. Đọc file này trước khi sửa code.
2. Hiểu luồng hiện tại trước khi thay đổi; không đoán kiến trúc từ tên file.
3. Chỉ sửa đúng phạm vi người dùng yêu cầu. Bảo toàn mọi thay đổi không liên quan trong worktree.
4. Không được làm yếu auth, ownership, validation, payment safety hoặc tracking để “cho chạy được”.
5. Không hardcode dữ liệu đã có nguồn dùng chung.
6. Không commit, push, deploy, tạo PR hoặc chạy thao tác phá hủy nếu người dùng chưa yêu cầu rõ ràng.
7. Nếu yêu cầu mới mâu thuẫn với quyết định sản phẩm hoặc tài liệu pháp lý hiện có, dừng và nêu rõ xung đột trước khi triển khai.

## 2. Bản đồ kiến trúc

- `index.js`: cấu hình Express, security headers, rate limit, static assets và public `/view/` gateway.
- `routes/`: khai báo endpoint và middleware auth.
- `controllers/`: kiểm tra request ở mức HTTP, gọi service và chuẩn hóa response.
- `services/`: business rules, subscription, payment, galaxy, tracking và hỗ trợ.
- `models/`: Mongoose schema/index.
- `middlewares/`: auth, subscription entitlement và activity context.
- `config/`: nguồn cấu hình dùng chung cho plan, compliance, tracking và runtime mode.
- `public/`: frontend HTML/CSS/vanilla JavaScript đang phục vụ thực tế.
- `public/shared/`: UI, i18n và tracking dùng chung giữa các trang.
- `public/admin/`: giao diện quản trị; không thuộc phạm vi end-user tracking.
- `tests/`: test Node.js built-in test runner.
- `scripts/`: audit/check hỗ trợ dự án.
- `docs/`: spec, quyết định PO và checklist release.
- `web/`: ứng dụng phụ riêng. Không tự động đồng bộ thay đổi từ `public/` sang đây nếu chưa xác nhận nó nằm trong scope.

Luồng backend chuẩn:

`route -> auth/middleware -> controller -> service -> model -> standardized response`

Business rule phải nằm ở service hoặc config dùng chung, không chỉ nằm ở frontend.

## 3. Lệnh làm việc chuẩn

```bash
npm run dev
npm start
npm test
npm run test:activity
npm run test:tmdt
npm run audit:activity
git diff --check
```

- Dev server mặc định chạy cổng `3030`.
- `npm run dev` đặt `NODE_ENV=development`.
- `npm start` đặt `NODE_ENV=production`.
- Trước khi bàn giao thay đổi code, tối thiểu chạy test liên quan, syntax check cho JavaScript đã sửa và `git diff --check`.
- Không tự chạy `npm audit fix`, đặc biệt không dùng `--force`. Việc nâng dependency phải là một thay đổi riêng, có kiểm tra breaking change.

## 4. Quy ước code backend

- Dự án dùng CommonJS: `require(...)` và `module.exports`.
- Giữ controller mỏng; logic nghiệp vụ, validation theo domain và truy vấn phối hợp đặt trong service.
- Route async phải đi qua `context/asyncHandler`.
- Endpoint cần đăng nhập dùng `requireAuth`; endpoint admin dùng `requireAdmin` hoặc kiểm tra role từ `req.user` đã được backend xác thực.
- Thành công dùng `successfullyResponse`; lỗi nghiệp vụ dùng `errorResponse` với `statusCode` chính xác.
- Không trả stack trace, provider secret, checkout URL nội bộ hoặc field `select: false` ra public API.
- Không tin `userId`, role, price, plan capability, payment status hoặc ownership do client gửi lên.
- Khi update model, dùng allowlist field. Không truyền thẳng `req.body` vào MongoDB update.
- Mọi truy vấn dữ liệu người dùng phải scope theo user đã xác thực, trừ endpoint admin có chủ đích.
- Giữ operation idempotent cho payment/webhook và các mutation có thể retry.
- Nếu mock model trong test, luôn khôi phục method gốc trong `finally`.

## 5. Auth, role và entitlement

Role phải được lấy từ database trong `middlewares/auth.js`; JWT chỉ xác định session/user. Frontend không được tự cấp quyền từ `localStorage.user.role`.

Thứ tự quyền bắt buộc:

```text
admin > partner (Pro-equivalent) > subscription
```

Nguồn chuẩn là `config/runtime.js`:

- Admin nhận `accessMode: "admin"`, toàn bộ tính năng và không giới hạn số galaxy.
- Partner nhận `accessMode: "partner"`, các tính năng Galaxy và giới hạn số galaxy tương đương đúng gói Pro hiện tại; không được mở quyền admin hoặc payment simulation.
- User luôn dùng subscription thật. Partner chỉ dùng subscription thật ngoài phạm vi Galaxy được cấp tương đương Pro; development không tự cấp thêm quyền cho bất kỳ role nào.
- `NODE_ENV=development` chỉ phục vụ tooling/log/rate-limit behavior, không cấp quyền sản phẩm.

Quy tắc bypass:

- Bypass chỉ bỏ giới hạn plan/feature và số galaxy.
- Partner phải được giới hạn theo `PLANS.pro`; không được dùng bypass vô hạn của admin và không tự động vượt qua plan cao hơn Pro nếu sau này có thêm plan.
- Không bao giờ bypass authentication, session validity, ownership, input validation, allowed template hoặc security controls.
- Backend phải là lớp quyết định cuối cùng. Mở khóa frontend mà API vẫn 403 là lỗi; frontend mở được do role giả cũng là lỗi.
- Frontend lấy entitlement từ authenticated `GET /payment/status` và dùng `features`, `maxGalaxies`, `accessMode` trong response.
- Khi thêm một điểm khóa mới, dùng `hasEntitlementBypass()`/`getEntitlementBypassMode()` cho admin và `getRoleEntitlementPlan()` cho quyền Partner giới hạn ở Pro; thêm test cho user, partner và admin khi phù hợp.

## 6. Plan và giá — một nguồn duy nhất

Nguồn chuẩn duy nhất cho paid plan là `config/plans.js`.

- Thêm/sửa/xóa plan tại `PLANS`; không tạo bảng giá thứ hai trong HTML, frontend hoặc controller.
- `PLAN_KEYS` và `PLAN_RANK` phải được derive từ `PLANS`.
- Thứ tự khai báo là fallback upgrade rank; chỉ thêm `rank` khi thật sự cần override.
- Mongoose enum của payment/subscription phải derive từ `PLAN_KEYS`.
- Feature check backend phải dùng `planHasFeature(plan, feature)`.
- Public/Portal/Admin/Payment Policy phải render động từ public compliance config hoặc API liên quan.
- Không hardcode `plus`, `pro`, giá `10.000đ`, `29.000đ`, `189.000đ` vào UI mới.
- Khi đổi plan config, thêm hoặc cập nhật test chứng minh thay đổi lan tới public config, persistence enum và UI động.

Quyền hiện tại:

- Plus: `themes`, tối đa 3 galaxy.
- Pro: `themes`, `text`, `fall_universe`, tối đa 10 galaxy.
- Soundscape nguyên bản của Lumora là tính năng cơ bản miễn phí, không dùng sample hoặc URL audio bên thứ ba.
- Feature `music` và catalog nhạc cũ đang bị quarantine cho tới khi từng track có giấy phép thương mại hợp lệ; public API/viewer không được trả hoặc phát URL catalog cũ.
- Giá hiện tại phải đọc trực tiếp từ `config/plans.js`, không sao chép từ tài liệu này.

## 7. Payment và subscription safety

- Payment production dành cho user/partner chỉ được bật khi `config/compliance.js` xác nhận đủ cấu hình, nội dung pháp lý đã duyệt và PayOS credentials hợp lệ.
- Không bỏ guard `payments.enabled` đối với user/partner ở production.
- Admin đã xác thực được phép gọi checkout PayOS thật qua `POST /payment/create` ngay cả khi public payment đang khóa, nhưng chỉ khi đủ PayOS credentials. Đây là luồng kiểm thử nhà cung cấp, không cấp ngoại lệ cho user/partner và vẫn phải giữ review, idempotency, giá phía server cùng webhook verification.
- Amount, period, label và feature phải tính từ server config; không tin amount do client gửi.
- Tạo payment thật phải có `Idempotency-Key` hợp lệ và unique theo user.
- Webhook PayOS phải verify signature trước khi đổi payment/subscription.
- Giữ state transition rõ ràng: `pending -> processing -> paid`; failure/cancel phải có trạng thái riêng.
- Không xóa payment record khi provider lỗi; giữ record phục vụ audit và lịch sử giao dịch.
- Payment history chỉ trả field công khai, scope theo authenticated user và có pagination.
- `POST /payment/admin-simulate` chỉ dành cho admin, phải dùng `requireAdmin` ở route và kiểm tra role lại trong service.
- Admin simulation không được gọi PayOS, không thu tiền thật và phải đánh dấu payment/subscription bằng `isSimulation: true`.
- Giao dịch mô phỏng phải bị loại khỏi doanh thu, active subscription và cancellation metrics thật.
- User hoặc partner không được mô phỏng thanh toán chỉ vì server đang chạy development.
- Không thay đổi thời hạn subscription, refund behavior hoặc webhook semantics nếu chưa có yêu cầu rõ ràng và test đi kèm.

## 8. Compliance và nội dung công khai

- Public config chỉ được expose field nằm trong allowlist của `config/compliance.js`.
- Không công khai secret, database URL, JWT secret, Gmail password, ImageKit private key hay PayOS credentials.
- Không tự bịa tên chủ sở hữu, mã số thuế, địa chỉ, cam kết hỗ trợ, thời gian hoàn tiền hoặc tình trạng thông báo Bộ Công Thương.
- Nội dung chưa được PO xác nhận phải ghi vào `docs/tmdt-po-decisions.md`; không biến giả định thành cam kết công khai.
- Các trang owner info, terms, privacy, payment policy, refund policy và support phải giữ navigation thống nhất.
- Nội dung pháp lý/công khai mới phải có cả tiếng Việt và tiếng Anh theo cơ chế i18n hiện có.
- URL xác nhận Bộ Công Thương chỉ chấp nhận HTTPS và chỉ cấu hình sau khi có xác nhận thật.
- Không bật `LEGAL_CONTENT_APPROVED` hoặc `PAYMENTS_ENABLED` thay người dùng.

## 9. Activity tracking

Mục tiêu là tracking toàn diện mọi bề mặt end-user; admin UI được loại trừ có chủ đích.

- `NODE_ENV=development` luôn tắt persistence của activity, bất kể `ACTIVITY_TRACKING_ENABLED`; production vẫn tuân theo biến cấu hình này.

- Mọi page end-user mới phải load stack tracking dùng chung theo pattern hiện có.
- Mọi CTA/nút/tab/form quan trọng phải có action ổn định, dễ lọc và không phụ thuộc text dịch.
- Mutation backend quan trọng phải `safeLog` success/failure với feature và metadata tối thiểu cần thiết.
- Frontend dùng `window.LumoraActivity`, `trackedFetch` và auto tracker hiện có; không tự dựng logger thứ hai.
- Action name dùng tiếng Anh, dạng ổn định như `Galaxy Universe Select`, `Payment Succeeded`.
- Feature/error type mới phải cập nhật config allowlist/mapping liên quan.
- Với webhook/retry, dùng dedup key ổn định để tránh log trùng.
- Không ghi password, token, OTP, cookie, raw authorization header, payment credential, nội dung riêng tư đầy đủ hoặc URL query nhạy cảm.
- Giữ redaction, truncation, retention và opt-out behavior hiện có.
- Security/server failures cần thiết vẫn được log theo policy ngay cả khi analytics opt-out.
- Sau thay đổi diện rộng, chạy cả `npm run test:activity` và `npm run audit:activity`.

## 10. Galaxy, template và premium feature

- Public entry point chuẩn là `/view/?galaxyId=...`; không tạo thêm link share phụ theo template.
- `/view/` tự chọn Story, Galaxy Classic hoặc Fall dựa trên dữ liệu galaxy.
- Template hợp lệ hiện tại là `galaxy` và `fall`.
- `Galaxy Classic` là lựa chọn cơ bản; chỉ `Fall Through Memories` yêu cầu feature `fall_universe`.
- UI premium phải xếp sau chức năng cơ bản, có badge plan rõ ràng và trạng thái khóa dễ đọc.
- Không khóa cả tab Vũ trụ chỉ vì Fall cần Pro.
- Backend phải kiểm tra `fall_universe` khi lưu `template: "fall"`; frontend lock chỉ là UX.
- Admin entitlement có thể dùng Fall nhưng UI vẫn nên thể hiện đây là feature Pro.
- Khi đổi template trong setup, preview vẫn đi qua `/view/` để server chọn template đúng.
- `soundscape` chỉ nhận preset và các tham số nằm trong allowlist server; không nhận audio URL, sample hoặc cấu hình node tùy ý từ client.

## 11. Frontend và UX

- Frontend chính là HTML/CSS/vanilla JavaScript trong `public/`.
- Ưu tiên DOM API và `textContent` cho dữ liệu động. Chỉ dùng `innerHTML` với markup tĩnh/được kiểm soát.
- Không render dữ liệu user/public config chưa escape vào HTML string.
- Giữ dark visual language, contrast đủ đọc và trạng thái hover/focus/disabled/locked rõ ràng.
- Button phải khai báo `type="button"` nếu không có chủ đích submit form.
- Modal/dialog mới phải hỗ trợ Escape, focus hợp lý, label và error state.
- Dynamic list phải có loading, empty, error và pagination state khi cần.
- Responsive: kiểm tra panel hẹp/mobile và không tạo horizontal overflow vô lý.
- Không dùng màu nền mặc định của browser cho button/card trong dark UI.
- Không thay thế i18n hiện có bằng chuỗi hardcode nếu bề mặt đó hỗ trợ đa ngôn ngữ.
- Lỗi từ server hiển thị qua `window.LumoraErrors.resolve(data, window.t)`, không đọc thẳng `data.message`. Chi tiết và cách thêm mã mới: xem `CLAUDE.md`.

### Kiểm chứng thị giác là bắt buộc

Việc chạm UI hoặc scene 3D **chưa xong** khi mới có test logic xanh. Phải mở trong browser thật, chụp màn hình và **nhìn vào ảnh đó**.

```bash
npm run dev
npm run test:visual          # Playwright, Firefox + Chromium, 4 viewport
```

- Điểm vào thật là `/view/?galaxyId=...`, không phải `/{template}/` — đường sau bị 302 và nuốt query.
- Thêm `?debug=1` để đọc telemetry renderer (`window.__lumora`): draw call, tam giác, fps, texture MB.
- Không được coi những thứ này là bằng chứng UI đã xong: `node --test` xanh, không lỗi console, "code đọc thì đúng", hoặc đã chụp ảnh mà không xem.

Chi tiết workflow, ngưỡng chất lượng 3D và các bẫy `three@0.152.2` đã gặp: xem `CLAUDE.md`.

## 12. Security và dữ liệu

- Không commit `.env`, token, secret, credential thật, dump database hoặc dữ liệu người dùng.
- `.env.example` chỉ chứa placeholder và mô tả an toàn.
- Không giảm Helmet/CSP, CORS, rate limit, upload limit hoặc auth requirement nếu chưa có lý do và đánh giá rủi ro.
- Validate URL protocol, email, phone, enum, length và object ownership ở server.
- Tránh NoSQL injection: không truyền filter/update tùy ý từ query/body.
- Upload phải giữ giới hạn MIME/size và ownership hiện có.
- Không log full request body ở auth, payment, support hoặc account flow.
- Không chạy destructive database/filesystem operation nếu chưa được người dùng xác nhận rõ target.

## 13. Test và Definition of Done

Một thay đổi chỉ được coi là hoàn thành khi:

1. Code giải quyết đúng yêu cầu và không chỉ che lỗi ở UI.
2. Auth, ownership, entitlement và validation vẫn đúng.
3. Có test regression cho business rule hoặc bug quan trọng.
4. JavaScript đã sửa qua `node --check` khi áp dụng được.
5. `npm test` pass.
6. Tracking coverage pass nếu thay đổi bề mặt end-user.
7. `git diff --check` sạch.
8. Không có secret hoặc file cá nhân trong diff.
9. Tài liệu PO/open decision được cập nhật nếu có quyết định chưa xác nhận.
10. Agent báo rõ phần đã làm, test đã chạy và phần còn blocked/chưa xác nhận.

Không sửa test để hợp thức hóa behavior sai. Khi test và yêu cầu mâu thuẫn, tìm root cause và cập nhật cả implementation lẫn test theo quyết định sản phẩm đã xác nhận.

## 14. Git và bàn giao

- Trước khi stage: chạy `git status -sb`, xem diff và xác định file nào thuộc scope.
- Không stage `.claude/`, `.superpowers/`, worktree cá nhân, file tạm hoặc artifact editor.
- Worktree có thay đổi của người dùng: bảo toàn và tránh ghi đè.
- Không dùng `git reset --hard`, `git checkout --`, force push hoặc rebase phá lịch sử nếu chưa được yêu cầu rõ.
- Chỉ `git add -A` khi người dùng đã xác nhận toàn bộ worktree thuộc scope; mặc định stage file cụ thể.
- Commit message ngắn, mô tả outcome.
- Chỉ push thẳng `main` khi người dùng yêu cầu rõ. Nếu không, dùng branch/PR phù hợp.
- Sau push, báo branch, commit SHA, validation và file cố ý không đưa vào commit.
- Không tự deploy chỉ vì đã push. `npm run deploy` trong repo thực chất push `main`; `npm run redeploy` kích hoạt workflow và cần quyền riêng.

## 15. Khi cần hỏi lại

Phải hỏi hoặc ghi thành quyết định PO chưa xác nhận khi thay đổi liên quan đến:

- giá, kỳ hạn, discount hoặc quyền lợi plan;
- nội dung pháp lý và cam kết công khai;
- refund timeline/method;
- bật thanh toán production;
- role/permission mới;
- retention hoặc dữ liệu tracking mới có tính nhạy cảm;
- xóa/migrate dữ liệu;
- dependency upgrade có breaking change;
- deploy production hoặc thay đổi infrastructure.

Nếu có thể thực hiện phần kỹ thuật an toàn trước, hãy làm phần đó và ghi phần cần PO xác nhận vào tài liệu quyết định thay vì tự đoán.
