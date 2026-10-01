const router = require('express').Router();
const User = require('../models/User');

// GET /api/leaderboard – public, computed with an aggregation pipeline
router.get('/', async (req, res) => {
  const rows = await User.aggregate([
    { $project: { username: 1, team: 1, score: 1, solves: { $size: '$solved' }, updatedAt: 1 } },
    { $sort: { score: -1, updatedAt: 1 } },
    { $limit: 10 },
  ]);
  res.json(rows.map((r, i) => ({ rank: i + 1, ...r })));
});

module.exports = router;
