import axios from 'axios';
import Parser from 'rss-parser';
import FeedSource from '../models/FeedSource.js';
import Article from '../models/Article.js';
import logger from '../utils/loggerWrapper.js';
import { captureException } from '../config/sentry.js';

const parser = new Parser({
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'creator']
    ]
  }
});

/**
 * Service to fetch and parse RSS feeds with HTTP header optimizations.
 */
class FetcherService {
  /**
   * Fetches an RSS feed, checking for updates using ETag and Last-Modified headers.
   * @param {string} sourceId - The MongoDB ID of the FeedSource.
   * @returns {Promise<{status: string, items: Array}>} status: 'new' | 'not_modified' | 'error', and new items list
   */
  async fetchFeed(sourceId) {
    const source = await FeedSource.findById(sourceId);
    if (!source) {
      throw new Error(`FeedSource with ID ${sourceId} not found`);
    }

    if (!source.isActive) {
      logger.warn(`[Fetcher] Skipping inactive feed: ${source.name}`);
      return { status: 'inactive', items: [] };
    }

    const headers = {
      'User-Agent': 'DevFeed-Curation-Bot/1.0 (Enterprise News Curator; http://localhost:5000)'
    };

    if (source.eTag) {
      headers['If-None-Match'] = source.eTag;
    }
    if (source.lastModified) {
      headers['If-Modified-Since'] = source.lastModified;
    }

    try {
      logger.info(`[Fetcher] Requesting RSS: ${source.name} (${source.url})`, {
        eTag: source.eTag,
        lastModified: source.lastModified
      });

      const response = await axios.get(source.url, {
        headers,
        timeout: 10000,
        validateStatus: (status) => status === 200 || status === 304
      });

      if (response.status === 304) {
        logger.info(`[Fetcher] 304 Not Modified: ${source.name}. Skipping parsing.`);
        
        // Update last synced timestamp
        source.lastSyncedAt = new Date();
        await source.save();
        
        return { status: 'not_modified', items: [] };
      }

      // If we get 200, parse the XML feed body
      const xmlData = response.data;
      const feed = await parser.parseString(xmlData);
      
      // Update ETag and Last-Modified headers from response metadata
      const newETag = response.headers['etag'] || null;
      const newLastModified = response.headers['last-modified'] || null;

      source.eTag = newETag;
      source.lastModified = newLastModified;
      source.lastSyncedAt = new Date();
      await source.save();

      logger.info(`[Fetcher] Parsed ${feed.items?.length || 0} items from ${source.name}. Headers updated.`);

      // Filter duplicates based on unique URLs already recorded in MongoDB
      const newItems = [];
      for (const item of (feed.items || [])) {
        const itemUrl = (item.link || item.guid || '').trim();
        if (!itemUrl) continue;

        // Fast lookup in DB index
        const exists = await Article.exists({ originalUrl: itemUrl.toLowerCase() });
        if (!exists) {
          newItems.push({
            title: item.title || 'Untitled Article',
            originalUrl: itemUrl,
            originalContent: item.contentSnippet || item.content || item.summary || '',
            publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
            sourceName: source.name,
            feedCategory: source.category
          });
        }
      }

      logger.info(`[Fetcher] Found ${newItems.length} novel articles not in database.`);
      return { status: 'new', items: newItems };

    } catch (error) {
      logger.error(`[Fetcher] Failed to fetch feed ${source.name}: ${error.message}`, {
        url: source.url,
        stack: error.stack
      });
      captureException(error, {
        tags: { service: 'fetcher-service', feed: source.name },
        extra: { url: source.url }
      });
      return { status: 'error', items: [] };
    }
  }
}

export default new FetcherService();
export { FetcherService };
