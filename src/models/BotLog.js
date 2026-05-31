import mongoose from 'mongoose';

const botLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  level: {
    type: String,
    enum: ['info', 'warn', 'error', 'debug'],
    required: true,
    index: true
  },
  message: {
    type: String,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: false // We use custom timestamp field
});

// Automatically clean up logs older than 7 days using MongoDB TTL index
botLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

const BotLog = mongoose.model('BotLog', botLogSchema);
export default BotLog;
