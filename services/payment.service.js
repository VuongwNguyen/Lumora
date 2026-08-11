// services/payment.service.js
const { PayOS } = require('@payos/node');
const SubscriptionModel = require('../models/subscription');
const PaymentModel = require('../models/payment');
const { PLANS, PLAN_KEYS, PLAN_RANK } = require('../config/plans');
const { isDevelopmentBypass, getEntitlementBypassMode } = require('../config/runtime');
const { errorResponse } = require('../context/responseHandle');
const crypto = require('crypto');
require('dotenv').config();

const payos = new PayOS({
  clientId: process.env.PAYOS_CLIENT_ID,
  apiKey: process.env.PAYOS_API_KEY,
  checksumKey: process.env.PAYOS_CHECKSUM_KEY,
  partnerCode:"vuongw0134",
});

class PaymentService {
  validateIdempotencyKey(value) {
    const key = String(value || '').trim();
    if (!/^[A-Za-z0-9._:-]{16,128}$/.test(key)) {
      throw new errorResponse({ message: 'Invalid Idempotency-Key', statusCode: 400 });
    }
    return key;
  }

  async createPaymentLink({ userId, userEmail, plan, period, idempotencyKey, returnUrl, cancelUrl }) {
    if (!PLANS[plan]) {
      throw new errorResponse({ message: 'Invalid plan', statusCode: 400 });
    }
    if (!['monthly', 'yearly'].includes(period)) {
      throw new errorResponse({ message: 'Invalid period', statusCode: 400 });
    }

    const key = this.validateIdempotencyKey(idempotencyKey);
    const idempotencyKeyHash = crypto.createHash('sha256').update(`${userId}:${key}`).digest('hex');
    const existing = await PaymentModel.findOne({ userId, idempotencyKeyHash })
      .select('+checkoutUrl +idempotencyKeyHash');
    if (existing) {
      if (existing.status === 'pending' && existing.checkoutUrl) {
        return { checkoutUrl: existing.checkoutUrl, orderCode: existing.payosOrderCode, reused: true };
      }
      throw new errorResponse({
        message: existing.status === 'pending'
          ? 'Yêu cầu thanh toán đang được xử lý'
          : 'Yêu cầu thanh toán này đã được xử lý',
        statusCode: 409,
      });
    }

    const amount = PLANS[plan][period];
    const periodLabel = period === 'monthly' ? '1 thang' : '1 nam';
    const description = 'Galaxy ' + PLANS[plan].label + ' - ' + periodLabel;
    // PayOS orderCode must be a unique integer
    const orderCode = parseInt(String(Date.now()).slice(-8) + String(Math.floor(Math.random() * 100)).padStart(2, '0'));

    let payment;
    try {
      payment = await PaymentModel.create({
        userId,
        payosOrderCode: orderCode,
        plan,
        period,
        amount,
        status: 'pending',
        buyerEmail: userEmail,
        description,
        idempotencyKeyHash,
      });
    } catch (err) {
      if (err?.code === 11000) {
        const duplicate = await PaymentModel.findOne({ userId, idempotencyKeyHash }).select('+checkoutUrl');
        if (duplicate?.checkoutUrl) {
          return { checkoutUrl: duplicate.checkoutUrl, orderCode: duplicate.payosOrderCode, reused: true };
        }
        throw new errorResponse({ message: 'Yêu cầu thanh toán đang được xử lý', statusCode: 409 });
      }
      throw err;
    }

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
      await PaymentModel.findByIdAndUpdate(payment._id, { status: 'failed' });
      throw new errorResponse({ message: 'Không thể tạo yêu cầu thanh toán với PayOS', statusCode: 502 });
    }

    await PaymentModel.findByIdAndUpdate(payment._id, { checkoutUrl: payosResponse.checkoutUrl });

    return { checkoutUrl: payosResponse.checkoutUrl, orderCode, reused: false };
  }

  async devActivate({ userId, userEmail, plan, period, idempotencyKey }) {
    if (!isDevelopmentBypass()) {
      throw new errorResponse({ message: 'Not found', statusCode: 404 });
    }
    if (!PLANS[plan]) {
      throw new errorResponse({ message: 'Invalid plan', statusCode: 400 });
    }
    if (!['monthly', 'yearly'].includes(period)) {
      throw new errorResponse({ message: 'Invalid period', statusCode: 400 });
    }

    const key = this.validateIdempotencyKey(idempotencyKey);
    const idempotencyKeyHash = crypto.createHash('sha256').update(`${userId}:${key}`).digest('hex');
    const existingPayment = await PaymentModel.findOne({ userId, idempotencyKeyHash });
    if (existingPayment) {
      if (existingPayment.status === 'paid') {
        return {
          status: 'paid', paymentId: existingPayment._id, subscriptionId: existingPayment.subscriptionId,
          plan: existingPayment.plan, period: existingPayment.period, amount: existingPayment.amount,
          reused: true, simulated: true,
        };
      }
      throw new errorResponse({ message: 'Yêu cầu DEV này đã được xử lý', statusCode: 409 });
    }

    const amount = PLANS[plan][period];
    const paidAt = new Date();
    const periodLabel = period === 'monthly' ? '1 tháng' : '1 năm';
    const orderCode = parseInt(String(Date.now()).slice(-8) + String(Math.floor(Math.random() * 100)).padStart(2, '0'));
    let payment;
    try {
      payment = await PaymentModel.create({
        userId,
        payosOrderCode: orderCode,
        plan,
        period,
        amount,
        status: 'processing',
        processingAt: paidAt,
        buyerEmail: userEmail,
        description: `[DEV] Galaxy ${PLANS[plan].label} - ${periodLabel}`,
        idempotencyKeyHash,
      });
    } catch (err) {
      if (err?.code === 11000) {
        throw new errorResponse({ message: 'Yêu cầu DEV đang được xử lý, vui lòng thử lại', statusCode: 409 });
      }
      throw err;
    }

    try {
      const existingSub = await SubscriptionModel.findOne({ userId, status: 'active' });
      let subscription;
      if (existingSub) {
        const baseDate = existingSub.expiredAt > paidAt ? existingSub.expiredAt : paidAt;
        const expiredAt = new Date(baseDate);
        if (period === 'monthly') expiredAt.setMonth(expiredAt.getMonth() + 1);
        else expiredAt.setFullYear(expiredAt.getFullYear() + 1);
        subscription = await SubscriptionModel.findByIdAndUpdate(
          existingSub._id,
          { plan, period, status: 'active', expiredAt },
          { new: true },
        );
      } else {
        const expiredAt = new Date(paidAt);
        if (period === 'monthly') expiredAt.setMonth(expiredAt.getMonth() + 1);
        else expiredAt.setFullYear(expiredAt.getFullYear() + 1);
        subscription = await SubscriptionModel.create({
          userId, plan, period, status: 'active', startDate: paidAt, expiredAt,
        });
      }

      await PaymentModel.findByIdAndUpdate(payment._id, {
        status: 'paid', processingAt: null, paidAt, subscriptionId: subscription._id,
        payosTransactionId: `DEV-${payment._id}`,
      });
      return {
        status: 'paid', paymentId: payment._id, subscriptionId: subscription._id,
        plan, period, amount, extended: Boolean(existingSub), reused: false, simulated: true,
      };
    } catch (err) {
      await PaymentModel.findByIdAndUpdate(payment._id, { status: 'failed', processingAt: null });
      throw new errorResponse({ message: 'Không thể kích hoạt gói DEV: ' + err.message, statusCode: 500 });
    }
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

  async getStatus(userId, userRole) {
    const accessMode = getEntitlementBypassMode({ role: userRole });
    const entitlementBypass = accessMode !== null;
    const developmentBypass = accessMode === 'development';
    const privilegedBypass = accessMode === 'admin' || accessMode === 'partner';
    let sub = await SubscriptionModel.findOne({ userId, status: 'active' }).sort({ expiredAt: -1 });
    if (sub && sub.expiredAt < new Date()) {
      await SubscriptionModel.findByIdAndUpdate(sub._id, { status: 'expired' });
      if (!entitlementBypass) return null;
      sub = null;
    }
    if (!sub && !entitlementBypass) return null;
    const bypassPlan = privilegedBypass ? userRole : 'development';
    const result = sub ? sub.toObject() : { plan: bypassPlan, status: 'active' };
    if (entitlementBypass) {
      result.accessMode = accessMode;
      result.developmentBypass = developmentBypass;
      result.privilegedBypass = privilegedBypass;
      result.features = [...new Set(PLAN_KEYS.flatMap(key => PLANS[key].features || []))];
      result.maxGalaxies = Number.MAX_SAFE_INTEGER;
      result.effectivePlan = [...PLAN_KEYS].sort((left, right) => PLAN_RANK[right] - PLAN_RANK[left])[0] || 'free';
      return result;
    }
    result.accessMode = 'subscription';
    result.features = [...(PLANS[sub.plan]?.features || [])];
    result.maxGalaxies = PLANS[sub.plan]?.maxGalaxies || 1;
    return result;
  }

  async getHistory(userId, query = {}) {
    const page = Math.max(1, Math.min(10000, Number.parseInt(query.page, 10) || 1));
    const limit = Math.max(1, Math.min(50, Number.parseInt(query.limit, 10) || 10));
    const filter = { userId };
    const [items, total] = await Promise.all([
      PaymentModel.find(filter)
        .select('payosOrderCode plan period amount status paidAt createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PaymentModel.countDocuments(filter),
    ]);
    return {
      items,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
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
