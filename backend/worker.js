// Cloudflare Worker script for WaterWall proxy
// This worker acts as a reverse proxy to bypass CORS and domain restrictions

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        
        // Handle CORS preflight requests
        if (request.method === 'OPTIONS') {
            return handleCORS();
        }
        
        // Check rate limits
        const rateLimitResponse = checkRateLimit(request);
        if (rateLimitResponse) {
            return rateLimitResponse;
        }
        
        // Handle proxy requests
        if (url.pathname.startsWith('/proxy')) {
            return handleProxy(request, url);
        }
        
        // Handle health check
        if (url.pathname === '/health') {
            return new Response('OK', { status: 200 });
        }
        
        // Default response for unknown routes
        return new Response('WaterWall Proxy Worker', {
            status: 200,
            headers: {
                'Content-Type': 'text/plain',
                ...getCORSHeaders()
            }
        });
    }
};

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
        
        if (contentType.includes('text/html')) {
            // Process HTML content
            const htmlContent = await response.text();
            processedBody = rewriteHTML(htmlContent, baseUrl, request.url.split('/proxy')[0]);
        } else if (contentType.includes('text/css')) {
            // Process CSS content
            const cssContent = await response.text();
            processedBody = rewriteCSS(cssContent, baseUrl, request.url.split('/proxy')[0]);
        } else if (contentType.includes('application/javascript') || contentType.includes('text/javascript')) {
            // Process JavaScript content
            const jsContent = await response.text();
            processedBody = rewriteJavaScript(jsContent, baseUrl, request.url.split('/proxy')[0]);
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
        return new Response('Proxy Error: ' + error.message, {
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
        if (!url || url.startsWith('data:') || url.startsWith('javascript:') || url.startsWith('mailto:') || url.startsWith('#')) {
            return url;
        }
        
        let absoluteUrl;
        try {
            if (url.startsWith('//')) {
                // Protocol-relative URL
                absoluteUrl = new URL(url, baseUrl).href;
            } else if (url.startsWith('http://') || url.startsWith('https://')) {
                // Absolute URL
                absoluteUrl = url;
            } else {
                // Relative URL
                absoluteUrl = new URL(url, baseUrl).href;
            }
            return `${proxyBase}/proxy?url=${encodeURIComponent(absoluteUrl)}`;
        } catch (e) {
            return url;
        }
    };
    
    // Rewrite various HTML attributes that contain URLs
    html = html.replace(/(<(?:img|script|link|iframe|embed|object|source|track|audio|video)[^>]*(?:src|href|data)[^>]*?=\s*["'])([^"']+)(["'][^>]*>)/gi, 
        (match, prefix, url, suffix) => {
            return prefix + rewriteUrl(url) + suffix;
        });
    
    // Rewrite CSS imports and background images in style attributes
    html = html.replace(/style\s*=\s*["']([^"']*?)["']/gi, (match, style) => {
        const rewrittenStyle = rewriteCSS(style, baseUrl, proxyBase);
        return `style="${rewrittenStyle}"`;
    });
    
    // Rewrite URLs in inline CSS
    html = html.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, css) => {
        const rewrittenCSS = rewriteCSS(css, baseUrl, proxyBase);
        return match.replace(css, rewrittenCSS);
    });
    
    // Rewrite form actions
    html = html.replace(/(<form[^>]*action\s*=\s*["'])([^"']+)(["'][^>]*>)/gi, 
        (match, prefix, url, suffix) => {
            return prefix + rewriteUrl(url) + suffix;
        });
    
    // Add base tag to handle relative URLs better
    if (!html.includes('<base')) {
        html = html.replace(/<head[^>]*>/i, 
            `$&\n<base href="${baseUrl}/">`);
    }
    
    // Inject JavaScript to intercept and rewrite dynamic requests
    const injectedScript = `
    <script>
    (function() {
        const proxyBase = '${proxyBase}';
        const originalFetch = window.fetch;
        const originalOpen = XMLHttpRequest.prototype.open;
        
        // Override fetch
        window.fetch = function(input, init) {
            if (typeof input === 'string' && !input.startsWith('data:') && !input.startsWith('blob:')) {
                const url = new URL(input, window.location.href);
                if (url.origin !== window.location.origin) {
                    input = proxyBase + '/proxy?url=' + encodeURIComponent(url.href);
                }
            }
            return originalFetch.call(this, input, init);
        };
        
        // Override XMLHttpRequest
        XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
            if (typeof url === 'string' && !url.startsWith('data:') && !url.startsWith('blob:')) {
                const absoluteUrl = new URL(url, window.location.href);
                if (absoluteUrl.origin !== window.location.origin) {
                    url = proxyBase + '/proxy?url=' + encodeURIComponent(absoluteUrl.href);
                }
            }
            return originalOpen.call(this, method, url, async, user, password);
        };
        
        // Override window.open
        const originalWindowOpen = window.open;
        window.open = function(url, name, specs) {
            if (url && typeof url === 'string' && !url.startsWith('data:') && !url.startsWith('javascript:')) {
                const absoluteUrl = new URL(url, window.location.href);
                if (absoluteUrl.origin !== window.location.origin) {
                    url = proxyBase + '/proxy?url=' + encodeURIComponent(absoluteUrl.href);
                }
            }
            return originalWindowOpen.call(this, url, name, specs);
        };
    })();
    </script>`;
    
    html = html.replace(/<\/head>/i, injectedScript + '$&');
    
    return html;
}

// Rewrite CSS content to route resources through proxy
function rewriteCSS(css, baseUrl, proxyBase) {
    // Rewrite url() functions in CSS
    css = css.replace(/url\s*\(\s*(['"]?)([^'")\s]+)\1\s*\)/gi, (match, quote, url) => {
        if (url.startsWith('data:') || url.startsWith('#')) {
            return match;
        }
        
        try {
            let absoluteUrl;
            if (url.startsWith('//')) {
                absoluteUrl = new URL(url, baseUrl).href;
            } else if (url.startsWith('http://') || url.startsWith('https://')) {
                absoluteUrl = url;
            } else {
                absoluteUrl = new URL(url, baseUrl).href;
            }
            return `url(${quote}${proxyBase}/proxy?url=${encodeURIComponent(absoluteUrl)}${quote})`;
        } catch (e) {
            return match;
        }
    });
    
    // Rewrite @import statements
    css = css.replace(/@import\s+(['"])([^'"]+)\1/gi, (match, quote, url) => {
        if (url.startsWith('data:')) {
            return match;
        }
        
        try {
            let absoluteUrl;
            if (url.startsWith('//')) {
                absoluteUrl = new URL(url, baseUrl).href;
            } else if (url.startsWith('http://') || url.startsWith('https://')) {
                absoluteUrl = url;
            } else {
                absoluteUrl = new URL(url, baseUrl).href;
            }
            return `@import ${quote}${proxyBase}/proxy?url=${encodeURIComponent(absoluteUrl)}${quote}`;
        } catch (e) {
            return match;
        }
    });
    
    return css;
}

// Rewrite JavaScript content to handle dynamic requests
function rewriteJavaScript(js, baseUrl, proxyBase) {
    // This is a basic implementation - for full JS rewriting, you'd need a proper parser
    // For now, we'll handle some common patterns
    
    // Replace common AJAX URL patterns (this is limited but covers many cases)
    js = js.replace(/(["'])https?:\/\/[^"']+\1/gi, (match) => {
        try {
            const url = match.slice(1, -1); // Remove quotes
            const absoluteUrl = new URL(url);
            return `"${proxyBase}/proxy?url=${encodeURIComponent(absoluteUrl.href)}"`;
        } catch (e) {
            return match;
        }
    });
    
    return js;
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

// Middleware to check rate limits
function checkRateLimit(request) {
    const ip = request.headers.get('CF-Connecting-IP') || 
               request.headers.get('X-Forwarded-For') || 
               request.headers.get('X-Real-IP') ||
               'unknown';
    
    if (!rateLimiter.isAllowed(ip, 200, 60000)) { // Increased limit for better functionality
        console.log(`Rate limit exceeded for IP: ${ip}`);
        return new Response('Rate limit exceeded', {
            status: 429,
            headers: {
                ...getCORSHeaders(),
                'Retry-After': '60'
            }
        });
    }
    
    return null;
}

// Add logging helper
function logRequest(request, targetUrl, status) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    console.log(`[${new Date().toISOString()}] ${ip} ${request.method} ${targetUrl} -> ${status} (UA: ${userAgent.substring(0, 50)})`);
}
