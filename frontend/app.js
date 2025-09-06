// Global variables
console.log('🎮 WaterWall app.js is loading...');

// Application configuration
const APP_VERSION = '2.0.1';
// Use backend URL from global scope if available, otherwise fallback to hardcoded
const BACKEND_URL = window.WATERWALL_BACKEND_URL || 'https://waterwallrelayservice.zonikyo.workers.dev';

let games = [];
let __appInitStarted = false;
let __authRedirectHandled = false;
let currentGame = null;
let isProxyEnabled = false; // Disabled by default per new requirement
const proxyUrl = `${BACKEND_URL}/proxy`;
let favorites = [];

// Admin-controlled configuration (loaded from backend)
let adminConfig = null;

// Feature flags (controlled by admin)
let features = {
    accountSystemEnabled: true,
    favoritesEnabled: true,
    searchEnabled: true,
    fullscreenEnabled: true,
    categoriesEnabled: true,
    settingsMenuEnabled: true,
    updatingEnabled: true,
    particlesEnabled: true,
    customCursorEnabled: true,
    proxyEnabled: true,
    gameEmbedEnabled: true,
    themeCustomizationEnabled: true,
    keyboardShortcutsEnabled: true,
    adVerificationEnabled: false,
    mobileAccessEnabled: false,
    debugModeEnabled: false,
    analyticsEnabled: false,
    errorReportingEnabled: true
};

// UI Controls (what elements to show/hide)
let uiControls = {
    showHeader: true,
    showFooter: true,
    showSidebar: true,
    showGameControls: true,
    showProxyToggle: true,
    showFavoriteButton: true,
    showFullscreenButton: true,
    showSearchBar: true,
    showCategoryFilters: true,
    showSettingsButton: true,
    showUpdateNotifications: true,
    showMaintenanceNotice: true
};

let maintenanceMode = {
    enabled: false,
    message: "WaterWall is currently under maintenance. We'll be back online soon!",
    estimatedTime: "Please check back in a few hours."
};
let settings = { 
    defaultProxy: false,
    // Theme settings
    accentColor: '#58a6ff',
    // Particle settings
    particlesEnabled: true,
    particleSpeed: 0.5,
    particleCount: 50,
    particleColor: '#58a6ff',
    particleLineDistance: 150,
    particleMouseInteraction: true,
    // Cursor settings
    customCursorEnabled: true,
    cursorSize: 8,
    cursorColor: '#ffffff',
    cursorType: 'circle', // 'circle', 'arrow', 'custom'
    customCursorImage: null
};
let currentGameTabTimeout = null;
let serverConfig = null;
// Per-game proxy overrides (true = enabled, false = disabled); undefined -> use settings.defaultProxy
const gameProxyOverrides = {};

// DOM elements (will be initialized after DOM loads)
let gamesGrid;
let searchInput;
let filterBtns;
let proxyToggle;
let gameFrame;
let fullscreenFrame;
let fullscreenOverlay;
let gamePage;
let homepage;
let gameTitle;
let gameDescription;
let recommendedGames;
let bottomRecommendedGames;
let fullscreenBtn;
let exitFullscreenBtn;

let accountLabelEl;
let logoutModalEl, logoutConfirmBtn, logoutCancelBtn;
let isFullscreen = false;

// Auth0 variables
let auth0Client = null;
const __redirectBase = (()=>{
    // Normalize redirect URI (Auth0 can be picky about trailing slash differences)
    const origin = window.location.origin.replace(/\/$/, '');
    const path = window.location.pathname === '/' ? '' : window.location.pathname.replace(/index\.html$/i,'');
    return origin + path + '/';
})();
const auth0Config = {
    domain: 'dev-lciqwnyb52wdezeo.us.auth0.com',
    clientId: 'sbABJXSUTPmROG9WTrdB0LrUBtTwnWxO',
    authorizationParams: {
        redirect_uri: __redirectBase,
        // scope kept default openid profile email implicitly
    },
    cacheLocation: 'localstorage', // persist across reload/redirect to avoid missing_transaction
    useRefreshTokens: false,
    useCookiesForTransactions: true // ensure state/nonce survive same-site navigations
};

// Auth0 audience for API calls (use the backend URL as audience)
const AUTH0_AUDIENCE = BACKEND_URL;

console.log('[Auth0] Using redirect_uri:', auth0Config.authorizationParams.redirect_uri);

// ===== Global Page Loader (initial page load experience) =====
let __pageLoaderEl=null, __pageLoaderStart=performance.now(), __pageLoaderMin=2000, __pageLoaderDone=false;
let __pageLoaderStages={ dom:false, games:false, auth:false, ui:false, config:false, final:false };
let __pageLoaderWarnTimer=null, __pageLoaderSafetyTimer=null;

function initPageLoader(){
    __pageLoaderEl = document.getElementById('appPageLoader');
    if(!__pageLoaderEl){ return; }
    __pageLoaderStart = performance.now();
    // Connectivity warning at 30s
    __pageLoaderWarnTimer = setTimeout(()=>{
        if(__pageLoaderDone) return;
        const warn = __pageLoaderEl.querySelector('.apl-warning');
        if(warn){ warn.style.display='block'; }
    }, 30000);
    // Hard safety removal at 45s even if something wedged
    __pageLoaderSafetyTimer = setTimeout(()=>{
        if(!__pageLoaderDone){ hidePageLoader(true); }
    }, 45000);
    signalPageLoaderStage('dom');
}

function signalPageLoaderStage(stage){
    if(!__pageLoaderEl) return;
    if(!(__pageLoaderStages.hasOwnProperty(stage))) return;
    if(__pageLoaderStages[stage]) return;
    __pageLoaderStages[stage] = true;
    maybeHidePageLoader();
}

function maybeHidePageLoader(){
    if(!__pageLoaderEl) return;
    // All required stages except 'final' must be done before we consider hiding
    const coreDone = __pageLoaderStages.games && __pageLoaderStages.auth && __pageLoaderStages.ui && __pageLoaderStages.config;
    if(!coreDone) return;
    const elapsed = performance.now() - __pageLoaderStart;
    const remaining = Math.max(0, __pageLoaderMin - elapsed);
    clearTimeout(__pageLoaderWarnTimer);
    setTimeout(()=> hidePageLoader(false), remaining);
}

function hidePageLoader(force){
    if(!__pageLoaderEl || __pageLoaderDone) return;
    __pageLoaderDone = true;
    clearTimeout(__pageLoaderWarnTimer); clearTimeout(__pageLoaderSafetyTimer);
    requestAnimationFrame(()=>{
        __pageLoaderEl.classList.add('fade-out');
        setTimeout(()=>{ if(__pageLoaderEl){ __pageLoaderEl.remove(); __pageLoaderEl=null; } }, 800);
    });
}

function showOfflineError() {
    if (!__pageLoaderEl) return;
    
    // Update the page loader to show offline error
    const aplHint = __pageLoaderEl.querySelector('#aplHint');
    const aplWarning = __pageLoaderEl.querySelector('.apl-warning');
    
    if (aplHint) {
        aplHint.textContent = 'No internet connection detected';
        aplHint.style.color = '#f85149';
    }
    
    if (aplWarning) {
        aplWarning.textContent = 'Please check your internet connection and reload the page.';
        aplWarning.style.display = 'block';
        aplWarning.style.color = '#f85149';
    }
    
    // Hide spinner since we're not loading
    const spinner = __pageLoaderEl.querySelector('.apl-spinner');
    if (spinner) {
        spinner.style.display = 'none';
    }
    
    // Add network reconnection listener
    const retryWhenOnline = () => {
        if (navigator.onLine) {
            console.log('🌐 Network detected, reloading app...');
            window.location.reload();
        }
    };
    
    window.addEventListener('online', retryWhenOnline, { once: true });
}

// Single unified initialization (removed duplicates & destructive fallbacks)
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM loaded, init start');
    // Initialize global page loader first
    initPageLoader();
    // Block mobile devices
    if(isMobileDevice()) { showMobileUnsupported(); return; }
    loadSettingsFromCookies();
    loadFavoritesFromCookies();
    if (typeof settings.defaultProxy === 'boolean') isProxyEnabled = settings.defaultProxy; else settings.defaultProxy = false;
    
    // Initialize particle system
    window.particleSystem = new ParticleSystem();
    
    // Apply theme and customizations
    applyTheme();
    
    // Initialize console error capture
    initConsoleErrorCapture();
    
    startApp();
    // Sticky header shadow on scroll
    const header = document.querySelector('.top-header');
    if (header) {
        const onScroll = () => {
            if (window.scrollY > 8) header.classList.add('scrolled'); else header.classList.remove('scrolled');
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }
    initCustomCursor();
});
window.addEventListener('load', () => {
    if (games.length === 0) {
        console.log('⏱️ Post-load retry start');
        startApp();
    }
});

async function startApp() {
    if(__appInitStarted){ return; }
    __appInitStarted = true;
    console.log('🎯 Starting main app initialization...');
    
    // Check if user is offline
    if (!navigator.onLine) {
        console.error('❌ No internet connection detected');
        signalPageLoaderStage('offline');
        showOfflineError();
        return;
    }
    
    try {
        // Initialize DOM elements first
        initializeDOMElements();
        accountLabelEl = document.getElementById('accountLabel');
        logoutModalEl = document.getElementById('logoutConfirmModal');
        logoutConfirmBtn = document.getElementById('logoutConfirmBtn');
        logoutCancelBtn = document.getElementById('logoutCancelBtn');
        
        // Load configuration from backend first
        await loadBackendConfiguration();
        signalPageLoaderStage('config');
        
        // Check maintenance status from backend
        await checkMaintenanceStatus();
        
        // Load games from backend (with immediate fallback)
        await loadGamesWithFallback();
        signalPageLoaderStage('games');
        
        // Setup event listeners
        setupEventListeners();
        await initAuth0();
        signalPageLoaderStage('auth');
        
        // Initialize backend status monitoring
        initBackendStatusMonitoring();
        
        // Force render games immediately
        forceRenderGames();
        
        // Update stats
        updateNavigationStats();
        buildCategoryTabs();
        renderFavoritesSection();
        updateFavoriteButtonState();
        signalPageLoaderStage('ui');
        
        console.log('✅ App initialization complete! Games loaded:', games.length);
        // Final stage triggers hide after min duration
        signalPageLoaderStage('final');
    } catch (error) {
        console.error('❌ App initialization failed:', error);
        
        // Check if this is a network-related error
        if (!navigator.onLine || error.message.includes('Failed to fetch') || error.message.includes('No internet connection') || error.name === 'AbortError') {
            console.error('❌ Network connectivity issue detected');
            showOfflineError();
            return; // Don't hide loader, stay on offline screen
        }
        
        // Show error and hide loader for other errors
        showPopupError('Critical error during app initialization. Please reload the page.');
        hidePageLoader(true);
    }
}

function isMobileDevice(){
    const ua = navigator.userAgent || navigator.vendor || window.opera;
    const smallViewport = Math.max(window.innerWidth, window.innerHeight) < 900; // treat narrow screens as mobile
    return (/android|iphone|ipad|ipod|mobile|blackberry|iemobile|opera mini/i.test(ua) || smallViewport);
}
function showMobileUnsupported(){
    const overlay=document.getElementById('mobileUnsupported');
    if(overlay){ overlay.style.display='flex'; overlay.removeAttribute('aria-hidden'); }
    // Remove main app container to reduce CPU usage
    const app=document.querySelector('.app-container'); if(app) app.style.display='none';
    // Attempt to unregister service workers so they don't run on mobile
    if('serviceWorker' in navigator){ navigator.serviceWorker.getRegistrations().then(regs=> regs.forEach(r=>r.unregister())); }
}

async function loadGamesWithFallback() {
    try {
        await loadGames();
        if (!Array.isArray(games) || games.length === 0) {
            console.warn('⚠️ Games data empty or invalid');
            games = [];
            showGamesLoadFailure();
        }
    } catch (e) {
        console.error('❌ Games load failed', e);
        games = [];
        showGamesLoadFailure();
    }
}

function showGamesLoadFailure(){
    const grid=document.getElementById('allGames');
    if(grid){
        grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1; text-align:center; padding:40px 20px;">
            <div style="font-size:52px; margin-bottom:12px;">⚠️</div>
            <h3 style="margin:0 0 8px; font-size:22px;">Games failed to load</h3>
            <p style="margin:0 0 16px; color:#7d8590;">Please reload the page and try again.</p>
            <button style="background:#238636; border:none; padding:10px 18px; border-radius:8px; cursor:pointer;" onclick="location.reload()">Reload Page</button>
        </div>`;
    }
}

// Load backend configuration
async function loadBackendConfiguration() {
    try {
        console.log('🔄 Loading comprehensive configuration from backend...');
        
        // Check network connectivity first
        if (!navigator.onLine) {
            throw new Error('No internet connection');
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for config
        
        const response = await fetch(`${BACKEND_URL}/api/config`, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const config = await response.json();
        console.log('✅ Backend configuration loaded:', config);
        
        // Store the full admin configuration
        adminConfig = config;
        serverConfig = config; // Keep for backward compatibility
        
        // Update feature flags
        if (config.features) {
            features = { ...features, ...config.features };
            console.log('🔧 Feature flags updated:', features);
        }
        
        // Update UI controls
        if (config.uiControls) {
            uiControls = { ...uiControls, ...config.uiControls };
            console.log('🖼️ UI controls updated:', uiControls);
        }
        
        // Update default user settings (used for new users and reset)
        if (config.defaultUserSettings) {
            // For existing users, only fill in missing settings
            Object.keys(config.defaultUserSettings).forEach(key => {
                if (settings[key] === undefined) {
                    settings[key] = config.defaultUserSettings[key];
                }
            });
            console.log('⚙️ Default settings applied');
        }
        
        // Legacy support for old config format
        if (config.settings) {
            Object.keys(config.settings).forEach(key => {
                if (settings[key] === undefined) {
                    settings[key] = config.settings[key];
                }
            });
        }
        
        // Update maintenance mode from backend
        if (config.maintenanceMode) {
            maintenanceMode = config.maintenanceMode;
            console.log('🔧 Maintenance mode status:', maintenanceMode.enabled ? 'ENABLED' : 'DISABLED');
        }
        
        // Apply feature-based UI changes immediately
        applyFeatureToggles();
        
        return config;
    } catch (error) {
        console.error('❌ Error loading backend configuration:', error);
        // Continue with default configuration
        return null;
    }
}

// Apply feature toggles to the UI
function applyFeatureToggles() {
    // Hide/show elements based on admin configuration
    
    // Search functionality
    if (!features.searchEnabled || !uiControls.showSearchBar) {
        const searchContainer = document.querySelector('.search-container');
        if (searchContainer) searchContainer.style.display = 'none';
    }
    
    // Category filters
    if (!features.categoriesEnabled || !uiControls.showCategoryFilters) {
        const filterBtns = document.querySelector('.filter-btns');
        if (filterBtns) filterBtns.style.display = 'none';
    }
    
    // Settings menu
    if (!features.settingsMenuEnabled || !uiControls.showSettingsButton) {
        const settingsBtn = document.querySelector('[data-page="settings"]');
        if (settingsBtn) settingsBtn.style.display = 'none';
    }
    
    // Proxy toggle in game view
    if (!features.proxyEnabled || !uiControls.showProxyToggle) {
        const proxyToggle = document.getElementById('proxyToggleGame');
        if (proxyToggle) proxyToggle.style.display = 'none';
    }
    
    // Fullscreen button
    if (!features.fullscreenEnabled || !uiControls.showFullscreenButton) {
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        if (fullscreenBtn) fullscreenBtn.style.display = 'none';
    }
    
    // Favorite button
    if (!features.favoritesEnabled || !uiControls.showFavoriteButton) {
        const favoriteBtn = document.getElementById('favoriteBtn');
        if (favoriteBtn) favoriteBtn.style.display = 'none';
    }
    
    // Disable particles if admin disabled them
    if (!features.particlesEnabled) {
        settings.particlesEnabled = false;
    }
    
    // Disable custom cursor if admin disabled it
    if (!features.customCursorEnabled) {
        settings.customCursorEnabled = false;
    }
    
    // Mobile access check
    if (!features.mobileAccessEnabled && isMobileDevice()) {
        showMobileUnsupported();
        return;
    }
    
    console.log('✅ Feature toggles applied');
}

// Check for application updates
async function checkForUpdates() {
    try {
        console.log('🔄 Checking for updates...');
        const response = await fetch(`${BACKEND_URL}/api/version?client=${APP_VERSION}`);
        
        if (!response.ok) {
            console.warn('⚠️ Update check failed:', response.status);
            return;
        }
        
        const versionInfo = await response.json();
        console.log('📊 Version info:', versionInfo);
        
        if (versionInfo.needsUpdate) {
            showUpdateNotification(versionInfo);
        }
        
        return versionInfo;
    } catch (error) {
        console.error('❌ Error checking for updates:', error);
        // Non-critical error, continue without update notification
    }
}

// Show update notification
function showUpdateNotification(versionInfo) {
    // Create update notification
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
        <div class="update-notification-content">
            <div class="update-icon">🔄</div>
            <div class="update-text">
                <h4>Update Available</h4>
                <p>${versionInfo.updateMessage}</p>
                <div class="update-actions">
                    <button class="update-btn-secondary" onclick="this.closest('.update-notification').remove()">Later</button>
                    <button class="update-btn-primary" onclick="performUpdate(this)">Update Now</button>
                </div>
            </div>
        </div>
    `;
    
    // Add styles
    const style = document.createElement('style');
    style.textContent = `
        .update-notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #1e1e2e 0%, #2a2a3e 100%);
            border: 1px solid #58a6ff;
            border-radius: 12px;
            padding: 16px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            z-index: 10000;
            max-width: 350px;
            animation: slideInRight 0.3s ease-out;
        }
        
        .update-notification-content {
            display: flex;
            align-items: flex-start;
            gap: 12px;
        }
        
        .update-icon {
            font-size: 24px;
            animation: pulse 2s infinite;
        }
        
        .update-text h4 {
            margin: 0 0 4px 0;
            color: #58a6ff;
            font-size: 16px;
        }
        
        .update-text p {
            margin: 0 0 12px 0;
            color: #e6e6e6;
            font-size: 14px;
            line-height: 1.4;
        }
        
        .update-actions {
            display: flex;
            gap: 8px;
        }
        
        .update-btn-primary, .update-btn-secondary {
            padding: 6px 12px;
            border: none;
            border-radius: 6px;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .update-btn-primary {
            background: #58a6ff;
            color: white;
        }
        
        .update-btn-primary:hover {
            background: #4a90e2;
        }
        
        .update-btn-secondary {
            background: transparent;
            color: #a6a6a6;
            border: 1px solid #444;
        }
        
        .update-btn-secondary:hover {
            background: rgba(255, 255, 255, 0.1);
        }
        
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(notification);
    
    // Auto-remove after 30 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 30000);
}

// Perform actual update by clearing caches and reloading
async function performUpdate(button) {
    try {
        // Disable button and show updating state
        button.disabled = true;
        button.textContent = 'Updating...';
        
        // Show update modal
        showUpdateModal(button);
        
        // Clear all caches
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        
        // Unregister service workers
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(registration => registration.unregister()));
        }
        
        // Add cache-busting parameter and reload
        const url = new URL(window.location.href);
        url.searchParams.set('v', Date.now());
        window.location.href = url.toString();
        
    } catch (error) {
        console.error('❌ Error during update:', error);
        button.disabled = false;
        button.textContent = 'Update Now';
        showError('Update failed. Please try refreshing manually.');
    }
}

// Check maintenance status (now from backend)
async function checkMaintenanceStatus() {
    try {
        console.log('🔄 Checking maintenance status from backend...');
        const response = await fetch(`${BACKEND_URL}/api/maintenance`);
        
        if (!response.ok) {
            console.warn('⚠️ Failed to fetch maintenance status:', response.status);
            // Fall back to local check
            return checkMaintenanceStatusLocal();
        }
        
        const maintenanceConfig = await response.json();
        maintenanceMode = maintenanceConfig;
        console.log('🔧 Maintenance status from backend:', maintenanceMode.enabled ? 'ENABLED' : 'DISABLED');
        return;
        
    } catch (error) {
        console.warn('⚠️ Failed to check maintenance status from backend:', error);
        // Fall back to local maintenance check
        return checkMaintenanceStatusLocal();
    }
}

// Fallback local maintenance check
async function checkMaintenanceStatusLocal() {
    try {
        // Check for local maintenance mode setting
        const localSetting = localStorage.getItem('ww_maintenance_mode');
        if (localSetting) {
            const setting = JSON.parse(localSetting);
            if (setting && typeof setting.enabled === 'boolean') {
                maintenanceMode = setting;
                console.log('🔧 Maintenance status (local):', maintenanceMode.enabled ? 'ENABLED' : 'DISABLED');
                return;
            }
        }
        
        // Default to disabled
        maintenanceMode.enabled = false;
        console.log('🔧 Maintenance status: DISABLED (default)');
    } catch (error) {
        console.warn('⚠️ Failed to check local maintenance status:', error);
        // Keep maintenance mode disabled on error
        maintenanceMode.enabled = false;
    }
}

function showMaintenanceNotice() {
    const noticeHTML = `
        <div class="maintenance-notice" style="grid-column:1/-1; text-align:center; padding:60px 20px;">
            <div style="font-size:64px; margin-bottom:20px;">🚧</div>
            <h2 style="margin:0 0 12px; font-size:28px; color:#f0f6fc;">Under Maintenance</h2>
            <p style="margin:0 0 8px; color:#8b949e; font-size:18px; max-width:500px; margin-left:auto; margin-right:auto;">${maintenanceMode.message}</p>
            <p style="margin:0; color:#7d8590; font-size:16px;">${maintenanceMode.estimatedTime}</p>
        </div>
    `;
    
    // Show maintenance notice on home page
    const allGamesGrid = document.getElementById('allGames');
    if (allGamesGrid) {
        allGamesGrid.innerHTML = noticeHTML;
    }
    
    // Show maintenance notice on favorites page
    const favoritesGrid = document.getElementById('favoritesPageGrid');
    if (favoritesGrid) {
        favoritesGrid.innerHTML = noticeHTML;
    }
    
    // Hide favorite games section on home page
    const favoriteSection = document.getElementById('favoriteGamesSection');
    if (favoriteSection) {
        favoriteSection.style.display = 'none';
    }
}

function forceRenderGames() {
    console.log('🎨 Force rendering games...');
    console.log('📊 Games to render:', games.length);
    
    const allGamesGrid = document.getElementById('allGames');
    
    if (!allGamesGrid) {
        console.error('❌ Required DOM elements not found!');
        return;
    }
    
    // Check maintenance mode first
    if (maintenanceMode.enabled) {
        showMaintenanceNotice();
        return;
    }
    
    if (games.length === 0) {
        allGamesGrid.innerHTML = '<div class="loading-message">⚠️ No games available</div>';
        return;
    }
    
    // Validate and de-duplicate by id before render
    const seen = new Set();
    const cleaned = games.filter(g => {
        if (!g || typeof g !== 'object') return false;
        if (!g.id || seen.has(g.id)) return false;
        seen.add(g.id);
        return !!g.title && !!g.category && !!g.embed;
    });
    if (cleaned.length !== games.length) {
        console.warn('⚠️ Some game entries invalid or duplicate; cleaned:', cleaned.length, 'original:', games.length);
        games = cleaned;
    }
    allGamesGrid.innerHTML = games.map(game => createGameCard(game)).join('');
    console.log('✅ All games rendered:', games.length);
    renderFavoritesSection();
    
    // Render ads in sidebar
    renderAdColumn();
}


function renderGames() {
    console.log('🎨 Rendering games (delegating to forceRenderGames)...');
    forceRenderGames();
}

function initializeDOMElements() {
    // Get DOM elements
    gamesGrid = document.getElementById('allGames');
    searchInput = document.getElementById('searchInput');
    filterBtns = document.querySelectorAll('.filter-btn');
    gameFrame = document.getElementById('gameFrame');
    fullscreenFrame = document.getElementById('fullscreenFrame');
    fullscreenOverlay = document.getElementById('fullscreenOverlay');
    gamePage = document.getElementById('gamePage');
    homepage = document.getElementById('homePage');
    gameTitle = document.getElementById('gameTitle');
    gameDescription = document.getElementById('gameDescription');
    recommendedGames = document.getElementById('suggestedGames');
    fullscreenBtn = document.querySelector('[data-action="fullscreen"]');
    exitFullscreenBtn = document.querySelector('.exit-fullscreen-btn');
    
    console.log('🔧 DOM elements initialized');
    console.log('🔍 Key elements check:');
    console.log('  - Featured games grid:', !!document.getElementById('featuredGames'));
    console.log('  - All games grid:', !!document.getElementById('allGames'));
    console.log('  - Search input:', !!document.getElementById('searchInput'));
    console.log('  - Game frame:', !!document.getElementById('gameFrame'));
    console.log('  - Suggested games:', !!document.getElementById('suggestedGames'));
}

// ===== Auth0 Integration (SPA) =====
async function initAuth0(){
    // Ensure SDK is present (handles rare race where script not parsed yet)
    try { await ensureAuth0SdkLoaded(); } catch(e){
        console.error('Auth0 SDK failed to load', e);
        const loadingEl=document.getElementById('authLoading');
        if(loadingEl) loadingEl.textContent = 'Auth failed to load (SDK).';
    markAuthUnavailable();
        return;
    }
    try {
        auth0Client = await createAuth0Client(auth0Config);
        // Handle redirect back from Auth0 (code/state present)
        if(!__authRedirectHandled && window.location.search.includes('code=') && window.location.search.includes('state=')){
            try {
                console.log('[Auth0] Processing redirect callback...');
                await auth0Client.handleRedirectCallback();
                __authRedirectHandled = true;
                window.history.replaceState({}, document.title, window.location.pathname);
                console.log('[Auth0] Redirect handled successfully');
            } catch (e){
                console.error('Auth0 redirect error', e);
                const errCode = e?.error || e?.message;
                if(e && (e.error || e.error_description)){
                    console.warn('[Auth0] OAuth error detail:', e.error, e.error_description);
                }
                if(errCode === 'missing_transaction' || /invalid state/i.test(e?.error_description||'')){
                    console.warn('[Auth0] Detected missing transaction / invalid state. Retrying login flow...');
                    // Clean query params to avoid looping
                    window.history.replaceState({}, document.title, window.location.pathname);
                    setTimeout(()=> auth0Client.loginWithRedirect(), 200);
                    return; // halt further UI update until retry
                } else {
                    console.warn('[Auth0] Possible causes:\n' +
                        ' - Callback URL mismatch (check Allowed Callback URLs)\n' +
                        ' - Cleared storage between authorize and token exchange\n' +
                        ' - Multiple inits; now guarded by __appInitStarted flag');
                }
            }
        }
        bindAuthButtons();
        await updateAuthUI();
    } catch (e){
        console.error('Failed to initialize Auth0', e);
        const loadingEl=document.getElementById('authLoading');
        if(loadingEl) loadingEl.textContent = 'Auth initialization failed.';
    }
}

// Poll for SDK availability (in case of slow network or head parsing race)
async function ensureAuth0SdkLoaded(timeoutMs=10000){
    // If already present (e.g. loaded via <script> in index.html) we're done.
    if(window.createAuth0Client || (window.auth0 && window.auth0.createAuth0Client)){
        if(!window.createAuth0Client && window.auth0?.createAuth0Client){
            window.createAuth0Client = window.auth0.createAuth0Client; // normalize for downstream code
        }
        return true;
    }

    // Use generic, unversioned CDN endpoints that resolve to the latest published build.
    // The previously attempted versioned paths returned AccessDenied or 404 (serving HTML -> MIME error).
    // Order chosen for reliability & cache performance.
    const sources = [
        // jsDelivr (auto version resolution)
        'https://cdn.jsdelivr.net/npm/@auth0/auth0-spa-js/dist/auth0-spa-js.production.js',
        // unpkg fallback
        'https://unpkg.com/@auth0/auth0-spa-js/dist/auth0-spa-js.production.js',
        // (Auth0 CDN versioned endpoints removed due to observed AccessDenied responses in this environment)
        // Local/manual fallback (only if user has placed the file)
        './vendor/auth0/auth0-spa-js.production.js'
    ];

    const tried=[];

    function inject(src){
        return new Promise((resolve,reject)=>{
            // Do not purge earlier successful script tags; just add new attempts.
            const s=document.createElement('script');
            s.src=src;
            s.async=true;
            s.dataset.auth0Sdk='true';
            s.onload=()=>resolve(src);
            s.onerror=()=>reject(new Error('load failed '+src));
            document.head.appendChild(s);
        });
    }

    for(const src of sources){
        try {
            tried.push(src);
            await inject(src);
            // Wait briefly for global to appear
            const start=performance.now();
            while(!(window.createAuth0Client || (window.auth0 && window.auth0.createAuth0Client)) && performance.now()-start < 3000){
                await new Promise(r=>setTimeout(r,75));
            }
            if(window.auth0 && window.auth0.createAuth0Client && !window.createAuth0Client){
                window.createAuth0Client = window.auth0.createAuth0Client; // alias for legacy expectation
            }
            if(window.createAuth0Client){
                console.log('[Auth0] SDK loaded from', src);
                return true;
            } else {
                console.warn('[Auth0] Script fetched but window.createAuth0Client missing for', src);
            }
        } catch(e){
            console.warn('[Auth0] SDK load attempt failed for', src, e.message||e);
        }
    }
    throw new Error('Failed to load Auth0 SDK from sources: '+tried.join(' | '));
}

// If authentication is completely unavailable, provide a graceful UI downgrade.
function markAuthUnavailable(){
    const loading=document.getElementById('authLoading');
    if(loading){
        loading.textContent='Authentication temporarily unavailable';
        loading.style.color='#f85149';
    }
    const loggedOut=document.getElementById('authLoggedOut');
    if(loggedOut){
        loggedOut.style.display='block';
        const btn=loggedOut.querySelector('button#loginBtn');
        if(btn){
            btn.disabled=true;
            btn.textContent='Auth Unavailable';
            btn.style.opacity='0.6';
            btn.style.cursor='not-allowed';
        }
    }
}

function bindAuthButtons(){
    // Sidebar account item acts as unified auth control
    const accountNav=document.getElementById('accountNavItem');
    // accountNav click handled via delegated navigation handler; no direct onclick to avoid double firing
    if(accountNav && !accountNav.onclick){
        accountNav.addEventListener('click', (e)=>{
            // Allow navigation handler to capture; if not, manually invoke
            if(!e.defaultPrevented){ e.preventDefault(); handleAccountButton(); }
        });
    }
    const loginBtn=document.getElementById('loginBtn');
    if(loginBtn){ loginBtn.onclick=()=> auth0Client.loginWithRedirect(); }
    const logoutBtn=document.getElementById('logoutBtn');
    if(logoutBtn){ logoutBtn.onclick=()=> openLogoutModal(); }
    if(logoutConfirmBtn){ logoutConfirmBtn.onclick=()=> { 
        if(auth0Client){ 
            try {
                console.debug('[Logout] Starting logout process');
                auth0Client.logout({ 
                    logoutParams: { 
                        returnTo: window.location.origin 
                    } 
                }); 
            } catch(error) {
                console.error('[Logout] Error during logout:', error);
                // Fallback: manually clear and reload
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = window.location.origin;
            }
        } else {
            console.warn('[Logout] auth0Client not available, manual cleanup');
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = window.location.origin;
        }
    }; }
    if(logoutCancelBtn){ logoutCancelBtn.onclick=()=> closeLogoutModal(); }
}

async function handleAccountButton(){
    console.debug('[Auth] handleAccountButton called');
    
    if(!auth0Client){ 
        console.debug('[Auth] No auth0Client, marking unavailable');
        markAuthUnavailable(); 
        return; 
    }
    
    try {
        const isAuth = await socialEnsureAuth();
        console.debug('[Auth] socialEnsureAuth result:', isAuth);
        
        if(!isAuth){ 
            console.debug('[Auth] Not authenticated, redirecting to login');
            auth0Client.loginWithRedirect(); 
            return; 
        }
        
        console.debug('[Auth] User is authenticated, showing dropdown');
        
        let pdEl = document.getElementById('profileDropdown');
        if(!pdEl){
            const hdr=document.querySelector('.sidebar-header');
            if(hdr){
                hdr.insertAdjacentHTML('beforeend', `<div id="profileDropdown" class="profile-dropdown" aria-hidden="true"><ul><li><button type="button" id="openProfileSettingsBtn"><span>Profile Settings</span></button></li><li><button type="button" id="logoutFromDropdownBtn" class="danger"><span>Log out</span></button></li></ul></div>`);
                pdEl=document.getElementById('profileDropdown');
                // Initialize only once right after creation
                profileDropdownEl=null; // reset so init function proceeds
                initProfileDropdown();
            }
        }
        // If already initialized just toggle
        toggleProfileDropdown();
    } catch(e) {
        console.error('[Auth] handleAccountButton error:', e);
        markAuthUnavailable();
    }
}
function openLogoutModal(){ if(logoutModalEl){ logoutModalEl.style.display='flex'; setTimeout(()=> logoutConfirmBtn?.focus(), 30);} }
function closeLogoutModal(){ if(logoutModalEl){ logoutModalEl.style.display='none'; } }

function login() {
    console.debug('[Auth] Login function called');
    if(auth0Client) {
        auth0Client.loginWithRedirect();
    } else {
        console.error('[Auth] Auth0 client not available for login');
    }
}

async function refreshAuthState() {
    console.debug('[Auth] Refreshing authentication state');
    
    // Update the auth UI
    await updateAuthUI();
    
    // If friends page is currently visible, re-render it
    const friendsPage = document.getElementById('friendsPage');
    if(friendsPage && friendsPage.style.display !== 'none') {
        console.debug('[Auth] Friends page visible, re-rendering');
        await renderFriendsPage();
    }
}

async function updateAuthUI(){
    if(!auth0Client){ 
        if(accountLabelEl) accountLabelEl.textContent='Auth...'; 
        return; 
    }
    
    try {
        const isAuth = await socialEnsureAuth();
        console.debug('[Auth] updateAuthUI - isAuth:', isAuth);
        
        if(isAuth){
            try {
                const user = await auth0Client.getUser();
                const label = user && (user.given_name || user.nickname || user.name || user.email);
                if(accountLabelEl) accountLabelEl.textContent = label || 'Account';
                console.debug('[Auth] Updated UI for authenticated user:', label);
            } catch(userError) {
                console.error('[Auth] Error getting user info:', userError);
                if(accountLabelEl) accountLabelEl.textContent = 'Account';
            }
        } else {
            if(accountLabelEl) accountLabelEl.textContent='Sign in';
            console.debug('[Auth] Updated UI for unauthenticated user');
        }
    } catch(e){
        console.error('[Auth] updateAuthUI error:', e);
        if(accountLabelEl) accountLabelEl.textContent='Auth error';
    }
}

// Load games from backend API
async function loadGames() {
    try {
        console.log('🔄 Loading games from backend API...');
        const response = await fetch(`${BACKEND_URL}/api/games`);
        console.log('📡 Fetch response status:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📊 Raw JSON data from backend:', data);
        
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('Invalid or empty games data');
        }
        
        // Update thumbnail URLs to use backend API
        games = data.map(game => ({
            ...game,
            thumbnail: game.thumbnail.startsWith('/api/thumbnails/') 
                ? `${BACKEND_URL}${game.thumbnail}` 
                : game.thumbnail
        }));
        
        console.log(`✅ Successfully loaded ${games.length} games from backend`);
        return games;
    } catch (error) {
        console.error('❌ Error loading games from backend:', error);
        showPopupError('Failed to load games from backend. Please try again later.');
        games = [];
        return games;
    }
}

// Setup event listeners
function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Navigation
    document.addEventListener('click', handleNavigation);
    
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.querySelector('.search-btn');
    
    if (searchInput) {
        console.log('Search input found, adding debounced listeners');
        let debounceTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(()=> handleSearch(), 150);
        });
        searchInput.addEventListener('keypress', (e)=>{ if(e.key==='Enter'){ handleSearch(); }});
    }
    
    if (searchBtn) {
        console.log('Search button found, adding listener');
        searchBtn.addEventListener('click', handleSearch);
    } else {
        console.warn('Search button not found');
    }
    
    // Game controls
    document.addEventListener('change', handleProxyToggle);
    document.addEventListener('click', handleGameActions);
    
    // Fullscreen controls
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    console.log('Event listeners setup complete');
}

// Navigation handler
function handleNavigation(e) {
    console.log('Navigation click detected:', e.target);
    
    // Sidebar navigation
    if (e.target.closest('.nav-link')) {
        console.log('Nav link clicked');
        e.preventDefault();
        const navItem = e.target.closest('.nav-item');
        if (!navItem) {
            console.warn('Nav item not found');
            return;
        }
        
        const page = navItem.dataset.page; // Get page from nav-item instead of nav-link
        const category = navItem.dataset.category;
        
        console.log('Navigating to page:', page, 'or category:', category);
        
        // Update active nav state (account button does not toggle pages)
        if(navItem.id !== 'accountNavItem'){
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            navItem.classList.add('active');
        }
        
        // Show appropriate page or filter by category
    if (navItem.id === 'accountNavItem') { /* allow dedicated listener to handle; fallback if none */ if(typeof toggleProfileDropdown==='function'){ handleAccountButton(); } else { handleAccountButton(); } return; }
    if (page) {
            switch (page) {
                case 'home':
                    showHomePage();
                    break;
                case 'categories':
                    showCategoriesPage();
                    break;
                case 'favorites':
                    showFavoritesPage();
                    break;
                case 'friends':
                    showFriendsPage();
                    break;
                case 'settings':
                    showSettingsPage();
                    break;
                default:
                    console.warn('Unknown page:', page);
            }
        } else if (category) {
            filterByCategory(category);
        }
        return;
    }
    
    // Game card clicks
    if (e.target.closest('.game-card')) {
        console.log('Game card clicked');
        
        // Check maintenance mode
        if (maintenanceMode.enabled) {
            console.log('🚧 Game access blocked due to maintenance mode');
            return;
        }
        
        const gameCard = e.target.closest('.game-card');
        const gameId = parseInt(gameCard.dataset.gameId);
        const game = games.find(g => g.id === gameId);
        if (game) {
            console.log('Loading game:', game.title);
            showGamePage(game);
        } else {
            console.warn('Game not found for ID:', gameId);
        }
        return;
    }
    
    // Suggested game card clicks
    if (e.target.closest('.suggested-game-card')) {
        console.log('Suggested game card clicked');
        
        // Check maintenance mode
        if (maintenanceMode.enabled) {
            console.log('🚧 Game access blocked due to maintenance mode');
            return;
        }
        
        const gameCard = e.target.closest('.suggested-game-card');
        const gameId = parseInt(gameCard.dataset.gameId);
        const game = games.find(g => g.id === gameId);
        if (game) {
            console.log('Loading suggested game:', game.title);
            showGamePage(game);
        }
        return;
    }
    
    // Back button - remove since we're using sidebar home
    if (e.target.closest('.back-btn')) {
        e.preventDefault();
        showHomePage();
        return;
    }
    
    // Category card clicks
    if (e.target.closest('.category-card')) {
        const categoryCard = e.target.closest('.category-card');
        const category = categoryCard.dataset.category;
        if (category) {
            filterByCategory(category);
        }
        return;
    }
    
    // Recommended game clicks
    if (e.target.closest('.recommended-item')) {
        const gameId = parseInt(e.target.closest('.recommended-item').dataset.gameId);
        const game = games.find(g => g.id === gameId);
        if (game) {
            showGamePage(game);
        }
        return;
    }
}

// Search handler
function handleSearch() {
    const searchInput = document.getElementById('searchInput');
    if(!searchInput) return;
    
    const query = searchInput.value.toLowerCase().trim();
    
    if (!query) {
        showHomePage();
        return;
    }
    
    const filteredGames = games.filter(game => {
        const t = (game.title||'').toLowerCase();
        const c = (game.category||'').toLowerCase();
        const d = (game.description||'').toLowerCase();
        return t.includes(query) || c.includes(query) || d.includes(query);
    });
    
    showSearchResults(query, filteredGames);
}

// Game actions handler
function handleGameActions(e) {
    // Play button
    if (e.target.closest('.play-btn')) {
        const game = currentGame;
        if (game) {
            loadGame(game);
        }
    }
    
    // Fullscreen button
    if (e.target.closest('[data-action="fullscreen"]')) {
        toggleFullscreen();
    }
    // Favorite toggle
    if (e.target.closest('[data-action="favorite"]')) {
        if (currentGame) {
            toggleFavorite(currentGame);
            updateFavoriteButtonState();
            renderFavoritesSection();
        } else {
            showError('Open a game first to favorite it');
        }
    }
    // Game page proxy toggle (visual cloud button)
    if (e.target.closest('.proxy-toggle-visual')) {
        if (currentGame) {
            toggleGameProxy();
        } else {
            // If somehow clicked outside game context ignore
            console.log('Proxy toggle clicked outside game context');
        }
    }
    
    // Exit fullscreen
    if (e.target.closest('.exit-fullscreen-btn')) {
        exitFullscreen();
    }
}

// Proxy toggle handler
function handleProxyToggle(e) {
    const visual = e.target.closest('.proxy-toggle-visual');
    if (visual) {
        isProxyEnabled = !visual.classList.contains('on');
        settings.defaultProxy = isProxyEnabled;
        saveSettingsToCookies();
        updateProxyVisuals();
        if (currentGame) loadGame(currentGame);
        console.log('Proxy toggled:', isProxyEnabled ? 'enabled' : 'disabled');
    }
}

// Keyboard shortcuts
function handleKeyboardShortcuts(e) {
    if (e.key === 'Escape') {
        exitFullscreen();
    }
    
    if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
    }
    
    if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
    }
}

// Page display functions
function showHomePage(){
    ensureHomePage();
    hideAllPages();
    currentGame=null;
    const gf=document.getElementById('gameFrame'); if(gf) gf.src='about:blank';
    const hp=document.getElementById('homePage'); if(hp) hp.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));
    const homeNavItem=document.querySelector('[data-page="home"]'); if(homeNavItem) homeNavItem.classList.add('active');
    const searchEl=document.getElementById('searchInput'); if(searchEl) searchEl.value='';
    const titleEl=document.querySelector('#homePage .section-title'); if(titleEl) titleEl.textContent='All Games';
    forceRenderGames();
    buildCategoryTabs();
    renderFavoritesSection();
    
    // Show main content offline overlay if currently offline
    if (document.body.classList.contains('offline-mode')) {
        showMainContentOfflineOverlay();
    }
}

function showCategoriesPage() {
    hideAllPages();
    
    // Filter to show popular/featured games
    const contentArea = document.querySelector('.content-area');
    contentArea.innerHTML = `
        <div class="page active">
            <section class="games-section">
                <div class="section-header">
                    <h2 class="section-title">Categories</h2>
                </div>
                <div class="category-grid">
                    <div class="category-card" data-category="puzzle">
                        <div class="category-icon">🧩</div>
                        <h3>Puzzle</h3>
                        <p>Brain-training games</p>
                    </div>
                    <div class="category-card" data-category="action">
                        <div class="category-icon">⚡</div>
                        <h3>Action</h3>
                        <p>Fast-paced excitement</p>
                    </div>
                    <div class="category-card" data-category="adventure">
                        <div class="category-icon">🗺️</div>
                        <h3>Adventure</h3>
                        <p>Explore new worlds</p>
                    </div>
                    <div class="category-card" data-category="sports">
                        <div class="category-icon">⚽</div>
                        <h3>Sports</h3>
                        <p>Athletic challenges</p>
                    </div>
                    <div class="category-card" data-category="strategy">
                        <div class="category-icon">♟️</div>
                        <h3>Strategy</h3>
                        <p>Think and conquer</p>
                    </div>
                    <div class="category-card" data-category="arcade">
                        <div class="category-icon">🕹️</div>
                        <h3>Arcade</h3>
                        <p>Classic gaming fun</p>
                    </div>
                </div>
            </section>
        </div>
    `;
}

function showFavoritesPage(){
    ensureFavoritesPage();
    hideAllPages(true);
    const fav=document.getElementById('favoritesPage'); if(fav){ fav.classList.add('active'); fav.style.display='block'; }
    renderFavoritesPage();
    
    // Show main content offline overlay if currently offline
    if (document.body.classList.contains('offline-mode')) {
        showMainContentOfflineOverlay();
    }
}

function showSettingsPage(){
    ensureSettingsPage();
    hideAllPages(true);
    const pg=document.getElementById('settingsPage'); if(pg){ pg.classList.add('active'); pg.style.display='block'; }
    const chk=document.getElementById('proxyToggleSetting'); if(chk) chk.checked=isProxyEnabled;
    const maintenanceChk=document.getElementById('maintenanceToggleSetting'); if(maintenanceChk) maintenanceChk.checked=maintenanceMode.enabled;
}

function showGamePage(game) {
    console.log('Showing game page for:', game.title);
    currentGame = game;
    hideAllPages(true); // hide everything fully
    
    // Clear the previous game iframe
    const gameFrame = document.getElementById('gameFrame');
    if (gameFrame) {
        gameFrame.src = 'about:blank';
    }
    
    const gp=document.getElementById('gamePage');
    if(gp){ gp.style.display='block'; gp.classList.add('active'); }
    
    // Update game info
    const gameTitle = document.getElementById('gameTitle');
    const gameCategory = document.getElementById('gameCategory');
    const gameDescription = document.getElementById('gameDescription');
    const proxyToggleGame = document.getElementById('proxyToggleGame');

    // Ensure visibility if previously hidden by legacy CSS
    [gameTitle, gameCategory, proxyToggleGame].forEach(el => {
        if (el) {
            el.style.opacity = '1';
            el.style.visibility = 'visible';
        }
    });
    
    if (gameTitle) gameTitle.textContent = sanitize(game.title);
    if (gameCategory) gameCategory.textContent = sanitize(game.category);
    
    // Determine per-game proxy setting (override or default)
    isProxyEnabled = gameProxyOverrides[game.id] !== undefined ? gameProxyOverrides[game.id] : settings.defaultProxy;
    if (proxyToggleGame) {
        proxyToggleGame.classList.toggle('on', isProxyEnabled);
        proxyToggleGame.classList.toggle('off', !isProxyEnabled);
        proxyToggleGame.setAttribute('aria-pressed', isProxyEnabled ? 'true':'false');
        proxyToggleGame.title = isProxyEnabled ? 'Proxy Enabled' : 'Proxy Disabled';
    }
    
    // Set game description (generate a description if not available)
    if (gameDescription) {
        const description = game.description || generateGameDescription(game);
        gameDescription.textContent = description;
    }
    
    // Build ads in sidebar instead of suggested games
    renderAdColumn();
    
    // Load the game after a brief delay to ensure iframe is ready
    setTimeout(() => {
        loadGame(game);
        
        // Show game offline overlay if currently offline
        if (document.body.classList.contains('offline-mode')) {
            showGameOfflineOverlay();
        }
    }, 100);
    // Update favorite heart state now that currentGame is set
    updateFavoriteButtonState();
}

function generateGameDescription(game) {
    // Generate a description based on the game's category and title
    const descriptions = {
        'puzzle': `${game.title} is an engaging puzzle game that will challenge your problem-solving skills. Test your logic and reasoning as you work through increasingly complex challenges.`,
        'action': `Experience fast-paced action in ${game.title}! This thrilling game combines quick reflexes with strategic thinking for an adrenaline-pumping gaming experience.`,
        'adventure': `Embark on an epic journey in ${game.title}. Explore vast worlds, discover hidden secrets, and experience an unforgettable adventure.`,
        'strategy': `${game.title} is a strategic masterpiece that requires careful planning and tactical thinking. Outsmart your opponents and claim victory through superior strategy.`,
        'arcade': `${game.title} brings classic arcade gaming to your browser. Enjoy simple controls, addictive gameplay, and hours of entertainment.`,
        'sports': `Get ready for athletic competition in ${game.title}. Experience the thrill of sports with realistic gameplay and exciting challenges.`,
        'default': `${game.title} is an exciting game that offers engaging gameplay and entertainment. Dive in and discover what makes this game special.`
    };
    
    return descriptions[game.category.toLowerCase()] || descriptions['default'];
}

// Replace suggested games with ads
function renderAdColumn(){
    console.log('🎯 Rendering ad column...');
    const col=document.getElementById('adColumn');
    if(!col) {
        console.error('❌ Ad column element not found');
        return;
    }
    col.innerHTML='';
    // Determine number of ads based on viewport & content height (min 2, up to 6)
    const base = Math.ceil(window.innerHeight / 300); // rough vertical capacity
    const count = Math.min(Math.max(base,2),6);
    console.log(`📊 Creating ${count} ad slots for viewport height ${window.innerHeight}px`);
    
    for(let i=0;i<count;i++){
        const slot=document.createElement('div');
        slot.className='ad-slot loading';
    // Insert provided ad snippet with full coverage and unique IDs
    slot.innerHTML = `<div class="ad-frame" style="width: 100%; height: 100%; margin: 0; background: rgba(0, 0, 0, 0.50); position: absolute; top: 0; left: 0; z-index: 1;">
          <iframe data-aa='2408693' src='//acceptable.a-ads.com/2408693/?size=Adaptive'
                            style='border:0; padding:0; width:100%; height:100%; overflow:hidden; display: block; position: absolute; top: 0; left: 0;'></iframe>
        </div>`;
    // Remove loading class once iframe loads
    const innerFrame = slot.querySelector('iframe');
    if(innerFrame){ 
        innerFrame.addEventListener('load', ()=> {
            slot.classList.remove('loading');
            console.log('✅ Ad loaded in slot', i+1);
        });
        innerFrame.addEventListener('error', ()=> {
            console.warn('❌ Ad failed to load in slot', i+1);
            slot.classList.remove('loading');
        });
    }
        col.appendChild(slot);
    }
    console.log(`✅ Ad column rendered with ${count} slots`);
}

// (Removed suggested game card creation in favor of ads)

function showCategoriesPage() {
    hideAllPages();
    showError('Categories page coming soon!');
}


function filterByCategory(category){
    ensureHomePage(); hideAllPages(); const hp=document.getElementById('homePage'); if(hp) hp.classList.add('active');
    let filtered=[];
    switch(category){
        case 'new': filtered=[...games].sort((a,b)=>b.id-a.id).slice(0,12); break;
        case 'popular': filtered=games.slice(0,12); break; // placeholder metric
        case 'updated': filtered=games.slice(-12); break; // placeholder metric
        default: filtered=games.filter(g=> (g.category||'').toLowerCase()===category.toLowerCase());
    }
    const grid=document.getElementById('allGames');
    const title=document.querySelector('#homePage .section-title');
    if(grid) grid.innerHTML = filtered.length? filtered.map(g=>createGameCard(g)).join('') : '<div style="grid-column:1/-1; text-align:center; padding:30px; color:#7d8590;">No games found.</div>';
    if(title) title.textContent=`${capitalize(category)} Games (${filtered.length})`;
}

function showSearchResults(query, results){
    ensureHomePage(); hideAllPages(); const hp=document.getElementById('homePage'); if(hp) hp.classList.add('active');
    const grid=document.getElementById('allGames'); const title=document.querySelector('#homePage .section-title');
    if(title) title.textContent=`Results for "${query}" (${results.length})`;
    if(grid) grid.innerHTML = results.length? results.map(g=>createGameCard(g)).join('') : '<div style="grid-column:1/-1; text-align:center; padding:30px; color:#7d8590;">No games found.</div>';
}

function hideAllPages(forceDisplayNone=false) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
        if(forceDisplayNone || page.id!=='homePage') page.style.display='none';
    });
    const home=document.getElementById('homePage'); if(home && !forceDisplayNone){ home.style.display='block'; }
}

// Game rendering functions
function renderFeaturedGames() {
    console.log('renderFeaturedGames called, games.length:', games.length);
    const featuredGames = games.slice(0, 6); // First 6 games as featured
    const featuredGrid = document.getElementById('featuredGames');
    
    console.log('Featured grid element found:', !!featuredGrid);
    console.log('Featured games to render:', featuredGames.length);
    
    if (featuredGrid && featuredGames.length > 0) {
        console.log('Rendering', featuredGames.length, 'featured games');
        featuredGrid.innerHTML = featuredGames.map(game => createGameCard(game, true)).join('');
        console.log('Featured games rendered successfully');
    } else {
        console.log('Featured games container not found or no games available');
        console.log('featuredGrid:', featuredGrid);
        console.log('featuredGames.length:', featuredGames.length);
    }
}

function renderGamesByCategory() {
    console.log('renderGamesByCategory called, games.length:', games.length);
    const allGamesContainer = document.getElementById('allGames');
    
    console.log('All games container found:', !!allGamesContainer);
    
    if (allGamesContainer && games.length > 0) {
        console.log('Rendering', games.length, 'total games');
        allGamesContainer.innerHTML = games.map(game => createGameCard(game)).join('');
        console.log('All games rendered successfully');
    } else {
        console.log('All games container not found or no games available');
        console.log('allGamesContainer:', allGamesContainer);
        console.log('games.length:', games.length);
    }
}

function renderRecommendedGames(currentGame) {
    // Recommended games removed in simplified layout
    console.log('Recommended games disabled in new simplified layout');
}

function createGameCard(game, isFeatured = false) {
    const thumbnailUrl = game.thumbnail || `https://via.placeholder.com/300x200/6366f1/ffffff`;
    
    return `
        <div class="game-card" data-game-id="${game.id}">
            <img src="${thumbnailUrl}" alt="${sanitize(game.title)}" loading="lazy">
            <div class="game-card-overlay">
                <div class="overlay-title">${sanitize(game.title)}</div>
                <div class="overlay-category">${sanitize(game.category)}</div>
            </div>
        </div>`;
}

// Game loading
function loadGame(game) {
    // Check maintenance mode first
    if (maintenanceMode.enabled) {
        console.log('🚧 Game loading blocked due to maintenance mode');
        showHomePage(); // Redirect back to home page
        return;
    }
    
    const gameFrame = document.getElementById('gameFrame');
    if (!gameFrame) {
        console.error('Game frame not found');
        return;
    }
    
    console.log('Loading game:', game.title);
    
    try {
        let gameUrl = game.embed; // Use 'embed' field from JSON
        if (!isValidUrl(gameUrl)) {
            showGameError('Invalid game URL');
            return;
        }
        
        // Apply proxy if enabled (now using backend proxy)
        if (isProxyEnabled && !gameUrl.startsWith(proxyUrl)) {
            // Use ?url= parameter format which is standard for the backend proxy
            gameUrl = proxyUrl + '?url=' + encodeURIComponent(gameUrl);
        } else if (!isProxyEnabled && gameUrl.startsWith(proxyUrl)) {
            // Extract URL from proxy format
            if (gameUrl.includes('?url=')) {
                gameUrl = decodeURIComponent(gameUrl.split('?url=')[1]);
            } else {
                gameUrl = decodeURIComponent(gameUrl.replace(proxyUrl + '/', ''));
            }
        }
        
        console.log('Loading game URL:', gameUrl);
        
        // Loading overlay handling
        startGameLoadingOverlay(gameUrl);

        // Clear any previous handlers
        gameFrame.onload = null; gameFrame.onerror = null;
        gameFrame.src = gameUrl;
        gameFrame.onload = () => { finishGameLoadingOverlay(true); };
        gameFrame.onerror = () => { finishGameLoadingOverlay(false); showGameError('Failed to load game. Try enabling/disabling proxy or try another game.'); };

        // Add timeout probe
        setTimeout(() => {
            try {
                if (gameFrame.contentDocument || gameFrame.contentWindow) {
                    console.log('Game appears to be loading...');
                } else if (!isProxyEnabled) {
                    showGameError('Game blocked. Try enabling proxy to bypass restrictions.');
                }
            } catch (e) {
                console.log('Cross-origin content (expected)');
            }
        }, 3000);
    } catch (error) {
        console.error('Error loading game:', error);
        showGameError('Error loading game. Please check the URL and try again.');
    }
}

function showGameError(message) {
    const gameFrame = document.getElementById('gameFrame');
    if (!gameFrame) return;
    
    // Remove any existing error messages
    const existingError = gameFrame.parentElement.querySelector('.game-error');
    if (existingError) existingError.remove();
    
    // Create error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'game-error';
    errorDiv.innerHTML = `
        <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #161b22;
            border: 1px solid #f85149;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            color: #f85149;
            z-index: 10;
        ">
            <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 10px;"></i>
            <div>${message}</div>
        </div>
    `;
    
    gameFrame.parentElement.style.position = 'relative';
    gameFrame.parentElement.appendChild(errorDiv);
}

// Fullscreen functionality
function toggleFullscreen() {
    const fullscreenOverlay = document.getElementById('fullscreenOverlay');
    const gameFrame = document.getElementById('gameFrame');
    const fullscreenFrame = document.getElementById('fullscreenFrame');
    
    if (!currentGame) {
        showError('No game is currently loaded');
        return;
    }
    
    fullscreenOverlay.classList.add('active');
    fullscreenFrame.src = gameFrame.src;
}

function exitFullscreen() {
    const fullscreenOverlay = document.getElementById('fullscreenOverlay');
    const fullscreenFrame = document.getElementById('fullscreenFrame');
    
    fullscreenOverlay.classList.remove('active');
    fullscreenFrame.src = '';
}

// Utility functions
function updateNavigationStats() {
    const totalGamesElement = document.querySelector('[data-stat="games"]');
    const categoriesElement = document.querySelector('[data-stat="categories"]');
    
    if (totalGamesElement && games.length > 0) {
        totalGamesElement.textContent = games.length;
        console.log('Updated games count:', games.length);
    }
    
    if (categoriesElement && games.length > 0) {
        const uniqueCategories = [...new Set(games.map(game => game.category))];
        categoriesElement.textContent = uniqueCategories.length;
        console.log('Updated categories count:', uniqueCategories.length);
    }
}

function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

function showError(message) {
    console.error('App Error:', message);
    showNotification(message, 'error');
}

function showNotification(message, type = 'info', duration = 5000) {
    // Create notification container if it doesn't exist
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    // Define icons and type text
    const typeInfo = {
        error: { icon: '❌', text: 'Error' },
        success: { icon: '✅', text: 'Success' },
        warning: { icon: '⚠️', text: 'Warning' },
        info: { icon: 'ℹ️', text: 'Info' }
    };
    
    const { icon, text } = typeInfo[type] || typeInfo.info;
    
    notification.innerHTML = `
        <div class="notification-header">
            <div class="notification-header-left">
                <span class="notification-icon">${icon}</span>
                <span class="notification-type">${text}</span>
            </div>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
        <div class="notification-message">${message}</div>
    `;
    
    // Add animation class
    notification.style.transform = 'translateX(100%)';
    notification.style.opacity = '0';
    
    // Add to bottom of container (will appear at bottom due to flex-direction: column-reverse)
    container.appendChild(notification);
    
    // Trigger entrance animation
    requestAnimationFrame(() => {
        notification.style.transform = 'translateX(0)';
        notification.style.opacity = '1';
    });
    
    // Auto-remove after duration
    if (duration > 0) {
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.transform = 'translateX(100%)';
                notification.style.opacity = '0';
                setTimeout(() => {
                    if (notification.parentElement) {
                        notification.remove();
                    }
                }, 300);
            }
        }, duration);
    }
    
    return notification;
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showWarning(message) {
    showNotification(message, 'warning');
}

// ===== Console Error Capture =====
function initConsoleErrorCapture() {
    // Capture console.error calls
    const originalError = console.error;
    console.error = function(...args) {
        originalError.apply(console, args);
        
        // Format error message
        const message = args.map(arg => 
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        
        // Show notification for console errors
        if (message && !message.includes('Auth0') && !message.includes('404')) {
            const notification = showNotification(
                `Console Error: ${message.substring(0, 200)}${message.length > 200 ? '...' : ''}`,
                'error',
                8000
            );
            notification.classList.add('console-error-notification');
        }
    };

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
        const message = event.reason?.message || event.reason || 'Unhandled promise rejection';
        if (!message.includes('Auth0') && !message.includes('404')) {
            showNotification(`Unhandled Error: ${message}`, 'error', 8000);
        }
    });

    // Capture JavaScript errors
    window.addEventListener('error', (event) => {
        const message = event.message || 'JavaScript error occurred';
        if (!message.includes('Auth0') && !message.includes('404')) {
            showNotification(`Script Error: ${message}`, 'error', 8000);
        }
    });
}

// Popup error function for critical errors
function showPopupError(message) {
    showError(message);
}

// Service Worker registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Debug function for testing
window.debugWaterWall = function() {
    // Safe lightweight debug helper (removed stray async/await & undefined vars)
    console.log('=== WaterWall Debug Info ===');
    console.log('Games array length:', games.length);
    console.log('Sample game:', games[0]);
    console.log('Favorites:', favorites);
    console.log('Settings:', settings, 'Proxy Enabled:', isProxyEnabled);
    console.log('Current Game:', currentGame?.title || null);
    console.log('Auth0 Client init:', !!auth0Client);
    console.log('DOM Elements:', {
        featured: !!document.getElementById('featuredGames'),
        all: !!document.getElementById('allGames'),
        gameFrame: !!document.getElementById('gameFrame')
    });
};

// ===== Added Utility / Page Helpers =====
function sanitize(str){
    return (str==null?''+'' : String(str))
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
}
function capitalize(s){ return s? s.charAt(0).toUpperCase()+s.slice(1):''; }

function ensureHomePage(){
    if(document.getElementById('homePage')) return;
    const ca=document.querySelector('.content-area'); if(!ca) return;
    ca.insertAdjacentHTML('afterbegin', `
        <div id="homePage" class="page active">
            <section id="favoriteGamesSection" class="games-section" style="display:none;">
                <div class="section-header"><h2 class="section-title"><i class="fas fa-heart" style="color:#e25555;"></i> Favorite Games</h2></div>
                <div class="games-grid" id="favoriteGamesGrid"></div>
            </section>
            <section class="games-section">
                <div class="section-header"><h2 class="section-title">All Games</h2><div id="categoryTabs" class="category-tabs"></div></div>
                <div class="games-grid" id="allGames"></div>
            </section>
        </div>`);
}
function ensureFavoritesPage(){
    if(document.getElementById('favoritesPage')) return;
    const ca=document.querySelector('.content-area'); if(!ca) return;
    ca.insertAdjacentHTML('beforeend', `
        <div id="favoritesPage" class="page">
            <section class="games-section">
                <div class="section-header"><h2 class="section-title">Favorite Games</h2></div>
                <div class="games-grid" id="favoritesPageGrid"></div>
                <div id="favoritesEmptyState" class="empty-state" style="display:none; grid-column:1/-1; text-align:center; padding:40px 20px;">
                    <div style="font-size:48px; margin-bottom:10px;">❤️</div>
                    <h3 style="margin:0 0 6px; font-size:22px;">No favorites yet</h3>
                    <p style="margin:0; color:#7d8590;">Open a game and tap the heart to add it.</p>
                </div>
            </section>
        </div>`);
}
function ensureSettingsPage(){
    if(document.getElementById('settingsPage')) return;
    const ca=document.querySelector('.content-area'); if(!ca) return;
    ca.insertAdjacentHTML('beforeend', `
        <div id="settingsPage" class="page">
            <section class="games-section">
                <div class="section-header"><h2 class="section-title">Settings</h2></div>
                <div class="settings-content">
                    <div class="setting-group collapsible">
                        <div class="setting-group-header" onclick="toggleSettingGroup(this)">
                            <h3>Appearance</h3>
                            <i class="fas fa-chevron-down setting-group-arrow"></i>
                        </div>
                        <div class="setting-group-content">
                            <div class="setting-item">
                                <label class="color-setting">
                                    <span class="setting-title">Accent Color</span>
                                    <span class="setting-sub">Choose your preferred accent color</span>
                                    <input type="color" id="accentColorSetting" value="${settings.accentColor}" onchange="(function(el){settings.accentColor=el.value;saveSettingsToCookies();applyTheme();})(this)" class="color-input">
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <div class="setting-group collapsible">
                        <div class="setting-group-header" onclick="toggleSettingGroup(this)">
                            <h3>Cursor Settings</h3>
                            <i class="fas fa-chevron-down setting-group-arrow"></i>
                        </div>
                        <div class="setting-group-content">
                            <div class="setting-item">
                                <label class="switch-row" for="customCursorSetting">
                                    <div class="switch-text">
                                        <span class="setting-title">Custom Cursor</span>
                                        <span class="setting-sub">Use custom cursor instead of system default</span>
                                    </div>
                                    <input type="checkbox" id="customCursorSetting" class="ww-switch-input" ${settings.customCursorEnabled?'checked':''} onchange="(function(el){settings.customCursorEnabled=el.checked;saveSettingsToCookies();applyTheme();})(this)">
                                    <span class="ww-switch" aria-hidden="true"></span>
                                </label>
                            </div>
                            <div class="setting-item">
                                <label class="range-setting">
                                    <span class="setting-title">Cursor Size</span>
                                    <span class="setting-sub">Adjust the size of the custom cursor</span>
                                    <input type="range" id="cursorSizeSetting" min="4" max="20" value="${settings.cursorSize}" onchange="(function(el){settings.cursorSize=parseInt(el.value);saveSettingsToCookies();applyTheme();document.getElementById('cursorSizeValue').textContent=el.value+'px';})(this)" class="range-input">
                                    <span id="cursorSizeValue">${settings.cursorSize}px</span>
                                </label>
                            </div>
                            <div class="setting-item">
                                <label class="color-setting">
                                    <span class="setting-title">Cursor Color</span>
                                    <span class="setting-sub">Choose your cursor color</span>
                                    <input type="color" id="cursorColorSetting" value="${settings.cursorColor}" onchange="(function(el){settings.cursorColor=el.value;saveSettingsToCookies();applyTheme();})(this)" class="color-input">
                                </label>
                            </div>
                            <div class="setting-item">
                                <label class="select-setting">
                                    <span class="setting-title">Cursor Type</span>
                                    <span class="setting-sub">Choose cursor style</span>
                                    <select id="cursorTypeSetting" onchange="(function(el){settings.cursorType=el.value;saveSettingsToCookies();applyTheme();})(this)" class="select-input">
                                        <option value="circle" ${settings.cursorType==='circle'?'selected':''}>Circle</option>
                                        <option value="arrow" ${settings.cursorType==='arrow'?'selected':''}>Triangle Arrow</option>
                                        <option value="custom" ${settings.cursorType==='custom'?'selected':''}>Custom Image</option>
                                    </select>
                                </label>
                            </div>
                            <div class="setting-item">
                                <label class="file-setting">
                                    <span class="setting-title">Custom Cursor Image</span>
                                    <span class="setting-sub">Upload a custom cursor image</span>
                                    <input type="file" id="customCursorImage" accept="image/*" onchange="handleCustomCursorUpload(this)" class="file-input">
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <div class="setting-group collapsible">
                        <div class="setting-group-header" onclick="toggleSettingGroup(this)">
                            <h3>Background Particles</h3>
                            <i class="fas fa-chevron-down setting-group-arrow"></i>
                        </div>
                        <div class="setting-group-content">
                            <div class="setting-item">
                                <label class="switch-row" for="particlesEnabledSetting">
                                    <div class="switch-text">
                                        <span class="setting-title">Enable Particles</span>
                                        <span class="setting-sub">Show animated background particles</span>
                                    </div>
                                    <input type="checkbox" id="particlesEnabledSetting" class="ww-switch-input" ${settings.particlesEnabled?'checked':''} onchange="(function(el){settings.particlesEnabled=el.checked;saveSettingsToCookies();applyParticleSettings();})(this)">
                                    <span class="ww-switch" aria-hidden="true"></span>
                                </label>
                            </div>
                            <div class="setting-item">
                                <label class="range-setting">
                                    <span class="setting-title">Particle Speed</span>
                                    <span class="setting-sub">Control how fast particles move</span>
                                    <input type="range" id="particleSpeedSetting" min="0.1" max="2" step="0.1" value="${settings.particleSpeed}" onchange="(function(el){settings.particleSpeed=parseFloat(el.value);saveSettingsToCookies();applyParticleSettings();document.getElementById('particleSpeedValue').textContent=el.value;})(this)" class="range-input">
                                    <span id="particleSpeedValue">${settings.particleSpeed}</span>
                                </label>
                            </div>
                            <div class="setting-item">
                                <label class="range-setting">
                                    <span class="setting-title">Particle Count</span>
                                    <span class="setting-sub">Number of particles on screen</span>
                                    <input type="range" id="particleCountSetting" min="10" max="200" value="${settings.particleCount}" onchange="(function(el){settings.particleCount=parseInt(el.value);saveSettingsToCookies();applyParticleSettings();document.getElementById('particleCountValue').textContent=el.value;})(this)" class="range-input">
                                    <span id="particleCountValue">${settings.particleCount}</span>
                                </label>
                            </div>
                            <div class="setting-item">
                                <label class="color-setting">
                                    <span class="setting-title">Particle Color</span>
                                    <span class="setting-sub">Choose particle and line color</span>
                                    <input type="color" id="particleColorSetting" value="${settings.particleColor}" onchange="(function(el){settings.particleColor=el.value;saveSettingsToCookies();applyParticleSettings();})(this)" class="color-input">
                                </label>
                            </div>
                            <div class="setting-item">
                                <label class="range-setting">
                                    <span class="setting-title">Line Distance</span>
                                    <span class="setting-sub">Distance at which particles connect</span>
                                    <input type="range" id="particleLineSetting" min="50" max="300" value="${settings.particleLineDistance}" onchange="(function(el){settings.particleLineDistance=parseInt(el.value);saveSettingsToCookies();applyTheme();document.getElementById('particleLineValue').textContent=el.value+'px';})(this)" class="range-input">
                                    <span id="particleLineValue">${settings.particleLineDistance}px</span>
                                </label>
                            </div>
                            <div class="setting-item">
                                <label class="switch-row" for="particleMouseSetting">
                                    <div class="switch-text">
                                        <span class="setting-title">Mouse Interaction</span>
                                        <span class="setting-sub">Particles react to mouse movement</span>
                                    </div>
                                    <input type="checkbox" id="particleMouseSetting" class="ww-switch-input" ${settings.particleMouseInteraction?'checked':''} onchange="(function(el){settings.particleMouseInteraction=el.checked;saveSettingsToCookies();applyTheme();})(this)">
                                    <span class="ww-switch" aria-hidden="true"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <div class="setting-group collapsible">
                        <div class="setting-group-header" onclick="toggleSettingGroup(this)">
                            <h3>Game Settings</h3>
                            <i class="fas fa-chevron-down setting-group-arrow"></i>
                        </div>
                        <div class="setting-group-content">
                            <div class="setting-item">
                                <label class="switch-row" for="proxyToggleSetting">
                                    <div class="switch-text">
                                        <span class="setting-title">Enable Proxy for Games</span>
                                        <span class="setting-sub">Beta feature to bypass restrictions</span>
                                    </div>
                                    <input type="checkbox" id="proxyToggleSetting" class="ww-switch-input" ${isProxyEnabled?'checked':''} onchange="(function(el){isProxyEnabled=el.checked;settings.defaultProxy=isProxyEnabled;saveSettingsToCookies();updateProxyVisuals(); if(currentGame) loadGame(currentGame);})(this)">
                                    <span class="ww-switch" aria-hidden="true"></span>
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <div class="setting-group collapsible">
                        <div class="setting-group-header" onclick="toggleSettingGroup(this)">
                            <h3>Data Management</h3>
                            <i class="fas fa-chevron-down setting-group-arrow"></i>
                        </div>
                        <div class="setting-group-content">
                            <div class="setting-item">
                                <button id="exportDataBtn" class="update-check-btn" onclick="showExportPreview()" style="margin-bottom: 8px;">
                                    <i class="fas fa-download" style="margin-right: 6px;"></i>Export All Data
                                </button>
                                <small class="muted-hint">Download all your game saves, settings, and favorites as a file.</small>
                            </div>
                            <div class="setting-item">
                                <input type="file" id="importDataFile" accept=".wwd" style="display: none;" onchange="importSiteData(this.files[0]); this.value = '';">
                                <button id="importDataBtn" class="update-check-btn" onclick="document.getElementById('importDataFile').click()">
                                    <i class="fas fa-upload" style="margin-right: 6px;"></i>Import Data
                                </button>
                                <small class="muted-hint">Restore data from a previously exported file. This will overwrite current data.</small>
                            </div>
                            <div class="setting-item">
                                <button id="resetSettingsBtn" class="update-check-btn" onclick="showCustomConfirmDialog('Reset All Settings', 'Are you sure you want to reset all settings to their default values? This cannot be undone.', resetAllSettings)" style="margin-bottom: 8px; background: #d29922; border-color: #d29922;">
                                    <i class="fas fa-undo" style="margin-right: 6px;"></i>Reset All Settings
                                </button>
                                <small class="muted-hint">Reset all customization settings to default values.</small>
                            </div>
                            <div class="setting-item">
                                <button id="clearDataBtn" class="update-check-btn" onclick="showCustomConfirmDialog('Clear All Game Data', '⚠️ WARNING: This will permanently delete ALL game saves, favorites, and progress. This cannot be undone.\\n\\nAre you absolutely sure you want to continue?', clearAllGameData)" style="background: #f85149; border-color: #da3633;">
                                    <i class="fas fa-trash" style="margin-right: 6px;"></i>Clear All Game Data
                                </button>
                                <small class="muted-hint">⚠️ Permanently delete all game saves, favorites, and progress.</small>
                            </div>
                        </div>
                    </div>
                    
                    <div class="setting-group collapsible">
                        <div class="setting-group-header" onclick="toggleSettingGroup(this)">
                            <h3>Updates</h3>
                            <i class="fas fa-chevron-down setting-group-arrow"></i>
                        </div>
                        <div class="setting-group-content">
                            <div class="setting-item">
                                <button id="checkUpdatesBtn" class="update-check-btn" onclick="checkForUpdates()">Check for Updates</button>
                                <small class="muted-hint">Force refresh assets & service worker.</small>
                            </div>
                        </div>
                    </div>
                    
                    <div class="setting-group collapsible">
                        <div class="setting-group-header" onclick="toggleSettingGroup(this)">
                            <h3>About & Legal</h3>
                            <i class="fas fa-chevron-down setting-group-arrow"></i>
                        </div>
                        <div class="setting-group-content">
                            <div class="link-row">
                                <a href="#" class="themed-link" target="_blank" rel="noopener noreferrer"><i class="fab fa-github"></i><span>GitHub</span></a>
                                <a href="#" class="themed-link"><i class="fas fa-file-contract"></i><span>Terms of Service</span></a>
                                <a href="#" class="themed-link"><i class="fas fa-user-shield"></i><span>Privacy Policy</span></a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>`);
    
    // Initialize collapsible settings after the page is created
    setTimeout(() => {
        initializeCollapsibleSettings();
    }, 10);
}

// ===== Settings Group Toggle =====
function toggleSettingGroup(header) {
    const group = header.parentElement;
    const content = group.querySelector('.setting-group-content');
    const arrow = header.querySelector('.setting-group-arrow');
    
    if (group.classList.contains('collapsed')) {
        // Expand
        group.classList.remove('collapsed');
        // Calculate full height including padding
        const fullHeight = content.scrollHeight + 56; // 24px top + 32px bottom padding
        content.style.maxHeight = fullHeight + 'px';
        arrow.style.transform = 'rotate(0deg)';
    } else {
        // Collapse
        group.classList.add('collapsed');
        content.style.maxHeight = '0';
        arrow.style.transform = 'rotate(-90deg)';
    }
}

function initializeCollapsibleSettings() {
    // Collapse all setting groups by default
    const settingGroups = document.querySelectorAll('.setting-group.collapsible');
    settingGroups.forEach(group => {
        const content = group.querySelector('.setting-group-content');
        const arrow = group.querySelector('.setting-group-arrow');
        
        group.classList.add('collapsed');
        content.style.maxHeight = '0';
        arrow.style.transform = 'rotate(-90deg)';
    });
}

// ===== Custom Cursor Image Handler =====
function handleCustomCursorUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showNotification('Please select a valid image file', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        settings.customCursorImage = e.target.result;
        settings.cursorType = 'custom';
        saveSettingsToCookies();
        applyTheme();
        
        // Update the select dropdown
        const cursorTypeSelect = document.getElementById('cursorTypeSetting');
        if (cursorTypeSelect) {
            cursorTypeSelect.value = 'custom';
        }
        
        showNotification('Custom cursor image uploaded successfully!', 'success');
    };
    reader.readAsDataURL(file);
}

// ===== Settings Page Helper Functions =====
function updateSettingsPageValues() {
    // Update cursor size
    const cursorSizeInput = document.getElementById('cursorSizeSetting');
    const cursorSizeValue = document.getElementById('cursorSizeValue');
    if (cursorSizeInput && cursorSizeValue) {
        cursorSizeInput.value = settings.cursorSize;
        cursorSizeValue.textContent = settings.cursorSize + 'px';
    }
    
    // Update cursor color
    const cursorColorInput = document.getElementById('cursorColorSetting');
    if (cursorColorInput) cursorColorInput.value = settings.cursorColor;
    
    // Update cursor type
    const cursorTypeSelect = document.getElementById('cursorTypeSetting');
    if (cursorTypeSelect) cursorTypeSelect.value = settings.cursorType;
    
    // Update particle settings
    const particlesToggle = document.getElementById('particlesEnabledSetting');
    if (particlesToggle) particlesToggle.checked = settings.particlesEnabled;
    
    const particleSpeedInput = document.getElementById('particleSpeedSetting');
    const particleSpeedValue = document.getElementById('particleSpeedValue');
    if (particleSpeedInput && particleSpeedValue) {
        particleSpeedInput.value = settings.particleSpeed;
        particleSpeedValue.textContent = settings.particleSpeed;
    }
    
    const particleCountInput = document.getElementById('particleCountSetting');
    const particleCountValue = document.getElementById('particleCountValue');
    if (particleCountInput && particleCountValue) {
        particleCountInput.value = settings.particleCount;
        particleCountValue.textContent = settings.particleCount;
    }
    
    const particleColorInput = document.getElementById('particleColorSetting');
    if (particleColorInput) particleColorInput.value = settings.particleColor;
    
    const particleLineInput = document.getElementById('particleLineSetting');
    const particleLineValue = document.getElementById('particleLineValue');
    if (particleLineInput && particleLineValue) {
        particleLineInput.value = settings.particleLineDistance;
        particleLineValue.textContent = settings.particleLineDistance + 'px';
    }
    
    const particleMouseToggle = document.getElementById('particleMouseSetting');
    if (particleMouseToggle) particleMouseToggle.checked = settings.particleMouseInteraction;
}

// ===== Update / Cache Refresh =====
function checkForUpdates() {
    const btn = document.getElementById('checkUpdatesBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Updating...';
    }
    // Unregister all service workers, delete all caches, then reload with cache-busting param
    const doReload = () => {
        // Add a cache-busting query param to the URL
        const url = new URL(window.location.href);
        url.searchParams.set('v', Date.now());
        setTimeout(() => {
            showUpdateModal(btn);
            window.location.replace(url.toString());
        }, 400);
    };
    const clearCachesAndReload = () => {
        if (window.caches) {
            caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).finally(doReload);
        } else {
            doReload();
        }
    };
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
            Promise.all(regs.map(r => r.unregister())).finally(clearCachesAndReload);
        });
    } else {
        clearCachesAndReload();
    }
}

// Extend existing renderFavoritesSection to also update the dedicated page
const __origRenderFavoritesSection = renderFavoritesSection;
renderFavoritesSection = function(){
    __origRenderFavoritesSection();
    renderFavoritesPage();
};

// ===== Loading Overlay Logic =====
let loadingOverlayTimer=null, loadingProxyTimer=null, loadingMinTimer=null, loadingProgressTimer=null;
function startGameLoadingOverlay(url){
    const overlay=document.getElementById('gameLoadingOverlay');
    const bar=document.querySelector('.loading-bar-fill');
    const status=document.getElementById('loadingStatusText');
    const hint=document.getElementById('loadingHintText');
    const proxyBtn=document.getElementById('loadingProxyToggle');
    if(!overlay||!bar) return;
    // Reset
    clearTimeout(loadingOverlayTimer); clearTimeout(loadingProxyTimer); clearTimeout(loadingMinTimer); clearInterval(loadingProgressTimer);
    overlay.style.display='flex';
    bar.style.width='0%';
    status.textContent='Loading game...';
    hint.textContent='Preparing resources';
    proxyBtn.style.display='none';
    // Progressive fill (simulate) up to 85% until load finishes
    let progress=0;
    loadingProgressTimer=setInterval(()=>{ progress = Math.min(progress + Math.random()*6, 85); bar.style.width=progress+'%'; }, 400);
    // After 5s allow closing if loaded
    loadingMinTimer=setTimeout(()=>{ overlay.dataset.min='done'; },5000);
    // After 8s change hint
    loadingOverlayTimer=setTimeout(()=>{ hint.textContent='Still loading...'; },8000);
    // After 15s with proxy enabled show suggestion
    loadingProxyTimer=setTimeout(()=>{
        if(isProxyEnabled){
            proxyBtn.style.display='inline-block';
            hint.textContent='Taking unusually long.';
            status.textContent='Consider disabling proxy for this game.';
            proxyBtn.onclick=()=>{ isProxyEnabled=false; gameProxyOverrides[currentGame?.id||'']=false; updateProxyVisuals(); if(currentGame) loadGame(currentGame); };
        }
    },15000);
}
function finishGameLoadingOverlay(success){
    const overlay=document.getElementById('gameLoadingOverlay');
    const bar=document.querySelector('.loading-bar-fill');
    const status=document.getElementById('loadingStatusText');
    const hint=document.getElementById('loadingHintText');
    if(!overlay||!bar) return;
    clearInterval(loadingProgressTimer);
    bar.style.width='100%';
    status.textContent = success ? 'Loaded!' : 'Load ended';
    hint.textContent = success ? '' : 'You can retry or toggle proxy.';
    // Ensure at least 5s display
    const delay = overlay.dataset.min==='done'? 150 : 5200; // if min not reached, wait remainder ~5s
    setTimeout(()=>{
        // Apply fade-out animation class defined in CSS
        overlay.classList.add('fade-out');
        overlay.style.pointerEvents='none';
        const removeFn=()=>{ overlay.style.display='none'; overlay.classList.remove('fade-out'); overlay.removeEventListener('transitionend', removeFn); };
        overlay.addEventListener('transitionend', removeFn);
        // Fallback removal in case transition event not fired
        setTimeout(removeFn, 800);
    }, delay);
}

// ===== Custom Cursor =====
function initCustomCursor(){
    if(matchMedia('(hover: none)').matches) return; // Skip on touch devices
    const dot=document.createElement('div');
    dot.className='custom-cursor-dot';
    document.body.appendChild(dot);
    window.addEventListener('mousemove', e=>{ dot.style.transform=`translate(${e.clientX}px, ${e.clientY}px)`; show(); });
    let hideTimer=null;
    function show(){
        document.body.classList.remove('cursor-hidden');
        clearTimeout(hideTimer);
        hideTimer=setTimeout(()=> document.body.classList.add('cursor-hidden'), 2000);
    }
    show();
}

// ===== Particle Background =====
document.addEventListener('DOMContentLoaded', ()=> initParticles());
function initParticles(){
    const canvas=document.getElementById('particleBackground');
    if(!canvas) return;
    const ctx=canvas.getContext('2d');
    let w=canvas.width=window.innerWidth; let h=canvas.height=window.innerHeight;
    window.addEventListener('resize', ()=>{ w=canvas.width=window.innerWidth; h=canvas.height=window.innerHeight; initPool(); });
    const density= w*h / 26000; // adaptive count
    let particles=[]; const maxDist=150; const fadeDist=maxDist*1.1;
    function rand(min,max){ return Math.random()*(max-min)+min; }
    function initPool(){ particles = new Array(Math.round(window.innerWidth*window.innerHeight/26000)).fill(0).map(()=> newParticle()); }
    function newParticle(){ return { x:rand(0,w), y:rand(0,h), vx:rand(-0.25,0.25), vy:rand(-0.25,0.25), r:rand(1.2,2.2)}; }
    function step(p){ p.x+=p.vx; p.y+=p.vy; if(p.x<0||p.x>w) p.vx*=-1; if(p.y<0||p.y>h) p.vy*=-1; }
    function draw(){
        ctx.clearRect(0,0,w,h);
        // Draw lines
        for(let i=0;i<particles.length;i++){
            const p=particles[i]; step(p);
            for(let j=i+1;j<particles.length;j++){
                const q=particles[j]; const dx=p.x-q.x; const dy=p.y-q.y; const dist=Math.hypot(dx,dy);
                if(dist<fadeDist){
                    const alpha = dist<maxDist ? 1 - dist/maxDist : (fadeDist-dist)/(fadeDist-maxDist)*0.3;
                    if(alpha>0){
                        ctx.strokeStyle = `rgba(255,255,255,${alpha*0.35})`;
                        ctx.lineWidth = 1;
                        ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(q.x,q.y); ctx.stroke();
                    }
                }
            }
        }
        // Draw dots after lines so they sit on top
        for(const p of particles){
            ctx.fillStyle='rgba(255,255,255,0.85)';
            ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
        }
        requestAnimationFrame(draw);
    }
    initPool();
    draw();
}




// ===== Missing Helper Implementations (added to fix runtime errors) =====
// Persistence helpers (using localStorage instead of fragile cookies)
function loadSettingsFromCookies(){
    try {
        const raw = localStorage.getItem('ww_settings');
        if(raw){ const parsed = JSON.parse(raw); if(typeof parsed === 'object') settings = { ...settings, ...parsed }; }
    } catch(e){ console.warn('Failed to load settings', e); }
}
function saveSettingsToCookies(){
    try { localStorage.setItem('ww_settings', JSON.stringify(settings)); } catch(e){ console.warn('Failed to save settings', e); }
}
function loadFavoritesFromCookies(){
    try { const raw = localStorage.getItem('ww_favorites'); if(raw){ const arr = JSON.parse(raw); if(Array.isArray(arr)) favorites = arr; } } catch(e){ console.warn('Failed to load favorites', e); }
}
function saveFavoritesToCookies(){
    try { localStorage.setItem('ww_favorites', JSON.stringify(favorites)); } catch(e){ console.warn('Failed to save favorites', e); }
}

// ===== Theme Management =====
function applyTheme() {
    const root = document.documentElement;
    
    // Remove any theme attribute (always use dark mode)
    root.removeAttribute('data-theme');
    
    // Apply custom accent color
    root.style.setProperty('--accent-color', settings.accentColor);
    
    // Apply custom cursor styles
    applyCustomCursor();
    
    // Apply particle settings
    applyParticleSettings();
}

function applyCustomCursor() {
    const root = document.documentElement;
    
    if (!settings.customCursorEnabled) {
        // Hide custom cursor and restore default cursors
        root.style.setProperty('--cursor-display', 'none');
        document.body.classList.remove('custom-cursor-enabled');
        document.body.style.cursor = '';
        document.querySelectorAll('*').forEach(el => {
            if (el.style.cursor) {
                el.style.cursor = '';
            }
        });
        return;
    }
    
    // Enable custom cursor
    document.body.classList.add('custom-cursor-enabled');
    root.style.setProperty('--cursor-display', 'block');
    root.style.setProperty('--cursor-size', settings.cursorSize + 'px');
    root.style.setProperty('--cursor-color', settings.cursorColor);
    
    // Apply cursor type
    const cursorDot = document.querySelector('.custom-cursor-dot');
    if (cursorDot) {
        cursorDot.style.width = settings.cursorSize + 'px';
        cursorDot.style.height = settings.cursorSize + 'px';
        cursorDot.style.background = settings.cursorColor;
        
        if (settings.cursorType === 'arrow') {
            cursorDot.style.borderRadius = '0';
            cursorDot.style.transform = 'rotate(45deg) translate(-50%, -50%)';
            cursorDot.style.clipPath = 'polygon(0% 0%, 0% 100%, 100% 0%)';
        } else if (settings.cursorType === 'custom' && settings.customCursorImage) {
            cursorDot.style.backgroundImage = `url(${settings.customCursorImage})`;
            cursorDot.style.backgroundSize = 'contain';
            cursorDot.style.backgroundRepeat = 'no-repeat';
            cursorDot.style.borderRadius = '0';
        } else {
            // Circle
            cursorDot.style.borderRadius = '50%';
            cursorDot.style.transform = 'translate(-50%, -50%)';
            cursorDot.style.clipPath = 'none';
            cursorDot.style.backgroundImage = 'none';
        }
    }
}

// ===== Particle System =====
class ParticleSystem {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.mouse = { x: 0, y: 0 };
        this.animationId = null;
        
        // Start with default settings - will be updated by applyParticleSettings()
        this.settings = {
            enabled: true,
            speed: 0.5,
            count: 50,
            color: '#58a6ff',
            lineDistance: 150,
            mouseInteraction: true
        };
        this.init();
    }
    
    init() {
        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'particle-bg-canvas';
        this.ctx = this.canvas.getContext('2d');
        
        // Insert canvas as first child of body
        document.body.insertBefore(this.canvas, document.body.firstChild);
        
        // Set canvas visibility based on enabled state
        this.canvas.style.display = this.settings.enabled ? 'block' : 'none';
        
        // Set canvas size
        this.resize();
        
        // Create particles
        this.createParticles();
        
        // Start animation
        if (this.settings.enabled) {
            this.animate();
        }
        
        // Event listeners
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    createParticles() {
        this.particles = [];
        for (let i = 0; i < this.settings.count; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * this.settings.speed * 2,
                vy: (Math.random() - 0.5) * this.settings.speed * 2,
                size: Math.random() * 2 + 1
            });
        }
    }
    
    updateSettings(newSettings) {
        const oldSettings = { ...this.settings };
        this.settings = { ...this.settings, ...newSettings };
        
        if (this.settings.enabled && !this.animationId) {
            // Starting from disabled state
            this.createParticles();
            this.animate();
        } else if (!this.settings.enabled && this.animationId) {
            // Disabling particles
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        } else if (this.settings.enabled) {
            // Update particle count if needed
            const countDiff = this.settings.count - this.particles.length;
            if (countDiff > 0) {
                // Add new particles
                for (let i = 0; i < countDiff; i++) {
                    this.particles.push({
                        x: Math.random() * this.canvas.width,
                        y: Math.random() * this.canvas.height,
                        vx: (Math.random() - 0.5) * this.settings.speed * 2,
                        vy: (Math.random() - 0.5) * this.settings.speed * 2,
                        size: Math.random() * 2 + 1
                    });
                }
            } else if (countDiff < 0) {
                // Remove excess particles
                this.particles = this.particles.slice(0, this.settings.count);
            }
            
            // If speed changed, update all particle velocities
            if (oldSettings.speed !== this.settings.speed) {
                this.particles.forEach(particle => {
                    // Recalculate velocity with new speed
                    const currentSpeed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
                    const direction = Math.atan2(particle.vy, particle.vx);
                    const newSpeed = this.settings.speed * 2;
                    particle.vx = Math.cos(direction) * newSpeed;
                    particle.vy = Math.sin(direction) * newSpeed;
                });
            }
        }
    }
    
    animate() {
        if (!this.settings.enabled) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Update particles
        this.particles.forEach((particle, i) => {
            // Update position with proper speed calculation
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // Bounce off edges
            if (particle.x < 0 || particle.x > this.canvas.width) particle.vx *= -1;
            if (particle.y < 0 || particle.y > this.canvas.height) particle.vy *= -1;
            
            // Keep particles in bounds
            particle.x = Math.max(0, Math.min(this.canvas.width, particle.x));
            particle.y = Math.max(0, Math.min(this.canvas.height, particle.y));
            
            // Mouse interaction
            if (this.settings.mouseInteraction) {
                const dx = this.mouse.x - particle.x;
                const dy = this.mouse.y - particle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 100) {
                    const force = (100 - distance) / 100;
                    particle.vx -= (dx / distance) * force * 0.01;
                    particle.vy -= (dy / distance) * force * 0.01;
                }
            }
            
            // Draw particle
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fillStyle = this.settings.color;
            this.ctx.fill();
            
            // Draw connections
            for (let j = i + 1; j < this.particles.length; j++) {
                const other = this.particles[j];
                const dx = particle.x - other.x;
                const dy = particle.y - other.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < this.settings.lineDistance) {
                    const opacity = (this.settings.lineDistance - distance) / this.settings.lineDistance;
                    this.ctx.beginPath();
                    this.ctx.moveTo(particle.x, particle.y);
                    this.ctx.lineTo(other.x, other.y);
                    // Use rgba format for proper transparency
                    const hex = this.settings.color.replace('#', '');
                    if (hex.length === 6) {
                        const r = parseInt(hex.substr(0, 2), 16);
                        const g = parseInt(hex.substr(2, 2), 16);
                        const b = parseInt(hex.substr(4, 2), 16);
                        this.ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity * 0.6})`;
                    } else {
                        // Fallback to solid color if hex parsing fails
                        this.ctx.strokeStyle = this.settings.color;
                    }
                    this.ctx.lineWidth = 0.5;
                    this.ctx.stroke();
                }
            }
        });
        
        this.animationId = requestAnimationFrame(() => this.animate());
    }
}

function applyParticleSettings() {
    if (window.particleSystem) {
        console.log('Applying particle settings:', settings.particlesEnabled, settings.particleSpeed, settings.particleCount, settings.particleColor);
        window.particleSystem.updateSettings({
            enabled: settings.particlesEnabled,
            speed: settings.particleSpeed,
            count: settings.particleCount,
            color: settings.particleColor,
            lineDistance: settings.particleLineDistance,
            mouseInteraction: settings.particleMouseInteraction
        });
        
        // Hide/show canvas based on enabled state
        if (window.particleSystem.canvas) {
            window.particleSystem.canvas.style.display = settings.particlesEnabled ? 'block' : 'none';
        }
    }
}

// ===== Data Export/Import System =====
function getAllGameData() {
    const gameData = {};
    
    // Collect all localStorage data that might be game-related
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        
        // Include all data except WaterWall's own settings
        if (key && !key.startsWith('ww_') && !key.startsWith('auth0') && key !== 'debug') {
            try {
                // Try to parse as JSON, if it fails store as string
                gameData[key] = JSON.parse(value);
            } catch (e) {
                gameData[key] = value;
            }
        }
    }
    
    return gameData;
}

function showExportPreview() {
    const gameData = getAllGameData();
    const gameDataKeys = Object.keys(gameData);
    const gameDataSize = JSON.stringify(gameData).length;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(2px);
        background: rgba(0,0,0,0.7);
        font-family: 'Poppins', sans-serif;
    `;
    
    modal.innerHTML = `
        <div style="
            background: #161b22;
            border: 1px solid #30363d;
            padding: 24px;
            border-radius: 12px;
            width: 90%;
            max-width: 500px;
            max-height: 80vh;
            overflow-y: auto;
        ">
            <h3 style="margin: 0 0 16px; font-size: 20px; color: #ffffff;">Export Preview</h3>
            
            <div style="margin-bottom: 16px;">
                <h4 style="margin: 0 0 8px; font-size: 16px; color: #58a6ff;">WaterWall Settings</h4>
                <ul style="margin: 0 0 0 20px; color: #a0a6ad; font-size: 14px;">
                    <li>Proxy settings: ${settings.defaultProxy ? 'Enabled' : 'Disabled'}</li>
                    <li>Favorites: ${favorites.length} games</li>
                    <li>Game proxy overrides: ${Object.keys(gameProxyOverrides).length} games</li>
                </ul>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h4 style="margin: 0 0 8px; font-size: 16px; color: #58a6ff;">Game Save Data</h4>
                <p style="margin: 0 0 8px; color: #a0a6ad; font-size: 14px;">
                    ${gameDataKeys.length} save data entries found (${(gameDataSize / 1024).toFixed(1)}KB)
                </p>
                ${gameDataKeys.length > 0 ? `
                    <details style="margin-top: 8px;">
                        <summary style="cursor: pointer; color: #7d8590; font-size: 13px;">Show detected save data keys</summary>
                        <div style="margin-top: 8px; max-height: 150px; overflow-y: auto; background: #0d1117; padding: 8px; border-radius: 6px; border: 1px solid #21262d;">
                            ${gameDataKeys.map(key => `<div style="font-family: monospace; font-size: 12px; color: #79c0ff; margin-bottom: 2px;">${key}</div>`).join('')}
                        </div>
                    </details>
                ` : '<p style="color: #7d8590; font-size: 13px; font-style: italic;">No game save data detected</p>'}
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="cancelExport" style="
                    background: transparent;
                    border: 1px solid #30363d;
                    color: #a0a6ad;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-family: inherit;
                    font-size: 14px;
                ">Cancel</button>
                <button id="confirmExport" style="
                    background: #238636;
                    border: 1px solid #238636;
                    color: white;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-family: inherit;
                    font-size: 14px;
                ">
                    <i class="fas fa-download" style="margin-right: 6px;"></i>Export Data
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    modal.querySelector('#cancelExport').onclick = () => modal.remove();
    modal.querySelector('#confirmExport').onclick = () => {
        modal.remove();
        exportSiteData();
    };
    
    // Close on backdrop click
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

function exportSiteData() {
    try {
        const exportData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            settings: settings,
            favorites: favorites,
            gameProxyOverrides: gameProxyOverrides,
            gameData: getAllGameData()
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        
        // Create download as plain JSON
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `waterwall-data-${new Date().toISOString().split('T')[0]}.wwd`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        const size = (dataStr.length / 1024).toFixed(1);
        showNotification(`Data exported successfully! Size: ${size}KB`, 'success');
    } catch (error) {
        console.error('Export failed:', error);
        showNotification('Export failed: ' + error.message, 'error');
    }
}

function importSiteData(file) {
    if (!file) return;
    
    if (!file.name.endsWith('.wwd')) {
        showNotification('Please select a valid WaterWall data file (.wwd)', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const dataStr = e.target.result;
            const importData = JSON.parse(dataStr);
            
            if (!importData.version) {
                throw new Error('Invalid data format. This doesn\'t appear to be a WaterWall data file.');
            }
            
            // Show confirmation dialog
            const importDate = importData.timestamp ? new Date(importData.timestamp).toLocaleDateString() : 'unknown date';
            showCustomConfirmDialog(
                'Import Data', 
                `Import data from ${importDate}?\n\nThis will overwrite your current settings, favorites, and game saves. This action cannot be undone.`,
                function() {
                    // Import settings
                    if (importData.settings) {
                        settings = { ...settings, ...importData.settings };
                        saveSettingsToCookies();
                        isProxyEnabled = settings.defaultProxy || false;
                    }
                    
                    // Import favorites
                    if (importData.favorites && Array.isArray(importData.favorites)) {
                        favorites = importData.favorites;
                        saveFavoritesToCookies();
                    }
                    
                    // Import game proxy overrides
                    if (importData.gameProxyOverrides) {
                        Object.assign(gameProxyOverrides, importData.gameProxyOverrides);
                    }
                    
                    // Import game data
                    if (importData.gameData) {
                        let importedCount = 0;
                        Object.keys(importData.gameData).forEach(key => {
                            try {
                                const value = importData.gameData[key];
                                localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
                                importedCount++;
                            } catch (e) {
                                console.warn(`Failed to import data for key: ${key}`, e);
                            }
                        });
                        
                        console.log(`Imported ${importedCount} game data entries`);
                    }
                    
                    showNotification(`Data imported successfully! ${importData.timestamp ? 'From: ' + new Date(importData.timestamp).toLocaleDateString() : ''}`, 'success');
                    
                    // Refresh UI
                    updateProxyVisuals();
                    renderFavoritesSection();
                    applyTheme(); // Apply imported theme settings
                    
                    // Update settings page if visible
                    const settingsPage = document.getElementById('settingsPage');
                    if (settingsPage && settingsPage.style.display !== 'none') {
                        const proxyToggle = document.getElementById('proxyToggleSetting');
                        if (proxyToggle) {
                    proxyToggle.checked = isProxyEnabled;
                }
                
                // Update other setting controls
                const accentColorInput = document.getElementById('accentColorSetting');
                if (accentColorInput) accentColorInput.value = settings.accentColor;
                
                const customCursorToggle = document.getElementById('customCursorSetting');
                if (customCursorToggle) customCursorToggle.checked = settings.customCursorEnabled;
                
                // Update all the range inputs and their value displays
                updateSettingsPageValues();
            }
                }
            );
            
        } catch (error) {
            console.error('Import failed:', error);
            showNotification('Import failed: ' + error.message, 'error');
        }
    };
    
    reader.readAsText(file);
}

function resetAllSettings() {
    // Reset settings to admin-controlled defaults
    if (adminConfig && adminConfig.defaultUserSettings) {
        // Use admin-defined defaults
        settings = { ...adminConfig.defaultUserSettings };
        console.log('⚙️ Settings reset to admin defaults');
    } else {
        // Fallback to hardcoded defaults if admin config unavailable
        settings = {
            defaultProxy: false,
            // Theme settings
            accentColor: '#58a6ff',
            // Particle settings
            particlesEnabled: true,
            particleSpeed: 0.5,
            particleCount: 50,
            particleColor: '#58a6ff',
            particleLineDistance: 150,
            particleMouseInteraction: true,
            // Cursor settings
            customCursorEnabled: true,
            cursorSize: 8,
            cursorColor: '#ffffff',
            cursorType: 'circle',
            customCursorImage: null
        };
        console.log('⚙️ Settings reset to fallback defaults');
    }
    
    // Save to localStorage
    saveSettingsToCookies();
    
    // Apply the reset settings
    applyTheme();
    
    // Update the settings page UI
    updateSettingsPageValues();
    
    showNotification('All settings have been reset to admin-defined default values.', 'success');
}

function clearAllGameData() {
    try {
        // Clear favorites
        favorites = [];
        saveFavoritesToCookies();
        
        // Clear all game-related localStorage data
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            // Remove all data except WaterWall settings and auth data
            if (key && !key.startsWith('ww_') && !key.startsWith('auth0') && key !== 'debug') {
                keysToRemove.push(key);
            }
        }
        
        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });
        
        // Refresh UI
        renderFavoritesSection();
        
        showNotification(`Successfully cleared all game data. Removed ${keysToRemove.length} game save entries.`, 'success');
        
    } catch (error) {
        console.error('Failed to clear game data:', error);
        showNotification('Failed to clear game data: ' + error.message, 'error');
    }
}

// ===== Custom Confirmation Dialog =====
function showCustomConfirmDialog(title, message, onConfirm, onCancel = null) {
    // Remove any existing dialog
    const existingDialog = document.getElementById('customConfirmDialog');
    if (existingDialog) {
        existingDialog.remove();
    }
    
    // Create dialog HTML
    const dialog = document.createElement('div');
    dialog.id = 'customConfirmDialog';
    dialog.innerHTML = `
        <div class="modal-overlay" onclick="closeCustomConfirmDialog()"></div>
        <div class="custom-confirm-dialog" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h3>${title}</h3>
            </div>
            <div class="modal-body">
                <p>${message.replace(/\\n/g, '<br>')}</p>
            </div>
            <div class="modal-footer">
                <button class="confirm-cancel" onclick="closeCustomConfirmDialog()">Cancel</button>
                <button class="confirm-ok" onclick="confirmCustomDialog()">Confirm</button>
            </div>
        </div>
    `;
    
    // Store the callback function
    dialog.confirmCallback = onConfirm;
    dialog.cancelCallback = onCancel;
    
    // Add to page
    document.body.appendChild(dialog);
    
    // Focus the dialog
    setTimeout(() => {
        dialog.querySelector('.modal-dialog').focus();
    }, 10);
}

function confirmCustomDialog() {
    const dialog = document.getElementById('customConfirmDialog');
    if (dialog && dialog.confirmCallback) {
        dialog.confirmCallback();
    }
    closeCustomConfirmDialog();
}

function closeCustomConfirmDialog() {
    const dialog = document.getElementById('customConfirmDialog');
    if (dialog) {
        if (dialog.cancelCallback) {
            dialog.cancelCallback();
        }
        dialog.remove();
    }
}

function buildCategoryTabs(){
    const el = document.getElementById('categoryTabs'); if(!el || !Array.isArray(games)) return;
    const cats = [...new Set(games.map(g=> g.category).filter(Boolean))].sort((a,b)=> a.localeCompare(b));
    if(cats.length === 0){ el.innerHTML=''; return; }
    const iconMap = {
        all: 'fa-layer-group',           // free
        action: 'fa-bolt',               // free
        puzzle: 'fa-puzzle-piece',       // free
        adventure: 'fa-map',             // free
        strategy: 'fa-chess-knight',     // free
        arcade: 'fa-gamepad',            // free
        sports: 'fa-futbol',             // free (soccer ball)
        new: 'fa-star',                  // fa-sparkles is Pro; use star
        popular: 'fa-fire',              // free
        updated: 'fa-arrows-rotate',     // fa-rotate is a utility class, use arrows-rotate icon
        sandbox: 'fa-cube',              // free
        racing: 'fa-flag-checkered',     // free
        shooter: 'fa-crosshairs',        // free
        horror: 'fa-ghost',              // free
        simulation: 'fa-cogs',           // free
        classic: 'fa-clock'              // free
    };
    const allList = ['all', ...cats];
    el.innerHTML = allList.map(c=>{
        const icon = iconMap[c.toLowerCase()] || 'fa-circle';
        return `<button class="cat-tab" data-cat="${sanitize(c)}" aria-pressed="false"><i class="fas ${icon}" aria-hidden="true"></i><span>${sanitize(capitalize(c))}</span></button>`;
    }).join('');
    const buttons = Array.from(el.querySelectorAll('button.cat-tab'));
    function activate(cat){
        buttons.forEach(b=>{ const active = b.dataset.cat===cat; b.classList.toggle('active', active); b.setAttribute('aria-pressed', active? 'true':'false'); });
    }
    buttons.forEach(btn=>{
        btn.onclick=()=>{
            const cat = btn.dataset.cat;
            if(cat==='all'){ showHomePage(); activate('all'); return; }
            filterByCategory(cat); activate(cat);
        };
    });
    // Default active 'all'
    activate('all');
}

// ===== Font Awesome Fallback Assurance =====
(function ensureFontAwesome(){
    const CHECK_DELAY = 1400; // after primary CSS likely parsed
    const FALLBACKS = [
        'https://unpkg.com/@fortawesome/fontawesome-free@6.4.0/css/all.min.css',
        'https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@5.15.4/css/all.min.css'
    ];
    function hasIcons(){
        // create a temp element to measure pseudo-element font-family or width
        const probe = document.createElement('i');
        probe.className='fas fa-home';
        probe.style.position='absolute'; probe.style.left='-9999px';
        document.body.appendChild(probe);
        const style = window.getComputedStyle(probe, '::before');
        const content = style && style.getPropertyValue('content');
        const fontFamily = style && style.getPropertyValue('font-family');
        document.body.removeChild(probe);
        // Font Awesome pseudo content is usually not 'normal' and font-family contains 'Font Awesome'
        return content && content !== 'normal' && /Font Awesome|FontAwesome/i.test(fontFamily||'');
    }
    function injectFallback(url){
        if(document.querySelector(`link[data-fa-alt="${url}"]`)) return;
        const l=document.createElement('link'); l.rel='stylesheet'; l.href=url; l.setAttribute('data-fa-alt', url); document.head.appendChild(l);
    }
    window.addEventListener('load', ()=>{
        let idx=0;
        function attempt(){
            if(hasIcons()) return; // success
            if(idx < FALLBACKS.length){ injectFallback(FALLBACKS[idx++]); setTimeout(attempt, 1200); }
        }
        setTimeout(attempt, CHECK_DELAY);
    });
})();

function renderFavoritesSection(){
    const section = document.getElementById('favoriteGamesSection');
    const grid = document.getElementById('favoriteGamesGrid');
    if(!section || !grid) return;
    
    // Check maintenance mode first
    if (maintenanceMode.enabled) {
        section.style.display = 'none';
        return;
    }
    
    if(!favorites.length){ section.style.display='none'; grid.innerHTML=''; return; }
    const favGames = games.filter(g=> favorites.includes(g.id));
    if(favGames.length){
        section.style.display='block';
        grid.innerHTML = favGames.map(g=> createGameCard(g)).join('');
    } else { section.style.display='none'; }
}

function renderFavoritesPage(){
    const grid = document.getElementById('favoritesPageGrid');
    const empty = document.getElementById('favoritesEmptyState');
    if(!grid) return;
    
    // Check maintenance mode first
    if (maintenanceMode.enabled) {
        showMaintenanceNotice();
        if(empty) empty.style.display='none';
        return;
    }
    
    const favGames = games.filter(g=> favorites.includes(g.id));
    if(favGames.length){
        grid.innerHTML = favGames.map(g=> createGameCard(g)).join('');
        if(empty) empty.style.display='none';
    } else {
        grid.innerHTML='';
        if(empty) empty.style.display='block';
    }
}

function toggleFavorite(game){
    if(!game) return;
    if(favorites.includes(game.id)) favorites = favorites.filter(id=> id!==game.id); else favorites.push(game.id);
    saveFavoritesToCookies();
}

function updateFavoriteButtonState(){
    const btn = document.querySelector('[data-action="favorite"]');
    if(!btn) return;
    if(currentGame && favorites.includes(currentGame.id)){
        btn.classList.add('active');
        btn.setAttribute('aria-pressed','true');
    } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-pressed','false');
    }
}

function toggleGameProxy(){
    if(!currentGame) return;
    const cur = gameProxyOverrides[currentGame.id] !== undefined ? gameProxyOverrides[currentGame.id] : settings.defaultProxy;
    gameProxyOverrides[currentGame.id] = !cur;
    isProxyEnabled = gameProxyOverrides[currentGame.id];
    updateProxyVisuals();
    loadGame(currentGame);
}

function updateProxyVisuals(){
    // Global toggle (settings page)
    const settingToggle = document.getElementById('proxyToggleSetting'); if(settingToggle) settingToggle.checked = isProxyEnabled;
    // Game page visual button
    const gameToggle = document.getElementById('proxyToggleGame');
    if(gameToggle){
        gameToggle.classList.toggle('on', isProxyEnabled);
        gameToggle.classList.toggle('off', !isProxyEnabled);
        gameToggle.setAttribute('aria-pressed', isProxyEnabled? 'true':'false');
        gameToggle.title = isProxyEnabled? 'Proxy Enabled' : 'Proxy Disabled';
    }
}

function showPopupError(msg){
    // Alias to existing toast error system for now
    showError(msg);
}

function showUpdateModal(triggerBtn){
    // Minimal ephemeral notice (no blocking modal implemented yet)
    const note = document.createElement('div');
    note.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#238636;color:#fff;padding:12px 20px;border-radius:8px;z-index:10000;box-shadow:0 4px 12px rgba(0,0,0,.3);font-size:14px;';
    note.textContent='Updating assets & refreshing...';
    document.body.appendChild(note);
    setTimeout(()=>{ note.remove(); if(triggerBtn){ triggerBtn.disabled=false; triggerBtn.textContent='Check for Updates'; } }, 4000);
}

// ===== ADMIN CONFIGURATION SYSTEM =====

// Apply comprehensive admin controls after page load
function applyAdminControls() {
    // Apply feature toggles again in case DOM changed
    applyFeatureToggles();
    
    // Hide settings sections based on admin config
    if (!features.particlesEnabled) {
        const particleSection = document.querySelector('h3')?.parentElement?.parentElement;
        if (particleSection && particleSection.textContent.includes('Background Particles')) {
            particleSection.style.display = 'none';
        }
    }
    
    if (!features.customCursorEnabled) {
        const cursorSection = document.querySelector('h3')?.parentElement?.parentElement;
        if (cursorSection && cursorSection.textContent.includes('Cursor Settings')) {
            cursorSection.style.display = 'none';
        }
    }
    
    if (!features.proxyEnabled) {
        const proxySection = document.querySelector('h3')?.parentElement?.parentElement;
        if (proxySection && proxySection.textContent.includes('Game Settings')) {
            const proxyToggle = proxySection.querySelector('#proxyToggleSetting');
            if (proxyToggle) {
                proxyToggle.closest('.setting-item').style.display = 'none';
            }
        }
    }
    
    // Apply UI controls
    if (!uiControls.showUpdateNotifications && !features.updatingEnabled) {
        const updateSection = document.querySelector('h3')?.parentElement?.parentElement;
        if (updateSection && updateSection.textContent.includes('Updates')) {
            updateSection.style.display = 'none';
        }
    }
}

// Initialize admin controls after DOM is ready
function initializeAdminControls() {
    // Apply controls immediately
    applyAdminControls();
    
    // Apply controls after any dynamic content loads
    setTimeout(applyAdminControls, 500);
    setTimeout(applyAdminControls, 1000);
    
    // Watch for settings page creation
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                const addedNodes = Array.from(mutation.addedNodes);
                const hasSettingsPage = addedNodes.some(node => 
                    node.nodeType === 1 && (node.id === 'settingsPage' || node.querySelector('#settingsPage'))
                );
                if (hasSettingsPage) {
                    setTimeout(applyAdminControls, 100);
                }
            }
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

// Admin API helper functions for external management
window.WaterWallAdmin = {
    // Get current configuration
    getConfig: () => adminConfig,
    getFeatures: () => features,
    getUIControls: () => uiControls,
    
    // Apply new configuration from external source
    applyConfig: (newConfig) => {
        if (newConfig.features) {
            features = { ...features, ...newConfig.features };
        }
        if (newConfig.uiControls) {
            uiControls = { ...uiControls, ...newConfig.uiControls };
        }
        if (newConfig.defaultUserSettings) {
            // Update existing user settings with any new defaults
            Object.keys(newConfig.defaultUserSettings).forEach(key => {
                if (settings[key] === undefined) {
                    settings[key] = newConfig.defaultUserSettings[key];
                }
            });
        }
        applyAdminControls();
        console.log('✅ Admin configuration applied');
    },
    
    // Force refresh from backend
    refreshConfig: async () => {
        await loadBackendConfiguration();
        applyAdminControls();
        console.log('✅ Configuration refreshed from backend');
    }
};

// Initialize admin controls when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAdminControls);
} else {
    initializeAdminControls();
}

// ===== Backend Status Monitoring =====
let statusCheckInterval = null;
let lastKnownStatus = null;

function initBackendStatusMonitoring() {
    console.log('🔄 Initializing backend status monitoring');
    
    // Listen for online/offline events (as hints, but verify with actual requests)
    window.addEventListener('online', () => {
        console.log('🌐 Browser detected network restoration');
        setTimeout(checkBackendStatus, 1000); // Check after a brief delay
    });
    
    window.addEventListener('offline', () => {
        console.log('📡 Browser detected network loss');
        updateStatusDisplay(false);
        lastKnownStatus = false;
    });
    
    // Perform initial status check
    checkBackendStatus();
    
    // Set up interval to check every 15 seconds (more frequent for better UX)
    statusCheckInterval = setInterval(checkBackendStatus, 15000);
}

async function checkBackendStatus() {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    if (!statusDot || !statusText) {
        console.warn('Status indicator elements not found');
        return;
    }
    
    try {
        // Use a lightweight endpoint to check backend availability
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
        
        // Try to fetch from our backend first
        const response = await fetch(`${window.WATERWALL_BACKEND_URL}/api/health`, {
            method: 'GET',
            signal: controller.signal,
            cache: 'no-cache',
            mode: 'cors'
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            updateStatusDisplay(true);
            if (lastKnownStatus !== true) {
                console.log('✅ Backend online');
                lastKnownStatus = true;
            }
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        // If backend fails, try a fallback connectivity test
        try {
            const fallbackController = new AbortController();
            const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 2000);
            
            // Try to fetch a small image from a reliable CDN to test internet connectivity
            await fetch('https://www.google.com/favicon.ico', {
                method: 'HEAD',
                signal: fallbackController.signal,
                cache: 'no-cache',
                mode: 'no-cors'
            });
            
            clearTimeout(fallbackTimeoutId);
            
            // If we can reach Google but not our backend, backend is offline but user has internet
            updateStatusDisplay(false);
            if (lastKnownStatus !== false) {
                console.warn('❌ Backend offline (internet connection available):', error.name === 'AbortError' ? 'Request timeout' : error.message);
                lastKnownStatus = false;
            }
        } catch (fallbackError) {
            // Both backend and fallback failed - user is likely offline
            updateStatusDisplay(false);
            if (lastKnownStatus !== false) {
                console.warn('❌ No internet connection detected');
                lastKnownStatus = false;
            }
        }
    }
}

function updateStatusDisplay(isOnline) {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    
    if (!statusDot || !statusText) return;
    
    // Remove existing classes
    statusDot.classList.remove('online', 'offline');
    statusText.classList.remove('online', 'offline');
    
    if (isOnline) {
        statusDot.classList.add('online');
        statusText.classList.add('online');
        statusText.textContent = 'Online';
        hideOfflineMode();
    } else {
        statusDot.classList.add('offline');
        statusText.classList.add('offline');
        statusText.textContent = 'Offline';
        showOfflineMode();
    }
}

// Clean up interval on page unload
window.addEventListener('beforeunload', () => {
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
        statusCheckInterval = null;
    }
});

// ===== Offline Mode Management =====
function showOfflineMode() {
    console.log('📱 Entering offline mode');
    
    // Add offline class to body
    document.body.classList.add('offline-mode');
    
    // Show offline overlays container
    const offlineOverlays = document.getElementById('offlineOverlays');
    if (offlineOverlays) {
        offlineOverlays.style.display = 'block';
    }
    
    // Show main content offline overlay (for homepage/favorites)
    showMainContentOfflineOverlay();
    
    // Show game offline overlay if a game is currently open
    if (currentGame) {
        showGameOfflineOverlay();
    }
    
    // Show ads offline overlay
    showAdsOfflineOverlay();
}

function hideOfflineMode() {
    console.log('🌐 Exiting offline mode');
    
    // Remove offline class from body
    document.body.classList.remove('offline-mode');
    
    // Hide offline overlays container
    const offlineOverlays = document.getElementById('offlineOverlays');
    if (offlineOverlays) {
        offlineOverlays.style.display = 'none';
    }
    
    // Hide all individual overlays
    hideMainContentOfflineOverlay();
    hideGameOfflineOverlay();
    hideAdsOfflineOverlay();
}

function showMainContentOfflineOverlay() {
    const overlay = document.getElementById('mainOfflineOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        
        // Position the overlay over the main content area
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            const rect = mainContent.getBoundingClientRect();
            overlay.style.position = 'fixed';
            overlay.style.top = rect.top + 'px';
            overlay.style.left = rect.left + 'px';
            overlay.style.width = rect.width + 'px';
            overlay.style.height = rect.height + 'px';
        }
    }
}

function hideMainContentOfflineOverlay() {
    const overlay = document.getElementById('mainOfflineOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function showGameOfflineOverlay() {
    const overlay = document.getElementById('gameOfflineOverlay');
    if (overlay) {
        overlay.style.display = 'flex';
        
        // Position the overlay over the game iframe
        const gameFrame = document.getElementById('gameFrame');
        if (gameFrame) {
            const rect = gameFrame.getBoundingClientRect();
            overlay.style.position = 'fixed';
            overlay.style.top = rect.top + 'px';
            overlay.style.left = rect.left + 'px';
            overlay.style.width = rect.width + 'px';
            overlay.style.height = rect.height + 'px';
        }
    }
}

function hideGameOfflineOverlay() {
    const overlay = document.getElementById('gameOfflineOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

function showAdsOfflineOverlay() {
    const overlay = document.getElementById('adsOfflineOverlay');
    const adColumn = document.getElementById('adColumn');
    
    if (overlay && adColumn) {
        overlay.style.display = 'flex';
        
        // Position the overlay over the ad column
        const rect = adColumn.getBoundingClientRect();
        overlay.style.position = 'fixed';
        overlay.style.top = rect.top + 'px';
        overlay.style.left = rect.left + 'px';
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
    }
}

function hideAdsOfflineOverlay() {
    const overlay = document.getElementById('adsOfflineOverlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Update overlay positions on window resize
window.addEventListener('resize', () => {
    if (document.body.classList.contains('offline-mode')) {
        showMainContentOfflineOverlay();
        if (currentGame) {
            showGameOfflineOverlay();
        }
        showAdsOfflineOverlay();
    }
});

// ================= Social Layer (User Sync, Friends, Profile, Presence) =================
let socialState = { loaded:false, user:null, syncing:false, presenceInterval:null };
async function socialEnsureAuth(){ 
    if(!auth0Client) {
        console.debug('[Auth] No auth0Client available');
        return false; 
    }
    
    try { 
        const isAuthenticated = await auth0Client.isAuthenticated(); 
        console.debug('[Auth] auth0Client.isAuthenticated():', isAuthenticated);
        
        if(!isAuthenticated) {
            console.debug('[Auth] User not authenticated');
            return false;
        }
        
        return true; // If user is authenticated, we're good
        
    } catch(e) { 
        console.error('[Auth] socialEnsureAuth failed:', e);
        return false; 
    } 
}
// ===== Enhanced Auth Token Helper =====
async function getAuthToken(requireAudience = true) {
    if (!auth0Client) {
        throw new Error('Auth0 client not initialized');
    }

    try {
        // First attempt with audience
        if (requireAudience) {
            try {
                return await auth0Client.getTokenSilently({
                    audience: AUTH0_AUDIENCE,
                    scope: 'openid profile email'
                });
            } catch (audienceError) {
                console.debug('[Auth] Audience token failed, trying without audience:', audienceError.message);
            }
        }

        // Fallback without audience
        try {
            return await auth0Client.getTokenSilently({
                scope: 'openid profile email'
            });
        } catch (fallbackError) {
            console.warn('[Auth] Fallback token failed:', fallbackError.message);
            
            // Try forcing refresh
            try {
                console.debug('[Auth] Attempting force refresh...');
                return await auth0Client.getTokenSilently({
                    audience: requireAudience ? AUTH0_AUDIENCE : undefined,
                    scope: 'openid profile email',
                    ignoreCache: true
                });
            } catch (refreshError) {
                console.error('[Auth] Force refresh failed:', refreshError.message);
                throw new Error('Failed to obtain authentication token after multiple attempts');
            }
        }
    } catch (error) {
        console.error('[Auth] getAuthToken error:', error);
        showNotification('Authentication token error. Please try signing in again.', 'error');
        throw error;
    }
}

async function socialFetchUser(){ 
    if(!(await socialEnsureAuth())) {
        console.debug('[Social] Not authenticated, skipping user fetch');
        return false; // Return false to indicate no data fetched
    }
    
    try {
        const token = await getAuthToken(true);
        
        if(!token) {
            console.warn('[Social] No token available for user fetch');
            throw new Error('No authentication token available');
        }
        
        const r = await fetch(`${BACKEND_URL}/api/user`, {
            headers:{Authorization:`Bearer ${token}`}
        }); 
        
        if(r.ok){ 
            const data = await r.json(); 
            socialState.user=data.user; 
            socialState.loaded=true; 
            console.debug('[Social] User data loaded:', data.user?.profile?.username || 'unnamed');
            
            // These are non-critical, so catch their errors
            try {
                syncFavoritesWithCloud(); 
            } catch(syncError) {
                console.debug('[Social] Favorites sync failed:', syncError);
            }
            
            try {
                renderFriendsPage(); 
            } catch(renderError) {
                console.debug('[Social] Friends page render failed:', renderError);
            }
            
            return true; // Successfully fetched user data
        } else {
            console.warn('[Social] User fetch failed with status:', r.status);
            
            if(r.status === 401) {
                console.warn('[Social] 401 Unauthorized - authentication token may be invalid or expired');
                throw new Error('Authentication failed - token may be expired');
            } else if(r.status === 403) {
                console.warn('[Social] 403 Forbidden - insufficient permissions');
                throw new Error('Access denied - insufficient permissions');
            } else {
                throw new Error(`User fetch failed with status ${r.status}`);
            }
        }
    } catch(e){ 
        console.error('[Social] User data fetch failed:', e.message);
        throw e; // Re-throw so calling functions know it failed
    } 
}

// Sync favorites/settings local->cloud & cloud->local minimal strategy
async function syncFavoritesWithCloud(){ if(!socialState.user) return; // Merge
    const cloudFav = Array.isArray(socialState.user.favorites)? socialState.user.favorites:[]; const localFav = favorites.slice();
    // union
    const merged = Array.from(new Set([...cloudFav, ...localFav]));
    // If differs push to backend
    if(JSON.stringify(merged)!==JSON.stringify(cloudFav)){
        const token = await auth0Client.getTokenSilently?.().catch(()=>null); if(token){ try { await fetch(`${BACKEND_URL}/api/user/favorites`, {method:'PUT', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body:JSON.stringify(merged)}); } catch(e){} }
    }
    favorites = merged; saveFavoritesToCookies(); renderFavoritesSection();
}

// Override favorite toggle to initiate sync when authenticated
const __origToggleFavorite = window.toggleFavoriteFromGamePage;
if(typeof __origToggleFavorite === 'function'){
    window.toggleFavoriteFromGamePage = async function(){ __origToggleFavorite.apply(this, arguments); if(await socialEnsureAuth()){ setTimeout(()=>socialUploadFavorites(),500); } };
}
async function socialUploadFavorites(){ 
    if(!(await socialEnsureAuth())) return; 
    
    const token = await getAuthToken();
    if(!token) return; 
    
    try { 
        await fetch(`${BACKEND_URL}/api/user/favorites`, {
            method:'PUT', 
            headers:{
                'Content-Type':'application/json', 
                Authorization:`Bearer ${token}`
            }, 
            body:JSON.stringify(favorites)
        }); 
    } catch(e){ 
        console.warn('[Favorites] Upload failed:', e);
    }
}

// Friends Page logic
function showFriendsPage(){
    console.debug('[Friends] showFriendsPage called');
    hideAllPages(true);
    const page=document.getElementById('friendsPage'); 
    if(!page) return;
    page.style.display='block';
    page.classList.add('active');
    void page.offsetHeight; // reflow
    
    // Initialize tabs immediately when page is shown
    setTimeout(() => {
        initFriendsTabs();
    }, 50);
    
    // Always re-render to check current auth state
    renderFriendsPage();
}

// Attach to nav switch
(function hookNav(){ const navContainer=document.querySelector('.sidebar-nav'); if(!navContainer) return; const orig = updateNavigationStats; // not altering existing switch logic, add listener separately
    navContainer.addEventListener('click', e=>{ const li=e.target.closest('li.nav-item[data-page="friends"]'); if(li){ e.preventDefault(); showFriendsPage(); }});
})();

async function renderFriendsPage(){ 
    const page=document.getElementById('friendsPage'); 
    if(!page) return; 
    
    console.debug('[Friends] renderFriendsPage called');
    
    const authNotice=document.getElementById('friendsAuthNotice'); 
    const content=document.getElementById('friendsContent'); 
    
    // Always start by hiding both sections
    if(authNotice) authNotice.style.display='none';
    if(content) content.style.display='none';
    
    const loggedIn = await socialEnsureAuth(); 
    console.debug('[Friends] Authentication check result:', loggedIn);
    
    if(!loggedIn){ 
        console.debug('[Friends] User not authenticated, showing auth notice');
        if(authNotice) authNotice.style.display='block'; 
        const btn=document.getElementById('friendsLoginBtn'); 
        if(btn) btn.onclick=()=>login(); 
        return; 
    } 
    
    console.debug('[Friends] User authenticated, showing friends content');
    if(content) content.style.display='block';
    
    if(!socialState.user) { 
        console.debug('[Friends] No user data, fetching...');
        await socialFetchUser(); 
    }
    
    const u = socialState.user; 
    if(!u) {
        console.warn('[Friends] Failed to get user data after fetch');
        return;
    }
    
    const friends = u.friends||{list:[], incoming:[], outgoing:[]};
    
    // Update stats
    updateFriendsStats(friends);
    
    // Render friends lists
    const friendsList = document.getElementById('friendsList'); 
    const incomingList=document.getElementById('incomingList'); 
    const outgoingList=document.getElementById('outgoingList');
    
    if(friendsList){ 
        friendsList.innerHTML = friends.list.length? 
            friends.list.map(id=>`<li class="friend-item" data-id="${id}">
                <span>${shortUserId(id)}</span>
                <div class="friend-actions">
                    <button data-remove="${id}" class="mini-btn danger">Remove</button>
                </div>
            </li>`).join('') : 
            '<li class="muted-hint">No friends yet</li>'; 
    }
    
    if(incomingList){ 
        incomingList.innerHTML = friends.incoming.length? 
            friends.incoming.map(id=>`<li class="friend-item" data-id="${id}">
                <span>${shortUserId(id)}</span>
                <div class="friend-actions">
                    <button data-accept="${id}" class="mini-btn">Accept</button>
                    <button data-decline="${id}" class="mini-btn danger">Decline</button>
                </div>
            </li>`).join('') : 
            '<li class="muted-hint">No requests</li>'; 
    }
    
    if(outgoingList){ 
        outgoingList.innerHTML = friends.outgoing.length? 
            friends.outgoing.map(id=>`<li class="friend-item" data-id="${id}">
                <span>${shortUserId(id)}</span>
                <div class="friend-actions">
                    <button data-cancel="${id}" class="mini-btn danger">Cancel</button>
                </div>
            </li>`).join('') : 
            '<li class="muted-hint">No sent requests</li>'; 
    }
    
    // Wire up events
    wireFriendsEvents(); 
    updatePresence(); 
}

function updateFriendsStats(friends) {
    const totalCount = document.getElementById('totalFriendsCount');
    const pendingCount = document.getElementById('pendingRequestsCount');
    
    if(totalCount) totalCount.textContent = friends.list.length;
    if(pendingCount) pendingCount.textContent = friends.incoming.length;
    // Online count will be updated by updatePresence
}

function initFriendsTabs() {
    const tabs = document.querySelectorAll('.friends-tab');
    const contents = document.querySelectorAll('.friends-tab-content');
    
    console.log('Initializing friends tabs:', tabs.length, 'tabs,', contents.length, 'contents');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = tab.dataset.tab;
            console.log('Friends tab clicked:', targetTab);
            
            // Remove active from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            // Add active to clicked tab and corresponding content
            tab.classList.add('active');
            const targetContent = document.getElementById(`friendsTab${targetTab.charAt(0).toUpperCase() + targetTab.slice(1)}`);
            console.log('Target content element:', targetContent?.id);
            if(targetContent) {
                targetContent.classList.add('active');
                console.log('Activated tab content:', targetContent.id);
            } else {
                console.error('Could not find tab content for:', targetTab);
            }
            
            // Debug: Log all current active states
            console.log('Current active tabs:', [...tabs].filter(t => t.classList.contains('active')).map(t => t.dataset.tab));
            console.log('Current active contents:', [...contents].filter(c => c.classList.contains('active')).map(c => c.id));
        });
    });
    
    // Ensure only the first tab is active by default and all others are inactive
    tabs.forEach((tab, index) => {
        if (index === 0) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    contents.forEach((content, index) => {
        if (index === 0) {
            content.classList.add('active');
        } else {
            content.classList.remove('active');
        }
    });
    
    console.log('Friends tabs initialized - Active tab:', [...tabs].find(t => t.classList.contains('active'))?.dataset.tab);
}

function shortUserId(id){ return id.split('|').pop(); }

async function refreshFriendsPage() {
    try {
        console.log('[Friends] Refreshing friends page...');
        await renderFriendsPage();
        console.log('[Friends] Friends page refreshed successfully');
    } catch (error) {
        console.error('[Friends] Error refreshing friends page:', error);
    }
}

async function wireFriendsEvents(){ const page=document.getElementById('friendsPage'); if(!page) return; page.querySelectorAll('button[data-remove]').forEach(b=> b.onclick=()=>friendAction('remove',{user:b.getAttribute('data-remove')})); page.querySelectorAll('button[data-accept]').forEach(b=> b.onclick=()=>friendAction('accept',{from:b.getAttribute('data-accept')})); page.querySelectorAll('button[data-decline]').forEach(b=> b.onclick=()=>friendAction('decline',{from:b.getAttribute('data-decline')})); page.querySelectorAll('button[data-cancel]').forEach(b=> b.onclick=()=>friendAction('decline',{from:b.getAttribute('data-cancel')})); const form=document.getElementById('addFriendForm'); if(form){ form.onsubmit= async e=>{ e.preventDefault(); const uname=document.getElementById('addFriendUsername').value.trim(); if(!uname) return; const res = await friendAction('request',{username:uname}); const fb=document.getElementById('addFriendFeedback'); if(fb) fb.textContent = res?.error? res.error : 'Request sent'; if(!res.error) form.reset(); }; }}

async function friendAction(action, body){ 
    if(!(await socialEnsureAuth())) return; 
    
    try {
        const token = await getAuthToken(true);
        
        if(!token) return {error: 'No token available'}; 
        
        const r= await fetch(`${BACKEND_URL}/api/friends/${action}`, {
            method:'POST', 
            headers:{
                'Content-Type':'application/json', 
                Authorization:`Bearer ${token}`
            }, 
            body:JSON.stringify(body)
        }); 
        const data= await r.json(); 
        
        if(r.ok){ 
            await socialFetchUser(); 
            await refreshFriendsPage(); // Refresh the UI after successful action
            showSuccess(`Friend action completed successfully`);
        } else {
            showError(data.error || 'Friend action failed');
        }
        
        return data; 
    } catch(e){ 
        console.error('Friend action error:', e);
        showError('Network error during friend action');
        return {error:'Network error'}; 
    } 
}

// Presence
async function presenceHeartbeat(){ 
    if(!(await socialEnsureAuth())) return; 
    
    const token = await getAuthToken();
    if(!token) return; 
    
    try { 
        const gameId = currentGame? currentGame.id : null; 
        await fetch(`${BACKEND_URL}/api/presence`, {
            method:'POST', 
            headers:{
                'Content-Type':'application/json', 
                Authorization:`Bearer ${token}`
            }, 
            body:JSON.stringify({game:gameId})
        }); 
    } catch(e){
        console.debug('[Presence] Heartbeat failed:', e);
    } 
}
async function updatePresence(){ 
    if(!socialState.user || !socialState.user.friends) return; 
    const ids = socialState.user.friends.list.join(','); 
    if(!ids) {
        // Update online count to 0 if no friends
        const onlineCount = document.getElementById('onlineFriendsCount');
        if(onlineCount) onlineCount.textContent = '0';
        return;
    }
    
    const token = await getAuthToken();
    if(!token) return; 
    
    try { 
        const r = await fetch(`${BACKEND_URL}/api/presence?ids=${encodeURIComponent(ids)}`, {
            headers:{Authorization:`Bearer ${token}`}
        }); 
        if(!r.ok) return; 
        const data = await r.json(); 
        
        const onlineCount = Object.keys(data.presence||{}).length;
        
        // Update online friends count in stats
        const onlineCountEl = document.getElementById('onlineFriendsCount');
        if(onlineCountEl) onlineCountEl.textContent = onlineCount;
        
        // Update presence list in overview tab
        const presenceList=document.getElementById('presenceList'); 
        if(presenceList){ 
            presenceList.innerHTML = onlineCount? 
                Object.entries(data.presence).map(([id,p])=>`<li class="friend-item online">
                    <span>${shortUserId(id)}</span>
                    <span class="presence-pill">${p.game? 'In game #'+p.game : 'Online'}</span>
                </li>`).join('') : 
                '<li class="muted-hint">No friends online</li>'; 
        } 
    } catch(e){
        console.warn('Failed to update presence:', e);
    } 
}

async function refreshFriendsPage() {
    const friendsPage = document.getElementById('friendsPage');
    if(friendsPage && friendsPage.style.display !== 'none') {
        await renderFriendsPage();
    }
}

// Kick off social fetch after auth established
const __origInitAuth0 = initAuth0;
initAuth0 = async function(){ 
    await __origInitAuth0(); 
    
    try { 
        // Refresh auth state after initialization
        await refreshAuthState();
        
        // Initialize social features if authenticated
        if(await socialEnsureAuth()){ 
            console.debug('[Social] User authenticated, initializing social features');
            
            // Try to fetch user data, but don't fail initialization if it doesn't work
            try {
                await socialFetchUser(); 
                console.debug('[Social] User data fetched successfully during initialization');
            } catch(userFetchError) {
                console.warn('[Social] Failed to fetch user data during initialization:', userFetchError.message);
                console.debug('[Social] This is not critical - user data will be fetched when needed');
            }
            
            // Start presence system (this should be more robust)
            try {
                presenceHeartbeat(); 
                if(!socialState.presenceInterval) {
                    socialState.presenceInterval = setInterval(()=>{ 
                        presenceHeartbeat(); 
                        updatePresence(); 
                    }, 30000); 
                }
            } catch(presenceError) {
                console.debug('[Social] Presence system failed to start:', presenceError);
            }
        } else {
            console.debug('[Social] User not authenticated, skipping social features');
        }
    } catch(e){
        console.warn('[Social] Non-critical error in enhanced initAuth0:', e.message);
        // Don't fail initialization for social features
    } 
};

// Public API for UI debugging
window.WaterWallSocial = { refreshUser: socialFetchUser, pushFavorites: socialUploadFavorites };

// MutationObserver to refresh when friends page inserted dynamically
if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', ()=>{ if(location.hash==='#friends') showFriendsPage(); }); }
// ============================================================================

// ================= Error Handling & DOM Validation =================

function validateCriticalDOM() {
    const critical = [
        'searchInput', 'gamesGrid', 'sidebar', 'homePage', 
        'gamesPage', 'settingsPage', 'friendsPage'
    ];
    
    const missing = critical.filter(id => !document.getElementById(id));
    
    if(missing.length > 0) {
        console.error('❌ Critical DOM elements missing:', missing);
        return false;
    }
    
    return true;
}

function setupGlobalErrorHandler() {
    window.addEventListener('error', (event) => {
        console.error('❌ Global error:', event.error);
        // Don't let errors crash the app
        event.preventDefault();
    });
    
    window.addEventListener('unhandledrejection', (event) => {
        console.error('❌ Unhandled promise rejection:', event.reason);
        // Don't let promise rejections crash the app
        event.preventDefault();
    });
}

// Monitor authentication state changes
let lastAuthState = false;
async function monitorAuthState() {
    if(!auth0Client) return;
    
    try {
        const currentAuthState = await socialEnsureAuth();
        if(currentAuthState !== lastAuthState) {
            console.debug('[Auth] Authentication state changed:', lastAuthState, '->', currentAuthState);
            lastAuthState = currentAuthState;
            await refreshAuthState();
        }
    } catch(e) {
        console.error('[Auth] Error monitoring auth state:', e);
    }
}

// Start monitoring authentication state
setInterval(monitorAuthState, 2000); // Check every 2 seconds

// Initialize error handling
setupGlobalErrorHandler();

// ================= Profile UI / Dropdown & Settings =================
let profileDropdownEl=null, profileOpen=false;
function initProfileDropdown(){
    if(profileDropdownEl){ return; }
    profileDropdownEl = document.getElementById('profileDropdown');
    const accountNav = document.getElementById('accountNavItem');
    console.debug('[ProfileDropdown] attempting init, dropdown found:', !!profileDropdownEl, 'account nav found:', !!accountNav);
    if(!profileDropdownEl || !accountNav) return;
    console.debug('[ProfileDropdown] initialized');
    // Add direct click handler to accountNav with higher priority
    accountNav.addEventListener('click', async (e)=>{
        console.debug('[ProfileDropdown] DIRECT account click handler fired!');
        e.preventDefault();
        e.stopPropagation();
        if(!(await socialEnsureAuth())){ 
            console.debug('[ProfileDropdown] not authenticated, redirecting to login');
            if(auth0Client) {
                auth0Client.loginWithRedirect();
            } else {
                console.warn('[ProfileDropdown] auth0Client not available');
            }
            return; 
        }
        console.debug('[ProfileDropdown] authenticated, calling toggleProfileDropdown');
        toggleProfileDropdown();
    }, true); // use capture phase to fire before bubbling handlers
    document.getElementById('logoutFromDropdownBtn')?.addEventListener('click', ()=>{ toggleProfileDropdown(false); showLogoutConfirm(); });
    document.getElementById('openProfileSettingsBtn')?.addEventListener('click', ()=>{ toggleProfileDropdown(false); showProfileSettingsPage(); });
    document.addEventListener('click', (ev)=>{ if(profileOpen && profileDropdownEl && !profileDropdownEl.contains(ev.target) && !accountNav.contains(ev.target)){ toggleProfileDropdown(false); } });
}
function toggleProfileDropdown(force){
    console.debug('[ProfileDropdown] toggleProfileDropdown called with force:', force);
    if(!profileDropdownEl){ 
        profileDropdownEl=document.getElementById('profileDropdown'); 
        console.debug('[ProfileDropdown] had to re-find dropdown element:', !!profileDropdownEl);
    }
    const acct=document.getElementById('accountNavItem');
    if(!profileDropdownEl || !acct) {
        console.warn('[ProfileDropdown] missing elements - dropdown:', !!profileDropdownEl, 'account:', !!acct);
        return;
    }
    const rect = acct.getBoundingClientRect();
    const sidebar = document.querySelector('.sidebar');
    const sidebarRect = sidebar ? sidebar.getBoundingClientRect() : null;
    
    // Force dropdown to be visible first to get accurate height
    profileDropdownEl.style.display = 'block';
    profileDropdownEl.style.opacity = '0';
    const dropdownHeight = profileDropdownEl.offsetHeight;
    
    if(sidebarRect) {
        // Position dropdown to span sidebar width with small gaps
        profileDropdownEl.style.left = (sidebarRect.left + 12) + 'px'; // 12px gap from left
        profileDropdownEl.style.width = (sidebarRect.width - 24) + 'px'; // 12px gap on each side
        // Position ABOVE the profile button by subtracting dropdown height
        profileDropdownEl.style.top = (rect.top - dropdownHeight - 12) + 'px';
        profileDropdownEl.style.transform = 'none'; // remove centering transform
    } else {
        // Fallback to original centering if sidebar not found
        profileDropdownEl.style.left = (rect.left + rect.width/2) + 'px';
        profileDropdownEl.style.top = (rect.top - dropdownHeight - 12) + 'px';
    }
    profileOpen = (force!==undefined? force : !profileOpen);
    profileDropdownEl.classList.toggle('open', profileOpen);
    profileDropdownEl.setAttribute('aria-hidden', profileOpen? 'false':'true');
    
    // Reset opacity after positioning
    if(profileOpen) {
        profileDropdownEl.style.opacity = '1';
    } else {
        profileDropdownEl.style.display = 'none';
    }
    
    console.debug('[ProfileDropdown] toggle complete - profileOpen:', profileOpen, 'element classes:', profileDropdownEl.className);
}
async function showProfileSettingsPage(){ 
    console.debug('[Profile] showProfileSettingsPage called');
    
    try {
        // Check authentication first
        const isAuthenticated = await socialEnsureAuth();
        if(!isAuthenticated) {
            console.warn('[Profile] User not authenticated, redirecting to login');
            login();
            return;
        }
        
        hideAllPages(true);
        const page=document.getElementById('profileSettingsPage'); 
        
        if(!page){ 
            console.error('[Profile] profileSettingsPage element not found');
            return; 
        }
        
        page.style.display='block'; 
        page.classList.add('active'); 
        
        // Reset the load attempts counter when opening the page
        profileFormLoadAttempts = 0;
        loadProfileForm(); 
    } catch(error) {
        console.error('[Profile] Error showing profile settings page:', error);
        // If there's an error, try to redirect to login
        login();
    }
}

// Avatar & profile form logic
let profileFormLoadAttempts = 0;
const MAX_PROFILE_LOAD_ATTEMPTS = 3;

function loadProfileForm(){ 
    console.debug('[Profile] loadProfileForm called, attempt:', profileFormLoadAttempts + 1);
    
    try {
        // Check if profile form exists
        const profileForm = document.getElementById('profileForm');
        if(!profileForm) {
            console.error('[Profile] profileForm not found, profile settings page may not be loaded');
            return;
        }
        
        if(!socialState.user){ 
            // Prevent infinite recursion
            if(profileFormLoadAttempts >= MAX_PROFILE_LOAD_ATTEMPTS) {
                console.warn('[Profile] Max load attempts reached, showing form with defaults');
                profileFormLoadAttempts = 0;
                // Show form with default values instead of failing
                loadFormWithDefaults();
                return;
            }
            
            profileFormLoadAttempts++;
            console.debug('[Profile] No user data, fetching... (attempt', profileFormLoadAttempts, '/', MAX_PROFILE_LOAD_ATTEMPTS, ')');
            
            socialFetchUser().then(()=> {
                console.debug('[Profile] User data fetched successfully, loading form');
                profileFormLoadAttempts = 0; // Reset on success
                loadProfileForm();
            }).catch(error => {
                console.error('[Profile] Error fetching user data:', error);
                // Don't retry immediately, just load defaults
                profileFormLoadAttempts = 0;
                loadFormWithDefaults();
            });
            return; 
        }
        
        // Reset attempts on successful load
        profileFormLoadAttempts = 0; 
        
        const u=socialState.user; 
        const prof=u?.profile||{}; 
        
        const unameInput=document.getElementById('profileUsername'); 
        if(unameInput){ 
            unameInput.value = prof.username || ''; 
            console.debug('[Profile] Set username:', prof.username || '(empty)');
        } else {
            console.warn('[Profile] profileUsername element not found');
        }
        
        const colorInput=document.getElementById('profileColor'); 
        if(colorInput){ 
            colorInput.value = prof.color || settings.accentColor || '#58a6ff'; 
            console.debug('[Profile] Set color:', prof.color || settings.accentColor || '#58a6ff');
        } else {
            console.warn('[Profile] profileColor element not found');
        }
        
        // avatar
        const avatarPreview=document.getElementById('avatarPreview'); 
        const placeholder=document.getElementById('avatarPlaceholder');
        
        if(avatarPreview && prof.avatar){ 
            avatarPreview.src=prof.avatar; 
            avatarPreview.style.display='block'; 
            if(placeholder) placeholder.style.display='none'; 
            console.debug('[Profile] Set avatar preview');
        } else if(placeholder) {
            placeholder.style.display='block';
            if(avatarPreview) avatarPreview.style.display='none';
        }
    } catch(error) {
        console.error('[Profile] Error in loadProfileForm:', error);
        profileFormLoadAttempts = 0;
        loadFormWithDefaults();
    }
}

function loadFormWithDefaults() {
    console.debug('[Profile] Loading form with default values');
    
    try {
        const unameInput=document.getElementById('profileUsername'); 
        if(unameInput) unameInput.value = '';
        
        const colorInput=document.getElementById('profileColor'); 
        if(colorInput) colorInput.value = settings.accentColor || '#58a6ff';
        
        const avatarPreview=document.getElementById('avatarPreview'); 
        const placeholder=document.getElementById('avatarPlaceholder');
        
        if(placeholder) {
            placeholder.style.display='block';
            if(avatarPreview) avatarPreview.style.display='none';
        }
    } catch(error) {
        console.error('[Profile] Error loading form defaults:', error);
    }
}

function initProfileForm(){ 
    console.debug('[Profile] initProfileForm called');
    
    const form=document.getElementById('profileForm'); 
    if(!form) {
        console.warn('[Profile] profileForm not found during initialization');
        return; 
    }
    
    const avatarInput=document.getElementById('avatarInput'); 
    const uploader=document.getElementById('avatarUploader'); 
    const avatarPreview=document.getElementById('avatarPreview'); 
    const placeholder=document.getElementById('avatarPlaceholder');
    
    if(avatarInput){ 
        avatarInput.addEventListener('change', ()=>{ 
            const file=avatarInput.files?.[0]; 
            if(!file) return; 
            if(file.size> 512*1024){ 
                alert('Avatar max size 512KB'); 
                avatarInput.value=''; 
                return; 
            } 
            const reader=new FileReader(); 
            reader.onload=()=>{ 
                if(avatarPreview){ 
                    avatarPreview.src=reader.result; 
                    avatarPreview.style.display='block'; 
                    if(placeholder) placeholder.style.display='none'; 
                } 
            }; 
            reader.readAsDataURL(file); 
        }); 
    }
    
    if(uploader){ 
        uploader.addEventListener('keydown', e=>{ 
            if(e.key==='Enter' || e.key===' ') { 
                e.preventDefault(); 
                avatarInput?.click(); 
            }
        }); 
    }
    
    form.addEventListener('submit', async (e)=>{ 
        e.preventDefault(); 
        
        if(!(await socialEnsureAuth())) { 
            showProfileSaveIndicator('Please log in', true);
            login(); 
            return; 
        } 
        
        const uname=document.getElementById('profileUsername').value.trim(); 
        if(uname && !/^[a-zA-Z0-9_]{3,24}$/.test(uname)){ 
            showProfileSaveIndicator('Invalid username (3-24 chars, letters/numbers/_)', true); 
            return; 
        } 
        
        const color=document.getElementById('profileColor').value; 
        let avatar=null; 
        const file=avatarInput?.files?.[0]; 
        if(file){ 
            avatar = avatarPreview?.src; 
        }
        
        showProfileSaveIndicator('Saving...'); 
        
        try {
            const token = await getAuthToken(true);
            
            if(!token){ 
                showProfileSaveIndicator('Failed to get auth token', true); 
                console.error('[Profile] No auth token available');
                return; 
            }
            
            const body={}; 
            if(uname) body.username=uname; 
            if(color) body.color=color; 
            if(avatar) body.avatar=avatar; 
            
            const r= await fetch(`${BACKEND_URL}/api/user/profile`, {
                method:'PUT', 
                headers:{
                    'Content-Type':'application/json', 
                    Authorization:`Bearer ${token}`
                }, 
                body:JSON.stringify(body)
            }); 
            
            const data=await r.json(); 
            
            if(r.ok){ 
                showProfileSaveIndicator('Saved successfully!', false, true); 
                showSuccess('Profile updated successfully!');
                await socialFetchUser(); 
                if(color){ 
                    settings.accentColor=color; 
                    applyTheme(); 
                } 
            } else { 
                console.error('[Profile] Save failed:', data);
                const errorMsg = data.error || 'Save failed';
                showProfileSaveIndicator(errorMsg, true);
                showError(`Profile save failed: ${errorMsg}`);
            } 
        } catch(err){ 
            console.error('[Profile] Network/auth error:', err);
            const errorMsg = 'Network or authentication error';
            showProfileSaveIndicator(errorMsg, true);
            showError(`Profile save error: ${err.message}`);
        }
    });
    
    document.getElementById('profileCancelBtn')?.addEventListener('click', ()=>{ 
        loadProfileForm(); 
        showProfileSaveIndicator('Reverted', false); 
        setTimeout(()=>hideProfileSaveIndicator(), 1200); 
    });
}
function showProfileSaveIndicator(msg, isError=false, success=false){ const el=document.getElementById('profileSaveIndicator'); if(!el) return; el.style.display='flex'; el.textContent=msg; el.classList.remove('error','success'); if(isError) el.classList.add('error'); else if(success) el.classList.add('success'); }
function hideProfileSaveIndicator(){ const el=document.getElementById('profileSaveIndicator'); if(el){ el.style.display='none'; }}

function showLogoutConfirm(){ 
    try {
        const modal=document.getElementById('logoutConfirmModal'); 
        if(modal){ 
            modal.style.display='flex'; 
            modal.setAttribute('aria-hidden','false'); 
            console.debug('[Logout] Logout confirmation modal shown');
        } else {
            console.warn('[Logout] Logout modal not found, using confirm dialog');
            if(confirm('Are you sure you want to log out?')) {
                if(auth0Client) {
                    auth0Client.logout({ logoutParams: { returnTo: window.location.origin } });
                } else {
                    localStorage.clear();
                    sessionStorage.clear();
                    window.location.href = window.location.origin;
                }
            }
        }
    } catch(error) {
        console.error('[Logout] Error showing logout confirmation:', error);
        // Fallback to simple confirm
        if(confirm('Are you sure you want to log out?')) {
            localStorage.clear();
            sessionStorage.clear();
            window.location.href = window.location.origin;
        }
    }
}

// Initialize after DOM ready
document.addEventListener('DOMContentLoaded', ()=>{ 
    if(!validateCriticalDOM()) {
        console.error('❌ Critical DOM validation failed, some features may not work');
    }
    initProfileDropdown(); 
    initProfileForm(); 
});
// Fallback: if for any reason dropdown not initialized after 2s (e.g., delayed DOM), attempt again
setTimeout(()=>{ if(!profileDropdownEl){ console.debug('[ProfileDropdown] late init retry'); initProfileDropdown(); } },2000);
// ========================================================================================




