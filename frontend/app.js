// Global variables
console.log('🎮 WaterWall app.js is loading...');

let games = [];
let currentGame = null;
let isProxyEnabled = true;
const proxyUrl = 'https://waterwallrelayservice.zonikyo.workers.dev/';

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
let exitFullscreen;

let isFullscreen = false;

// Enhanced initialization with better error handling
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM loaded, starting initialization...');
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
    console.log(`✅ Loaded ${games.length} fallback games`);
}

function forceRenderGames() {
    console.log('🎨 Force rendering games...');
    console.log('📊 Games to render:', games.length);
    
    const featuredGrid = document.getElementById('featuredGames');
    const allGamesGrid = document.getElementById('allGames');
    
    if (!featuredGrid || !allGamesGrid) {
        console.error('❌ Required DOM elements not found!');
        return;
    }
    
    if (games.length === 0) {
        featuredGrid.innerHTML = '<div class="loading-message">⚠️ No games available</div>';
        allGamesGrid.innerHTML = '<div class="loading-message">⚠️ No games available</div>';
        return;
    }
    
    // Render featured games (first 6)
    const featuredGames = games.slice(0, 6);
    featuredGrid.innerHTML = featuredGames.map(game => createGameCard(game)).join('');
    console.log('✅ Featured games rendered:', featuredGames.length);
    
    // Render all games
    allGamesGrid.innerHTML = games.map(game => createGameCard(game)).join('');
    console.log('✅ All games rendered:', games.length);
}

function emergencyFallback() {
    console.log('🚨 Emergency fallback activated');
    
    const featuredGrid = document.getElementById('featuredGames');
    const allGamesGrid = document.getElementById('allGames');
    
    const emergencyHTML = `
        <div class="game-card" data-game-id="1">
            <img src="https://via.placeholder.com/300x200/6366f1/ffffff?text=2048" alt="2048" loading="lazy">
            <div class="game-card-content">
                <div class="game-card-title">2048</div>
                <div class="game-card-category">puzzle</div>
            </div>
        </div>
        <div class="game-card" data-game-id="2">
            <img src="https://via.placeholder.com/300x200/22c55e/ffffff?text=Snake" alt="Snake" loading="lazy">
            <div class="game-card-content">
                <div class="game-card-title">Snake</div>
                <div class="game-card-category">arcade</div>
            </div>
        </div>
        <div class="game-card" data-game-id="3">
            <img src="https://via.placeholder.com/300x200/3b82f6/ffffff?text=Tetris" alt="Tetris" loading="lazy">
            <div class="game-card-content">
                <div class="game-card-title">Tetris</div>
                <div class="game-card-category">puzzle</div>
            </div>
        </div>
    `;
    
    if (featuredGrid) featuredGrid.innerHTML = emergencyHTML;
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
    proxyToggle = document.getElementById('proxyToggle');
    gameFrame = document.getElementById('gameFrame');
    fullscreenFrame = document.getElementById('fullscreenFrame');
    fullscreenOverlay = document.getElementById('fullscreenOverlay');
    gamePage = document.getElementById('gamePage');
    homepage = document.getElementById('homePage');
    gameTitle = document.getElementById('gameTitle');
    gameDescription = document.getElementById('gameDescription');
    recommendedGames = document.getElementById('recommendedGames');
    bottomRecommendedGames = document.getElementById('bottomRecommendedGames');
    fullscreenBtn = document.querySelector('[data-action="fullscreen"]');
    exitFullscreen = document.querySelector('.exit-fullscreen-btn');
    
    console.log('🔧 DOM elements initialized');
    console.log('🔍 Key elements check:');
    console.log('  - Featured games grid:', !!document.getElementById('featuredGames'));
    console.log('  - All games grid:', !!document.getElementById('allGames'));
    console.log('  - Search input:', !!document.getElementById('searchInput'));
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
        console.log('Search input found, adding listeners');
        searchInput.addEventListener('input', handleSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });
    } else {
        console.warn('Search input not found');
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
        
        const navLink = navItem.querySelector('.nav-link');
        const page = navLink.dataset.page;
        const category = navLink.dataset.category;
        
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
    
    // Back button
    if (e.target.closest('.back-btn')) {
        e.preventDefault();
        showHomePage();
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
    
    // Exit fullscreen
    if (e.target.closest('.exit-fullscreen-btn')) {
        exitFullscreen();
    }
}

// Proxy toggle handler
function handleProxyToggle(e) {
    if (e.target.type === 'checkbox' && e.target.closest('.proxy-toggle')) {
        isProxyEnabled = e.target.checked;
        
        // Reload current game if one is playing
        if (currentGame) {
            loadGame(currentGame);
        }
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
    
    // Clear iframe when going back to homepage
    if (gameFrame) {
        gameFrame.src = '';
    }
    
    // Reset current game
    currentGame = null;
    
    // Reset search
    if (searchInput) {
        searchInput.value = '';
    }
    
    // Restore the original homepage content
    const contentArea = document.querySelector('.content-area');
    contentArea.innerHTML = `
        <div id="homePage" class="page active">
            <section class="games-section">
                <div class="section-header">
                    <h2 class="section-title">Featured Games</h2>
                </div>
                <div class="games-grid featured-grid" id="featuredGames">
                    <!-- Featured games will be loaded here -->
                </div>
            </section>
            
            <section class="games-section">
                <div class="section-header">
                    <h2 class="section-title">All Games</h2>
                </div>
                <div class="games-grid" id="allGames">
                    <!-- All games will be loaded here -->
                </div>
            </section>
        </div>
    `;
    
    // Re-initialize homepage element reference
    homepage = document.getElementById('homePage');
    
    // Use setTimeout to ensure DOM is ready after innerHTML change
    setTimeout(() => {
        renderFeaturedGames();
        renderGamesByCategory();
    }, 0);
}

function showGamePage(game) {
    console.log('Showing game page for:', game.title);
    currentGame = game;
    hideAllPages();
    document.getElementById('gamePage').classList.add('active');
    
    // Update game info
    const gameTitle = document.getElementById('gameTitle');
    const gameCategory = document.getElementById('gameCategory');
    const gameDescription = document.getElementById('gameDescription');
    
    if (gameTitle) gameTitle.textContent = game.title;
    if (gameCategory) gameCategory.textContent = game.category;
    if (gameDescription) gameDescription.textContent = game.description || 'No description available.';
    
    // Update thumbnail
    const thumbnail = document.getElementById('gameThumbnail');
    if (thumbnail) {
        thumbnail.src = game.thumbnail || `https://via.placeholder.com/300x200/6366f1/ffffff?text=${encodeURIComponent(game.title)}`;
        thumbnail.alt = game.title;
    }
    
    // Update proxy toggle state
    const proxyToggle = document.getElementById('proxyToggle');
    if (proxyToggle) {
        proxyToggle.checked = isProxyEnabled;
    }
    
    // Load recommended games
    renderRecommendedGames(game);
    
    // Auto-load the game
    loadGame(game);
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
    const recommendedGames = games
        .filter(game => game.id !== currentGame.id && game.category === currentGame.category)
        .slice(0, 4);
    
    const recommendedList = document.getElementById('recommendedGames');
    if (recommendedList) {
        console.log('Rendering', recommendedGames.length, 'recommended games');
        recommendedList.innerHTML = recommendedGames.map(game => `
            <div class="recommended-item" data-game-id="${game.id}">
                <img src="${game.thumbnail || `https://via.placeholder.com/120x90/6366f1/ffffff?text=${encodeURIComponent(game.title)}`}" alt="${game.title}">
                <div class="recommended-item-info">
                    <h5>${game.title}</h5>
                    <span class="category">${game.category}</span>
                </div>
            </div>
        `).join('');
    }
}

function createGameCard(game, isFeatured = false) {
    const thumbnailUrl = game.thumbnail || `https://via.placeholder.com/300x200/6366f1/ffffff?text=${encodeURIComponent(game.title)}`;
    
    return `
        <div class="game-card" data-game-id="${game.id}">
            <img src="${thumbnailUrl}" alt="${game.title}" loading="lazy">
            <div class="game-card-content">
                <div class="game-card-title">${game.title}</div>
                <div class="game-card-category">${game.category}</div>
            </div>
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
    if (!gameFrame) return;
    
    try {
        let gameUrl = game.embed; // Use 'embed' field from JSON
        
        // Apply proxy if enabled
        if (isProxyEnabled && !gameUrl.startsWith(proxyUrl)) {
            gameUrl = proxyUrl + encodeURIComponent(gameUrl);
        } else if (!isProxyEnabled && gameUrl.startsWith(proxyUrl)) {
            gameUrl = decodeURIComponent(gameUrl.replace(proxyUrl, ''));
        }
        
        // Validate URL
        if (!isValidUrl(gameUrl)) {
            showError('Invalid game URL');
            return;
        }
        
        gameFrame.src = gameUrl;
        
        // Handle iframe load events
        gameFrame.onload = () => {
            console.log('Game loaded successfully');
        };
        
        gameFrame.onerror = () => {
            showError('Failed to load game. Please try again.');
        };
        
    } catch (error) {
        console.error('Error loading game:', error);
        showError('Error loading game. Please check the URL and try again.');
    }
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


