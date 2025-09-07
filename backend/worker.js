// Cloudflare Worker script for WaterWall - Full Backend API
// This worker now serves as a complete backend for the WaterWall platform

// Application configuration and constants
const APP_VERSION = '2.0.1';
const VERSION_ENDPOINT_CACHE_TTL = 300; // 5 minutes
const GAMES_CACHE_TTL = 3600; // 1 hour
const CONFIG_CACHE_TTL = 1800; // 30 minutes

// Comprehensive Admin-Controlled Configuration
// This configuration can be overridden via backend API and controls ALL aspects of WaterWall
const DEFAULT_CONFIG = {
    version: APP_VERSION,
    
    // Maintenance Mode Control
    maintenanceMode: {
        enabled: false,
        message: "WaterWall is currently under maintenance. We'll be back online soon!",
        estimatedTime: "Please check back in a few hours.",
        blockProxy: true // Also disable proxy during maintenance
    },
    
    // Feature Toggles - Admin can enable/disable any feature globally
    features: {
        // Core Features
        accountSystemEnabled: true,        // Enable/disable Auth0 login system
        favoritesEnabled: true,           // Enable/disable favorites functionality
        searchEnabled: true,              // Enable/disable game search
        fullscreenEnabled: true,          // Enable/disable fullscreen mode
        categoriesEnabled: true,          // Enable/disable category filtering
        settingsMenuEnabled: true,        // Enable/disable entire settings menu
        updatingEnabled: true,            // Enable/disable update checks and notifications
        
        // Visual Features
        particlesEnabled: true,           // Enable/disable background particles system
        customCursorEnabled: true,        // Enable/disable custom cursor functionality
        
        // Advanced Features
        proxyEnabled: true,               // Enable/disable proxy functionality globally
        gameEmbedEnabled: true,           // Enable/disable game embedding
        themeCustomizationEnabled: true,  // Enable/disable theme customization
        keyboardShortcutsEnabled: true,   // Enable/disable keyboard shortcuts
        
        // Content Controls
        adVerificationEnabled: true,     // Enable/disable ad verification page
        mobileAccessEnabled: false,       // Enable/disable mobile device access
        
        // Admin Controls
        debugModeEnabled: false,          // Enable/disable debug logging
        analyticsEnabled: false,          // Enable/disable analytics tracking
        errorReportingEnabled: true       // Enable/disable error reporting
    },
    
    // Default Settings for New Users and Reset Function
    defaultUserSettings: {
        // Proxy Settings
        defaultProxy: false,
        
        // Theme & Visual Settings
        accentColor: '#58a6ff',
        
        // Particle Settings
        particlesEnabled: true,
        particleSpeed: 0.5,
        particleCount: 50,
        particleColor: '#58a6ff',
        particleLineDistance: 150,
        particleMouseInteraction: true,
        
        // Cursor Settings
        customCursorEnabled: true,
        cursorSize: 8,
        cursorColor: '#ffffff',
        cursorType: 'circle',
        customCursorImage: null,
        
        // Behavior Settings
        autoFullscreen: false,
        soundEnabled: true,
        animationsEnabled: true,
        autoSaveEnabled: true,
        
        // Privacy Settings
        analyticsOptIn: false,
        errorReportingOptIn: true
    },
    
    // UI Controls - What elements are shown/hidden
    uiControls: {
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
    },
    
    // Content Management
    contentControls: {
        maxGamesPerPage: 50,
        enableGameRatings: false,
        enableGameComments: false,
        enableGameSuggestions: true,
        showGameDescriptions: true,
        showGameThumbnails: true,
        enableGameSearch: true,
        enableCategoryFiltering: true
    },
    
    // Security & Performance
    systemControls: {
        enableCORS: true,
        enableCaching: true,
        cacheTimeout: 3600,
        enableRateLimiting: true,
        maxRequestsPerMinute: 100,
        enableCSP: true,
        enableHTTPS: true,
        enableCompression: true
    },
    
    // Messaging & Communication
    messaging: {
        welcomeMessage: "Welcome to WaterWall! Enjoy our collection of games.",
        maintenanceMessage: "WaterWall is currently under maintenance. We'll be back online soon!",
        errorMessage: "Something went wrong. Please try again later.",
        noGamesMessage: "No games found. Try adjusting your search or category filter.",
        loadingMessage: "Loading games...",
        offlineMessage: "You appear to be offline. Some features may not work."
    }
};

// Games database - now served from backend
const GAMES_DATABASE = [
    // Minecraft Games
    {
        "id": 1,
        "title": "Eaglercraft 1.5.2 (Eagtek)",
        "description": "A version of Minecraft 1.5.2 tailored for browser play, offering the classic survival and creative modes.",
        "category": "sandbox",
        "embed": "https://eaglercraftgame.github.io/go/minecraft-1.5.2/",
        "thumbnail": "images/eaglercraft1.5.2.png"
    },
    {
        "id": 2,
        "title": "Eaglercraft X 1.8 (Astraclient)",
        "description": "An enhanced version of Minecraft 1.8 for browsers, featuring additional client-side improvements and tweaks.",
        "category": "sandbox",
        "embed": "https://astraclientorg.github.io/",
        "thumbnail": "images/eaglercraft1.8.png"
    },
    {
        "id": 3,
        "title": "Minecraft Classic",
        "description": "The original Minecraft experience, playable in a web browser, offering the iconic sandbox gameplay.",
        "category": "sandbox",
        "embed": "https://minecraftunblocked.gitlab.io/go/minecraft-beta/",
        "thumbnail": "images/Survival-games-Minecraft-3852067660.jpg"
    },
    
    // Racing & Driving Games
    {
        "id": 4,
        "title": "Slope",
        "description": "A fast-paced 3D running game where you navigate a ball down a steep, endless slope.",
        "category": "racing",
        "embed": "https://theslope.github.io/games/slope/index.html",
        "thumbnail": "images/slope.png"
    },
    {
        "id": 5,
        "title": "Slope 2",
        "description": "The sequel to Slope, featuring more challenging levels and enhanced graphics.",
        "category": "racing",
        "embed": "https://slope-2.gitlab.io/file/",
        "thumbnail": "images/slope2.png"
    },
    {
        "id": 6,
        "title": "Slope Multiplayer",
        "description": "A multiplayer version of Slope where you can compete against other players.",
        "category": "racing",
        "embed": "https://education76.github.io/g7/slope-2-multiplayer/",
        "thumbnail": "images/slope-multiplayer-646454450.jpg"
    },
    {
        "id": 7,
        "title": "Drive Mad",
        "description": "A driving game focused on performing stunts and overcoming various obstacles.",
        "category": "racing",
        "embed": "https://drive-madgame.github.io/file/",
        "thumbnail": "images/drive-mad-1427835126.jpg"
    },
    {
        "id": 8,
        "title": "Moto X3M",
        "description": "A motocross racing game with challenging tracks and obstacles.",
        "category": "racing",
        "embed": "https://motox3m.gitlab.io/game/moto-x3m/",
        "thumbnail": "images/motox3m.png"
    },
    {
        "id": 9,
        "title": "Moto X3M Extended",
        "description": "An extended version of Moto X3M with additional levels.",
        "category": "racing",
        "embed": "https://motox3m.gitlab.io/x3m-1.20.1p/",
        "thumbnail": "images/motox3mextended.png"
    },
    {
        "id": 10,
        "title": "Moto X3M Pool Party",
        "description": "A summer-themed version of Moto X3M.",
        "category": "racing",
        "embed": "https://education76.github.io/g/moto-x3m-pool-party/",
        "thumbnail": "images/moto-x3m-pool-party-1092271902.jpg"
    },
    {
        "id": 11,
        "title": "Moto X3M Winter",
        "description": "A winter-themed version of Moto X3M.",
        "category": "racing",
        "embed": "https://motox3munblocked.github.io/4-winter/",
        "thumbnail": "images/moto-x3m-winter-1546391187.jpg"
    },
    {
        "id": 12,
        "title": "Stunt Master City",
        "description": "A stunt driving game set in a city environment.",
        "category": "racing",
        "embed": "https://ubg77.github.io/edit/city-car-driving-stunt-master/",
        "thumbnail": "images/citycarstuntdriver.png"
    },
    {
        "id": 13,
        "title": "Sky Car Stunt 3D",
        "description": "A 3D car stunt game with challenging tracks.",
        "category": "racing",
        "embed": "https://ubg77.github.io/edit/city-car-driving-stunt-master/",
        "thumbnail": "images/sky-car-stunt-3d-racing-games-screenshot-3772473604.jpg"
    },
    {
        "id": 14,
        "title": "Parking Fury",
        "description": "A parking simulation game with various challenges.",
        "category": "racing",
        "embed": "https://parking-fury.gitlab.io/file/",
        "thumbnail": "images/parking-fury-1290644957.png"
    },
    {
        "id": 15,
        "title": "Parking Fury 2",
        "description": "The sequel to Parking Fury with new levels.",
        "category": "racing",
        "embed": "https://gnhustgames.github.io/parking-fury-2/",
        "thumbnail": "images/parkingfury2new-641888004.jpg"
    },
    {
        "id": 16,
        "title": "Parking Fury 3",
        "description": "Another sequel in the Parking Fury series.",
        "category": "racing",
        "embed": "https://parkingfury3.github.io/gamefle/parking-fury-3/",
        "thumbnail": "images/ParkingFury3_OG-logo-2904042009.jpg"
    },
    {
        "id": 17,
        "title": "Drift Boss",
        "description": "A drifting game where you navigate through various tracks.",
        "category": "racing",
        "embed": "https://drift-boss.gitlab.io/file/",
        "thumbnail": "images/driftboss.png"
    },
    {
        "id": 18,
        "title": "Eggy Car",
        "description": "A driving game where you balance an egg on a car.",
        "category": "racing",
        "embed": "https://webglmath.github.io/eggy-car/",
        "thumbnail": "images/eggy-car-1413036222.webp"
    },
    {
        "id": 19,
        "title": "Smash Karts",
        "description": "A multiplayer kart racing game with weapons.",
        "category": "racing",
        "embed": "https://smashkartsunblocked.github.io/",
        "thumbnail": "images/smashkarts.png"
    },
    
    // Shooter Games
    {
        "id": 20,
        "title": "1v1.lol",
        "description": "A competitive building and shooting game where players can challenge each other in 1v1 battles.",
        "category": "shooter",
        "embed": "https://1vl.school/",
        "thumbnail": "images/1v1-lol-Unblocked-Game-2936374542.jpg"
    },
    {
        "id": 21,
        "title": "Time Shooter 2",
        "description": "A shooting game where time moves only when you move.",
        "category": "shooter",
        "embed": "https://gnhustgames.github.io/timeshooter2/",
        "thumbnail": "images/time-shooter-2-3430007738.jpg"
    },
    {
        "id": 22,
        "title": "Sniper Assassin",
        "description": "A shooting game where you play as a sniper completing various missions.",
        "category": "shooter",
        "embed": "https://unblockeds-games.github.io/iframe/Sniper-Assassin/",
        "thumbnail": "images/sniperassasin.png"
    },
    {
        "id": 23,
        "title": "Sniper Assassin 2",
        "description": "The sequel to Sniper Assassin with new missions.",
        "category": "shooter",
        "embed": "https://unblockeds-games.github.io/iframe/Sniper-Assassin-2/",
        "thumbnail": "images/sniper-assassin-2-3470249355.jpg"
    },
    {
        "id": 24,
        "title": "Sniper Assassin 3",
        "description": "The third installment in the Sniper Assassin series.",
        "category": "shooter",
        "embed": "https://unblockeds-games.github.io/iframe/Sniper-Assassin-3/",
        "thumbnail": "images/sniperassasin3.png"
    },
    {
        "id": 25,
        "title": "Sniper Assassin 4",
        "description": "Another sequel in the Sniper Assassin series.",
        "category": "shooter",
        "embed": "https://unblockeds-games.github.io/iframe/Sniper-Assassin-4/",
        "thumbnail": "images/sniperassasin4.png"
    },
    {
        "id": 26,
        "title": "Sniper Assassin 5",
        "description": "The fifth installment in the Sniper Assassin series.",
        "category": "shooter",
        "embed": "https://unblockeds-games.github.io/iframe/Sniper-Assassin-5/",
        "thumbnail": "images/sniperassasinfinal.png"
    },
    {
        "id": 27,
        "title": "Tactical Assassin",
        "description": "A tactical shooting game with various missions.",
        "category": "shooter",
        "embed": "https://unblockeds-games.github.io/iframe/Tactical-Assassin/",
        "thumbnail": "images/tacticalassasin2.png"
    },
    {
        "id": 28,
        "title": "Tactical Assassin 2",
        "description": "The sequel to Tactical Assassin with new missions.",
        "category": "shooter",
        "embed": "https://unblockeds-games.github.io/iframe/Tactical-Assassin-2/",
        "thumbnail": "images/tactical-assassin-android-001-3883766304.webp"
    },
    {
        "id": 29,
        "title": "Tactical Assassin 3",
        "description": "Another sequel in the Tactical Assassin series.",
        "category": "shooter",
        "embed": "https://unblockeds-games.github.io/iframe/Tactical-Assassin-3/",
        "thumbnail": "images/tactical.assassin3-1026657409.jpg"
    },
    {
        "id": 30,
        "title": "Quake",
        "description": "A classic first-person shooter game.",
        "category": "shooter",
        "embed": "https://gnhustgames.github.io/quake/wwwwsadwsw",
        "thumbnail": "images/EGS_Quake_idSoftwareNightdiveStudios_S1_2560x1440-b31ed6ea4d89261b0556846ffd842d67-553107640.jpg"
    },
    {
        "id": 31,
        "title": "BulletForce",
        "description": "A first-person shooter game with various multiplayer modes.",
        "category": "shooter",
        "embed": "https://ubg44.github.io/BulletForce/",
        "thumbnail": "images/bulletforce.png"
    },
    {
        "id": 32,
        "title": "Mad Gunz",
        "description": "A multiplayer first-person shooter game.",
        "category": "shooter",
        "embed": "https://ubgwtf.gitlab.io/mad-gunz/",
        "thumbnail": "images/mad-gunz-3016738451.png"
    },
    
    // Platform & Adventure Games
    {
        "id": 33,
        "title": "Run",
        "description": "A classic platformer where you run and jump through a series of challenging levels.",
        "category": "adventure",
        "embed": "https://dnrweqffuwjtx.cloudfront.net/games/2024/flash/run-1/index.html",
        "thumbnail": "images/Run_OG-logo-1274939593.jpg"
    },
    {
        "id": 34,
        "title": "Run 2",
        "description": "The sequel to Run with more complex levels and new characters.",
        "category": "adventure",
        "embed": "https://ubg89.github.io/Run2/",
        "thumbnail": "images/run2-1880122649.webp"
    },
    {
        "id": 35,
        "title": "Run 3",
        "description": "The third installment in the Run series, featuring new levels and gameplay mechanics.",
        "category": "adventure",
        "embed": "https://lekug.github.io/tn6pS9dCf37xAhkJv/",
        "thumbnail": "images/Run3_OG-logo-542179002.jpg"
    },
    {
        "id": 36,
        "title": "Duck Life",
        "description": "A game where you raise and train a duck to compete in races.",
        "category": "adventure",
        "embed": "https://ducklifegame.github.io/file/",
        "thumbnail": "images/DuckLife_OG-logo-2499380549.jpg"
    },
    {
        "id": 37,
        "title": "Duck Life 2",
        "description": "The sequel to Duck Life with more features and challenges.",
        "category": "adventure",
        "embed": "https://unblockeds-games.github.io/iframe/Duck-Life-2/",
        "thumbnail": "images/ducklife2.png"
    },
    {
        "id": 38,
        "title": "Duck Life 3",
        "description": "Another sequel in the Duck Life series with enhanced gameplay.",
        "category": "adventure",
        "embed": "https://unblockedgames911.gitlab.io/duck-life-3/",
        "thumbnail": "images/ducklife3.png"
    },
    {
        "id": 39,
        "title": "Duck Life 4",
        "description": "The fourth installment in the Duck Life series.",
        "category": "adventure",
        "embed": "https://htmlxm.github.io/h/duck-life-4",
        "thumbnail": "images/ducklife4.png"
    },
    {
        "id": 40,
        "title": "Geometry Dash",
        "description": "A rhythm-based platformer with challenging levels.",
        "category": "adventure",
        "embed": "https://q9shks-8080.csb.app/service/hvtrs8%2F-ggooevr%7Bgcmg.mre%2Feaoe-ggooevr%7B-faqh%2Flktg%2F/",
        "thumbnail": "images/geometrydash.png"
    },
    {
        "id": 41,
        "title": "Subway Surfers",
        "description": "An endless runner game where you dodge obstacles and collect coins.",
        "category": "adventure",
        "embed": "https://subway-surfers.gitlab.io/file/",
        "thumbnail": "images/subway-surfers-desktop-hero-2020-final-1505522840.jpg"
    },
    {
        "id": 42,
        "title": "Crossy Road",
        "description": "An arcade game where you help a character cross roads and avoid obstacles.",
        "category": "adventure",
        "embed": "https://webglmath.github.io/eggy-car/",
        "thumbnail": "images/crossyroad.png"
    },
    {
        "id": 43,
        "title": "Tunnel Rush",
        "description": "A fast-paced tunnel racing game.",
        "category": "adventure",
        "embed": "https://liminthoi.github.io/games/tunnel-rush/index.html",
        "thumbnail": "images/tunnel-rush-3219939059.png"
    },
    {
        "id": 44,
        "title": "Happy Wheels",
        "description": "A ragdoll physics-based platformer with various levels.",
        "category": "adventure",
        "embed": "https://sreekar617.github.io/hw/index.html",
        "thumbnail": "images/happywheels.png"
    },
    
    // Arcade Games
    {
        "id": 45,
        "title": "Flappy Bird",
        "description": "A simple yet addictive arcade game where you navigate a bird through pipes.",
        "category": "arcade",
        "embed": "https://ccported.github.io/fb/",
        "thumbnail": "images/flappy-bird-screenshot-1296977527.jpg"
    },
    {
        "id": 46,
        "title": "Fallboys",
        "description": "A multiplayer party game with various mini-games.",
        "category": "arcade",
        "embed": "https://gnhustgames.github.io/fallboys/",
        "thumbnail": "images/fall-boys-unblocked-1054828642.jpg"
    },
    
    // Horror Games
    {
        "id": 47,
        "title": "Five Nights at Freddy's",
        "description": "A horror game where you survive nights in a haunted pizzeria.",
        "category": "horror",
        "embed": "https://fivenightsatfreddysonline.github.io/file/",
        "thumbnail": "images/Five-Nights-at-Freddys-f01-res-3753001984.jpg"
    },
    {
        "id": 48,
        "title": "Backrooms",
        "description": "An exploration game set in the eerie and endless backrooms.",
        "category": "horror",
        "embed": "https://unblockeds-games.github.io/iframe/backrooms/",
        "thumbnail": "images/the-backrooms-lcwz7av7xsd9fl5l-993472238.jpg"
    },
    
    // Simulation & Management Games
    {
        "id": 49,
        "title": "Townscaper",
        "description": "A city-building game with a focus on creativity and aesthetics.",
        "category": "simulation",
        "embed": "https://manscod.github.io/other/townscaper/",
        "thumbnail": "images/EGS_Townscaper_OskarStlberg_S3_2560x1440-558540cb0b62cb5520f1f9e5b4c7a204-2698187929.jpg"
    },
    {
        "id": 50,
        "title": "Monkey Mart",
        "description": "A management game where you run a monkey-themed grocery store.",
        "category": "simulation",
        "embed": "https://monkeymartonline.github.io/file/",
        "thumbnail": "images/monkeymart-half-2564318793.png"
    },
    
    // Puzzle Games
    {
        "id": 51,
        "title": "2048",
        "description": "A sliding puzzle game where you combine tiles to reach the number 2048.",
        "category": "puzzle",
        "embed": "https://ovolve.github.io/2048-AI/",
        "thumbnail": "images/2048.png"
    },
    {
        "id": 52,
        "title": "Little Alchemy 2",
        "description": "A puzzle game where you combine elements to create new items.",
        "category": "puzzle",
        "embed": "https://classroom15x.com/coolmath/LittleAlchemy2/?gd_sdk_referrer_url=https://classroom15x.com/play/little-alchemy-2",
        "thumbnail": "images/littlealchemy2.png"
    },
    {
        "id": 53,
        "title": "Minesweeper",
        "description": "The classic puzzle game where you clear a minefield.",
        "category": "puzzle",
        "embed": "https://minesweeper.github.io/",
        "thumbnail": "images/minesweeper.png"
    },
    
    // Classic Games
    {
        "id": 54,
        "title": "Cookie Clicker",
        "description": "An incremental game where you click to produce cookies.",
        "category": "classic",
        "embed": "https://ozh.github.io/cookieclicker/",
        "thumbnail": "images/cookieclicker.png"
    },
    {
        "id": 55,
        "title": "8 Ball Pool",
        "description": "A classic pool game playable in a browser.",
        "category": "classic",
        "embed": "https://8-ball-pool-online.github.io/file/",
        "thumbnail": "images/Miniclip-8-Ball-Pool-4.6.2-594489945.jpg"
    },
    {
        "id": 56,
        "title": "Solitaire",
        "description": "The classic card game, Solitaire.",
        "category": "classic",
        "embed": "https://www.google.com/logos/fnbx/solitaire/standalone.html",
        "thumbnail": "images/2x1_NSwitchDS_SolitaireClassicCardGame_image1600w-751113320.jpg"
    }
];

// Asset mappings - All assets served from backend for instant updates
const ASSET_MAPPINGS = {
    // Game thumbnails
    'thumbnails/cookieclicker.jpg': {
        url: 'https://raw.githubusercontent.com/Zonikyo/WaterWall/main/frontend/images/cookieclicker.jpg',
        contentType: 'image/jpeg',
        maxAge: 604800 // 7 days
    },
    'thumbnails/tetris.webp': {
        url: 'https://raw.githubusercontent.com/Zonikyo/WaterWall/main/frontend/images/tetris.webp',
        contentType: 'image/webp',
        maxAge: 604800
    },
    'thumbnails/snake.gif': {
        url: 'https://raw.githubusercontent.com/Zonikyo/WaterWall/main/frontend/images/snake.gif',
        contentType: 'image/gif',
        maxAge: 604800
    },
    'thumbnails/pacman.avif': {
        url: 'https://raw.githubusercontent.com/Zonikyo/WaterWall/main/frontend/images/pacman.avif',
        contentType: 'image/avif',
        maxAge: 604800
    },
    'thumbnails/chess.png': {
        url: 'https://raw.githubusercontent.com/Zonikyo/WaterWall/main/frontend/images/chess.png',
        contentType: 'image/png',
        maxAge: 604800
    },
    
    // Core assets that can be served from backend
    'assets/logo.png': {
        url: 'https://raw.githubusercontent.com/Zonikyo/WaterWall/main/frontend/logo.png',
        contentType: 'image/png',
        maxAge: 604800
    },
    'assets/styles.css': {
        url: 'https://raw.githubusercontent.com/Zonikyo/WaterWall/main/frontend/styles.css',
        contentType: 'text/css',
        maxAge: 86400 // 1 day for CSS
    },
    'assets/app.js': {
        url: 'https://raw.githubusercontent.com/Zonikyo/WaterWall/main/frontend/app.js',
        contentType: 'application/javascript',
        maxAge: 3600 // 1 hour for JS (frequent updates)
    },
    'assets/sw.js': {
        url: 'https://raw.githubusercontent.com/Zonikyo/WaterWall/main/frontend/sw.js',
        contentType: 'application/javascript',
        maxAge: 3600
    },
    'assets/games.json': {
        url: 'https://raw.githubusercontent.com/Zonikyo/WaterWall/main/frontend/games.json',
        contentType: 'application/json',
        maxAge: 300 // 5 minutes for frequently updated content
    }
};

// Legacy thumbnail mappings for backward compatibility
const THUMBNAIL_MAPPINGS = {
    'cookieclicker.jpg': 'https://raw.githubusercontent.com/Zonikyo/WaterWall/main/frontend/images/cookieclicker.jpg',
    'tetris.webp': 'https://raw.githubusercontent.com/Zonikyo/WaterWall/main/frontend/images/tetris.webp', 
    'snake.gif': 'https://raw.githubusercontent.com/Zonikyo/WaterWall/main/frontend/images/snake.gif',
    'pacman.avif': 'https://raw.githubusercontent.com/Zonikyo/WaterWall/main/frontend/images/pacman.avif',
    'chess.png': 'https://raw.githubusercontent.com/Zonikyo/WaterWall/main/frontend/images/chess.png'
};

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        
        // Log all incoming requests for debugging
        console.log(`🔍 Request: ${request.method} ${url.pathname}`);
        console.log(`🔍 Headers: Authorization=${request.headers.get('Authorization') ? 'Present' : 'Missing'}`);
        
        // Handle CORS preflight requests
        if (request.method === 'OPTIONS') {
            return handleCORS();
        }
        
        // Check rate limits
        const rateLimitResponse = await checkRateLimit(request, env);
        if (rateLimitResponse) {
            return rateLimitResponse;
        }
        
        // API Routes
        if (url.pathname.startsWith('/api/')) {
            // Use routing wrapper that includes social/profile extensions (see social layer section)
            return routeAPIRequest(request, url, env, ctx);
        }
        
        // Handle proxy requests
        if (url.pathname.startsWith('/proxy')) {
            return handleProxy(request, url);
        }
        
        // Handle health check
        if (url.pathname === '/health') {
            return new Response(JSON.stringify({
                status: 'OK',
                version: APP_VERSION,
                timestamp: new Date().toISOString(),
                uptime: 'N/A' // Cloudflare Workers don't have persistent uptime
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    ...getCORSHeaders()
                }
            });
        }
        
        // Default response for unknown routes
        return new Response(JSON.stringify({
            message: 'WaterWall Backend API',
            version: APP_VERSION,
            endpoints: [
                'GET /api/health - Health check endpoint',
                'GET /api/games - Get all games',
                'GET /api/config - Get application configuration',
                'GET /api/version - Get version info and check for updates',
                'GET /api/maintenance - Get maintenance status',
                'PUT /api/maintenance - Update maintenance status (admin)',
                'GET /api/admin/config - Get full admin configuration (admin)',
                'PUT /api/admin/config - Update full admin configuration (admin)',
                'GET /api/admin/features - Get feature toggles (admin)',
                'PUT /api/admin/features - Update feature toggles (admin)',
                'GET /api/admin/defaults - Get default user settings (admin)',
                'PUT /api/admin/defaults - Update default user settings (admin)',
                'GET /api/admin/ui - Get UI controls (admin)',
                'PUT /api/admin/ui - Update UI controls (admin)',
                'GET /api/thumbnails/{filename} - Get game thumbnails (legacy)',
                'GET /api/assets/{path} - Get any frontend asset (JS, CSS, images, JSON)',
                'GET /proxy?url= - Proxy requests',
                'GET /health - Health check'
            ],
            assetEndpoints: [
                'GET /api/assets/app.js - Main application JavaScript (auto-configured)',
                'GET /api/assets/styles.css - Application styles',
                'GET /api/assets/games.json - Games database',
                'GET /api/assets/logo.png - Site logo',
                'GET /api/thumbnails/cookieclicker.jpg - Game thumbnails'
            ]
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                ...getCORSHeaders()
            }
        });
    }
};

// Wrapper to ensure the monkey patched handleAPIRequest (extended social layer) is invoked safely
async function routeAPIRequest(request, url, env, ctx) {
    try {
        return await handleAPIRequest(request, url, env, ctx);
    } catch (e) {
        console.error('routeAPIRequest fatal error', e);
        return new Response(JSON.stringify({ error: 'Internal routing error' }), { status: 500, headers: { 'Content-Type': 'application/json', ...getCORSHeaders() } });
    }
}

// Handle API requests
async function handleAPIRequest(request, url, env, ctx) {
    const path = url.pathname.replace('/api', '');
    const method = request.method;
    
    try {
        // Health check endpoint
        if (path === '/health') {
            return handleHealthAPI(request, env);
        }
        
        // Games endpoint
        if (path === '/games') {
            return handleGamesAPI(request, env);
        }
        
        // Configuration endpoint
        if (path === '/config') {
            return handleConfigAPI(request, env);
        }
        
        // Version and update check endpoint
        if (path === '/version') {
            return handleVersionAPI(request, env);
        }
        
        // Maintenance mode endpoint
        if (path === '/maintenance') {
            return handleMaintenanceAPI(request, env);
        }
        
        // Admin Configuration Management Endpoints
        if (path === '/admin/config') {
            return handleAdminConfigAPI(request, env);
        }
        
        if (path === '/admin/features') {
            return handleAdminFeaturesAPI(request, env);
        }
        
        if (path === '/admin/defaults') {
            return handleAdminDefaultsAPI(request, env);
        }
        
        if (path === '/admin/ui') {
            return handleAdminUIAPI(request, env);
        }
        
        // Thumbnails endpoint (legacy)
        if (path.startsWith('/thumbnails/')) {
            return handleThumbnailAPI(request, url, env);
        }
        
        // Universal assets endpoint
        if (path.startsWith('/assets/')) {
            return handleAssetAPI(request, url, env);
        }
        
        // Stats endpoint
        if (path === '/stats') {
            return handleStatsAPI(request, env);
        }
        
        // Unknown API endpoint
        return new Response(JSON.stringify({
            error: 'API endpoint not found',
            path: path
        }), {
            status: 404,
            headers: {
                'Content-Type': 'application/json',
                ...getCORSHeaders()
            }
        });
        
    } catch (error) {
        console.error('API Error:', error);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: error.message
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
                ...getCORSHeaders()
            }
        });
    }
}

// Handle proxy requests
async function handleProxy(request, url) {
    try {
        // Get the target URL from query parameters
        const targetUrl = url.searchParams.get('url');
        
        if (!targetUrl) {
            return new Response('Missing URL parameter', {
                status: 400,
                headers: getCORSHeaders()
            });
        }
        
        // Validate the target URL
        if (!isValidUrl(targetUrl)) {
            return new Response('Invalid URL', {
                status: 400,
                headers: getCORSHeaders()
            });
        }
        
        // Parse the target URL to get base information
        const targetUrlObj = new URL(targetUrl);
        const baseUrl = `${targetUrlObj.protocol}//${targetUrlObj.host}`;
        
        // Create a new request to the target URL
        const targetRequest = new Request(targetUrl, {
            method: request.method,
            headers: getProxyHeaders(request, targetUrlObj),
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
            redirect: 'manual' // Handle redirects manually to rewrite Location headers
        });
        
        // Fetch the target resource
        const response = await fetch(targetRequest);
        
        // Log the request
        logRequest(request, targetUrl, response.status);
        
        // Get the content type
        const contentType = response.headers.get('content-type') || '';
        
        // Process the response based on content type
        let processedBody = response.body;
        
        if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
            // Process HTML content
            const htmlContent = await response.text();
            processedBody = rewriteHTML(htmlContent, baseUrl, request.url.split('/proxy')[0]);
        } else if (contentType.includes('text/css')) {
            // Process CSS content
            const cssContent = await response.text();
            processedBody = rewriteCSS(cssContent, baseUrl, request.url.split('/proxy')[0]);
        } else if (contentType.includes('application/javascript') || 
                   contentType.includes('text/javascript') || 
                   contentType.includes('application/x-javascript') ||
                   contentType.includes('text/ecmascript') ||
                   contentType.includes('application/ecmascript')) {
            // Process JavaScript content
            const jsContent = await response.text();
            processedBody = rewriteJavaScript(jsContent, baseUrl, request.url.split('/proxy')[0]);
        } else if (contentType.includes('text/') && !contentType.includes('text/plain')) {
            // Process other text content that might contain URLs
            const textContent = await response.text();
            // Basic URL replacement for other text formats
            processedBody = textContent.replace(/(https?:\/\/[^\s"'<>]+)/gi, (match) => {
                try {
                    const urlObj = new URL(match);
                    const baseObj = new URL(baseUrl);
                    if (urlObj.origin !== baseObj.origin) {
                        return `${request.url.split('/proxy')[0]}/proxy?url=${encodeURIComponent(match)}`;
                    }
                } catch (e) {
                    // Ignore invalid URLs
                }
                return match;
            });
        } else if (contentType.includes('application/json') || contentType.includes('application/manifest+json')) {
            // Process JSON content that might contain URLs (like web app manifests)
            try {
                const jsonContent = await response.text();
                const jsonData = JSON.parse(jsonContent);
                const rewrittenJson = rewriteJsonUrls(jsonData, baseUrl, request.url.split('/proxy')[0]);
                processedBody = JSON.stringify(rewrittenJson);
            } catch (e) {
                // If JSON parsing fails, pass through unchanged
                console.error('JSON parsing error:', e);
                processedBody = response.body;
            }
        }
        
        // Create response with modified headers
        const modifiedResponse = new Response(processedBody, {
            status: response.status,
            statusText: response.statusText,
            headers: getResponseHeaders(response, request.url.split('/proxy')[0])
        });
        
        return modifiedResponse;
        
    } catch (error) {
        console.error('Proxy error:', error);
        console.error('Target URL:', targetUrl);
        console.error('Request method:', request.method);
        console.error('Request headers:', Array.from(request.headers.entries()));
        
        return new Response(`Proxy Error: ${error.message}\nTarget URL: ${targetUrl}`, {
            status: 500,
            headers: getCORSHeaders()
        });
    }
}

// Get headers for proxied requests
function getProxyHeaders(originalRequest, targetUrl) {
    const headers = new Headers();
    
    // Copy safe headers from original request
    const safeHeaders = [
        'accept',
        'accept-language',
        'content-type',
        'user-agent',
        'accept-encoding',
        'cache-control'
    ];
    
    safeHeaders.forEach(header => {
        const value = originalRequest.headers.get(header);
        if (value) {
            headers.set(header, value);
        }
    });
    
    // Set custom headers for better compatibility
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8');
    headers.set('Accept-Language', 'en-US,en;q=0.9');
    headers.set('Accept-Encoding', 'gzip, deflate, br');
    
    // Set referer to the target domain for better compatibility
    if (targetUrl) {
        headers.set('Referer', `${targetUrl.protocol}//${targetUrl.host}/`);
    }
    
    // Remove problematic headers
    headers.delete('origin');
    headers.delete('sec-fetch-site');
    headers.delete('sec-fetch-mode');
    headers.delete('sec-fetch-dest');
    headers.delete('sec-ch-ua');
    headers.delete('sec-ch-ua-mobile');
    headers.delete('sec-ch-ua-platform');
    
    return headers;
}

// Get response headers with CORS and security modifications
function getResponseHeaders(response, proxyBase) {
    const headers = new Headers();
    
    // Copy content headers
    const contentHeaders = [
        'content-type',
        'content-length',
        'content-encoding',
        'content-disposition',
        'cache-control',
        'expires',
        'last-modified',
        'etag',
        'set-cookie'
    ];
    
    contentHeaders.forEach(header => {
        const value = response.headers.get(header);
        if (value) {
            // Handle Set-Cookie headers specially to preserve multiple values
            if (header === 'set-cookie') {
                const cookies = response.headers.getSetCookie?.() || [value];
                cookies.forEach(cookie => {
                    headers.append('set-cookie', cookie);
                });
            } else {
                headers.set(header, value);
            }
        }
    });
    
    // Handle Location header for redirects
    const location = response.headers.get('location');
    if (location && proxyBase) {
        try {
            const locationUrl = new URL(location, response.url);
            headers.set('location', `${proxyBase}/proxy?url=${encodeURIComponent(locationUrl.href)}`);
        } catch (e) {
            headers.set('location', location);
        }
    }
    
    // Add CORS headers
    Object.entries(getCORSHeaders()).forEach(([key, value]) => {
        headers.set(key, value);
    });
    
    // Remove security headers that might block iframe embedding or loading
    headers.delete('x-frame-options');
    headers.delete('content-security-policy');
    headers.delete('x-content-type-options');
    headers.delete('strict-transport-security');
    headers.delete('x-xss-protection');
    headers.delete('referrer-policy');
    
    // Modify content security policy if present
    const csp = response.headers.get('content-security-policy');
    if (csp) {
        // Remove restrictive CSP directives
        let modifiedCSP = csp
            .replace(/frame-ancestors[^;]*;?/gi, '')
            .replace(/frame-src[^;]*;?/gi, '')
            .replace(/child-src[^;]*;?/gi, '')
            .replace(/connect-src[^;]*;?/gi, '')
            .replace(/script-src[^;]*;?/gi, '')
            .replace(/style-src[^;]*;?/gi, '');
        
        if (modifiedCSP.trim() && modifiedCSP !== csp) {
            headers.set('content-security-policy', modifiedCSP);
        } else if (modifiedCSP.trim()) {
            headers.delete('content-security-policy');
        }
    }
    
    return headers;
}

// Get CORS headers
function getCORSHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, HEAD, PATCH',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Accept-Language, Content-Language, Range',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type, Date, Server, Transfer-Encoding, X-Powered-By',
    // Credentials not allowed with wildcard origin; remove to prevent browser warnings
        'Access-Control-Max-Age': '86400'
    };
}

// Handle CORS preflight requests
function handleCORS() {
    return new Response(null, {
        status: 204,
        headers: getCORSHeaders()
    });
}

// Validate URL
function isValidUrl(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
        return false;
    }
}

// Rewrite HTML content to route resources through proxy
function rewriteHTML(html, baseUrl, proxyBase) {
    // Create a function to convert URLs to proxy URLs
    const rewriteUrl = (url) => {
        if (!url || url.trim() === '' || url.startsWith('data:') || url.startsWith('javascript:') || url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('#') || url.startsWith('about:')) {
            return url;
        }
        
        let absoluteUrl;
        try {
            if (url.startsWith('//')) {
                // Protocol-relative URL
                const baseUrlObj = new URL(baseUrl);
                absoluteUrl = `${baseUrlObj.protocol}${url}`;
            } else if (url.startsWith('http://') || url.startsWith('https://')) {
                // Absolute URL
                absoluteUrl = url;
            } else {
                // Relative URL
                absoluteUrl = new URL(url, baseUrl).href;
            }
            return `${proxyBase}/proxy?url=${encodeURIComponent(absoluteUrl)}`;
        } catch (e) {
            console.error('URL rewrite error:', e, 'for URL:', url);
            return url;
        }
    };
    
    // More comprehensive attribute rewriting with better regex
    // Handle src attributes
    html = html.replace(/(<(?:img|script|iframe|embed|object|source|track|audio|video|input)[^>]*\s+src\s*=\s*["'])([^"']+)(["'])/gi, 
        (match, prefix, url, suffix) => {
            return prefix + rewriteUrl(url.trim()) + suffix;
        });
    
    // Handle href attributes
    html = html.replace(/(<(?:link|a|area)[^>]*\s+href\s*=\s*["'])([^"']+)(["'])/gi, 
        (match, prefix, url, suffix) => {
            return prefix + rewriteUrl(url.trim()) + suffix;
        });
    
    // Handle data attributes (for lazy loading)
    html = html.replace(/(<[^>]*\s+data-(?:src|href|url|bg|background|lazy|original)\s*=\s*["'])([^"']+)(["'])/gi, 
        (match, prefix, url, suffix) => {
            return prefix + rewriteUrl(url.trim()) + suffix;
        });
    
    // Handle action attributes in forms
    html = html.replace(/(<form[^>]*\s+action\s*=\s*["'])([^"']+)(["'])/gi, 
        (match, prefix, url, suffix) => {
            return prefix + rewriteUrl(url.trim()) + suffix;
        });
    
    // Handle poster attributes in video tags
    html = html.replace(/(<video[^>]*\s+poster\s*=\s*["'])([^"']+)(["'])/gi, 
        (match, prefix, url, suffix) => {
            return prefix + rewriteUrl(url.trim()) + suffix;
        });
    
        // Handle manifest and service worker attributes
        html = html.replace(/(<link[^>]*\s+rel\s*=\s*["']manifest["'][^>]*\s+href\s*=\s*["'])([^"']+)(["'])/gi, 
            (match, prefix, url, suffix) => {
                return prefix + rewriteUrl(url.trim()) + suffix;
            });
        
        // Handle service worker registrations in script tags
        html = html.replace(/navigator\.serviceWorker\.register\s*\(\s*["']([^"']+)["']/gi, (match, url) => {
            return match.replace(url, rewriteUrl(url));
        });    // Handle style attributes with URLs
    html = html.replace(/style\s*=\s*["']([^"']*?)["']/gi, (match, style) => {
        const rewrittenStyle = rewriteCSS(style, baseUrl, proxyBase);
        return `style="${rewrittenStyle.replace(/"/g, '&quot;')}"`;
    });
    
    // Handle inline CSS in style tags
    html = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, css) => {
        const rewrittenCSS = rewriteCSS(css, baseUrl, proxyBase);
        return match.replace(css, rewrittenCSS);
    });
    
    // Handle meta refresh redirects
    html = html.replace(/(<meta[^>]*http-equiv\s*=\s*["']refresh["'][^>]*content\s*=\s*["'][^;]*;\s*url\s*=\s*)([^"']+)(["'][^>]*>)/gi,
        (match, prefix, url, suffix) => {
            return prefix + rewriteUrl(url.trim()) + suffix;
        });
    
    // Add base tag to handle relative URLs better (if not already present)
    if (!html.toLowerCase().includes('<base')) {
        html = html.replace(/<head[^>]*>/i, 
            `$&\n<base href="${baseUrl}/">`);
    }
    
    // Inject comprehensive JavaScript to intercept and rewrite dynamic requests
    const injectedScript = `
    <script>
    (function() {
        const proxyBase = '${proxyBase}';
        const baseUrl = '${baseUrl}';
        
        // Helper function to rewrite URLs
        function rewriteUrl(url) {
            if (!url || typeof url !== 'string' || 
                url.startsWith('data:') || url.startsWith('blob:') || 
                url.startsWith('javascript:') || url.startsWith('mailto:') || 
                url.startsWith('tel:') || url.startsWith('#') || url.startsWith('about:')) {
                return url;
            }
            
            try {
                let absoluteUrl;
                if (url.startsWith('//')) {
                    const baseUrlObj = new URL(baseUrl);
                    absoluteUrl = baseUrlObj.protocol + url;
                } else if (url.startsWith('http://') || url.startsWith('https://')) {
                    absoluteUrl = url;
                } else {
                    absoluteUrl = new URL(url, baseUrl).href;
                }
                return proxyBase + '/proxy?url=' + encodeURIComponent(absoluteUrl);
            } catch (e) {
                return url;
            }
        }
        
        // Store original functions
        const originalFetch = window.fetch;
        const originalOpen = XMLHttpRequest.prototype.open;
        const originalWindowOpen = window.open;
        const originalSetAttribute = Element.prototype.setAttribute;
        const originalAppendChild = Node.prototype.appendChild;
        const originalInsertBefore = Node.prototype.insertBefore;
        const originalReplaceChild = Node.prototype.replaceChild;
        
        // Override fetch
        window.fetch = function(input, init) {
            if (typeof input === 'string') {
                input = rewriteUrl(input);
            } else if (input && typeof input === 'object' && input.url) {
                input.url = rewriteUrl(input.url);
            }
            return originalFetch.call(this, input, init);
        };
        
        // Override XMLHttpRequest
        XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
            url = rewriteUrl(url);
            return originalOpen.call(this, method, url, async, user, password);
        };
        
        // Override window.open
        window.open = function(url, name, specs) {
            if (url) {
                url = rewriteUrl(url);
            }
            return originalWindowOpen.call(this, url, name, specs);
        };
        
        // Override setAttribute to catch dynamically set URLs
        Element.prototype.setAttribute = function(name, value) {
            if (typeof value === 'string' && 
                (name === 'src' || name === 'href' || name === 'action' || 
                 name.startsWith('data-src') || name.startsWith('data-href') || 
                 name.startsWith('data-url') || name.startsWith('data-lazy'))) {
                value = rewriteUrl(value);
            }
            return originalSetAttribute.call(this, name, value);
        };
        
        // Override DOM manipulation methods to catch dynamically added elements
        function rewriteElementUrls(element) {
            if (element && element.nodeType === 1) { // Element node
                const urlAttrs = ['src', 'href', 'action', 'poster', 'background'];
                urlAttrs.forEach(attr => {
                    if (element.hasAttribute && element.hasAttribute(attr)) {
                        const url = element.getAttribute(attr);
                        if (url) {
                            element.setAttribute(attr, rewriteUrl(url));
                        }
                    }
                });
                
                // Handle data attributes
                if (element.attributes) {
                    for (let i = 0; i < element.attributes.length; i++) {
                        const attr = element.attributes[i];
                        if (attr.name.startsWith('data-') && 
                            (attr.name.includes('src') || attr.name.includes('href') || 
                             attr.name.includes('url') || attr.name.includes('lazy'))) {
                            element.setAttribute(attr.name, rewriteUrl(attr.value));
                        }
                    }
                }
                
                // Recursively process child nodes
                if (element.children) {
                    for (let child of element.children) {
                        rewriteElementUrls(child);
                    }
                }
            }
        }
        
        Node.prototype.appendChild = function(newChild) {
            rewriteElementUrls(newChild);
            return originalAppendChild.call(this, newChild);
        };
        
        Node.prototype.insertBefore = function(newChild, referenceChild) {
            rewriteElementUrls(newChild);
            return originalInsertBefore.call(this, newChild, referenceChild);
        };
        
        Node.prototype.replaceChild = function(newChild, oldChild) {
            rewriteElementUrls(newChild);
            return originalReplaceChild.call(this, newChild, oldChild);
        };
        
        // Override location changes
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = function(state, title, url) {
            if (url) url = rewriteUrl(url);
            return originalPushState.call(this, state, title, url);
        };
        
        history.replaceState = function(state, title, url) {
            if (url) url = rewriteUrl(url);
            return originalReplaceState.call(this, state, title, url);
        };
        
        // Handle dynamic script and link creation
        const originalCreateElement = document.createElement;
        document.createElement = function(tagName) {
            const element = originalCreateElement.call(this, tagName);
            
            if (tagName.toLowerCase() === 'script' || tagName.toLowerCase() === 'link' || 
                tagName.toLowerCase() === 'img' || tagName.toLowerCase() === 'iframe') {
                
                const originalSetSrc = element.__lookupSetter__ ? element.__lookupSetter__('src') : null;
                const originalSetHref = element.__lookupSetter__ ? element.__lookupSetter__('href') : null;
                
                if (originalSetSrc) {
                    Object.defineProperty(element, 'src', {
                        set: function(value) {
                            originalSetSrc.call(this, rewriteUrl(value));
                        },
                        get: function() {
                            return element.getAttribute('src');
                        }
                    });
                }
                
                if (originalSetHref) {
                    Object.defineProperty(element, 'href', {
                        set: function(value) {
                            originalSetHref.call(this, rewriteUrl(value));
                        },
                        get: function() {
                            return element.getAttribute('href');
                        }
                    });
                }
            }
            
            return element;
        };
        
        // Monitor for dynamically loaded content
        if (window.MutationObserver) {
            const observer = new MutationObserver(function(mutations) {
                mutations.forEach(function(mutation) {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach(function(node) {
                            rewriteElementUrls(node);
                        });
                    }
                });
            });
            
            observer.observe(document.body || document.documentElement, {
                childList: true,
                subtree: true
            });
        }
        
        console.log('WaterWall proxy intercepts initialized');
    })();
    </script>`;
    
    // Insert the script before </head> if possible, otherwise before </body>
    if (html.includes('</head>')) {
        html = html.replace(/<\/head>/i, injectedScript + '$&');
    } else if (html.includes('</body>')) {
        html = html.replace(/<\/body>/i, injectedScript + '$&');
    } else {
        html = html + injectedScript;
    }
    
    return html;
}

// Rewrite CSS content to route resources through proxy
function rewriteCSS(css, baseUrl, proxyBase) {
    // Rewrite url() functions in CSS (including various quote styles)
    css = css.replace(/url\s*\(\s*(['"]?)([^'")\s]+)\1\s*\)/gi, (match, quote, url) => {
        if (url.startsWith('data:') || url.startsWith('#') || url.startsWith('javascript:')) {
            return match;
        }
        
        try {
            let absoluteUrl;
            if (url.startsWith('//')) {
                const baseUrlObj = new URL(baseUrl);
                absoluteUrl = `${baseUrlObj.protocol}${url}`;
            } else if (url.startsWith('http://') || url.startsWith('https://')) {
                absoluteUrl = url;
            } else {
                absoluteUrl = new URL(url, baseUrl).href;
            }
            return `url(${quote}${proxyBase}/proxy?url=${encodeURIComponent(absoluteUrl)}${quote})`;
        } catch (e) {
            console.error('CSS URL rewrite error:', e, 'for URL:', url);
            return match;
        }
    });
    
    // Rewrite @import statements (various formats)
    css = css.replace(/@import\s+(['"])([^'"]+)\1/gi, (match, quote, url) => {
        if (url.startsWith('data:')) {
            return match;
        }
        
        try {
            let absoluteUrl;
            if (url.startsWith('//')) {
                const baseUrlObj = new URL(baseUrl);
                absoluteUrl = `${baseUrlObj.protocol}${url}`;
            } else if (url.startsWith('http://') || url.startsWith('https://')) {
                absoluteUrl = url;
            } else {
                absoluteUrl = new URL(url, baseUrl).href;
            }
            return `@import ${quote}${proxyBase}/proxy?url=${encodeURIComponent(absoluteUrl)}${quote}`;
        } catch (e) {
            console.error('CSS @import rewrite error:', e, 'for URL:', url);
            return match;
        }
    });
    
    // Handle @import url() format
    css = css.replace(/@import\s+url\s*\(\s*(['"]?)([^'")\s]+)\1\s*\)/gi, (match, quote, url) => {
        if (url.startsWith('data:')) {
            return match;
        }
        
        try {
            let absoluteUrl;
            if (url.startsWith('//')) {
                const baseUrlObj = new URL(baseUrl);
                absoluteUrl = `${baseUrlObj.protocol}${url}`;
            } else if (url.startsWith('http://') || url.startsWith('https://')) {
                absoluteUrl = url;
            } else {
                absoluteUrl = new URL(url, baseUrl).href;
            }
            return `@import url(${quote}${proxyBase}/proxy?url=${encodeURIComponent(absoluteUrl)}${quote})`;
        } catch (e) {
            console.error('CSS @import url() rewrite error:', e, 'for URL:', url);
            return match;
        }
    });
    
    // Handle CSS custom properties with URLs
    css = css.replace(/(--[^:]+:\s*[^;]*url\s*\(\s*)(['"]?)([^'")\s]+)\2(\s*\))/gi, (match, prefix, quote, url, suffix) => {
        if (url.startsWith('data:') || url.startsWith('#')) {
            return match;
        }
        
        try {
            let absoluteUrl;
            if (url.startsWith('//')) {
                const baseUrlObj = new URL(baseUrl);
                absoluteUrl = `${baseUrlObj.protocol}${url}`;
            } else if (url.startsWith('http://') || url.startsWith('https://')) {
                absoluteUrl = url;
            } else {
                absoluteUrl = new URL(url, baseUrl).href;
            }
            return `${prefix}${quote}${proxyBase}/proxy?url=${encodeURIComponent(absoluteUrl)}${quote}${suffix}`;
        } catch (e) {
            return match;
        }
    });
    
    return css;
}

// Rewrite JavaScript content to handle dynamic requests
function rewriteJavaScript(js, baseUrl, proxyBase) {
    // This is a basic implementation - full JS rewriting would require AST parsing
    
    // Replace string literals that look like URLs (be conservative to avoid breaking code)
    js = js.replace(/(["'])(https?:\/\/[^"']+)\1/gi, (match, quote, url) => {
        try {
            // Only rewrite if it's clearly a different domain
            const urlObj = new URL(url);
            const baseObj = new URL(baseUrl);
            if (urlObj.origin !== baseObj.origin) {
                return `${quote}${proxyBase}/proxy?url=${encodeURIComponent(url)}${quote}`;
            }
        } catch (e) {
            // If URL parsing fails, leave it unchanged
        }
        return match;
    });
    
    // Replace common AJAX patterns more carefully
    js = js.replace(/(\.open\s*\(\s*["'][^"']*["']\s*,\s*["'])([^"']+)(["'])/gi, (match, prefix, url, suffix) => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            try {
                const urlObj = new URL(url);
                const baseObj = new URL(baseUrl);
                if (urlObj.origin !== baseObj.origin) {
                    return `${prefix}${proxyBase}/proxy?url=${encodeURIComponent(url)}${suffix}`;
                }
            } catch (e) {
                // Ignore parsing errors
            }
        }
        return match;
    });
    
    // Handle fetch calls with string URLs
    js = js.replace(/(fetch\s*\(\s*["'])([^"']+)(["'])/gi, (match, prefix, url, suffix) => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            try {
                const urlObj = new URL(url);
                const baseObj = new URL(baseUrl);
                if (urlObj.origin !== baseObj.origin) {
                    return `${prefix}${proxyBase}/proxy?url=${encodeURIComponent(url)}${suffix}`;
                }
            } catch (e) {
                // Ignore parsing errors
            }
        }
        return match;
    });
    
    return js;
}

// Rewrite URLs in JSON content (like web app manifests)
function rewriteJsonUrls(obj, baseUrl, proxyBase) {
    if (typeof obj === 'string') {
        // Check if it's a URL
        if (obj.startsWith('http://') || obj.startsWith('https://') || obj.startsWith('//') || obj.startsWith('/')) {
            try {
                let absoluteUrl;
                if (obj.startsWith('//')) {
                    const baseUrlObj = new URL(baseUrl);
                    absoluteUrl = `${baseUrlObj.protocol}${obj}`;
                } else if (obj.startsWith('http://') || obj.startsWith('https://')) {
                    absoluteUrl = obj;
                } else if (obj.startsWith('/')) {
                    absoluteUrl = new URL(obj, baseUrl).href;
                } else {
                    return obj; // Not a URL
                }
                return `${proxyBase}/proxy?url=${encodeURIComponent(absoluteUrl)}`;
            } catch (e) {
                return obj;
            }
        }
        return obj;
    } else if (Array.isArray(obj)) {
        return obj.map(item => rewriteJsonUrls(item, baseUrl, proxyBase));
    } else if (obj && typeof obj === 'object') {
        const rewritten = {};
        for (const [key, value] of Object.entries(obj)) {
            rewritten[key] = rewriteJsonUrls(value, baseUrl, proxyBase);
        }
        return rewritten;
    }
    return obj;
}

// Rate limiting (optional)
class RateLimiter {
    constructor() {
        this.requests = new Map();
    }
    
    isAllowed(ip, limit = 100, window = 60000) {
        const now = Date.now();
        const windowStart = now - window;
        
        if (!this.requests.has(ip)) {
            this.requests.set(ip, []);
        }
        
        const requestTimes = this.requests.get(ip);
        
        // Remove old requests outside the window
        const validRequests = requestTimes.filter(time => time > windowStart);
        
        if (validRequests.length >= limit) {
            return false;
        }
        
        validRequests.push(now);
        this.requests.set(ip, validRequests);
        
        return true;
    }
}

// Create rate limiter instance
const rateLimiter = new RateLimiter();

// Add logging helper
function logRequest(request, targetUrl, status) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    console.log(`[${new Date().toISOString()}] ${ip} ${request.method} ${targetUrl} -> ${status} (UA: ${userAgent.substring(0, 50)})`);
}

// API Handler Functions

// Handle health check API
async function handleHealthAPI(request, env) {
    const healthData = {
        status: 'OK',
        version: APP_VERSION,
        timestamp: new Date().toISOString(),
        uptime: 'N/A', // Cloudflare Workers don't have persistent uptime
        services: {
            database: 'OK',
            api: 'OK'
        },
        games_count: GAMES_DATABASE.length
    };

    return new Response(JSON.stringify(healthData), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            ...getCORSHeaders()
        }
    });
}

// Handle games API
async function handleGamesAPI(request, env) {
    // Add cache headers
    const headers = {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${GAMES_CACHE_TTL}`,
        ...getCORSHeaders()
    };
    
    return new Response(JSON.stringify(GAMES_DATABASE), {
        status: 200,
        headers
    });
}

// Handle configuration API
async function handleConfigAPI(request, env) {
    // Get the comprehensive admin configuration
    let config = { ...DEFAULT_CONFIG };
    
    try {
        // Try new admin config system first
        if (env.WATERWALL_KV) {
            const adminConfig = await env.WATERWALL_KV.get('admin_config');
            if (adminConfig) {
                const parsed = JSON.parse(adminConfig);
                config = { ...config, ...parsed };
            }
        }
        
        // Fallback to legacy config system
        if (env.CONFIG_KV) {
            const legacyConfig = await env.CONFIG_KV.get('app_config', 'json');
            if (legacyConfig) {
                config = { ...config, ...legacyConfig };
            }
        }
    } catch (error) {
        console.error('Error fetching config from KV:', error);
        // Fall back to default config
    }
    
    const headers = {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${CONFIG_CACHE_TTL}`,
        ...getCORSHeaders()
    };
    
    return new Response(JSON.stringify(config), {
        status: 200,
        headers
    });
}

// Handle version API and update checking
async function handleVersionAPI(request, env) {
    const url = new URL(request.url);
    const clientVersion = url.searchParams.get('client') || '1.0.0';
    
    const serverVersion = APP_VERSION;
    const needsUpdate = compareVersions(serverVersion, clientVersion) > 0;
    
    const versionInfo = {
        server: serverVersion,
        client: clientVersion,
        needsUpdate,
        updateAvailable: needsUpdate,
        updateMessage: needsUpdate ? 
            `A new version (${serverVersion}) is available! Please refresh to get the latest features and improvements.` : 
            'You are running the latest version.',
        releaseNotes: needsUpdate ? [
            'Enhanced backend integration',
            'Improved performance and stability',
            'New dynamic content loading',
            'Better error handling'
        ] : [],
        timestamp: new Date().toISOString()
    };
    
    const headers = {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${VERSION_ENDPOINT_CACHE_TTL}`,
        ...getCORSHeaders()
    };
    
    return new Response(JSON.stringify(versionInfo), {
        status: 200,
        headers
    });
}

// Handle maintenance API
async function handleMaintenanceAPI(request, env) {
    if (request.method === 'GET') {
        // Get maintenance status from new admin config system
        let maintenanceConfig = DEFAULT_CONFIG.maintenanceMode;
        
        try {
            // Try new admin config system first
            if (env.WATERWALL_KV) {
                const adminConfig = await env.WATERWALL_KV.get('admin_config');
                if (adminConfig) {
                    const parsed = JSON.parse(adminConfig);
                    if (parsed.maintenanceMode) {
                        maintenanceConfig = parsed.maintenanceMode;
                    }
                }
            }
            
            // Fallback to legacy config system
            if (env.CONFIG_KV) {
                const config = await env.CONFIG_KV.get('app_config', 'json');
                if (config && config.maintenanceMode) {
                    maintenanceConfig = config.maintenanceMode;
                }
            }
        } catch (error) {
            console.error('Error fetching maintenance config:', error);
        }
        
        return new Response(JSON.stringify(maintenanceConfig), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                ...getCORSHeaders()
            }
        });
        
    } else if (request.method === 'PUT') {
        // Update maintenance status (admin endpoint)
        try {
            const body = await request.json();
            
            if (!env.WATERWALL_KV && !env.CONFIG_KV) {
                return new Response(JSON.stringify({
                    error: 'Configuration storage not available'
                }), {
                    status: 503,
                    headers: {
                        'Content-Type': 'application/json',
                        ...getCORSHeaders()
                    }
                });
            }
            
            // Get current admin config
            let config = { ...DEFAULT_CONFIG };
            
            if (env.WATERWALL_KV) {
                const adminConfig = await env.WATERWALL_KV.get('admin_config');
                if (adminConfig) {
                    config = { ...config, ...JSON.parse(adminConfig) };
                }
            } else if (env.CONFIG_KV) {
                // Fallback to legacy system
                const existingConfig = await env.CONFIG_KV.get('app_config', 'json');
                if (existingConfig) {
                    config = { ...config, ...existingConfig };
                }
            }
            
            // Update maintenance mode
            config.maintenanceMode = {
                ...config.maintenanceMode,
                ...body
            };
            
            // Save to preferred KV (new admin config system)
            if (env.WATERWALL_KV) {
                await env.WATERWALL_KV.put('admin_config', JSON.stringify(config));
            } else if (env.CONFIG_KV) {
                await env.CONFIG_KV.put('app_config', JSON.stringify(config));
            }
            
            console.log('✅ Maintenance mode updated:', config.maintenanceMode.enabled ? 'ENABLED' : 'DISABLED');
            
            return new Response(JSON.stringify(config.maintenanceMode), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    ...getCORSHeaders()
                }
            });
            
        } catch (error) {
            return new Response(JSON.stringify({
                error: 'Invalid request body'
            }), {
                status: 400,
                headers: {
                    'Content-Type': 'application/json',
                    ...getCORSHeaders()
                }
            });
        }
    }
    
    return new Response(JSON.stringify({
        error: 'Method not allowed'
    }), {
        status: 405,
        headers: {
            'Content-Type': 'application/json',
            ...getCORSHeaders()
        }
    });
}

// Handle thumbnail API
async function handleThumbnailAPI(request, url, env) {
    const filename = url.pathname.split('/').pop();
    
    if (!filename || !THUMBNAIL_MAPPINGS[filename]) {
        return new Response('Thumbnail not found', {
            status: 404,
            headers: getCORSHeaders()
        });
    }
    
    try {
        // Fetch the actual thumbnail
        const thumbnailUrl = THUMBNAIL_MAPPINGS[filename];
        const response = await fetch(thumbnailUrl);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch thumbnail: ${response.status}`);
        }
        
        // Create new response with proper headers
        const headers = {
            'Content-Type': response.headers.get('Content-Type') || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400', // 24 hours
            'Access-Control-Allow-Origin': '*'
        };
        
        return new Response(response.body, {
            status: 200,
            headers
        });
        
    } catch (error) {
        console.error('Thumbnail fetch error:', error);
        
        // Return a placeholder image or error
        return new Response('Failed to load thumbnail', {
            status: 500,
            headers: getCORSHeaders()
        });
    }
}

// Handle universal assets API - serves all frontend assets from backend
async function handleAssetAPI(request, url, env) {
    const assetPath = url.pathname.replace('/api/', ''); // Remove /api/ prefix
    const asset = ASSET_MAPPINGS[assetPath];
    
    if (!asset) {
        return new Response('Asset not found', {
            status: 404,
            headers: getCORSHeaders()
        });
    }
    
    try {
        // Add cache-busting for frequently updated assets
        const cacheKey = `asset-${assetPath}-${Date.now()}`;
        const cacheControl = `public, max-age=${asset.maxAge}`;
        
        // Check if this is a dynamic request with version parameter
        const urlParams = new URLSearchParams(url.search);
        const versionParam = urlParams.get('v');
        let sourceUrl = asset.url;
        
        // For JS/CSS/JSON, add cache busting if version param present
        if (versionParam && (asset.contentType.includes('javascript') || 
                           asset.contentType.includes('css') || 
                           asset.contentType.includes('json'))) {
            sourceUrl += `?v=${versionParam}`;
        }
        
        // Fetch the asset
        const response = await fetch(sourceUrl);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch asset: ${response.status}`);
        }
        
        // For app.js, inject the backend URL dynamically
        let responseBody = response.body;
        if (assetPath === 'assets/app.js') {
            const text = await response.text();
            const backendUrl = `${url.protocol}//${url.host}`;
            const modifiedText = text.replace(
                /const BACKEND_URL = ['"`][^'"`]*['"`];?/g,
                `const BACKEND_URL = '${backendUrl}';`
            );
            responseBody = modifiedText;
        }
        
        // Create response with optimized headers
        const headers = {
            'Content-Type': asset.contentType,
            'Cache-Control': cacheControl,
            'Access-Control-Allow-Origin': '*',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'SAMEORIGIN'
        };
        
        // Add ETag for better caching
        if (versionParam) {
            headers['ETag'] = `"${versionParam}"`;
        }
        
        return new Response(responseBody, {
            status: 200,
            headers
        });
        
    } catch (error) {
        console.error('Asset fetch error:', error);
        
        return new Response(`Failed to load asset: ${assetPath}`, {
            status: 500,
            headers: getCORSHeaders()
        });
    }
}

// Handle stats API
async function handleStatsAPI(request, env) {
    const stats = {
        totalGames: GAMES_DATABASE.length,
        categories: [...new Set(GAMES_DATABASE.map(game => game.category))],
        categoryCount: [...new Set(GAMES_DATABASE.map(game => game.category))].length,
        serverVersion: APP_VERSION,
        timestamp: new Date().toISOString(),
        gamesByCategory: GAMES_DATABASE.reduce((acc, game) => {
            acc[game.category] = (acc[game.category] || 0) + 1;
            return acc;
        }, {})
    };
    
    return new Response(JSON.stringify(stats), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Cache-Control': `public, max-age=${CONFIG_CACHE_TTL}`,
            ...getCORSHeaders()
        }
    });
}

// ===== ADMIN CONFIGURATION API HANDLERS =====

// Handle comprehensive admin configuration API
async function handleAdminConfigAPI(request, env) {
    if (request.method === 'GET') {
        // Get full admin configuration
        try {
            let config = DEFAULT_CONFIG;
            
            if (env.WATERWALL_KV) {
                const storedConfig = await env.WATERWALL_KV.get('admin_config');
                if (storedConfig) {
                    const parsed = JSON.parse(storedConfig);
                    config = { ...DEFAULT_CONFIG, ...parsed };
                }
            }
            
            return new Response(JSON.stringify(config), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': `public, max-age=${CONFIG_CACHE_TTL}`,
                    ...getCORSHeaders()
                }
            });
        } catch (error) {
            console.error('Error fetching admin config:', error);
            return new Response(JSON.stringify({ error: 'Failed to fetch admin configuration' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...getCORSHeaders() }
            });
        }
    }
    
    if (request.method === 'PUT') {
        // Update full admin configuration
        try {
            const newConfig = await request.json();
            
            // Validate required fields
            if (!newConfig || typeof newConfig !== 'object') {
                return new Response(JSON.stringify({ error: 'Invalid configuration data' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...getCORSHeaders() }
                });
            }
            
            // Merge with existing config
            let currentConfig = DEFAULT_CONFIG;
            if (env.WATERWALL_KV) {
                const storedConfig = await env.WATERWALL_KV.get('admin_config');
                if (storedConfig) {
                    currentConfig = { ...DEFAULT_CONFIG, ...JSON.parse(storedConfig) };
                }
            }
            
            const updatedConfig = { ...currentConfig, ...newConfig };
            
            // Store updated configuration
            if (env.WATERWALL_KV) {
                await env.WATERWALL_KV.put('admin_config', JSON.stringify(updatedConfig));
                console.log('✅ Admin configuration updated');
            }
            
            return new Response(JSON.stringify({ 
                success: true, 
                message: 'Admin configuration updated successfully',
                config: updatedConfig
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...getCORSHeaders() }
            });
        } catch (error) {
            console.error('Error updating admin config:', error);
            return new Response(JSON.stringify({ error: 'Failed to update admin configuration' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...getCORSHeaders() }
            });
        }
    }
    
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...getCORSHeaders() }
    });
}

// Handle feature toggles API
async function handleAdminFeaturesAPI(request, env) {
    if (request.method === 'GET') {
        try {
            let features = DEFAULT_CONFIG.features;
            
            if (env.WATERWALL_KV) {
                const storedConfig = await env.WATERWALL_KV.get('admin_config');
                if (storedConfig) {
                    const config = JSON.parse(storedConfig);
                    features = config.features || DEFAULT_CONFIG.features;
                }
            }
            
            return new Response(JSON.stringify(features), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': `public, max-age=${CONFIG_CACHE_TTL}`,
                    ...getCORSHeaders()
                }
            });
        } catch (error) {
            console.error('Error fetching features:', error);
            return new Response(JSON.stringify({ error: 'Failed to fetch features' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...getCORSHeaders() }
            });
        }
    }
    
    if (request.method === 'PUT') {
        try {
            const newFeatures = await request.json();
            
            // Get current config
            let currentConfig = DEFAULT_CONFIG;
            if (env.WATERWALL_KV) {
                const storedConfig = await env.WATERWALL_KV.get('admin_config');
                if (storedConfig) {
                    currentConfig = { ...DEFAULT_CONFIG, ...JSON.parse(storedConfig) };
                }
            }
            
            // Update features
            currentConfig.features = { ...currentConfig.features, ...newFeatures };
            
            // Store updated configuration
            if (env.WATERWALL_KV) {
                await env.WATERWALL_KV.put('admin_config', JSON.stringify(currentConfig));
                console.log('✅ Feature toggles updated');
            }
            
            return new Response(JSON.stringify({ 
                success: true, 
                message: 'Feature toggles updated successfully',
                features: currentConfig.features
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...getCORSHeaders() }
            });
        } catch (error) {
            console.error('Error updating features:', error);
            return new Response(JSON.stringify({ error: 'Failed to update features' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...getCORSHeaders() }
            });
        }
    }
    
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...getCORSHeaders() }
    });
}

// Handle default user settings API
async function handleAdminDefaultsAPI(request, env) {
    if (request.method === 'GET') {
        try {
            let defaults = DEFAULT_CONFIG.defaultUserSettings;
            
            if (env.WATERWALL_KV) {
                const storedConfig = await env.WATERWALL_KV.get('admin_config');
                if (storedConfig) {
                    const config = JSON.parse(storedConfig);
                    defaults = config.defaultUserSettings || DEFAULT_CONFIG.defaultUserSettings;
                }
            }
            
            return new Response(JSON.stringify(defaults), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': `public, max-age=${CONFIG_CACHE_TTL}`,
                    ...getCORSHeaders()
                }
            });
        } catch (error) {
            console.error('Error fetching defaults:', error);
            return new Response(JSON.stringify({ error: 'Failed to fetch default settings' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...getCORSHeaders() }
            });
        }
    }
    
    if (request.method === 'PUT') {
        try {
            const newDefaults = await request.json();
            
            // Get current config
            let currentConfig = DEFAULT_CONFIG;
            if (env.WATERWALL_KV) {
                const storedConfig = await env.WATERWALL_KV.get('admin_config');
                if (storedConfig) {
                    currentConfig = { ...DEFAULT_CONFIG, ...JSON.parse(storedConfig) };
                }
            }
            
            // Update default settings
            currentConfig.defaultUserSettings = { ...currentConfig.defaultUserSettings, ...newDefaults };
            
            // Store updated configuration
            if (env.WATERWALL_KV) {
                await env.WATERWALL_KV.put('admin_config', JSON.stringify(currentConfig));
                console.log('✅ Default user settings updated');
            }
            
            return new Response(JSON.stringify({ 
                success: true, 
                message: 'Default user settings updated successfully',
                defaults: currentConfig.defaultUserSettings
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...getCORSHeaders() }
            });
        } catch (error) {
            console.error('Error updating defaults:', error);
            return new Response(JSON.stringify({ error: 'Failed to update default settings' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...getCORSHeaders() }
            });
        }
    }
    
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...getCORSHeaders() }
    });
}

// Handle UI controls API
async function handleAdminUIAPI(request, env) {
    if (request.method === 'GET') {
        try {
            let uiControls = DEFAULT_CONFIG.uiControls;
            
            if (env.WATERWALL_KV) {
                const storedConfig = await env.WATERWALL_KV.get('admin_config');
                if (storedConfig) {
                    const config = JSON.parse(storedConfig);
                    uiControls = config.uiControls || DEFAULT_CONFIG.uiControls;
                }
            }
            
            return new Response(JSON.stringify(uiControls), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': `public, max-age=${CONFIG_CACHE_TTL}`,
                    ...getCORSHeaders()
                }
            });
        } catch (error) {
            console.error('Error fetching UI controls:', error);
            return new Response(JSON.stringify({ error: 'Failed to fetch UI controls' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...getCORSHeaders() }
            });
        }
    }
    
    if (request.method === 'PUT') {
        try {
            const newUIControls = await request.json();
            
            // Get current config
            let currentConfig = DEFAULT_CONFIG;
            if (env.WATERWALL_KV) {
                const storedConfig = await env.WATERWALL_KV.get('admin_config');
                if (storedConfig) {
                    currentConfig = { ...DEFAULT_CONFIG, ...JSON.parse(storedConfig) };
                }
            }
            
            // Update UI controls
            currentConfig.uiControls = { ...currentConfig.uiControls, ...newUIControls };
            
            // Store updated configuration
            if (env.WATERWALL_KV) {
                await env.WATERWALL_KV.put('admin_config', JSON.stringify(currentConfig));
                console.log('✅ UI controls updated');
            }
            
            return new Response(JSON.stringify({ 
                success: true, 
                message: 'UI controls updated successfully',
                uiControls: currentConfig.uiControls
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json', ...getCORSHeaders() }
            });
        } catch (error) {
            console.error('Error updating UI controls:', error);
            return new Response(JSON.stringify({ error: 'Failed to update UI controls' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...getCORSHeaders() }
            });
        }
    }
    
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...getCORSHeaders() }
    });
}

// Utility functions

// Compare version strings (returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal)
function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const part1 = parts1[i] || 0;
        const part2 = parts2[i] || 0;
        
        if (part1 > part2) return 1;
        if (part1 < part2) return -1;
    }
    
    return 0;
}

// Enhanced rate limiting with KV storage
async function checkRateLimit(request, env) {
    const clientIP = request.headers.get('CF-Connecting-IP') || 
                    request.headers.get('X-Forwarded-For') || 
                    'unknown';
    
    // Skip rate limiting for unknown IPs in development
    if (clientIP === 'unknown') {
        return null;
    }
    
    try {
        if (env.RATE_LIMIT_KV) {
            const key = `rate_limit:${clientIP}`;
            const now = Date.now();
            const windowMs = 60000; // 1 minute
            const maxRequests = 100;
            
            const rateLimitData = await env.RATE_LIMIT_KV.get(key, 'json');
            
            if (rateLimitData) {
                const { count, windowStart } = rateLimitData;
                
                if (now - windowStart < windowMs) {
                    if (count >= maxRequests) {
                        return new Response(JSON.stringify({
                            error: 'Rate limit exceeded',
                            retryAfter: Math.ceil((windowMs - (now - windowStart)) / 1000)
                        }), {
                            status: 429,
                            headers: {
                                'Content-Type': 'application/json',
                                'Retry-After': Math.ceil((windowMs - (now - windowStart)) / 1000).toString(),
                                ...getCORSHeaders()
                            }
                        });
                    }
                    
                    // Increment counter
                    await env.RATE_LIMIT_KV.put(key, JSON.stringify({
                        count: count + 1,
                        windowStart
                    }), { expirationTtl: Math.ceil(windowMs / 1000) });
                } else {
                    // Reset window
                    await env.RATE_LIMIT_KV.put(key, JSON.stringify({
                        count: 1,
                        windowStart: now
                    }), { expirationTtl: Math.ceil(windowMs / 1000) });
                }
            } else {
                // First request in window
                await env.RATE_LIMIT_KV.put(key, JSON.stringify({
                    count: 1,
                    windowStart: now
                }), { expirationTtl: Math.ceil(windowMs / 1000) });
            }
        }
    } catch (error) {
        console.error('Rate limiting error:', error);
        // Don't block requests if rate limiting fails
    }
    
    return null;
}

// ================= NEW SOCIAL / PROFILE / USER DATA LAYER =================
// This section adds endpoints to persist per-user metadata (favorites, settings, profile, friends)
// using Auth0 user app_metadata.  Because calling Auth0 Management API on every request would be
// expensive and rate limited, we implement a small write-through cache layer using KV where possible.
// All endpoints require a valid Auth0 Access Token (RS256) unless explicitly noted as public.

// Expected bindings / vars (see wrangler.toml):
//  AUTH0_DOMAIN, AUTH0_AUDIENCE, AUTH0_ALLOWED_CLIENT_IDS
//  Secrets: AUTH0_MGMT_CLIENT_ID, AUTH0_MGMT_CLIENT_SECRET (stored via wrangler secret put)
//  Optional KV: USER_INDEX_KV (username -> user_id map), PRESENCE_KV (user_id -> presence JSON)

// ---- Routing augmentation ----
// Extend handleAPIRequest by monkey patching (avoid restructuring huge file).
const __origHandleAPIRequest = handleAPIRequest;
handleAPIRequest = async function(request, url, env, ctx){
    const path = url.pathname.replace('/api','');
    
    // Remove all authentication-dependent endpoints
    // Authentication is now handled purely on frontend with Auth0
    
    // Debug endpoint for testing
    if(path === '/debug'){
        return jsonResponse({
            message: 'Backend working - no authentication required',
            path: path,
            timestamp: new Date().toISOString()
        });
    }
    
    return __origHandleAPIRequest(request, url, env, ctx);
};

// ================= AUTHENTICATION REMOVED =================
// All authentication is now handled on the frontend with Auth0.
// Backend serves data without requiring authentication.
// User data, favorites, friends, etc. are managed client-side.
// =========================================================

// Keep only essential response helpers  
function jsonResponse(obj, status=200, extra={}){ 
    return new Response(JSON.stringify(obj), {
        status, 
        headers: {
            'Content-Type': 'application/json', 
            ...getCORSHeaders(), 
            ...extra
        }
    }); 
}
// All authentication functions removed - handled by frontend only

// All authentication functions removed - handled by frontend only

// ================= END SOCIAL LAYER =================
