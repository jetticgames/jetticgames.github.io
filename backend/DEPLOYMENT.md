# WaterWall Backend Deployment Guide

## Prerequisites

1. **Install Wrangler CLI**:
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**:
   ```bash
   wrangler login
   ```

## KV Namespace Setup

The backend uses KV storage for configuration and rate limiting. Follow these steps:

### 1. Create KV Namespaces

```bash
# Create the CONFIG_KV namespace
wrangler kv:namespace create "CONFIG_KV"

# Create the RATE_LIMIT_KV namespace  
wrangler kv:namespace create "RATE_LIMIT_KV"
```

Each command will output something like:
```
🌀 Creating namespace with title "CONFIG_KV"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "CONFIG_KV", id = "abcd1234..." }
```

### 2. Update wrangler.toml

Copy the namespace IDs from the output above and update your `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "CONFIG_KV"
id = "your-actual-config-kv-namespace-id"
preview_id = "your-actual-config-preview-kv-namespace-id"

[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "your-actual-ratelimit-kv-namespace-id"  
preview_id = "your-actual-ratelimit-preview-kv-namespace-id"
```

**Note**: The current `wrangler.toml` has these sections commented out to prevent deployment errors.

## Deployment Options

### Option 1: Deploy Without KV (Limited Functionality)

If you want to deploy quickly without KV setup:

```bash
wrangler deploy
```

**Limitations**:
- No persistent configuration storage
- No rate limiting
- All features use default/fallback values

### Option 2: Deploy With Full KV Support

1. Complete the KV namespace setup above
2. Uncomment and update the KV namespace sections in `wrangler.toml`
3. Deploy:

```bash
wrangler deploy
```

**Benefits**:
- Persistent configuration storage
- Rate limiting protection  
- Full backend functionality
- **Backend asset serving** (CSS, JS, images served from backend for instant updates)
- **No cache clearing required** when you update assets

## Testing Your Deployment

After deployment, test your worker:

```bash
# Test the health endpoint
curl https://your-worker-name.your-account.workers.dev/health

# Test the games API
curl https://your-worker-name.your-account.workers.dev/api/games

# Test asset serving
curl https://your-worker-name.your-account.workers.dev/api/assets/app.js
curl https://your-worker-name.your-account.workers.dev/api/assets/styles.css
curl https://your-worker-name.your-account.workers.dev/api/thumbnails/snake.gif
```

## Updating Frontend Configuration

Update your frontend's `BACKEND_URL` in `app.js`:

```javascript
const BACKEND_URL = 'https://your-worker-name.your-account.workers.dev';
```

## Production Setup

For production deployments:

1. **Set up custom domain** (optional):
   - Add custom routes in `wrangler.toml`
   - Configure DNS in Cloudflare dashboard

2. **Environment-specific namespaces**:
   - Create separate KV namespaces for production
   - Use the `[env.production]` section in `wrangler.toml`

## Troubleshooting

### "Namespace not found" errors
- Ensure KV namespaces are created and IDs are correct in `wrangler.toml`
- Uncomment the KV namespace sections after setting up

### Worker fails to deploy
- Check that `wrangler.toml` syntax is correct
- Ensure you're logged in: `wrangler whoami`
- Try deploying without KV first, then add KV support

### Frontend can't connect to backend
- Verify the worker URL is correct
- Check CORS headers in browser dev tools
- Test API endpoints directly with curl
