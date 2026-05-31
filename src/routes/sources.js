import express from 'express';
import { getSources, createSource, toggleSource, deleteSource } from '../controllers/sourceController.js';
import { protect } from '../middleware/auth.js';
import { apiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Apply auth protection & API limits to all source configuration routes
router.use(protect);
router.use(apiLimiter);

router.get('/', getSources);
router.post('/', createSource);
router.patch('/:id/toggle', toggleSource);
router.delete('/:id', deleteSource);

export default router;