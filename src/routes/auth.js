import express from 'express';
import { login, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Route: POST /api/auth/login
// Protected by express-rate-limit (authLimiter)
router.post('/login', authLimiter, login);

// Route: GET /api/auth/me
// Protected by JWT validation middleware
router.get('/me', protect, getMe);

export default router;