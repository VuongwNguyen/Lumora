const { model, Schema } = require("mongoose");
const { PLAN_KEYS } = require('../config/plans');

const subscriptionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  plan: {
    type: String,
    enum: [...PLAN_KEYS],
    required: true,
  },
  period: {
    type: String,
    enum: ["monthly", "yearly"],
    required: true,
  },
  status: {
    type: String,
    enum: ["active", "expired", "cancelled"],
    default: "active",
  },
  isSimulation: {
    type: Boolean,
    default: false,
    index: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  expiredAt: {
    type: Date,
    required: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = model("Subscription", subscriptionSchema, "subscriptions");
