# Lumora — Story Emotion Engine (SE v2)

**Status:** Draft
**Version:** 2.0
**Product:** Lumora / BE-Moon
**Scope:** Story Emotion Engine
**Priority:** Core Product Architecture

---

# 1. Product Philosophy

Lumora không bán feature.

**Lumora bán cảm xúc. Feature chỉ tồn tại để tạo ra, truyền tải, dẫn dắt hoặc khuếch đại cảm xúc.**

SE v2 phải được phát triển dựa trên nguyên tắc:

> **User nói họ muốn người xem cảm thấy gì. Lumora quyết định cách kể câu chuyện đó.**

SE không còn được hiểu đơn giản là `Story Effect`.

Từ SE v2:

> **SE = Story Emotion Engine**

SE chịu trách nhiệm biến Story từ một chuỗi media thành một **emotional experience có chủ đích**.

---

# 2. Problem Statement

SE hiện tại đã vận hành được nhưng còn ở mức Primitive Effect System.

Flow hiện tại:

```text
User
 ↓
select effect
 ↓
seEffect
 ↓
stardust / firefly / aurora
 ↓
renderer
```

Hệ thống giải quyết tốt:

- visual enhancement;
- particle rendering;
- customization;
- tạo khác biệt thị giác.

Nhưng chưa giải quyết tốt:

- emotional pacing;
- emotional build-up;
- climax;
- tension;
- silence;
- emotional transition;
- phối hợp music + camera + text + visual;
- khác biệt cảm xúc giữa các chapter;
- điều chỉnh cường độ cảm xúc.

Kết quả:

> Story có thể đẹp nhưng chưa chắc khiến người xem **cảm thấy điều gì đó**.

---

# 3. Product Goal

SE v2 phải biến:

```text
Media + Effects
```

thành:

```text
Media
+
Narrative
+
Emotion
+
Timing
+
Cinematic Direction
=
Emotional Experience
```

SE phải đóng vai trò **đạo diễn**, không phải renderer.

---

# 4. Non-Goals

SE v2 không nhằm:

- thay thế Story Engine;
- thay thế Universe;
- thay thế Theme;
- thay thế Music Engine;
- tự động generate nội dung bằng AI trong MVP;
- phân tích khuôn mặt/cảm xúc bằng AI trong MVP;
- tạo video;
- loại bỏ SE v1;
- yêu cầu user chỉnh timeline thủ công.

SE v1 phải tiếp tục hoạt động.

---

# 5. Core Architecture

Lumora experience được phân chia trách nhiệm:

```text
UNIVERSE
Where does the story exist?
        │
        ▼
STORY ENGINE
What story is being told?
        │
        ▼
STORY EMOTION ENGINE
How should the audience feel?
        │
        ▼
THEME
What visual identity does it have?
        │
        ▼
MEDIA + MUSIC
What material communicates it?
```

Nói ngắn gọn:

```text
Universe = Space

Story = Narrative

SE = Emotion

Theme = Identity

Music = Emotional reinforcement
```

Các layer không được nhập nhằng trách nhiệm.

---

# 6. SE Layer Architecture

SE v2 gồm 4 layer.

```text
┌───────────────────────────────┐
│      EMOTIONAL DIRECTOR       │
├───────────────────────────────┤
│       EMOTION PRESETS         │
├───────────────────────────────┤
│      CINEMATIC ACTIONS        │
├───────────────────────────────┤
│      PRIMITIVE EFFECTS        │
└───────────────────────────────┘
```

---

# 7. Layer 1 — Primitive Effects

Đây là layer thấp nhất.

SE hiện tại được giữ lại và chuyển thành Primitive Effects.

Ví dụ:

```text
none
stardust
firefly
aurora
```

Có thể mở rộng:

```text
dust
petals
snow
rain
grain
bloom
glow
fog
spark
```

Primitive Effect:

- không tự quyết định khi nào xuất hiện;
- không hiểu Story;
- không hiểu Emotion;
- không điều khiển pacing.

Nó chỉ cung cấp rendering capability.

Ví dụ:

```js
effect.start()
effect.stop()
effect.setIntensity(0.4)
effect.fadeIn(1200)
effect.fadeOut(800)
```

---

# 8. Layer 2 — Cinematic Actions

Cinematic Action là những primitive có semantic meaning cao hơn.

## Camera

```text
camera.pushIn
camera.pullOut
camera.pan
camera.orbit
camera.drift
camera.freeze
camera.shake
```

Example:

```js
{
  type: "camera.pushIn",
  duration: 4000,
  intensity: 0.3
}
```

## Image

```text
image.fadeIn
image.fadeOut
image.blur
image.focus
image.desaturate
image.saturate
image.zoom
image.parallax
image.dim
```

## Text

```text
text.fade
text.reveal
text.typewriter
text.wordReveal
text.hold
text.disappear
```

## Audio

```text
audio.fadeIn
audio.fadeOut
audio.duck
audio.restore
audio.swell
audio.pause
```

## Environment

```text
environment.dim
environment.brighten
environment.blackout
environment.freeze
environment.breathe
```

## Effect

```text
effect.start
effect.stop
effect.fadeIn
effect.fadeOut
effect.intensity
```

---

# 9. Timing Is a First-Class Feature

SE không được coi animation là nguồn cảm xúc duy nhất.

Engine phải hỗ trợ:

```text
wait
hold
pause
silence
delay
```

Ví dụ:

```js
{
  type: "hold",
  duration: 1800
}
```

Khoảng thời gian không có animation là một cinematic action hợp lệ.

**Silence và stillness phải được coi là công cụ cảm xúc.**

---

# 10. Layer 3 — Emotion Presets

User không trực tiếp cấu hình cinematic actions.

User chọn **cảm xúc**.

MVP emotions:

```text
warm
romantic
nostalgia
melancholy
wonder
hope
celebration
```

Future:

```text
grief
gratitude
longing
peace
excitement
heartbreak
pride
comfort
```

Emotion preset mapping xuống cinematic behavior.

Ví dụ:

```js
nostalgia = {
  camera: {
    speed: 0.35,
    preferredActions: ["pushIn", "drift"]
  },

  visual: {
    saturation: 0.75,
    grain: 0.15,
    vignette: 0.2
  },

  transition: {
    type: "crossfade",
    duration: 2200
  },

  text: {
    reveal: "slow",
    delay: 900
  },

  audio: {
    duckOnCaption: true
  },

  effect: {
    preferred: ["dust", "stardust"],
    intensity: 0.25
  }
}
```

Emotion Preset không chứa Story-specific timing tuyệt đối.

Director sẽ sử dụng preset để xây timeline.

---

# 11. Emotional Intensity

Mỗi emotion có:

```text
intensity: 0 → 1
```

Ví dụ:

```js
{
  emotion: "nostalgia",
  intensity: 0.7
}
```

Intensity ảnh hưởng:

- camera speed;
- transition duration;
- visual treatment;
- particle density;
- music dynamics;
- text delay;
- hold duration;
- amount of movement.

Intensity không đơn giản là:

```text
particleCount × intensity
```

Mà phải tác động tới **toàn bộ emotional direction**.

---

# 12. Layer 4 — Emotional Director

Đây là core của SE v2.

Input:

```text
Story
+
Chapter
+
Emotion
+
Intensity
+
Media
+
Music
+
Universe capabilities
```

Output:

```text
Emotional Timeline
```

Ví dụ input:

```js
{
  chapterType: "emotional_shift",
  emotion: "melancholy",
  intensity: 0.8
}
```

Output:

```text
0ms     audio.duck
300ms   effect.fadeOut
800ms   image.desaturate
1200ms  image.fadeIn
1800ms  camera.pushIn
3500ms  text.reveal
6000ms  hold
7800ms  transition
```

---

# 13. Emotional Timeline

Timeline phải trở thành abstraction trung tâm.

Suggested structure:

```js
{
  duration: 9000,

  actions: [
    {
      at: 0,
      type: "audio.duck",
      params: {}
    },

    {
      at: 500,
      type: "effect.fadeOut",
      params: {
        duration: 1000
      }
    },

    {
      at: 1200,
      type: "image.fadeIn",
      params: {
        duration: 1800
      }
    },

    {
      at: 1800,
      type: "camera.pushIn",
      params: {
        duration: 5000,
        intensity: 0.25
      }
    },

    {
      at: 3800,
      type: "text.reveal",
      params: {
        duration: 1200
      }
    },

    {
      at: 6000,
      type: "hold",
      params: {
        duration: 1800
      }
    }
  ]
}
```

Renderer không cần hiểu:

```text
nostalgia
melancholy
romantic
```

Renderer chỉ hiểu actions.

Đây là boundary bắt buộc.

---

# 14. Story Emotional Curve

Story không được giữ cùng một intensity từ đầu đến cuối.

Mặc định:

```text
INTRO
  │
  ▼
BUILD
  │
  ▼
MEMORY
  │
  ▼
EMOTIONAL SHIFT
  │
  ▼
CLIMAX
  │
  ▼
RELEASE
  │
  ▼
ENDING
```

Ví dụ intensity:

```text
1.0 |                       ●
    |                     /   \
0.8 |                   /       ●
    |             ●────
0.6 |           /
    |      ●───
0.4 | ●───
    |
0.2 |
    └─────────────────────────────
      Intro Memory Shift Climax End
```

Không bắt buộc Story nào cũng có toàn bộ stage.

---

# 15. Chapter Emotional Role

Chapter phải có `emotionalRole`.

MVP:

```text
intro
build
memory
shift
climax
release
ending
```

Ví dụ:

```js
{
  id: "...",

  emotionalRole: "climax",

  emotion: "romantic",

  intensity: 0.9
}
```

Nếu user không cấu hình:

Story Engine tự assign default emotional role.

---

# 16. Emotional Contrast

Director phải tránh:

```text
intensity 0.8
→
0.8
→
0.8
→
0.8
```

Emotion cần contrast.

Ví dụ:

```text
warm 0.4
→
warm 0.6
→
melancholy 0.3
→
romantic 0.9
→
hope 0.6
```

Low intensity trước climax có thể được dùng để làm climax mạnh hơn.

---

# 17. Silence System

SE phải có concept:

```text
Emotional Silence
```

Silence có thể bao gồm:

- camera gần như đứng yên;
- particle biến mất;
- music duck mạnh;
- text chưa xuất hiện;
- environment tối đi;
- giữ ảnh lâu hơn bình thường.

Example:

```js
{
  type: "emotionalSilence",

  duration: 1200,

  params: {
    musicVolume: 0.15,
    cameraMovement: 0,
    effects: false
  }
}
```

Không được spam silence.

Director chỉ sử dụng khi emotional curve yêu cầu contrast.

---

# 18. Music Integration

Music không được chạy độc lập với Story.

SE phải có khả năng điều khiển:

```text
volume
fade
duck
restore
pause
swell
```

MVP không yêu cầu beat detection.

Music timeline chỉ cần phối hợp với Story timeline.

Future:

```text
beat detection
drop detection
chorus detection
music emotional analysis
```

---

# 19. Universe Capability Contract

SE không được phụ thuộc trực tiếp vào Galaxy/Fall/Memoria implementation.

Mỗi Universe khai báo capability.

Ví dụ:

```js
{
  universe: "galaxy",

  capabilities: {
    camera: [
      "pushIn",
      "pullOut",
      "orbit",
      "drift"
    ],

    environment: [
      "dim",
      "brighten"
    ],

    effects: [
      "stardust",
      "aurora"
    ]
  }
}
```

Memoria có thể:

```js
{
  universe: "memoria",

  capabilities: {
    camera: [
      "walk",
      "lookAt",
      "pushIn",
      "freeze"
    ]
  }
}
```

Director chỉ generate actions Universe hỗ trợ.

---

# 20. Graceful Fallback

Nếu emotion yêu cầu:

```text
camera.orbit
```

nhưng Universe không hỗ trợ:

Director phải fallback.

Example:

```text
camera.orbit
     ↓
camera.drift
     ↓
camera.pushIn
     ↓
no camera action
```

SE không được crash vì thiếu capability.

---

# 21. Data Model

Galaxy-level configuration:

```js
emotionConfig: {

  mode: {
    type: String,
    enum: ["auto", "manual"],
    default: "auto"
  },

  primaryEmotion: {
    type: String,
    default: "warm"
  },

  intensity: {
    type: Number,
    min: 0,
    max: 1,
    default: 0.5
  },

  legacyEffect: {
    type: String
  }
}
```

Chapter:

```js
{
  emotionalRole: {
    type: String,
    enum: [
      "intro",
      "build",
      "memory",
      "shift",
      "climax",
      "release",
      "ending"
    ]
  },

  emotion: String,

  intensity: Number
}
```

---

# 22. Backward Compatibility

Existing:

```js
seEffect: "stardust"
```

không được phá.

Migration behavior:

```text
Galaxy cũ
     ↓
emotionConfig không tồn tại
     ↓
SE legacy mode
     ↓
render seEffect như hiện tại
```

Galaxy mới:

```text
emotionConfig exists
     ↓
SE v2
```

Không migration bắt buộc ngay lập tức.

---

# 23. User Experience

Không expose technical effect configuration ở primary UX.

Không:

```text
Particle: Stardust
Camera speed: 0.3
Transition: Crossfade
Vignette: 20%
```

Primary UI:

```text
Bạn muốn câu chuyện mang cảm xúc gì?

○ Ấm áp
● Hoài niệm
○ Lãng mạn
○ Sâu lắng
○ Hy vọng
○ Kỳ diệu
○ Vui vẻ
```

Sau đó:

```text
Cường độ

Nhẹ ━━━━━━━●━━ Mạnh
```

Option:

```text
[x] Tự động điều chỉnh cảm xúc theo từng chương
```

---

# 24. Advanced Controls

Không nằm trong MVP.

Future:

```text
Advanced emotional direction
```

cho phép chỉnh:

- chapter emotion;
- chapter intensity;
- pacing;
- effect;
- transition;
- music behavior.

Nhưng primary experience phải luôn emotion-first.

---

# 25. Auto Mode

Default:

```js
mode = "auto"
```

User chọn:

```text
primaryEmotion
intensity
```

Story Engine + SE tự tạo emotional curve.

Ví dụ:

```text
primaryEmotion = romantic
intensity = 0.7
```

Có thể sinh:

```text
intro
warm 0.3

↓

memory
romantic 0.5

↓

shift
nostalgia 0.35

↓

climax
romantic 0.9

↓

ending
warm 0.6
```

---

# 26. Manual Mode

Manual mode cho phép override từng chapter.

Example:

```js
chapter.emotion = "melancholy"
chapter.intensity = 0.8
```

Nếu field null:

fallback về Auto Director.

---

# 27. Director Rules

MVP Director phải deterministic.

Không dùng LLM.

Input giống nhau phải tạo output giống nhau.

Rules phải được viết thành configuration thay vì hard-code rải rác.

Suggested:

```text
/config/emotions
/config/emotionalRoles
/config/directorRules
```

Ví dụ:

```js
climax: {
  intensityMultiplier: 1.25,
  minHold: 1200,
  cameraPreference: ["pushIn"],
  musicBehavior: "swell"
}
```

---

# 28. Renderer Contract

SE Core không render.

Interface:

```js
renderer.execute(action)
```

Ví dụ:

```js
renderer.execute({
  type: "camera.pushIn",
  params: {
    duration: 4000,
    intensity: 0.4
  }
})
```

Universe renderer chịu trách nhiệm translate action thành implementation thực tế.

---

# 29. Suggested Modules

```text
story-emotion/
│
├── director/
│   ├── emotionDirector.js
│   ├── curveBuilder.js
│   └── timelineBuilder.js
│
├── emotions/
│   ├── warm.js
│   ├── romantic.js
│   ├── nostalgia.js
│   ├── melancholy.js
│   ├── wonder.js
│   └── hope.js
│
├── actions/
│   ├── camera.js
│   ├── image.js
│   ├── text.js
│   ├── audio.js
│   ├── effect.js
│   └── environment.js
│
├── capabilities/
│   └── resolver.js
│
└── timeline/
    ├── scheduler.js
    └── executor.js
```

Tên/folder có thể điều chỉnh theo architecture hiện tại của BE-Moon.

Không refactor ngoài phạm vi cần thiết.

---

# 30. API

Existing APIs không được breaking change.

Có thể mở rộng Galaxy response:

```json
{
  "emotionConfig": {
    "mode": "auto",
    "primaryEmotion": "nostalgia",
    "intensity": 0.7
  }
}
```

Update:

```text
PATCH /galaxies/:id/emotion
```

Body:

```json
{
  "mode": "auto",
  "primaryEmotion": "nostalgia",
  "intensity": 0.7
}
```

Chapter override:

```text
PATCH /galaxies/:id/chapters/:chapterId/emotion
```

Body:

```json
{
  "emotion": "melancholy",
  "intensity": 0.8
}
```

Endpoint naming phải follow convention hiện tại nếu repo đã có pattern khác.

---

# 31. Validation

Backend phải validate:

```text
emotion ∈ supportedEmotions

0 <= intensity <= 1

emotionalRole ∈ supportedRoles

mode ∈ auto | manual
```

Client input không được coi là trusted.

---

# 32. Security

SE configuration không được cho phép:

- arbitrary JS;
- arbitrary shader source;
- arbitrary CSS;
- arbitrary action name;
- arbitrary remote script;
- arbitrary renderer command.

Actions phải dùng allowlist.

Ví dụ:

```js
SUPPORTED_ACTIONS.has(action.type)
```

Không dùng:

```js
eval()
new Function()
```

hoặc dynamic code execution.

---

# 33. Performance

SE phải chạy tốt trên mobile.

Target MVP:

- không tạo additional WebGL context nếu Universe đã có;
- không tạo particle engine mới cho mỗi chapter;
- reuse renderer;
- cleanup timer/RAF khi story kết thúc;
- cancel scheduled actions khi chuyển story;
- pause animation khi tab background nếu phù hợp;
- không preload media không cần thiết.

Timeline scheduling không được tạo memory leak.

---

# 34. Reduced Motion

Phải support:

```text
prefers-reduced-motion
```

Khi active:

```text
camera movement ↓
parallax → disabled
shake → disabled
particle density ↓
transition movement → fade
```

Emotion vẫn phải được truyền tải bằng:

```text
timing
music
color
text
silence
```

Accessibility không đồng nghĩa mất cảm xúc.

---

# 35. Analytics

Không chỉ đo:

```text
SE enabled
```

Cần chuẩn bị event:

```text
emotion_selected
emotion_intensity_changed
emotion_auto_enabled
story_started
story_completed
story_replayed
story_shared
story_abandoned
```

Future emotional impact proxy:

```text
completion rate
replay rate
share rate
time spent
```

Không tuyên bố đo được "cảm xúc thật" chỉ từ behavioral analytics.

---

# 36. MVP Scope

SE v2 MVP chỉ cần:

### Emotions

```text
warm
romantic
nostalgia
melancholy
wonder
hope
```

### Roles

```text
intro
memory
shift
climax
ending
```

### Actions

Camera:

```text
pushIn
pullOut
drift
freeze
```

Image:

```text
fadeIn
fadeOut
desaturate
focus
```

Text:

```text
reveal
fade
hold
```

Audio:

```text
fade
duck
restore
swell
```

Effect:

```text
start
stop
intensity
fadeIn
fadeOut
```

Environment:

```text
dim
brighten
blackout
```

Không mở rộng thêm cho tới khi vòng này chạy hoàn chỉnh.

---

# 37. MVP Execution Roadmap

## Phase 1 — Foundation

Mục tiêu:

SE v1 trở thành Primitive Effect Layer.

Deliverables:

- giữ backward compatibility;
- normalize effect interface;
- lifecycle start/stop;
- intensity;
- fade;
- cleanup.

Exit Criteria:

Existing Galaxy chạy không regression.

---

## Phase 2 — Cinematic Actions

Implement:

- camera;
- image;
- text;
- audio;
- environment;
- timing.

Exit Criteria:

Có thể chạy một timeline hard-coded hoàn chỉnh.

---

## Phase 3 — Timeline Engine

Implement:

```text
scheduler
executor
cancel
pause
resume
cleanup
```

Exit Criteria:

Một chapter có thể được biểu diễn hoàn toàn bằng timeline data.

---

## Phase 4 — Emotion Presets

Implement 6 MVP emotions.

Exit Criteria:

Mỗi emotion tạo được behavior khác biệt có thể nhận biết bằng UX testing.

---

## Phase 5 — Emotional Director

Implement:

```text
role
+
emotion
+
intensity
→
timeline
```

Exit Criteria:

Story nhiều chapter tự tạo được emotional curve mà không cần manual timeline.

---

## Phase 6 — Product UI

Implement:

```text
emotion selector
intensity slider
auto mode
```

Không expose technical configuration.

---

## Phase 7 — Analytics & QA

Test:

- story completion;
- replay;
- performance;
- reduced motion;
- mobile;
- legacy story;
- universe compatibility.

---

# 38. Acceptance Criteria

SE v2 được coi là MVP complete khi:

- Galaxy cũ vẫn chạy bình thường;
- user không cần hiểu particle/camera/transition;
- user có thể chọn emotion;
- user có thể chọn intensity;
- Auto Mode tạo emotional curve;
- từng chapter có emotional role;
- Director sinh timeline deterministic;
- renderer execute timeline;
- music có thể duck/swell theo story;
- có ít nhất một intentional silence;
- climax có behavior khác memory;
- Universe thiếu capability không crash;
- mobile performance đạt mức sử dụng thực tế;
- reduced-motion hoạt động;
- timeline cleanup không leak;
- analytics ghi nhận được adoption.

---

# 39. Product Success Criteria

Không đánh giá SE chỉ bằng:

> “Effect có chạy không?”

Functional correctness chỉ là điều kiện cần.

SE thành công khi có dấu hiệu Story trở nên đáng trải nghiệm hơn.

Primary proxy metrics:

```text
Story Completion Rate
Replay Rate
Share Rate
```

Secondary:

```text
Average Story Watch Time
Drop-off by Chapter
Emotion Selection Distribution
```

Sau khi đủ traffic mới xác định numerical target.

---

# 40. Design Principle

Mỗi quyết định của SE phải trả lời:

> **Điều này khiến người xem cảm thấy gì?**

Nếu câu trả lời chỉ là:

> “Trông đẹp hơn.”

thì chưa đủ để trở thành SE capability.

---

# 41. Final Product Definition

SE v1:

> **Make the story look alive.**

SE v2:

> **Make the audience feel the story.**

Long-term Lumora:

```text
User provides memories.

Story Engine understands
how they should be told.

Story Emotion Engine understands
how they should be felt.

Universe determines
where they come alive.
```

## North Star

> **Lumora không render ký ức. Lumora đạo diễn cách ký ức được cảm nhận.**
