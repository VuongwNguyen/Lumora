const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const logger = require("morgan");
const createError = require("http-errors");
const cookieParser = require("cookie-parser");
const path = require("path");
const fs = require("fs");
const { rateLimit } = require("express-rate-limit");
const connectToDatabase = require("./connection");
const { IMAGE_UPLOAD_MAX_FILES, IMAGE_UPLOAD_MAX_TOTAL_SIZE_MB } = require('./config/uploads');
const { activityRequestContext, logUnhandledError } = require('./middlewares/activityTracking');
require("dotenv").config();
const ActivityService = require('./services/activity.service');

const app = express();
app.set('trust proxy', 1);
const port = process.env.PORT || 3030;
const { errorResponse } = require("./context/responseHandle");
const isDev = process.env.NODE_ENV !== "production";

if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET is not set");

// ── Database ──────────────────────────────────────
connectToDatabase.connect();

// ── CORS ──────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : null;

app.use(cors({
  origin: allowedOrigins
    ? (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        cb(new Error("CORS: origin not allowed"));
      }
    : true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Request-Id", "X-Activity-Session", "X-Anonymous-Id", "X-Activity-Opt-Out"],
  exposedHeaders: ["X-Request-Id"],
  credentials: true,
}));

// ── Security headers ──────────────────────────────
const hasSSL = process.env.HTTPS === "true";
app.use(helmet({
  hsts: hasSSL ? { maxAge: 31536000, includeSubDomains: true } : false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com", "https://cdnjs.cloudflare.com", "https://w.soundcloud.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      mediaSrc: ["'self'", "https://ik.imagekit.io"],
      connectSrc: ["'self'"],
      frameSrc: ["'self'", "https://w.soundcloud.com"],
      // null = tắt directive này; khi có SSL thì set HTTPS=true trong .env để bật lại
      upgradeInsecureRequests: hasSSL ? [] : null,
    },
  },
}));

// ── Rate limiters ─────────────────────────────────
// Auth: chặt để phòng brute force và spam OTP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: false, message: "Too many requests, please try again later.", statusCode: 429 },
  skip: () => isDev,
});

// Payment: vừa phải
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: false, message: "Too many requests, please try again later.", statusCode: 429 },
  skip: () => isDev,
});

// API chung: thoải mái hơn
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: false, message: "Too many requests, please try again later.", statusCode: 429 },
  // /activity has its own user-aware limiter after optional auth.
  skip: req => isDev || req.path === "/activity" || req.path.startsWith("/activity/"),
});

// ── Body parsing ──────────────────────────────────
app.use(activityRequestContext);
app.use(logger(isDev ? "dev" : "combined"));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());

// ── Template HTML (pre-loaded with absolute asset paths) ──────────────────
const TEMPLATE_HTML = {
  galaxy: fs.readFileSync(path.join(__dirname, "public/galaxy-moon/index.html"), "utf8")
    .replace(/\.\/css\//g, "/galaxy-moon/css/")
    .replace(/\.\/js\//g, "/galaxy-moon/js/"),
  fall: fs.readFileSync(path.join(__dirname, "public/fall/index.html"), "utf8")
    .replace(/\.\/js\//g, "/fall/js/"),
  abyss: fs.readFileSync(path.join(__dirname, "public/abyss/index.html"), "utf8")
    .replace(/\.\/js\//g, "/abyss/js/"),
  story: fs.readFileSync(path.join(__dirname, "public/story/index.html"), "utf8")
    .replace(/\.\/js\//g, "/story/js/"),
};

const GalaxyModel = require("./models/galaxy");
const GalleryModel = require("./models/gallery");

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Single public view entry point ─────────────────────────────────────────
app.get("/view/", async (req, res, next) => {
  const { galaxyId } = req.query;
  if (!galaxyId) return res.redirect("/");
  try {
    const galaxy = await GalaxyModel.findById(galaxyId, "name template status storyType occasion chapters").lean();
    if (!galaxy || galaxy.status !== "active") {
      return res.status(404).json({ status: false, message: "Galaxy not found", statusCode: 404 });
    }
    const skipSE = req.query.skip_se === 'true';
    let html;
    if (galaxy.storyType && !skipSE) {
      html = TEMPLATE_HTML.story;
    } else {
      const template = galaxy.template || "galaxy";
      html = TEMPLATE_HTML[template] ?? TEMPLATE_HTML.galaxy;
    }
    const name = escapeHtml(galaxy.name || 'Lumora');
    const proto = process.env.HTTPS === 'true' ? 'https' : req.protocol;
    const base = (process.env.APP_URL || (proto + "://" + req.get("host"))).replace(/\/$/, "");
    const firstPhoto = await GalleryModel.findOne({ galaxyId: galaxy._id, status: "active" }, "imageUrl").sort({ order: 1, createdAt: 1 }).lean();
    const ogImage = firstPhoto?.imageUrl || `${base}/og-image.png`;
    const ogImageIsExternal = !!firstPhoto?.imageUrl;
    const ogDesc = `Explore the memory galaxy "${name}" in stunning 3D space.`;
    const ogTags = `
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Lumora" />
  <meta property="og:title" content="${name} — Lumora" />
  <meta property="og:description" content="${ogDesc}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:image:secure_url" content="${ogImage}" />${ogImageIsExternal ? '' : `
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1850" />
  <meta property="og:image:height" content="990" />`}
  <meta property="og:url" content="${base + req.originalUrl}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${name} — Lumora" />
  <meta name="twitter:description" content="${ogDesc}" />
  <meta name="twitter:image" content="${ogImage}" />`;
    res.send(html.replace("<head>", "<head>" + ogTags));
  } catch (err) {
    next(err);
  }
});

// Redirect old template URLs with galaxyId to single entry point
app.get("/galaxy-moon/", (req, res, next) => {
  const { galaxyId } = req.query;
  if (galaxyId) return res.redirect(`/view/?galaxyId=${encodeURIComponent(galaxyId)}`);
  next();
});

app.get("/fall/", (req, res, next) => {
  const { galaxyId } = req.query;
  if (galaxyId) return res.redirect(`/view/?galaxyId=${encodeURIComponent(galaxyId)}`);
  next();
});

app.get("/abyss/", (req, res, next) => {
  const { galaxyId } = req.query;
  if (galaxyId) return res.redirect(`/view/?galaxyId=${encodeURIComponent(galaxyId)}`);
  next();
});

// Bootstrap the browser transport from the same server-side activity guard.
// In development (or when explicitly disabled), client loggers become no-ops
// and therefore never emit POST /activity/add requests.
const activityApiSource = fs.readFileSync(path.join(__dirname, "public/shared/js/activityApi.js"), "utf8");
app.get("/shared/js/activityApi.js", (req, res) => {
  res.type("application/javascript");
  res.set("Cache-Control", "no-store");
  res.send(`window.__LUMORA_ACTIVITY_ENABLED__ = ${ActivityService.isEnabled()};\n${activityApiSource}`);
});

app.use(express.static(path.join(__dirname, "public")));

// ── Routes với rate limiting ───────────────────────
app.use("/auth", authLimiter);
app.use("/payment", paymentLimiter);
app.use("/", apiLimiter);
app.use("/", require("./routes"));

app.get("/ping", (req, res) => {
  res.status(200).json({ status: true, message: "pong", statusCode: 200 });
});

// ── 404 ───────────────────────────────────────────
app.use(function (req, res, next) {
  next(createError(404));
});

// ── Error handler ─────────────────────────────────
app.use((err, req, res, next) => {
  logUnhandledError(req, err);
  if (err.status === 404)
    return res.status(404).json({ status: false, message: "Not found", statusCode: 404 });

  if (err.code === "LIMIT_FILE_SIZE")
    return res.status(413).json({
      status: false,
      message: `Tổng dung lượng ảnh tối đa ${IMAGE_UPLOAD_MAX_TOTAL_SIZE_MB}MB`,
      statusCode: 413,
    });

  if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE')
    return res.status(413).json({
      status: false,
      message: `Tối đa ${IMAGE_UPLOAD_MAX_FILES} ảnh trong mỗi lượt tải lên`,
      statusCode: 413,
    });

  if (err.code === 'LIMIT_TOTAL_FILE_SIZE')
    return res.status(413).json({ status: false, message: err.message, statusCode: 413 });

  if (err.code === 'UNSUPPORTED_IMAGE_TYPE' || err.code === 'INVALID_IMAGE_SIGNATURE')
    return res.status(415).json({ status: false, message: err.message, statusCode: 415 });

  if (err.code === 'IMAGEKIT_UPLOAD_FAILED' || err.code === 'IMAGE_STORAGE_UNAVAILABLE')
    return res.status(err.statusCode).json({ status: false, message: err.message, statusCode: err.statusCode });

  if (!isDev) {
    // Không leak stack trace lên production
    console.error("[ERROR]", err.message);
  } else {
    console.error("lỗi", err.stack);
  }

  // Chỉ che message của lỗi KHÔNG lường trước. errorResponse là lỗi do chính
  // app ném ra với message viết sẵn cho người dùng ("Email đã tồn tại", "Mật
  // khẩu tối thiểu 8 ký tự") — che chúng lại thành "Internal server error" làm
  // người dùng không biết mình sai gì, và khiến lỗi nhập liệu trông như sập
  // server. Lỗi từ thư viện hoặc throw ngoài dự kiến vẫn bị che như cũ.
  const safeMessage = err instanceof errorResponse ? err.message : "Internal server error";
  res.status(err.statusCode || 500).json({
    statusResponse: err.statusResponse || false,
    message: isDev ? err.message : safeMessage,
    statusCode: err.statusCode || 500,
  });
});

app.listen(port, '0.0.0.0', () => {
  const { networkInterfaces } = require('os');
  const ip = Object.values(networkInterfaces()).flat().find(i => i.family === 'IPv4' && !i.internal)?.address;
  console.log(`Server is running on http://localhost:${port}`);
  if (ip) console.log(`Local network:     http://${ip}:${port}`);
});
