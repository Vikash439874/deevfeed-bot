import mongoose from 'mongoose';

const sourceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['rss', 'scraper'],
    default: 'rss'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

const Source = mongoose.model('Source', sourceSchema);
export default Source;