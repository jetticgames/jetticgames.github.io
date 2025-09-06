# WaterWall Backend API

A complete backend API for the WaterWall gaming platform powered by Cloudflare Workers. This backend provides dynamic content delivery, maintenance mode management, version checking, and proxy services.

## 🚀 Features

### Core API Endpoints
- **Games API** - Serve game data dynamically
- **Configuration API** - Provide application settings and features
- **Version API** - Handle version checking and update notifications
- **Maintenance API** - Manage maintenance mode remotely
- **Thumbnails API** - Serve game thumbnails with caching
- **Stats API** - Provide application statistics
- **Proxy API** - CORS-enabled proxy for game content

### Advanced Features
- **KV Storage Integration** - Persistent configuration and rate limiting
- **Rate Limiting** - IP-based request throttling
- **Caching** - Optimized response caching
- **Error Handling** - Comprehensive error responses
- **CORS Support** - Full cross-origin resource sharing
- **Version Management** - Automatic update detection

## 📋 API Documentation

### Base URL
```
https://your-worker.workers.dev
```

### Endpoints

#### Games API
```http
GET /api/games
```
Returns the complete games database.

**Response:**
```json
[
  {
    "id": 1,
    "title": "Cookie Clicker",
    "description": "Click a cookie. Earn cookies...",
    "category": "puzzle",
    "embed": "https://example.com/game",
    "thumbnail": "/api/thumbnails/game.jpg"
  }
]
```

#### Configuration API
```http
GET /api/config
```
Returns application configuration including settings and features.

**Response:**
```json
{
  "version": "2.0.0",
  "maintenanceMode": {
    "enabled": false,
    "message": "Under maintenance...",
    "estimatedTime": "Check back soon"
  },
  "settings": {
    "defaultProxy": false,
    "accentColor": "#58a6ff",
    "particlesEnabled": true
  },
  "features": {
    "auth0Enabled": true,
    "searchEnabled": true
  }
}
```

#### Version API
```http
GET /api/version?client=1.0.0
```
Check for application updates.

**Parameters:**
- `client` (optional) - Current client version

**Response:**
```json
{
  "server": "2.0.0",
  "client": "1.0.0",
  "needsUpdate": true,
  "updateMessage": "New version available!",
  "releaseNotes": ["Feature 1", "Feature 2"]
}
```

#### Maintenance API
```http
GET /api/maintenance
```
Get current maintenance status.

```http
PUT /api/maintenance
Content-Type: application/json

{
  "enabled": true,
  "message": "Custom maintenance message",
  "estimatedTime": "2 hours"
}
```
Update maintenance status (admin endpoint).

#### Thumbnails API
```http
GET /api/thumbnails/{filename}
```
Serve game thumbnails with caching.

#### Stats API
```http
GET /api/stats
```
Get application statistics.

**Response:**
```json
{
  "totalGames": 5,
  "categories": ["puzzle", "arcade", "strategy"],
  "categoryCount": 3,
  "serverVersion": "2.0.0",
  "gamesByCategory": {
    "puzzle": 2,
    "arcade": 2,
    "strategy": 1
  }
}
```

#### Proxy API
```http
GET /proxy?url=https://example.com/game
```
Proxy requests to bypass CORS restrictions.

#### Health Check
```http
GET /health
```
Basic health check endpoint.

## 🛠️ Setup and Deployment

### Prerequisites
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed
- Cloudflare account

### 1. Install Dependencies
```bash
cd backend/
npm install
```

### 2. Configure Wrangler
Update `wrangler.toml` with your account details:
```toml
name = "waterwall-backend"
account_id = "your-account-id"
```

### 3. Create KV Namespaces
```bash
# Create KV namespaces for configuration and rate limiting
npm run kv:create
npm run kv:create:preview
```

Update `wrangler.toml` with the generated KV namespace IDs.

### 4. Deploy
```bash
# Development deployment
npm run dev

# Production deployment
npm run deploy:production
```

### 5. Update Frontend Configuration
Update the `BACKEND_URL` in `frontend/app.js`:
```javascript
const BACKEND_URL = 'https://your-worker.workers.dev';
```

## 🔧 Configuration

### Environment Variables
Set in `wrangler.toml`:
```toml
[vars]
ENVIRONMENT = "production"
APP_VERSION = "2.0.0"
```

### KV Namespaces
Required KV namespaces:
- `CONFIG_KV` - Application configuration storage
- `RATE_LIMIT_KV` - Rate limiting data

### Custom Domains
Configure custom domains in Cloudflare Dashboard:
```toml
[env.production]
routes = [
  { pattern = "yourdomain.com/api/*", zone_name = "yourdomain.com" },
  { pattern = "yourdomain.com/proxy/*", zone_name = "yourdomain.com" }
]
```

## 🔒 Security Features

### Rate Limiting
- IP-based rate limiting
- 100 requests per minute per IP
- Configurable limits via KV storage

### CORS Protection
- Comprehensive CORS headers
- Safe header filtering
- Origin validation

### Input Validation
- URL validation for proxy requests
- JSON validation for API inputs
- XSS protection

## 📊 Monitoring

### Available Scripts
```bash
# View logs
npm run logs

# Production logs
npm run logs:production

# Development mode with debugging
npm run dev

# Remote development
npm run dev:remote
```

### Maintenance Commands
```bash
# Enable maintenance mode
npm run maintenance:enable

# Disable maintenance mode
npm run maintenance:disable
```

## 🚨 Troubleshooting

### Common Issues

1. **KV Namespace Errors**
   - Ensure KV namespaces are created and configured
   - Check namespace IDs in `wrangler.toml`

2. **CORS Issues**
   - Verify origin headers
   - Check proxy configuration

3. **Rate Limiting**
   - Check IP detection headers
   - Verify KV namespace permissions

4. **Deployment Failures**
   - Verify account permissions
   - Check wrangler authentication

### Debug Mode
Enable detailed logging:
```bash
wrangler dev --local --debug
```

## 📈 Performance

### Caching Strategy
- Games: 1 hour cache
- Config: 30 minutes cache
- Thumbnails: 24 hours cache
- Version check: 5 minutes cache

### Optimization
- Compressed responses
- Efficient KV operations
- Minimal cold start time
- Edge computing benefits

## 🔄 Update Process

1. Update version in `package.json` and worker code
2. Deploy to staging: `npm run deploy:staging`
3. Test thoroughly
4. Deploy to production: `npm run deploy:production`
5. Monitor logs for issues

## 📄 License

MIT License - See LICENSE file for details.

---

**WaterWall Backend** - Powering the next generation of unblocked gaming. 🌊🎮
