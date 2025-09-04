// Global variables
console.log('🎮 WaterWall app.js is loading...');

let games = [];
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
let isFullscreen = false;

// Auth0 variables
let auth0Client = null;
const auth0Config = {
    domain: 'dev-lciqwnyb52wdezeo.us.auth0.com',
    clientId: 'sbABJXSUTPmROG9WTrdB0LrUBtTwnWxO',
    authorizationParams: {
        redirect_uri: window.location.origin,
        // audience: 'YOUR_API_AUDIENCE', // (optional) if calling a protected API
        // scope: 'openid profile email' // default scopes
    },
    cacheLocation: 'memory', // can switch to 'localstorage' if you need SSO across tabs (trade-off: XSS risk)
    useRefreshTokens: false
};

// Single unified initialization (removed duplicates & destructive fallbacks)
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 DOM loaded, init start');
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
    console.log('🎯 Starting main app initialization...');
    
    try {
        // Initialize DOM elements first
        initializeDOMElements();
    accountLabelEl = document.getElementById('accountLabel');
        
        // Load games (with immediate fallback)
        await loadGamesWithFallback();
        
        // Setup event listeners
        setupEventListeners();
    await initAuth0();
        
        // Force render games immediately
        forceRenderGames();
        
        // Update stats
        updateNavigationStats();
    buildCategoryTabs();
    renderFavoritesSection();
    updateFavoriteButtonState();
        
        console.log('✅ App initialization complete! Games loaded:', games.length);
    } catch (error) {
        console.error('❌ App initialization failed:', error);
        
        // Emergency fallback
        emergencyFallback();
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

function emergencyFallback() {
    console.log('🚨 Emergency fallback activated');
    
    const allGamesGrid = document.getElementById('allGames');
    
    const emergencyHTML = `
        <div class="game-card" data-game-id="1">
            <img src="https://via.placeholder.com/300x200/6366f1/ffffff" alt="2048" loading="lazy">
            <div class="game-card-overlay">
                <div class="overlay-title">2048</div>
                <div class="overlay-category">puzzle</div>
            </div>
        </div>
        <div class="game-card" data-game-id="2">
            <img src="https://via.placeholder.com/300x200/22c55e/ffffff" alt="Snake" loading="lazy">
            <div class="game-card-overlay">
                <div class="overlay-title">Snake</div>
                <div class="overlay-category">arcade</div>
            </div>
        </div>
        <div class="game-card" data-game-id="3">
            <img src="https://via.placeholder.com/300x200/3b82f6/ffffff" alt="Tetris" loading="lazy">
            <div class="game-card-overlay">
                <div class="overlay-title">Tetris</div>
                <div class="overlay-category">puzzle</div>
            </div>
        </div>
    `;
    
    if (allGamesGrid) allGamesGrid.innerHTML = emergencyHTML;
    
    // Set fallback games data
    games = [
        {id: 1, title: "2048", category: "puzzle", embed: "https://play2048.co/"},
        {id: 2, title: "Snake", category: "arcade", embed: "https://playsnake.org/"},
        {id: 3, title: "Tetris", category: "puzzle", embed: "https://tetris.com/play-tetris"}
    ];
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
    if(!window.createAuth0Client){
        console.warn('Auth0 SDK not loaded yet');
        return;
    }
    try {
        auth0Client = await createAuth0Client(auth0Config);
        // Handle redirect back from Auth0 (code/state present)
        if(window.location.search.includes('code=') && window.location.search.includes('state=')){
            try {
                await auth0Client.handleRedirectCallback();
                // Remove code/state params from URL for cleanliness
                window.history.replaceState({}, document.title, window.location.pathname);
            } catch (e){
                console.error('Auth0 redirect error', e);
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

function bindAuthButtons(){
    const loginBtn=document.getElementById('loginBtn');
    const logoutBtn=document.getElementById('logoutBtn');
    if(loginBtn){
        loginBtn.addEventListener('click', ()=> auth0Client.loginWithRedirect());
    }
    if(logoutBtn){
        logoutBtn.addEventListener('click', ()=> auth0Client.logout({ logoutParams: { returnTo: window.location.origin }}));
    }
}

async function updateAuthUI(){
    const loading=document.getElementById('authLoading');
    const loggedOut=document.getElementById('authLoggedOut');
    const loggedIn=document.getElementById('authLoggedIn');
    if(!auth0Client){
        if(loading) loading.textContent='Auth library not ready';
        return;
    }
    try {
        const isAuth = await auth0Client.isAuthenticated();
        if(loading) loading.style.display='none';
        if(isAuth){
            if(loggedOut) loggedOut.style.display='none';
            if(loggedIn) loggedIn.style.display='block';
            const user = await auth0Client.getUser();
            if(accountLabelEl) accountLabelEl.textContent = user && (user.given_name || user.nickname || user.name) ? (user.given_name || user.nickname || user.name) : 'Account';
            const pic=document.getElementById('userPicture');
            const nm=document.getElementById('userName');
            const em=document.getElementById('userEmail');
            if(user){
                if(pic){
                    if(user.picture){ pic.src=user.picture; pic.style.display='block'; } else { pic.style.display='none'; }
                }
                if(nm){ nm.textContent = user.name || user.nickname || 'User'; }
                if(em){ em.textContent = user.email || ''; }
                const idTokenClaims = await auth0Client.getIdTokenClaims();
                const pre=document.getElementById('idTokenPreview');
                if(pre){ pre.textContent = idTokenClaims ? JSON.stringify(idTokenClaims, null, 2) : '(no token claims)'; }
            }
        } else {
            if(loggedIn) loggedIn.style.display='none';
            if(loggedOut) loggedOut.style.display='block';
            if(accountLabelEl) accountLabelEl.textContent='Sign in / Sign up';
        }
    } catch (e){
        console.error('updateAuthUI error', e);
        if(loading) loading.textContent='Auth error';
    }
}

// Load games from JSON
async function loadGames() {
    try {
        console.log('🔄 Loading games from games.json...');
        
        // Try to fetch games.json
        const response = await fetch('./games.json');
        console.log('📡 Fetch response status:', response.status, response.statusText);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('📊 Raw JSON data:', data);
        
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error('Invalid or empty games data');
        }
        
        games = data;
        console.log(`✅ Successfully loaded ${games.length} games from JSON`);
        
        return games;
        
    } catch (error) {
        console.error('❌ Error loading games.json:', error);
        console.log('🔄 Using fallback games...');
        
        // Use fallback games for testing
        games = [
            {
                id: 1,
                title: "2048",
                description: "A sliding puzzle game where you combine tiles with the same number to reach 2048.",
                category: "puzzle",
                embed: "https://play2048.co/",
                thumbnail: "https://via.placeholder.com/300x200/6366f1/ffffff?text=2048"
            },
            {
                id: 2,
                title: "Snake Game",
                description: "Classic snake game where you eat food and grow longer.",
                category: "arcade",
                embed: "https://playsnake.org/",
                thumbnail: "https://via.placeholder.com/300x200/22c55e/ffffff?text=Snake"
            },
            {
                id: 3,
                title: "Tetris",
                description: "Classic block puzzle game.",
                category: "puzzle",
                embed: "https://tetris.com/play-tetris",
                thumbnail: "https://via.placeholder.com/300x200/3b82f6/ffffff?text=Tetris"
            },
            {
                id: 4,
                title: "Pac-Man",
                description: "Navigate mazes, eat dots, and avoid ghosts.",
                category: "arcade",
                embed: "https://pacman.com/en/",
                thumbnail: "https://via.placeholder.com/300x200/f59e0b/ffffff?text=Pac-Man"
            },
            {
                id: 5,
                title: "Chess",
                description: "Strategic board game for two players.",
                category: "strategy",
                embed: "https://chess.com/play",
                thumbnail: "https://via.placeholder.com/300x200/8b5cf6/ffffff?text=Chess"
            },
            {
                id: 6,
                title: "Solitaire",
                description: "Classic card game.",
                category: "puzzle",
                embed: "https://solitaired.com/freecell",
                thumbnail: "https://via.placeholder.com/300x200/10b981/ffffff?text=Solitaire"
            }
        ];
        console.log(`🔄 Using ${games.length} fallback games`);
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
        
        // Update active nav state
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        navItem.classList.add('active');
        
        // Show appropriate page or filter by category
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
                case 'account':
                    showAccountPage();
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
function showAccountPage(){
    hideAllPages();
    const pg=document.getElementById('accountPage'); if(pg) pg.classList.add('active');
    updateAuthUI();
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
    console.log('=== WaterWall Debug Info ===');
    console.log('Games array:', games);
    console.log('Games count:', games.length);
    console.log('Featured games element:', document.getElementById('featuredGames'));
    console.log('All games element:', document.getElementById('allGames'));
    console.log('Homepage element:', document.getElementById('homePage'));
    
    if (games.length > 0) {
        console.log('First game:', games[0]);
        console.log('Sample game card HTML:', createGameCard(games[0]));
    }
    
    // Try to render games manually
    renderFeaturedGames();
    renderGamesByCategory();
};

// Offline / online indicator
window.addEventListener('offline', ()=> showError('You are offline. Cached games only.'));
window.addEventListener('online', ()=> showError('Back online.'));

// ===== New Helpers (Favorites, Settings, Category Tabs, Current Game Tab) =====
function toggleFavorite(game) {
    if (!game) return;
    const idx = favorites.indexOf(game.id);
    if (idx === -1) favorites.push(game.id); else favorites.splice(idx,1);
    saveFavoritesToCookies();
}
function updateFavoriteButtonState() {
    const favBtn = document.querySelector('.fav-btn');
    if (!favBtn) return;
    if (!currentGame) { favBtn.classList.remove('active'); return; }
    favBtn.classList.toggle('active', favorites.includes(currentGame.id));
}
function renderFavoritesSection() {
    const section = document.getElementById('favoriteGamesSection');
    const grid = document.getElementById('favoriteGamesGrid');
    if (!section || !grid) return;
    const favGames = games.filter(g=>favorites.includes(g.id));
    if (favGames.length === 0) { section.style.display='none'; grid.innerHTML=''; return; }
    section.style.display='block';
    grid.innerHTML = favGames.map(g=>createGameCard(g)).join('');
}
function saveFavoritesToCookies(){ document.cookie='ww_favs='+encodeURIComponent(JSON.stringify(favorites))+';path=/;max-age=31536000'; }
function loadFavoritesFromCookies(){ const m=document.cookie.match(/ww_favs=([^;]+)/); if(m){ try{ favorites=JSON.parse(decodeURIComponent(m[1])); }catch(e){ favorites=[]; } } }
function saveSettingsToCookies(){ document.cookie='ww_settings='+encodeURIComponent(JSON.stringify(settings))+';path=/;max-age=31536000'; }
function loadSettingsFromCookies(){ const m=document.cookie.match(/ww_settings=([^;]+)/); if(m){ try{ settings=JSON.parse(decodeURIComponent(m[1])); isProxyEnabled=settings.defaultProxy; }catch(e){} } }

function buildCategoryTabs(){ const iconMap={puzzle:'fa-puzzle-piece',action:'fa-bolt',adventure:'fa-map',sports:'fa-football-ball',strategy:'fa-chess',arcade:'fa-ghost'}; const c=document.getElementById('categoryTabs'); if(!c||games.length===0)return; const cats=[...new Set(games.map(g=>g.category.toLowerCase()))].sort(); const all=['all',...cats]; c.innerHTML=all.map(x=>{ if(x==='all') return `<button class="category-tab" data-cat="all"><i class="fas fa-th-large"></i> All</button>`; const icon=iconMap[x]||'fa-tag'; return `<button class="category-tab" data-cat="${x}"><i class="fas ${icon}"></i> ${capitalize(x)}</button>`; }).join(''); c.onclick=e=>{const b=e.target.closest('.category-tab'); if(!b)return; c.querySelectorAll('.category-tab').forEach(btn=>btn.classList.remove('active')); b.classList.add('active'); filterHomeByCategory(b.dataset.cat);}; const first=c.querySelector('[data-cat="all"]'); if(first) first.classList.add('active'); }
function filterHomeByCategory(cat){
    const grid=document.getElementById('allGames');
    const titleEl=document.getElementById('allGamesTitle');
    if(!grid) return;
    if(cat==='all'){
        grid.innerHTML=games.map(g=>createGameCard(g)).join('');
        if(titleEl) titleEl.textContent='All Games';
        return;
    }
    const filtered=games.filter(g=>g.category.toLowerCase()===cat.toLowerCase());
    grid.innerHTML=filtered.map(g=>createGameCard(g)).join('');
    if(titleEl) titleEl.textContent=capitalize(cat)+' Games';
}

function addOrReplaceCurrentGameTab(game){ if(!game)return; clearTimeout(currentGameTabTimeout); let tab=document.querySelector('.current-game-tab'); if(tab) tab.remove(); const list=document.querySelector('.sidebar nav .nav-list'); if(!list)return; const li=document.createElement('li'); li.className='current-game-tab'; li.dataset.gameId=game.id; li.innerHTML=`<i class="fas fa-gamepad"></i><span>${game.title}</span>`; li.onclick=()=>{ if(currentGame && currentGame.id===game.id){ showGamePage(game);} else { const g=games.find(x=>x.id==li.dataset.gameId); if(g) showGamePage(g);} }; list.insertBefore(li, list.firstChild.nextSibling); }
function scheduleCurrentGameTabRemoval(){ const tab=document.querySelector('.current-game-tab'); if(!tab)return; clearTimeout(currentGameTabTimeout); currentGameTabTimeout=setTimeout(()=>{ tab.classList.add('removing'); setTimeout(()=>{ if(tab.parentElement) tab.remove(); }, 350); }, 10000); }

// Proxy visual sync
function updateProxyVisuals(){
    document.querySelectorAll('.proxy-toggle-visual').forEach(el=>{
        el.classList.remove('on','off');
        el.classList.add(isProxyEnabled ? 'on':'off');
        el.setAttribute('aria-pressed', isProxyEnabled ? 'true':'false');
        el.title = isProxyEnabled ? 'Proxy Enabled' : 'Proxy Disabled';
    });
}

function toggleGameProxy(){
    if(!currentGame) return; 
    isProxyEnabled = !isProxyEnabled;
    gameProxyOverrides[currentGame.id] = isProxyEnabled; // store override for this game
    updateProxyVisuals();
    // Reload game with new proxy state
    loadGame(currentGame);
}

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
                <div class="section-header"><h2 class="section-title"><i class="fas fa-heart" style="color:#e25555;"></i> Your Favorites</h2></div>
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
                        <div class="setting-item"><label style="cursor:pointer;"><input type="checkbox" id="proxyToggleSetting" ${isProxyEnabled?'checked':''} onchange="(function(el){isProxyEnabled=el.checked;settings.defaultProxy=isProxyEnabled;saveSettingsToCookies();updateProxyVisuals(); if(currentGame) loadGame(currentGame);})(this)"> Enable Proxy for Games (Beta Feature)</label></div>
                        <div class="setting-item"><button id="checkUpdatesBtn" class="update-check-btn" onclick="checkForUpdates()">Check for Updates</button> <small style="display:block; margin-top:6px; color:#7d8590;">Force refresh assets & service worker.</small></div>
                    </div>
                    <div class="setting-group">
                        <h3>Display Settings</h3>
                        <div class="setting-item"><label><input type="checkbox" checked disabled> Dark Theme (default)</label></div>
                    </div>
                </div>
            </section>
        </div>`);
}

// ===== Update / Cache Refresh =====
function checkForUpdates(){
    const btn=document.getElementById('checkUpdatesBtn');
    if(btn){ btn.disabled=true; btn.textContent='Updating...'; }
    // Attempt to unregister service workers, clear caches, then reload
    const doReload=()=> setTimeout(()=> { showUpdateModal(btn); }, 400);
    try {
        if('serviceWorker' in navigator){
            navigator.serviceWorker.getRegistrations().then(regs=>{
                Promise.all(regs.map(r=>r.unregister())).finally(()=>{
                    if(window.caches){
                        caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).finally(doReload);
                    } else doReload();
                });
            });
        } else if(window.caches){
            caches.keys().then(keys=>Promise.all(keys.map(k=>caches.delete(k)))).finally(doReload);
        } else doReload();
    } catch(e){
        console.warn('Update check encountered error', e); doReload();
    }
}

function showUpdateModal(triggerBtn){
    const modal=document.getElementById('updateModal'); if(!modal) { location.reload(); return; }
    modal.style.display='flex'; modal.removeAttribute('aria-hidden');
    const later=document.getElementById('updateLaterBtn');
    const reload=document.getElementById('updateReloadBtn');
    const close=()=>{ modal.style.display='none'; modal.setAttribute('aria-hidden','true'); if(triggerBtn){ triggerBtn.disabled=false; triggerBtn.textContent='Check for Updates'; } };
    later.onclick=()=> close();
    reload.onclick=()=>{ reload.disabled=true; reload.textContent='Reloading...'; location.reload(); };
    // Close on escape
    function esc(e){ if(e.key==='Escape'){ close(); window.removeEventListener('keydown', esc); } }
    window.addEventListener('keydown', esc);
    // Focus management
    setTimeout(()=> reload.focus(), 30);
}
function renderFavoritesPage(){
    const grid=document.getElementById('favoritesPageGrid');
    const empty=document.getElementById('favoritesEmptyState');
    if(!grid||!empty) return;
    const favGames=games.filter(g=>favorites.includes(g.id));
    if(favGames.length===0){
        grid.innerHTML='';
        grid.style.display='none';
        empty.style.display='flex';
    } else {
        empty.style.display='none';
        grid.style.display='grid';
        grid.innerHTML=favGames.map(g=>createGameCard(g)).join('');
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
    const delay = overlay.dataset.min==='done'? 400 : 5200; // if min not reached, wait remainder ~5s
    setTimeout(()=>{ overlay.style.display='none'; }, delay);
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




