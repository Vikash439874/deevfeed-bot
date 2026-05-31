import express from 'express';
import { 
  triggerSync, 
  getStats, 
  getLogs, 
  getArticles, 
  updateArticle, 
  forcePublishArticle 
} from '../controllers/botController.js';
import { protect } from '../middleware/auth.js';
import { apiLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Apply auth protection & API limits to all bot control routes
router.use(protect);
router.use(apiLimiter);

router.post('/sync', triggerSync);
router.get('/stats', getStats);
router.get('/logs', getLogs);
router.get('/articles', getArticles);
router.put('/articles/:id', updateArticle);
router.post('/articles/:id/publish', forcePublishArticle);

export default router;