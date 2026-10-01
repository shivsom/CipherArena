require('dotenv').config({ quiet: true });
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Challenge = require('./models/Challenge');
const User = require('./models/User');
const Submission = require('./models/Submission');

const sha256 = t => crypto.createHash('sha256').update(t).digest('hex');
const challenges = [
  { title: 'Cookie Monster', category: 'Web', points: 100, description: 'The admin panel trusts a cookie a little too much.', flagHash: sha256('CA{c00k13s_ar3_n0t_s3cur3}') },
  { title: "Caesar's Secret", category: 'Crypto', points: 100, description: 'PN{e0g13_1f_a0g_rapelcg10a}', flagHash: sha256('CA{r0t13_1s_n0t_encrypt10n}') },
  { title: 'Hidden in Plain Sight', category: 'Forensics', points: 150, description: 'A photo from the club trip hides more than memories.', flagHash: sha256('CA{exif_t3lls_all}') },
  { title: 'Base64 Onion', category: 'Crypto', points: 200, description: 'Twenty layers of Base64. Keep peeling.', flagHash: sha256('CA{p33l_th3_0n10n}') },
  { title: 'SQL Injection 101', category: 'Web', points: 250, description: "Log in as admin without the password.", flagHash: sha256('CA{un10n_s3l3ct_m4st3r}') },
  { title: 'Packet Sniffer', category: 'Forensics', points: 300, description: 'An FTP login captured in a pcap file.', flagHash: sha256('CA{wir3shark_w1zard}') },
  { title: 'Reverse Me', category: 'Reverse', points: 400, description: 'A crackme that XORs your input.', flagHash: sha256('CA{xor_1s_r3v3rs1bl3}') },
  { title: 'Stack Smasher', category: 'Pwn', points: 500, description: 'Overflow the buffer, call win().', flagHash: sha256('CA{sm4sh_th3_st4ck}') },
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([Challenge.deleteMany({}), User.deleteMany({}), Submission.deleteMany({})]);
  const docs = await Challenge.insertMany(challenges);
  const byTitle = t => docs.find(d => d.title === t)._id;
  const players = [
    { username: 'aarav', email: 'aarav@bvcoe.edu.in', team: 'Root_Access', solved: ['SQL Injection 101', 'Base64 Onion', 'Cookie Monster'] },
    { username: 'isha', email: 'isha@terna.ac.in', team: 'ByteBandits', solved: ['Cookie Monster', "Caesar's Secret"] },
    { username: 'rohan', email: 'rohan@rait.edu.in', team: 'Kernel_Panic', solved: ['Hidden in Plain Sight'] },
  ];
  for (const p of players) {
    const solved = p.solved.map(byTitle);
    const score = docs.filter(d => p.solved.includes(d.title)).reduce((s, d) => s + d.points, 0);
    await User.create({ ...p, password: 'Player@2026', solved, score });
  }
  // keep the solve counter of every challenge in sync with the seeded players
  for (const d of docs) {
    await Challenge.updateOne({ _id: d._id }, { solves: players.filter(p => p.solved.includes(d.title)).length });
  }
  console.log(`Seeded ${docs.length} challenges and ${players.length} players`);
  await mongoose.disconnect();
})();
