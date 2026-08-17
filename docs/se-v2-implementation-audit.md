# SE v2 — Implementation Audit và Roadmap

**Ngày audit:** 2026-08-16

**Phạm vi:** Story setup, Story viewer, primitive effects, soundscape, Galaxy persistence, public `/view/` gateway

> **Cập nhật triển khai 2026-08-16:** SE v2 MVP (Milestone A–G) đã được hiện thực sau thời điểm audit. Các nhận định “chưa có” bên dưới mô tả snapshot trước triển khai và được giữ lại làm căn cứ kiến trúc. Trạng thái code hiện tại: primitive lifecycle; action allowlist/validator; scheduler; deterministic Director; 6 emotion presets; role curve; intentional silence; capability fallback; optional persistence; ownership-scoped Auto/Manual APIs; emotion-first UI; semantic audio; Story–Galaxy/Fall handoff; reduced-motion; lifecycle analytics và regression tests. Public SE viewer và authoring preview hiện render **một spatial Memory Scene cho mỗi chapter** (`spotlight`, `constellation`, `cascade`, `crescendo`, `horizon`) thay cho vòng lặp per-photo slider; legacy Story chưa opt-in vẫn giữ playback cũ. Advanced manual controls vẫn được giữ ngoài primary UX đúng phạm vi MVP; nghiệm thu cảm xúc trên thiết bị thật là bước PO/UX sau validation kỹ thuật.

### Trạng thái MVP sau audit

| Milestone | Trạng thái | Bằng chứng chính |
|---|---|---|
| A — Legacy foundation | Hoàn tất | Effect lifecycle, resize, reduced-motion density, idempotent cleanup |
| B — Actions & Timeline | Hoàn tất | Allowlist, validator, scheduler, Story/Soundscape renderers, fake clock |
| C — Presets & Director | Hoàn tất | 6 preset canonical, realized chapter roles, scene composition, contrast, silence, deterministic snapshots |
| D — Persistence & API | Hoàn tất | Optional `emotionConfig`, manual chapter override, ownership + validation, public projection |
| E — Emotion-first UX | Hoàn tất | Auto Director, emotion selector, intensity, chapter-level Memory Scene preview/viewer; không expose technical effect |
| F — Universe continuity | Hoàn tất | Single-use allowlisted handoff và capability adapters cho Galaxy/Fall |
| G — Analytics & QA | Hoàn tất ở mức code | Adoption/lifecycle events, legacy/v2/reduced-motion/cleanup/security tests; còn nghiệm thu cảm nhận trên thiết bị thật |

**Nguồn chuẩn:** [Lumora — Story Emotion Engine (SE v2) Specification](./Lumora%20%E2%80%94%20Story%20Emotion%20Engine%20%28SE%20v2%29%20Specification.md)

## 1. Kết luận điều hành

Implementation hiện tại là một nền móng Story tốt nhưng vẫn đúng với định nghĩa **Primitive Effect System** trong spec:

```text
storyType + occasion + chapter media + hook text
                         ↓
              fixed async playback
                         ↓
              seEffect + soundscape
                         ↓
          redirect sang Galaxy/Fall Universe
```

Hệ thống đã có:

- taxonomy Story tương đối phong phú;
- media được nhóm theo chapter;
- một Story viewer sử dụng được trên desktop/mobile;
- ba primitive effect có lifecycle cleanup tối thiểu;
- soundscape nguyên bản có play, pause, environment transition và cleanup;
- public gateway giữ một link `/view/?galaxyId=...`;
- tracking cho setup, chapter start/complete và Story complete.

Hệ thống chưa có bất kỳ abstraction cốt lõi nào của SE v2:

- `emotionConfig`;
- `emotionalRole`;
- emotion preset;
- emotional curve;
- cinematic action contract;
- emotional timeline;
- scheduler/executor;
- capability resolver;
- deterministic Emotional Director;
- reduced-motion behavior trong Story;
- audio duck/restore/swell được expose qua adapter;
- emotion-first UX.

Vì vậy, không nên bắt đầu bằng emotion selector. Nếu làm UI trước, lựa chọn cảm xúc chỉ trở thành một tên mới cho `seEffect` và tiếp tục vi phạm Product Philosophy.

**Bước triển khai đúng đầu tiên:** chuẩn hóa SE v1 thành Primitive Effect Layer, sau đó xây action contract và timeline engine chạy được một timeline hard-coded hoàn chỉnh mà không thay đổi behavior của Galaxy cũ.

## 2. Bản đồ implementation hiện tại

### 2.1 Authoring

`public/shared/story-config.json` hiện là nguồn định nghĩa narrative cho:

- 8 Story type;
- 26 occasion;
- 104 chapter definition;
- 9 chapter ID đang được sử dụng: `intro`, `past`, `departure`, `memory`, `journey`, `moments`, `highlight`, `hope`, `ending`.

`public/portal/js/story-setup.js` cho phép user:

1. chọn Story type;
2. chọn occasion;
3. thêm ảnh theo chapter;
4. sửa hook text;
5. lưu `storyType`, `occasion`, `chapters` vào Galaxy;
6. lưu ảnh với `Gallery.stage = chapter.id`.

Đây là **Story Engine authoring primitive**, chưa phải Story Emotion Engine.

### 2.2 Persistence và API

`models/galaxy.js` hiện lưu:

```text
storyType
occasion
chapters[{ id, hookText }]
seEffect
soundscape
template
```

`services/galaxy.service.js` trả các field trên cho public viewer và cho phép update qua `PUT /galaxies/:id`.

Các gap quan trọng:

- chapter chưa có `emotionalRole`, `emotion`, `intensity`;
- Galaxy chưa có `emotionConfig`;
- backend không dùng cùng Story config với browser để validate `occasion` và chapter ID;
- chapter ID và hook text chưa có domain validation/length validation rõ ràng tại service;
- `findByIdAndUpdate()` hiện không bật `runValidators`, nên không được dựa riêng vào Mongoose enum cho update;
- `seEffect` vẫn là field kỹ thuật do client chọn trực tiếp.

### 2.3 Public gateway

`index.js` xử lý `/view/` như sau:

```text
galaxy có storyType và chưa skip_se
                ↓
        render Story HTML
                ↓
Story kết thúc và redirect với skip_se=true
                ↓
       render Galaxy/Fall HTML
```

Cơ chế này giữ được một public entry point và backward compatibility. Tuy nhiên, full-page redirect làm mất:

- timeline scheduler hiện tại;
- runtime state của Director;
- camera/environment continuity;
- soundscape graph và volume envelope;
- một Experience Session thống nhất.

Đây là trở ngại kiến trúc lớn nhất nếu SE phải đạo diễn xuyên suốt cả Story và Universe.

### 2.4 Story playback

`public/story/js/story.js` đang điều khiển trải nghiệm bằng timing hard-coded:

```text
intro wait              900ms
hook visible           2500ms
first photo hold       5500ms
other photo hold       4500ms
photo fade gap          380ms
chapter gap             280ms
finale hold            2800ms
```

Điểm tốt:

- flow đơn giản, dễ hiểu;
- người xem có thể chạm để đi tiếp;
- chapter progress và photo dots đã có;
- ảnh được group theo Story chapter;
- text được gán qua `textContent`;
- Story lifecycle cơ bản đã được tracking.

Gap:

- timing nằm trực tiếp trong renderer;
- renderer đang đồng thời quyết định pacing;
- mọi chapter có behavior gần như giống nhau;
- không có contrast, silence hoặc climax behavior;
- không cancel được toàn bộ playback như một session;
- `waitTapOrTimer()` không gỡ click/touch listener khi timer thắng, tạo listener tồn dư trong phiên;
- preload tất cả ảnh ngay từ đầu, chưa theo nhu cầu timeline;
- không có pause/resume theo visibility ở cấp Story timeline;
- Story không xử lý `prefers-reduced-motion`.

### 2.5 Primitive effects

`public/story/js/effects.js` có:

```text
none
stardust
firefly
aurora
```

`initEffect(name, canvas)` trả về một cleanup function. Đây là phần gần nhất với Phase 1 của spec.

Thiếu:

- interface `start()` / `stop()` thống nhất;
- `setIntensity()`;
- `fadeIn()` / `fadeOut()`;
- resize lifecycle;
- reduced-motion mode;
- effect capability declaration;
- deterministic configuration;
- adapter tách renderer khỏi tên emotion.

### 2.6 Soundscape

`public/shared/js/soundscapeEngine.js` đã có tài sản kỹ thuật đáng tái sử dụng:

- một AudioContext dùng lại trong instance;
- mobile gesture unlock;
- play/pause;
- smooth acoustic environment transition;
- visibility/pagehide cleanup;
- generated Web Audio, không phụ thuộc catalog nhạc cũ.

SE chưa thể điều khiển đầy đủ vì public manager mới expose:

```text
play
pause
setEnvironment
destroy
```

Chưa có semantic audio actions:

```text
fade
duck
restore
swell
```

Lưu ý bắt buộc: `soundscape.intensity` hiện dùng thang `0..100`, còn emotional intensity của SE dùng `0..1`. Hai khái niệm không được nhập chung hoặc ghi đè trực tiếp lên nhau.

## 3. Đối chiếu với các phase trong spec

| Phase | Trạng thái | Có thể tái sử dụng | Gap để đạt exit criteria |
|---|---|---|---|
| 1. Primitive Effect Foundation | Một phần | `seEffect`, effect renderers, cleanup callback | Chưa có interface, intensity, fade, resize/reduced-motion, regression contract |
| 2. Cinematic Actions | Prototype rải rác | CSS photo/text fade, soundscape play/pause | Chưa có allowlisted action schema hoặc renderer adapter; chưa có camera/environment action |
| 3. Timeline Engine | Chưa có | Chuỗi `await` chứng minh được playback flow | Chưa có timeline data, scheduler, executor, cancel/pause/resume/cleanup |
| 4. Emotion Presets | Chưa có | Theme/soundscape parameters có thể là input cho adapter | Chưa có 6 preset MVP và chưa có UX distinction test |
| 5. Emotional Director | Chưa có | Chapter order và taxonomy hiện tại | Chưa có role resolver, curve builder, contrast/silence rules, deterministic timeline builder |
| 6. Product UI | Chưa có | Conversational Story setup | UI cũ vẫn expose `stardust/firefly/aurora`; chưa có emotion/intensity/auto mode |
| 7. Analytics & QA | Một phần | Shared tracking, chapter and completion events | Thiếu story start/replay/abandon, emotion events, reduced-motion, timeline and fallback tests |

## 4. Những ranh giới phải giữ

### Story Engine

Chịu trách nhiệm:

- Story type và occasion;
- chapter structure;
- chapter content/hook;
- required/optional chapter;
- narrative order;
- default `emotionalRole` assignment.

Không chọn particle, camera speed hoặc soundscape node.

### Story Emotion Engine

Chịu trách nhiệm:

- primary emotion và intensity;
- emotional curve;
- contrast, silence, climax và release;
- sinh emotional timeline deterministic;
- fallback action theo capability.

Không render DOM, Canvas, WebGL hay Web Audio trực tiếp.

### Universe

Chịu trách nhiệm:

- khai báo capability;
- translate cinematic action thành camera/environment behavior;
- không tự suy luận emotion.

### Theme

Chịu trách nhiệm visual identity. SE có thể yêu cầu semantic treatment như `environment.dim`, nhưng không tự thay theme hoặc hard-code palette của emotion vào Universe.

### Soundscape

Chịu trách nhiệm tạo và phát âm thanh. SE chỉ gửi semantic action như `audio.duck`; audio adapter quyết định gain ramp an toàn.

## 5. Target architecture phù hợp repository

```text
Canonical emotion config
config/story-emotion.json
        │
        ├── Backend validation + public config projection
        │
        └── Browser Director input

Story data + realized chapters + emotionConfig
        │
        ▼
Role Resolver → Curve Builder → Timeline Builder
                                      │
                                      ▼
                              Emotional Timeline
                                      │
                                      ▼
                        Capability Resolver/Fallback
                                      │
                                      ▼
                           Scheduler + Executor
                                      │
                  ┌───────────────────┼───────────────────┐
                  ▼                   ▼                   ▼
            Story renderer      Audio adapter       Universe adapter
            image/text/effect   soundscape          Galaxy/Fall
```

Đề xuất module browser:

```text
public/shared/js/story-emotion/
├── actionTypes.js
├── capabilityResolver.js
├── curveBuilder.js
├── director.js
├── timelineBuilder.js
├── scheduler.js
└── adapters/
    ├── storyRenderer.js
    ├── soundscapeRenderer.js
    ├── galaxyRenderer.js
    └── fallRenderer.js
```

Đề xuất backend:

```text
config/story-emotion.json
services/story-emotion.service.js
controllers/story-emotion.controller.js
routes/story-emotion.routes.js
```

Không tạo action từ client tùy ý. Client chỉ gửi emotion config đã allowlist; Director tự sinh action.

## 6. Backward compatibility bắt buộc

Data model mới phải giữ `emotionConfig` thật sự vắng mặt ở Galaxy cũ:

```text
emotionConfig không tồn tại
        ↓
legacy adapter chạy seEffect như hiện tại
```

Không được khai báo nested schema với default tự sinh cho mọi document cũ. Nếu Mongoose tự thêm default `emotionConfig`, toàn bộ Galaxy cũ sẽ bị nhận nhầm là SE v2.

Galaxy mới bật SE v2 khi đã lưu một config hợp lệ:

```js
{
  mode: 'auto',
  primaryEmotion: 'nostalgia',
  intensity: 0.7
}
```

Chapter emotion fields cũng phải optional; null/undefined nghĩa là fallback về Auto Director.

## 7. Role mapping ban đầu cho Story hiện có

Mapping sau đủ để bootstrapping nhưng phải nằm trong config dùng chung, không hard-code ở viewer:

| Chapter ID hiện tại | Default emotional role |
|---|---|
| `intro`, `past`, `departure` | `intro` |
| `memory`, `journey`, `moments` | `memory` |
| `highlight` | `climax` |
| `ending`, `hope` | `ending` |

Director phải xây curve từ **realized chapters có media**, không phải toàn bộ chapter definition. `highlight` hiện là optional; nếu nó không tồn tại, Director không được để lại một climax action trỏ vào chapter rỗng.

Không cần ép mọi Story có chapter `shift`. Shift/silence có thể là transition semantic giữa hai chapter trong timeline cho tới khi Story Engine có narrative chapter phù hợp.

## 8. Roadmap triển khai đề xuất

### Milestone A — Legacy foundation

Mục tiêu: biến `effects.js` thành Primitive Effect Layer mà không thay đổi visual hiện tại.

Deliverables:

- interface `start`, `stop`, `setIntensity`, `fadeIn`, `fadeOut`, `destroy`;
- adapter cho `none`, `stardust`, `firefly`, `aurora`;
- resize handling;
- reduced-motion density;
- idempotent cleanup;
- test legacy Galaxy tiếp tục dùng `seEffect`.

Exit criteria:

- cùng dữ liệu cũ cho cùng behavior nhìn thấy được;
- gọi cleanup nhiều lần không lỗi;
- không còn RAF sau destroy.

### Milestone B — Action contract và Timeline Engine

Mục tiêu: biểu diễn một chapter hoàn toàn bằng timeline data.

Deliverables:

- allowlist action MVP đúng theo spec;
- validator cho `{ at, type, params }`;
- scheduler hỗ trợ `play`, `pause`, `resume`, `cancel`, `destroy`;
- `StoryRenderer` cho image/text/effect/timing;
- `SoundscapeRenderer` cho fade/duck/restore/swell;
- một timeline hard-coded thay thế fixed waits cho một fixture Story.

Exit criteria:

- renderer không biết tên emotion;
- fake-clock tests chứng minh thứ tự action;
- cancel dọn timer, listener và pending transition;
- unsupported action bị reject hoặc fallback có kiểm soát, không execute động.

### Milestone C — Emotion presets và Director

Mục tiêu: `role + emotion + intensity → timeline` deterministic.

Deliverables:

- 6 MVP emotions: `warm`, `romantic`, `nostalgia`, `melancholy`, `wonder`, `hope`;
- role resolver cho Story config hiện tại;
- curve builder có contrast;
- timeline builder có ít nhất một intentional silence khi rule yêu cầu;
- capability resolver với fallback chain;
- reduced-motion transformation;
- snapshot tests cho từng emotion và role.

Exit criteria:

- cùng input sinh deep-equal timeline;
- `memory` khác `climax` một cách quan sát được;
- 6 emotion không chỉ khác particle;
- Universe thiếu capability không crash.

### Milestone D — Persistence và API

Mục tiêu: lưu emotion an toàn mà không phá Galaxy cũ.

Deliverables:

- optional `emotionConfig` schema;
- optional chapter override fields;
- backend allowlist và validation dùng canonical config;
- ownership-scoped mutation;
- public view chỉ trả field an toàn;
- `runValidators: true` hoặc validation service tương đương cho mutation;
- regression tests legacy/v2/invalid input.

Khuyến nghị endpoint:

```text
PATCH /galaxies/:id/emotion
```

Body MVP:

```json
{
  "mode": "auto",
  "primaryEmotion": "nostalgia",
  "intensity": 0.7
}
```

Chưa mở manual chapter override trong primary UI.

### Milestone E — Emotion-first UX

Mục tiêu: user mô tả cảm giác, Lumora quyết định kỹ thuật.

Deliverables:

- emotion selector trong conversational Story setup;
- intensity control có mô tả cảm nhận, không chỉ số kỹ thuật;
- Auto mode mặc định;
- preview chạy timeline thật;
- chuyển technical `seEffect` khỏi primary UX;
- legacy effect chỉ còn ở compatibility path/admin diagnostics nếu cần.

Không thêm advanced controls trong MVP.

### Milestone F — Universe continuity

Mục tiêu: SE đạo diễn xuyên qua Story và Universe.

Deliverables:

- capability contract cho Galaxy và Fall;
- semantic camera/environment adapters;
- Experience Session/handoff contract;
- tránh khởi tạo lại soundscape không cần thiết;
- timeline state không phụ thuộc implementation cụ thể của Universe.

Hướng ưu tiên:

1. trước mắt giữ `/view/` và legacy redirect để không regression;
2. Director chia timeline thành Story segment và Universe opening segment;
3. truyền một allowlisted handoff state, không truyền arbitrary actions qua query;
4. sau khi adapters ổn định mới cân nhắc bỏ full-page redirect bằng một shell chung.

Không nên refactor gateway thành SPA ngay ở Milestone A–C.

Trạng thái triển khai hiện tại:

- Story ghi emotional handoff và một transition marker ngắn hạn, allowlisted trong `sessionStorage`;
- `memory_dissolve` che khoảng dựng Universe; Story giữ top-level viewing document làm host và giữ URL công khai canonical `/view/?galaxyId=...` nên fullscreen không bị hủy giữa chừng và `skip_se` không lộ trên thanh địa chỉ;
- Universe có handoff hợp lệ bỏ cổng intro lặp lại, tự chạy opening timeline rồi reveal scene đã render;
- Galaxy/Fall chạy trong same-origin experience frame, báo `universe-ready` sau first render; top-level navigation chỉ còn là fallback khi frame lỗi và refresh URL vẫn vào thẳng Universe;
- transition marker là single-use, hết hạn sau 60 giây và chỉ mang `type` cùng màu accent đã validate; không truyền action, nội dung riêng tư hoặc URL;
- Web Audio vẫn tuân theo autoplay policy của trình duyệt. Hình ảnh không chờ audio; nếu mobile chặn AudioContext sau navigation, nút âm thanh hiện có là recovery path.

### Milestone G — Analytics và QA

Thêm stable actions:

```text
Story Emotion Selected
Story Emotion Intensity Changed
Story Emotion Auto Enabled
Viewer Story Started
Viewer Story Replayed
Viewer Story Abandoned
Viewer Story Completed
```

Metadata chỉ gồm enum/number/count cần thiết; không ghi hook text, caption hoặc nội dung riêng tư.

QA matrix:

- Galaxy legacy với từng `seEffect`;
- Galaxy SE v2 với 6 emotions;
- chapter optional có/không có ảnh;
- soundscape `none` và soundscape active;
- Galaxy/Fall capability fallback;
- mobile Safari/Firefox/Chrome;
- `prefers-reduced-motion`;
- background/foreground tab;
- replay/cancel/redirect;
- timeline dài và Story nhiều ảnh.

## 9. Vertical slice nên làm ngay

Slice đầu tiên không cần model, API hay UI mới:

```text
Legacy Story fixture
      ↓
hard-coded emotional timeline data
      ↓
scheduler/executor
      ↓
StoryRenderer + SoundscapeRenderer
      ↓
behavior tương đương viewer hiện tại
```

Scope cụ thể:

1. chuẩn hóa primitive effect;
2. định nghĩa action allowlist;
3. tạo scheduler có cancel;
4. chuyển một chapter fixture khỏi fixed waits sang timeline;
5. thêm fake-clock và cleanup tests;
6. giữ production viewer chạy legacy path cho tới khi slice đạt parity.

Slice này chứng minh boundary quan trọng nhất của SE v2 trước khi thêm cảm xúc:

> Timeline quyết định **chuyện gì xảy ra và khi nào**; renderer chỉ biết **thực thi action**.

## 10. Definition of Done cho Foundation

Foundation chỉ hoàn tất khi:

- Galaxy cũ không regression;
- không có emotion name trong renderer;
- action type được allowlist;
- timeline deterministic;
- scheduler cancel sạch;
- effect/audio adapter cleanup idempotent;
- reduced-motion có test;
- mobile không tạo thêm WebGL/AudioContext ngoài engine hiện có;
- `npm test`, activity audit và `git diff --check` pass;
- technical effect không được quảng bá thành emotional capability.

## 11. Quyết định kiến trúc được đề xuất

1. **SE v2 là opt-in bằng sự tồn tại của `emotionConfig`; legacy không migration cưỡng bức.**
2. **Canonical emotion/role/action config nằm phía server và được expose bằng public projection an toàn.**
3. **Director chạy deterministic, không dùng LLM trong MVP.**
4. **Renderer không biết emotion; chỉ execute allowlisted action.**
5. **Emotional intensity và soundscape intensity là hai domain khác nhau.**
6. **Không bỏ `/view/` hoặc refactor toàn bộ gateway trong foundation.**
7. **Emotion UI chỉ được triển khai sau khi timeline vertical slice chạy hoàn chỉnh.**

Đây là đường ngắn nhất để Lumora chuyển từ “Story có hiệu ứng” thành một hệ thống thật sự đạo diễn cách ký ức được cảm nhận.
