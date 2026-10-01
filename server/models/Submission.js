const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    challenge: { type: mongoose.Schema.Types.ObjectId, ref: 'Challenge', required: true },
    correct: Boolean,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Submission', submissionSchema);
