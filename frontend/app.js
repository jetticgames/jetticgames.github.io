// Global variables
console.log('🎮 WaterWall app.js is loading...');

let games = [];
let __appInitStarted = false;
let __authRedirectHandled = false;
let currentGame = null;
let isProxyEnabled = false; // Disabled by default per new requirement
const proxyUrl = 'https://waterwallrelayservice.zonikyo.workers.dev/proxy';
let favorites = [];
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
console.log('[Auth0] Using redirect_uri:', auth0Config.authorizationParams.redirect_uri);

// ===== Global Page Loader (initial page load experience) =====
let __pageLoaderEl=null, __pageLoaderStart=performance.now(), __pageLoaderMin=2000, __pageLoaderDone=false;
let __pageLoaderStages={ dom:false, games:false, auth:false, ui:false, final:false };
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
    const coreDone = __pageLoaderStages.games && __pageLoaderStages.auth && __pageLoaderStages.ui;
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
    
    try {
        // Initialize DOM elements first
        initializeDOMElements();
    accountLabelEl = document.getElementById('accountLabel');
    logoutModalEl = document.getElementById('logoutConfirmModal');
    logoutConfirmBtn = document.getElementById('logoutConfirmBtn');
    logoutCancelBtn = document.getElementById('logoutCancelBtn');
        
        // Load games (with immediate fallback)
        await loadGamesWithFallback();
        signalPageLoaderStage('games');
        
        // Setup event listeners
        setupEventListeners();
    await initAuth0();
    signalPageLoaderStage('auth');
        
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
        
    // Show error and hide loader
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
            console.warn('⚠️ games.json empty or invalid');
            games = [];
            showGamesLoadFailure();
        }
    } catch (e) {
        console.error('❌ games.json load failed', e);
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

function forceRenderGames() {
    console.log('🎨 Force rendering games...');
    console.log('📊 Games to render:', games.length);
    
    const allGamesGrid = document.getElementById('allGames');
    
    if (!allGamesGrid) {
        console.error('❌ Required DOM elements not found!');
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
    if(accountNav){
        accountNav.onclick=(e)=>{ e.preventDefault(); handleAccountButton(); };
    }
    const loginBtn=document.getElementById('loginBtn');
    if(loginBtn){ loginBtn.onclick=()=> auth0Client.loginWithRedirect(); }
    const logoutBtn=document.getElementById('logoutBtn');
    if(logoutBtn){ logoutBtn.onclick=()=> openLogoutModal(); }
    if(logoutConfirmBtn){ logoutConfirmBtn.onclick=()=> { if(auth0Client){ auth0Client.logout({ logoutParams:{ returnTo: window.location.origin }}); } }; }
    if(logoutCancelBtn){ logoutCancelBtn.onclick=()=> closeLogoutModal(); }
}

function handleAccountButton(){
    if(!auth0Client){ markAuthUnavailable(); return; }
    auth0Client.isAuthenticated().then(isAuth=>{
        if(!isAuth){ auth0Client.loginWithRedirect(); }
        else { openLogoutModal(); }
    }).catch(()=>{ markAuthUnavailable(); });
}
function openLogoutModal(){ if(logoutModalEl){ logoutModalEl.style.display='flex'; setTimeout(()=> logoutConfirmBtn?.focus(), 30);} }
function closeLogoutModal(){ if(logoutModalEl){ logoutModalEl.style.display='none'; } }

async function updateAuthUI(){
    if(!auth0Client){ if(accountLabelEl) accountLabelEl.textContent='Auth...'; return; }
    try {
        const isAuth = await auth0Client.isAuthenticated();
        if(isAuth){
            const user = await auth0Client.getUser();
            const label = user && (user.given_name || user.nickname || user.name || user.email);
            if(accountLabelEl) accountLabelEl.textContent = label || 'Account';
        } else {
            if(accountLabelEl) accountLabelEl.textContent='Sign in';
        }
    } catch(e){
        console.error('updateAuthUI error', e);
        if(accountLabelEl) accountLabelEl.textContent='Auth error';
    }
}

// Load games from JSON
async function loadGames() {
    try {
        console.log('🔄 Loading games from games.json...');
        const response = await fetch('./games.json');
        console.log('📡 Fetch response status:', response.status, response.statusText);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        console.log('📊 Raw JSON data:', data);
        if (!Array.isArray(data) || data.length === 0) throw new Error('Invalid or empty games data');
        games = data;
        console.log(`✅ Successfully loaded ${games.length} games from JSON`);
        return games;
    } catch (error) {
        console.error('❌ Error loading games.json:', error);
        showPopupError('Failed to load games. Please try again later.');
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
    if (navItem.id === 'accountNavItem') { handleAccountButton(); return; }
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
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    
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
    hideAllPages();
    const fav=document.getElementById('favoritesPage'); if(fav) fav.classList.add('active');
    renderFavoritesPage();
}

function showSettingsPage(){
    ensureSettingsPage();
    hideAllPages();
    const pg=document.getElementById('settingsPage'); if(pg) pg.classList.add('active');
    const chk=document.getElementById('proxyToggleSetting'); if(chk) chk.checked=isProxyEnabled;
}

function showGamePage(game) {
    console.log('Showing game page for:', game.title);
    currentGame = game;
    hideAllPages();
    
    // Clear the previous game iframe
    const gameFrame = document.getElementById('gameFrame');
    if (gameFrame) {
        gameFrame.src = 'about:blank';
    }
    
    document.getElementById('gamePage').classList.add('active');
    
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
    const col=document.getElementById('adColumn');
    if(!col) return;
    col.innerHTML='';
    // Determine number of ads based on viewport & content height (min 2, up to 6)
    const base = Math.ceil(window.innerHeight / 300); // rough vertical capacity
    const count = Math.min(Math.max(base,2),6);
    for(let i=0;i<count;i++){
        const slot=document.createElement('div');
        slot.className='ad-slot loading';
    // Insert provided ad snippet EXACTLY as given
    slot.innerHTML = "<div id=\"frame\" style=\"width: 100%;margin: auto;background: rgba(0, 0, 0, 0.50);position: relative; z-index: 99998;\">\n          <iframe data-aa='2408693' src='//acceptable.a-ads.com/2408693/?size=Adaptive'\n                            style='border:0; padding:0; width:70%; height:auto; overflow:hidden;display: block;margin: auto'></iframe>\n        </div>";
    // Remove loading class once iframe loads
    const innerFrame = slot.querySelector('iframe');
    if(innerFrame){ innerFrame.addEventListener('load', ()=> slot.classList.remove('loading')); }
        col.appendChild(slot);
    }
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

function hideAllPages() {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
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
        
        // Apply proxy if enabled
    if (isProxyEnabled && !gameUrl.startsWith(proxyUrl)) {
            // Use ?url= parameter format which is more standard for proxy services
            gameUrl = proxyUrl + '?url=' + encodeURIComponent(gameUrl);
        } else if (!isProxyEnabled && gameUrl.startsWith(proxyUrl)) {
            // Extract URL from proxy format
            if (gameUrl.includes('?url=')) {
                gameUrl = decodeURIComponent(gameUrl.split('?url=')[1]);
            } else {
                gameUrl = decodeURIComponent(gameUrl.replace(proxyUrl, ''));
            }
        }
        
        // Validate URL
    // Final sanity check already performed above
        
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
    // Create a simple toast notification
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #dc3545;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Slide in
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 5 seconds
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 5000);
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
                                    <input type="checkbox" id="particlesEnabledSetting" class="ww-switch-input" ${settings.particlesEnabled?'checked':''} onchange="(function(el){settings.particlesEnabled=el.checked;saveSettingsToCookies();applyTheme();})(this)">
                                    <span class="ww-switch" aria-hidden="true"></span>
                                </label>
                            </div>
                            <div class="setting-item">
                                <label class="range-setting">
                                    <span class="setting-title">Particle Speed</span>
                                    <span class="setting-sub">Control how fast particles move</span>
                                    <input type="range" id="particleSpeedSetting" min="0.1" max="2" step="0.1" value="${settings.particleSpeed}" onchange="(function(el){settings.particleSpeed=parseFloat(el.value);saveSettingsToCookies();applyTheme();document.getElementById('particleSpeedValue').textContent=el.value;})(this)" class="range-input">
                                    <span id="particleSpeedValue">${settings.particleSpeed}</span>
                                </label>
                            </div>
                            <div class="setting-item">
                                <label class="range-setting">
                                    <span class="setting-title">Particle Count</span>
                                    <span class="setting-sub">Number of particles on screen</span>
                                    <input type="range" id="particleCountSetting" min="10" max="200" value="${settings.particleCount}" onchange="(function(el){settings.particleCount=parseInt(el.value);saveSettingsToCookies();applyTheme();document.getElementById('particleCountValue').textContent=el.value;})(this)" class="range-input">
                                    <span id="particleCountValue">${settings.particleCount}</span>
                                </label>
                            </div>
                            <div class="setting-item">
                                <label class="color-setting">
                                    <span class="setting-title">Particle Color</span>
                                    <span class="setting-sub">Choose particle and line color</span>
                                    <input type="color" id="particleColorSetting" value="${settings.particleColor}" onchange="(function(el){settings.particleColor=el.value;saveSettingsToCookies();applyTheme();})(this)" class="color-input">
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
        document.body.style.cursor = '';
        document.querySelectorAll('*').forEach(el => {
            if (el.style.cursor) {
                el.style.cursor = '';
            }
        });
        return;
    }
    
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
    // Reset settings to defaults
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
    
    // Save to localStorage
    saveSettingsToCookies();
    
    // Apply the reset settings
    applyTheme();
    
    // Update the settings page UI
    updateSettingsPageValues();
    
    showNotification('All settings have been reset to default values.', 'success');
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

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10001;
        max-width: 400px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        animation: slideInRight 0.3s ease-out;
    `;
    
    // Set background color based on type
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        info: '#17a2b8',
        warning: '#ffc107'
    };
    notification.style.backgroundColor = colors[type] || colors.info;
    
    notification.textContent = message;
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        font-weight: bold;
        margin-left: 10px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
    `;
    closeBtn.onclick = () => notification.remove();
    notification.appendChild(closeBtn);
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
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
        updated: 'fa-arrows-rotate'      // fa-rotate is a utility class, use arrows-rotate icon
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




