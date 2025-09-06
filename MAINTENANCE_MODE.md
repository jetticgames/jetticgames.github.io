# WaterWall Maintenance Mode

## Overview

The maintenance mode feature allows administrators to disable all games and display a maintenance notice to users. When enabled, games are hidden from both the home page and favorites page, and users see a clear maintenance message. This is a **frontend-only** feature that works entirely through browser localStorage.

## Features

### Frontend-Only Implementation
- **Local Storage Based**: Maintenance mode state is stored in browser localStorage
- **No Backend Dependency**: Works completely independent of any server-side components
- **Persistent Settings**: Maintenance mode persists across browser sessions
- **Admin Controls**: Easy toggle through the settings interface

### Core Features
- **Automatic Status Check**: Maintenance status is checked on app initialization
- **Game Blocking**: All game access is prevented during maintenance mode
- **User-Friendly Notice**: Clear maintenance message displayed on home and favorites pages
- **Settings Integration**: Maintenance toggle available in the settings page under "Game Settings"
- **Complete UI Hiding**: Games and favorites are completely hidden during maintenance

## How to Enable Maintenance Mode

### Method 1: Settings Page (Recommended)
1. Open the WaterWall website
2. Go to Settings (gear icon in sidebar)
3. Navigate to "Game Settings" section
4. Toggle "🚧 Maintenance Mode" on
5. Changes are saved automatically to localStorage

### Method 2: Testing Interface
1. Open `maintenance-test.html` in your browser
2. Use the provided controls to enable/disable maintenance mode
3. Check the effect on the main site by opening `index.html` in another tab

### Method 3: Browser Console (Advanced)
```javascript
// Enable maintenance mode
localStorage.setItem('ww_maintenance_mode', JSON.stringify({
    enabled: true,
    message: "WaterWall is currently under maintenance. We'll be back online soon!",
    estimatedTime: "Please check back in a few hours."
}));

// Disable maintenance mode
localStorage.setItem('ww_maintenance_mode', JSON.stringify({enabled: false}));

// Remove maintenance mode setting
localStorage.removeItem('ww_maintenance_mode');
```

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
