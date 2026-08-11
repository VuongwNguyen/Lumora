const ActivityAnalyticsService = require('../services/activityAnalytics.service');

function ok(res, meta) {
  return res.status(200).json({ status: true, statusCode: 200, message: 'OK', meta });
}

class ActivityAdminController {
  async list(req, res) { return ok(res, await ActivityAnalyticsService.list(req.query)); }
  async overview(req, res) { return ok(res, await ActivityAnalyticsService.overview(req.query)); }
  async actions(req, res) { return ok(res, await ActivityAnalyticsService.actions(req.query)); }
  async errors(req, res) { return ok(res, await ActivityAnalyticsService.errors(req.query)); }
  async blocked(req, res) { return ok(res, await ActivityAnalyticsService.blocked(req.query)); }
  async performance(req, res) { return ok(res, await ActivityAnalyticsService.performance(req.query)); }
  async journey(req, res) { return ok(res, await ActivityAnalyticsService.journey(req.params.sessionId, req.query)); }
  async funnel(req, res) { return ok(res, await ActivityAnalyticsService.funnel(req.query)); }
}

module.exports = new ActivityAdminController();
