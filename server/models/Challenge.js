const mongoose = require('mongoose');

const challengeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, unique: true },
    category: { type: String, enum: ['Web', 'Crypto', 'Forensics', 'Reverse', 'OSINT', 'Pwn'], required: true },
    points: { type: Number, min: 50, max: 1000, required: true },
    description: String,
    hint: String,
    room: { type: String, enum: ['free', 'premium'], default: 'free' },
    fileName: String,                                          // file in server/challenge-files/, served after login
    active: { type: Boolean, default: true },                  // retired challenges are hidden, never deleted
    flagHash: { type: String, required: true, select: false }, // never sent to the client
    solves: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Challenge', challengeSchema);
