const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const protect = require('../middleware/auth');

const sign = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '2h' });
const publicUser = (u) => ({ id: u._id, username: u.username, email: u.email, team: u.team, score: u.score, solved: u.solved, premium: !!u.premium });

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, email, team, password } = req.body;
  if (await User.exists({ email: (email || '').toLowerCase() })) {
    return res.status(409).json({ message: 'Email is already registered' });
  }
  const user = await User.create({ username, email, team, password });
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: (email || '').toLowerCase() }).select('+password');
  if (!user || !(await user.matchPassword(password || ''))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  res.json({ token: sign(user), user: publicUser(user) });
});

// GET /api/auth/me  (protected)
router.get('/me', protect, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) return res.status(401).json({ message: 'User no longer exists' });
  res.json(publicUser(user));
});

module.exports = router;
