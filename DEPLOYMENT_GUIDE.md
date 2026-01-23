# Jettic Games v2.0 Deployment Guide

Complete deployment guide for the Jettic Games dynamic gaming platform with full backend integration.

## 🏗️ Architecture Overview

Jettic Games v2.0 consists of two main components:
- **Frontend**: Static React-like SPA that consumes backend APIs
- **Backend**: Cloudflare Workers-based API server with KV storage

## 📋 Prerequisites

### Required Tools
- [Node.js](https://nodejs.org/) (v16 or later)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- [Git](https://git-scm.com/)

### Accounts Needed
- [Cloudflare Account](https://cloudflare.com) (free tier sufficient)
- Static hosting account (Netlify, Vercel, GitHub Pages, etc.)

### System Requirements
- Terminal/Command line access
- Modern web browser for testing
- Text editor for configuration

## 🚀 Quick Start Deployment

### Option A: Automated Setup (Recommended)

```bash
# Clone the repository
git clone https://github.com/Wilapsek/Jettic.git
cd Jettic

# Run the setup script
./deploy.sh
```

### Option B: Manual Deployment

Follow the detailed steps below for full control over the deployment process.

## 🔧 Backend Deployment

### Step 1: Cloudflare Setup

1. **Create Cloudflare Account**
   - Sign up at [cloudflare.com](https://cloudflare.com)
   - Verify your email address

2. **Install Wrangler CLI**
   ```bash
   npm install -g wrangler
   ```

3. **Authenticate with Cloudflare**
   ```bash
   wrangler login
   # Follow the browser authentication flow
   ```

### Step 2: Backend Configuration

1. **Navigate to Backend Directory**
   ```bash
   cd backend/
   npm install
   ```

2. **Create KV Namespaces**
   ```bash
   # Create production namespaces
   wrangler kv:namespace create CONFIG_KV
   wrangler kv:namespace create RATE_LIMIT_KV
   
   # Create preview namespaces
   wrangler kv:namespace create CONFIG_KV --preview
   wrangler kv:namespace create RATE_LIMIT_KV --preview
   ```

3. **Update Configuration**
   
   Edit `wrangler.toml` with your generated namespace IDs:
   ```toml
   name = "jettic-backend"
   main = "worker.js"
   compatibility_date = "2023-05-18"
   
   [[kv_namespaces]]
   binding = "CONFIG_KV"
   id = "your-config-namespace-id-here"
   preview_id = "your-config-preview-id-here"
   
   [[kv_namespaces]]
   binding = "RATE_LIMIT_KV"
   id = "your-ratelimit-namespace-id-here"
   preview_id = "your-ratelimit-preview-id-here"
   ```

### Step 3: Deploy Backend

1. **Test Locally (Optional)**
   ```bash
   wrangler dev
   # Test at http://localhost:8787
   ```

2. **Deploy to Production**
   ```bash
   npm run deploy:production
   ```

3. **Note Your Worker URL**
   ```
   Example: https://jettic-backend.your-subdomain.workers.dev
   ```

### Step 4: Verify Backend

```bash
# Test all endpoints
curl https://your-worker.workers.dev/health
curl https://your-worker.workers.dev/api/games
curl https://your-worker.workers.dev/api/config
curl https://your-worker.workers.dev/api/maintenance
```

## 🌐 Frontend Deployment

### Step 1: Configure Frontend

1. **Update Backend URL**
   
   Edit `frontend/app.js`:
   ```javascript
   const BACKEND_URL = 'https://your-worker.workers.dev';
   ```

2. **Test Locally (Optional)**
   ```bash
   cd frontend/
   # Using Python
   python -m http.server 8000
   # OR using Node.js
   npx serve .
   ```

### Step 2: Choose Hosting Platform

#### Option A: Netlify (Recommended)

1. **Drag and Drop Deployment**
   - Go to [netlify.com](https://netlify.com)
   - Drag the `frontend/` folder to the deploy area
   - Note your site URL

2. **Git-based Deployment**
   ```bash
   # Connect your GitHub repo to Netlify
   # Set build directory to: frontend
   # No build command needed (static files)
   ```

#### Option B: Vercel

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   cd frontend/
   vercel --prod
   ```

#### Option C: GitHub Pages

1. **Enable GitHub Pages**
   - Go to repository settings
   - Enable Pages from `/frontend` folder
   - Note your Pages URL

#### Option D: Firebase Hosting

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **Initialize and Deploy**
   ```bash
   firebase init hosting
   # Set public directory to: frontend
   firebase deploy
   ```

### Step 3: Verify Frontend

1. **Test Website**
   - Open your deployed frontend URL
   - Check browser console for successful backend connection
   - Verify games load properly

2. **Test Features**
   - Game loading and proxy functionality
   - Maintenance mode (enable via API, check frontend)
   - Version checking and update notifications

## 🔒 Production Configuration

### Security Headers

Update `netlify.toml` (or equivalent for your hosting):
```toml
[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Content-Security-Policy = "default-src 'self' https://your-worker.workers.dev; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline';"
```

### Environment Variables

Set up environment-specific configurations:

**Backend (`wrangler.toml`):**
```toml
[env.production.vars]
ENVIRONMENT = "production"
APP_VERSION = "2.0.0"

[env.staging.vars]
ENVIRONMENT = "staging"
APP_VERSION = "2.0.0-staging"
```

## 🌍 Custom Domain Setup

### Option 1: Separate Domains

**Frontend:** `gaming.yourdomain.com`  
**Backend:** `api.yourdomain.com`

1. **Configure Backend Domain**
   ```toml
   # In wrangler.toml
   [env.production]
   routes = [
     { pattern = "api.yourdomain.com/*", zone_name = "yourdomain.com" }
   ]
   ```

2. **Update Frontend Configuration**
   ```javascript
   const BACKEND_URL = 'https://api.yourdomain.com';
   ```

### Option 2: Single Domain with Path Routing

**Frontend:** `yourdomain.com/*`  
**Backend:** `yourdomain.com/api/*`

1. **Configure Backend Routes**
   ```toml
   [env.production]
   routes = [
     { pattern = "yourdomain.com/api/*", zone_name = "yourdomain.com" },
     { pattern = "yourdomain.com/proxy/*", zone_name = "yourdomain.com" }
   ]
   ```

2. **Update Frontend Configuration**
   ```javascript
   const BACKEND_URL = 'https://yourdomain.com';
   ```

3. **Optional: Use Netlify Proxy**
   ```toml
   # In netlify.toml
   [[redirects]]
     from = "/api/*"
     to = "https://your-worker.workers.dev/api/:splat"
     status = 200
     force = true
   ```

## 📊 Monitoring and Analytics

### Backend Monitoring

1. **Real-time Logs**
   ```bash
   wrangler tail --env production
   ```

2. **Cloudflare Dashboard**
   - Monitor request volume
   - Check error rates
   - View performance metrics

### Frontend Analytics

1. **Add Analytics (Optional)**
   ```html
   <!-- In index.html -->
   <script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
   ```

2. **Error Tracking**
   ```javascript
   // In app.js
   window.addEventListener('error', (e) => {
       console.error('Frontend error:', e.error);
       // Send to error tracking service
   });
   ```

## 🔄 CI/CD Setup

### GitHub Actions (Recommended)

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy Jettic Games

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Deploy Backend
        run: |
          cd backend
          npm install
          npx wrangler publish --env production
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

  deploy-frontend:
    runs-on: ubuntu-latest
    needs: deploy-backend
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Netlify
        uses: netlify/actions/cli@master
        with:
          args: deploy --dir=frontend --prod
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

### Manual Deployment Script

Create `deploy.sh`:
```bash
#!/bin/bash
set -e

echo "🚀 Deploying Jettic Games v2.0..."

# Deploy backend
echo "📡 Deploying backend..."
cd backend
npm install
npm run deploy:production
cd ..

# Deploy frontend
echo "🌐 Deploying frontend..."
cd frontend
# Add your frontend deployment commands here
# Example for Netlify CLI:
# netlify deploy --prod --dir=.

echo "✅ Deployment complete!"
echo "Backend: https://your-worker.workers.dev"
echo "Frontend: https://your-frontend-url.com"
```

## 🧪 Testing

### Backend Testing

```bash
# Test all API endpoints
curl -f https://your-worker.workers.dev/health || echo "Health check failed"
curl -f https://your-worker.workers.dev/api/games || echo "Games API failed"
curl -f https://your-worker.workers.dev/api/config || echo "Config API failed"

# Test maintenance mode
curl -X PUT -H 'Content-Type: application/json' \
  -d '{"enabled":true}' \
  https://your-worker.workers.dev/api/maintenance

curl https://your-worker.workers.dev/api/maintenance

curl -X PUT -H 'Content-Type: application/json' \
  -d '{"enabled":false}' \
  https://your-worker.workers.dev/api/maintenance
```

### Frontend Testing

1. **Automated Testing**
   ```bash
   # Test that frontend loads
   curl -f https://your-frontend-url.com

   # Test specific pages
   curl -f https://your-frontend-url.com/index.html
   ```

2. **Manual Testing Checklist**
   - [ ] Website loads without errors
   - [ ] Games grid populates from backend
   - [ ] Individual games load correctly
   - [ ] Proxy toggle works
   - [ ] Maintenance mode responds to API changes
   - [ ] Version checking works
   - [ ] Update notifications appear
   - [ ] All navigation functions correctly

## 🚨 Troubleshooting

### Common Issues

1. **Backend Not Accessible**
   ```bash
   # Check deployment status
   wrangler whoami
   wrangler list
   
   # Redeploy if needed
   wrangler publish --env production
   ```

2. **CORS Errors**
   - Verify backend includes proper CORS headers
   - Check browser network tab for specific errors
   - Test backend directly: `curl -v your-worker.workers.dev/api/games`

3. **KV Namespace Errors**
   ```bash
   # List and verify namespaces
   wrangler kv:namespace list
   
   # Recreate if needed
   wrangler kv:namespace create CONFIG_KV
   ```

4. **Frontend Not Loading Backend Data**
   - Check `BACKEND_URL` in app.js
   - Verify worker is deployed and accessible
   - Check browser console for error messages

### Debug Commands

```bash
# Backend debugging
wrangler tail --env production --debug
wrangler dev --local

# Test specific endpoints
curl -v https://your-worker.workers.dev/api/games
curl -H "Origin: https://your-frontend.com" https://your-worker.workers.dev/api/games

# Check KV data
wrangler kv:key list --binding=CONFIG_KV --env=production
```

## 📈 Performance Optimization

### Backend Optimization

1. **Caching Strategy**
   - Games API: 1 hour cache
   - Config API: 30 minutes cache
   - Thumbnails: 24 hours cache

2. **KV Storage Best Practices**
   - Use structured keys
   - Implement proper TTL values
   - Monitor storage usage

### Frontend Optimization

1. **Asset Optimization**
   ```bash
   # Minify JavaScript (optional)
   npx uglify-js frontend/app.js -o frontend/app.min.js
   
   # Optimize images
   # Use webp format for better compression
   ```

2. **Caching Headers**
   ```toml
   # In netlify.toml
   [[headers]]
     for = "*.js"
     [headers.values]
       Cache-Control = "public, max-age=31536000"
   ```

## 🔐 Security Best Practices

### Backend Security

1. **Rate Limiting**
   - Default: 100 requests/minute/IP
   - Adjust in worker code if needed

2. **Input Validation**
   - All API inputs validated
   - URL validation for proxy requests

3. **CORS Configuration**
   - Properly configured for frontend domain
   - No wildcard origins in production

### Frontend Security

1. **Content Security Policy**
   ```html
   <meta http-equiv="Content-Security-Policy" 
         content="default-src 'self' https://your-worker.workers.dev; 
                  script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com;">
   ```

2. **Secure Headers**
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - Referrer-Policy: strict-origin-when-cross-origin

## 📞 Support and Maintenance

### Regular Maintenance

1. **Update Dependencies**
   ```bash
   # Backend
   cd backend && npm update
   
   # Check for wrangler updates
   npm install -g wrangler@latest
   ```

2. **Monitor Performance**
   - Check Cloudflare dashboard weekly
   - Review error logs
   - Monitor resource usage

3. **Backup Configuration**
   ```bash
   # Export KV data
   wrangler kv:key list --binding=CONFIG_KV --env=production > config-backup.json
   ```

### Getting Help

1. **Documentation**
   - [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
   - [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)

2. **Community Support**
   - Cloudflare Workers Discord
   - Stack Overflow (tag: cloudflare-workers)

3. **Error Tracking**
   ```bash
   # View recent errors
   wrangler tail --env production | grep -i error
   ```

---

**Deployment Complete!** Your Jettic Games v2.0 platform is now live with full backend integration. 🌊🎮
