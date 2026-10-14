// Proves every generated file is solvable: each solver below only looks at the file bytes (never the catalog)
// and must recover the flag. Run with:  npm run verify:challenges
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');
const catalog = require('./catalog');
const { OUT } = require('./build');

const read = f => fs.readFileSync(path.join(OUT, f));
const FLAG = /CA\{[^}]+\}/;
const rot13 = s => s.replace(/[a-z]/gi, c => { const b = c <= 'Z' ? 65 : 97; return String.fromCharCode(((c.charCodeAt(0) - b + 13) % 26) + b); });

// minimal PNG chunk walker – `fixSignature` repairs the broken header like a player would
function pngChunks(buf) {
  const out = [];
  for (let p = 8; p < buf.length;) {
    const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8);
    out.push({ type, data: buf.subarray(p + 8, p + 8 + len) });
    p += 12 + len;
  }
  return out;
}
function pngPixels(buf) {
  const ihdr = pngChunks(buf).find(c => c.type === 'IHDR').data;
  const w = ihdr.readUInt32BE(0), h = ihdr.readUInt32BE(4);
  const raw = zlib.inflateSync(Buffer.concat(pngChunks(buf).filter(c => c.type === 'IDAT').map(c => c.data)));
  return { w, h, at: (x, y, ch) => raw[y * (w * 3 + 1) + 1 + x * 3 + ch] };
}
const bigSqrt = n => { let x = n; let y = (x + 1n) / 2n; while (y < x) { x = y; y = (x + n / x) / 2n; } return x; };
const modpow = (b, e, m) => { let r = 1n; b %= m; while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; };
const egcd = (a, b) => (b === 0n ? [a, 1n, 0n] : (([g, x, y]) => [g, y, x - (a / b) * y])(egcd(b, a % b)));

const solvers = {
  'caesar.txt': () => rot13(read('caesar.txt').toString()).match(FLAG)[0],
  'mystery.bin': () => read('mystery.bin').toString('latin1').match(FLAG)[0],
  'club_trip.png': () => pngChunks(read('club_trip.png')).filter(c => c.type === 'tEXt')
    .map(c => c.data.toString()).join('\n').match(FLAG)[0],
  'transmission.txt': () => {
    const rev = Object.fromEntries(Object.entries({
      A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
      M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
      Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...',
      8: '---..', 9: '----.',
    }).map(([k, v]) => [v, k]));
    const line = read('transmission.txt').toString().split('\n')[1];
    return `CA{${line.split(' / ').map(w => w.split(' ').map(c => rev[c]).join('')).join('_')}}`;
  },
  'onion.txt': () => {
    let s = read('onion.txt').toString().trim(), layers = 0;
    while (!s.startsWith('CA{')) { s = Buffer.from(s, 'base64').toString(); layers++; }
    if (layers !== 20) throw new Error(`expected 20 layers, got ${layers}`);
    return s;
  },
  'broken.png': () => {
    const buf = Buffer.from(read('broken.png'));
    if (buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) throw new Error('header is not broken');
    Buffer.from([0x89, 0x50, 0x4e, 0x47]).copy(buf, 0);
    const z = pngChunks(buf).find(c => c.type === 'zTXt').data;
    return zlib.inflateSync(z.subarray(z.indexOf(0) + 2)).toString().match(FLAG)[0];
  },
  'vault.txt': () => {
    const key = 'cipherarena';
    let k = 0;
    const plain = read('vault.txt').toString().replace(/[a-z]/gi, c => {
      const b = c <= 'Z' ? 65 : 97, s = key.charCodeAt(k++ % key.length) - 97;
      return String.fromCharCode(((c.charCodeAt(0) - b - s + 26) % 26) + b);
    });
    return plain.match(FLAG)[0];
  },
  'capture.pcap': () => {
    const buf = read('capture.pcap');
    const pass = [];
    let ok = false;
    for (let p = 24; p < buf.length;) {
      const len = buf.readUInt32LE(p + 8), pkt = buf.subarray(p + 16, p + 16 + len);
      const payload = pkt.subarray(14 + 20 + 20).toString();            // eth + ip + tcp
      if (payload.startsWith('PASS ')) pass.push(payload.slice(5).trim());
      if (payload.startsWith('230 ')) ok = true;
      if (payload.startsWith('530 ')) pass.shift();                       // drop the attempt that failed
      p += 16 + len;
    }
    if (!ok) throw new Error('no successful login in capture');
    return pass[0];
  },
  'reverse_me.py': () => {
    const src = read('reverse_me.py').toString();
    const KEY = JSON.parse(src.match(/KEY = (\[.*\])/)[1]), T = JSON.parse(src.match(/TARGET = (\[.*\])/)[1]);
    return Buffer.from(T.map((t, i) => ((t - i * 7) & 0xff) ^ KEY[i % KEY.length])).toString();
  },
  'announcement.txt': () => {
    const bits = [...read('announcement.txt').toString()].filter(c => c === '​' || c === '‌')
      .map(c => (c === '​' ? '0' : '1')).join('');
    return bits.match(/.{8}/g).map(b => String.fromCharCode(parseInt(b, 2))).join('');
  },
  'rsa.txt': () => {
    const t = read('rsa.txt').toString();
    const [n, e, c] = ['n', 'e', 'c'].map(k => BigInt(t.match(new RegExp(`^${k} = (\\d+)`, 'm'))[1]));
    let a = bigSqrt(n) + 1n, b2 = a * a - n, b = bigSqrt(b2);
    while (b * b !== b2) { a++; b2 = a * a - n; b = bigSqrt(b2); }
    const p = a - b, q = a + b;
    const d = ((egcd(e, (p - 1n) * (q - 1n))[1] % ((p - 1n) * (q - 1n))) + (p - 1n) * (q - 1n)) % ((p - 1n) * (q - 1n));
    return Buffer.from(modpow(c, d, n).toString(16).padStart(2, '0'), 'hex').toString();
  },
  'ghost.png': () => {
    const { w, h, at } = pngPixels(read('ghost.png'));
    const bytes = [];
    for (let i = 0; i + 8 <= w * h; i += 8) {
      let v = 0;
      for (let k = 0; k < 8; k++) { const j = i + k; v = (v << 1) | (at(j % w, Math.floor(j / w), 0) & 1); }
      if (v === 0) break;
      bytes.push(v);
    }
    return Buffer.from(bytes).toString();
  },
  'exfil.pcap': () => {
    const buf = read('exfil.pcap'), parts = [];
    for (let p = 24; p < buf.length;) {
      const len = buf.readUInt32LE(p + 8), pkt = buf.subarray(p + 16, p + 16 + len);
      let q = 14 + 20 + 8 + 12, name = [];
      while (pkt[q]) { name.push(pkt.toString('latin1', q + 1, q + 1 + pkt[q])); q += pkt[q] + 1; }
      const m = name[0].match(/^s(\d+)-([0-9a-f]+)$/);
      if (m && name[1] === 't') parts.push([+m[1], m[2]]);
      p += 16 + len;
    }
    return Buffer.from(parts.sort((x, y) => x[0] - y[0]).map(x => x[1]).join(''), 'hex').toString();
  },
  'rotor_lock.py': () => {
    const src = read('rotor_lock.py').toString();
    const SBOX = JSON.parse(`[${src.match(/SBOX = \[([\s\S]*?)\]/)[1]}]`), T = JSON.parse(src.match(/TARGET = (\[.*\])/)[1]);
    const inv = []; SBOX.forEach((v, i) => { inv[v] = i; });
    let state = 0xa7;
    return Buffer.from(T.map((out, i) => { const ch = inv[out] ^ state; state = (state * 31 + out + i) & 0xff; return ch; })).toString();
  },
};

let failed = 0;
for (const c of catalog) {
  let got, err;
  try { got = solvers[c.file](); } catch (e) { err = e.message; }
  const ok = got === c.flag;
  if (!ok) failed++;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${c.room.padEnd(7)} ${c.title.padEnd(22)} ${c.file}${ok ? '' : `  → ${err || got}`}`);
}

// the python crackmes must really accept the flag when executed
for (const c of catalog.filter(x => x.file.endsWith('.py'))) {
  const run = spawnSync('python', [path.join(OUT, c.file)], { input: `${c.flag}\n`, encoding: 'utf8' });
  const bad = spawnSync('python', [path.join(OUT, c.file)], { input: 'CA{wrong}\n', encoding: 'utf8' });
  const ok = /granted|OK/.test(run.stdout) && !/granted|OK/.test(bad.stdout);
  if (!ok) { failed++; console.log(` FAIL  ${c.file} does not behave as a crackme (is python on PATH?)`); }
  else console.log(`  ok   ${c.file} accepts the flag and rejects a wrong key`);
}
console.log(failed ? `\n${failed} problem(s)` : `\nAll ${catalog.length} challenges are solvable from their download.`);
process.exit(failed ? 1 : 0);
