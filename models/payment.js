// models/payment.js
const { model, Schema } = require('mongoose');
const { PLAN_KEYS } = require('../config/plans');

const paymentSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  subscriptionId: {
    type: Schema.Types.ObjectId,
    ref: 'Subscription',
    default: null,
  },
  payosOrderCode: {
    type: Number,
    required: true,
    unique: true,
  },
  payosTransactionId: {
    type: String,
    default: null,
    select: false,
  },
  checkoutUrl: {
    type: String,
    default: null,
    select: false,
  },
  idempotencyKeyHash: {
    type: String,
    default: null,
    select: false,
  },
  plan: {
    type: String,
    enum: [...PLAN_KEYS],
    required: true,
  },
  period: {
    type: String,
    enum: ['monthly', 'yearly'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'cancelled', 'failed'],
    default: 'pending',
    index: true,
  },
  paidAt: {
    type: Date,
    default: null,
  },
  processingAt: {
    type: Date,
    default: null,
  },
  buyerEmail: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

paymentSchema.index(
  { userId: 1, idempotencyKeyHash: 1 },
  { unique: true, partialFilterExpression: { idempotencyKeyHash: { $type: 'string' } } }
);

module.exports = model('Payment', paymentSchema, 'payments');
