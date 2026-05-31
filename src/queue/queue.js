import { Queue } from 'bullmq';
import { redisConfig } from '../config/redis.js';
import logger from '../utils/loggerWrapper.js';

// Setup shared queue options
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 5000 // Retry starting at 5s, then 10s, 20s...
  },
  removeOnComplete: { age: 3600 }, // clean up logs for completed jobs after 1 hour
  removeOnFail: { age: 86400 } // clean up logs for failed jobs after 24 hours
};

// 1. Queue for scraping the RSS XML feeds
const rssFetchQueue = new Queue('rss-fetch-queue', {
  connection: redisConfig,
  defaultJobOptions
});

// 2. Queue for parsing raw items with Gemini and publishing them
const aiProcessQueue = new Queue('ai-process-queue', {
  connection: redisConfig,
  defaultJobOptions: {
    ...defaultJobOptions,
    // Add rate limiter option to prevent overwhelming the Gemini API
    // (e.g. max 15 requests per minute from the worker)
    limiter: {
      max: 15,
      duration: 60000
    }
  }
});

logger.info('[Queue] BullMQ queues initialized (rss-fetch-queue, ai-process-queue).');

export { rssFetchQueue, aiProcessQueue };
