// End-to-end smoke test for a deployed CipherArena instance.
// It follows the same path as a real player: page → register → login → challenges → flag → leaderboard.
// usage:  BASE_URL=https://cipherarena.onrender.com npm run test:e2e
const BASE = (process.env.BASE_URL || 'http://localhost:10000').replace(/\/$/, '');
const stamp = Date.now().toString(36);
const player = { username: 'e2e_bot', email: `e2e_${stamp}@cipherarena.dev`, team: `E2E_${stamp}`, password: 'Smoke@Test2026' };

let token, cookieMonster, passed = 0, failed = 0;

async function call(method, path, body, auth = false) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(auth && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const isJson = (res.headers.get('content-type') || '').includes('json');
  return { status: res.status, data: isJson ? await res.json() : await res.text() };
}
const expect = (ok, msg) => { if (!ok) throw new Error(msg); };

async function step(name, fn) {
  const t0 = Date.now();
  try {
    const info = await fn();
    passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${name} \x1b[2m(${Date.now() - t0} ms)\x1b[0m${info ? `  → ${info}` : ''}`);
  } catch (err) {
    failed++;
    console.log(`  \x1b[31m✖ ${name}\x1b[0m  → ${err.message}`);
  }
}

console.log(`\nCipherArena E2E smoke test  ·  ${BASE}\n`);

await step('GET / serves the React production build', async () => {
  const r = await call('GET', '/');
  expect(r.status === 200 && r.data.includes('<div id="root">'), `status ${r.status}`);
  return r.data.match(/assets\/index-[\w-]+\.js/)[0];
});
await step('GET /leaderboard (client-side route) falls back to index.html', async () => {
  const r = await call('GET', '/leaderboard');
  expect(r.status === 200 && r.data.includes('<div id="root">'), `status ${r.status}`);
});
await step('GET /api/health reports the database as connected', async () => {
  const r = await call('GET', '/api/health');
  expect(r.data.status === 'ok' && r.data.db === 'connected', JSON.stringify(r.data));
  return `env=${r.data.env}, db=${r.data.db}`;
});
await step('POST /api/auth/register creates a player (201)', async () => {
  const r = await call('POST', '/api/auth/register', player);
  expect(r.status === 201 && r.data.token, `status ${r.status}`);
  return `user ${r.data.user.username} / team ${r.data.user.team}`;
});
await step('POST /api/auth/login returns a JWT', async () => {
  const r = await call('POST', '/api/auth/login', { email: player.email, password: player.password });
  expect(r.status === 200, `status ${r.status}`);
  token = r.data.token;
  return `token ${token.slice(0, 16)}…`;
});
await step('GET /api/challenges without a token is rejected (401)', async () => {
  const r = await call('GET', '/api/challenges');
  expect(r.status === 401, `status ${r.status}`);
});
await step('GET /api/challenges with the token lists challenges', async () => {
  const r = await call('GET', '/api/challenges', null, true);
  expect(r.status === 200 && r.data.length > 0, `status ${r.status}`);
  expect(r.data.every(c => !('flagHash' in c)), 'flag hashes leaked to the client');
  cookieMonster = r.data.find(c => c.title === 'Cookie Monster');
  return `${r.data.length} challenges, no flag hashes exposed`;
});
await step('POST a wrong flag is rejected (400)', async () => {
  const r = await call('POST', `/api/challenges/${cookieMonster._id}/submit`, { flag: 'CA{guess}' }, true);
  expect(r.status === 400, `status ${r.status}`);
});
await step('POST the correct flag adds points', async () => {
  const r = await call('POST', `/api/challenges/${cookieMonster._id}/submit`, { flag: 'CA{c00k13s_ar3_n0t_s3cur3}' }, true);
  expect(r.status === 200 && r.data.score === cookieMonster.points, `status ${r.status}`);
  return `score = ${r.data.score}`;
});
await step('POST the same flag again is refused (409)', async () => {
  const r = await call('POST', `/api/challenges/${cookieMonster._id}/submit`, { flag: 'CA{c00k13s_ar3_n0t_s3cur3}' }, true);
  expect(r.status === 409, `status ${r.status}`);
});
await step('GET /api/leaderboard includes the new player', async () => {
  const r = await call('GET', '/api/leaderboard');
  const row = r.data.find(x => x.team === player.team);
  expect(row, 'player not on the leaderboard');
  return `rank #${row.rank} with ${row.score} pts`;
});

console.log(`\n  \x1b[32m${passed} passing\x1b[0m${failed ? `, \x1b[31m${failed} failing\x1b[0m` : ''}\n`);
process.exit(failed ? 1 : 0);
