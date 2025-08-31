// Global variables
console.log('🎮 WaterWall app.js is loading...');

let games = [];
let currentGame = null;
let isProxyEnabled = true; // Enable proxy by default since most games need it
const proxyUrl = 'https://waterwallrelayservice.zonikyo.workers.dev/';
let favorites = [];
let settings = { defaultProxy: true };
let currentGameTabTimeout = null;

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

let isFullscreen = false;

// Enhanced initialization with better error handling
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded, starting initialization...');
    loadSettingsFromCookies();
    loadFavoritesFromCookies();
    if (typeof settings.defaultProxy === 'boolean') {
        isProxyEnabled = settings.defaultProxy;
    }
    startApp();
});

// Fallback for older browsers or edge cases
window.addEventListener('load', function() {
    console.log('🚀 Window loaded, ensuring initialization...');
    // Only start if not already started (check if games are loaded)
    if (games.length === 0) {
        console.log('🔄 Games not loaded yet, retrying...');
        startApp();
    }
});

// Additional safeguard - ensure games load after 2 seconds
setTimeout(function() {
    console.log('⏰ 2-second safeguard check...');
    if (games.length === 0) {
        console.log('🚨 Games still not loaded, forcing emergency fallback');
        loadFallbackGames();
        forceRenderGames();
        updateNavigationStats();
    } else {
        console.log('✅ Games already loaded, safeguard not needed');
    }
}, 2000);

// Enhanced initialization with better error handling
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded, starting initialization...');
    
    // Initialize immediately
    startApp();
});

// Fallback for older browsers
window.addEventListener('load', function() {
    console.log('� Window loaded, ensuring initialization...');
    
    // Only start if not already started
    if (games.length === 0) {
        startApp();
    }
});

async function startApp() {
    console.log('🎯 Starting main app initialization...');
    
    try {
        // Initialize DOM elements first
        initializeDOMElements();
        
        // Load games (with immediate fallback)
        await loadGamesWithFallback();
        
        // Setup event listeners
        setupEventListeners();
        
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

async function loadGamesWithFallback() {
    try {
        await loadGames();
        
        // If no games loaded, use fallback immediately
        if (games.length === 0) {
            console.log('⚠️ No games loaded from JSON, using fallback');
            loadFallbackGames();
        }
    } catch (error) {
        console.error('❌ Failed to load games:', error);
        loadFallbackGames();
    }
}

function loadFallbackGames() {
    console.log('🔄 Loading fallback games...');
    games = [
        {
            id: 1,
            title: "2048",
            description: "A sliding puzzle game where you combine tiles with the same number to reach 2048.",
            category: "puzzle",
            embed: "https://play2048.co/",
            thumbnail: "https://via.placeholder.com/300x200/6366f1/ffffff"
        },
        {
            id: 2,
            title: "Snake Game",
            description: "Classic snake game where you eat food and grow longer.",
            category: "arcade",
            embed: "https://playsnake.org/",
            thumbnail: "https://via.placeholder.com/300x200/22c55e/ffffff"
        },
        {
            id: 3,
            title: "Tetris",
            description: "Classic block puzzle game.",
            category: "puzzle",
            embed: "https://tetris.com/play-tetris",
            thumbnail: "https://via.placeholder.com/300x200/3b82f6/ffffff"
        },
        {
            id: 4,
            title: "Pac-Man",
            description: "Navigate mazes, eat dots, and avoid ghosts.",
            category: "arcade",
            embed: "https://pacman.com/en/",
            thumbnail: "https://via.placeholder.com/300x200/f59e0b/ffffff"
        },
        {
            id: 5,
            title: "Chess",
            description: "Strategic board game for two players.",
            category: "strategy",
            embed: "https://chess.com/play",
            thumbnail: "https://via.placeholder.com/300x200/8b5cf6/ffffff"
        },
        {
            id: 6,
            title: "Solitaire",
            description: "Classic card game.",
            category: "puzzle",
            embed: "https://solitaired.com/freecell",
            thumbnail: "https://via.placeholder.com/300x200/10b981/ffffff"
        }
    ];
    console.log(`✅ Loaded ${games.length} fallback games`);
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
    
    // Render all games
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
    
    const filteredGames = games.filter(game => 
        game.title.toLowerCase().includes(query) ||
        game.category.toLowerCase().includes(query) ||
        (game.description && game.description.toLowerCase().includes(query))
    );
    
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
    
    // Exit fullscreen
    if (e.target.closest('.exit-fullscreen-btn')) {
        exitFullscreen();
    }
}

// Proxy toggle handler
function handleProxyToggle(e) {
    if (e.target.type === 'checkbox' && (e.target.closest('.proxy-toggle') || e.target.id === 'proxyToggleGame')) {
        isProxyEnabled = e.target.checked;
        
        // Sync all proxy toggles
        const allProxyToggles = document.querySelectorAll('#proxyToggle, #proxyToggleGame');
        allProxyToggles.forEach(toggle => {
            if (toggle !== e.target) {
                toggle.checked = isProxyEnabled;
            }
        });
        
        // Reload current game if one is playing
        if (currentGame) {
            loadGame(currentGame);
        }
        
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
function showHomePage() {
    console.log('Showing home page');
    hideAllPages();
    
    // Clear current game state
    currentGame = null;
    
    // Clear iframe when going back to homepage
    const gameFrame = document.getElementById('gameFrame');
    if (gameFrame) {
        gameFrame.src = 'about:blank';
    }
    
    const homepage = document.getElementById('homePage');
    if (homepage) {
        homepage.classList.add('active');
    } else {
        console.error('Home page element not found');
        return;
    }
    
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    const homeNavItem = document.querySelector('[data-page="home"]');
    if (homeNavItem) {
        homeNavItem.classList.add('active');
    }
    
    console.log('Home page displayed successfully');
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

function showFavoritesPage() {
    hideAllPages();
    
    const contentArea = document.querySelector('.content-area');
    contentArea.innerHTML = `
        <div class="page active">
            <section class="games-section">
                <div class="section-header">
                    <h2 class="section-title">Favorite Games</h2>
                </div>
                <div class="favorites-content">
                    <div class="empty-state">
                        <div class="empty-icon">❤️</div>
                        <h3>No favorites yet</h3>
                        <p>Games you mark as favorites will appear here</p>
                    </div>
                </div>
            </section>
        </div>
    `;
}

function showSettingsPage() {
    hideAllPages();
    
    const contentArea = document.querySelector('.content-area');
    contentArea.innerHTML = `
        <div class="page active">
            <section class="games-section">
                <div class="section-header">
                    <h2 class="section-title">Settings</h2>
                </div>
                <div class="settings-content">
                    <div class="setting-group">
                        <h3>Game Settings</h3>
                        <div class="setting-item">
                            <label>
                                <input type="checkbox" id="proxyToggle" ${isProxyEnabled ? 'checked' : ''}>
                                Enable Proxy for Games
                            </label>
                        </div>
                    </div>
                    <div class="setting-group">
                        <h3>Display Settings</h3>
                        <div class="setting-item">
                            <label>
                                <input type="checkbox" checked>
                                Dark Theme
                            </label>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    `;
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
    
    if (gameTitle) gameTitle.textContent = game.title;
    if (gameCategory) gameCategory.textContent = game.category;
    
    // Sync proxy toggle state
    if (proxyToggleGame) {
        proxyToggleGame.checked = isProxyEnabled;
    }
    
    // Set game description (generate a description if not available)
    if (gameDescription) {
        const description = game.description || generateGameDescription(game);
        gameDescription.textContent = description;
    }
    
    // Load suggested games
    loadSuggestedGames(game);
    // Fallback: if no suggested games rendered after short delay, try again once
    setTimeout(() => {
        const sg = document.getElementById('suggestedGames');
        if (sg && sg.children.length === 0) {
            console.warn('Retrying suggested games render');
            loadSuggestedGames(game);
        }
    }, 500);
    
    // Load the game after a brief delay to ensure iframe is ready
    setTimeout(() => {
        loadGame(game);
    }, 100);
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

function loadSuggestedGames(currentGame) {
    console.log('Loading suggested games for:', currentGame.title);
    console.log('Total available games:', games.length);
    const suggestedContainer = document.getElementById('suggestedGames');
    if (games.length === 0) {
        console.warn('Games not loaded yet when requesting suggestions; retrying in 250ms');
        setTimeout(() => loadSuggestedGames(currentGame), 250);
        return;
    }
    
    // Get random games excluding the current one
    const otherGames = games.filter(game => game.id !== currentGame.id);
    console.log('Other games after filtering:', otherGames.length);
    
    const shuffled = otherGames.sort(() => 0.5 - Math.random());
    const suggestedGames = shuffled.slice(0, 4); // Show only 4 suggested games to fit without scrolling
    console.log('Suggested games to display:', suggestedGames.length);
    
    if (!suggestedContainer) {
        console.error('❌ Suggested games container not found');
        return;
    }
    
    console.log('✅ Found suggested games container, rendering games...');
    
    if (suggestedGames.length === 0) {
        suggestedContainer.innerHTML = '<div class="no-games-message">No other games available</div>';
        return;
    }
    
    suggestedContainer.innerHTML = suggestedGames.map((game, index) => {
        const card = createSuggestedGameCard(game);
        return card.replace('<div class="suggested-game-card"', `<div class="suggested-game-card" style="animation-delay: ${index * 0.1}s"`);
    }).join('');
    suggestedContainer.style.opacity = '1';
    suggestedContainer.style.visibility = 'visible';
    
    console.log('✅ Suggested games rendered successfully');
}

function createSuggestedGameCard(game) {
    return `
        <div class="suggested-game-card" data-game-id="${game.id}">
            <img src="${game.thumbnail}" alt="${game.title}" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyMCIgdmlld0JveD0iMCAwIDIwMCAxMjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiBmaWxsPSIjMTYxYjIyIi8+CjxwYXRoIGQ9Ik05NS41IDQySDEwNC41VjUySDk1LjVWNDJaIiBmaWxsPSIjNDQ0ODU0Ii8+CjxwYXRoIGQ9Ik05MC41IDQ3SDk1LjVWNTJIOTAuNVY0N1oiIGZpbGw9IiM0NDQ4NTQiLz4KPHBhdGggZD0iTTEwNC41IDQ3SDEwOS41VjUySDEwNC41VjQ3WiIgZmlsbD0iIzQ0NDg1NCIvPgo8cGF0aCBkPSJNOTUuNSA1Mkg5NS41VjY3SDEwNC41VjUyIiBmaWxsPSIjNDQ0ODU0Ii8+CjxwYXRoIGQ9Ik04NS41IDUySDkwLjVWNTdIODUuNVY1MloiIGZpbGw9IiM0NDQ4NTQiLz4KPHA+PCEtLSBHYW1lIGljb24gLS0+PC9wPgo8dGV4dCB4PSIxMDAiIHk9IjY4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNzE3ODg2IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiI+R2FtZTwvdGV4dD4KPC9zdmc+'" />
            <div class="suggested-game-info">
                <div class="suggested-game-title">${game.title}</div>
                <div class="suggested-game-category">${game.category}</div>
            </div>
        </div>
    `;
}

function showCategoriesPage() {
    hideAllPages();
    showError('Categories page coming soon!');
}

function showFavoritesPage() {
    hideAllPages();
    showError('Favorites page coming soon!');
}

function showSettingsPage() {
    hideAllPages();
    showError('Settings page coming soon!');
}

function filterByCategory(category) {
    console.log('Filtering by category:', category);
    hideAllPages();
    homepage.classList.add('active');
    
    let filteredGames = [];
    
    switch (category) {
        case 'new':
            // Show newest games (assume they have higher IDs)
            filteredGames = games.slice(-6).reverse();
            break;
        case 'popular':
            // Show random selection as "popular"
            filteredGames = games.slice(0, 8);
            break;
        case 'updated':
            // Show a different selection as "updated"
            filteredGames = games.slice(2, 8);
            break;
        default:
            // Filter by actual category
            filteredGames = games.filter(game => game.category.toLowerCase() === category.toLowerCase());
            break;
    }
    
    // Clear and update content
    const contentArea = document.querySelector('.content-area');
    contentArea.innerHTML = `
        <div class="category-results-section">
            <div class="section-header">
                <h2 class="section-title">${category.charAt(0).toUpperCase() + category.slice(1)} Games (${filteredGames.length} games)</h2>
            </div>
            <div class="games-grid" id="categoryResults"></div>
        </div>
    `;
    
    // Render filtered games
    const categoryResultsContainer = document.getElementById('categoryResults');
    if (filteredGames.length === 0) {
        categoryResultsContainer.innerHTML = '<p style="color: #7d8590; text-align: center; grid-column: 1 / -1;">No games found in this category.</p>';
    } else {
        categoryResultsContainer.innerHTML = filteredGames.map(game => createGameCard(game)).join('');
    }
}

function showSearchResults(query, results) {
    hideAllPages();
    document.getElementById('homePage').classList.add('active');
    
    // Clear existing content
    const contentArea = document.querySelector('.content-area');
    contentArea.innerHTML = `
        <div class="search-results-section">
            <div class="section-header">
                <h2 class="section-title">Search Results for "${query}" (${results.length} games)</h2>
            </div>
            <div class="games-grid" id="searchResults"></div>
        </div>
    `;
    
    // Render search results
    const searchResultsContainer = document.getElementById('searchResults');
    if (results.length === 0) {
        searchResultsContainer.innerHTML = '<p style="color: #7d8590; text-align: center; grid-column: 1 / -1;">No games found matching your search.</p>';
    } else {
        searchResultsContainer.innerHTML = results.map(game => createGameCard(game)).join('');
    }
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
            <img src="${thumbnailUrl}" alt="${game.title}" loading="lazy">
            <div class="game-card-overlay">
                <div class="overlay-title">${game.title}</div>
                <div class="overlay-category">${game.category}</div>
            </div>
        </div>
    `;
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
        if (!isValidUrl(gameUrl)) {
            showError('Invalid game URL');
            return;
        }
        
        console.log('Loading game URL:', gameUrl);
        
        // Clear any previous error handlers
        gameFrame.onload = null;
        gameFrame.onerror = null;
        
        // Set new URL
        gameFrame.src = gameUrl;
        
        // Handle iframe load events
        gameFrame.onload = () => {
            console.log('Game loaded successfully:', game.title);
            // Hide any error messages
            const errorMsg = gameFrame.parentElement.querySelector('.game-error');
            if (errorMsg) errorMsg.remove();
        };

        gameFrame.onerror = () => {
            console.error('Failed to load game:', game.title);
            showGameError('Failed to load game. Try enabling/disabling proxy or try another game.');
        };

        // Add timeout for games that don't trigger load events
        setTimeout(() => {
            try {
                // Try to access iframe content to see if it loaded
                if (gameFrame.contentDocument || gameFrame.contentWindow) {
                    console.log('Game appears to be loading...');
                } else {
                    console.warn('Game may be blocked by X-Frame-Options');
                    if (!isProxyEnabled) {
                        showGameError('Game blocked. Try enabling proxy to bypass restrictions.');
                    }
                }
            } catch (e) {
                // This is expected for cross-origin content
                console.log('Cross-origin content detected (normal for external games)');
            }
        }, 3000);    } catch (error) {
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

function buildCategoryTabs(){ const c=document.getElementById('categoryTabs'); if(!c||games.length===0)return; const cats=[...new Set(games.map(g=>g.category))].sort(); const all=['all',...cats]; c.innerHTML=all.map(x=>`<button class="category-tab" data-cat="${x}">${x==='all'?'All':x.charAt(0).toUpperCase()+x.slice(1)}</button>`).join(''); c.onclick=e=>{const b=e.target.closest('.category-tab'); if(!b)return; c.querySelectorAll('.category-tab').forEach(btn=>btn.classList.remove('active')); b.classList.add('active'); filterHomeByCategory(b.dataset.cat);}; const first=c.querySelector('[data-cat="all"]'); if(first) first.classList.add('active'); }
function filterHomeByCategory(cat){ const grid=document.getElementById('allGames'); if(!grid)return; if(cat==='all'){ grid.innerHTML=games.map(g=>createGameCard(g)).join(''); return;} const filtered=games.filter(g=>g.category.toLowerCase()===cat.toLowerCase()); grid.innerHTML=filtered.map(g=>createGameCard(g)).join(''); }

function addOrReplaceCurrentGameTab(game){ if(!game)return; clearTimeout(currentGameTabTimeout); let tab=document.querySelector('.current-game-tab'); if(tab) tab.remove(); const list=document.querySelector('.sidebar nav .nav-list'); if(!list)return; const li=document.createElement('li'); li.className='current-game-tab'; li.dataset.gameId=game.id; li.innerHTML=`<i class="fas fa-gamepad"></i><span>${game.title}</span>`; li.onclick=()=>{ if(currentGame && currentGame.id===game.id){ showGamePage(game);} else { const g=games.find(x=>x.id==li.dataset.gameId); if(g) showGamePage(g);} }; list.insertBefore(li, list.firstChild.nextSibling); }
function scheduleCurrentGameTabRemoval(){ const tab=document.querySelector('.current-game-tab'); if(!tab)return; clearTimeout(currentGameTabTimeout); currentGameTabTimeout=setTimeout(()=>{ tab.classList.add('removing'); setTimeout(()=>{ if(tab.parentElement) tab.remove(); }, 350); }, 10000); }



