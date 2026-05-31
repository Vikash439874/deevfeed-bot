import express from 'express';
import mongoose from 'mongoose';
import getRedisClient from '../config/redis.js';
import logger from '../utils/loggerWrapper.js';

const router = express.Router();

router.get('/', async (req, res) => {
  const healthInfo = {
    uptime: process.uptime(),
    timestamp: new Date(),
    status: 'healthy',
    services: {
      mongodb: 'offline',
      redis: 'offline'
    }
  };

  let statusCode = 200;

  // 1. Check MongoDB Health
  try {
    const mongoState = mongoose.connection.readyState;
    // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
    if (mongoState === 1) {
      const startTime = Date.now();
      await mongoose.connection.db.admin().ping();
      const latency = Date.now() - startTime;
      healthInfo.services.mongodb = `online (${latency}ms)`;
    } else {
      healthInfo.services.mongodb = `connecting/disconnected (state code: ${mongoState})`;
      healthInfo.status = 'degraded';
      statusCode = 500;
    }
  } catch (error) {
    logger.error(`[Health Check] MongoDB ping failed: ${error.message}`);
    healthInfo.services.mongodb = `error: ${error.message}`;
    healthInfo.status = 'unhealthy';
    statusCode = 500;
  }

  // 2. Check Redis Health
  try {
    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      const startTime = Date.now();
      const pingResponse = await redis.ping();
      const latency = Date.now() - startTime;
      if (pingResponse === 'PONG') {
        healthInfo.services.redis = `online (${latency}ms)`;
      } else {
        healthInfo.services.redis = `unexpected ping answer: ${pingResponse}`;
        healthInfo.status = 'degraded';
        statusCode = 500;
      }
    } else {
      healthInfo.services.redis = `offline (status: ${redis?.status || 'uninstantiated'})`;
      healthInfo.status = 'degraded';
      statusCode = 500;
    }
  } catch (error) {
    logger.error(`[Health Check] Redis ping failed: ${error.message}`);
    healthInfo.services.redis = `error: ${error.message}`;
    healthInfo.status = 'unhealthy';
    statusCode = 500;
  }

  res.status(statusCode).json(healthInfo);
});

export default router;
