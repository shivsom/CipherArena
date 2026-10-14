// Generates every downloadable challenge file into server/challenge-files/.
// Run with:  npm run build:challenges   (the output is committed, so Render does not need to run it)
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const catalog = require('./catalog');

const OUT = path.join(__dirname, '..', 'challenge-files');
const flagOf = file => catalog.find(c => c.file === file).flag;

// ---------- tiny helpers ----------
// deterministic PRNG so rebuilding gives the same bytes
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = buf => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0); return b; };

// ---------- PNG writer (RGB, 8-bit) ----------
function pngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  return Buffer.concat([u32(data.length), body, u32(crc32(body))]);
}
const textChunk = (key, value) => pngChunk('tEXt', Buffer.concat([Buffer.from(key), Buffer.from([0]), Buffer.from(value)]));
const ztxtChunk = (key, value) =>
  pngChunk('zTXt', Buffer.concat([Buffer.from(key), Buffer.from([0, 0]), zlib.deflateSync(Buffer.from(value))]));

function makePng(width, height, pixel, extraChunks = []) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 3 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      raw.set([r, g, b], row + 1 + x * 3);
    }
  }
  const ihdr = Buffer.concat([u32(width), u32(height), Buffer.from([8, 2, 0, 0, 0])]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    ...extraChunks,
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- pcap writer ----------
const inetSum = buf => {
  let s = 0;
  for (let i = 0; i < buf.length; i += 2) s += (buf[i] << 8) | (buf[i + 1] ?? 0);
  while (s >> 16) s = (s & 0xffff) + (s >> 16);
  return (~s) & 0xffff;
};
const ipBytes = ip => Buffer.from(ip.split('.').map(Number));
const macBytes = mac => Buffer.from(mac.split(':').map(h => parseInt(h, 16)));

function ipv4(src, dst, proto, payload, id) {
  const h = Buffer.alloc(20);
  h[0] = 0x45; h.writeUInt16BE(20 + payload.length, 2); h.writeUInt16BE(id, 4);
  h.writeUInt16BE(0x4000, 6); h[8] = 64; h[9] = proto;
  ipBytes(src).copy(h, 12); ipBytes(dst).copy(h, 16);
  h.writeUInt16BE(inetSum(h), 10);
  return Buffer.concat([h, payload]);
}
function pseudoSum(src, dst, proto, seg) {
  const ph = Buffer.concat([ipBytes(src), ipBytes(dst), Buffer.from([0, proto]), Buffer.from([seg.length >> 8, seg.length & 0xff])]);
  return inetSum(Buffer.concat([ph, seg]));
}
function tcpSeg(src, dst, sp, dp, seq, ack, flags, data = Buffer.alloc(0)) {
  const h = Buffer.alloc(20);
  h.writeUInt16BE(sp, 0); h.writeUInt16BE(dp, 2); h.writeUInt32BE(seq >>> 0, 4); h.writeUInt32BE(ack >>> 0, 8);
  h[12] = 0x50; h[13] = flags; h.writeUInt16BE(64240, 14);
  const seg = Buffer.concat([h, data]);
  seg.writeUInt16BE(pseudoSum(src, dst, 6, seg), 16);
  return seg;
}
function udpSeg(src, dst, sp, dp, data) {
  const h = Buffer.alloc(8);
  h.writeUInt16BE(sp, 0); h.writeUInt16BE(dp, 2); h.writeUInt16BE(8 + data.length, 4);
  const seg = Buffer.concat([h, data]);
  let sum = pseudoSum(src, dst, 17, seg);
  if (sum === 0) sum = 0xffff;
  seg.writeUInt16BE(sum, 6);
  return seg;
}

class Pcap {
  constructor(startSec) { this.packets = []; this.t = startSec; this.id = 0x1a2b; }
  frame(srcMac, dstMac, ipPacket, dtMs) {
    this.t += dtMs / 1000;
    const eth = Buffer.concat([macBytes(dstMac), macBytes(srcMac), Buffer.from([0x08, 0x00]), ipPacket]);
    this.packets.push({ t: this.t, eth });
  }
  toBuffer() {
    const gh = Buffer.alloc(24);
    gh.writeUInt32LE(0xa1b2c3d4, 0); gh.writeUInt16LE(2, 4); gh.writeUInt16LE(4, 6);
    gh.writeUInt32LE(65535, 16); gh.writeUInt32LE(1, 20);
    const parts = [gh];
    for (const { t, eth } of this.packets) {
      const ph = Buffer.alloc(16);
      ph.writeUInt32LE(Math.floor(t), 0); ph.writeUInt32LE(Math.round((t % 1) * 1e6), 4);
      ph.writeUInt32LE(eth.length, 8); ph.writeUInt32LE(eth.length, 12);
      parts.push(ph, eth);
    }
    return Buffer.concat(parts);
  }
}

// ---------- individual challenges ----------
const rot13 = s => s.replace(/[a-z]/gi, c => {
  const base = c <= 'Z' ? 65 : 97;
  return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
});

function caesar() {
  const msg = `Note to self: the club wifi password is hunter2, and the secret flag is ${flagOf('caesar.txt')}.\nDo not tell anyone!\n`;
  return rot13(msg);
}

function mysteryBin() {
  const rand = rng(1337);
  const noise = n => Buffer.from(Array.from({ length: n }, () => Math.floor(rand() * 256)));
  return Buffer.concat([
    Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]),
    noise(700), Buffer.from('/lib64/ld-linux-x86-64.so.2\0'),
    noise(500), Buffer.from('admin_password_is_not_here\0'),
    noise(900), Buffer.from(`${flagOf('mystery.bin')}\0`),
    noise(600), Buffer.from('GCC: (Ubuntu 11.4.0-1ubuntu1~22.04) 11.4.0\0'),
    noise(400),
  ]);
}

function clubTripPng() {
  const px = (x, y) => {
    const sky = y / 200;
    const sun = Math.hypot(x - 230, y - 120) < 34;
    const hill = y > 150 + 14 * Math.sin(x / 28);
    if (sun) return [255, 214, 102];
    if (hill) return [24, 60 + (x % 40), 48];
    return [Math.round(40 + 190 * sky), Math.round(60 + 80 * sky), Math.round(130 - 40 * sky)];
  };
  return makePng(320, 200, px, [
    textChunk('Software', 'CipherArena Camera 1.0'),
    textChunk('Author', 'club_photographer'),
    textChunk('Title', 'Club trip 2026 - Lonavala'),
    textChunk('Comment', `You found it: ${flagOf('club_trip.png')}`),
  ]);
}

const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
  M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...',
  8: '---..', 9: '----.',
};
function morse() {
  const inner = flagOf('transmission.txt').slice(3, -1);               // DOTS_AND_DASHES_4EVER
  const words = inner.split('_').map(w => [...w].map(c => MORSE[c]).join(' '));
  return [
    '--- INCOMING TRANSMISSION ---',
    words.join(' / '),
    '--- END ---',
    '',
    'Operator note: wrap the decoded text as CA{...} and join the words with underscores.',
    '',
  ].join('\n');
}

function onion() {
  let s = flagOf('onion.txt');
  for (let i = 0; i < 20; i++) s = Buffer.from(s).toString('base64');
  return s + '\n';
}

function brokenPng() {
  const good = makePng(160, 100, (x, y) => [(x * 255 / 160) | 0, 40, (y * 255 / 100) | 0],
    [ztxtChunk('Comment', `Repaired! ${flagOf('broken.png')}`), textChunk('Title', 'Damaged upload')]);
  good.fill(0, 0, 4);        // wipe the 4 bytes "\x89PNG" of the signature
  return good;
}

function vigenere(text, key) {
  let k = 0;
  return text.replace(/[a-z]/gi, c => {
    const base = c <= 'Z' ? 65 : 97;
    const shift = key.charCodeAt(k++ % key.length) - 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + shift) % 26) + base);
  });
}
function vault() {
  return vigenere(`The vault code is ${flagOf('vault.txt')}. Memorise it and burn this note after reading.\n`, 'cipherarena');
}

function capture() {
  const pc = new Pcap(1789200000);
  const C = { ip: '192.168.56.101', mac: '08:00:27:4b:1c:9e', port: 49812 };
  const S = { ip: '192.168.56.10', mac: '08:00:27:a1:77:02', port: 21 };
  let cSeq = 0x3c1a9e10, sSeq = 0x7f20b4d0;
  const send = (from, flags, text = '', dt = 3) => {
    const data = Buffer.from(text);
    const [a, b] = from === 'c' ? [C, S] : [S, C];
    const seq = from === 'c' ? cSeq : sSeq, ack = from === 'c' ? sSeq : cSeq;
    pc.id++;
    pc.frame(a.mac, b.mac, ipv4(a.ip, b.ip, 6, tcpSeg(a.ip, b.ip, a.port, b.port, seq, ack, flags, data), pc.id), dt);
    const adv = data.length + (flags & 0x03 ? 1 : 0);          // SYN/FIN consume one sequence number
    if (from === 'c') cSeq += adv; else sSeq += adv;
  };
  const SYN = 0x02, ACK = 0x10, PSHACK = 0x18, FINACK = 0x11;
  send('c', SYN, '', 0); send('s', SYN | ACK, '', 1); send('c', ACK, '', 1);
  const chat = [
    ['s', '220 (vsFTPd 3.0.3)\r\n'],
    ['c', 'USER student\r\n'], ['s', '331 Please specify the password.\r\n'],
    ['c', 'PASS letmein123\r\n'], ['s', '530 Login incorrect.\r\n'],
    ['c', 'USER student\r\n'], ['s', '331 Please specify the password.\r\n'],
    ['c', `PASS ${flagOf('capture.pcap')}\r\n`], ['s', '230 Login successful.\r\n'],
    ['c', 'SYST\r\n'], ['s', '215 UNIX Type: L8\r\n'],
    ['c', 'QUIT\r\n'], ['s', '221 Goodbye.\r\n'],
  ];
  chat.forEach(([who, text], i) => { send(who, PSHACK, text, 20 + i * 7); send(who === 'c' ? 's' : 'c', ACK, '', 1); });
  send('c', FINACK, '', 5); send('s', FINACK, '', 1); send('c', ACK, '', 1);
  return pc.toBuffer();
}

const MARKER = ['​', '‌'];
function announcement() {
  const bits = [...Buffer.from(flagOf('announcement.txt'))].map(b => b.toString(2).padStart(8, '0')).join('');
  const hidden = [...bits].map(b => MARKER[+b]).join('');
  return [
    `Hello CipherArena members!${hidden}`,
    '',
    'This Friday the club meets at 5 PM in Lab 3 for the monthly practice session.',
    'Bring your laptops. Snacks are on the committee.',
    '',
    'See you there,',
    'The CipherArena team',
    '',
  ].join('\n');
}

const bigSqrt = n => {
  if (n < 2n) return n;
  let x = 1n << BigInt((n.toString(2).length + 1) >> 1);
  for (;;) { const y = (x + n / x) >> 1n; if (y >= x) return x; x = y; }
};
function rsa() {
  const p = crypto.generatePrimeSync(256, { bigint: true });
  let q = p + 2n * BigInt(crypto.randomInt(50, 400));
  while (!crypto.checkPrimeSync(q)) q += 2n;
  const n = p * q, e = 65537n;
  const m = BigInt('0x' + Buffer.from(flagOf('rsa.txt')).toString('hex'));
  let result = 1n, base = m % n, exp = e;                       // c = m^e mod n
  while (exp > 0n) { if (exp & 1n) result = (result * base) % n; base = (base * base) % n; exp >>= 1n; }
  return `# RSA challenge\nn = ${n}\ne = ${e}\nc = ${result}\n\n# flag = the plaintext message m, decoded from big-endian bytes\n`;
}

function ghostPng() {
  const W = 256, H = 128;
  const bits = [...Buffer.concat([Buffer.from(flagOf('ghost.png')), Buffer.from([0])])]
    .flatMap(b => b.toString(2).padStart(8, '0').split('').map(Number));
  const rand = rng(77);
  return makePng(W, H, (x, y) => {
    const i = y * W + x;
    let r = Math.round(30 + 160 * (x / W) + rand() * 6);
    const g = Math.round(40 + 150 * (y / H) + rand() * 6);
    const b = Math.round(200 - 120 * (x / W) + rand() * 6);
    if (i < bits.length) r = (r & ~1) | bits[i];
    return [Math.min(255, r), Math.min(255, g), Math.min(255, b)];
  }, [textChunk('Title', 'gradient')]);
}

function dnsQuery(name, id) {
  const labels = name.split('.').map(l => Buffer.concat([Buffer.from([l.length]), Buffer.from(l)]));
  const head = Buffer.alloc(12);
  head.writeUInt16BE(id, 0); head.writeUInt16BE(0x0100, 2); head.writeUInt16BE(1, 4);
  return Buffer.concat([head, ...labels, Buffer.from([0, 0, 1, 0, 1])]);   // type A, class IN
}
function exfil() {
  const pc = new Pcap(1789300000);
  const C = { ip: '10.0.0.15', mac: '3c:22:fb:0a:91:44' }, R = { ip: '10.0.0.1', mac: '00:1a:2b:3c:4d:5e' };
  const hex = Buffer.from(flagOf('exfil.pcap')).toString('hex');
  const chunks = hex.match(/.{1,16}/g).map((h, i) => `s${String(i).padStart(2, '0')}-${h}.t.corp-sync.net`);
  const noise = ['www.google.com', 'github.com', 'pypi.org', 'ocsp.digicert.com', 'cdn.jsdelivr.net', 'mail.college.edu', 'update.microsoft.com'];
  const order = [...chunks.keys()].sort((a, b) => ((a * 7 + 3) % chunks.length) - ((b * 7 + 3) % chunks.length)); // out of order
  const names = [];
  noise.forEach((n, i) => { names.push(n); if (order[i] !== undefined) names.push(chunks[order[i]]); });
  chunks.forEach((_, i) => { if (i >= noise.length) names.push(chunks[order[i]]); });
  let id = 0x4100;
  names.forEach(name => {
    id++; pc.id++;
    pc.frame(C.mac, R.mac, ipv4(C.ip, R.ip, 17, udpSeg(C.ip, R.ip, 40000 + (id % 2000), 53, dnsQuery(name, id)), pc.id), 150 + (id % 7) * 40);
  });
  return pc.toBuffer();
}

// --- python crackmes. The answers are never written in the scripts, only the scrambled targets.
function reverseMe() {
  const KEY = [0x13, 0x37, 0x42, 0x99, 0x5a];
  const flag = Buffer.from(flagOf('reverse_me.py'));
  const target = [...flag].map((c, i) => ((c ^ KEY[i % KEY.length]) + i * 7) & 0xff);
  return `#!/usr/bin/env python3
# CipherArena - Reverse Me
# Enter the licence key. Only the right one is accepted.
import sys

KEY = ${JSON.stringify(KEY)}
TARGET = ${JSON.stringify(target)}


def scramble(text):
    out = []
    for i, ch in enumerate(text.encode()):
        out.append(((ch ^ KEY[i % len(KEY)]) + i * 7) & 0xFF)
    return out


def main():
    guess = input("Licence key: ").strip()
    if scramble(guess) == TARGET:
        print("Access granted. Submit your key as the flag.")
    else:
        print("Access denied.")
        sys.exit(1)


if __name__ == "__main__":
    main()
`;
}

function rotorLock() {
  const rand = rng(2026);
  const sbox = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [sbox[i], sbox[j]] = [sbox[j], sbox[i]]; }
  const flag = Buffer.from(flagOf('rotor_lock.py'));
  const target = [];
  let state = 0xa7;
  flag.forEach((ch, i) => {
    const out = sbox[(ch ^ state) & 0xff];
    target.push(out);
    state = (state * 31 + out + i) & 0xff;
  });
  const fmt = arr => arr.map((_, i) => (i % 16 ? null : arr.slice(i, i + 16).join(', '))).filter(Boolean).join(',\n    ');
  return `#!/usr/bin/env python3
# CipherArena - Rotor Lock licence checker
SBOX = [
    ${fmt(sbox)}
]
TARGET = [${target.join(', ')}]


def check(key):
    data = key.encode()
    if len(data) != len(TARGET):
        return False
    state = 0xA7
    for i, ch in enumerate(data):
        out = SBOX[(ch ^ state) & 0xFF]
        if out != TARGET[i]:
            return False
        state = (state * 31 + out + i) & 0xFF
    return True


if __name__ == "__main__":
    print("Licence OK - submit it as the flag." if check(input("Licence: ").strip()) else "Invalid licence.")
`;
}

const builders = {
  'caesar.txt': caesar, 'mystery.bin': mysteryBin, 'club_trip.png': clubTripPng, 'transmission.txt': morse,
  'onion.txt': onion, 'broken.png': brokenPng, 'vault.txt': vault, 'capture.pcap': capture, 'reverse_me.py': reverseMe,
  'announcement.txt': announcement, 'rsa.txt': rsa, 'ghost.png': ghostPng, 'exfil.pcap': exfil, 'rotor_lock.py': rotorLock,
};

if (require.main === module) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const { file } of catalog) {
    const build = builders[file];
    if (!build) throw new Error(`no builder for ${file}`);
    const data = build();
    fs.writeFileSync(path.join(OUT, file), data);
    console.log(`  ${file.padEnd(20)} ${Buffer.byteLength(data)} bytes`);
  }
  console.log(`Wrote ${catalog.length} files to ${OUT}`);
}

module.exports = { OUT, vigenere, MARKER };
