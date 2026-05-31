import Redis from 'ioredis';
import logger from './winston.js';
import { captureException } from './sentry.js';

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
const redisPassword = process.env.REDIS_PASSWORD || null;

const redisConfig = {
  host: redisHost,
  port: redisPort,
  password: redisPassword,
  maxRetriesPerRequest: null, // Critical requirement for BullMQ
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    logger.warn(`[Redis] Connection lost. Attempting retry #${times} in ${delay}ms...`);
    return delay;
  }
};

let redisClient;

const getRedisClient = () => {
  if (!redisClient) {
    try {
      redisClient = new Redis(redisConfig);

      redisClient.on('connect', () => {
        logger.info(`[Redis] Connected to server at redis://${redisHost}:${redisPort}`);
      });

      redisClient.on('error', (err) => {
        logger.error(`[Redis] Error connection state: ${err.message}`);
        captureException(err, { tags: { component: 'redis' } });
      });

      redisClient.on('ready', () => {
        logger.info('[Redis] Client is ready for command operations.');
      });

    } catch (error) {
      logger.error(`[Redis] Initialization crash: ${error.message}`);
      captureException(error, { tags: { component: 'redis-init' } });
    }
  }
  return redisClient;
};

export { getRedisClient, redisConfig };
export default getRedisClient;
