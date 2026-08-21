const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const UserModel = require("../models/user");
const EmailService = require("./email.service");
const { errorResponse } = require("../context/responseHandle");
const { ERROR_CODES } = require("../context/errorCodes");

const { randomInt } = require("crypto");

const OTP_EXPIRES_MINUTES = 5;
const OTP_RESEND_SECONDS = 60;
const MAX_SESSIONS = 3;

function generateOtp() {
  return randomInt(100000, 1000000).toString();
}

function signToken(user, sessionId) {
  return jwt.sign(
    { _id: user._id, email: user.email, role: user.role, sid: sessionId },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class AuthService {
  async register({ email, password }) {
    if (!EMAIL_RE.test(email)) {
      throw new errorResponse({ message: "Invalid email format", statusCode: 400, code: ERROR_CODES.INVALID_EMAIL_FORMAT });
    }
    if (!password || password.length < 8) {
      throw new errorResponse({ message: "Password must be at least 8 characters", statusCode: 400, code: ERROR_CODES.PASSWORD_TOO_SHORT });
    }
    const existing = await UserModel.findOne({ email });

    if (existing && existing.isVerified) {
      throw new errorResponse({ message: "Email already exists", statusCode: 409, code: ERROR_CODES.EMAIL_ALREADY_EXISTS });
    }

    const otp = generateOtp();
    const otpCode = await bcrypt.hash(otp, 10);
    const otpExpiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);
    const otpSentAt = new Date();

    if (existing && !existing.isVerified) {
      existing.passwordHash = await bcrypt.hash(password, 10);
      existing.otpCode = otpCode;
      existing.otpExpiresAt = otpExpiresAt;
      existing.otpSentAt = otpSentAt;
      await existing.save();
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      await UserModel.create({ email, passwordHash, otpCode, otpExpiresAt, otpSentAt });
    }

    await EmailService.sendOtp(email, otp);
    return { email };
  }

  async verifyOtp({ email, otp, ua = '', ip = '' }) {
    const user = await UserModel.findOne({ email });
    if (!user || user.isVerified) {
      throw new errorResponse({ message: "Invalid request", statusCode: 400, code: ERROR_CODES.INVALID_REQUEST });
    }
    if (!user.otpCode || !user.otpExpiresAt) {
      throw new errorResponse({ message: "No OTP found, please register again", statusCode: 400, code: ERROR_CODES.OTP_NOT_FOUND });
    }
    if (new Date() > user.otpExpiresAt) {
      throw new errorResponse({ message: "OTP expired, please request a new one", statusCode: 400, code: ERROR_CODES.OTP_EXPIRED });
    }
    const valid = await bcrypt.compare(otp, user.otpCode);
    if (!valid) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      if (user.otpAttempts >= 5) {
        user.otpCode = null;
        user.otpExpiresAt = null;
        user.otpSentAt = null;
        user.otpAttempts = 0;
        await user.save();
        throw new errorResponse({ message: "Too many failed attempts. Please register again.", statusCode: 429, code: ERROR_CODES.OTP_TOO_MANY_ATTEMPTS });
      }
      await user.save();
      throw new errorResponse({ message: "Invalid OTP", statusCode: 400, code: ERROR_CODES.OTP_INVALID });
    }

    user.isVerified = true;
    user.otpCode = null;
    user.otpExpiresAt = null;
    user.otpSentAt = null;
    user.otpAttempts = 0;
    const sessionId = require('crypto').randomBytes(16).toString('hex');
    const validSessions = (user.sessions || []).filter(s => s && s.sid);
    user.sessions = [...validSessions, { sid: sessionId, ua, ip, createdAt: new Date() }].slice(-MAX_SESSIONS);
    await user.save();

    const token = signToken(user, sessionId);
    return { token, user: { _id: user._id, email: user.email, role: user.role } };
  }

  async resendOtp({ email }) {
    const user = await UserModel.findOne({ email });
    if (!user) {
      throw new errorResponse({ message: "Email not found", statusCode: 404, code: ERROR_CODES.EMAIL_NOT_FOUND });
    }
    if (user.isVerified) {
      throw new errorResponse({ message: "Email already verified", statusCode: 400, code: ERROR_CODES.EMAIL_ALREADY_VERIFIED });
    }
    if (user.otpSentAt) {
      const secondsSince = (Date.now() - new Date(user.otpSentAt).getTime()) / 1000;
      if (secondsSince < OTP_RESEND_SECONDS) {
        const wait = Math.ceil(OTP_RESEND_SECONDS - secondsSince);
        throw new errorResponse({
          message: `Please wait ${wait} seconds before requesting a new OTP`, statusCode: 429,
          code: ERROR_CODES.OTP_RESEND_COOLDOWN, details: { wait },
        });
      }
    }

    const otp = generateOtp();
    user.otpCode = await bcrypt.hash(otp, 10);
    user.otpExpiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);
    user.otpSentAt = new Date();
    user.otpAttempts = 0;
    await user.save();

    await EmailService.sendOtp(email, otp);
    return { email };
  }

  async login({ email, password, ua = '', ip = '' }) {
    const user = await UserModel.findOne({ email });
    if (!user) {
      throw new errorResponse({ message: "Invalid credentials", statusCode: 401, code: ERROR_CODES.INVALID_CREDENTIALS });
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const wait = Math.ceil((user.lockedUntil - Date.now()) / 1000 / 60);
      throw new errorResponse({
        message: `Account locked. Try again in ${wait} minute(s).`, statusCode: 423,
        code: ERROR_CODES.ACCOUNT_LOCKED, details: { wait },
      });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 phút
        user.loginAttempts = 0;
      }
      await user.save();
      throw new errorResponse({ message: "Invalid credentials", statusCode: 401, code: ERROR_CODES.INVALID_CREDENTIALS });
    }
    if (!user.isVerified) {
      try { await this.resendOtp({ email }); } catch (_) {}
      throw new errorResponse({ message: "Email not verified. A new OTP has been sent.", statusCode: 403, code: ERROR_CODES.EMAIL_NOT_VERIFIED });
    }
    const sessionId = require('crypto').randomBytes(16).toString('hex');
    const sessionEntry = { sid: sessionId, ua, ip, createdAt: new Date() };
    const validSessions = (user.sessions || []).filter(s => s && s.sid);
    user.sessions = [...validSessions, sessionEntry].slice(-MAX_SESSIONS);
    user.loginAttempts = 0;
    user.lockedUntil = null;
    await user.save();
    const token = signToken(user, sessionId);
    return { token, user: { _id: user._id, email: user.email, role: user.role } };
  }

  async forgotPassword({ email }) {
    const user = await UserModel.findOne({ email });
    if (!user || !user.isVerified) return { email };

    if (user.otpSentAt && user.otpPurpose === 'reset') {
      const secondsSince = (Date.now() - new Date(user.otpSentAt).getTime()) / 1000;
      if (secondsSince < OTP_RESEND_SECONDS) {
        const wait = Math.ceil(OTP_RESEND_SECONDS - secondsSince);
        throw new errorResponse({
          message: `Please wait ${wait} seconds before requesting again`, statusCode: 429,
          code: ERROR_CODES.OTP_RESEND_COOLDOWN, details: { wait },
        });
      }
    }

    const otp = generateOtp();
    user.otpCode = await bcrypt.hash(otp, 10);
    user.otpExpiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);
    user.otpSentAt = new Date();
    user.otpAttempts = 0;
    user.otpPurpose = 'reset';
    await user.save();

    await EmailService.sendPasswordResetOtp(email, otp);
    return { email };
  }

  async verifyResetOtp({ email, otp }) {
    const user = await UserModel.findOne({ email });
    if (!user || !user.isVerified || user.otpPurpose !== 'reset') {
      throw new errorResponse({ message: "Invalid request", statusCode: 400, code: ERROR_CODES.INVALID_REQUEST });
    }
    if (!user.otpCode || !user.otpExpiresAt || new Date() > user.otpExpiresAt) {
      throw new errorResponse({ message: "OTP expired, please request again", statusCode: 400, code: ERROR_CODES.OTP_EXPIRED });
    }
    const valid = await bcrypt.compare(otp, user.otpCode);
    if (!valid) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      if (user.otpAttempts >= 5) {
        user.otpCode = null; user.otpExpiresAt = null; user.otpSentAt = null;
        user.otpAttempts = 0; user.otpPurpose = null;
        await user.save();
        throw new errorResponse({ message: "Too many failed attempts. Please request again.", statusCode: 429, code: ERROR_CODES.OTP_TOO_MANY_ATTEMPTS });
      }
      await user.save();
      throw new errorResponse({ message: "Invalid OTP", statusCode: 400, code: ERROR_CODES.OTP_INVALID });
    }
    user.otpCode = null;
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 phút để đặt mật khẩu mới
    user.otpAttempts = 0;
    user.otpPurpose = 'reset-verified';
    await user.save();
    return { email };
  }

  async resetPassword({ email, newPassword }) {
    const user = await UserModel.findOne({ email });
    if (!user || user.otpPurpose !== 'reset-verified' || !user.otpExpiresAt || new Date() > user.otpExpiresAt) {
      throw new errorResponse({ message: "Invalid or expired reset session", statusCode: 400, code: ERROR_CODES.RESET_SESSION_INVALID });
    }
    if (!newPassword || newPassword.length < 8) {
      throw new errorResponse({ message: "Password must be at least 8 characters", statusCode: 400, code: ERROR_CODES.PASSWORD_TOO_SHORT });
    }
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.otpCode = null; user.otpExpiresAt = null; user.otpSentAt = null;
    user.otpAttempts = 0; user.otpPurpose = null;
    user.sessions = []; // invalidate all sessions
    await user.save();
    return {};
  }

  async changePassword({ userId, currentPassword, newPassword }) {
    const user = await UserModel.findById(userId);
    if (!user) throw new errorResponse({ message: "User not found", statusCode: 404, code: ERROR_CODES.USER_NOT_FOUND });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new errorResponse({ message: "Current password is incorrect", statusCode: 401, code: ERROR_CODES.CURRENT_PASSWORD_INCORRECT });
    if (newPassword.length < 8) throw new errorResponse({ message: "Password must be at least 8 characters", statusCode: 400, code: ERROR_CODES.PASSWORD_TOO_SHORT });
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    user.sessions = [];
    await user.save();
    return {};
  }

  async deleteAccount({ userId, password }) {
    const user = await UserModel.findById(userId);
    if (!user) throw new errorResponse({ message: "User not found", statusCode: 404, code: ERROR_CODES.USER_NOT_FOUND });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new errorResponse({ message: "Incorrect password", statusCode: 401, code: ERROR_CODES.INCORRECT_PASSWORD });
    const GalaxyModel = require("../models/galaxy");
    await GalaxyModel.deleteMany({ userId });
    await user.deleteOne();
    return {};
  }

  async me(userId) {
    const GalaxyModel = require("../models/galaxy");
    const user = await UserModel.findById(userId).select("-passwordHash -otpCode -otpExpiresAt -otpSentAt");
    if (!user) {
      throw new errorResponse({ message: "User not found", statusCode: 404, code: ERROR_CODES.USER_NOT_FOUND });
    }
    const galaxies = await GalaxyModel.find({ userId, status: "active" });
    return { user, galaxies };
  }

  async logout({ userId, sid }) {
    if (!sid) throw new errorResponse({ message: 'Session ID missing', statusCode: 400, code: ERROR_CODES.INVALID_REQUEST });
    await UserModel.findByIdAndUpdate(userId, {
      $pull: { sessions: { sid } },
    });
  }

  async logoutAll({ userId }) {
    await UserModel.findByIdAndUpdate(userId, { sessions: [] });
  }

  async getSessions({ userId, currentSid }) {
    const user = await UserModel.findById(userId, 'sessions').lean();
    if (!user) throw new errorResponse({ message: 'User not found', statusCode: 404, code: ERROR_CODES.USER_NOT_FOUND });
    return {
      sessions: (user.sessions || []).map(s => ({
        sid: s.sid,
        ua: s.ua,
        ip: s.ip,
        createdAt: s.createdAt,
        isCurrent: s.sid === currentSid,
      })),
    };
  }
}

module.exports = new AuthService();
