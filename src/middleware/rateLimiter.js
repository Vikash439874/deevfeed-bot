import rateLimit from 'express-rate-limit';
import logger from '../utils/loggerWrapper.js';

// rate limiter for auth / login endpoints to prevent brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 authentication requests per windowMs
  message: {
    error: 'Too many authentication attempts from this IP, please try again after 15 minutes.'
  },
  handler: (req, res, next, options) => {
    logger.warn(`[Security Alert] Auth rate limit exceeded for IP: ${req.ip} on URL: ${req.originalUrl}`);
    res.status(options.statusCode).send(options.message);
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// general api limiter to guard bot configuration adjustments
const apiLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // Limit each IP to 100 API control requests per windowMs
  message: {
    error: 'Too many configuration requests from this IP. Please try again later.'
  },
  handler: (req, res, next, options) => {
    logger.warn(`[Security Alert] API rate limit exceeded for IP: ${req.ip} on URL: ${req.originalUrl}`);
    res.status(options.statusCode).send(options.message);
  },
  standardHeaders: true,
  legacyHeaders: false
});

export { authLimiter, apiLimiter };
