import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import logger from '../utils/loggerWrapper.js';

const generateToken = (id) => {
  return jwt.sign(
    { id }, 
    process.env.JWT_SECRET || 'super_secret_cyber_neon_key_replace_in_production', 
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Seed default admin if no user exists. Called automatically on application boot.
 */
const seedDefaultAdmin = async () => {
  try {
    const adminExists = await User.exists({ role: 'admin' });
    if (!adminExists) {
      const username = process.env.ADMIN_USERNAME || 'admin';
      const password = process.env.ADMIN_PASSWORD || 'adminpassword123';
      
      await User.create({
        username,
        password,
        role: 'admin'
      });
      
      logger.info(`[Auth Seed] Default admin seeded successfully. Username: "${username}"`);
    }
  } catch (error) {
    logger.error(`[Auth Seed] Error seeding default admin: ${error.message}`);
  }
};

/**
 * Handle Admin Login
 */
const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    if (!username || !password) {
      return res.status(400).json({ error: 'Please provide both username and password' });
    }

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      logger.warn(`[Auth Controller] Login failed for user "${username}" (User not found)`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      logger.warn(`[Auth Controller] Login failed for user "${username}" (Password incorrect)`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    logger.info(`[Auth Controller] Admin "${username}" successfully logged in.`);

    res.json({
      token: generateToken(user._id),
      user: {
        id: user._id,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    logger.error(`[Auth Controller] Login crash: ${error.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Check token validity and return active user profile
 */
const getMe = async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        username: req.user.username,
        role: req.user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export { login, getMe, seedDefaultAdmin };
