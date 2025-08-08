const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

class TwitterScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async initialize() {
    if (!this.browser) {
      console.log('Launching browser...');
      this.browser = await puppeteer.launch({
        headless: 'new', // Use the new headless mode
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=site-per-process'
        ]
      });
      console.log('Browser launched successfully');
    }
    
    if (!this.page) {
      this.page = await this.browser.newPage();
      await this.page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
      await this.page.setViewport({ width: 1366, height: 768 });
      
      // Set longer timeouts
      this.page.setDefaultTimeout(70000);
      this.page.setDefaultNavigationTimeout(70000);
    }
  }

  async scrapeUserTweets(username, options = {}) {
    const {
      maxTweets = 100,
      includeReplies = false,
      includeRetweets = true,
      scrollDelay = 1000,
      maxScrolls = 100
    } = options;

    await this.initialize();

    try {
      // Navigate to user profile
      const profileUrl = includeReplies 
        ? `https://x.com/${username}/with_replies`
        : `https://x.com/${username}`;
      
      console.log(`Navigating to: ${profileUrl}`);
      
      // Navigate with retries
      let navigationSuccess = false;
      let retries = 3;
      
      while (!navigationSuccess && retries > 0) {
        try {
          await this.page.goto(profileUrl, { 
            waitUntil: 'networkidle2', 
            timeout: 30000 
          });
          navigationSuccess = true;
        } catch (navError) {
          console.log(`Navigation attempt failed, retries left: ${retries - 1}`);
          retries--;
          if (retries === 0) throw navError;
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      // Wait for tweets to load with better error handling
      try {
        await this.page.waitForSelector('article', { timeout: 20000 });
      } catch (waitError) {
        // Try alternative selectors
        try {
          await this.page.waitForSelector('[data-testid="tweet"]', { timeout: 10000 });
        } catch (altWaitError) {
          console.log('No tweets found, checking if profile exists...');
          const pageContent = await this.page.content();
          if (pageContent.includes('This account doesn\'t exist') || 
              pageContent.includes('Account suspended')) {
            throw new Error('User account not found or suspended');
          }
          throw new Error('Unable to load tweets - page may have changed structure');
        }
      }

      const tweets = new Set();
      const scraped = new Set();
      let scrollCount = 0;
      let noNewTweetsCount = 0;

      while (tweets.size < maxTweets && scrollCount < maxScrolls && noNewTweetsCount < 3) {
        const previousSize = tweets.size;

        // Extract tweets from current view
        const newTweets = await this.page.evaluate((includeRetweets, scrapedArray) => {
          const articles = document.querySelectorAll('article');
          const results = [];

          articles.forEach((article) => {
            try {
              // Get tweet text - try multiple selectors
              let textEl = article.querySelector('div[data-testid="tweetText"]');
              if (!textEl) {
                textEl = article.querySelector('[lang]');
              }
              if (!textEl) return;

              // Get username - try multiple selectors
              let userEl = article.querySelector('div[dir="ltr"] > span');
              if (!userEl) {
                userEl = article.querySelector('[data-testid="User-Name"] span');
              }
              if (!userEl) return;

              // Check if it's a retweet
              const isRetweet = article.querySelector('span[data-testid="socialContext"]')?.innerText?.includes('Retweeted') || false;
              if (!includeRetweets && isRetweet) return;

              // Get timestamp
              const timeEl = article.querySelector('time');
              const timestamp = timeEl ? timeEl.getAttribute('datetime') : null;

              // Get tweet URL/ID
              const linkEl = article.querySelector('a[href*="/status/"]');
              const tweetUrl = linkEl ? linkEl.getAttribute('href') : null;
              const tweetId = tweetUrl ? tweetUrl.split('/status/')[1]?.split('?')[0] : null;

              // Get engagement stats
              const statGroup = article.querySelector('div[role="group"]');
              let replies = 0, reposts = 0, likes = 0, views = 0;

              if (statGroup) {
                const statElements = statGroup.querySelectorAll('[aria-label]');
                statElements.forEach((el) => {
                  const label = el.getAttribute('aria-label')?.toLowerCase() || '';
                  const textContent = el.textContent?.replace(/,/g, '') || '0';
                  
                  // Extract number from text
                  const match = textContent.match(/(\d+(?:\.\d+)?)\s*([KkMm]?)/);
                  let value = 0;
                  
                  if (match) {
                    value = parseFloat(match[1]);
                    const suffix = match[2]?.toLowerCase();
                    if (suffix === 'k') value *= 1000;
                    else if (suffix === 'm') value *= 1000000;
                    value = Math.floor(value);
                  }

                  if (label.includes('reply') || label.includes('replies')) {
                    replies = value;
                  } else if (label.includes('repost') || label.includes('reposts')) {
                    reposts = value;
                  } else if (label.includes('like') || label.includes('likes')) {
                    likes = value;
                  } else if (label.includes('view') || label.includes('views')) {
                    views = value;
                  }
                });
              }

              // Get media info
              const mediaElements = article.querySelectorAll('img[src*="pbs.twimg.com"], video');
              const media = Array.from(mediaElements).map(el => {
                if (el.tagName === 'IMG') {
                  return { type: 'image', url: el.src };
                } else if (el.tagName === 'VIDEO') {
                  return { type: 'video', url: el.src || el.querySelector('source')?.src };
                }
              }).filter(Boolean);

              const text = textEl.innerText?.trim();
              const username = userEl.innerText?.trim().replace('@', '');

              if (text && username && tweetId) {
                const uniqueId = `${username}::${tweetId}`;
                
                if (!scrapedArray.includes(uniqueId)) {
                  results.push({
                    id: tweetId,
                    username,
                    text,
                    timestamp,
                    url: `https://x.com${tweetUrl}`,
                    isRetweet,
                    engagement: {
                      replies,
                      reposts,
                      likes,
                      views
                    },
                    media,
                    scrapedAt: new Date().toISOString()
                  });
                }
              }
            } catch (error) {
              console.log('Error extracting tweet:', error.message);
            }
          });

          return results;
        }, includeRetweets, Array.from(scraped));

        // Add new tweets to our collection
        newTweets.forEach(tweet => {
          const uniqueId = `${tweet.username}::${tweet.id}`;
          if (!scraped.has(uniqueId)) {
            scraped.add(uniqueId);
            tweets.add(tweet);
          }
        });

        console.log(`Scraped ${tweets.size} tweets so far...`);

        // Check if we got new tweets
        if (tweets.size === previousSize) {
          noNewTweetsCount++;
        } else {
          noNewTweetsCount = 0;
        }

        // Scroll down to load more tweets
        if (tweets.size < maxTweets && scrollCount < maxScrolls) {
          await this.page.evaluate(() => {
            window.scrollBy(0, window.innerHeight * 2);
          });
          
          await new Promise(resolve => setTimeout(resolve, scrollDelay));
          scrollCount++;
        }
      }

      console.log(`Finished scraping. Total tweets: ${tweets.size}`);
      return Array.from(tweets).slice(0, maxTweets);

    } catch (error) {
      console.error('Error scraping tweets:', error);
      throw new Error(`Failed to scrape tweets: ${error.message}`);
    }
  }

  async scrapeUserProfile(username) {
    await this.initialize();

    try {
      const profileUrl = `https://x.com/${username}`;
      console.log(`Scraping profile: ${profileUrl}`);
      
      await this.page.goto(profileUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // Wait for profile to load - try multiple selectors
      try {
        await this.page.waitForSelector('[data-testid="UserName"]', { timeout: 15000 });
      } catch (waitError) {
        // Try alternative selector
        await this.page.waitForSelector('h2[role="heading"]', { timeout: 10000 });
      }

      const profile = await this.page.evaluate(() => {
        try {
          // Try multiple selectors for display name
          let displayName = document.querySelector('[data-testid="UserName"] span')?.innerText;
          if (!displayName) {
            displayName = document.querySelector('h2[role="heading"] span')?.innerText;
          }

          const bio = document.querySelector('[data-testid="UserDescription"] span')?.innerText || '';
          const location = document.querySelector('[data-testid="UserLocation"] span')?.innerText || '';
          const website = document.querySelector('[data-testid="UserUrl"] a')?.href || '';
          const joinDate = document.querySelector('[data-testid="UserJoinDate"] span')?.innerText || '';
          
          // Get follower/following counts with better parsing
          const followStats = document.querySelectorAll('a[href*="/followers"], a[href*="/following"]');
          let followers = 0, following = 0;
          
          followStats.forEach(el => {
            const text = el.innerText || '';
            const numberMatch = text.match(/([\d.,KkMm]+)/);
            if (numberMatch) {
              let count = numberMatch[1].replace(/,/g, '').toLowerCase();
              let multiplier = 1;
              
              if (count.includes('k')) {
                multiplier = 1000;
                count = count.replace('k', '');
              } else if (count.includes('m')) {
                multiplier = 1000000;
                count = count.replace('m', '');
              }
              
              const finalCount = Math.floor(parseFloat(count) * multiplier);
              
              if (el.href.includes('/followers')) {
                followers = finalCount;
              } else if (el.href.includes('/following')) {
                following = finalCount;
              }
            }
          });

          // Get profile image
          const profileImage = document.querySelector('[data-testid="UserAvatar"] img')?.src || '';

          // Get banner image
          const bannerImage = document.querySelector('[data-testid="UserBannerImage"] img')?.src || '';

          // Check if verified - try multiple selectors
          const isVerified = !!(
            document.querySelector('[data-testid="UserName"] svg[aria-label*="Verified"]') ||
            document.querySelector('[aria-label*="Verified account"]') ||
            document.querySelector('svg[aria-label*="Verified"]')
          );

          return {
            displayName: displayName || '',
            bio,
            location,
            website,
            joinDate,
            followers,
            following,
            profileImage,
            bannerImage,
            isVerified,
            scrapedAt: new Date().toISOString()
          };
        } catch (error) {
          throw new Error(`Failed to extract profile data: ${error.message}`);
        }
      });

      return profile;
    } catch (error) {
      console.error('Error scraping profile:', error);
      throw new Error(`Failed to scrape profile: ${error.message}`);
    }
  }

  async close() {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Global scraper instance
const scraper = new TwitterScraper();

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Twitter Scraper API is running' });
});
//--------------------------
app.get('/api/user/:username/tweets', async (req, res) => {
  const { username } = req.params;
  const {
    maxTweets = 95,
    includeReplies = 'false',
    includeRetweets = 'false',
    scrollDelay = 2000,
    maxScrolls = 200
  } = req.query;

  try {
    console.log(`Starting tweet scrape for user: ${username}`);
    
    const tweets = await scraper.scrapeUserTweets(username, {
      maxTweets: parseInt(maxTweets),
      includeReplies: includeReplies === 'true',
      includeRetweets: includeRetweets === 'true',
      scrollDelay: parseInt(scrollDelay),
      maxScrolls: parseInt(maxScrolls)
    });

    res.json({
      success: true,
      username,
      totalTweets: tweets.length,
      tweets,
      scrapedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error(`Error scraping tweets for ${username}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      username
    });
  }
});


//----------------------------------------------- needed above

app.get('/api/user/:username/profile', async (req, res) => {
  const { username } = req.params;

  try {
    console.log(`Starting profile scrape for user: ${username}`);
    
    const profile = await scraper.scrapeUserProfile(username);

    res.json({
      success: true,
      username,
      profile,
      scrapedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error(`Error scraping profile for ${username}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      username
    });
  }
});

app.get('/api/user/:username/complete', async (req, res) => {
  const { username } = req.params;
  const {
    maxTweets = 20,
    includeReplies = 'false',
    includeRetweets = 'true'
  } = req.query;

  try {
    console.log(`Starting complete scrape for user: ${username}`);
    
    const [profile, tweets] = await Promise.all([
      scraper.scrapeUserProfile(username),
      scraper.scrapeUserTweets(username, {
        maxTweets: parseInt(maxTweets),
        includeReplies: includeReplies === 'true',
        includeRetweets: includeRetweets === 'true'
      })
    ]);

    res.json({
      success: true,
      username,
      profile,
      tweets,
      totalTweets: tweets.length,
      scrapedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error(`Error scraping complete data for ${username}:`, error);
    res.status(500).json({
      success: false,
      error: error.message,
      username
    });
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await scraper.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await scraper.close();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Twitter Scraper API is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Example: http://localhost:${PORT}/api/user/Star_Knight12/tweets?maxTweets=10`);
});