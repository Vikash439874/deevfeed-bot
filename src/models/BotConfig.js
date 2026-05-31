import mongoose from 'mongoose';

const botConfigSchema = new mongoose.Schema({
  botName: {
    type: String,
    required: true,
    default: "DevFeed AI Bot"
  },
  isActive: {
    type: Boolean,
    default: true
  },
  refreshRateMinutes: {
    type: Number,
    default: 15
  },
  targetChannels: {
    type: [String],
    default: ["general", "development"]
  }
}, {
  timestamps: true // Automatically creates 'createdAt' and 'updatedAt' fields
});

const BotConfig = mongoose.model('BotConfig', botConfigSchema);

export default BotConfig;