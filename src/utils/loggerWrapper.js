import logger from '../config/winston.js';
import BotLog from '../models/BotLog.js';
import mongoose from 'mongoose';

const writeLog = async (level, message, metadata = {}) => {
  // 1. Output to Winston (stdout/json)
  logger.log(level, message, metadata);

  // 2. Persist to MongoDB if connection is ready, preventing boot cycles from crashing
  if (mongoose.connection.readyState === 1) {
    try {
      await BotLog.create({
        level,
        message,
        metadata
      });
    } catch (err) {
      // Direct console error to prevent infinite recursion
      console.error(`[Logger Wrapper Error] Failed writing log to MongoDB: ${err.message}`);
    }
  }
};

const sysLogger = {
  info: (message, metadata) => writeLog('info', message, metadata),
  warn: (message, metadata) => writeLog('warn', message, metadata),
  error: (message, metadata) => writeLog('error', message, metadata),
  debug: (message, metadata) => writeLog('debug', message, metadata)
};

export default sysLogger;
export { sysLogger as logger };
