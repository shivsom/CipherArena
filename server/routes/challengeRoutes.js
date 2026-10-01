const router = require('express').Router();
const crypto = require('node:crypto');
const Challenge = require('../models/Challenge');
const Submission = require('../models/Submission');
const User = require('../models/User');
const protect = require('../middleware/auth');

// GET /api/challenges – list with a "solved" flag for the logged-in user
router.get('/', protect, async (req, res) => {
  const [challenges, user] = await Promise.all([
    Challenge.find().sort({ points: 1 }).lean(),
    User.findById(req.userId).lean(),
  ]);
  const solved = new Set(user.solved.map(String));
  res.json(challenges.map(c => ({ ...c, solved: solved.has(String(c._id)) })));
});

// POST /api/challenges/:id/submit  { flag }
router.post('/:id/submit', protect, async (req, res) => {
  const challenge = await Challenge.findById(req.params.id).select('+flagHash');
  if (!challenge) return res.status(404).json({ message: 'Challenge not found' });

  const user = await User.findById(req.userId);
  if (user.solved.some(id => id.equals(challenge._id))) {
    return res.status(409).json({ message: 'You already solved this challenge' });
  }

  const hash = crypto.createHash('sha256').update(String(req.body.flag || '').trim()).digest('hex');
  const correct = hash === challenge.flagHash;
  await Submission.create({ user: user._id, challenge: challenge._id, correct });

  if (!correct) return res.status(400).json({ correct, message: 'Incorrect flag – try again' });

  user.solved.push(challenge._id);
  user.score += challenge.points;
  await user.save();
  await Challenge.updateOne({ _id: challenge._id }, { $inc: { solves: 1 } });
  res.json({ correct, message: `Correct! +${challenge.points} points`, score: user.score });
});

module.exports = router;
