// Global variables
console.log('🎮 WaterWall app.js is loading...');

let games = [];
let __appInitStarted = false;
let __authRedirectHandled = false;
let currentGame = null;
let isProxyEnabled = false; // Disabled by default per new requirement
const proxyUrl = 'https://waterwallrelayservice.zonikyo.workers.dev/proxy';
let favorites = [];
let settings = { defaultProxy: false };
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
                    <div class="setting-group">
                        <h3>Game Settings</h3>
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
                    <div class="setting-group">
                        <h3>Display Settings</h3>
                        <div class="setting-item">
                            <label class="switch-row">
                                <div class="switch-text">
                                    <span class="setting-title">Dark Theme</span>
                                    <span class="setting-sub">Default</span>
                                </div>
                                <input type="checkbox" class="ww-switch-input" checked disabled>
                                <span class="ww-switch" aria-hidden="true"></span>
                            </label>
                        </div>
                    </div>
                    <div class="setting-group">
                        <h3>Updates</h3>
                        <div class="setting-item">
                            <button id="checkUpdatesBtn" class="update-check-btn" onclick="checkForUpdates()">Check for Updates</button>
                            <small class="muted-hint">Force refresh assets & service worker.</small>
                        </div>
                    </div>
                    <div class="setting-group settings-links">
                        <h3>About & Legal</h3>
                        <div class="link-row">
                            <a href="#" class="themed-link" target="_blank" rel="noopener noreferrer"><i class="fab fa-github"></i><span>GitHub</span></a>
                            <a href="#" class="themed-link"><i class="fas fa-file-contract"></i><span>Terms of Service</span></a>
                            <a href="#" class="themed-link"><i class="fas fa-user-shield"></i><span>Privacy Policy</span></a>
                        </div>
                    </div>
                </div>
            </section>
        </div>`);
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

function buildCategoryTabs(){
    const el = document.getElementById('categoryTabs'); if(!el || !Array.isArray(games)) return;
    const cats = [...new Set(games.map(g=> g.category).filter(Boolean))].sort((a,b)=> a.localeCompare(b));
    if(cats.length === 0){ el.innerHTML=''; return; }
    const allList = ['all', ...cats];
    el.innerHTML = allList.map(c=>`<button class="cat-tab" data-cat="${sanitize(c)}" aria-pressed="false">${sanitize(capitalize(c))}</button>`).join('');
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




