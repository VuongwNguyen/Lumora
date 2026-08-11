const { model, Schema } = require('mongoose');

const supportRequestSchema = new Schema({
  referenceCode: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true, maxlength: 120 },
  email: { type: String, required: true, maxlength: 254, index: true },
  type: {
    type: String,
    required: true,
    enum: ['technical', 'payment', 'refund', 'data_rights', 'complaint'],
  },
  orderCode: { type: String, default: '', maxlength: 40 },
  message: { type: String, required: true, maxlength: 5000 },
  status: {
    type: String,
    enum: ['received', 'verifying', 'processing', 'resolved', 'closed'],
    default: 'received',
    index: true,
  },
  requestId: { type: String, default: '', maxlength: 100 },
}, { timestamps: true });

module.exports = model('SupportRequest', supportRequestSchema, 'support_requests');
