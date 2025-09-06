# WaterWall Maintenance Mode

## Overview

The maintenance mode feature allows administrators to disable all games and display a maintenance notice to users. When enabled, games are hidden from both the home page and favorites page, and users see a clear maintenance message.

## Features

### Backend Support
- **Maintenance Status Endpoint**: `GET /maintenance-status`
- **Response Format**:
  ```json
  {
    "maintenanceMode": true,
    "message": "WaterWall is currently under maintenance. We'll be back online soon!",
    "estimatedTime": "Please check back in a few hours."
  }
  ```

### Frontend Features
- **Automatic Status Check**: Maintenance status is checked on app initialization
- **Local Override**: Site administrators can enable/disable maintenance mode locally through the settings
- **Game Blocking**: All game access is prevented during maintenance mode
- **User-Friendly Notice**: Clear maintenance message displayed on home and favorites pages
- **Settings Integration**: Maintenance toggle available in the settings page under "Game Settings"

## How to Enable Maintenance Mode

### Method 1: Backend Configuration (Recommended for Production)
1. Edit `backend/worker.js`
2. Set `MAINTENANCE_MODE.enabled = true`
3. Optionally customize the message and estimated time
4. Deploy the updated worker

### Method 2: Local Override (For Testing/Emergency)
1. Open the WaterWall website
2. Go to Settings (gear icon in sidebar)
3. Navigate to "Game Settings" section
4. Toggle "🚧 Maintenance Mode" on
5. Changes are saved locally and persist across browser sessions

### Method 3: Testing Interface
1. Open `maintenance-test.html` in your browser
2. Use the provided controls to enable/disable maintenance mode
3. Check the effect on the main site by opening `index.html` in another tab

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
- Local storage override takes precedence over backend status
- Maintenance status is checked once during app initialization

## Customization

### Message Customization
Edit the maintenance message in `backend/worker.js`:
```javascript
const MAINTENANCE_MODE = {
    enabled: false,
    message: "Your custom maintenance message here",
    estimatedTime: "Your estimated time here"
};
```

### Styling
The maintenance notice uses inline styles but can be customized by modifying the `showMaintenanceNotice()` function in `frontend/app.js`.

## Testing

Use the provided `maintenance-test.html` file to:
- Test local maintenance mode controls
- Check backend status
- Verify functionality without affecting live users
- Debug maintenance mode issues

## Troubleshooting

### Common Issues
1. **Maintenance mode not working**: Check browser console for errors
2. **Status not updating**: Clear browser cache and localStorage
3. **Backend not accessible**: Verify worker deployment and URL

### Debug Information
- Check browser console for maintenance-related log messages
- Look for messages starting with `🔧 Maintenance status:`
- Verify localStorage key `ww_maintenance_override` for local overrides

## Implementation Notes

### Local Override Priority
The system checks for maintenance status in this order:
1. Local override in localStorage (`ww_maintenance_override`)
2. Backend status from `/maintenance-status` endpoint
3. Default to disabled if both fail

### Security Considerations
- Local override only affects the current browser
- Backend maintenance mode affects all users
- No authentication required for maintenance toggle (administrative trust model)

### Performance Impact
- Minimal impact: one additional HTTP request during app initialization
- Maintenance check prevents unnecessary game loading
- UI rendering is optimized for maintenance state
