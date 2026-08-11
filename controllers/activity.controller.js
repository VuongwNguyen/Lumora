const ActivityService = require('../services/activity.service');
const { ActivityValidationError } = require('../services/activity.service');

function getClientIp(req) {
  const raw =
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.ip ||
    '';
  return String(raw).replace(/^::ffff:/, '');
}

class ActivityController {
  async add(req, res, next) {
    try {
      const result = await ActivityService.create(req.body, {
        userId: req.user?._id || null,
        clientIp: getClientIp(req),
        requestId: req.activityRequestId || req.headers['x-request-id'] || null,
      });
      const activity = result.activity;
      return res.status(200).json({
        ok: true,
        id: result.disabled ? null : activity._id.toString(),
        createdAt: activity.createdAt.toISOString(),
        ...(result.disabled && { disabled: true }),
      });
    } catch (err) {
      if (err instanceof ActivityValidationError) {
        return res.status(400).json({ ok: false, error: 'validation_error', issues: err.issues });
      }
      console.error('[activity] insert failed:', err.message);
      return res.status(500).json({ ok: false, error: 'internal_error' });
    }
  }
}

module.exports = new ActivityController();
