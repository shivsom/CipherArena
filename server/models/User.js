const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true, minlength: 3 },
    email: { type: String, required: true, unique: true, lowercase: true, match: /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/ },
    team: { type: String, required: true, match: /^[A-Za-z][A-Za-z0-9_]{2,19}$/ },
    password: { type: String, required: true, minlength: 8, select: false },
    score: { type: Number, default: 0 },
    solved: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Challenge' }],
    premium: { type: Boolean, default: false },
    premiumSince: Date,
    premium: { type: Boolean, default: false },
    premiumSince: Date,
  },
  { timestamps: true }
);

// hash the password before it is stored
userSchema.pre('save', async function () {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 10);
});
userSchema.methods.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
