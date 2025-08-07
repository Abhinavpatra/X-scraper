# Twitter User Tweet Scraper API

A robust Node.js API for scraping Twitter user profiles and tweets without using the official Twitter API. Built with Puppeteer for reliable browser automation and Express for RESTful endpoints.

## ⚠️ Important Disclaimer

This tool is for educational and research purposes only. Please ensure you comply with:
- Twitter's Terms of Service
- Applicable laws and regulations in your jurisdiction
- Respect for user privacy and data protection laws (GDPR, CCPA, etc.)
- Rate limiting to avoid overwhelming Twitter's servers

## 🚀 Features

- **User Profile Scraping**: Extract complete profile information including bio, follower counts, and verification status
- **Tweet Extraction**: Scrape tweets with full engagement metrics (likes, retweets, replies, views)
- **Flexible Options**: Include/exclude replies and retweets, customizable limits
- **Media Detection**: Extract images and videos from tweets
- **Rate Limiting**: Built-in protection against abuse
- **RESTful API**: Clean, easy-to-use endpoints
- **Error Handling**: Comprehensive error handling and logging

## 📋 Prerequisites

- Node.js (version 16 or higher)
- Chrome/Chromium browser (installed automatically with Puppeteer)

## 🛠️ Installation

1. **Clone or create the project**:
```bash
mkdir x-scraper
cd x-scraper-api
```

2. **Install dependencies**:
```bash
npm install
```

3. **Start the server**:
```bash
# Production
npm start

# Development (with auto-restart)
npm run dev
```

The API will be available at `http://localhost:3000`

## 🎯 API Endpoints

### Health Check
```
GET /api/health
```
Returns API status.

**Response:**
```json
{
  "status": "OK",
  "message": "Twitter Scraper API is running"
}
```

### Get User Tweets
```
GET /api/user/:username/tweets
```

**Parameters:**
- `username` (required): Twitter username without @
- `maxTweets` (optional, default: 50): Maximum number of tweets to scrape
- `includeReplies` (optional, default: false): Include user's replies
- `includeRetweets` (optional, default: true): Include retweets
- `scrollDelay` (optional, default: 2000): Delay between scrolls in milliseconds
- `maxScrolls` (optional, default: 10): Maximum number of scroll attempts

**Example:**
```bash
curl "http://localhost:3000/api/user/elonmusk/tweets?maxTweets=10&includeReplies=false"
```

**Response:**
```json
{
  "success": true,
  "username": "elonmusk",
  "totalTweets": 10,
  "tweets": [
    {
      "id": "1234567890",
      "username": "elonmusk",
      "text": "Hello, world!",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "url": "https://twitter.com/elonmusk/status/1234567890",
      "isRetweet": false,
      "engagement": {
        "replies": 150,
        "reposts": 300,
        "likes": 1500,
        "views": 50000
      },
      "media": [
        {
          "type": "image",
          "url": "https://pbs.twimg.com/media/example.jpg"
        }
      ],
      "scrapedAt": "2024-01-15T11:00:00.000Z"
    }
  ],
  "scrapedAt": "2024-01-15T11:00:00.000Z"
}
```

### Get User Profile
```
GET /api/user/:username/profile
```

**Example:**
```bash
curl "http://localhost:3000/api/user/elonmusk/profile"
```

**Response:**
```json
{
  "success": true,
  "username": "elonmusk",
  "profile": {
    "displayName": "Elon Musk",
    "bio": "CEO of SpaceX and Tesla",
    "location": "Austin, Texas",
    "website": "https://tesla.com",
    "joinDate": "June 2009",
    "followers": 150000000,
    "following": 200,
    "profileImage": "https://pbs.twimg.com/profile_images/...",
    "bannerImage": "https://pbs.twimg.com/profile_banners/...",
    "isVerified": true,
    "scrapedAt": "2024-01-15T11:00:00.000Z"
  },
  "scrapedAt": "2024-01-15T11:00:00.000Z"
}
```

### Get Complete User Data
```
GET /api/user/:username/complete
```

Combines profile and tweets in a single request.

**Parameters:**
- `maxTweets` (optional, default: 20): Maximum number of tweets
- `includeReplies` (optional, default: false): Include replies
- `includeRetweets` (optional, default: true): Include retweets

**Example:**
```bash
curl "http://localhost:3000/api/user/elonmusk/complete?maxTweets=5"
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file:
```env
PORT=3000
NODE_ENV=production
```

### Rate Limiting

The API includes built-in rate limiting:
- 100 requests per 15 minutes per IP address
- Modify in `server.js` if needed

### Puppeteer Configuration

Browser settings can be adjusted in the `TwitterScraper` class constructor:
- Headless mode
- User agent
- Viewport size
- Chrome flags

## 🐳 Docker Deployment

**Dockerfile:**
```dockerfile
FROM node:18-slim

# Install Chrome dependencies
RUN apt-get update && apt-get install -y \
    chromium \
    --no-install-recommends && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
```

**Build and run:**
```bash
docker build -t twitter-scraper-api .
docker run -p 3000:3000 twitter-scraper-api
```

## 🚀 Production Deployment

### Using PM2 (Process Manager)

```bash
npm install -g pm2
pm2 start server.js --name twitter-scraper
pm2 startup
pm2 save
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## ⚡ Performance Tips

1. **Reuse Browser Instance**: The scraper reuses the same browser/page for multiple requests
2. **Adjust Delays**: Decrease `scrollDelay` for faster scraping (but higher detection risk)
3. **Limit Concurrent Requests**: Use rate limiting to prevent overwhelming the target site
4. **Error Handling**: Implement retry logic for failed requests
5. **Caching**: Consider caching results to reduce repeat scraping

## 🛡️ Anti-Detection Measures

The scraper includes several anti-detection features:
- Real browser user agent
- Human-like scrolling behavior
- Randomized delays
- Proper viewport settings
- Standard Chrome flags

## 📊 Usage Examples

### Python Client
```python
import requests

def get_user_tweets(username, max_tweets=10):
    url = f"http://localhost:3000/api/user/{username}/tweets"
    params = {"maxTweets": max_tweets}
    
    response = requests.get(url, params=params)
    return response.json()

# Usage
tweets = get_user_tweets("elonmusk", 5)
print(f"Found {tweets['totalTweets']} tweets")
```

### JavaScript Client
```javascript
async function getUserProfile(username) {
    const response = await fetch(`http://localhost:3000/api/user/${username}/profile`);
    const data = await response.json();
    return data;
}

// Usage
getUserProfile("elonmusk").then(profile => {
    console.log(`${profile.profile.displayName} has ${profile.profile.followers} followers`);
});
```

## 🔍 Troubleshooting

**Common Issues:**

1. **Browser Launch Failed**: Install Chrome/Chromium dependencies
2. **Timeout Errors**: Increase timeout values or check internet connection
3. **Rate Limiting**: Reduce request frequency or implement delays
4. **Empty Results**: User profile may be private or protected

**Debug Mode:**
Set `headless: false` in Puppeteer options to see browser actions.

## 📝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License. See the LICENSE file for details.

## ⚖️ Legal Notice

This tool is provided for educational purposes only. Users are responsible for ensuring their use complies with:
- Twitter's Terms of Service
- Applicable laws and regulations
- Ethical web scraping practices
- Respect for user privacy and data protection

Use responsibly and at your own risk.