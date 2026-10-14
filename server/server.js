require('dotenv').config({ quiet: true });
const path = require('node:path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const { syncChallenges } = require('./challenges/sync');

const isProd = process.env.NODE_ENV === 'production';
const app = express();

app.set('trust proxy', 1);                            // Render / Vercel sit behind a proxy
if (process.env.CLIENT_URL) app.use(cors({ origin: process.env.CLIENT_URL }));
// Razorpay webhook needs the raw body for signature checking, so it is mounted before express.json()
const premium = require('./routes/premiumRoutes');
app.post('/api/premium/webhook', express.raw({ type: '*/*' }), premium.webhook);
app.use(express.json());
app.use(morgan(isProd ? 'tiny' : 'dev'));

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/challenges', require('./routes/challengeRoutes'));
app.use('/api/leaderboard', require('./routes/leaderboardRoutes'));
app.use('/api/premium', premium);

// health check used by the hosting platform before it routes traffic to a new deploy
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    env: process.env.NODE_ENV || 'development',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: Math.round(process.uptime()),
  });
});
app.use('/api', (req, res) => res.status(404).json({ message: `No API route ${req.method} ${req.originalUrl}` }));

// ---- production: the same Express service also serves the React build ----
if (isProd) {
  const dist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(dist, { maxAge: '1y', index: false }));      // hashed JS/CSS files
  app.get(/^\/(?!api).*/, (req, res) => res.sendFile(path.join(dist, 'index.html'))); // SPA routes
}

// Mongoose validation errors → 400, anything else → 500
app.use((err, req, res, next) => {
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: Object.values(err.errors).map(e => `${e.path} is invalid`).join(', ') });
  }
  console.error(err);
  res.status(500).json({ message: 'Server error' });
});

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    const synced = await syncChallenges();
    console.log(`Challenges synced: ${synced.total} active, ${synced.retired} retired`);
    console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
    app.listen(PORT, () => console.log(`CipherArena (${process.env.NODE_ENV || 'development'}) running on port ${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
