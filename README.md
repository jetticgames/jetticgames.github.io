<div align="center">
<img width="707" height="353" alt="The_worlds_most_advanced_unblocked_games_website__1_-removebg-preview" src="https://github.com/user-attachments/assets/0aeebfff-fd11-4366-ad35-44e1e4dab410" />

# Jettic Games - Advanced Dynamic Gaming Platform

## Self-hosted rebuild (v3)

This repo now ships with a local Express backend instead of the previous Cloudflare Worker setup. The frontend is still the same layout/theme but the logic has been rebuilt for stability.

**Quick start (local):**
1) `cd backend && npm install`
2) `npm start`
3) Open http://localhost:3000 — the backend serves the frontend files, API, proxy, auth, favorites, friends, and profile endpoints.

Key changes:
- Express API with file-based storage (`backend/data`) for users, favorites, friends, and config
- Built-in CORS, rate limiting, JWT cookie auth, and basic proxy endpoint
- Frontend rewritten to hit the new API, with local auth modal, favorites, friends, profile editing, search, categories, and proxy toggle


### A modern, responsive gaming platform with a fully-powered backend and real-time content delivery

---

## 🚀 New Features (v2.0)

### Dynamic Backend Integration
- **API-Driven Content**: All games, configuration, and settings served from Cloudflare Workers backend
- **Real-Time Updates**: Automatic version checking and update notifications
- **Remote Maintenance**: Backend-controlled maintenance mode with instant propagation
- **Dynamic Thumbnails**: All game thumbnails served through optimized backend API
- **Configuration Management**: All app settings managed remotely via backend
- **Version Control**: Sophisticated version management with automatic update prompts
- **Backend Asset Serving**: All frontend assets (CSS, JS, images, JSON) served from backend for instant updates

### Enhanced Architecture
- **Full-Stack Solution**: Complete frontend + backend integration
- **Edge Computing**: Cloudflare Workers for global performance
- **KV Storage**: Persistent configuration and rate limiting
- **API-First Design**: RESTful API architecture
- **Caching Strategy**: Optimized caching at multiple levels
- **Error Handling**: Comprehensive error handling and fallbacks
- **Instant Updates**: No cache clearing required - updates propagate immediately

## 🏗️ Architecture Overview

```
Jettic Games v2.0 Architecture
├── Frontend (Static SPA)
│   ├── Dynamic content loading from backend APIs
│   ├── Real-time configuration updates
│   ├── Automatic version checking
│   └── Fallback to local data if backend unavailable
├── Backend (Cloudflare Workers)
│   ├── /api/games - Game database API
│   ├── /api/config - Configuration API
│   ├── /api/version - Version management API
│   ├── /api/maintenance - Maintenance mode API
│   ├── /api/thumbnails/* - Legacy thumbnail serving API
│   ├── /api/assets/* - Universal asset serving API (CSS, JS, images, JSON)
│   ├── /api/stats - Statistics API
│   └── /proxy?url= - Enhanced proxy service
└── Infrastructure
    ├── KV Storage for configuration persistence
    ├── Rate limiting with KV-based tracking
    ├── Global edge distribution
    ├── Backend asset serving (instant updates without cache clearing)
    └── Automatic scaling
```

## 📁 Project Structure

```
Jettic/
├── frontend/                 # Enhanced SPA with backend integration
│   ├── index.html            # Main application shell
│   ├── app.js               # Core app with backend API integration
│   ├── styles.css           # Enhanced styling with new features
│   ├── games.json           # Fallback games data
│   └── sw.js                # Service worker for offline support
├── backend/                  # Complete Cloudflare Workers backend
│   ├── worker.js            # Full API + proxy worker
│   ├── wrangler.toml        # Enhanced worker configuration
│   ├── package.json         # Backend dependencies and scripts
│   └── README-API.md        # Complete API documentation
└── README.md                # This enhanced documentation
```

## 🎮 Enhanced Features

### Dynamic Content Management
- **Real-Time Game Updates**: Games added/modified on backend appear instantly
- **Configuration Sync**: All settings synchronized from backend
- **Maintenance Mode**: Remotely controlled maintenance with custom messages
- **Version Management**: Automatic update detection and user prompts
- **Thumbnail Optimization**: CDN-delivered thumbnails with caching

### Backend-Powered Features
- **API-Driven Data**: All content served from robust backend APIs
- **Global Performance**: Edge computing for minimal latency worldwide
- **Automatic Scaling**: Handles traffic spikes automatically
- **Persistent Storage**: Configuration stored in Cloudflare KV
- **Rate Limiting**: Advanced IP-based request throttling
- **Health Monitoring**: Comprehensive health checks and monitoring

### Enhanced User Experience
- **Faster Loading**: Optimized API responses with caching
- **Real-Time Updates**: Backend changes appear without page refresh
- **Better Error Handling**: Graceful degradation with fallback options
- **Update Notifications**: Non-intrusive update prompts
- **Maintenance Notices**: Professional maintenance mode with custom messaging

## 🛠️ Setup Instructions

### Backend Deployment (Required First)

1. **Prerequisites**:
   ```bash
   # Install Wrangler CLI
   npm install -g wrangler
   
   # Login to Cloudflare
   wrangler login
   ```

2. **Setup Backend**:
   ```bash
   cd backend/
   npm install
   
   # Create KV namespaces
   npm run kv:create
   npm run kv:create:preview
   ```

3. **Configure**:
   Update `backend/wrangler.toml` with your KV namespace IDs

4. **Deploy Backend**:
   ```bash
   # Deploy to production
   npm run deploy:production
   
   # Get your worker URL
   # Example: https://jettic-backend.your-subdomain.workers.dev
   ```

### Frontend Configuration

1. **Update Backend URL**:
   In `frontend/app.js`, update:
   ```javascript
   const BACKEND_URL = 'https://your-worker.workers.dev';
   ```

2. **Deploy Frontend**:
   ```bash
   # Any static hosting service
   cd frontend/
   # Upload to Netlify, Vercel, GitHub Pages, etc.
   ```

### Advanced Configuration

#### Custom Domain Setup
1. **Configure Routes** in `backend/wrangler.toml`:
   ```toml
   [env.production]
   routes = [
     { pattern = "yourdomain.com/api/*", zone_name = "yourdomain.com" },
     { pattern = "yourdomain.com/proxy/*", zone_name = "yourdomain.com" }
   ]
   ```

2. **Update Frontend**:
   ```javascript
   const BACKEND_URL = 'https://yourdomain.com';
   ```

## 🔧 Configuration Management

### Backend Configuration
All configuration is now managed through the backend API:

```javascript
// Example configuration object
{
  "version": "2.0.0",
  "maintenanceMode": {
    "enabled": false,
    "message": "Custom maintenance message",
    "estimatedTime": "Estimated time"
  },
  "settings": {
    "defaultProxy": false,
    "accentColor": "#58a6ff",
    "particlesEnabled": true,
    // ... other settings
  },
  "features": {
    "auth0Enabled": true,
    "searchEnabled": true,
    "favoritesEnabled": true
  }
}
```

### Remote Maintenance Mode
```bash
# Enable maintenance mode
curl -X PUT -H 'Content-Type: application/json' \
  -d '{"enabled":true,"message":"Custom message"}' \
  https://your-worker.workers.dev/api/maintenance

# Disable maintenance mode
curl -X PUT -H 'Content-Type: application/json' \
  -d '{"enabled":false}' \
  https://your-worker.workers.dev/api/maintenance
```

## 📊 API Endpoints

### Core APIs
- `GET /api/games` - Dynamic games database
- `GET /api/config` - Application configuration
- `GET /api/version?client=1.0.0` - Version checking
- `GET /api/maintenance` - Maintenance status
- `PUT /api/maintenance` - Update maintenance (admin)
- `GET /api/thumbnails/{filename}` - Game thumbnails
- `GET /api/stats` - Application statistics

### Proxy Service
- `GET /proxy?url=TARGET_URL` - Enhanced CORS proxy

### Monitoring
- `GET /health` - Health check endpoint

## 🚀 Performance Improvements

### Caching Strategy
- **Games API**: 1 hour cache
- **Configuration**: 30 minutes cache
- **Thumbnails**: 24 hours cache
- **Version Check**: 5 minutes cache

### Global Distribution
- **Edge Locations**: 200+ worldwide
- **Cold Start**: <5ms typical
- **Request Processing**: <10ms average
- **Automatic Scaling**: Handles traffic spikes

## 🔒 Security Features

### Enhanced Security
- **IP-based Rate Limiting**: 100 requests/minute/IP
- **Input Validation**: Comprehensive validation
- **CORS Protection**: Advanced CORS handling
- **Header Security**: Safe header management
- **XSS Protection**: Input sanitization

### Monitoring & Logging
- **Real-time Logs**: `wrangler tail`
- **Error Tracking**: Comprehensive error logging
- **Performance Metrics**: Built-in analytics
- **Health Monitoring**: Automated health checks

## 🔄 Update Management

### Automatic Updates
1. Backend detects version mismatches
2. Shows non-intrusive update notification
3. Users can update immediately or later
4. Graceful handling of version differences

### Update Process
1. Update backend version
2. Deploy backend: `npm run deploy:production`
3. Update frontend version
4. Deploy frontend
5. Users automatically notified of updates

## 📈 Benefits of v2.0

### For Users
- **Faster Performance**: Edge computing + caching
- **Real-Time Updates**: No waiting for deployments
- **Better Reliability**: Fallback mechanisms
- **Smoother Experience**: Optimized loading and updates

### For Administrators
- **Remote Control**: Manage everything from backend
- **Easy Deployment**: Simple update process
- **Monitoring**: Comprehensive logging and analytics
- **Scalability**: Automatic scaling with demand
- **Cost Effective**: Serverless pricing model

## 🚨 Migration from v1.0

### Automatic Fallbacks
- Frontend automatically falls back to local data if backend unavailable
- Existing functionality preserved during migration
- No breaking changes for end users

### Migration Steps
1. Deploy backend first
2. Update frontend configuration
3. Test thoroughly
4. Switch DNS/routing
5. Monitor performance

## 📄 License

MIT License - Feel free to use this code for your own projects with proper attribution.

---

**Jettic Games v2.0** - The most advanced unblocked gaming platform with full-stack architecture. 🌊🎮
</div>