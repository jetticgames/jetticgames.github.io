# WaterWall v2.0 Migration Guide

This guide helps you upgrade from WaterWall v1.0 (static frontend) to v2.0 (dynamic full-stack platform).

## 🔄 Migration Overview

WaterWall v2.0 represents a fundamental shift from a static website to a dynamic full-stack platform:

### v1.0 → v2.0 Changes
- **Static** → **Dynamic**: Games and config now served from backend APIs
- **Local** → **Remote**: Maintenance mode now controlled via backend
- **Manual** → **Automatic**: Updates now automatically detected and prompted
- **Fixed** → **Flexible**: All content now manageable without code changes

## 🚀 Migration Steps

### Phase 1: Backend Deployment

1. **Deploy the Backend First**
   ```bash
   cd backend/
   npm install
   wrangler login
   
   # Create KV namespaces
   npm run kv:create
   npm run kv:create:preview
   ```

2. **Configure KV Namespaces**
   Update `backend/wrangler.toml` with the generated namespace IDs:
   ```toml
   [[kv_namespaces]]
   binding = "CONFIG_KV"
   id = "your-generated-config-id"
   preview_id = "your-generated-config-preview-id"
   
   [[kv_namespaces]]
   binding = "RATE_LIMIT_KV"
   id = "your-generated-ratelimit-id"
   preview_id = "your-generated-ratelimit-preview-id"
   ```

3. **Deploy Backend**
   ```bash
   npm run deploy:production
   # Note your worker URL: https://your-worker.workers.dev
   ```

### Phase 2: Frontend Updates

1. **Update Backend URL**
   In `frontend/app.js`, update the BACKEND_URL:
   ```javascript
   const BACKEND_URL = 'https://your-worker.workers.dev';
   ```

2. **Deploy Updated Frontend**
   - Upload the updated frontend to your hosting provider
   - Ensure the new app.js is deployed with the correct backend URL

### Phase 3: Verification

1. **Test Backend APIs**
   ```bash
   # Test games API
   curl https://your-worker.workers.dev/api/games
   
   # Test config API
   curl https://your-worker.workers.dev/api/config
   
   # Test maintenance API
   curl https://your-worker.workers.dev/api/maintenance
   ```

2. **Test Frontend Integration**
   - Open your website
   - Check browser console for "Backend configuration loaded" messages
   - Verify games load from backend
   - Test maintenance mode via API

## 🔧 Configuration Migration

### Games Data Migration

Your existing `games.json` is preserved as a fallback, but games are now served from the backend:

**Before (v1.0):**
```javascript
// Games loaded from static games.json
const response = await fetch('./games.json');
```

**After (v2.0):**
```javascript
// Games loaded from backend API with fallback
const response = await fetch(`${BACKEND_URL}/api/games`);
// Automatic fallback to local games.json if backend unavailable
```

### Maintenance Mode Migration

**Before (v1.0):**
```javascript
// Local storage only
localStorage.setItem('ww_maintenance_mode', JSON.stringify({enabled: true}));
```

**After (v2.0):**
```bash
# Backend API control
curl -X PUT -H 'Content-Type: application/json' \
  -d '{"enabled": true}' \
  https://your-worker.workers.dev/api/maintenance
```

### Settings Migration

**Before (v1.0):**
- All settings stored in browser localStorage
- No synchronization across devices

**After (v2.0):**
- Default settings served from backend
- User preferences still stored locally
- Backend settings as fallback defaults

## 🌐 Custom Domain Setup (Optional)

If you want to serve both frontend and backend from the same domain:

1. **Configure Backend Routes**
   ```toml
   # In backend/wrangler.toml
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

3. **Optional: Netlify Proxy Setup**
   ```toml
   # In netlify.toml
   [[redirects]]
     from = "/api/*"
     to = "https://your-worker.workers.dev/api/:splat"
     status = 200
     force = true
   ```

## 🔍 Verification Checklist

### Backend Verification
- [ ] Worker deployed successfully
- [ ] KV namespaces created and configured
- [ ] `/api/games` returns game data
- [ ] `/api/config` returns configuration
- [ ] `/api/maintenance` returns maintenance status
- [ ] `/proxy?url=` proxies requests correctly
- [ ] `/health` returns OK status

### Frontend Verification
- [ ] Website loads without errors
- [ ] Games load from backend API
- [ ] Fallback to local games.json works when backend unavailable
- [ ] Maintenance mode can be controlled via API
- [ ] Update notifications appear when backend version is newer
- [ ] Console shows "Backend configuration loaded" message

### Integration Testing
- [ ] Enable maintenance mode via API - verify frontend responds
- [ ] Disable maintenance mode via API - verify games reappear
- [ ] Test game loading with proxy enabled/disabled
- [ ] Verify thumbnails load from backend API
- [ ] Test version checking and update notifications

## 🚨 Rollback Plan

If you need to rollback to v1.0:

1. **Revert Frontend**
   - Deploy the original v1.0 frontend files
   - Ensure `games.json` contains all game data
   - Remove backend URL configuration

2. **Disable Backend**
   - Backend can remain deployed (doesn't interfere)
   - Or suspend worker if needed: `wrangler delete`

3. **Restore Local Maintenance**
   - v1.0 maintenance mode will work from localStorage
   - Use browser console to control maintenance

## 🔧 Troubleshooting

### Common Migration Issues

1. **Games Not Loading**
   ```bash
   # Check backend API
   curl https://your-worker.workers.dev/api/games
   # Check CORS headers
   curl -H "Origin: https://your-frontend-domain.com" https://your-worker.workers.dev/api/games
   ```

2. **Backend URL Incorrect**
   - Verify BACKEND_URL in app.js matches your deployed worker
   - Check for typos in worker URL
   - Test worker directly in browser

3. **KV Namespace Errors**
   ```bash
   # Recreate namespaces if needed
   wrangler kv:namespace create CONFIG_KV
   wrangler kv:namespace create RATE_LIMIT_KV
   ```

4. **CORS Issues**
   - Backend automatically includes CORS headers
   - Check browser network tab for detailed error messages
   - Verify worker is deployed and accessible

### Debug Commands

```bash
# Check worker logs
wrangler tail --env production

# Test API endpoints
curl -v https://your-worker.workers.dev/api/games
curl -v https://your-worker.workers.dev/api/config
curl -v https://your-worker.workers.dev/health

# Check KV storage
wrangler kv:key list --binding=CONFIG_KV
```

## 📈 Benefits After Migration

### Performance Improvements
- **Faster Loading**: Edge-cached API responses
- **Global Distribution**: Content served from 200+ edge locations
- **Optimized Delivery**: Compressed responses and efficient caching

### Management Benefits
- **Remote Control**: Manage content without code deployments
- **Real-time Updates**: Changes propagate instantly
- **Better Monitoring**: Comprehensive logging and analytics
- **Scalability**: Automatic scaling with demand

### User Experience
- **Faster Response**: Reduced latency via edge computing
- **Better Reliability**: Multiple fallback mechanisms
- **Update Notifications**: Automatic update prompts
- **Smoother Operation**: Optimized loading and error handling

## 🎯 Next Steps

After successful migration:

1. **Test Thoroughly**
   - Test all game loading scenarios
   - Verify maintenance mode functionality
   - Check update notification system

2. **Monitor Performance**
   ```bash
   # Watch backend logs
   wrangler tail --env production
   ```

3. **Customize Configuration**
   - Add more games via backend API
   - Customize maintenance messages
   - Adjust caching settings

4. **Set Up Monitoring**
   - Monitor worker performance in Cloudflare dashboard
   - Set up alerts for errors or high usage

## 📞 Support

If you encounter issues during migration:

1. **Check Documentation**
   - [Backend API Documentation](backend/README-API.md)
   - [Maintenance Mode Guide](MAINTENANCE_MODE.md)

2. **Debug Steps**
   - Check browser console for errors
   - Test backend APIs directly
   - Verify worker deployment status

3. **Common Solutions**
   - Ensure KV namespaces are properly configured
   - Verify CORS headers in network tab
   - Check worker logs for error details

---

**Migration Success!** Welcome to WaterWall v2.0 - the most advanced unblocked gaming platform. 🌊🎮
