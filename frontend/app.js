// Global variables
let games = [];
let currentGame = null;
let isProxyEnabled = true;
const proxyUrl = 'https://waterwallrelayservice.zonikyo.workers.dev/';

// Initialize app
document.addEventListener('DOMContentLoaded', init);

async function init() {
    console.log('Initializing WaterWall...');
    await loadGames();
    setupEventListeners();
    showHomePage();
    updateNavigationStats();
    console.log('WaterWall initialized successfully!');
}

// Load games from JSON
async function loadGames() {
    try {
        console.log('Loading games...');
        const response = await fetch('games.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        games = Array.isArray(data) ? data : [];
        console.log(`Loaded ${games.length} games successfully`);
        
        // If no games loaded, use fallback
        if (games.length === 0) {
            throw new Error('No games found in JSON');
        }
        
    } catch (error) {
        console.error('Error loading games:', error);
        showError('Failed to load games. Using fallback games.');
        // Fallback games for testing
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
            }
        ];
        console.log(`Using ${games.length} fallback games`);
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
        
        const page = navItem.dataset.page;
        console.log('Navigating to page:', page);
        
        // Update active nav state
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        navItem.classList.add('active');
        
        // Show appropriate page
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
    
    const homePage = document.getElementById('homePage');
    if (homePage) {
        homePage.classList.add('active');
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
    
    renderFeaturedGames();
    renderGamesByCategory();
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
    const featuredGames = games.slice(0, 6); // First 6 games as featured
    const featuredGrid = document.getElementById('featuredGames');
    
    if (featuredGrid && featuredGames.length > 0) {
        console.log('Rendering', featuredGames.length, 'featured games');
        featuredGrid.innerHTML = featuredGames.map(game => createGameCard(game, true)).join('');
    } else {
        console.log('Featured games container not found or no games available');
    }
}

function renderGamesByCategory() {
    const allGamesContainer = document.getElementById('allGames');
    
    if (allGamesContainer && games.length > 0) {
        console.log('Rendering', games.length, 'total games');
        allGamesContainer.innerHTML = games.map(game => createGameCard(game)).join('');
    } else {
        console.log('All games container not found or no games available');
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

// Initialize the application
document.addEventListener('DOMContentLoaded', async () => {
    await loadGames();
    setupEventListeners();
    displayGames(gamesData);
});

// Load games from JSON file
async function loadGames() {
    try {
        const response = await fetch('games.json');
        gamesData = await response.json();
    } catch (error) {
        console.error('Error loading games:', error);
        // Fallback sample data for development
        gamesData = [
            {
                id: 1,
                title: "2048",
                description: "A sliding puzzle game where you combine tiles with the same number to reach 2048.",
                category: "puzzle",
                embed: "https://play2048.co/",
                thumbnail: "https://via.placeholder.com/280x200/0ff/000?text=2048"
            },
            {
                id: 2,
                title: "Tetris",
                description: "Classic block-stacking puzzle game where you arrange falling pieces.",
                category: "puzzle",
                embed: "https://tetris.com/play-tetris",
                thumbnail: "https://via.placeholder.com/280x200/0ff/000?text=Tetris"
            },
            {
                id: 3,
                title: "Snake",
                description: "Control a snake to eat food and grow longer without hitting walls or yourself.",
                category: "arcade",
                embed: "https://playsnake.org/",
                thumbnail: "https://via.placeholder.com/280x200/0ff/000?text=Snake"
            },
            {
                id: 4,
                title: "Pac-Man",
                description: "Navigate mazes, eat dots, and avoid ghosts in this classic arcade game.",
                category: "arcade",
                embed: "https://pacman.com/en/",
                thumbnail: "https://via.placeholder.com/280x200/0ff/000?text=Pac-Man"
            },
            {
                id: 5,
                title: "Chess",
                description: "Strategic board game for two players on a checkered board.",
                category: "strategy",
                embed: "https://chess.com/play",
                thumbnail: "https://via.placeholder.com/280x200/0ff/000?text=Chess"
            }
        ];
    }
}

// Setup event listeners
function setupEventListeners() {
    // Category filter buttons
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const category = btn.dataset.category;
            const filteredGames = category === 'all' 
                ? gamesData 
                : gamesData.filter(game => game.category === category);
            
            displayGames(filteredGames);
        });
    });

    // Search functionality
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredGames = gamesData.filter(game => 
            game.title.toLowerCase().includes(searchTerm) ||
            game.description.toLowerCase().includes(searchTerm) ||
            game.category.toLowerCase().includes(searchTerm)
        );
        displayGames(filteredGames);
    });

    // Proxy toggle
    proxyToggle.addEventListener('change', () => {
        if (currentGame) {
            loadGame(currentGame);
        }
    });

    // Fullscreen button
    fullscreenBtn.addEventListener('click', enterFullscreen);
    exitFullscreen.addEventListener('click', exitFullscreenMode);

    // Fullscreen overlay click to exit
    fullscreenOverlay.addEventListener('click', (e) => {
        if (e.target === fullscreenOverlay) {
            exitFullscreenMode();
        }
    });

    // ESC key to exit fullscreen
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isFullscreen) {
            exitFullscreenMode();
        }
    });

    // Logo click to go back to homepage
    document.querySelector('.logo').addEventListener('click', showHomepage);
    
    // Also handle logo image click specifically
    const logoImg = document.getElementById('logoImg');
    if (logoImg) {
        logoImg.addEventListener('click', showHomepage);
    }
}

// Display games in the grid
function displayGames(games) {
    gamesGrid.innerHTML = '';
    
    games.forEach(game => {
        const gameCard = createGameCard(game);
        gamesGrid.appendChild(gameCard);
    });
}

// Create a game card element
function createGameCard(game) {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.addEventListener('click', () => showGamePage(game));
    
    card.innerHTML = `
        <img src="${game.thumbnail}" alt="${game.title}" onerror="this.src='https://via.placeholder.com/280x200/0ff/000?text=${encodeURIComponent(game.title)}'">
        <div class="game-info-overlay">
            <h3>${game.title}</h3>
            <div class="category">${game.category.charAt(0).toUpperCase() + game.category.slice(1)}</div>
        </div>
    `;
    
    return card;
}

// Show game page
function showGamePage(game) {
    currentGame = game;
    
    // Update game info
    gameTitle.textContent = game.title;
    gameDescription.textContent = game.description;
    
    // Load game
    loadGame(game);
    
    // Load recommended games
    loadRecommendedGames(game);
    
    // Show game page with transition
    homepage.classList.remove('active');
    setTimeout(() => {
        gamePage.classList.add('active');
    }, 150);
}

// Load game in iframe
function loadGame(game) {
    const useProxy = proxyToggle.checked;
    const gameUrl = useProxy ? getProxyUrl(game.embed) : game.embed;
    
    // Ensure we have a valid URL
    if (!gameUrl) {
        console.error('No valid game URL found');
        return;
    }
    
    // Set the iframe source
    if (gameFrame) {
        gameFrame.src = gameUrl;
    }
    
    // Also update fullscreen frame if it exists and is currently being used
    if (fullscreenFrame && isFullscreen) {
        fullscreenFrame.src = gameUrl;
    }
}

// Get proxy URL
function getProxyUrl(originalUrl) {
    if (!originalUrl) {
        console.error('No original URL provided to proxy');
        return '';
    }
    
    const proxyBaseUrl = 'https://waterwallrelayservice.zonikyo.workers.dev/proxy?url=';
    const finalUrl = proxyBaseUrl + encodeURIComponent(originalUrl);
    return finalUrl;
}

// Load recommended games
function loadRecommendedGames(currentGame) {
    const otherGames = gamesData.filter(game => game.id !== currentGame.id);
    const shuffled = shuffleArray([...otherGames]);
    
    // Load sidebar recommendations (fixed number)
    const sidebarRecommended = shuffled.slice(0, 4);
    recommendedGames.innerHTML = '';
    
    sidebarRecommended.forEach(game => {
        const item = createRecommendedItem(game);
        recommendedGames.appendChild(item);
    });
    
    // Load bottom recommendations based on available space
    setTimeout(() => {
        loadBottomRecommendations(shuffled.slice(4), currentGame);
    }, 100); // Small delay to ensure description is rendered
}

// Load bottom recommendations based on available space
function loadBottomRecommendations(availableGames, currentGame) {
    const descriptionHeight = gameDescription.scrollHeight;
    const containerHeight = 200; // Max height of game-info section
    const itemHeight = 80; // Approximate height of each recommendation item
    const padding = 20;
    
    // Calculate how many items can fit
    const availableSpace = containerHeight - padding;
    const maxItems = Math.floor(availableSpace / itemHeight);
    
    // Adjust based on description height - if description is short, show fewer items
    const descriptionRatio = descriptionHeight / containerHeight;
    let itemsToShow;
    
    if (descriptionRatio < 0.3) {
        itemsToShow = Math.min(2, maxItems, availableGames.length);
    } else if (descriptionRatio < 0.6) {
        itemsToShow = Math.min(3, maxItems, availableGames.length);
    } else {
        itemsToShow = Math.min(4, maxItems, availableGames.length);
    }
    
    bottomRecommendedGames.innerHTML = '';
    
    const bottomRecommended = availableGames.slice(0, itemsToShow);
    bottomRecommended.forEach(game => {
        const item = createRecommendedItem(game);
        bottomRecommendedGames.appendChild(item);
    });
}

// Create a recommended item element
function createRecommendedItem(game) {
    const item = document.createElement('div');
    item.className = 'recommended-item';
    item.addEventListener('click', () => showGamePage(game));
    
    item.innerHTML = `
        <img src="${game.thumbnail}" alt="${game.title}" onerror="this.src='https://via.placeholder.com/60x45/0ff/000?text=${encodeURIComponent(game.title.charAt(0))}'">
        <div class="recommended-item-info">
            <h4>${game.title}</h4>
            <div class="category">${game.category.charAt(0).toUpperCase() + game.category.slice(1)}</div>
        </div>
    `;
    
    return item;
}

// Shuffle array utility
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// Enter fullscreen mode
function enterFullscreen() {
    if (currentGame) {
        isFullscreen = true;
        fullscreenFrame.src = gameFrame.src;
        fullscreenOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// Exit fullscreen mode
function exitFullscreenMode() {
    isFullscreen = false;
    fullscreenOverlay.classList.remove('active');
    document.body.style.overflow = 'auto';
    fullscreenFrame.src = '';
}

// Show homepage
function showHomepage() {
    gamePage.classList.remove('active');
    setTimeout(() => {
        homepage.classList.add('active');
    }, 150);
    
    // Clear iframe when going back to homepage
    if (gameFrame) {
        gameFrame.src = '';
    }
    
    // Reset current game
    currentGame = null;
    
    // Reset search and filters
    searchInput.value = '';
    filterBtns.forEach(btn => btn.classList.remove('active'));
    filterBtns[0].classList.add('active'); // Set "All" as active
    displayGames(gamesData);
}

// Handle browser back/forward buttons
window.addEventListener('popstate', (e) => {
    if (e.state && e.state.page === 'game' && e.state.gameId) {
        const game = gamesData.find(g => g.id === e.state.gameId);
        if (game) {
            showGamePage(game);
        }
    } else {
        showHomepage();
    }
});

// Update URL when navigating to game page
function updateUrl(game) {
    const url = new URL(window.location);
    url.searchParams.set('game', game.id);
    window.history.pushState({ page: 'game', gameId: game.id }, game.title, url);
}

// Check URL on load for direct game links
function checkUrlForGame() {
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('game');
    
    if (gameId) {
        const game = gamesData.find(g => g.id === parseInt(gameId));
        if (game) {
            showGamePage(game);
        }
    }
}

// Initialize URL checking after games are loaded
window.addEventListener('load', () => {
    setTimeout(checkUrlForGame, 100);
});

// Handle responsive design changes
function handleResize() {
    if (window.innerWidth <= 768 && isFullscreen) {
        // Adjust fullscreen for mobile
        fullscreenFrame.style.width = '100%';
        fullscreenFrame.style.height = '100%';
    }
}

window.addEventListener('resize', handleResize);

// Prevent iframe from breaking out of container
function preventIframeBreakout() {
    const iframes = document.querySelectorAll('iframe');
    iframes.forEach(iframe => {
        iframe.addEventListener('load', () => {
            try {
                // Add sandbox attributes for security
                iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-forms');
            } catch (e) {
                console.log('Iframe security setup complete');
            }
        });
    });
}

// Initialize iframe security
document.addEventListener('DOMContentLoaded', preventIframeBreakout);

// Error handling for failed game loads
gameFrame.addEventListener('error', () => {
    console.log('Game failed to load, trying without proxy...');
    if (proxyToggle.checked && currentGame) {
        proxyToggle.checked = false;
        loadGame(currentGame);
    }
});

// Service worker registration for offline functionality (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
