import mongoose from 'mongoose';
import logger from './winston.js';
import { captureException } from './sentry.js';

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/devfeed-bot';
  
  const options = {
    maxPoolSize: 10,                 // Up to 10 parallel socket connections
    serverSelectionTimeoutMS: 5000,  // Timeout after 5s trying to connect
    socketTimeoutMS: 45000,          // Close inactive sockets after 45s
    family: 4                        // Force IPv4
  };

  try {
    mongoose.connection.on('connecting', () => {
      logger.info('[Database] MongoDB initiating connection...');
    });

    mongoose.connection.on('connected', () => {
      logger.info('[Database] MongoDB connected successfully to replica/instance.');
    });

    mongoose.connection.on('disconnecting', () => {
      logger.warn('[Database] MongoDB disconnecting...');
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('[Database] MongoDB disconnected.');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('[Database] MongoDB reconnected successfully.');
    });

    mongoose.connection.on('error', (err) => {
      logger.error(`[Database] MongoDB internal error: ${err.message}`);
      captureException(err, { tags: { component: 'mongodb' } });
    });

    const conn = await mongoose.connect(uri, options);

    // Drop legacy index if it exists to prevent duplicate key errors on renamed 'link' field
    try {
      const db = conn.connection.db;
      const collections = await db.listCollections({ name: 'articles' }).toArray();
      if (collections.length > 0) {
        const indexes = await db.collection('articles').indexes();
        const hasLinkIndex = indexes.some(idx => idx.name === 'link_1');
        if (hasLinkIndex) {
          logger.info('[Database] Found legacy "link_1" index on articles collection. Dropping index...');
          await db.collection('articles').dropIndex('link_1');
          logger.info('[Database] Successfully dropped legacy "link_1" index.');
        }
      }
    } catch (indexError) {
      logger.warn(`[Database] Failed to drop legacy index: ${indexError.message}`);
    }

    return conn;
  } catch (error) {
    logger.error(`[Database] Initial MongoDB connection crash: ${error.message}`);
    captureException(error, { tags: { component: 'mongodb-init' } });
    process.exit(1);
  }
};

export default connectDB;