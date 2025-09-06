// Cloudflare Worker script for WaterWall - Full Backend API
// This worker now serves as a complete backend for the WaterWall platform

// Application configuration and constants
const APP_VERSION = '2.0.0';
const VERSION_ENDPOINT_CACHE_TTL = 300; // 5 minutes
const GAMES_CACHE_TTL = 3600; // 1 hour
const CONFIG_CACHE_TTL = 1800; // 30 minutes

// Default configuration that can be overridden
const DEFAULT_CONFIG = {
    version: APP_VERSION,
    maintenanceMode: {
        enabled: false,
        message: "WaterWall is currently under maintenance. We'll be back online soon!",
        estimatedTime: "Please check back in a few hours."
    },
    settings: {
        defaultProxy: false,
        accentColor: '#58a6ff',
        particlesEnabled: true,
        particleSpeed: 0.5,
        particleCount: 50,
        particleColor: '#58a6ff',
        particleLineDistance: 150,
        particleMouseInteraction: true,
        customCursorEnabled: true,
        cursorSize: 8,
        cursorColor: '#ffffff',
        cursorType: 'circle',
        customCursorImage: null
    },
    features: {
        auth0Enabled: true,
        searchEnabled: true,
        favoritesEnabled: true,
        fullscreenEnabled: true,
        categoriesEnabled: true
    }
};

// Games database - now served from backend
const GAMES_DATABASE = [
    {
        "id": 1,
        "title": "Cookie Clicker",
        "description": "Click a cookie. Earn cookies. Use cookies to get autoclickers. Get more cookies. Repeat.",
        "category": "puzzle",
        "embed": "https://unblockedgamesfree.github.io/cookie-clicker/",
        "thumbnail": "/api/thumbnails/cookieclicker.jpg"
    },
    {
        "id": 2,
        "title": "Tetris",
        "description": "Literally just tetris. If you don't know how to play, you are not a gamer.",
        "category": "puzzle",
        "embed": "https://djblue.github.io/tetris",
        "thumbnail": "/api/thumbnails/tetris.webp"
    },
    {
        "id": 3,
        "title": "Snake",
        "description": "Control a snake to eat food and grow longer without hitting walls or yourself. A classic arcade game that tests your reflexes and strategic thinking!",
        "category": "arcade",
        "embed": "https://snake-google-online.github.io/file",
        "thumbnail": "/api/thumbnails/snake.gif"
    },
    {
        "id": 4,
        "title": "Pac-Man",
        "description": "Navigate mazes, eat dots, and avoid ghosts in this classic arcade game. Collect power pellets to turn the tables on your ghostly pursuers!",
        "category": "arcade",
        "embed": "https://smashkartsonlinegames.github.io/v88/pac-man",
        "thumbnail": "/api/thumbnails/pacman.avif"
    },
    {
        "id": 5,
        "title": "Chess",
        "description": "Strategic board game for two players on a checkered board. Plan your moves carefully and outmaneuver your opponent to achieve checkmate!",
        "category": "strategy",
        "embed": "https://chessunblock.github.io/file/",
        "thumbnail": "/api/thumbnails/chess.png"
    }
];

// Thumbnail mappings for backward compatibility
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
            return handleAPIRequest(request, url, env, ctx);
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
                'GET /api/games - Get all games',
                'GET /api/config - Get application configuration',
                'GET /api/version - Get version info and check for updates',
                'GET /api/maintenance - Get maintenance status',
                'PUT /api/maintenance - Update maintenance status (admin)',
                'GET /api/thumbnails/{filename} - Get game thumbnails',
                'GET /proxy?url= - Proxy requests',
                'GET /health - Health check'
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

// Handle API requests
async function handleAPIRequest(request, url, env, ctx) {
    const path = url.pathname.replace('/api', '');
    const method = request.method;
    
    try {
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
        
        // Thumbnails endpoint
        if (path.startsWith('/thumbnails/')) {
            return handleThumbnailAPI(request, url, env);
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
        'Access-Control-Allow-Credentials': 'true',
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
    // Check if there's custom config in KV storage
    let config = { ...DEFAULT_CONFIG };
    
    try {
        if (env.CONFIG_KV) {
            const customConfig = await env.CONFIG_KV.get('app_config', 'json');
            if (customConfig) {
                config = { ...config, ...customConfig };
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
        // Get maintenance status
        let maintenanceConfig = DEFAULT_CONFIG.maintenanceMode;
        
        try {
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
            
            if (!env.CONFIG_KV) {
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
            
            // Get current config
            let config = { ...DEFAULT_CONFIG };
            const existingConfig = await env.CONFIG_KV.get('app_config', 'json');
            if (existingConfig) {
                config = { ...config, ...existingConfig };
            }
            
            // Update maintenance mode
            config.maintenanceMode = {
                ...config.maintenanceMode,
                ...body
            };
            
            // Save back to KV
            await env.CONFIG_KV.put('app_config', JSON.stringify(config));
            
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
