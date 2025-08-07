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
