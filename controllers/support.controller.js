const SupportService = require('../services/support.service');
const { successfullyResponse } = require('../context/responseHandle');

class SupportController {
  async create(req, res) {
    const result = await SupportService.create(req.body, req.activityRequestId);
    return new successfullyResponse({
      message: 'Yêu cầu đã được tiếp nhận',
      statusCode: 201,
      meta: result,
    }).json(res);
  }
}

module.exports = new SupportController();
