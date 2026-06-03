import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

let redisHost = process.env.REDIS_HOST || '127.0.0.1';
let redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
let redisPassword = process.env.REDIS_PASSWORD || undefined;

// If a combined REDIS_URL is provided (common in Render/Upstash), parse it
if (process.env.REDIS_URL) {
  try {
    const parsedUrl = new URL(process.env.REDIS_URL);
    redisHost = parsedUrl.hostname;
    redisPort = parseInt(parsedUrl.port, 10) || 6379;
    if (parsedUrl.password) {
      redisPassword = parsedUrl.password;
    }
  } catch (err) {
    console.error('[Redis] Failed to parse REDIS_URL:', err.message);
  }
}

// Plain config object — required by BullMQ Queue and Worker constructors
const redisConfig = {
  host: redisHost,
  port: redisPort,
  ...(redisPassword ? { password: redisPassword } : {}),
  maxRetriesPerRequest: null, // CRITICAL: BullMQ requires this to be null
  enableReadyCheck: false,    // CRITICAL: BullMQ requires this to be false
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    console.warn(`[Redis] Reconnecting... attempt #${times}, waiting ${delay}ms`);
    return delay;
  }
};

// Shared ioredis client instance — used for health checks in /health route
let redisClient = null;

const getRedisClient = () => {
  if (!redisClient) {
    redisClient = new Redis(redisConfig);

    redisClient.on('connect', () => {
      console.log(`[Redis] ✅ Successfully connected to Memurai/Redis at ${redisHost}:${redisPort}`);
    });

    redisClient.on('ready', () => {
      console.log('[Redis] ✅ Client is ready and accepting commands.');
    });

    redisClient.on('error', (err) => {
      console.error(`[Redis] ❌ Connection Error: ${err.message}`);
      console.error('[Redis] Make sure Memurai is running. Check: Start Menu -> Memurai -> Start Service');
    });

    redisClient.on('close', () => {
      console.warn('[Redis] Connection closed. Retrying...');
    });
  }
  return redisClient;
};

export { redisConfig, getRedisClient };
export default getRedisClient;