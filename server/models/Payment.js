const mongoose = require('mongoose');

// One document per Razorpay order – the audit trail for premium purchases
const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderId: { type: String, required: true, unique: true },
    paymentId: String,
    amount: { type: Number, required: true },     // in paise
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: ['created', 'paid'], default: 'created' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
