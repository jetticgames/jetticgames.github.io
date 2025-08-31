// Global variables
let gamesData = [];
let currentGame = null;
let isFullscreen = false;

// DOM elements
const gamesGrid = document.getElementById('gamesGrid');
const gamePage = document.getElementById('gamePage');
const homepage = document.getElementById('homepage');
const gameFrame = document.getElementById('gameFrame');
const gameTitle = document.getElementById('gameTitle');
const gameDescription = document.getElementById('gameDescription');
const recommendedGames = document.getElementById('recommendedGames');
const bottomRecommendedGames = document.getElementById('bottomRecommendedGames');
const proxyToggle = document.getElementById('proxyToggle');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const fullscreenOverlay = document.getElementById('fullscreenOverlay');
const fullscreenFrame = document.getElementById('fullscreenFrame');
const exitFullscreen = document.getElementById('exitFullscreen');
const searchInput = document.getElementById('searchInput');
const filterBtns = document.querySelectorAll('.filter-btn');

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
    
    gameFrame.src = gameUrl;
    
    // Also update fullscreen frame if it exists
    if (fullscreenFrame.src) {
        fullscreenFrame.src = gameUrl;
    }
}

// Get proxy URL
function getProxyUrl(originalUrl) {
    const proxyBaseUrl = 'https://waterwallrelayservice.zonikyo.workers.dev/proxy?url=';
    return proxyBaseUrl + encodeURIComponent(originalUrl);
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
