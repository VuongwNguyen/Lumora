// controllers/payment.controller.js
const PaymentService = require('../services/payment.service');
const { successfullyResponse, errorResponse } = require('../context/responseHandle');
const { safeLog } = require('../middlewares/activityTracking');

class PaymentController {
  async createPaymentLink(req, res, next) {
    const { plan, period } = req.body;
    if (!plan || !period) {
      return next(new errorResponse({ message: 'plan and period are required', statusCode: 400 }));
    }
    const baseUrl = req.protocol + '://' + req.get('host');
    const result = await PaymentService.createPaymentLink({
      userId: req.user._id,
      userEmail: req.user.email,
      plan,
      period,
      returnUrl: baseUrl + '/portal/?payment=success',
      cancelUrl: baseUrl + '/payment/cancel',
    });
    return new successfullyResponse({ message: 'Payment link created', meta: result }).json(res);
  }

  async webhook(req, res, next) {
    const orderCode = req.body?.data?.orderCode || req.body?.orderCode || null;
    const webhookKey = orderCode ? String(orderCode) : req.activityRequestId;
    safeLog({
      action: 'Payment Webhook Received', feature: 'payment',
      metadata: { requestId: req.activityRequestId, hasOrderCode: Boolean(orderCode) },
    }, req, { dedupKey: `payment:webhook:received:${webhookKey}` });
    try {
      const result = await PaymentService.handleWebhook(req.body);
      if (result?.status === 'paid') {
        safeLog({
          action: 'Payment Succeeded', feature: 'payment', status: 1,
          paymentId: result.paymentId,
          metadata: { plan: result.plan, period: result.period, amount: result.amount },
        }, req, { dedupKey: `payment:succeeded:${result.paymentId}` });
        safeLog({
          action: result.extended ? 'Subscription Extended' : 'Subscription Activated',
          feature: 'subscription', status: 1, paymentId: result.paymentId,
          metadata: { plan: result.plan, period: result.period },
        }, req, { dedupKey: `subscription:activated:${result.paymentId}` });
      } else if (result?.status === 'cancelled') {
        safeLog({
          action: 'Payment Cancelled', feature: 'payment', level: 'warn',
          paymentId: result.paymentId, metadata: { providerCode: result.providerCode },
        }, req, { dedupKey: `payment:cancelled:${result.paymentId}` });
      }
      return res.json({ error: '0', message: 'Success' });
    } catch (error) {
      const invalid = /signature/i.test(error.message || '');
      safeLog({
        action: invalid ? 'Payment Webhook Verification Failed' : 'Payment Webhook Failed',
        feature: 'payment', level: 'error', status: 0,
        metadata: {
          errorType: invalid ? 'payment_webhook_invalid' : 'payment_webhook_process_fail',
          errorMsg: error.message,
        },
      }, req, { dedupKey: `payment:webhook:failed:${webhookKey}:${invalid ? 'verify' : 'process'}` });
      throw error;
    }
  }

  async getStatus(req, res, next) {
    const sub = await PaymentService.getStatus(req.user._id);
    return new successfullyResponse({ message: 'Subscription status fetched', meta: sub }).json(res);
  }

  async getHistory(req, res, next) {
    const history = await PaymentService.getHistory(req.user._id);
    return new successfullyResponse({ message: 'Payment history fetched', meta: history }).json(res);
  }

  async cancel(req, res, next) {
    const { orderCode } = req.query;
    if (orderCode) {
      const payment = await PaymentService.cancelPayment(parseInt(orderCode));
      if (payment) {
        safeLog({
          action: 'Payment Cancelled', feature: 'payment', level: 'warn', paymentId: payment._id,
          metadata: { source: 'return_url' },
        }, req, { dedupKey: `payment:cancelled:${payment._id}` });
      }
    }
    const baseUrl = req.protocol + '://' + req.get('host');
    return res.redirect(baseUrl + '/portal/?payment=cancel');
  }
}

module.exports = new PaymentController();
