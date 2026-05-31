import * as Sentry from '@sentry/node';
import logger from './winston.js';

const initSentry = (app) => {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    logger.warn('[Sentry] SENTRY_DSN not configured. APM error tracking disabled.');
    return;
  }

  try {
    Sentry.init({
      dsn,
      integrations: [
        // Automatically instrument node modules and express routers
        ...Sentry.defaultIntegrations,
      ],
      tracesSampleRate: 1.0, // Adjust in production
      environment: process.env.NODE_ENV || 'development',
    });
    
    logger.info('[Sentry] Sentry initialized successfully.');
  } catch (error) {
    logger.error(`[Sentry] Sentry initialization failed: ${error.message}`);
  }
};

const captureException = (error, context = {}) => {
  logger.error(`[Sentry Alert] Exception captured: ${error.message}`, { error, ...context });
  if (process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      if (context.tags) {
        Object.entries(context.tags).forEach(([key, val]) => scope.setTag(key, val));
      }
      if (context.extra) {
        Object.entries(context.extra).forEach(([key, val]) => scope.setExtra(key, val));
      }
      Sentry.captureException(error);
    });
  }
};

export { initSentry, captureException };
export default Sentry;
