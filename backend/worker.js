// Cloudflare Worker script for WaterWall proxy
// This worker acts as a reverse proxy to bypass CORS and domain restrictions

// Maintenance mode configuration
const MAINTENANCE_MODE = {
    enabled: true, // Set to true to enable maintenance mode
    message: "WaterWall is currently under maintenance. We'll be back online soon!",
    estimatedTime: "Please check back in a few hours."
};

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        
        // Handle CORS preflight requests
        if (request.method === 'OPTIONS') {
            return handleCORS();
        }
        
        // Handle maintenance status check
        if (url.pathname === '/maintenance-status') {
            return new Response(JSON.stringify({
                maintenanceMode: MAINTENANCE_MODE.enabled,
                message: MAINTENANCE_MODE.message,
                estimatedTime: MAINTENANCE_MODE.estimatedTime
            }), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    ...getCORSHeaders()
                }
            });
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
