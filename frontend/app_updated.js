// Global variables
let games = [];
let currentGame = null;
let isProxyEnabled = true;
const proxyUrl = 'https://waterwallrelayservice.zonikyo.workers.dev/';

// Initialize app
document.addEventListener('DOMContentLoaded', init);

async function init() {
    await loadGames();
    setupEventListeners();
    showHomePage();
    updateNavigationStats();
}

// Load games from JSON
async function loadGames() {
    try {
        const response = await fetch('./games.json');
        games = await response.json();
    } catch (error) {
        console.error('Error loading games:', error);
        showError('Failed to load games. Please try again later.');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Navigation
    document.addEventListener('click', handleNavigation);
    
    // Search functionality
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.querySelector('.search-btn');
    
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });
    }
    
    if (searchBtn) {
        searchBtn.addEventListener('click', handleSearch);
    }
    
    // Game controls
    document.addEventListener('change', handleProxyToggle);
    document.addEventListener('click', handleGameActions);
    
    // Fullscreen controls
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Navigation handler
function handleNavigation(e) {
    // Sidebar navigation
    if (e.target.closest('.nav-link')) {
        e.preventDefault();
        const navItem = e.target.closest('.nav-item');
        const page = navItem.dataset.page;
        
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
        }
    }
    
    // Game card clicks
    if (e.target.closest('.game-card')) {
        const gameCard = e.target.closest('.game-card');
        const gameId = gameCard.dataset.gameId;
        const game = games.find(g => g.id == gameId);
        if (game) {
            showGamePage(game);
        }
    }
    
    // Back button
    if (e.target.closest('.back-btn')) {
        e.preventDefault();
        showHomePage();
    }
    
    // Recommended game clicks
    if (e.target.closest('.recommended-item')) {
        const gameId = e.target.closest('.recommended-item').dataset.gameId;
        const game = games.find(g => g.id == gameId);
        if (game) {
            showGamePage(game);
        }
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
    hideAllPages();
    document.getElementById('homePage').classList.add('active');
    
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector('[data-page="home"]').classList.add('active');
    
    renderFeaturedGames();
    renderGamesByCategory();
}

function showGamePage(game) {
    currentGame = game;
    hideAllPages();
    document.getElementById('gamePage').classList.add('active');
    
    // Update game info
    document.getElementById('gameTitle').textContent = game.title;
    document.getElementById('gameCategory').textContent = game.category;
    document.getElementById('gameDescription').textContent = game.description || 'No description available.';
    
    // Update thumbnail
    const thumbnail = document.getElementById('gameThumbnail');
    if (thumbnail) {
        thumbnail.src = game.thumbnail || `https://via.placeholder.com/300x200?text=${encodeURIComponent(game.title)}`;
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
    
    if (featuredGrid) {
        featuredGrid.innerHTML = featuredGames.map(game => createGameCard(game, true)).join('');
    }
}

function renderGamesByCategory() {
    const categories = [...new Set(games.map(game => game.category))];
    const allGamesContainer = document.getElementById('allGames');
    
    if (allGamesContainer) {
        allGamesContainer.innerHTML = games.map(game => createGameCard(game)).join('');
    }
}

function renderRecommendedGames(currentGame) {
    const recommendedGames = games
        .filter(game => game.id !== currentGame.id && game.category === currentGame.category)
        .slice(0, 4);
    
    const recommendedList = document.getElementById('recommendedGames');
    if (recommendedList) {
        recommendedList.innerHTML = recommendedGames.map(game => `
            <div class="recommended-item" data-game-id="${game.id}">
                <img src="${game.thumbnail || `https://via.placeholder.com/120x90?text=${encodeURIComponent(game.title)}`}" alt="${game.title}">
                <div class="recommended-item-info">
                    <h5>${game.title}</h5>
                    <span class="category">${game.category}</span>
                </div>
            </div>
        `).join('');
    }
}

function createGameCard(game, isFeatured = false) {
    return `
        <div class="game-card" data-game-id="${game.id}">
            <img src="${game.thumbnail || `https://via.placeholder.com/300x200?text=${encodeURIComponent(game.title)}`}" alt="${game.title}">
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
        let gameUrl = game.url || game.embed;
        
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
    
    if (totalGamesElement) {
        totalGamesElement.textContent = games.length;
    }
    
    if (categoriesElement) {
        const uniqueCategories = [...new Set(games.map(game => game.category))];
        categoriesElement.textContent = uniqueCategories.length;
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
