# Lumora Full Application Activity Tracking — Design Spec

**Date:** 2026-08-10 (`Asia/Ho_Chi_Minh`)
**Status:** Draft — chờ duyệt trước khi implementation
**Reference implementation:** `/home/vuongwnguyen/CODE/ArenaBilliard/arena-mobile`
**Scope:** Toàn bộ bề mặt end-user của Lumora: public website, auth, portal, galaxy/story setup, public viewers, subscription/payment, account, frontend reliability và các backend flow phục vụ end-user. Admin chỉ dùng để xem log, không phải đối tượng được tracking.

---

## 1. Quyết định đã chốt

Lumora dùng mô hình **activity logging toàn diện** giống `arena-mobile`, không chỉ product funnel.

Hệ thống phải log:

- Mỗi màn hình/page được mở và rời khỏi.
- Mỗi button, link, tab, card, menu, modal action và control có thể tương tác.
- Submit, result thành công, result thất bại và user cancel/abandon.
- Tap bị chặn, guard `return`, button disabled và thao tác không thực hiện được.
- Mỗi lỗi API, network, timeout, HTTP 4xx/5xx.
- JavaScript error, unhandled Promise rejection và resource load error.
- Lỗi nghiệp vụ ở từng `catch`, `xhr.onerror`, `audio.play().catch`, image/audio/script load.
- Backend request thất bại, error middleware, payment webhook và tác vụ nghiệp vụ quan trọng.
- Thời lượng thao tác dài bằng `startedAt`, `endedAt`, `durationMs`.

Tracking phải đủ chi tiết để:

1. Dựng funnel hành vi.
2. Debug một journey theo session.
3. Tìm nút “bấm không ăn”.
4. Thống kê lỗi theo feature, page, endpoint, browser và galaxy template.
5. Phân biệt user cancel với system error.
6. Đo conversion upgrade/payment.

---

## 2. Những gì kế thừa từ Arena

Lumora áp dụng trực tiếp các nguyên tắc đã dùng trong `arena-mobile`:

| Arena | Lumora |
|---|---|
| `addActivityAsync(...)` | `LumoraActivity.log(...)` |
| `activityApi` riêng | `activityApi.js` riêng, gọi `/activity/add` |
| `action` human-readable | Giữ nguyên kiểu `Feature Object Verb` |
| Auto derive `feature` | `deriveFeature(action)` là nguồn chuẩn |
| `status` migrate vào metadata | Giữ `metadata.status = 0/1` |
| `level=info/warn/error/fatal` | Giữ nguyên 4 level |
| `sessionId` auto inject | UUID/tab session, auto inject |
| `deviceId` | Anonymous browser UUID, không fingerprint |
| `startedAt` / `endedAt` | Giữ nguyên |
| Object description → metadata | Giữ cùng API compatibility |
| Error classifier | Có classifier chung cho API/JS/resource/payment/upload |
| `errorTypeDescription` | Auto inject mô tả tiếng Việt |
| Credential redaction | Redact recursive trước khi gửi |
| Global API interceptor | Wrapper chung cho `fetch` và XHR |
| ErrorBoundary | `window.onerror` + `unhandledrejection` + startup guard |
| Fire-and-forget | Không block UI, không throw ra caller |
| Dedup/noise control | Không log theo frame/keystroke/progress tick |

### Ba điều chỉnh bắt buộc vì Lumora là web

1. Không có Redux thunk: logger là module vanilla JavaScript dùng toàn site.
2. Không lấy hardware device ID: dùng random browser UUID trong `localStorage`.
3. Landing/public viewer không có JWT: endpoint chấp nhận anonymous event; nếu JWT hợp lệ thì server tự gắn `userId`.

Activity API nằm trong BE-Moon ở phiên bản đầu, nhưng client transport được tách riêng để sau này có thể chuyển sang activity service độc lập mà không sửa call sites.

---

## 3. Naming convention

Tên action dùng tiếng Anh, Title Case, ổn định sau khi release.

```text
<Feature> <Object> <Action>
```

Ví dụ:

```text
View Landing Page
Landing Hero Start Click
Auth Login Submit
Auth Login Result
Portal Galaxy Create Open
Galaxy Photo Upload Result
Galaxy Theme Select
Subscription Checkout Click
Payment Checkout Started
API Error
Resource Load Error
App Crash
```

Quy ước:

- `View ... Page/Screen`: vào màn.
- `... Leave`: rời màn, luôn có `durationMs`.
- `... Click`: click/tap intent.
- `... Submit`: request/action bắt đầu.
- `... Result`: kết quả, dùng `metadata.status`.
- `... Blocked`: user đã bấm nhưng guard không cho thực hiện.
- `... Cancelled`: user chủ động huỷ, `level='warn'`, không tính là error.
- `... Failed` / `... Error`: system/operation thất bại, `level='error'`.

Không tạo action động chứa email, galaxy name, query hoặc database ID. Các giá trị đó chỉ nằm trong metadata đã được allow/redact.

---

## 4. Feature taxonomy

`deriveFeature(action)` tự map action về feature:

```text
landing
auth
portal
galaxy
story
viewer
subscription
payment
account
share
media
legal
reliability
other
```

Ưu tiên rule cụ thể trước rule tổng quát. Call site chỉ override `feature` khi action name không đủ context.

Ví dụ:

- `Galaxy`, `Photo`, `Theme`, `Music`, `Caption` → `galaxy`
- `Story`, `Chapter` → `story`
- `Subscription`, `Plan`, `Billing` → `subscription`
- `Payment`, `PayOS`, `Checkout` → `payment`
- `API`, `App`, `Resource`, `Network` → `reliability`

---

## 5. Activity schema

File: `models/activity.js`

```js
{
  action:       String,    // required, max 160
  feature:      String,    // required, indexed
  level:        String,    // info | warn | error | fatal

  userId:       ObjectId,  // server derives from JWT, optional
  clientIp:     String,    // server derives, never accepted from body
  anonymousId:  String,    // browser UUID
  deviceId:     String,    // alias compatible with Arena; same browser UUID

  sessionId:    String,    // also mirrored in metadata.sessionId
  requestId:    String,    // correlate frontend API error ↔ backend request
  galaxyId:     ObjectId,  // optional context
  paymentId:    ObjectId,  // optional context

  page:         String,    // logical page
  path:         String,    // pathname only, no query/hash
  description:  String,    // legacy/plain text only, max 2000
  metadata:      Mixed,     // sanitized JSON context

  startedAt:    Date,
  endedAt:      Date,
  createdAt:    Date,      // server time
  expiresAt:    Date,      // TTL
}
```

### Server auto-fill

- `userId`: decode từ JWT hợp lệ; không tin `userId` client gửi.
- `clientIp`: `cf-connecting-ip` → `x-real-ip` → first `x-forwarded-for` → `req.ip`.
- `createdAt`: server time.
- `requestId`: lấy `X-Request-Id` hoặc tạo UUID.
- `feature`: derive nếu client không truyền.
- `level`: derive nếu client không truyền.
- `metadata.sessionId`: copy từ session ID hợp lệ.
- `metadata.errorTypeDescription`: lookup từ catalog.

### Indexes

```js
{ createdAt: -1 }
{ feature: 1, createdAt: -1 }
{ action: 1, createdAt: -1 }
{ level: 1, createdAt: -1 }
{ userId: 1, createdAt: -1 }
{ anonymousId: 1, createdAt: -1 }
{ sessionId: 1, createdAt: 1 }
{ requestId: 1 }
{ galaxyId: 1, createdAt: -1 }
{ expiresAt: 1 } // TTL
```

Raw activity retention mặc định: **180 ngày**.

---

## 6. Client API

### `public/shared/js/activityApi.js`

Transport riêng, tương đương `arena-mobile/src/utils/activityApi.ts`:

- Endpoint: `POST /activity/add`.
- Timeout: 10 giây.
- Inject `Authorization: Bearer <token>` nếu có.
- `Content-Type: application/json`.
- Không retry vô hạn.
- Tuyệt đối không gọi global tracked fetch để tránh recursive loop.

### `public/shared/js/activityLogger.js`

Public API:

```js
window.LumoraActivity.log({
  action: 'Galaxy Photo Upload Result',
  feature: 'galaxy',            // optional override
  status: 1,                    // moved to metadata.status
  level: 'info',                // optional override
  description: {
    count: 3,
    durationMs: 1240,
  },
  startedAt: new Date(start).toISOString(),
  endedAt: new Date().toISOString(),
  galaxyId,
});
```

Helper API:

```js
LumoraActivity.log(activity);
LumoraActivity.logClick(action, metadata);
LumoraActivity.logResult(action, ok, metadata, error);
LumoraActivity.logBlocked(action, reason, metadata);
LumoraActivity.logPageView(page, metadata);
LumoraActivity.logPageLeave(page, metadata);
LumoraActivity.redactCredential(value);
LumoraActivity.getApiErrorMeta(error, request);
LumoraActivity.classifyError(error);
```

### Behaviour giống Arena

1. Fire-and-forget; caller không cần `await`.
2. Mọi lỗi transport bị swallow; chỉ `console.warn` trong development.
3. Description object được chuyển sang `metadata`.
4. `status` được chuyển vào `metadata.status`.
5. Auto inject `sessionId`, `anonymousId`, page, path, language, viewport, browser family.
6. `errorType` cụ thể hoặc `status=0` → `level='error'`.
7. User cancel/abandon → explicit `level='warn'`.
8. Auto inject `errorTypeDescription`.
9. Redact recursive và truncate trước khi gửi.
10. Không hiện toast khi logger lỗi.

---

## 7. Identity và session

### Anonymous/device ID

- Key: `lumora_device_id`.
- UUID v4, sinh bằng `crypto.randomUUID()`; fallback random UUID.
- Persist trong `localStorage`.
- Không fingerprint canvas/font/hardware.

### Session ID

- Key: `lumora_activity_session`.
- UUID v4 + `lastActivityAt`.
- Reset sau 30 phút không hoạt động.
- Dùng để đọc journey xuyên page trong cùng phiên.

### Authenticated user

- Client vẫn gửi token theo cơ chế hiện tại.
- Server verify JWT và tự gắn `userId`.
- Payload có `userId` bị bỏ qua.
- Log logout phải gửi trước khi token bị xoá, giống Arena.

---

## 8. Endpoint

### `POST /activity/add`

Auth: optional.

Body tương thích cấu trúc Arena:

```json
{
  "action": "Galaxy Photo Upload Result",
  "feature": "galaxy",
  "deviceId": "uuid",
  "anonymousId": "uuid",
  "sessionId": "uuid",
  "page": "galaxy_setup",
  "path": "/portal/galaxy-setup.html",
  "galaxyId": "object-id",
  "startedAt": "2026-08-10T09:00:00.000Z",
  "endedAt": "2026-08-10T09:00:01.200Z",
  "level": "info",
  "metadata": {
    "status": 1,
    "count": 3,
    "durationMs": 1200
  }
}
```

Success:

```json
{
  "ok": true,
  "id": "activity-id",
  "createdAt": "2026-08-10T09:00:01.250Z"
}
```

Failure:

```json
{
  "ok": false,
  "error": "validation_error",
  "issues": []
}
```

### Validation

- Body tối đa 32 KB.
- `action` required, 1–160 chars.
- `feature` enum, server derive nếu thiếu.
- `level` enum.
- Metadata depth tối đa 5, tối đa 50 keys, string tối đa 2.000 chars.
- `path` chỉ pathname; query/hash bị strip.
- ObjectId context phải hợp lệ.
- Unknown top-level fields bị drop.
- Rate limit: 300 events / 15 phút / IP cho anonymous; 600 / 15 phút / authenticated user.

Tracking endpoint phải được loại khỏi chính global API error tracker để không tạo loop.

---

## 9. Global reliability instrumentation

### 9.1 Fetch wrapper

Tạo `public/shared/js/trackedFetch.js` hoặc tích hợp vào logger. Toàn bộ application code chuyển từ raw `fetch` sang wrapper.

Khi request fail:

```text
Action: API Error
Feature: reliability
Level: error
Metadata:
  endpoint       // normalized pathname, IDs → :id nếu có thể
  method
  httpStatus
  durationMs
  errorType
  errorMsg
  requestId
  page
```

Không log request body, Authorization header, password, OTP hoặc raw response chứa PII.

AbortController/user navigation cancel:

```text
Action: API Request Cancelled
Level: warn
Metadata: endpoint, method, durationMs, reason
```

### 9.2 XMLHttpRequest

Upload ảnh đang dùng XHR nên phải instrument:

- `XHR Request Error`
- `XHR Request Timeout`
- `XHR Request Aborted`
- Domain result như `Galaxy Photo Upload Result` vẫn log riêng.

Không log mỗi progress tick. Chỉ ghi final percent/duration trong result.

### 9.3 Global JavaScript errors

```text
App JavaScript Error          level=error
App Unhandled Rejection       level=error
App Startup Failed            level=fatal
```

Metadata:

- `errorType`
- redacted `errorMsg`
- redacted stack, max 4.000 chars
- filename chỉ pathname
- line/column
- page/path
- browser/platform

### 9.4 Resource errors

Capture phase listener cho `error` trên:

- `IMG`
- `SCRIPT`
- `LINK`
- `AUDIO`
- `VIDEO`
- `IFRAME`

Action:

```text
Resource Load Error
```

Metadata chỉ lưu resource type, same-origin pathname hoặc external hostname; không lưu signed URL/query.

### 9.5 Backend request/error logging

Thêm request ID middleware và duration timer.

- Không log mọi request thành activity mặc định để tránh nhân đôi volume.
- Log mọi response 4xx/5xx thành `Server Request Failed`.
- Log slow request vượt 2 giây thành `Server Request Slow`, `level=warn`.
- Error handler log `Server Unhandled Error`, `level=error|fatal`.
- Domain mutation quan trọng có Submit/Result server event riêng.

Metadata: normalized route, method, statusCode, durationMs, requestId, errorType, user role. Không lưu body/cookie/token.

---

## 10. Error taxonomy

`config/activityErrors.js` là single source of truth cho classifier và mô tả.

### Generic

```text
auth_unauthorized
auth_forbidden
not_found
validation_error
rate_limited
server_error
client_error
timeout
network_drop
request_cancelled
json_parse_error
javascript_error
unhandled_rejection
resource_load_fail
storage_unavailable
clipboard_fail
unknown
```

### Auth/account

```text
wrong_password
account_not_found
account_locked
email_unverified
email_already_used
otp_invalid_or_expired
otp_send_fail
password_change_fail
account_delete_fail
session_revoke_fail
```

### Galaxy/media/story

```text
galaxy_limit_reached
galaxy_fetch_fail
galaxy_create_fail
galaxy_update_fail
galaxy_delete_fail
photo_upload_fail
photo_delete_fail
theme_load_fail
theme_save_fail
music_load_fail
music_save_fail
audio_preview_fail
caption_save_fail
story_generate_fail
story_save_fail
story_photo_upload_fail
viewer_load_fail
viewer_webgl_fail
viewer_audio_fail
image_texture_fail
```

### Subscription/payment

```text
subscription_load_fail
checkout_create_fail
checkout_redirect_fail
payment_cancelled
payment_provider_rejected
payment_webhook_invalid
payment_webhook_process_fail
payment_pending_timeout
```

Mỗi error type có mô tả tiếng Việt auto inject vào `metadata.errorTypeDescription`.

---

## 11. Redaction và dữ liệu cấm

`redactCredential()` phải xử lý string, array và nested object.

Mask:

- `password`, `currentPassword`, `newPassword`.
- `otp`, reset token, JWT, Bearer header.
- Cookie/session ID xác thực.
- PayOS checksum/signature/API key.
- Signed ImageKit query.
- Email trong error body: hash hoặc mask local-part.
- Query parameters có `token`, `code`, `key`, `signature`, `password`, `otp`.

Không được log:

- Password/OTP/token thô.
- Caption, story hook, chapter content.
- Galaxy name.
- Full photo/audio URL có signed query.
- Full payment provider payload.
- Form input text.

Cho phép:

- `textLength`, `photoCount`, `chapterCount`.
- Enum selection.
- Database ID cần cho debug (`galaxyId`, `paymentId`) nếu user đã có quyền.
- Email domain nếu thật sự cần cho acquisition aggregate; không log email đầy đủ.

---

## 12. Noise control và dedup

“Track toàn diện” không đồng nghĩa ghi event theo từng frame hoặc từng ký tự.

Không log:

- `mousemove`, `pointermove`, WebGL render frame.
- Audio/video `timeupdate` liên tục.
- Upload/download progress tick.
- Mỗi ký tự `input`.
- Mỗi lần scroll pixel.

Log tại điểm kết thúc có ý nghĩa:

- Search: sau debounce 400 ms, log `queryLength` và result count, không log nội dung.
- Slider/drag: log lúc release/change committed.
- Scroll: log max depth khi rời page hoặc chạm milestone 25/50/75/100% tối đa một lần.
- Resource error: dedup theo `sessionId + resourceType + normalizedUrl` trong 5 giây.
- API error: một request chỉ có một global API error; domain result có thể log thêm vì khác mục đích.
- Page leave: dedup `pagehide + beforeunload + visibilitychange`.
- Payment webhook: deterministic key theo payment ID/status để retry không nhân log.

---

## 13. Full application event inventory

Danh sách dưới đây là **coverage tối thiểu**, không phải sample. Implementation audit phải bổ sung event cho mọi control động được tạo bằng JavaScript.

### 13.1 Global/lifecycle (`reliability`)

| Action | Trigger | Metadata |
|---|---|---|
| `App Session Started` | Logger init | page, referrerHost, UTM, browser, viewport |
| `App Page Leave` | Rời page | page, durationMs, exitVia |
| `App Visibility Changed` | visible ↔ hidden | from, to |
| `App Online` | Browser online | offlineDurationMs |
| `App Offline` | Browser offline | page |
| `App JavaScript Error` | `window.onerror` | errorType, errorMsg, stack |
| `App Unhandled Rejection` | Promise rejection | errorType, errorMsg, stack |
| `Resource Load Error` | asset error | resourceType, host/path |
| `API Error` | fetch 4xx/5xx/network | endpoint, method, status, duration |
| `API Request Cancelled` | abort | endpoint, method, reason |
| `Server Request Failed` | backend 4xx/5xx | route, method, requestId, duration |
| `Server Request Slow` | >2s | route, method, duration |
| `Server Unhandled Error` | Express error | route, errorType, requestId |

### 13.2 Landing (`landing`)

| Control/action | Activity action |
|---|---|
| Page open/leave | `View Landing Page`, `Landing Leave` |
| Features nav | `Landing Features Nav Click` |
| Pricing nav | `Landing Pricing Nav Click` |
| Login nav/footer | `Landing Login Click` (`location`) |
| Header Start for free | `Landing Header Start Click` |
| Hero primary CTA | `Landing Hero Start Click` |
| Hero demo CTA | `Landing Demo Click` |
| Free plan CTA | `Landing Plan CTA Click` (`plan=free`) |
| Plus plan CTA | `Landing Plan CTA Click` (`plan=plus`) |
| Pro plan CTA | `Landing Plan CTA Click` (`plan=pro`) |
| Bottom CTA | `Landing Bottom Start Click` |
| Terms/privacy links | `Landing Legal Link Click` (`target`) |
| Pricing section seen | `Landing Pricing Viewed` (one-shot IntersectionObserver) |
| Demo seen/started | `Landing Demo Viewed`, `Landing Demo Started` |

### 13.3 Auth (`auth`)

| Control/flow | Activity actions |
|---|---|
| Page | `View Auth Page`, `Auth Leave` |
| Login/Register tabs | `Auth Mode Select` (`mode`) |
| Password eye | `Auth Password Visibility Toggle` (`visible`, `context`) |
| Login submit | `Auth Login Submit`, `Auth Login Result` |
| Register submit | `Auth Register Submit`, `Auth Register Result` |
| Forgot password | `Auth Forgot Password Click` |
| Back buttons | `Auth Back Click` (`from`) |
| OTP submit | `Auth OTP Verify Submit`, `Auth OTP Verify Result` |
| Resend OTP | `Auth OTP Resend Click`, `Auth OTP Resend Result` |
| Forgot email submit | `Auth Password Reset Request Submit/Result` |
| Reset password | `Auth Password Reset Submit/Result` |
| Reset OTP resend | `Auth Reset OTP Resend Click/Result` |
| Terms/privacy | `Auth Legal Link Click` |
| Client validation blocked | `Auth Submit Blocked` (`form`, `reason`, field names only) |
| Redirect because already logged in | `Auth Already Authenticated Redirect` |

Result failure metadata: `errorType`, `httpStatus`, `durationMs`; tuyệt đối không log email/password/OTP.

### 13.4 Portal galaxy list (`portal`)

| Control/flow | Activity actions |
|---|---|
| Page open/leave | `View Portal Page`, `Portal Leave` |
| Settings open/close | `Portal Settings Toggle` |
| Account menu | `Portal Account Click` |
| Logout | `Portal Logout Click`, `Portal Logout Result` |
| Galaxies tab | `Portal Tab Select` (`tab=galaxies`) |
| Subscription tab | `Portal Tab Select` (`tab=subscription`) |
| Create modal open/cancel | `Portal Galaxy Create Open/Cancel` |
| Create submit/result | `Portal Galaxy Create Submit/Result` |
| Galaxy card | `Portal Galaxy Card Click` |
| Quick view | `Portal Galaxy Quick View Click` |
| Manage | `Portal Galaxy Manage Click` |
| Copy link | `Portal Galaxy Copy Link Click/Result` |
| Empty/load/error | `Portal Galaxy List Loaded/Failed` |

### 13.5 Account (`account`)

| Control/flow | Activity actions |
|---|---|
| Change password | `Account Password Change Submit/Result` |
| Session list | `Account Sessions Loaded/Failed` |
| Revoke one session | `Account Session Revoke Click/Result` |
| Logout all | `Account Logout All Click/Result` |
| Delete account | `Account Delete Click`, `Account Delete Confirm/Cancel`, `Account Delete Result` |
| Validation block | `Account Action Blocked` (`action`, `reason`) |

### 13.6 Subscription/payment (`subscription`, `payment`)

| Control/flow | Activity actions |
|---|---|
| Subscription tab shown | `Subscription View` (`entryPoint`) |
| Status load | `Subscription Status Loaded/Failed` |
| Monthly/yearly toggle | `Subscription Period Select` |
| Plus/Pro CTA | `Subscription Checkout Click` (`plan`, `period`, `renewal`) |
| Disabled/included plan click intent | `Subscription Checkout Blocked` (`reason`) |
| Create checkout | `Payment Checkout Submit/Result` |
| Redirect PayOS | `Payment Checkout Redirect` |
| Return success | `Payment Return Success` |
| Return cancel | `Payment Return Cancel` |
| Webhook success | `Payment Webhook Received`, `Payment Succeeded` |
| Webhook invalid/fail | `Payment Webhook Failed` |
| Pending timeout | `Payment Pending Expired` |

Backend Payment collection vẫn là nguồn chuẩn cho revenue; activity dùng cho journey/debug.

### 13.7 Galaxy setup (`galaxy`)

| Control/flow | Activity actions |
|---|---|
| Page open/loaded/failed/leave | `View Galaxy Setup Page`, `Galaxy Setup Loaded/Failed/Leave` |
| Panel toggle | `Galaxy Setup Panel Toggle` |
| Back Portal | `Galaxy Setup Back Click` |
| Rename open/submit/result/cancel | `Galaxy Rename Open/Submit/Result/Cancel` |
| Delete galaxy click/confirm/cancel/result | `Galaxy Delete Click/Confirm/Cancel/Result` |
| Story/Photos/Theme/Music/Caption tab | `Galaxy Setup Tab Select` |
| Locked tab/paywall visible | `Galaxy Premium Gate Viewed` |
| Upgrade CTA | `Galaxy Upgrade Click` (`feature`, `requiredPlan`) |
| Upload zone click | `Galaxy Photo Picker Open` |
| File selection | `Galaxy Photo Files Selected` (`count`, totalBytes) |
| Upload submit/result/error/abort | `Galaxy Photo Upload Submit/Result/Cancelled` |
| Photo open/delete | `Galaxy Photo Open`, `Galaxy Photo Delete Click/Result` |
| No theme/theme card | `Galaxy Theme Select`, `Galaxy Theme Result` |
| No music/music card | `Galaxy Music Select`, `Galaxy Music Result` |
| Preview music play/pause/error | `Galaxy Music Preview Toggle/Error` |
| Add caption | `Galaxy Caption Add Click/Result/Blocked` |
| Delete caption | `Galaxy Caption Delete Click/Result` |
| Caption overflow/limit | `Galaxy Caption Add Blocked` |
| Story setup CTA | `Galaxy Story Setup Click` |
| Copy share | `Galaxy Share Click/Result` |
| Preview iframe load/error | `Galaxy Preview Loaded/Failed` |

Mỗi `catch` hiện đang chỉ toast `Lưu thất bại`, `Xoá thất bại`, `Lỗi kết nối` phải có domain failure activity với operation và error type.

### 13.8 Story setup (`story`)

| Control/flow | Activity actions |
|---|---|
| Page open/loaded/failed/leave | `View Story Setup Page`, `Story Setup Loaded/Failed/Leave` |
| Panel/back | `Story Panel Toggle`, `Story Back Click` |
| Rename | `Story Rename Open/Submit/Result/Cancel` |
| Story type chip | `Story Type Select` |
| Occasion chip | `Story Occasion Select` |
| Chapter header/preview | `Story Chapter Preview Open/Close` |
| Add photo placeholder | `Story Chapter Photo Picker Open` |
| File selected/upload | `Story Chapter Photo Upload Submit/Result` |
| Hook input commit | `Story Chapter Hook Change` (`textLength`, not content) |
| Next/retry | `Story Wizard Next Click`, `Story Wizard Retry Click` |
| Yes/No | `Story Wizard Choice Select` (`choice`) |
| AI generation | `Story Generate Submit/Result` |
| Save chapters | `Story Save Submit/Result` |
| Blocked guard | `Story Action Blocked` (`action`, `reason`) |

Mọi dynamic button được tạo bằng `document.createElement` phải gắn `data-track-action` hoặc gọi logger explicit.

### 13.9 Public viewers (`viewer`)

Áp dụng cho Story, Galaxy Moon, Fall và Aurora.

| Control/flow | Activity actions |
|---|---|
| Viewer start/load | `Viewer Load Submit/Result` (`template`) |
| Intro/start click | `Viewer Start Click` |
| Leave | `Viewer Leave` (`durationMs`, started, completed) |
| Audio toggle | `Viewer Audio Toggle` (`playing`, `template`) |
| Audio autoplay blocked | `Viewer Audio Blocked` (`reason`) |
| Audio load/play failure | `Viewer Audio Error` |
| Photo click | `Viewer Photo Open` (`position/index`, no URL) |
| Lightbox close/backdrop | `Viewer Photo Close` (`via`) |
| Story chapter start/complete | `Viewer Story Chapter Start/Complete` |
| Story experience complete | `Viewer Story Complete` |
| WebGL init/context loss | `Viewer WebGL Error` |
| Texture/image fallback | `Viewer Texture Load Failed` |
| Galaxy API failure | `Viewer Data Load Failed` |

Không log render frames, particle events hoặc camera movement liên tục.

### 13.10 Legal (`legal`)

- `View Privacy Page`, `Privacy Leave`.
- `View Terms Page`, `Terms Leave`.
- Outbound/back links nếu có.

---

## 14. Blocked/dead controls

Giống bài học trong Arena, `disabled` thường nuốt event và làm hệ thống mù trước báo cáo “bấm không ăn”.

Quy tắc implementation:

1. Control disabled vì đang loading: wrapper hoặc `pointerdown` capture log `... Blocked` với `reason='loading'`.
2. Guard `if (...) return`: phải log ngay trước `return`.
3. Thiếu dữ liệu/permission/plan: log `reason` cụ thể.
4. Không đổi hành vi nghiệp vụ chỉ để tracking; control vẫn không thực thi action.
5. Debounce blocked taps tối đa một event/control/2 giây để tránh spam.

Reason chuẩn:

```text
loading
missing_input
invalid_input
permission_denied
plan_required
limit_reached
missing_data
offline
already_completed
operation_in_progress
unknown
```

---

## 15. Backend domain activities

Ngoài global request errors, backend log kết quả nghiệp vụ quan trọng để tránh phụ thuộc client:

### Auth

- `Auth Register Server Result`
- `Auth OTP Verify Server Result`
- `Auth Login Server Result`
- `Auth Password Reset Server Result`
- `Auth Password Change Server Result`
- `Auth Account Delete Server Result`

### Galaxy/gallery

- `Galaxy Create Server Result`
- `Galaxy Update Server Result` với `changedFields` allowlist, không value.
- `Galaxy Delete Server Result`
- `Gallery Upload Server Result`
- `Gallery Delete Server Result`

### Payment

- `Payment Checkout Server Result`
- `Payment Webhook Received`
- `Payment Webhook Verification Failed`
- `Payment Succeeded`
- `Payment Cancelled`
- `Subscription Activated/Extended`

Server activities dùng deterministic dedup key cho mutation có thể retry, đặc biệt payment webhook.

---

## 16. Admin activity dashboard

Thêm tab **Activity Logs** vào admin để operator xem dữ liệu end-user. Chính trang admin và các thao tác quản trị không gửi activity, đồng thời mọi route `/admin/*` được loại khỏi global client/server activity logger để dashboard không tự tạo noise hoặc recursive log.

### Filters

- Date range: 24h, 7d, 30d, 90d, custom tối đa 180 ngày.
- Feature.
- Action.
- Level.
- HTTP status/error type.
- Authenticated/anonymous.
- Session ID, request ID, galaxy ID.

### Views

1. **Overview:** total activities, active sessions, error/warn counts, error rate.
2. **Feature volume:** event count theo feature.
3. **Top actions:** clicks/views/results.
4. **Error dashboard:** top `errorType`, endpoint, page, browser.
5. **Dead tap dashboard:** blocked actions và reasons.
6. **Journey:** ordered timeline theo session ID.
7. **Performance:** p50/p90 duration theo API/action.
8. **Product funnels:** registration, first galaxy, setup, upgrade, checkout, paid.
9. **Recent activity table:** action, feature, level, masked actor, page, time, expandable sanitized metadata.

Raw metadata chỉ admin được xem. UI escape toàn bộ content, không render raw HTML.

---

## 17. Analytics endpoints

Tất cả dùng `requireAdmin`:

```text
GET /admin/activities
GET /admin/activities/overview
GET /admin/activities/actions
GET /admin/activities/errors
GET /admin/activities/blocked
GET /admin/activities/performance
GET /admin/activities/journey/:sessionId
GET /admin/activities/funnel
```

Không cho frontend truyền arbitrary Mongo query. Sort/filter field dùng allowlist. Pagination tối đa 100 records/page.

---

## 18. Audit bắt buộc để đảm bảo “toàn diện”

Implementation không được coi là xong chỉ vì đã thêm global click listener.

Phải chạy bốn vòng audit:

### Audit A — DOM controls

Quét:

```text
<button>
<a>
input[type=submit/button/file]
[role=button]
onclick
addEventListener('click'|'change'|'submit')
dynamic createElement('button'|'a')
```

Mỗi control phải có explicit activity mapping hoặc có comment `tracking-ignore: <reason>`.

### Audit B — Failure branches

Quét:

```text
catch
.catch
xhr.onerror / ontimeout / onabort
response.ok checks
showToast error
console.error / console.warn
return after validation/guard
media/image onerror
```

Mỗi failure branch phải log hoặc có `tracking-ignore` hợp lệ.

### Audit C — Lifecycle/funnel symmetry

Mỗi operation phải có cặp phù hợp:

```text
View ↔ Leave
Open ↔ Close/Cancel
Submit ↔ Result
Start ↔ Success/Failed/Cancelled
Click ↔ Blocked (nếu có guard)
```

### Audit D — Runtime smoke

Chạy journey trên từng surface, kiểm tra activity DB theo session ID và xác nhận:

- Không thiếu bước.
- Không double log.
- Không PII/credential.
- Status/level/errorType chính xác.
- Event order và duration hợp lý.

Thêm script CI `scripts/audit-activity-coverage.js` báo các control/catch mới chưa có marker tracking gần đó. Script là guard, không thay thế manual review.

---

## 19. File structure planned

```text
models/
  activity.js

config/
  activityFeatures.js
  activityErrors.js

middlewares/
  optionalAuth.js
  requestContext.js
  activityErrorLogger.js

services/
  activity.service.js
  activityAnalytics.service.js

controllers/
  activity.controller.js
  activityAdmin.controller.js

routes/
  activity.routes.js
  admin.routes.js
  index.js

public/shared/js/
  activityApi.js
  activityLogger.js
  trackedFetch.js

public/
  index.html
  auth/index.html
  auth/js/main.js
  portal/index.html
  portal/galaxy-setup.html
  portal/story-setup.html
  portal/js/main.js
  portal/js/galaxy-setup.js
  portal/js/story-setup.js
  portal/js/subscription.js
  story/index.html + js/story.js
  fall/index.html + js/fall.js
  aurora/index.html + js/aurora.js
  galaxy-moon/index.html + js/script.js
  admin/index.html + js/main.js         dashboard đọc log, không tự track admin
  privacy/index.html

scripts/
  audit-activity-coverage.js
```

Legacy `public/portal/galaxy.html`, `galaxy.js`, `galaxy-custom.js` và `admin.js` phải được xác nhận còn route nào dùng hay không. Nếu còn dùng thì instrument; nếu dead code thì ghi rõ và không tính vào runtime coverage.

---

## 20. Implementation phases

### Phase 1 — Core parity với Arena

- Activity model/API.
- `activityApi.js` và `activityLogger.js`.
- Feature derivation, level derivation, session/device ID.
- Error classifiers/descriptions.
- Recursive redaction.
- Best-effort/fire-and-forget.

### Phase 2 — Global reliability

- Fetch/XHR tracking.
- Window error/unhandled rejection/resource errors.
- Backend request ID, slow/error middleware.
- Tracking recursion protection.

### Phase 3 — Full end-user UI instrumentation

- Landing + auth.
- Portal + account + subscription.
- Galaxy setup + story setup.
- Four public viewers.
- Every blocked/cancel/failure branch.

### Phase 4 — Dashboard

- Activity list/journey/errors/blocked/performance.
- Product funnels.
- Filters/export-safe aggregate.

### Phase 5 — Coverage audit

- Static audit script.
- Manual runtime matrix.
- Fix gaps and duplicate/noisy events.
- Privacy page update.

---

## 21. Acceptance criteria

### Architecture

- Call site dùng API activity thống nhất, không tự `fetch('/activity/add')` rải rác.
- Transport riêng không tạo recursive `API Error` khi chính logging endpoint fail.
- `feature`, `level`, `sessionId`, error description được auto enrich giống Arena.
- Logger không throw và không block UX.

### Coverage

- 100% button/link/tab/card/control runtime có action mapping.
- 100% form/action có Submit và Result hoặc lý do documented.
- 100% `catch`, `.catch`, XHR/media/resource error path có activity hoặc `tracking-ignore` được review.
- Mọi disabled/guarded user intent quan trọng có Blocked activity.
- Mọi page có View và Leave với duration.
- Public viewer và mọi bề mặt end-user nằm trong scope, không bị bỏ ngoài.
- Admin UI và `/admin/*` được chủ động loại khỏi activity collection.

### Correctness

- Cancel là `warn`, không bị tính thành error.
- Failure là `error` với `errorType` cụ thể khi phân loại được.
- Payment webhook retry không double count.
- API client error và server failure nối được bằng `requestId`.
- Search/slider/progress/WebGL không sinh event spam.
- Revenue dashboard vẫn lấy từ Payment collection.

### Security/privacy

- Client không thể giả `userId`.
- Không activity nào chứa password, OTP, JWT, cookie, raw payment signature.
- Không log caption/story/galaxy name hoặc URL signed đầy đủ.
- Error stack/response được redact và truncate.
- Chỉ admin truy cập activity query/journey.

### Operations

- TTL raw log 180 ngày hoạt động.
- Admin lọc được feature/action/level/error/session/request.
- Tắt tracking qua `ACTIVITY_TRACKING_ENABLED=false` không ảnh hưởng ứng dụng.
- Dashboard hiển thị được empty/loading/error state.

---

## 22. Test strategy

### Unit

- `deriveFeature()`.
- Level derivation từ status/errorType.
- Error classifiers.
- Recursive redaction/truncation.
- Session expiry và anonymous ID.
- Metadata validation.

### Integration

- Anonymous/authenticated `/activity/add`.
- Spoofed user ID bị bỏ.
- Rate limit và oversized payload.
- Global API error không recurse.
- Backend request failure log đúng request ID.
- Payment webhook idempotency.
- Activity dashboard filters/pagination/admin authorization.

### Browser smoke matrix

```text
Landing
Auth login/register/OTP/reset
Portal galaxy create/list/share
Account/session/password/delete
Subscription Plus/Pro monthly/yearly
Galaxy setup all five tabs
Story setup complete/retry/fail
Galaxy Moon viewer
Fall viewer
Aurora viewer
Story viewer
Offline/network fail/resource fail/JS error
```

Mỗi journey được kiểm tra bằng session ID trong Activity dashboard.

---

## 23. Rollout

1. Deploy core logger nhưng chưa instrument full UI; xác nhận endpoint, privacy và volume.
2. Bật global reliability, theo dõi recursion/noise trong 24 giờ.
3. Bật từng feature end-user: landing/auth → portal/account/subscription → setup → viewers.
4. Chạy coverage audit và runtime smoke sau mỗi feature.
5. Chỉ bật dashboard funnel sau khi event naming/schema ổn định.

Feature flags:

```text
ACTIVITY_TRACKING_ENABLED=true
ACTIVITY_LOG_SERVER_ERRORS=true
ACTIVITY_LOG_SLOW_REQUESTS=true
ACTIVITY_RAW_RETENTION_DAYS=180
```

---

## 24. Definition of Done

Hệ thống chỉ hoàn thành khi:

1. Core activity architecture tương đương Arena đã chạy.
2. Toàn bộ application surfaces trong mục 13 đã instrument.
3. Bốn audit ở mục 18 không còn gap chưa giải thích.
4. Activity dashboard dựng lại được user journey và error journey.
5. Không có PII/credential leak trong sample production logs.
6. Không có recursive logging hoặc event storm.
7. Product flow vẫn hoạt động khi activity endpoint cố tình bị tắt.
