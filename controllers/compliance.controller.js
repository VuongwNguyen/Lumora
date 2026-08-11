const { successfullyResponse } = require('../context/responseHandle');
const { getComplianceConfig } = require('../config/compliance');

class ComplianceController {
  getPublicConfig(req, res) {
    const config = getComplianceConfig();
    res.set('Cache-Control', 'no-store');
    return new successfullyResponse({
      message: 'Public site configuration fetched',
      meta: config,
    }).json(res);
  }
}

module.exports = new ComplianceController();
