const path = require('path');
const fs = require('fs/promises');
const fsSync = require('fs');
const { Readable } = require('stream');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { createRemoteJWKSet, jwtVerify } = require('jose');
const bcrypt = require('bcryptjs');
const morgan = require('morgan');
const yaml = require('js-yaml');

const APP_VERSION = '3.0.0';
const PORT = process.env.PORT || 3000;
const SESSION_SECRET_FILE = path.join(__dirname, 'data', 'session-secret.txt');
const JWT_SECRET = process.env.JWT_SECRET || loadSessionSecret();
const AUTH0_CONFIG_FILE = path.join(__dirname, 'auth0.secrets.json');
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const GAMES_FILE = path.join(DATA_DIR, 'games.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');
const BANNER_FILE = path.join(DATA_DIR, 'banner.yaml');
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const IMAGES_DIR = path.join(__dirname, 'images');
const SITEMAP_FILE = path.join(FRONTEND_DIR, 'sitemap.xml');
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ? process.env.PUBLIC_BASE_URL.replace(/\/+$/, '') : null;
const COOKIE_NAME = 'jg_session';
const REFRESH_COOKIE_NAME = 'jg_refresh';
const GUEST_COOKIE = 'jg_guest';
const LEGACY_SESSION_COOKIE = 'ww_session';
const LEGACY_GUEST_COOKIE = 'ww_guest';
const SESSION_FILE = path.join(DATA_DIR, 'sessions.json');
const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS) || 60 * 60; // default 1h to reduce churn
const REFRESH_TOKEN_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30;
const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
const COOKIE_SECURE = process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production'; // secure in prod by default; can be disabled for local http
const COOKIE_SAME_SITE = (process.env.COOKIE_SAME_SITE || (COOKIE_SECURE ? 'none' : 'lax')).toLowerCase();
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
const ONLINE_WINDOW_MS = 60 * 1000; // users must ping within last 60 seconds to count as online
const ANALYTICS_DIR = path.join(DATA_DIR, 'analytics');
const ANALYTICS_PLAYERS_FILE = path.join(ANALYTICS_DIR, 'players.json');
const ANALYTICS_FRIENDS_FILE = path.join(ANALYTICS_DIR, 'friends.json');
const ANALYTICS_ACCOUNTS_FILE = path.join(ANALYTICS_DIR, 'accounts.json');
const ANALYTICS_GAMES_FILE = path.join(ANALYTICS_DIR, 'games.json');
const ANALYTICS_RETENTION_MINUTES = 365 * 24 * 60; // keep up to ~12 months of minute snapshots (bounded by disk; tune as needed)
const ANALYTICS_FLUSH_INTERVAL_MS = 60 * 1000;
let analyticsFlushInFlight = false;
const analyticsCounters = {
    friends: { sent: 0, accepted: 0, rejected: 0 },
    accounts: { signups: 0, deletions: 0, bans: 0, unbans: 0 }
};

const BUILT_IN_PRESETS = {
    panicButtons: [
        { id: 'google-classroom', label: 'Google Classroom', url: 'https://classroom.google.com', keybind: 'Escape' },
        { id: 'khan-academy', label: 'Khan Academy', url: 'https://www.khanacademy.org', keybind: 'Escape' }
    ],
    tabDisguises: [
        {
            id: 'google-classroom',
            label: 'Google Classroom',
            title: 'Classes',
            favicon: 'https://ssl.gstatic.com/classroom/favicon.png',
            sourceUrl: 'https://classroom.google.com'
        },
        {
            id: 'khan-academy',
            label: 'Khan Academy',
            title: 'Khan Academy',
            favicon: 'https://www.khanacademy.org/favicon.ico',
            sourceUrl: 'https://www.khanacademy.org'
        }
    ]
};

const AUTH0 = loadAuth0Config();
const AUTH0_ISSUER = AUTH0.issuerBaseURL.replace(/\/+$/, '');
const AUTH0_AUDIENCE = AUTH0.audience;
const AUTH0_JWKS = createRemoteJWKSet(new URL(`${AUTH0_ISSUER}/.well-known/jwks.json`));

function isAdminClaim(payload = {}) {
    const perms = Array.isArray(payload.permissions) ? payload.permissions : [];
    const roles = Array.isArray(payload['https://jettic.games/roles']) ? payload['https://jettic.games/roles'] : [];
    const adminFlag = payload['https://jettic.games/admin'];
    return perms.includes('admin') || perms.includes('admin:all') || roles.includes('admin') || adminFlag === true;
}

const app = express();
// Trust only local/known proxies to keep rate-limit IPs accurate (avoids permissive 'true')
const TRUST_PROXY_SETTING = process.env.TRUST_PROXY || 'loopback, linklocal, uniquelocal';
app.set('trust proxy', TRUST_PROXY_SETTING);

// In-memory heartbeat tracking for guests (non-authenticated visitors)
const guestHeartbeats = new Map();

// --- Middleware
app.disable('x-powered-by');
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());
app.use(morgan('dev'));
// Disable weak ETags to avoid 304 responses breaking SPA fetch flows
app.set('etag', false);

const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false
});
app.use(['/api', '/proxy'], apiLimiter);

// --- Utility helpers
async function ensureFile(file, fallback) {
    try {
        await fs.access(file);
    } catch (_) {
        await fs.writeFile(file, JSON.stringify(fallback, null, 2));
    }
}

function loadSessionSecret() {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
    try {
        const existing = fsSync.readFileSync(SESSION_SECRET_FILE, 'utf8').trim();
        if (existing) return existing;
    } catch (_) {}
    const secret = crypto.randomBytes(48).toString('hex');
    try {
        fsSync.mkdirSync(path.dirname(SESSION_SECRET_FILE), { recursive: true });
        fsSync.writeFileSync(SESSION_SECRET_FILE, secret, 'utf8');
    } catch (_) {}
    return secret;
}

async function readJson(file, fallback) {
    try {
        const raw = await fs.readFile(file, 'utf8');
        return JSON.parse(raw);
    } catch (_) {
        return fallback;
    }
}

function loadAuth0Config() {
    try {
        const raw = fsSync.readFileSync(AUTH0_CONFIG_FILE, 'utf8');
        const data = JSON.parse(raw);
        const issuerBaseURL = (data.issuerBaseURL || `https://${data.domain || ''}/`).replace(/\/+$/, '');
        if (!data.domain || !data.audience || !data.spaClientId || !issuerBaseURL) {
            throw new Error('Auth0 config missing required fields (domain, audience, spaClientId, issuerBaseURL)');
        }
        return {
            domain: data.domain.replace(/\/+$/, ''),
            audience: data.audience,
            spaClientId: data.spaClientId,
            issuerBaseURL,
            managementClientId: data.managementClientId,
            managementClientSecret: data.managementClientSecret,
            managementAudience: data.managementAudience || `https://${data.domain}/api/v2/`,
            allowedOrigins: Array.isArray(data.allowedOrigins) ? data.allowedOrigins : []
        };
    } catch (err) {
        console.error('Failed to load Auth0 config', err.message || err);
        throw err;
    }
}

async function writeJson(file, data) {
    await fs.writeFile(file, JSON.stringify(data, null, 2));
}

async function ensureAnalyticsFiles() {
    await fs.mkdir(ANALYTICS_DIR, { recursive: true });
    await ensureFile(ANALYTICS_PLAYERS_FILE, { entries: [] });
    await ensureFile(ANALYTICS_FRIENDS_FILE, { entries: [] });
    await ensureFile(ANALYTICS_ACCOUNTS_FILE, { entries: [] });
    await ensureFile(ANALYTICS_GAMES_FILE, { entries: [] });
}

async function loadAnalyticsFile(file) {
    return readJson(file, { entries: [] });
}

async function appendAnalyticsEntry(file, entry, maxEntries = ANALYTICS_RETENTION_MINUTES) {
    const data = await loadAnalyticsFile(file);
    const entries = Array.isArray(data.entries) ? data.entries : [];
    entries.push(entry);
    const trimmed = entries.slice(-maxEntries);
    await writeJson(file, { entries: trimmed });
}

async function analyticsEnabled() {
    try {
        const config = await loadConfig();
        return config?.features?.analyticsEnabled !== false;
    } catch (_) {
        return true;
    }
}

async function loadConfig() {
    return readJson(CONFIG_FILE, {
        version: APP_VERSION,
        maintenanceMode: { enabled: false },
        features: {},
        uiControls: {},
        defaults: { presets: BUILT_IN_PRESETS }
    });
}

async function saveConfig(config) {
    await writeJson(CONFIG_FILE, config);
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

function isIconUrl(url) {
    if (!url) return true;
    return isHttpUrl(url) || url.startsWith('data:image/');
}

function resolveBaseUrl(req) {
    if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL;
    const forwardedProto = (req.get('x-forwarded-proto') || '').split(',')[0].trim();
    const protocol = forwardedProto || req.protocol || 'http';
    const host = req.get('x-forwarded-host') || req.get('host') || `localhost:${PORT}`;
    return `${protocol}://${host}`.replace(/\/+$/, '');
}

function buildGamePathForSitemap(gameId) {
    return `/game/${encodeURIComponent(gameId)}`;
}

function extractMetaFromHtml(html = '', baseUrl = '') {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim().slice(0, 160) : '';
    const linkMatch = html.match(/<link[^>]+rel=["'](?:shortcut\s+icon|icon)["'][^>]*>/i);
    let favicon = '';
    if (linkMatch) {
        const hrefMatch = linkMatch[0].match(/href=["']([^"']+)["']/i);
        if (hrefMatch && hrefMatch[1]) {
            try {
                favicon = new URL(hrefMatch[1], baseUrl || undefined).toString();
            } catch (_) {
                favicon = hrefMatch[1];
            }
        }
    }
    return { title, favicon };
}

function sanitizePanicPreset(preset = {}, fallbackId = '') {
    return {
        id: String(preset.id || fallbackId || crypto.randomUUID()),
        label: String(preset.label || 'Preset'),
        url: isHttpUrl(preset.url) ? preset.url : '',
        keybind: String(preset.keybind || '').slice(0, 80)
    };
}

function sanitizeTabPreset(preset = {}, fallbackId = '') {
    return {
        id: String(preset.id || fallbackId || crypto.randomUUID()),
        label: String(preset.label || 'Preset'),
        title: String(preset.title || ''),
        favicon: isIconUrl(preset.favicon) ? (preset.favicon || '') : '',
        sourceUrl: isHttpUrl(preset.sourceUrl) ? preset.sourceUrl : ''
    };
}

function normalizePresets(config) {
    const presets = config?.defaults?.presets || {};
    const panicButtonsRaw = Array.isArray(presets.panicButtons) ? presets.panicButtons : [];
    const tabDisguisesRaw = Array.isArray(presets.tabDisguises) ? presets.tabDisguises : [];
    const panicButtons = (panicButtonsRaw.length ? panicButtonsRaw : BUILT_IN_PRESETS.panicButtons)
        .slice(0, 25)
        .map((p, idx) => sanitizePanicPreset(p, p.id || `panic-${idx}`));
    const tabDisguises = (tabDisguisesRaw.length ? tabDisguisesRaw : BUILT_IN_PRESETS.tabDisguises)
        .slice(0, 25)
        .map((p, idx) => sanitizeTabPreset(p, p.id || `disguise-${idx}`));
    return { panicButtons, tabDisguises };
}

async function loadBannerConfig() {
    try {
        const raw = await fs.readFile(BANNER_FILE, 'utf8');
        const data = yaml.load(raw);
        if (!data || data.enabled === false) return null;
        const button = data.button || {};
        return {
            id: String(data.id || 'default'),
            enabled: data.enabled !== false,
            message: data.message || '',
            description: data.description || '',
            background: data.background || '#11161f',
            textColor: data.textColor || '#e5e7eb',
            dismissible: data.dismissible !== false,
            dismissCooldownHours: Number.isFinite(data.dismissCooldownHours) ? data.dismissCooldownHours : 24,
            button: {
                enabled: button.enabled !== false && !!button.url,
                label: button.label || 'Learn more',
                url: button.url || '',
                background: button.background || '#1f6feb',
                textColor: button.textColor || '#ffffff'
            }
        };
    } catch (_) {
        return null;
    }
}

async function saveBannerConfig(input) {
    const button = input.button || {};
    const data = {
        id: input.id || 'default',
        enabled: input.enabled !== false,
        message: input.message || '',
        description: input.description || '',
        background: input.background || '#11161f',
        textColor: input.textColor || '#e5e7eb',
        dismissible: input.dismissible !== false,
        dismissCooldownHours: Number.isFinite(input.dismissCooldownHours) ? input.dismissCooldownHours : 24,
        button: {
            enabled: button.enabled !== false && !!button.url,
            label: button.label || 'Learn more',
            url: button.url || '',
            background: button.background || '#1f6feb',
            textColor: button.textColor || '#ffffff'
        }
    };
    const yamlStr = yaml.dump(data, { noRefs: true, lineWidth: 120 });
    await fs.writeFile(BANNER_FILE, yamlStr, 'utf8');
    return data;
}

function defaultSettingsFromConfig(config) {
    const d = config.defaults || {};
    const particles = d.particles || {};
    const cursor = d.cursor || {};
    const panic = d.panicButton || d.panic || {};
    const disguise = d.tabDisguise || {};
    return {
        proxyDefault: !!d.proxyDefault,
        accentColor: d.accentColor || '#58a6ff',
        particlesEnabled: particles.enabled !== false,
        particleCount: Number.isFinite(particles.count) ? particles.count : 50,
        particleSpeed: Number.isFinite(particles.speed) ? particles.speed : 0.5,
        particleColor: particles.color || '#58a6ff',
        particleLineDistance: Number.isFinite(particles.lineDistance) ? particles.lineDistance : 150,
        particleMouseInteraction: particles.mouse !== false,
        cursorEnabled: cursor.enabled !== false,
        cursorSize: Number.isFinite(cursor.size) ? cursor.size : 8,
        cursorColor: cursor.color || '#ffffff',
        cursorType: ['circle', 'dot', 'none', 'custom'].includes(cursor.type) ? cursor.type : 'circle',
        showClock: d.showClock !== false,
        showCurrent: d.showCurrent !== false,
        panicEnabled: panic.enabled === true,
        panicUrl: panic.url || '',
        panicKeybind: panic.keybind || '',
        panicPreset: panic.preset || '',
        tabDisguiseEnabled: disguise.enabled === true,
        tabDisguiseTitle: disguise.title || '',
        tabDisguiseFavicon: disguise.favicon || '',
        tabDisguiseSource: disguise.sourceUrl || '',
        tabDisguisePreset: disguise.preset || ''
    };
}

async function loadGames() {
    const data = await readJson(GAMES_FILE, []);
    const games = Array.isArray(data) ? data : data.games || [];
    return games.map((g) => ({ ...g, disabled: !!g.disabled, disabledMessage: g.disabledMessage || '' }));
}

async function saveGames(games) {
    await writeJson(GAMES_FILE, games);
    try {
        await regenerateSitemap(games);
    } catch (err) {
        console.error('Failed to regenerate sitemap after saving games', err);
    }
}

async function generateSitemapXml(games, baseUrl) {
    const base = (baseUrl || PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/+$/, '');
    const urls = [
        `${base}/`,
        ...games
            .filter((g) => !g.disabled)
            .map((g) => `${base}${buildGamePathForSitemap(g.id)}`)
    ];
    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...urls.map((loc) => `  <url><loc>${loc}</loc></url>`),
        '</urlset>'
    ].join('\n');
}

async function regenerateSitemap(games, baseUrl) {
    const list = games || await loadGames();
    const xml = await generateSitemapXml(list, baseUrl);
    await fs.mkdir(path.dirname(SITEMAP_FILE), { recursive: true });
    await fs.writeFile(SITEMAP_FILE, xml, 'utf8');
    return xml;
}

async function loadUsers() {
    const data = await readJson(USERS_FILE, { users: [] });
    const users = Array.isArray(data) ? data : data.users || [];
    return users.map((u) => ({
        ...u,
        admin: !!u.admin,
        email: u.email ? String(u.email).toLowerCase() : undefined,
        banned: u.banned || { active: false },
        loginHistory: Array.isArray(u.loginHistory) ? u.loginHistory.slice(0, 10) : []
    }));
}

async function saveUsers(users) {
    await writeJson(USERS_FILE, { users });
}

async function loadRequests() {
    const data = await readJson(REQUESTS_FILE, { requests: [] });
    return Array.isArray(data) ? data : data.requests || [];
}

async function saveRequests(requests) {
    await writeJson(REQUESTS_FILE, { requests });
}

async function loadReports() {
    const data = await readJson(REPORTS_FILE, { reports: [] });
    return Array.isArray(data) ? data : data.reports || [];
}

async function saveReports(reports) {
    await writeJson(REPORTS_FILE, { reports });
}

function sanitizeUser(user) {
    if (!user) return null; // Ensure user object is valid
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        admin: !!user.admin,
        banned: user.banned || { active: false },
        online: isUserOnline(user),
        profile: {
            ...(user.profile || {}),
            lastPlayed: Array.isArray(user.profile?.lastPlayed) ? user.profile.lastPlayed : [],
            playtime: normalizePlaytime(user.profile?.playtime)
        },
        favorites: user.favorites || [],
        friends: user.friends || { accepted: [], incoming: [], outgoing: [], blocked: [] },
        settings: user.settings || {},
        presence: user.presence || { online: false, gameId: null, lastSeen: null },
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    };
}

function hashToken(token) {
    return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function getAccessToken(req) {
    const auth = req.get('authorization') || '';
    const match = auth.match(/^Bearer\s+(.+)$/i);
    if (match) return match[1];
    return req.cookies[COOKIE_NAME] || req.cookies[LEGACY_SESSION_COOKIE];
}

function parseRefreshCookie(req) {
    const raw = req.cookies[REFRESH_COOKIE_NAME];
    if (!raw) return null;
    const [sessionId, ...rest] = String(raw).split('.');
    const token = rest.join('.');
    if (!sessionId || !token) return null;
    return { sessionId, token };
}

function signAccessToken(user, sessionId) {
    return jwt.sign(
        { sid: sessionId, id: user.id, username: user.username, admin: !!user.admin },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_TTL_SECONDS }
    );
}

function cookieOptions(maxAge) {
    const opts = {
        httpOnly: true,
        secure: COOKIE_SECURE,
        sameSite: COOKIE_SAME_SITE,
        maxAge
    };
    if (COOKIE_DOMAIN) opts.domain = COOKIE_DOMAIN;
    return opts;
}

function setAccessCookie(res, token) {
    res.cookie(COOKIE_NAME, token, cookieOptions(ACCESS_TOKEN_TTL_SECONDS * 1000));
    res.clearCookie(LEGACY_SESSION_COOKIE);
}

function setRefreshCookie(res, sessionId, refreshToken) {
    res.cookie(REFRESH_COOKIE_NAME, `${sessionId}.${refreshToken}`, cookieOptions(REFRESH_TOKEN_TTL_MS));
    res.clearCookie(LEGACY_GUEST_COOKIE);
    res.clearCookie(LEGACY_SESSION_COOKIE);
}

function setAuthCookies(res, { accessToken, sessionId, refreshToken }) {
    setAccessCookie(res, accessToken);
    if (refreshToken) setRefreshCookie(res, sessionId, refreshToken);
}

function clearAuthCookies(res) {
    res.clearCookie(COOKIE_NAME);
    res.clearCookie(REFRESH_COOKIE_NAME);
    res.clearCookie(LEGACY_SESSION_COOKIE);
    res.clearCookie(LEGACY_GUEST_COOKIE);
}

async function loadSessions() {
    const data = await readJson(SESSION_FILE, { sessions: [] });
    return Array.isArray(data) ? data : data.sessions || [];
}

async function saveSessions(sessions) {
    await writeJson(SESSION_FILE, { sessions });
}

function pruneSessionsList(sessions, now = Date.now()) {
    const cutoff = now - REFRESH_TOKEN_TTL_MS;
    return sessions.filter((s) => {
        const exp = Date.parse(s.expiresAt || 0);
        const revoked = Date.parse(s.revokedAt || 0);
        const active = !Number.isFinite(exp) || exp > now;
        const recentlyRevoked = Number.isFinite(revoked) ? revoked > cutoff : false;
        return active || recentlyRevoked;
    });
}

async function persistSessions(sessions) {
    await saveSessions(pruneSessionsList(sessions));
}

async function createSession(user, meta = {}) {
    const sessions = await loadSessions();
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const now = new Date();
    const session = {
        id: crypto.randomUUID(),
        userId: user.id,
        refreshHash: hashToken(refreshToken),
        createdAt: now.toISOString(),
        lastSeenAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS).toISOString(),
        ip: meta.ip || null,
        userAgent: meta.userAgent || null,
        revokedAt: null
    };
    sessions.push(session);
    await persistSessions(sessions);
    return { session, refreshToken };
}

async function replaceSessionForUser(user, req, res) {
    const meta = { ip: getClientIp(req), userAgent: req.headers['user-agent'] };
    const sessions = await loadSessions();
    if (req.session) {
        const existing = sessions.find((s) => s.id === req.session.id);
        if (existing) existing.revokedAt = new Date().toISOString();
        await persistSessions(sessions);
    }
    const { session, refreshToken } = await createSession(user, meta);
    const accessToken = signAccessToken(user, session.id);
    setAuthCookies(res, { accessToken, sessionId: session.id, refreshToken });
    req.session = session;
    return session;
}

function accessTokenStale(decoded) {
    if (!decoded?.exp) return false;
    const msLeft = decoded.exp * 1000 - Date.now();
    const threshold = Math.max(ACCESS_TOKEN_TTL_SECONDS * 250, 5 * 60 * 1000); // refresh when ~<5m left
    return msLeft > 0 && msLeft < threshold;
}

async function refreshSessionFromCookie(req, res) {
    const parsed = parseRefreshCookie(req);
    if (!parsed) return null;
    const sessions = await loadSessions();
    const session = sessions.find((s) => s.id === parsed.sessionId);
    if (!session || session.revokedAt) {
        await persistSessions(sessions);
        return null;
    }

    const now = Date.now();
    const expiresAt = Date.parse(session.expiresAt || 0);
    if (Number.isFinite(expiresAt) && expiresAt <= now) {
        session.revokedAt = session.revokedAt || new Date().toISOString();
        await persistSessions(sessions);
        return null;
    }

    if (session.refreshHash !== hashToken(parsed.token)) return null;

    const users = await loadUsers();
    const me = await getUserById(users, session.userId);
    if (!me) {
        session.revokedAt = session.revokedAt || new Date().toISOString();
        await persistSessions(sessions);
        return null;
    }

    session.lastSeenAt = new Date().toISOString();
    await persistSessions(sessions);

    // Do not rotate the refresh token during silent refresh to avoid race conditions
    // when multiple concurrent requests refresh at the same time. Only rotate on login
    // or credential changes.
    const accessToken = signAccessToken(me, session.id);
    setAccessCookie(res, accessToken);
    return { user: me, session };
}

async function ensureLocalUserFromClaims(claims = {}) {
    const users = await loadUsers();
    let user = await getUserById(users, claims.sub);
    const now = new Date().toISOString();
    if (!user) {
        const config = await loadConfig();
        user = {
            id: claims.sub,
            username: claims.nickname || claims.name || claims.email || claims.sub,
            email: claims.email ? String(claims.email).toLowerCase() : undefined,
            favorites: [],
            profile: {
                username: claims.nickname || claims.name || claims.email || claims.sub,
                accentColor: config.defaults?.accentColor || '#58a6ff',
                avatar: null,
                lastPlayed: [],
                playtime: {}
            },
            settings: defaultSettingsFromConfig(config),
            friends: { accepted: [], incoming: [], outgoing: [], blocked: [] },
            presence: { online: false, gameId: null, lastSeen: now },
            loginHistory: [],
            banned: { active: false },
            createdAt: now,
            updatedAt: now,
            admin: isAdminClaim(claims)
        };
        users.push(user);
        await saveUsers(users);
    } else {
        const updatedAdmin = isAdminClaim(claims);
        if (updatedAdmin && !user.admin) user.admin = true;
        if (claims.email) user.email = String(claims.email).toLowerCase();
        user.updatedAt = now;
        await saveUsers(users);
    }
    return { user, users };
}

async function verifyAuth0Token(token) {
    const result = await jwtVerify(token, AUTH0_JWKS, {
        issuer: AUTH0_ISSUER,
        audience: AUTH0_AUDIENCE
    });
    return result.payload;
}

async function requireAuth(req, res, next) {
    const token = getAccessToken(req);
    if (!token) return res.status(401).json({ error: 'Missing bearer token' });
    try {
        const claims = await verifyAuth0Token(token);
        const { user } = await ensureLocalUserFromClaims(claims);
        req.auth = claims;
        req.user = { id: user.id, username: user.username, admin: !!user.admin };
        req.me = user;
        return next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

async function requireAdmin(req, res, next) {
    return requireAuth(req, res, () => {
        if (!req.me?.admin) return res.status(403).json({ error: 'Admin required' });
        req.user = { ...(req.user || {}), admin: true };
        return next();
    });
}

async function getUserById(users, id) {
    return users.find(u => u.id === id);
}

async function getUserByUsername(users, username) {
    return users.find(u => u.username.toLowerCase() === username.toLowerCase());
}

async function getUserByEmail(users, email) {
    if (!email) return null;
    return users.find(u => (u.email || '').toLowerCase() === email.toLowerCase());
}

function colorIsValid(hex) {
    return /^#([0-9a-fA-F]{6})$/.test(hex);
}

function ensurePresence(user) {
    if (!user.presence) {
        user.presence = { online: false, gameId: null, lastSeen: new Date().toISOString() };
    }
    if (!user.presence.lastSeen) user.presence.lastSeen = new Date().toISOString();
    if (user.presence.online === undefined) user.presence.online = false;
    if (user.presence.gameId === undefined) user.presence.gameId = null;
}

function isUserOnline(user, now = Date.now()) {
    ensurePresence(user);
    const last = Date.parse(user.presence.lastSeen || '');
    const fresh = Number.isFinite(last) ? (now - last) <= ONLINE_WINDOW_MS : false;
    return !!user.presence.online && fresh;
}

function setPresence(user, { online, gameId }) {
    ensurePresence(user);
    if (online !== undefined) user.presence.online = !!online;
    if (gameId !== undefined) user.presence.gameId = gameId === null ? null : String(gameId);
    user.presence.lastSeen = new Date().toISOString();
}

function normalizePlaytime(playtime) {
    if (!playtime || typeof playtime !== 'object') return {};
    const normalized = {};
    Object.entries(playtime).forEach(([id, value]) => {
        const ms = Number(value);
        if (!Number.isFinite(ms) || ms < 0) return;
        normalized[String(id)] = ms;
    });
    return normalized;
}

function updateLastPlayed(user, gameId, max = 10) {
    if (!gameId) return;
    user.profile = user.profile || {};
    user.profile.playtime = normalizePlaytime(user.profile.playtime);
    const list = Array.isArray(user.profile.lastPlayed) ? user.profile.lastPlayed.slice() : [];
    const idStr = String(gameId);
    const filtered = list.filter(id => String(id) !== idStr);
    filtered.unshift(idStr);
    user.profile.lastPlayed = filtered.slice(0, max);
}

function addPlaytime(user, gameId, deltaMs) {
    if (!gameId) return;
    const delta = Number(deltaMs);
    if (!Number.isFinite(delta) || delta <= 0) return;
    user.profile = user.profile || {};
    user.profile.playtime = normalizePlaytime(user.profile.playtime);
    const key = String(gameId);
    user.profile.playtime[key] = (user.profile.playtime[key] || 0) + delta;
}

function decodeSessionToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (_) {
        return null;
    }
}

function pruneGuestHeartbeats(now = Date.now()) {
    for (const [id, ts] of guestHeartbeats.entries()) {
        if (now - ts > ONLINE_WINDOW_MS) guestHeartbeats.delete(id);
    }
    return guestHeartbeats.size;
}

function guestOnlineCount(now = Date.now()) {
    pruneGuestHeartbeats(now);
    return guestHeartbeats.size;
}

function recordFriendEvent(type) {
    if (!analyticsCounters.friends[type] && analyticsCounters.friends[type] !== 0) return;
    analyticsCounters.friends[type] += 1;
}

function recordAccountEvent(type) {
    if (!analyticsCounters.accounts[type] && analyticsCounters.accounts[type] !== 0) return;
    analyticsCounters.accounts[type] += 1;
}

function countPlayersByGame(users = [], now = Date.now()) {
    const counts = {};
    users.forEach((u) => {
        if (!isUserOnline(u, now)) return;
        const gameId = u.presence?.gameId;
        if (!gameId) return;
        const key = String(gameId);
        counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
}

function countFavoritesByGame(users = []) {
    const counts = {};
    users.forEach((u) => {
        (u.favorites || []).forEach((id) => {
            const key = String(id);
            counts[key] = (counts[key] || 0) + 1;
        });
    });
    return counts;
}

async function flushAnalytics() {
    if (analyticsFlushInFlight) return;
    analyticsFlushInFlight = true;
    try {
        if (!(await analyticsEnabled())) return;
        const now = Date.now();
        const nowIso = new Date(now).toISOString();
        const [users, games] = await Promise.all([loadUsers(), loadGames()]);
        const onlineUsers = users.filter((u) => isUserOnline(u, now)).length;
        const onlineGuests = guestOnlineCount(now);

        await appendAnalyticsEntry(ANALYTICS_PLAYERS_FILE, {
            time: nowIso,
            players: onlineUsers + onlineGuests,
            onlineUsers,
            onlineGuests
        });

        const friendCounts = { ...analyticsCounters.friends };
        analyticsCounters.friends = { sent: 0, accepted: 0, rejected: 0 };
        await appendAnalyticsEntry(ANALYTICS_FRIENDS_FILE, { time: nowIso, ...friendCounts });

        const accountCounts = { ...analyticsCounters.accounts };
        analyticsCounters.accounts = { signups: 0, deletions: 0, bans: 0, unbans: 0 };
        await appendAnalyticsEntry(ANALYTICS_ACCOUNTS_FILE, { time: nowIso, ...accountCounts });

        const favorites = countFavoritesByGame(users);
        const playersByGame = countPlayersByGame(users, now);
        const gamesSnapshot = games.map((g) => ({
            id: g.id,
            title: g.title,
            thumbnail: g.thumbnail || '',
            players: playersByGame[String(g.id)] || 0,
            favorites: favorites[String(g.id)] || 0,
            disabled: !!g.disabled
        }));

        await appendAnalyticsEntry(ANALYTICS_GAMES_FILE, { time: nowIso, games: gamesSnapshot });
    } catch (err) {
        console.error('Analytics flush failed', err?.message || err);
    } finally {
        analyticsFlushInFlight = false;
    }
}

setInterval(() => { flushAnalytics().catch(() => {}); }, ANALYTICS_FLUSH_INTERVAL_MS);
setTimeout(() => { flushAnalytics().catch(() => {}); }, 2000);

// --- Ensure data files exist on startup
(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await ensureFile(USERS_FILE, { users: [] });
    await ensureFile(GAMES_FILE, []);
    await ensureFile(CONFIG_FILE, {});
    await ensureFile(REQUESTS_FILE, { requests: [] });
    await ensureFile(REPORTS_FILE, { reports: [] });
    await ensureFile(SESSION_FILE, { sessions: [] });
    await ensureAnalyticsFiles();
        await ensureFile(BANNER_FILE, `enabled: true
id: default
message: "Welcome to Jettic Games!"
description: "Play and save your favorites."
background: "#11161f"
textColor: "#e5e7eb"
dismissible: true
dismissCooldownHours: 24
button:
    enabled: true
    label: "Visit Store"
    url: "https://example.com"
    background: "#1f6feb"
    textColor: "#ffffff"
`);
})();

// --- Core endpoints
app.get('/health', async (req, res) => {
    const games = await loadGames();
    const users = await loadUsers();
    const now = Date.now();
    const onlineUsers = users.filter(u => isUserOnline(u, now)).length;
    const onlineGuests = guestOnlineCount(now);
    res.json({
        status: 'ok',
        version: APP_VERSION,
        time: new Date().toISOString(),
        games: games.length,
        players: onlineUsers + onlineGuests,
        onlineUsers,
        onlineGuests,
        totalUsers: users.length
    });
});

// --- Game Requests
app.post('/api/requests', requireAuth, async (req, res) => {
    const { title, url, description, category } = req.body || {};
    if (!title || !url) return res.status(400).json({ error: 'Title and url are required' });
    if (String(title).length > 120) return res.status(400).json({ error: 'Title too long' });
    if (String(description || '').length > 1000) return res.status(400).json({ error: 'Description too long' });

    let parsed;
    try { parsed = new URL(url); } catch (_) { return res.status(400).json({ error: 'Invalid URL' }); }
    if (!['http:', 'https:'].includes(parsed.protocol)) return res.status(400).json({ error: 'URL must be http/https' });

    const users = await loadUsers();
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });

    const requests = await loadRequests();
    const now = new Date().toISOString();
    const request = {
        id: crypto.randomUUID(),
        userId: me.id,
        username: me.username,
        title: title.trim(),
        url: parsed.toString(),
        description: (description || '').trim(),
        category: (category || '').trim() || null,
        status: 'pending',
        createdAt: now,
        updatedAt: now
    };
    requests.push(request);
    await saveRequests(requests);
    res.status(201).json({ request });
});

app.get('/api/requests', requireAdmin, async (req, res) => {
    const requests = await loadRequests();
    res.json({ requests });
});

app.put('/api/requests/:id', requireAdmin, async (req, res) => {
    const { status } = req.body || {};
    if (!['pending', 'approved', 'rejected', 'converted'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const requests = await loadRequests();
    const request = requests.find(r => r.id === req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    request.status = status;
    request.updatedAt = new Date().toISOString();
    await saveRequests(requests);
    res.json({ request });
});

app.delete('/api/requests/:id', requireAdmin, async (req, res) => {
    const requests = await loadRequests();
    const idx = requests.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Request not found' });
    requests.splice(idx, 1);
    await saveRequests(requests);
    res.json({ success: true });
});

// --- Issue Reports
app.post('/api/reports', requireAuth, async (req, res) => {
    const { summary, description, category, gameId, gameTitle } = req.body || {};
    const title = (summary || '').trim();
    const details = (description || '').trim();
    if (!title || title.length < 3) return res.status(400).json({ error: 'Summary is required' });
    if (title.length > 160) return res.status(400).json({ error: 'Summary too long' });
    if (!details || details.length < 10) return res.status(400).json({ error: 'Description is required' });
    if (details.length > 2000) return res.status(400).json({ error: 'Description too long' });

    const users = await loadUsers();
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });

    const reports = await loadReports();
    const now = new Date().toISOString();
    const report = {
        id: crypto.randomUUID(),
        userId: me.id,
        username: me.username,
        summary: title,
        description: details,
        category: (category || 'general').toString().slice(0, 40),
        gameId: gameId ? String(gameId) : null,
        gameTitle: gameTitle ? String(gameTitle).slice(0, 180) : null,
        status: 'open',
        createdAt: now,
        updatedAt: now
    };
    reports.push(report);
    await saveReports(reports);
    res.status(201).json({ report });
});

app.get('/api/admin/reports', requireAdmin, async (req, res) => {
    const reports = await loadReports();
    res.json({ reports });
});

app.put('/api/admin/reports/:id/status', requireAdmin, async (req, res) => {
    const { status } = req.body || {};
    if (!['open', 'resolved', 'dismissed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const reports = await loadReports();
    const report = reports.find((r) => r.id === req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    report.status = status;
    report.updatedAt = new Date().toISOString();
    await saveReports(reports);
    res.json({ report });
});

app.delete('/api/admin/reports/:id', requireAdmin, async (req, res) => {
    const reports = await loadReports();
    const idx = reports.findIndex((r) => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Report not found' });
    reports.splice(idx, 1);
    await saveReports(reports);
    res.json({ success: true });
});

// --- Admin: Games
function isImageDataUrl(str) {
    return typeof str === 'string' && str.startsWith('data:image/') && str.length < 2_500_000;
}

function validateGamePayload(body, { partial = false } = {}) {
    const { title, category, embed, thumbnail, thumbnailData, description, disabled, disabledMessage } = body || {};
    const out = {};
    if (!partial || title !== undefined) {
        if (!title || String(title).trim().length < 2) throw new Error('Title required');
        if (String(title).length > 160) throw new Error('Title too long');
        out.title = String(title).trim();
    }
    if (!partial || category !== undefined) {
        out.category = category ? String(category).trim() : '';
    }
    if (!partial || embed !== undefined) {
        if (!embed) throw new Error('Embed URL required');
        try { new URL(embed); } catch (_) { throw new Error('Invalid embed URL'); }
        out.embed = embed;
    }
    if (thumbnailData !== undefined) {
        if (thumbnailData && !isImageDataUrl(thumbnailData)) throw new Error('Invalid thumbnail upload');
        if (thumbnailData) out.thumbnail = thumbnailData;
    } else if (thumbnail !== undefined) {
        if (thumbnail) {
            try { new URL(thumbnail); } catch (_) { throw new Error('Invalid thumbnail URL'); }
            out.thumbnail = thumbnail;
        } else {
            out.thumbnail = '';
        }
    }
    if (description !== undefined) {
        if (String(description).length > 1200) throw new Error('Description too long');
        out.description = description || '';
    }
    if (disabled !== undefined) out.disabled = !!disabled;
    if (disabledMessage !== undefined) out.disabledMessage = String(disabledMessage || '').slice(0, 200);
    return out;
}

function nextGameId(games) {
    const maxId = games.reduce((m, g) => Math.max(m, Number(g.id) || 0), 0);
    return maxId + 1;
}

app.get('/api/admin/games', requireAdmin, async (req, res) => {
    const games = await loadGames();
    res.json({ games });
});

app.post('/api/admin/games', requireAdmin, async (req, res) => {
    try {
        const games = await loadGames();
        const game = validateGamePayload(req.body || {});
        game.id = nextGameId(games);
        games.push(game);
        await saveGames(games);
        res.status(201).json({ game });
    } catch (err) {
        res.status(400).json({ error: err.message || 'Invalid game' });
    }
});

app.put('/api/admin/games/:id', requireAdmin, async (req, res) => {
    const games = await loadGames();
    const game = games.find(g => String(g.id) === String(req.params.id));
    if (!game) return res.status(404).json({ error: 'Game not found' });
    try {
        Object.assign(game, validateGamePayload(req.body || {}, { partial: true }));
        await saveGames(games);
        res.json({ game });
    } catch (err) {
        res.status(400).json({ error: err.message || 'Invalid game' });
    }
});

app.put('/api/admin/games/:id/disable', requireAdmin, async (req, res) => {
    const { disabled = true, message = '' } = req.body || {};
    const games = await loadGames();
    const game = games.find(g => String(g.id) === String(req.params.id));
    if (!game) return res.status(404).json({ error: 'Game not found' });
    game.disabled = !!disabled;
    game.disabledMessage = String(message || '').slice(0, 200);
    await saveGames(games);
    res.json({ game });
});

app.delete('/api/admin/games/:id', requireAdmin, async (req, res) => {
    const games = await loadGames();
    const idx = games.findIndex(g => String(g.id) === String(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'Game not found' });
    games.splice(idx, 1);
    await saveGames(games);
    res.json({ success: true });
});

// --- Admin: Users
function validateUsername(username) {
    if (!username || username.length < 3 || username.length > 24) throw new Error('Username must be 3-24 characters');
    return username;
}

function validatePassword(password) {
    if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');
    return password;
}

function validateEmail(email) {
    if (!email) throw new Error('Email is required');
    const normalized = String(email).trim().toLowerCase();
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(normalized)) throw new Error('Invalid email');
    return normalized;
}

function getClientIp(req) {
    const fwd = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    return fwd || req.ip || req.connection?.remoteAddress || 'unknown';
}

function recordLoginIp(user, ip) {
    if (!ip || !user) return;
    const history = Array.isArray(user.loginHistory) ? user.loginHistory.slice() : [];
    const existing = history.find((h) => h.ip === ip);
    const now = new Date().toISOString();
    if (existing) {
        existing.count = (existing.count || 0) + 1;
        existing.lastAt = now;
    } else {
        history.unshift({ ip, count: 1, lastAt: now });
    }
    history.sort((a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0));
    user.loginHistory = history.slice(0, 10);
}

app.get('/api/admin/users', requireAdmin, async (req, res) => {
    const users = await loadUsers();
    res.json({ users: users.map(u => sanitizeUser(u)) });
});

app.get('/api/admin/users/:id/relations', requireAdmin, async (req, res) => {
    const users = await loadUsers();
    const me = await getUserById(users, req.params.id);
    if (!me) return res.status(404).json({ error: 'User not found' });
    ensureFriendStruct(me);
    const now = Date.now();
    const friends = resolveFriendList(users, me.friends.accepted || [], now);
    const incoming = resolveFriendList(users, me.friends.incoming || [], now);
    const outgoing = resolveFriendList(users, me.friends.outgoing || [], now);
    const blocked = resolveFriendList(users, me.friends.blocked || [], now);
    res.json({ friends, incoming, outgoing, blocked });
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
    res.status(410).json({ error: 'User creation is managed through Auth0. Use Auth0 dashboard to create users.' });
});

app.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
    res.status(410).json({ error: 'User updates are managed through Auth0. Use Auth0 dashboard for profile changes.' });
});

app.put('/api/admin/users/:id/ban', requireAdmin, async (req, res) => {
    const { active = true, reason = '' } = req.body || {};
    const users = await loadUsers();
    const user = await getUserById(users, req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.banned = {
        active: !!active,
        reason: String(reason || '').slice(0, 240),
        at: new Date().toISOString()
    };
    if (!active) user.presence = { online: false, gameId: null, lastSeen: new Date().toISOString() };
    if (active) recordAccountEvent('bans'); else recordAccountEvent('unbans');
    await saveUsers(users);
    res.json({ user: sanitizeUser(user) });
});

app.get('/api/admin/users/:id/logins', requireAdmin, async (req, res) => {
    const users = await loadUsers();
    const user = await getUserById(users, req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ loginHistory: user.loginHistory || [] });
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
    const users = await loadUsers();
    if (req.user?.id === req.params.id) return res.status(400).json({ error: 'Cannot delete your own account' });
    const idx = users.findIndex(u => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    users.splice(idx, 1);
    recordAccountEvent('deletions');
    await saveUsers(users);
    res.json({ success: true });
});

app.get('/api/admin/defaults', requireAdmin, async (req, res) => {
    const config = await loadConfig();
    res.json({ defaults: defaultSettingsFromConfig(config), presets: normalizePresets(config) });
});

app.put('/api/admin/defaults', requireAdmin, async (req, res) => {
    try {
        const { defaults: defaultsInput = {}, presets: presetsInput = {} } = req.body || {};
        const config = await loadConfig();
        const mergedDefaults = { ...(config.defaults || {}) };
        const validated = validateSettings(defaultsInput);

        const particles = mergedDefaults.particles || {};
        const cursor = mergedDefaults.cursor || {};
        const panic = mergedDefaults.panicButton || mergedDefaults.panic || {};
        const disguise = mergedDefaults.tabDisguise || {};

        if (validated.accentColor !== undefined) mergedDefaults.accentColor = validated.accentColor;
        if (validated.proxyDefault !== undefined) mergedDefaults.proxyDefault = validated.proxyDefault;

        if (
            validated.particlesEnabled !== undefined || validated.particleCount !== undefined ||
            validated.particleSpeed !== undefined || validated.particleColor !== undefined ||
            validated.particleLineDistance !== undefined || validated.particleMouseInteraction !== undefined
        ) {
            mergedDefaults.particles = {
                ...particles,
                enabled: validated.particlesEnabled ?? particles.enabled,
                count: validated.particleCount ?? particles.count,
                speed: validated.particleSpeed ?? particles.speed,
                color: validated.particleColor ?? particles.color,
                lineDistance: validated.particleLineDistance ?? particles.lineDistance,
                mouse: validated.particleMouseInteraction ?? particles.mouse
            };
        }

        if (
            validated.cursorEnabled !== undefined || validated.cursorSize !== undefined ||
            validated.cursorColor !== undefined || validated.cursorType !== undefined
        ) {
            mergedDefaults.cursor = {
                ...cursor,
                enabled: validated.cursorEnabled ?? cursor.enabled,
                size: validated.cursorSize ?? cursor.size,
                color: validated.cursorColor ?? cursor.color,
                type: validated.cursorType ?? cursor.type
            };
        }

        if (
            validated.panicEnabled !== undefined || validated.panicUrl !== undefined ||
            validated.panicKeybind !== undefined || validated.panicPreset !== undefined
        ) {
            mergedDefaults.panicButton = {
                ...panic,
                enabled: validated.panicEnabled ?? panic.enabled,
                url: validated.panicUrl ?? panic.url,
                keybind: validated.panicKeybind ?? panic.keybind,
                preset: validated.panicPreset ?? panic.preset
            };
        }

        if (
            validated.tabDisguiseEnabled !== undefined || validated.tabDisguiseTitle !== undefined ||
            validated.tabDisguiseFavicon !== undefined || validated.tabDisguiseSource !== undefined ||
            validated.tabDisguisePreset !== undefined
        ) {
            mergedDefaults.tabDisguise = {
                ...disguise,
                enabled: validated.tabDisguiseEnabled ?? disguise.enabled,
                title: validated.tabDisguiseTitle ?? disguise.title,
                favicon: validated.tabDisguiseFavicon ?? disguise.favicon,
                sourceUrl: validated.tabDisguiseSource ?? disguise.sourceUrl,
                preset: validated.tabDisguisePreset ?? disguise.preset
            };
        }

        if (validated.showClock !== undefined) mergedDefaults.showClock = validated.showClock;
        if (validated.showCurrent !== undefined) mergedDefaults.showCurrent = validated.showCurrent;

        const currentPresets = normalizePresets(config);
        const panicButtons = Array.isArray(presetsInput.panicButtons)
            ? presetsInput.panicButtons.slice(0, 25).map((p, idx) => sanitizePanicPreset(p, p.id || `panic-${idx}`))
            : currentPresets.panicButtons;
        const tabDisguises = Array.isArray(presetsInput.tabDisguises)
            ? presetsInput.tabDisguises.slice(0, 25).map((p, idx) => sanitizeTabPreset(p, p.id || `disguise-${idx}`))
            : currentPresets.tabDisguises;

        mergedDefaults.presets = { panicButtons, tabDisguises };

        const nextConfig = { ...config, defaults: mergedDefaults };
        await saveConfig(nextConfig);
        res.json({ defaults: defaultSettingsFromConfig(nextConfig), presets: normalizePresets(nextConfig) });
    } catch (err) {
        res.status(400).json({ error: err.message || 'Failed to update defaults' });
    }
});

app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 288, ANALYTICS_RETENTION_MINUTES));
    const [config, players, friends, accounts, games] = await Promise.all([
        loadConfig(),
        loadAnalyticsFile(ANALYTICS_PLAYERS_FILE),
        loadAnalyticsFile(ANALYTICS_FRIENDS_FILE),
        loadAnalyticsFile(ANALYTICS_ACCOUNTS_FILE),
        loadAnalyticsFile(ANALYTICS_GAMES_FILE)
    ]);
    const enabled = config?.features?.analyticsEnabled !== false;
    if (!enabled) return res.json({ enabled: false });

    const sliceEntries = (data) => (Array.isArray(data?.entries) ? data.entries.slice(-limit) : []);
    res.json({
        enabled,
        retentionMinutes: ANALYTICS_RETENTION_MINUTES,
        players: sliceEntries(players),
        friends: sliceEntries(friends),
        accounts: sliceEntries(accounts),
        games: sliceEntries(games)
    });
});

app.get('/api/config', async (req, res) => {
    const [config, banner] = await Promise.all([loadConfig(), loadBannerConfig()]);
    res.json({ ...config, banner });
});

app.get('/api/admin/banner', requireAdmin, async (req, res) => {
    const banner = await loadBannerConfig();
    res.json({ banner });
});

app.put('/api/admin/banner', requireAdmin, async (req, res) => {
    try {
        const input = req.body || {};
        if (input.url && !isHttpUrl(input.url)) return res.status(400).json({ error: 'Invalid button URL' });
        if (input.button?.url && !isHttpUrl(input.button.url)) return res.status(400).json({ error: 'Invalid button URL' });
        const saved = await saveBannerConfig(input);
        res.json({ banner: saved });
    } catch (err) {
        res.status(400).json({ error: err.message || 'Failed to save banner' });
    }
});

app.get('/api/games', async (req, res) => {
    const { q, category } = req.query;
    const games = await loadGames();
    let filtered = games;
    if (q) {
        const term = q.toLowerCase();
        filtered = filtered.filter(g =>
            g.title.toLowerCase().includes(term) ||
            (g.description && g.description.toLowerCase().includes(term))
        );
    }
    if (category && category !== 'all') {
        filtered = filtered.filter(g => (g.category || '').toLowerCase() === category.toLowerCase());
    }
    res.json(filtered);
});

app.get('/api/games/:id', async (req, res) => {
    const games = await loadGames();
    const game = games.find(g => String(g.id) === String(req.params.id));
    if (!game) return res.status(404).json({ error: 'Game not found' });
    res.json(game);
});

app.get('/api/stats', async (req, res) => {
    const games = await loadGames();
    const categories = Array.from(new Set(games.map(g => g.category))).filter(Boolean);
    const gamesByCategory = categories.reduce((acc, cat) => {
        acc[cat] = games.filter(g => g.category === cat).length;
        return acc;
    }, {});
    res.json({
        totalGames: games.length,
        categories,
        categoryCount: categories.length,
        gamesByCategory,
        serverVersion: APP_VERSION
    });
});

// --- Auth endpoints
app.post('/api/auth/register', async (req, res) => {
    res.status(410).json({ error: 'Registration is handled by Auth0. Use the Auth0 SPA flow to sign up.' });
});

app.post('/api/auth/login', async (req, res) => {
    res.status(410).json({ error: 'Login is handled by Auth0. Use the Auth0 SPA flow to sign in.' });
});

app.post('/api/auth/logout', async (req, res) => {
    res.status(200).json({ success: true, message: 'Logout is handled client-side by clearing the Auth0 session/token.' });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
    const users = await loadUsers();
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });
    setPresence(me, { online: true });
    me.updatedAt = new Date().toISOString();
    await saveUsers(users);
    res.json({ user: sanitizeUser(me) });
});

// --- Profile
app.put('/api/profile', requireAuth, async (req, res) => {
    const { username, accentColor, avatar } = req.body || {};
    const users = await loadUsers();
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });

    if (username) {
        if (username.length < 3 || username.length > 24) return res.status(400).json({ error: 'Username must be 3-24 characters' });
        const clash = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.id !== me.id);
        if (clash) return res.status(409).json({ error: 'Username already taken' });
        me.username = username;
        me.profile.username = username;
    }
    if (accentColor) {
        if (!colorIsValid(accentColor)) return res.status(400).json({ error: 'Invalid accent color' });
        me.profile.accentColor = accentColor;
    }
    if (avatar !== undefined) {
        if (avatar && avatar.length > 2_000_000) return res.status(400).json({ error: 'Avatar too large' });
        me.profile.avatar = avatar || null;
    }
    me.updatedAt = new Date().toISOString();
    await saveUsers(users);
    res.json({ user: sanitizeUser(me) });
});

app.put('/api/profile/email', requireAuth, async (req, res) => {
    res.status(410).json({ error: 'Email updates are managed through Auth0. Please update your email in Auth0.' });
});

app.put('/api/profile/password', requireAuth, async (req, res) => {
    res.status(410).json({ error: 'Password changes are managed through Auth0. Use Auth0 to change your password.' });
});

app.delete('/api/profile', requireAuth, async (req, res) => {
    const { currentPassword } = req.body || {};
    const users = await loadUsers();
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });
    if (!me.banned?.active || currentPassword) {
        if (!currentPassword) return res.status(400).json({ error: 'Password required to delete account' });
        const ok = await bcrypt.compare(currentPassword, me.passwordHash || '');
        if (!ok) return res.status(401).json({ error: 'Invalid password' });
    }
    const remaining = users.filter((u) => u.id !== me.id);
    // remove from friends lists
    remaining.forEach((u) => {
        if (u.friends?.accepted) u.friends.accepted = u.friends.accepted.filter((id) => id !== me.id);
        if (u.friends?.incoming) u.friends.incoming = u.friends.incoming.filter((id) => id !== me.id);
        if (u.friends?.outgoing) u.friends.outgoing = u.friends.outgoing.filter((id) => id !== me.id);
        if (u.friends?.blocked) u.friends.blocked = u.friends.blocked.filter((id) => id !== me.id);
    });
    recordAccountEvent('deletions');
    await saveUsers(remaining);
    res.clearCookie(COOKIE_NAME);
    res.json({ success: true });
});

// --- Settings
function validateSettings(input) {
    const out = {};
    if (input.proxyDefault !== undefined) out.proxyDefault = !!input.proxyDefault;
    if (input.accentColor !== undefined) {
        if (!colorIsValid(input.accentColor)) throw new Error('Invalid accent color');
        out.accentColor = input.accentColor;
    }
    if (input.particlesEnabled !== undefined) out.particlesEnabled = !!input.particlesEnabled;
    if (input.particleCount !== undefined) {
        const n = Number(input.particleCount);
        if (!Number.isFinite(n) || n < 0 || n > 500) throw new Error('Invalid particle count');
        out.particleCount = Math.round(n);
    }
    if (input.particleSpeed !== undefined) {
        const n = Number(input.particleSpeed);
        if (!Number.isFinite(n) || n < 0 || n > 3) throw new Error('Invalid particle speed');
        out.particleSpeed = n;
    }
    if (input.particleColor !== undefined) {
        if (!colorIsValid(input.particleColor)) throw new Error('Invalid particle color');
        out.particleColor = input.particleColor;
    }
    if (input.particleLineDistance !== undefined) {
        const n = Number(input.particleLineDistance);
        if (!Number.isFinite(n) || n < 10 || n > 600) throw new Error('Invalid line distance');
        out.particleLineDistance = Math.round(n);
    }
    if (input.particleMouseInteraction !== undefined) out.particleMouseInteraction = !!input.particleMouseInteraction;
    if (input.cursorEnabled !== undefined) out.cursorEnabled = !!input.cursorEnabled;
    if (input.cursorSize !== undefined) {
        const n = Number(input.cursorSize);
        if (!Number.isFinite(n) || n < 4 || n > 48) throw new Error('Invalid cursor size');
        out.cursorSize = Math.round(n);
    }
    if (input.cursorColor !== undefined) {
        if (!colorIsValid(input.cursorColor)) throw new Error('Invalid cursor color');
        out.cursorColor = input.cursorColor;
    }
    if (input.cursorType !== undefined) {
        const allowed = ['circle', 'dot', 'none', 'custom'];
        if (!allowed.includes(input.cursorType)) throw new Error('Invalid cursor type');
        out.cursorType = input.cursorType;
    }
    if (input.showClock !== undefined) out.showClock = !!input.showClock;
    if (input.showCurrent !== undefined) out.showCurrent = !!input.showCurrent;
    if (input.panicEnabled !== undefined) out.panicEnabled = !!input.panicEnabled;
    if (input.panicUrl !== undefined) {
        if (input.panicUrl && !isHttpUrl(input.panicUrl)) throw new Error('Invalid panic URL');
        out.panicUrl = input.panicUrl || '';
    }
    if (input.panicKeybind !== undefined) {
        out.panicKeybind = String(input.panicKeybind || '').slice(0, 80);
    }
    if (input.panicPreset !== undefined) {
        out.panicPreset = String(input.panicPreset || '');
    }
    if (input.tabDisguiseEnabled !== undefined) out.tabDisguiseEnabled = !!input.tabDisguiseEnabled;
    if (input.tabDisguiseTitle !== undefined) {
        out.tabDisguiseTitle = String(input.tabDisguiseTitle || '').slice(0, 120);
    }
    if (input.tabDisguiseFavicon !== undefined) {
        if (input.tabDisguiseFavicon && !isIconUrl(input.tabDisguiseFavicon)) throw new Error('Invalid tab favicon');
        out.tabDisguiseFavicon = input.tabDisguiseFavicon || '';
    }
    if (input.tabDisguiseSource !== undefined) {
        if (input.tabDisguiseSource && !isHttpUrl(input.tabDisguiseSource)) throw new Error('Invalid tab source URL');
        out.tabDisguiseSource = input.tabDisguiseSource || '';
    }
    if (input.tabDisguisePreset !== undefined) {
        out.tabDisguisePreset = String(input.tabDisguisePreset || '');
    }
    return out;
}

app.get('/api/settings', requireAuth, async (req, res) => {
    const users = await loadUsers();
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });
    const config = await loadConfig();
    const defaults = defaultSettingsFromConfig(config);
    const presets = normalizePresets(config);
    res.json({ settings: { ...defaults, ...(me.settings || {}) }, defaults, presets });
});

app.put('/api/settings', requireAuth, async (req, res) => {
    const users = await loadUsers();
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });
    try {
        const update = validateSettings(req.body || {});
        me.settings = { ...(me.settings || defaultSettingsFromConfig(await loadConfig())), ...update };
        me.updatedAt = new Date().toISOString();
        await saveUsers(users);
        res.json({ settings: me.settings });
    } catch (err) {
        res.status(400).json({ error: err.message || 'Invalid settings' });
    }
});

app.post('/api/utils/page-meta', requireAuth, async (req, res) => {
    const { url } = req.body || {};
    if (!isHttpUrl(url)) return res.status(400).json({ error: 'Invalid URL' });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
        const resp = await fetch(url, { redirect: 'follow', signal: controller.signal });
        const base = resp.url || url;
        const text = await resp.text();
        const html = text.slice(0, 200_000);
        const meta = extractMetaFromHtml(html, base);
        res.json({ title: meta.title, favicon: meta.favicon });
    } catch (err) {
        res.status(400).json({ error: 'Unable to fetch page metadata' });
    } finally {
        clearTimeout(timer);
    }
});

// --- Favorites
app.get('/api/favorites', requireAuth, async (req, res) => {
    const users = await loadUsers();
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });
    res.json({ favorites: me.favorites || [] });
});

app.post('/api/favorites/toggle', requireAuth, async (req, res) => {
    const { gameId } = req.body || {};
    if (!gameId) return res.status(400).json({ error: 'gameId is required' });
    const users = await loadUsers();
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });
    const id = String(gameId);
    const has = (me.favorites || []).includes(id);
    me.favorites = has ? me.favorites.filter(g => g !== id) : [...(me.favorites || []), id];
    me.updatedAt = new Date().toISOString();
    await saveUsers(users);
    res.json({ favorites: me.favorites });
});

// --- Friends
function resolveFriendList(users, ids = [], now = Date.now()) {
    return ids
        .map(id => users.find(u => u.id === id))
        .filter(Boolean)
        .map(u => ({
            id: u.id,
            username: u.username,
            avatar: u.profile?.avatar,
            accentColor: u.profile?.accentColor,
            presence: {
                online: isUserOnline(u, now),
                gameId: u.presence?.gameId || null,
                lastSeen: u.presence?.lastSeen || null
            }
        }));
}

function ensureFriendStruct(user) {
    user.friends = user.friends || { accepted: [], incoming: [], outgoing: [], blocked: [] };
    user.friends.accepted = user.friends.accepted || [];
    user.friends.incoming = user.friends.incoming || [];
    user.friends.outgoing = user.friends.outgoing || [];
    user.friends.blocked = user.friends.blocked || [];
}

app.get('/api/friends', requireAuth, async (req, res) => {
    const users = await loadUsers();
    const me = req.me || await getUserById(users, req.user.id);
    if (!me) {
        res.clearCookie(COOKIE_NAME);
        res.clearCookie(LEGACY_SESSION_COOKIE);
        return res.status(401).json({ error: 'Session expired' });
    }
    ensureFriendStruct(me);
    ensurePresence(me);
    const now = Date.now();
    const friends = resolveFriendList(users, me.friends?.accepted || [], now);
    const incoming = resolveFriendList(users, me.friends?.incoming || [], now);
    const outgoing = resolveFriendList(users, me.friends?.outgoing || [], now);
    const blocked = resolveFriendList(users, me.friends?.blocked || [], now);
    res.json({ friends, incomingRequests: incoming, outgoingRequests: outgoing, blocked });
});

app.post('/api/friends/request', requireAuth, async (req, res) => {
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: 'Username is required' });
    const users = await loadUsers();
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });
    const target = await getUserByUsername(users, username);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (target.id === me.id) return res.status(400).json({ error: 'Cannot add yourself' });

    ensureFriendStruct(me);
    ensureFriendStruct(target);

    if (me.friends.blocked.includes(target.id) || target.friends.blocked.includes(me.id)) {
        return res.status(403).json({ error: 'User is blocked' });
    }

    if (me.friends.accepted.includes(target.id)) return res.status(409).json({ error: 'Already friends' });
    if (me.friends.outgoing.includes(target.id)) return res.status(409).json({ error: 'Request already sent' });
    if (me.friends.incoming.includes(target.id)) return res.status(409).json({ error: 'They already sent you a request' });

    me.friends.outgoing.push(target.id);
    target.friends.incoming.push(me.id);
    me.updatedAt = target.updatedAt = new Date().toISOString();
    recordFriendEvent('sent');
    await saveUsers(users);
    res.status(201).json({ success: true });
});

app.post('/api/friends/respond', requireAuth, async (req, res) => {
    const { username, action } = req.body || {};
    if (!username || !action) return res.status(400).json({ error: 'Username and action are required' });
    const users = await loadUsers();
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });
    const other = await getUserByUsername(users, username);
    if (!other) return res.status(404).json({ error: 'User not found' });

    ensureFriendStruct(me);
    ensureFriendStruct(other);

    me.friends.incoming = me.friends.incoming.filter(id => id !== other.id);
    other.friends.outgoing = other.friends.outgoing.filter(id => id !== me.id);

    if (action === 'accept') {
        if (!me.friends.accepted.includes(other.id)) me.friends.accepted.push(other.id);
        if (!other.friends.accepted.includes(me.id)) other.friends.accepted.push(me.id);
        recordFriendEvent('accepted');
    } else {
        recordFriendEvent('rejected');
    }

    me.updatedAt = other.updatedAt = new Date().toISOString();
    await saveUsers(users);
    res.json({ success: true });
});

app.post('/api/friends/cancel', requireAuth, async (req, res) => {
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: 'Username is required' });
    const users = await loadUsers();
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });
    const other = await getUserByUsername(users, username);
    if (!other) return res.status(404).json({ error: 'User not found' });

    ensureFriendStruct(me);
    ensureFriendStruct(other);

    me.friends.outgoing = me.friends.outgoing.filter(id => id !== other.id);
    other.friends.incoming = other.friends.incoming.filter(id => id !== me.id);
    me.updatedAt = other.updatedAt = new Date().toISOString();
    await saveUsers(users);
    res.json({ success: true });
});

app.post('/api/friends/remove', requireAuth, async (req, res) => {
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: 'Username is required' });
    const users = await loadUsers();
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });
    const other = await getUserByUsername(users, username);
    if (!other) return res.status(404).json({ error: 'User not found' });

    ensureFriendStruct(me);
    ensureFriendStruct(other);

    me.friends.accepted = me.friends.accepted.filter(id => id !== other.id);
    other.friends.accepted = other.friends.accepted.filter(id => id !== me.id);
    me.updatedAt = other.updatedAt = new Date().toISOString();
    await saveUsers(users);
    res.json({ success: true });
});

// Block / Unblock
app.post('/api/friends/block', requireAuth, async (req, res) => {
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: 'Username is required' });
    const users = await loadUsers();
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });
    const other = await getUserByUsername(users, username);
    if (!other) return res.status(404).json({ error: 'User not found' });

    ensureFriendStruct(me);
    ensureFriendStruct(other);

    if (!me.friends.blocked.includes(other.id)) me.friends.blocked.push(other.id);
    me.friends.accepted = me.friends.accepted.filter(id => id !== other.id);
    me.friends.incoming = me.friends.incoming.filter(id => id !== other.id);
    me.friends.outgoing = me.friends.outgoing.filter(id => id !== other.id);

    other.friends.accepted = other.friends.accepted.filter(id => id !== me.id);
    other.friends.incoming = other.friends.incoming.filter(id => id !== me.id);
    other.friends.outgoing = other.friends.outgoing.filter(id => id !== me.id);

    me.updatedAt = other.updatedAt = new Date().toISOString();
    await saveUsers(users);
    res.json({ success: true });
});

app.post('/api/friends/unblock', requireAuth, async (req, res) => {
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: 'Username is required' });
    const users = await loadUsers();
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });
    const other = await getUserByUsername(users, username);
    if (!other) return res.status(404).json({ error: 'User not found' });
    ensureFriendStruct(me);
    me.friends.blocked = me.friends.blocked.filter(id => id !== other.id);
    me.updatedAt = new Date().toISOString();
    await saveUsers(users);
    res.json({ success: true });
});

// --- Heartbeat (online tracking for authenticated and guest users)
app.post('/api/online/ping', async (req, res) => {
    const { online = true, gameId } = req.body || {};
    const now = Date.now();
    pruneGuestHeartbeats(now);

    const token = getAccessToken(req);
    let users = null;
    let me = null;

    if (token) {
        try {
            const claims = await verifyAuth0Token(token);
            const ensured = await ensureLocalUserFromClaims(claims);
            users = ensured.users;
            me = ensured.user;
        } catch (_) {
            users = null;
            me = null;
        }
    }

    if (me) {
        const nextGameId = gameId === undefined ? (me.presence?.gameId || null) : gameId;
        setPresence(me, { online: online !== false, gameId: nextGameId });
        if (nextGameId) updateLastPlayed(me, nextGameId);
        me.updatedAt = new Date().toISOString();
        await saveUsers(users);
        const existingGuest = req.cookies[GUEST_COOKIE] || req.cookies[LEGACY_GUEST_COOKIE];
        if (existingGuest) guestHeartbeats.delete(existingGuest);
    } else {
        let guestId = req.cookies[GUEST_COOKIE] || req.cookies[LEGACY_GUEST_COOKIE] || crypto.randomUUID();
        if (online === false) {
            guestHeartbeats.delete(guestId);
        } else {
            guestHeartbeats.set(guestId, now);
        }
        res.cookie(GUEST_COOKIE, guestId, {
            httpOnly: false,
            secure: false,
            sameSite: 'lax',
            maxAge: 1000 * 60 * 60 * 24 * 7
        });
        res.clearCookie(LEGACY_GUEST_COOKIE);
    }

    const onlineGuests = guestOnlineCount(now);
    const onlineUsers = users ? users.filter(u => isUserOnline(u, now)).length : null;
    res.json({
        ok: true,
        onlineGuests,
        onlineUsers,
        lastPlayed: me?.profile?.lastPlayed || [],
        playtime: normalizePlaytime(me?.profile?.playtime)
    });
});

app.post('/api/playtime', requireAuth, async (req, res) => {
    const { gameId, deltaMs } = req.body || {};
    if (!gameId) return res.status(400).json({ error: 'gameId is required' });
    const delta = Number(deltaMs);
    if (!Number.isFinite(delta) || delta <= 0) return res.status(400).json({ error: 'deltaMs must be positive' });

    const users = await loadUsers();
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });

    addPlaytime(me, gameId, delta);
    updateLastPlayed(me, gameId);
    me.updatedAt = new Date().toISOString();
    await saveUsers(users);

    res.json({ playtime: normalizePlaytime(me.profile.playtime), lastPlayed: me.profile.lastPlayed });
});

// --- Presence
app.get('/api/presence', requireAuth, async (req, res) => {
    const users = await loadUsers();
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });
    ensurePresence(me);
    const now = Date.now();
    res.json({ presence: { ...me.presence, online: isUserOnline(me, now) } });
});

app.put('/api/presence', requireAuth, async (req, res) => {
    const { online, gameId } = req.body || {};
    const users = await loadUsers();
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });
    if (gameId !== undefined && gameId !== null && String(gameId).length > 128) {
        return res.status(400).json({ error: 'Invalid gameId' });
    }
    setPresence(me, { online, gameId: gameId === undefined ? me.presence?.gameId || null : gameId });
    me.updatedAt = new Date().toISOString();
    await saveUsers(users);
    res.json({ presence: me.presence });
});

app.get('/api/presence/friends', requireAuth, async (req, res) => {
    const users = await loadUsers();
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });
    ensureFriendStruct(me);
    const friends = resolveFriendList(users, me.friends?.accepted || [], Date.now());
    res.json({ friends });
});

// --- Proxy
const BLOCKED_HEADERS = ['content-security-policy', 'content-security-policy-report-only', 'x-frame-options', 'strict-transport-security'];

app.get('/proxy', async (req, res) => {
    const target = req.query.url;
    if (!target) return res.status(400).json({ error: 'url query parameter is required' });
    let parsed;
    try {
        parsed = new URL(target);
    } catch (err) {
        return res.status(400).json({ error: 'Invalid URL' });
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) return res.status(400).json({ error: 'Only http/https allowed' });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
        const upstream = await fetch(parsed.toString(), {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal
        });
        res.status(upstream.status);
        upstream.headers.forEach((value, key) => {
            if (BLOCKED_HEADERS.includes(key.toLowerCase())) return;
            res.setHeader(key, value);
        });
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Expose-Headers', '*');
        res.setHeader('Cache-Control', 'no-store');

        if (!upstream.body) return res.end();
        Readable.fromWeb(upstream.body).pipe(res);
    } catch (err) {
        const status = err.name === 'AbortError' ? 504 : 500;
        res.status(status).json({ error: 'Proxy fetch failed', detail: err.message });
    } finally {
        clearTimeout(timeout);
    }
});

// --- SEO sitemap
app.get('/sitemap.xml', async (req, res) => {
    try {
        const games = await loadGames();
        const base = resolveBaseUrl(req);
        const xml = await generateSitemapXml(games, base);
        res.type('application/xml').send(xml);
        regenerateSitemap(games, base).catch((err) => console.error('Failed to persist sitemap', err));
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate sitemap' });
    }
});

regenerateSitemap().catch((err) => console.error('Failed to generate initial sitemap', err));

// --- Static assets
app.use('/images', express.static(IMAGES_DIR, { maxAge: '1d', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif'] }));

// --- Static frontend
app.use(express.static(FRONTEND_DIR, { extensions: ['html'] }));
app.get('*', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`✅ Jettic Games backend running on http://localhost:${PORT}`);
});
