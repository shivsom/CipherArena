require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const Challenge = require('./models/Challenge');
const User = require('./models/User');
const Submission = require('./models/Submission');

const { syncChallenges } = require('./challenges/sync');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([Challenge.deleteMany({}), User.deleteMany({}), Submission.deleteMany({})]);
  await syncChallenges();
  const docs = await Challenge.find({ active: true });
  const byTitle = t => docs.find(d => d.title === t)._id;
  const players = [
    { username: 'aarav', email: 'aarav@bvcoe.edu.in', team: 'Root_Access', solved: ['Packet Sniffer', 'Base64 Onion', "Caesar's Secret"] },
    { username: 'isha', email: 'isha@terna.ac.in', team: 'ByteBandits', solved: ['Strings Attached', "Caesar's Secret"] },
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
