import mongoose from 'mongoose';
import Source from './models/Source.js';

// 📡 Your project's explicit database connection string
// 📡 Direct, non-SRV network string format
const MONGO_URI = "mongodb://ac-gb7oacf-shard-00-00.jnva7z7.mongodb.net:27017,ac-gb7oacf-shard-00-01.jnva7z7.mongodb.net:27017,ac-gb7oacf-shard-00-02.jnva7z7.mongodb.net:27017/devfeed?ssl=true&replicaSet=atlas-m0w0m3-shard-0&authSource=admin&retryWrites=true&w=majority";

const initialSources = [
  {
    name: 'TechCrunch - Startups',
    url: 'https://techcrunch.com/category/startups/feed/',
    type: 'rss',
    isActive: true
  },
  {
    name: 'Dev.to - Latest Articles',
    url: 'https://dev.to/feed',
    type: 'rss',
    isActive: true
  },
  {
    name: 'The Verge - Tech News',
    url: 'https://www.theverge.com/rss/index.xml',
    type: 'rss',
    isActive: true
  }
];

const seedDatabase = async () => {
  try {
    console.log('🌱 Connecting to database for seeding...');
    // Connect directly using the string variable
    await mongoose.connect(MONGO_URI);
    console.log('📡 Connected successfully.');

    for (const source of initialSources) {
      const exists = await Source.findOne({ url: source.url });
      if (!exists) {
        await Source.create(source);
        console.log(`✅ Seeded source: ${source.name}`);
      } else {
        console.log(`ℹ️ Source already exists: ${source.name}`);
      }
    }

    console.log('🎉 Database seeding sequence complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
};

seedDatabase();