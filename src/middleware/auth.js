import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import logger from '../utils/loggerWrapper.js';

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Get token from header: "Bearer <token>"
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_cyber_neon_key_replace_in_production');

      // Get user from the token (exclude password field)
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ error: 'Not authorized, user not found in database' });
      }

      return next();
    } catch (error) {
      logger.warn(`[Auth Middleware] JWT verification failed: ${error.message}`);
      return res.status(401).json({ error: 'Not authorized, token validation failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, missing auth token' });
  }
};

export { protect };
export default protect;
