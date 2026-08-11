// models/payment.js
const { model, Schema } = require('mongoose');

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
  },
  plan: {
    type: String,
    enum: ['plus', 'pro'],
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
    enum: ['pending', 'processing', 'paid', 'cancelled'],
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

module.exports = model('Payment', paymentSchema, 'payments');
