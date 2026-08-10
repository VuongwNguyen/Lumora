const jwt = require("jsonwebtoken");
const UserModel = require("../models/user");
const { errorResponse } = require("../context/responseHandle");

const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new errorResponse({ message: "Unauthorized", statusCode: 401 }));
  }
  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserModel.findById(decoded._id, "sessions role isVerified").lean();
    if (!user) {
      console.warn('[auth] 401 — user not found:', decoded._id);
      return next(new errorResponse({ message: "Session expired, please login again", statusCode: 401 }));
    }
    if (!user.isVerified) {
      console.warn('[auth] 401 — user not verified:', decoded._id);
      return next(new errorResponse({ message: "Session expired, please login again", statusCode: 401 }));
    }
    if (!decoded.sid) {
      console.warn('[auth] 401 — token has no sid (old token):', decoded._id);
      return next(new errorResponse({ message: "Session expired, please login again", statusCode: 401 }));
    }
    if (!user.sessions?.some(s => s.sid === decoded.sid)) {
      console.warn('[auth] 401 — sid not in sessions:', decoded.sid, 'sessions:', user.sessions?.map(s => s.sid));
      return next(new errorResponse({ message: "Session expired, please login again", statusCode: 401 }));
    }
    req.user = { ...decoded, role: user.role };
    next();
  } catch {
    return next(new errorResponse({ message: "Invalid or expired token", statusCode: 401 }));
  }
};

// Activity collection also accepts anonymous visitors. A valid signed JWT adds
// user context; missing, expired or invalid tokens continue anonymously.
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return next();
  try {
    const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    req.user = decoded;
  } catch {
    // Tracking must never block the product flow because auth context is stale.
  }
  next();
};

const requireAdmin = (req, res, next) => {
  requireAuth(req, res, (err) => {
    if (err) return next(err);
    if (req.user.role !== "admin")
      return next(new errorResponse({ message: "Forbidden", statusCode: 403 }));
    next();
  });
};

module.exports = { requireAuth, requireAdmin, optionalAuth };
