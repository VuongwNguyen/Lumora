// services/payment.service.js
const { PayOS } = require('@payos/node');
const SubscriptionModel = require('../models/subscription');
const PaymentModel = require('../models/payment');
const { PLANS } = require('../config/plans');
const { errorResponse } = require('../context/responseHandle');
require('dotenv').config();

const payos = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
  partnerCode:"vuongw0134",
});

class PaymentService {
  async createPaymentLink({ userId, userEmail, plan, period, returnUrl, cancelUrl }) {
    if (!PLANS[plan]) {
      throw new errorResponse({ message: 'Invalid plan', statusCode: 400 });
    }
    if (!['monthly', 'yearly'].includes(period)) {
      throw new errorResponse({ message: 'Invalid period', statusCode: 400 });
    }

    const amount = PLANS[plan][period];
    const periodLabel = period === 'monthly' ? '1 thang' : '1 nam';
    const description = 'Galaxy ' + PLANS[plan].label + ' - ' + periodLabel;
    // PayOS orderCode must be a unique integer
    const orderCode = parseInt(String(Date.now()).slice(-8) + String(Math.floor(Math.random() * 100)).padStart(2, '0'));

    const payment = await PaymentModel.create({
      userId,
      payosOrderCode: orderCode,
      plan,
      period,
      amount,
      status: 'pending',
      buyerEmail: userEmail,
      description,
    });

    let payosResponse;
    try {
      payosResponse = await payos.paymentRequests.create({
        orderCode,
        amount,
        description,
        returnUrl,
        cancelUrl,
      });
    } catch (err) {
      await PaymentModel.findByIdAndDelete(payment._id);
      throw new errorResponse({ message: 'PayOS error: ' + err.message, statusCode: 502 });
    }

    return { checkoutUrl: payosResponse.checkoutUrl, orderCode };
  }

  async handleWebhook(webhookBody) {
    let webhookData;
    try {
      webhookData = await payos.webhooks.verify(webhookBody);
    } catch {
      throw new errorResponse({ message: 'Invalid webhook signature', statusCode: 400 });
    }

    const { orderCode, reference, code } = webhookData;

    const payment = await PaymentModel.findOne({ payosOrderCode: orderCode });
    if (!payment) return { status: 'ignored' };

    if (code !== '00') {
      if (payment.status === 'paid' || payment.status === 'cancelled') {
        return { status: 'duplicate', paymentId: payment._id };
      }
      const cancelled = await PaymentModel.findOneAndUpdate(
        { _id: payment._id, status: 'pending' },
        { status: 'cancelled' },
        { new: true }
      );
      return cancelled
        ? { status: 'cancelled', paymentId: payment._id, providerCode: code }
        : { status: 'duplicate', paymentId: payment._id };
    }

    const processingAt = new Date();
    const staleProcessingAt = new Date(processingAt.getTime() - 5 * 60 * 1000);
    const claimedPayment = await PaymentModel.findOneAndUpdate(
      {
        _id: payment._id,
        $or: [
          { status: 'pending' },
          { status: 'processing', processingAt: { $lt: staleProcessingAt } },
        ],
      },
      { status: 'processing', processingAt },
      { new: true }
    );
    if (!claimedPayment) return { status: 'duplicate', paymentId: payment._id };

    try {
      const paidAt = new Date();
      const existingSub = await SubscriptionModel.findOne({ userId: claimedPayment.userId, status: 'active' });

      let subscription;
      if (existingSub) {
        const baseDate = existingSub.expiredAt > paidAt ? existingSub.expiredAt : paidAt;
        const newExpiredAt = new Date(baseDate);
        if (claimedPayment.period === 'monthly') {
          newExpiredAt.setMonth(newExpiredAt.getMonth() + 1);
        } else {
          newExpiredAt.setFullYear(newExpiredAt.getFullYear() + 1);
        }
        subscription = await SubscriptionModel.findByIdAndUpdate(
          existingSub._id,
          { plan: claimedPayment.plan, period: claimedPayment.period, expiredAt: newExpiredAt },
          { new: true }
        );
      } else {
        const expiredAt = new Date(paidAt);
        if (claimedPayment.period === 'monthly') {
          expiredAt.setMonth(expiredAt.getMonth() + 1);
        } else {
          expiredAt.setFullYear(expiredAt.getFullYear() + 1);
        }
        subscription = await SubscriptionModel.create({
          userId: claimedPayment.userId,
          plan: claimedPayment.plan,
          period: claimedPayment.period,
          status: 'active',
          startDate: paidAt,
          expiredAt,
        });
      }

      await PaymentModel.findByIdAndUpdate(claimedPayment._id, {
        status: 'paid', processingAt: null, payosTransactionId: reference, paidAt, subscriptionId: subscription._id,
      });
      return {
        status: 'paid', paymentId: claimedPayment._id, plan: claimedPayment.plan,
        period: claimedPayment.period, amount: claimedPayment.amount, extended: Boolean(existingSub),
      };
    } catch (err) {
      await PaymentModel.findOneAndUpdate({ _id: claimedPayment._id, status: 'processing' }, { status: 'pending', processingAt: null });
      throw new errorResponse({ message: 'Failed to process payment: ' + err.message, statusCode: 500 });
    }
  }

  async getStatus(userId) {
    const sub = await SubscriptionModel.findOne({ userId, status: 'active' }).sort({ expiredAt: -1 });
    if (!sub) return null;
    if (sub.expiredAt < new Date()) {
      await SubscriptionModel.findByIdAndUpdate(sub._id, { status: 'expired' });
      return null;
    }
    return sub;
  }

  async getHistory(userId) {
    return PaymentModel.find({ userId }).sort({ createdAt: -1 }).limit(50);
  }

  async cancelPayment(orderCode) {
    return PaymentModel.findOneAndUpdate(
      { payosOrderCode: orderCode, status: 'pending' },
      { status: 'cancelled' },
      { new: true }
    );
  }
}

module.exports = new PaymentService();
