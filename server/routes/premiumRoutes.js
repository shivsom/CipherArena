const router = require('express').Router();
const crypto = require('node:crypto');
const User = require('../models/User');
const Payment = require('../models/Payment');
const Challenge = require('../models/Challenge');
const protect = require('../middleware/auth');

// read at request time so env changes (and tests) are picked up
const cfg = () => ({
  keyId: process.env.RAZORPAY_KEY_ID,
  keySecret: process.env.RAZORPAY_KEY_SECRET,
  webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  apiBase: (process.env.RAZORPAY_API_BASE || 'https://api.razorpay.com/v1').replace(/\/$/, ''),
  priceInr: Number(process.env.PREMIUM_PRICE_INR) || 99,
});
const configured = c => Boolean(c.keyId && c.keySecret);
const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');
const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

async function markPaid(payment, paymentId) {
  payment.status = 'paid';
  payment.paymentId = paymentId;
  await payment.save();
  await User.updateOne({ _id: payment.user, premium: { $ne: true } }, { premium: true, premiumSince: new Date() });
}

// GET /api/premium/status
router.get('/status', protect, async (req, res) => {
  const c = cfg();
  const [user, vault] = await Promise.all([
    User.findById(req.userId).lean(),
    Challenge.aggregate([
      { $match: { active: true, room: 'premium' } },
      { $group: { _id: null, count: { $sum: 1 }, points: { $sum: '$points' } } },
    ]),
  ]);
  res.json({
    premium: !!user?.premium,
    priceInr: c.priceInr,
    paymentsEnabled: configured(c),
    challenges: vault[0]?.count || 0,
    points: vault[0]?.points || 0,
  });
});

// POST /api/premium/order – creates a Razorpay order for the logged-in player
router.post('/order', protect, async (req, res) => {
  const c = cfg();
  if (!configured(c)) return res.status(503).json({ message: 'Payments are not configured on this server yet' });
  const user = await User.findById(req.userId);
  if (user.premium) return res.status(409).json({ message: 'You already own the Premium Vault' });

  const amount = c.priceInr * 100;                      // Razorpay works in paise
  const rzp = await fetch(`${c.apiBase}/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${c.keyId}:${c.keySecret}`).toString('base64')}`,
    },
    body: JSON.stringify({
      amount, currency: 'INR',
      receipt: `ca_${String(user._id).slice(-10)}_${Date.now().toString(36)}`,
      notes: { userId: String(user._id), plan: 'premium_vault' },
    }),
  });
  const order = await rzp.json().catch(() => ({}));
  if (!rzp.ok || !order.id) {
    console.error('Razorpay order failed', rzp.status, order?.error?.description);
    return res.status(502).json({ message: 'Could not start the payment, please try again' });
  }
  await Payment.create({ user: user._id, orderId: order.id, amount, currency: 'INR' });
  res.json({ orderId: order.id, amount, currency: 'INR', keyId: c.keyId, name: user.username, email: user.email });
});

// POST /api/premium/verify – called by the browser after Razorpay Checkout succeeds
router.post('/verify', protect, async (req, res) => {
  const c = cfg();
  if (!configured(c)) return res.status(503).json({ message: 'Payments are not configured on this server yet' });
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
  if (![orderId, paymentId, signature].every(v => typeof v === 'string' && v)) {
    return res.status(400).json({ message: 'Missing payment details' });
  }
  const payment = await Payment.findOne({ orderId, user: req.userId });
  if (!payment) return res.status(404).json({ message: 'Unknown order' });
  if (!safeEqual(hmac(c.keySecret, `${orderId}|${paymentId}`), signature)) {
    return res.status(400).json({ message: 'Payment signature mismatch – no access was granted' });
  }
  if (payment.status !== 'paid') await markPaid(payment, paymentId);
  res.json({ premium: true, message: 'Premium Vault unlocked!' });
});

// POST /api/premium/webhook – Razorpay → server, grants access even if the player closed the tab.
// Mounted in server.js with express.raw() because the signature covers the exact raw body.
async function webhook(req, res) {
  const c = cfg();
  if (!c.webhookSecret) return res.status(503).json({ message: 'Webhook not configured' });
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!safeEqual(hmac(c.webhookSecret, raw), req.get('x-razorpay-signature') || '')) {
    return res.status(400).json({ message: 'Invalid signature' });
  }
  let event;
  try { event = JSON.parse(raw.toString('utf8')); } catch { return res.status(400).json({ message: 'Bad JSON' }); }
  if (['payment.captured', 'order.paid'].includes(event.event)) {
    const entity = event.payload?.payment?.entity;
    const orderId = entity?.order_id || event.payload?.order?.entity?.id;
    const payment = orderId && await Payment.findOne({ orderId });
    if (payment && payment.status !== 'paid') await markPaid(payment, entity?.id);
  }
  res.json({ received: true });
}

module.exports = router;
module.exports.webhook = webhook;
