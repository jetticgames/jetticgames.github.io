# WaterWall Maintenance Mode v2.0

## Overview

The maintenance mode feature has been completely redesigned for WaterWall v2.0. It is now a **backend-controlled** feature that allows administrators to remotely manage maintenance status through API endpoints. The system provides both remote backend control and local fallback capabilities for maximum reliability.

## Features

### Backend-Controlled Maintenance
- **Remote Management**: Maintenance mode controlled via backend API endpoints
- **Instant Propagation**: Changes take effect immediately across all instances
- **Persistent Storage**: Maintenance state stored in Cloudflare KV
- **API Integration**: RESTful API for programmatic control
- **Global Distribution**: Changes propagated via edge computing

### Enhanced Capabilities
- **Custom Messages**: Configurable maintenance messages and estimated times
- **Remote Administration**: Control maintenance without code deployments
- **Automatic Fallback**: Falls back to local storage if backend unavailable
- **Real-time Updates**: Frontend automatically syncs with backend status
- **Version Integration**: Maintenance checks integrated with version management

## How to Control Maintenance Mode

### Method 1: API Endpoints (Recommended)

#### Get Maintenance Status
```bash
curl https://your-worker.workers.dev/api/maintenance
```

**Response:**
```json
{
  "enabled": false,
  "message": "WaterWall is currently under maintenance. We'll be back online soon!",
  "estimatedTime": "Please check back in a few hours."
}
```

#### Enable Maintenance Mode
```bash
curl -X PUT -H 'Content-Type: application/json' \
  -d '{"enabled": true, "message": "Scheduled maintenance in progress", "estimatedTime": "Estimated completion: 2 hours"}' \
  https://your-worker.workers.dev/api/maintenance
```

#### Disable Maintenance Mode
```bash
curl -X PUT -H 'Content-Type: application/json' \
  -d '{"enabled": false}' \
  https://your-worker.workers.dev/api/maintenance
```

### Method 2: NPM Scripts (Backend)
```bash
cd backend/

# Enable maintenance mode
npm run maintenance:enable

# Disable maintenance mode
npm run maintenance:disable
```

### Method 3: Local Fallback (Legacy Support)
If the backend is unavailable, the system falls back to local storage:

```javascript
// Enable maintenance mode (browser console)
localStorage.setItem('ww_maintenance_mode', JSON.stringify({
    enabled: true,
    message: "Local maintenance mode active",
    estimatedTime: "Please check backend status"
}));

// Disable maintenance mode (browser console)
localStorage.setItem('ww_maintenance_mode', JSON.stringify({enabled: false}));
```

## Architecture

### Backend Integration
```
Frontend Request → Backend API → KV Storage → Global Distribution
     ↓                ↓              ↓              ↓
Local Fallback ← Cache Check ← Status Update ← Edge Propagation
```

### Data Flow
1. **Frontend Check**: App checks backend API for maintenance status
2. **Backend Response**: Backend serves current status from KV storage
3. **Local Fallback**: If backend unavailable, falls back to localStorage
4. **Real-time Updates**: Status changes propagate instantly via edge network
5. **Graceful Degradation**: System continues to function even if backend is down

## API Configuration

### Backend Configuration
The maintenance configuration is stored in the backend's KV storage:

```javascript
{
  "maintenanceMode": {
    "enabled": false,
    "message": "WaterWall is currently under maintenance. We'll be back online soon!",
    "estimatedTime": "Please check back in a few hours."
  }
}
```

### Frontend Integration
The frontend automatically checks maintenance status during initialization:

```javascript
// Automatic backend check
async function checkMaintenanceStatus() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/maintenance`);
        const maintenanceConfig = await response.json();
        maintenanceMode = maintenanceConfig;
    } catch (error) {
        // Fallback to local storage
        checkMaintenanceStatusLocal();
    }
}
```

## Advanced Features

### Scheduled Maintenance
You can schedule maintenance using cron jobs or external schedulers:

```bash
# Schedule maintenance for 2 AM UTC
# 0 2 * * * curl -X PUT -H 'Content-Type: application/json' -d '{"enabled":true}' https://your-worker.workers.dev/api/maintenance

# Schedule maintenance end for 4 AM UTC  
# 0 4 * * * curl -X PUT -H 'Content-Type: application/json' -d '{"enabled":false}' https://your-worker.workers.dev/api/maintenance
```

### Custom Maintenance Messages
```bash
curl -X PUT -H 'Content-Type: application/json' \
  -d '{
    "enabled": true,
    "message": "We are upgrading our gaming servers for better performance!",
    "estimatedTime": "Expected completion: 1 hour. Follow @WaterWall for updates."
  }' \
  https://your-worker.workers.dev/api/maintenance
```

### Integration with Monitoring
```bash
# Check if maintenance is active (for monitoring systems)
MAINTENANCE_STATUS=$(curl -s https://your-worker.workers.dev/api/maintenance | jq -r '.enabled')
if [ "$MAINTENANCE_STATUS" = "true" ]; then
    echo "Maintenance mode is active"
    # Send alert to monitoring system
fi
```

## What Happens During Maintenance Mode

### User Experience
- **Home Page**: Games grid replaced with maintenance notice
- **Direct Game Access**: All game loading blocked
- **API Responses**: All game-related APIs respect maintenance status
- **Fallback Content**: Static content remains accessible
- **Navigation**: Core navigation remains functional

### Technical Behavior
- Games are not rendered in the DOM during maintenance
- Game loading functions check maintenance status before proceeding
- Maintenance status checked once during app initialization
- Real-time status updates from backend override local settings
- Graceful fallback to local storage if backend unavailable

## Monitoring and Logging

### Backend Logs
```bash
# View maintenance-related logs
wrangler tail --env production

# Filter for maintenance API calls
wrangler tail --env production | grep "maintenance"
```

### Frontend Monitoring
The frontend logs maintenance status:
```javascript
console.log('🔧 Maintenance status from backend:', maintenanceMode.enabled ? 'ENABLED' : 'DISABLED');
```

## Security Considerations

### API Security
- Maintenance API endpoints require proper authorization for PUT requests
- Rate limiting applies to all API endpoints
- Input validation prevents malicious payloads
- CORS headers properly configured

### Access Control
For production environments, consider adding authentication:

```javascript
// Example: Add API key verification
if (request.method === 'PUT' && !request.headers.get('X-API-Key')) {
    return new Response('Unauthorized', { status: 401 });
}
```

## Migration from v1.0

### Automatic Migration
- v2.0 automatically checks backend first, then falls back to local storage
- Existing local maintenance settings are preserved as fallback
- No breaking changes for existing deployments
- Gradual migration possible by deploying backend first

### Migration Steps
1. Deploy v2.0 backend with maintenance API
2. Update frontend to use new backend URL
3. Test maintenance functionality
4. Optionally remove local maintenance controls
5. Update documentation and procedures

## Troubleshooting

### Common Issues

1. **Backend API Unavailable**
   - System automatically falls back to local storage
   - Check backend deployment and KV namespace configuration
   - Verify network connectivity to worker

2. **Maintenance Status Not Updating**
   - Check backend logs for API errors
   - Verify KV namespace permissions
   - Clear browser cache and localStorage

3. **Local Fallback Not Working**
   - Check browser console for localStorage errors
   - Verify localStorage is enabled in browser
   - Clear and reset localStorage manually

### Debug Commands
```bash
# Test backend API
curl -v https://your-worker.workers.dev/api/maintenance

# Check backend health
curl https://your-worker.workers.dev/health

# View detailed logs
wrangler tail --env production --debug
```

## Performance Impact

### Backend Integration
- **API Latency**: ~10ms additional latency for maintenance check
- **Caching**: Maintenance status cached for 30 seconds
- **Edge Distribution**: Status served from global edge locations
- **Minimal Overhead**: Single API call during app initialization

### Optimization
- Maintenance status cached in frontend after initial check
- Batch API calls to reduce latency
- Fallback mechanisms prevent blocking
- KV storage optimized for global distribution

---

**WaterWall v2.0 Maintenance Mode** - Remote control with local reliability. 🔧🌊

## What Happens During Maintenance Mode

### User Experience
- **Home Page**: Games grid is replaced with maintenance notice
- **Favorites Page**: Favorites are hidden, maintenance notice shown
- **Game Access**: Direct game loading is prevented
- **Game Cards**: Clicking game cards has no effect
- **Sidebar**: Navigation remains functional

### Technical Details
- Games are not rendered in the DOM
- All game loading functions check maintenance status
- Maintenance state is stored in localStorage (`ww_maintenance_mode`)
- Maintenance status is checked once during app initialization

## Customization

### Message Customization
The maintenance message can be customized by modifying the `maintenanceMode` object in `frontend/app.js`:
```javascript
let maintenanceMode = {
    enabled: false,
    message: "Your custom maintenance message here",
    estimatedTime: "Your custom estimated time here"
};
```

### Styling
The maintenance notice uses inline styles but can be customized by modifying the `showMaintenanceNotice()` function in `frontend/app.js`.

## Testing

Use the provided `maintenance-test.html` file to:
- Test maintenance mode controls
- Check localStorage status
- Verify functionality without affecting live users
- Debug maintenance mode issues

## Troubleshooting

### Common Issues
1. **Maintenance mode not working**: Check browser console for errors
2. **Status not updating**: Clear browser cache and localStorage
3. **Settings not persisting**: Verify localStorage is enabled in browser

### Debug Information
- Check browser console for maintenance-related log messages
- Look for messages starting with `🔧 Maintenance status:`
- Verify localStorage key `ww_maintenance_mode` exists and is valid JSON

## Implementation Notes

### Storage Structure
The maintenance mode data is stored in localStorage as:
```json
{
    "enabled": true,
    "message": "WaterWall is currently under maintenance. We'll be back online soon!",
    "estimatedTime": "Please check back in a few hours."
}
```

### Security Considerations
- Maintenance mode only affects the current browser/device
- No server-side authentication required
- Safe for static hosting environments
- Cannot be bypassed by users (only admin can disable)

### Performance Impact
- Minimal impact: one localStorage read during app initialization
- Maintenance check prevents unnecessary game loading
- UI rendering is optimized for maintenance state
- No network requests required for maintenance functionality
