// Bootstrap loader for Jettic frontend configuration
(() => {
    const DEFAULT_CONFIG = {
        backend: { primary: '', fallbacks: [] },
        frontend: { publicBasePath: '', configVersion: 1 }
    };

    const CONFIG_TIMEOUT_MS = 4000;

    function withTimeout(promise, ms, onTimeout) {
        let timer;
        return Promise.race([
            promise.finally(() => clearTimeout(timer)),
            new Promise((resolve, reject) => {
                timer = setTimeout(() => {
                    if (onTimeout) onTimeout();
                    reject(new Error('Config load timeout'));
                }, ms);
            })
        ]);
    }

    function isHttpUrl(url) {
        if (!url) return false;
        try {
            const u = new URL(url);
            return u.protocol === 'http:' || u.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    function sanitizeBasePath(input = '') {
        if (!input || input === '/' || input === './') return '';
        const cleaned = `/${String(input).trim().replace(/^\/+/, '').replace(/\/+$/, '')}`;
        return cleaned === '/' ? '' : cleaned;
    }

    async function loadConfig() {
        try {
            const res = await withTimeout(
                fetch('backend-config.json', { cache: 'no-store' }),
                CONFIG_TIMEOUT_MS,
                () => console.warn('[Jettic] backend-config fetch timed out; using defaults')
            );
            if (!res.ok) return { ...DEFAULT_CONFIG };
            const data = await res.json();
            return {
                ...DEFAULT_CONFIG,
                ...data,
                backend: { ...DEFAULT_CONFIG.backend, ...(data.backend || {}) },
                frontend: { ...DEFAULT_CONFIG.frontend, ...(data.frontend || {}) }
            };
        } catch (_) {
            return { ...DEFAULT_CONFIG };
        }
    }

    function pickBackend(config) {
        const candidates = [];
        if (config.backend?.primary) candidates.push(config.backend.primary);
        if (Array.isArray(config.backend?.fallbacks)) candidates.push(...config.backend.fallbacks);
        const valid = candidates
            .map((c) => String(c || '').trim())
            .filter((c) => c && isHttpUrl(c))
            .map((c) => c.replace(/\/+$/, ''));
        const fallback = (window.JETTIC_BACKEND_URL || window.location.origin || '').replace(/\/+$/, '');
        return { backendUrl: valid[0] || fallback, fallbacks: valid.slice(1) };
    }

    window.JETTIC_CONFIG_READY = (async () => {
        const config = await loadConfig();
        const { backendUrl, fallbacks } = pickBackend(config);
        const basePath = sanitizeBasePath(config.frontend?.publicBasePath || window.JETTIC_PUBLIC_PATH || '');
        window.JETTIC_CONFIG = config;
        window.JETTIC_BACKEND_URL = backendUrl;
        window.JETTIC_BACKEND_FALLBACKS = fallbacks;
        window.JETTIC_PUBLIC_PATH = basePath;
        return { backendUrl, basePath, config };
    })();
})();
