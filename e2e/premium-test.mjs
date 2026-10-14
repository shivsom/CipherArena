// End-to-end test of the Razorpay premium flow against a mock Razorpay API (no real money, no real keys).
// Start the server with:
//   RAZORPAY_KEY_ID=rzp_test_mock RAZORPAY_KEY_SECRET=mock_secret RAZORPAY_WEBHOOK_SECRET=mock_hook \
//   RAZORPAY_API_BASE=http://localhost:9911 npm start
// then:  BASE_URL=http://localhost:10000 npm run test:premium
import http from 'node:http';
import crypto from 'node:crypto';

const BASE = (process.env.BASE_URL || 'http://localhost:10000').replace(/\/$/, '');
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'mock_secret';
const HOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'mock_hook';
const MOCK_PORT = Number(process.env.MOCK_PORT) || 9911;
const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');

// ---- mock of POST https://api.razorpay.com/v1/orders ----
let orderCount = 0;
const mock = http.createServer((req, res) => {
  let body = '';
  req.on('data', d => (body += d));
  req.on('end', () => {
    const auth = req.headers.authorization || '';
    if (req.method !== 'POST' || req.url !== '/orders' || !auth.startsWith('Basic ')) {
      res.writeHead(404).end('{}');
      return;
    }
    const { amount, currency, receipt } = JSON.parse(body);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: `order_mock${++orderCount}_${Date.now().toString(36)}`, amount, currency, receipt, status: 'created' }));
  });
});
await new Promise(r => mock.listen(MOCK_PORT, r));

let passed = 0, failed = 0;
const expect = (ok, msg) => { if (!ok) throw new Error(msg); };
async function step(name, fn) {
  try {
    const info = await fn();
    passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}${info ? `  → ${info}` : ''}`);
  } catch (err) {
    failed++;
    console.log(`  \x1b[31m✖ ${name}\x1b[0m  → ${err.message}`);
  }
}
async function call(method, path, { body, token, headers, raw } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(raw ? {} : { 'Content-Type': 'application/json' }), ...(token && { Authorization: `Bearer ${token}` }), ...headers },
    body: raw ?? (body && JSON.stringify(body)),
  });
  const isJson = (res.headers.get('content-type') || '').includes('json');
  return { status: res.status, data: isJson ? await res.json() : await res.text() };
}
async function newPlayer(tag) {
  const stamp = `${tag}${Date.now().toString(36)}`;
  const r = await call('POST', '/api/auth/register', {
    body: { username: `p_${stamp}`, email: `${stamp}@cipherarena.dev`, team: `T_${stamp}`, password: 'Smoke@Test2026' },
  });
  expect(r.status === 201, `register ${r.status}`);
  return r.data.token;
}

console.log(`\nCipherArena premium (Razorpay) test  ·  ${BASE}\n`);
let token, order, vault;

await step('Player registers; premium status is false and payments are enabled', async () => {
  token = await newPlayer('buyer');
  const r = await call('GET', '/api/premium/status', { token });
  expect(r.status === 200 && r.data.premium === false, JSON.stringify(r.data));
  expect(r.data.paymentsEnabled, 'RAZORPAY_KEY_ID/SECRET not set on the server');
  return `₹${r.data.priceInr}, ${r.data.challenges} challenges / ${r.data.points} pts`;
});
await step('POST /api/premium/order creates a Razorpay order', async () => {
  const r = await call('POST', '/api/premium/order', { token });
  expect(r.status === 200 && r.data.orderId && r.data.keyId, `status ${r.status} ${JSON.stringify(r.data)}`);
  expect(!JSON.stringify(r.data).includes(KEY_SECRET), 'key secret leaked');
  order = r.data;
  return `${order.orderId} · ${order.amount / 100} ${order.currency}`;
});
await step('Verify with a forged signature is rejected and grants nothing (400)', async () => {
  const r = await call('POST', '/api/premium/verify', {
    token, body: { razorpay_order_id: order.orderId, razorpay_payment_id: 'pay_fake', razorpay_signature: 'f'.repeat(64) },
  });
  expect(r.status === 400, `status ${r.status}`);
  const s = await call('GET', '/api/premium/status', { token });
  expect(s.data.premium === false, 'premium granted on a forged signature');
});
await step('Another player cannot verify someone else\'s order (404)', async () => {
  const other = await newPlayer('thief');
  const paymentId = 'pay_stolen';
  const r = await call('POST', '/api/premium/verify', {
    token: other,
    body: { razorpay_order_id: order.orderId, razorpay_payment_id: paymentId, razorpay_signature: hmac(KEY_SECRET, `${order.orderId}|${paymentId}`) },
  });
  expect(r.status === 404, `status ${r.status}`);
});
await step('Verify with the correct HMAC signature unlocks the vault', async () => {
  const paymentId = `pay_${Date.now().toString(36)}`;
  const r = await call('POST', '/api/premium/verify', {
    token,
    body: { razorpay_order_id: order.orderId, razorpay_payment_id: paymentId, razorpay_signature: hmac(KEY_SECRET, `${order.orderId}|${paymentId}`) },
  });
  expect(r.status === 200 && r.data.premium === true, `status ${r.status} ${JSON.stringify(r.data)}`);
  const me = await call('GET', '/api/auth/me', { token });
  expect(me.data.premium === true, '/auth/me does not show premium');
});
await step('Premium challenges are now unlocked: description, hint and file available', async () => {
  const r = await call('GET', '/api/challenges', { token });
  vault = r.data.filter(c => c.room === 'premium');
  expect(vault.length >= 3 && vault.every(c => !c.locked && c.hint && c.hasFile), 'vault still locked');
  return `${vault.length} challenges unlocked`;
});
await step('Download a premium file and solve it (zero-width text)', async () => {
  const c = vault.find(x => x.title === 'Zero Width Whisper');
  const f = await call('GET', `/api/challenges/${c._id}/download`, { token });
  expect(f.status === 200, `download ${f.status}`);
  const bits = [...f.data].filter(ch => ch === '​' || ch === '‌').map(ch => (ch === '​' ? 0 : 1)).join('');
  const flag = bits.match(/.{8}/g).map(b => String.fromCharCode(parseInt(b, 2))).join('');
  const r = await call('POST', `/api/challenges/${c._id}/submit`, { token, body: { flag } });
  expect(r.status === 200 && r.data.score === c.points, `submit ${r.status}`);
  return `${flag} → +${c.points}`;
});
await step('Buying again is refused (409)', async () => {
  const r = await call('POST', '/api/premium/order', { token });
  expect(r.status === 409, `status ${r.status}`);
});
await step('Webhook with a bad signature is rejected (400)', async () => {
  const r = await call('POST', '/api/premium/webhook', { raw: '{"event":"payment.captured"}', headers: { 'x-razorpay-signature': 'bad' } });
  expect(r.status === 400, `status ${r.status}`);
});
await step('Webhook payment.captured unlocks a player who closed the tab', async () => {
  const t2 = await newPlayer('webhook');
  const o = (await call('POST', '/api/premium/order', { token: t2 })).data;
  const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_hook1', order_id: o.orderId } } } });
  const r = await call('POST', '/api/premium/webhook', { raw: body, headers: { 'x-razorpay-signature': hmac(HOOK_SECRET, body) } });
  expect(r.status === 200, `webhook ${r.status}`);
  const s = await call('GET', '/api/premium/status', { token: t2 });
  expect(s.data.premium === true, 'webhook did not grant premium');
});

mock.close();
console.log(`\n  \x1b[32m${passed} passing\x1b[0m${failed ? `, \x1b[31m${failed} failing\x1b[0m` : ''}\n`);
process.exit(failed ? 1 : 0);
