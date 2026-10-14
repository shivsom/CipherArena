const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Challenge = require('../models/Challenge');
const catalog = require('./catalog');

const FILES_DIR = path.join(__dirname, '..', 'challenge-files');
const sha256 = t => crypto.createHash('sha256').update(t).digest('hex');

// Idempotent: upserts every catalog challenge (keeping solve counters) and hides challenges
// that are no longer in the catalog. Runs on every server start, so a deploy updates the DB by itself.
async function syncChallenges() {
  for (const c of catalog) {
    if (!fs.existsSync(path.join(FILES_DIR, c.file))) throw new Error(`missing challenge file ${c.file} – run npm run build:challenges`);
    await Challenge.updateOne(
      { title: c.title },
      {
        $set: {
          category: c.category, points: c.points, description: c.description, hint: c.hint,
          room: c.room, fileName: c.file, flagHash: sha256(c.flag), active: true,
        },
      },
      { upsert: true }
    );
  }
  const retired = await Challenge.updateMany(
    { title: { $nin: catalog.map(c => c.title) }, active: { $ne: false } },
    { $set: { active: false } }
  );
  return { total: catalog.length, retired: retired.modifiedCount };
}

module.exports = { syncChallenges, FILES_DIR, sha256 };
