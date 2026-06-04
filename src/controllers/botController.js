import Article from '../models/Article.js';
import FeedSource from '../models/FeedSource.js';
import BotLog from '../models/BotLog.js';
import { rssFetchQueue } from '../queue/queue.js';
import publisherService from '../services/publisherService.js';
import logger from '../utils/loggerWrapper.js';
import { captureException } from '../config/sentry.js';

/**
 * Trigger manual background sync across all active RSS feeds.
 */
const triggerSync = async (req, res) => {
  try {
    const activeSources = await FeedSource.find({ isActive: true });
    
    if (activeSources.length === 0) {
      return res.status(400).json({ error: 'No active RSS feed sources available to sync.' });
    }

    logger.info(`[Bot Controller] Manual sync triggered by admin: ${req.user.username}. Queuing jobs...`);

    // Prepare Bulk BullMQ jobs
    const jobs = activeSources.map((source) => ({
      name: `sync-${source.name.substring(0, 20)}`,
      data: { sourceId: source._id.toString() },
      opts: {
        jobId: `fetch-source-${source._id}-${Date.now()}` // Bypass queue unique lock for immediate sync
      }
    }));

    await rssFetchQueue.addBulk(jobs);
    logger.info(`[Bot Controller] Successfully queued ${jobs.length} sync tasks inside BullMQ.`);

    res.json({
      message: 'Sync process triggered successfully. Jobs delegated to background workers.',
      sourcesCount: activeSources.length
    });

  } catch (error) {
    logger.error(`[Bot Controller] Failed to trigger manual sync: ${error.message}`);
    captureException(error, { tags: { controller: 'botController', action: 'triggerSync' } });
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

/**
 * Fetch stats for the dashboard counters & charts.
 */
const getStats = async (req, res) => {
  try {
    const [
      activeFeedsCount,
      totalArticles,
      publishedCount,
      failedCount,
      duplicateCount,
      pendingCount
    ] = await Promise.all([
      FeedSource.countDocuments({ isActive: true }),
      Article.countDocuments({}),
      Article.countDocuments({ status: 'published' }),
      Article.countDocuments({ status: 'failed' }),
      Article.countDocuments({ status: 'duplicate' }),
      Article.countDocuments({ status: 'pending' })
    ]);

    // Fetch daily curation trends for the charts (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const chartDataAggregation = await Article.aggregate([
      { $match: { createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Format chart values cleanly for Recharts (e.g. { date: '2026-05-29', published: 5, duplicates: 12 })
    const chartMap = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      chartMap[dateStr] = { date: dateStr, processed: 0, published: 0, duplicate: 0 };
    }

    chartDataAggregation.forEach((item) => {
      const date = item._id.date;
      const status = item._id.status;
      const count = item.count;

      if (chartMap[date]) {
        chartMap[date].processed += count;
        if (status === 'published') chartMap[date].published += count;
        if (status === 'duplicate') chartMap[date].duplicate += count;
      }
    });

    const chartData = Object.values(chartMap);

    res.json({
      activeFeedsCount,
      totalArticles,
      publishedCount,
      failedCount,
      duplicateCount,
      pendingCount,
      chartData,
      devfeedApiUrl: process.env.DEVFEED_API_URL || process.env.DEEVFEED_API_URL || 'http://localhost:3000/api/news',
      botSyncInterval: process.env.BOT_SYNC_INTERVAL || '*/15 * * * *'
    });

  } catch (error) {
    logger.error(`[Bot Controller] Failed to fetch stats: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Fetch logs list from database.
 */
const getLogs = async (req, res) => {
  const limit = parseInt(req.query.limit || '100', 10);
  try {
    const logs = await BotLog.find({})
      .sort({ timestamp: -1 })
      .limit(limit);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Fetch articles list.
 */
const getArticles = async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '20', 10);
  const status = req.query.status;
  const category = req.query.category;
  const search = req.query.search;

  const query = {};
  if (status) query.status = status;
  if (category) query.category = category;
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { sourceName: { $regex: search, $options: 'i' } }
    ];
  }

  try {
    const total = await Article.countDocuments(query);
    const articles = await Article.find(query)
      .sort({ publishedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('clusterId', 'title originalUrl'); // Resolve parent cluster title if duplicate

    res.json({
      articles,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Polish / Update parsed article manually (e.g. edit text, tag or publish status)
 */
const updateArticle = async (req, res) => {
  const { id } = req.params;
  const { title, summary, category, tags, status } = req.body;

  try {
    const article = await Article.findById(id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    if (title) article.title = title;
    if (summary) article.summary = summary;
    if (category) article.category = category;
    if (status) article.status = status;
    if (tags && Array.isArray(tags)) {
      article.tags = tags.map(name => ({ name, confidence: 1.0 }));
    }

    await article.save();
    logger.info(`[Bot Controller] Manual update by admin to article ID ${id}: "${article.title}"`);
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Manually force push a pending/failed article to DevFeed target API
 */
const forcePublishArticle = async (req, res) => {
  const { id } = req.params;

  try {
    const article = await Article.findById(id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }

    if (article.status === 'duplicate') {
      return res.status(400).json({ error: 'Cannot directly publish semantic duplicates. Force publish the master article instead.' });
    }

    logger.info(`[Bot Controller] Forced manual publication triggered for Article ID ${id} (${article.title})`);
    
    const result = await publisherService.publishArticle(article);
    if (result.success) {
      article.status = 'published';
      await article.save();
      return res.json({ message: 'Article published successfully', article });
    } else {
      article.status = 'failed';
      await article.save();
      return res.status(500).json({ error: 'Failed to publish article payload to target API', details: result.error });
    }

  } catch (error) {
    logger.error(`[Bot Controller] Error manually publishing article ${id}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};

export { triggerSync, getStats, getLogs, getArticles, updateArticle, forcePublishArticle };
