import Parser from 'rss-parser';
import Source from '../models/Source.js';
import Article from '../models/Article.js';

const parser = new Parser();

export const fetchRSSFeeds = async () => {
  try {
    console.log('🤖 Starting automated RSS feed check...');
    
    // 1. Get all active RSS sources from the database
    const activeSources = await Source.find({ isActive: true, type: 'rss' });
    
    if (activeSources.length === 0) {
      console.log('ℹ️ No active RSS sources found in the database.');
      return;
    }

    let totalNewArticles = 0;

    // 2. Loop through each website source link
    for (const source of activeSources) {
      try {
        console.log(`📡 Fetching items from: ${source.name} (${source.url})`);
        const feed = await parser.parseURL(source.url);

        // 3. Process each article entry inside the feed
        for (const item of feed.items) {
          // Check if article already exists in database using unique link
          const sourceExists = await Article.findOne({ link: item.link });
          
          if (!sourceExists) {
            const newArticle = new Article({
              title: item.title,
              link: item.link,
              description: item.contentSnippet || item.summary || '',
              pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
              sourceId: source._id
            });

            await newArticle.save();
            totalNewArticles++;
          }
        }
      } catch (sourceError) {
        console.error(`❌ Error parsing source "${source.name}":`, sourceError.message);
      }
    }

    console.log(`✅ Sync complete. Discovered and saved (${totalNewArticles}) new articles!`);
  } catch (globalError) {
    console.error('❌ Critical error inside the Scraper Service engine:', globalError.message);
  }
};