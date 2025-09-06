# WaterWall Admin Configuration System

## Overview

WaterWall now features a comprehensive admin-controlled configuration system that allows you to control **every aspect** of the user experience from the backend. This system provides complete control over features, UI elements, default settings, and user behavior.

## Features Controlled by Admin

### Core Features
- **Account System** - Enable/disable Auth0 login system
- **Favorites** - Enable/disable favorites functionality
- **Search** - Enable/disable game search
- **Fullscreen** - Enable/disable fullscreen mode
- **Categories** - Enable/disable category filtering
- **Settings Menu** - Enable/disable entire settings menu
- **Updating** - Enable/disable update checks and notifications

### Visual Features
- **Particles** - Enable/disable background particles system
- **Custom Cursor** - Enable/disable custom cursor functionality
- **Theme Customization** - Enable/disable theme customization options

### Advanced Features
- **Proxy** - Enable/disable proxy functionality globally
- **Game Embed** - Enable/disable game embedding
- **Keyboard Shortcuts** - Enable/disable keyboard shortcuts
- **Mobile Access** - Enable/disable mobile device access
- **Debug Mode** - Enable/disable debug logging
- **Analytics** - Enable/disable analytics tracking
- **Error Reporting** - Enable/disable error reporting

## Configuration Structure

The configuration is stored in Cloudflare KV under the key `admin_config` with the following structure:

```json
{
  "version": "2.0.0",
  "maintenanceMode": {
    "enabled": false,
    "message": "WaterWall is currently under maintenance. We'll be back online soon!",
    "estimatedTime": "Please check back in a few hours.",
    "blockProxy": true
  },
  "features": {
    "accountSystemEnabled": true,
    "favoritesEnabled": true,
    "searchEnabled": true,
    "fullscreenEnabled": true,
    "categoriesEnabled": true,
    "settingsMenuEnabled": true,
    "updatingEnabled": true,
    "particlesEnabled": true,
    "customCursorEnabled": true,
    "proxyEnabled": true,
    "gameEmbedEnabled": true,
    "themeCustomizationEnabled": true,
    "keyboardShortcutsEnabled": true,
    "adVerificationEnabled": false,
    "mobileAccessEnabled": false,
    "debugModeEnabled": false,
    "analyticsEnabled": false,
    "errorReportingEnabled": true
  },
  "defaultUserSettings": {
    "defaultProxy": false,
    "accentColor": "#58a6ff",
    "particlesEnabled": true,
    "particleSpeed": 0.5,
    "particleCount": 50,
    "particleColor": "#58a6ff",
    "particleLineDistance": 150,
    "particleMouseInteraction": true,
    "customCursorEnabled": true,
    "cursorSize": 8,
    "cursorColor": "#ffffff",
    "cursorType": "circle",
    "customCursorImage": null,
    "autoFullscreen": false,
    "soundEnabled": true,
    "animationsEnabled": true,
    "autoSaveEnabled": true,
    "analyticsOptIn": false,
    "errorReportingOptIn": true
  },
  "uiControls": {
    "showHeader": true,
    "showFooter": true,
    "showSidebar": true,
    "showGameControls": true,
    "showProxyToggle": true,
    "showFavoriteButton": true,
    "showFullscreenButton": true,
    "showSearchBar": true,
    "showCategoryFilters": true,
    "showSettingsButton": true,
    "showUpdateNotifications": true,
    "showMaintenanceNotice": true
  },
  "contentControls": {
    "maxGamesPerPage": 50,
    "enableGameRatings": false,
    "enableGameComments": false,
    "enableGameSuggestions": true,
    "showGameDescriptions": true,
    "showGameThumbnails": true,
    "enableGameSearch": true,
    "enableCategoryFiltering": true
  },
  "systemControls": {
    "enableCORS": true,
    "enableCaching": true,
    "cacheTimeout": 3600,
    "enableRateLimiting": true,
    "maxRequestsPerMinute": 100,
    "enableCSP": true,
    "enableHTTPS": true,
    "enableCompression": true
  },
  "messaging": {
    "welcomeMessage": "Welcome to WaterWall! Enjoy our collection of games.",
    "maintenanceMessage": "WaterWall is currently under maintenance. We'll be back online soon!",
    "errorMessage": "Something went wrong. Please try again later.",
    "noGamesMessage": "No games found. Try adjusting your search or category filter.",
    "loadingMessage": "Loading games...",
    "offlineMessage": "You appear to be offline. Some features may not work."
  }
}
```

## API Endpoints

### Get Full Configuration
```bash
curl https://your-worker.workers.dev/api/admin/config
```

### Update Full Configuration
```bash
curl -X PUT -H 'Content-Type: application/json' \
  -d @config.json \
  https://your-worker.workers.dev/api/admin/config
```

### Get/Update Feature Toggles Only
```bash
# Get features
curl https://your-worker.workers.dev/api/admin/features

# Update features
curl -X PUT -H 'Content-Type: application/json' \
  -d '{"searchEnabled": false, "favoritesEnabled": false}' \
  https://your-worker.workers.dev/api/admin/features
```

### Get/Update Default User Settings
```bash
# Get defaults
curl https://your-worker.workers.dev/api/admin/defaults

# Update defaults
curl -X PUT -H 'Content-Type: application/json' \
  -d '{"accentColor": "#ff6b6b", "particlesEnabled": false}' \
  https://your-worker.workers.dev/api/admin/defaults
```

### Get/Update UI Controls
```bash
# Get UI controls
curl https://your-worker.workers.dev/api/admin/ui

# Update UI controls
curl -X PUT -H 'Content-Type: application/json' \
  -d '{"showSearchBar": false, "showCategoryFilters": false}' \
  https://your-worker.workers.dev/api/admin/ui
```

## Common Use Cases

### 1. Disable Search and Categories
```bash
curl -X PUT -H 'Content-Type: application/json' \
  -d '{
    "searchEnabled": false,
    "categoriesEnabled": false,
    "showSearchBar": false,
    "showCategoryFilters": false
  }' \
  https://your-worker.workers.dev/api/admin/features
```

### 2. Disable All Customization
```bash
curl -X PUT -H 'Content-Type: application/json' \
  -d '{
    "settingsMenuEnabled": false,
    "themeCustomizationEnabled": false,
    "particlesEnabled": false,
    "customCursorEnabled": false
  }' \
  https://your-worker.workers.dev/api/admin/features
```

### 3. Mobile-Only Mode
```bash
curl -X PUT -H 'Content-Type: application/json' \
  -d '{
    "mobileAccessEnabled": true,
    "particlesEnabled": false,
    "customCursorEnabled": false,
    "fullscreenEnabled": false
  }' \
  https://your-worker.workers.dev/api/admin/features
```

### 4. Simplified Gaming Mode
```bash
curl -X PUT -H 'Content-Type: application/json' \
  -d '{
    "favoritesEnabled": false,
    "accountSystemEnabled": false,
    "settingsMenuEnabled": false,
    "updatingEnabled": false,
    "showHeader": false,
    "showFooter": false
  }' \
  https://your-worker.workers.dev/api/admin/config
```

### 5. Change Default Theme for All New Users
```bash
curl -X PUT -H 'Content-Type: application/json' \
  -d '{
    "accentColor": "#e74c3c",
    "particleColor": "#e74c3c",
    "particlesEnabled": true,
    "particleCount": 75
  }' \
  https://your-worker.workers.dev/api/admin/defaults
```

## Frontend Integration

The frontend automatically loads and applies admin configuration on startup. Configuration changes take effect immediately for new users, and existing users will see changes on their next page load.

### JavaScript API

You can also control configuration from the browser console:

```javascript
// Get current configuration
console.log(window.WaterWallAdmin.getConfig());

// Apply new configuration
window.WaterWallAdmin.applyConfig({
  features: { searchEnabled: false },
  uiControls: { showSearchBar: false }
});

// Refresh from backend
window.WaterWallAdmin.refreshConfig();
```

## Effect of Configuration Changes

### Feature Toggles
- **Disabled features** are completely hidden from the UI
- **Settings sections** for disabled features are not shown
- **Functionality** is completely disabled (not just hidden)

### UI Controls
- **Hidden elements** are set to `display: none`
- **User interactions** with hidden elements are blocked
- **Navigation** adapts to hidden elements

### Default Settings
- **New users** get admin-defined defaults
- **Reset button** uses admin-defined defaults
- **Existing users** keep their settings unless they reset

## Security Considerations

- All admin endpoints require proper authorization
- Configuration changes are logged for audit purposes
- Invalid configuration is rejected with error messages
- Fallback to safe defaults if configuration is corrupted

## Monitoring

You can monitor configuration changes:

```bash
# View logs
wrangler tail --env production | grep "Admin configuration"

# Check current configuration
curl https://your-worker.workers.dev/api/admin/config | jq .
```

## Best Practices

1. **Test configuration changes** in development first
2. **Make incremental changes** rather than large sweeping changes
3. **Monitor user feedback** after configuration changes
4. **Keep backups** of working configurations
5. **Document your changes** for team members

## Troubleshooting

### Configuration Not Applied
- Check that KV storage is properly configured
- Verify JSON syntax in configuration updates
- Check browser console for error messages
- Try force refreshing the page

### Feature Still Visible After Disabling
- Check both `features` and `uiControls` settings
- Clear browser cache and reload
- Check if feature is hardcoded in HTML

### Users Can't Access Settings
- Verify `settingsMenuEnabled` is `true`
- Check `showSettingsButton` in UI controls
- Ensure settings page generation is not blocked

This comprehensive admin system gives you complete control over every aspect of WaterWall's user experience!
