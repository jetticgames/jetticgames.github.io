<div align="center">
<img width="707" height="353" alt="The_worlds_most_advanced_unblocked_games_website__1_-removebg-preview" src="https://github.com/user-attachments/assets/0aeebfff-fd11-4366-ad35-44e1e4dab410" />

# WaterWall - Advanced Unblocked Games Platform

### A modern, responsive gaming platform with proxy capabilities and sleek neon aesthetics

---

## 🚀 Features

- **Modern UI**: Glassy, neon-themed design with smooth animations
- **Proxy System**: Cloudflare Worker-based proxy to bypass restrictions
- **Responsive Design**: Works perfectly on desktop, tablet, and mobile
- **Game Categories**: Organized filtering by Action, Puzzle, Strategy, and Arcade
- **Search Functionality**: Real-time client-side search
- **Fullscreen Gaming**: Immersive fullscreen mode for all games
- **Recommended Games**: Smart recommendations based on current game
- **Offline Support**: Service Worker for basic offline functionality
- **No Passive Animations**: Performance-optimized with animations only on interaction

## 📁 Project Structure

```
WaterWall/
├── frontend/                 # Static website files
│   ├── index.html            # Main SPA container
│   ├── app.js               # Core functionality and routing
│   ├── styles.css           # Neon + glassy theme
│   ├── games.json           # Game database
│   └── sw.js                # Service worker
├── backend/                  # Cloudflare Worker scripts
│   ├── worker.js            # Main proxy worker
│   ├── wrangler.toml        # Worker configuration
│   ├── package.json         # Dependencies and scripts
│   └── README.md            # Deployment instructions
└── README.md                # This file
```

## 🎮 Game Features

### Homepage
- **Grid Layout**: Responsive game cards with hover effects
- **Category Filtering**: Filter games by type
- **Search**: Real-time search across titles, descriptions, and categories
- **Hover Animations**: Title and category slide in from bottom-left

### Game Page
- **80% width, 90% height iframe**: Optimal gaming viewport
- **Proxy Toggle**: Switch between proxied and direct URLs
- **Fullscreen Mode**: Expand games to full viewport
- **Recommended Sidebar**: Random game suggestions
- **Game Info**: Title, description, and controls

## 🛠️ Setup Instructions

### Frontend Deployment

1. **Static Hosting** (Netlify, Vercel, GitHub Pages):
   ```bash
   # Simply upload the frontend/ directory
   # or connect your GitHub repo to your hosting provider
   ```

2. **Local Development**:
   ```bash
   cd frontend/
   python -m http.server 8000  # Python
   # or
   npx serve .                 # Node.js
   ```

### Backend Deployment

1. **Install Wrangler CLI**:
   ```bash
   npm install -g wrangler
   ```

2. **Login to Cloudflare**:
   ```bash
   wrangler login
   ```

3. **Deploy Worker**:
   ```bash
   cd backend/
   wrangler publish
   ```

4. **Configure Custom Domain** (Optional):
   - Add route in Cloudflare dashboard: `yourdomain.com/backend/*`
   - Update `getProxyUrl()` in `app.js` with your domain

### Configuration

1. **Update Games Database**:
   - Edit `frontend/games.json` to add/modify games
   - Include: id, title, description, category, embed URL, thumbnail

2. **Customize Proxy URL**:
   ```javascript
   // In app.js, update this function:
   function getProxyUrl(originalUrl) {
       const proxyBaseUrl = 'https://your-worker.workers.dev/proxy?url=';
       return proxyBaseUrl + encodeURIComponent(originalUrl);
   }
   ```

## 🎨 Design System

### Color Scheme
- **Primary**: `#00ffff` (Cyan/Aqua)
- **Background**: Dark gradient (`#0f0f0f` → `#1a1a2e` → `#16213e`)
- **Glass Effects**: `rgba(255, 255, 255, 0.1)` with backdrop blur
- **Borders**: `rgba(0, 255, 255, 0.2)` with glow effects

### Animations
- **Page Transitions**: 300ms fade/slide
- **Hover Effects**: Scale, glow, and transform
- **No Passive Animations**: Battery and performance friendly

### Typography
- **Font**: Segoe UI system font stack
- **Neon Effects**: Text shadows with cyan glow
- **Responsive**: Scales appropriately on all devices

## 🔧 Technical Details

### Proxy System
- **Cloudflare Workers**: Edge computing for low latency
- **CORS Handling**: Proper headers for cross-origin requests
- **Security**: Rate limiting and URL validation
- **Header Stripping**: Removes X-Frame-Options and CSP restrictions

### Performance
- **Lazy Loading**: Games load on demand
- **Service Worker**: Caches static assets
- **Optimized Images**: Placeholder fallbacks for thumbnails
- **Minimal Bundle**: No heavy frameworks, pure vanilla JS

### Security Features
- **Input Validation**: URL and XSS protection
- **Rate Limiting**: 100 requests per minute per IP
- **Sandbox Iframes**: Restricted permissions for game content
- **Content Security**: Safe header handling

## 🚀 Deployment Options

### Frontend
- **Netlify**: Drag and drop the `frontend/` folder
- **Vercel**: Connect GitHub repo and set build directory to `frontend/`
- **GitHub Pages**: Enable in repo settings, source from `frontend/` folder
- **Firebase Hosting**: `firebase deploy` with `frontend/` as public directory

### Backend
- **Cloudflare Workers**: Primary recommendation for global edge deployment
- **Alternative**: Any serverless platform (Vercel Functions, Netlify Functions)

## 📝 Usage Guide

### Adding New Games
1. Add entry to `frontend/games.json`:
   ```json
   {
       "id": 16,
       "title": "Your Game",
       "description": "Game description here",
       "category": "puzzle",
       "embed": "https://game-url.com",
       "thumbnail": "https://image-url.com/thumb.jpg"
   }
   ```

### Customizing Categories
1. Update filter buttons in `index.html`
2. Update CSS for new category styles
3. Ensure games.json uses matching category names

### Modifying Proxy Behavior
1. Edit `backend/worker.js`
2. Adjust rate limiting, headers, or security rules
3. Redeploy worker: `wrangler publish`

## 🔍 Troubleshooting

### Common Issues

1. **Games not loading through proxy**:
   - Check if proxy worker is deployed correctly
   - Verify the proxy URL in app.js
   - Try disabling proxy toggle for that game

2. **CORS errors**:
   - Ensure worker is properly configured with CORS headers
   - Check if the target game site blocks external requests

3. **Mobile responsiveness**:
   - Test on actual devices, not just browser dev tools
   - Check viewport meta tag is present

### Development Tips

1. **Local Testing**:
   - Use `wrangler dev` for local worker testing
   - Serve frontend with HTTPS for proper testing

2. **Debugging**:
   - Check browser console for JavaScript errors
   - Use `wrangler tail` to see worker logs
   - Test games individually outside of iframes first

## 📄 License

MIT License - Feel free to use this code for your own projects with proper attribution.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**WaterWall** - Bringing unblocked gaming to everyone, everywhere. 🌊🎮
</div>

---

## 🔐 Authentication (Auth0 Integration)

The legacy embedded AuthPro iframe system has been replaced with a modern Auth0 SPA flow.

### Current Configuration
Configured domain: `dev-lciqwnyb52wdezeo.us.auth0.com`

### How It Works
- The frontend loads the Auth0 SPA SDK (`auth0-spa-js`).
- On load, `initAuth0()` creates the client and processes any `code/state` redirect params.
- UI states are toggled between: loading, logged-out, logged-in.
- The sidebar label updates with the user's preferred name.
- A debug `<details>` section shows ID token claims (remove in production if not needed).

### Files Touched
- `frontend/index.html`: Added Auth0 script tag & new Account page markup.
- `frontend/app.js`: Added config (`auth0Config`), init logic, UI update helpers.

### Required Dashboard Settings (Auth0 Application > Settings)
Add these (adjust domain/host as deployed):
```
Allowed Callback URLs: https://your-domain.example/ , http://localhost:8000/
Allowed Logout URLs:  https://your-domain.example/ , http://localhost:8000/
Allowed Web Origins:  https://your-domain.example , http://localhost:8000
```
If you deploy under a subpath, ensure redirect URI matches exactly.

### Optional Enhancements
- Add an API audience + scopes (uncomment in `auth0Config.authorizationParams`).
- Persist sessions across tabs: set `cacheLocation: 'localstorage'` & `useRefreshTokens: true` (trade-off: higher XSS exposure risk).
- Role / permission display: call `getIdTokenClaims()` and inspect namespaced claims.
- Guard pages: before showing content, call `auth0Client.isAuthenticated()`; if false, redirect to login.

### Removing Debug Output
Delete the `<details>` block containing `idTokenPreview` in `index.html` and its corresponding assignment in `updateAuthUI()`.

### Security Notes
- Never expose management API tokens client-side.
- Avoid storing raw tokens in `localStorage` unless necessary for multi-tab resilience.
- Consider CSP headers on hosting platform to restrict script origins.

---
</div>