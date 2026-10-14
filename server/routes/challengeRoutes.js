const router = require('express').Router();
const crypto = require('node:crypto');
const path = require('node:path');
const Challenge = require('../models/Challenge');
const Submission = require('../models/Submission');
const User = require('../models/User');
const protect = require('../middleware/auth');
const { FILES_DIR } = require('../challenges/sync');

const isLocked = (challenge, user) => challenge.room === 'premium' && !user.premium;

// shape sent to the browser – never includes flagHash or the stored file name
function present(c, user, solved) {
  const locked = isLocked(c, user);
  return {
    _id: c._id, title: c.title, category: c.category, points: c.points, room: c.room, solves: c.solves,
    solved: solved.has(String(c._id)), locked,
    hasFile: !!c.fileName,
    description: locked ? 'Unlock the Premium Vault to read this challenge and download its files.' : c.description,
    hint: locked ? undefined : c.hint,
  };
}

// light brute-force guard: at most 10 wrong flags per user per minute
const misses = new Map();
function recentMisses(userId) {
  const now = Date.now();
  const recent = (misses.get(userId) || []).filter(t => now - t < 60_000);
  misses.set(userId, recent);
  return recent;
}

// GET /api/challenges – every active challenge, premium ones come back locked unless the player owns the room
router.get('/', protect, async (req, res) => {
  const [challenges, user] = await Promise.all([
    Challenge.find({ active: true }).sort({ points: 1 }).lean(),
    User.findById(req.userId).lean(),
  ]);
  if (!user) return res.status(401).json({ message: 'User no longer exists' });
  const solved = new Set(user.solved.map(String));
  res.json(challenges.map(c => present(c, user, solved)));
});

// GET /api/challenges/:id/download – the challenge file (login required, premium files need the Premium Vault)
router.get('/:id/download', protect, async (req, res) => {
  const [challenge, user] = await Promise.all([Challenge.findById(req.params.id).lean(), User.findById(req.userId).lean()]);
  if (!challenge || !challenge.active || !challenge.fileName) return res.status(404).json({ message: 'No file for this challenge' });
  if (isLocked(challenge, user)) return res.status(402).json({ message: 'Unlock the Premium Vault to download this file' });
  // fileName comes from our own catalog; basename() keeps it inside the folder regardless
  const name = path.basename(challenge.fileName);
  res.download(name, name, { root: FILES_DIR });
});

// POST /api/challenges/:id/submit  { flag }
router.post('/:id/submit', protect, async (req, res) => {
  const challenge = await Challenge.findById(req.params.id).select('+flagHash');
  if (!challenge || !challenge.active) return res.status(404).json({ message: 'Challenge not found' });

  const user = await User.findById(req.userId);
  if (isLocked(challenge, user)) return res.status(402).json({ message: 'Unlock the Premium Vault to play this challenge' });
  if (user.solved.some(id => id.equals(challenge._id))) {
    return res.status(409).json({ message: 'You already solved this challenge' });
  }
  const recent = recentMisses(String(user._id));
  if (recent.length >= 10) {
    return res.status(429).json({ message: 'Too many wrong attempts – wait a minute and try again' });
  }

  const hash = crypto.createHash('sha256').update(String(req.body.flag || '').trim()).digest('hex');
  const correct = hash === challenge.flagHash;
  await Submission.create({ user: user._id, challenge: challenge._id, correct });

  if (!correct) {
    recent.push(Date.now());
    return res.status(400).json({ correct, message: 'Incorrect flag – try again' });
  }

  user.solved.push(challenge._id);
  user.score += challenge.points;
  await user.save();
  await Challenge.updateOne({ _id: challenge._id }, { $inc: { solves: 1 } });
  res.json({ correct, message: `Correct! +${challenge.points} points`, score: user.score });
});

module.exports = router;
