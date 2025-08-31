// Cloudflare Worker script for WaterWall proxy
// This worker acts as a reverse proxy to bypass CORS and domain restrictions

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        
        // Handle CORS preflight requests
        if (request.method === 'OPTIONS') {
            return handleCORS();
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
        
        // Create a new request to the target URL
        const targetRequest = new Request(targetUrl, {
            method: request.method,
            headers: getProxyHeaders(request),
            body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null
        });
        
        // Fetch the target resource
        const response = await fetch(targetRequest);
        
        // Create response with modified headers
        const modifiedResponse = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: getResponseHeaders(response)
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
function getProxyHeaders(originalRequest) {
    const headers = new Headers();
    
    // Copy safe headers from original request
    const safeHeaders = [
        'accept',
        'accept-language',
        'content-type',
        'user-agent'
    ];
    
    safeHeaders.forEach(header => {
        const value = originalRequest.headers.get(header);
        if (value) {
            headers.set(header, value);
        }
    });
    
    // Set custom headers for better compatibility
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8');
    headers.set('Accept-Language', 'en-US,en;q=0.5');
    
    // Remove problematic headers
    headers.delete('origin');
    headers.delete('referer');
    headers.delete('sec-fetch-site');
    headers.delete('sec-fetch-mode');
    headers.delete('sec-fetch-dest');
    
    return headers;
}

// Get response headers with CORS and security modifications
function getResponseHeaders(response) {
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
        'etag'
    ];
    
    contentHeaders.forEach(header => {
        const value = response.headers.get(header);
        if (value) {
            headers.set(header, value);
        }
    });
    
    // Add CORS headers
    Object.entries(getCORSHeaders()).forEach(([key, value]) => {
        headers.set(key, value);
    });
    
    // Remove security headers that might block iframe embedding
    headers.delete('x-frame-options');
    headers.delete('content-security-policy');
    headers.delete('x-content-type-options');
    headers.delete('strict-transport-security');
    
    // Modify content security policy if present
    const csp = response.headers.get('content-security-policy');
    if (csp) {
        // Remove frame-ancestors restrictions
        const modifiedCSP = csp.replace(/frame-ancestors[^;]*;?/gi, '');
        if (modifiedCSP !== csp) {
            headers.set('content-security-policy', modifiedCSP);
        }
    }
    
    return headers;
}

// Get CORS headers
function getCORSHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
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
               'unknown';
    
    if (!rateLimiter.isAllowed(ip)) {
        return new Response('Rate limit exceeded', {
            status: 429,
            headers: getCORSHeaders()
        });
    }
    
    return null;
}
