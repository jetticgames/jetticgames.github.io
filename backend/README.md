# Backend Deployment Instructions

## Cloudflare Worker Setup

### Prerequisites
1. Install Wrangler CLI: `npm install -g wrangler`
2. Login to Cloudflare: `wrangler login`

### Social Features Setup (REQUIRED)

To enable the friends system, cross-device sync, and presence tracking, you must create a KV namespace:

1. **Create the USER_DATA_KV namespace:**
   ```bash
   wrangler kv:namespace create "USER_DATA_KV"
   wrangler kv:namespace create "USER_DATA_KV" --preview
   ```

2. **Update wrangler.toml:**
   - Copy the namespace IDs from the command output
   - Uncomment and update the USER_DATA_KV section in wrangler.toml:
   ```toml
   [[kv_namespaces]]
   binding = "USER_DATA_KV"
   id = "your-namespace-id-here"
   preview_id = "your-preview-namespace-id-here"
   ```

3. **Deploy with KV:**
   ```bash
   wrangler publish
   ```

**Note:** Without USER_DATA_KV configured, social features will return "503 Service Unavailable" errors.

### Optional KV Namespaces

For advanced features, you can also create:
```bash
# For admin configuration
wrangler kv:namespace create "CONFIG_KV"
wrangler kv:namespace create "CONFIG_KV" --preview

# For rate limiting
wrangler kv:namespace create "RATE_LIMIT_KV"
wrangler kv:namespace create "RATE_LIMIT_KV" --preview
```

### Deployment Steps

1. **Configure wrangler.toml**
   - Update the `name` field with your preferred worker name
   - Update the `routes` section with your actual domain
   - Set the correct zone_name for your domain

2. **Deploy to staging**
   ```bash
   wrangler publish --env staging
   ```

3. **Deploy to production**
   ```bash
   wrangler publish --env production
   ```

### Custom Domain Setup

1. Add a custom route in Cloudflare dashboard:
   - Go to Workers & Pages > Overview
   - Click on your worker
   - Go to Settings > Triggers
   - Add route: `yourdomain.com/backend/*`

2. Update the frontend `app.js` file:
   ```javascript
   function getProxyUrl(originalUrl) {
       const proxyBaseUrl = 'https://yourdomain.com/backend/proxy?url=';
       return proxyBaseUrl + encodeURIComponent(originalUrl);
   }
   ```

### Testing the Proxy

1. Test direct access:
   ```
   https://your-worker.your-subdomain.workers.dev/proxy?url=https://example.com
   ```

2. Test health endpoint:
   ```
   https://your-worker.your-subdomain.workers.dev/health
   ```

### Environment Variables

You can set environment variables in wrangler.toml or through the Cloudflare dashboard:

```toml
[vars]
ENVIRONMENT = "production"
MAX_REQUESTS_PER_MINUTE = "100"
ALLOWED_ORIGINS = "yourdomain.com"
```

### Security Considerations

1. **Rate Limiting**: The worker includes basic rate limiting (100 requests per minute per IP)
2. **URL Validation**: Only HTTP/HTTPS URLs are allowed
3. **Header Filtering**: Removes problematic security headers that block iframe embedding
4. **CORS**: Properly configured to allow cross-origin requests

### Monitoring

1. Check worker logs in Cloudflare dashboard
2. Monitor usage and performance metrics
3. Set up alerts for high error rates or usage spikes

### Troubleshooting

1. **CORS Issues**: Ensure the worker is properly deployed and accessible
2. **Rate Limiting**: Increase limits if legitimate users are being blocked
3. **Game Loading Issues**: Check if the target site blocks requests from your worker's IP range
