const path = require('path');
const fs = require('fs/promises');
const { Readable } = require('stream');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const morgan = require('morgan');
const yaml = require('js-yaml');

const APP_VERSION = '3.0.0';
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const GAMES_FILE = path.join(DATA_DIR, 'games.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const BANNER_FILE = path.join(DATA_DIR, 'banner.yaml');
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const COOKIE_NAME = 'ww_session';
const GUEST_COOKIE = 'ww_guest';
const ONLINE_WINDOW_MS = 60 * 1000; // users must ping within last 60 seconds to count as online

const app = express();

// In-memory heartbeat tracking for guests (non-authenticated visitors)
const guestHeartbeats = new Map();

// --- Middleware
app.disable('x-powered-by');
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());
app.use(morgan('dev'));

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

async function readJson(file, fallback) {
    try {
        const raw = await fs.readFile(file, 'utf8');
        return JSON.parse(raw);
    } catch (_) {
        return fallback;
    }
}

async function writeJson(file, data) {
    await fs.writeFile(file, JSON.stringify(data, null, 2));
}

async function loadConfig() {
    return readJson(CONFIG_FILE, {
        version: APP_VERSION,
        maintenanceMode: { enabled: false },
        features: {},
        uiControls: {},
        defaults: {}
    });
}

async function loadBannerConfig() {
    try {
        const raw = await fs.readFile(BANNER_FILE, 'utf8');
        const data = yaml.load(raw);
        if (!data || data.enabled === false) return null;
        const button = data.button || {};
        return {
            id: String(data.id || 'default'),
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

function defaultSettingsFromConfig(config) {
    const d = config.defaults || {};
    const particles = d.particles || {};
    const cursor = d.cursor || {};
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
        cursorType: ['circle', 'dot', 'none', 'custom'].includes(cursor.type) ? cursor.type : 'circle'
    };
}

async function loadGames() {
    const data = await readJson(GAMES_FILE, []);
    return Array.isArray(data) ? data : data.games || [];
}

async function loadUsers() {
    const data = await readJson(USERS_FILE, { users: [] });
    return Array.isArray(data) ? data : data.users || [];
}

async function saveUsers(users) {
    await writeJson(USERS_FILE, { users });
}

function sanitizeUser(user) {
    if (!user) return null;
    return {
        id: user.id,
        username: user.username,
        profile: user.profile || {},
        favorites: user.favorites || [],
        friends: user.friends || { accepted: [], incoming: [], outgoing: [], blocked: [] },
        settings: user.settings || {},
        presence: user.presence || { online: false, gameId: null, lastSeen: null },
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    };
}

function signToken(user) {
    return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}

function requireAuth(req, res, next) {
    const token = req.cookies[COOKIE_NAME];
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        return next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid session' });
    }
}

function setSessionCookie(res, token) {
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7
    });
}

async function getUserById(users, id) {
    return users.find(u => u.id === id);
}

async function getUserByUsername(users, username) {
    return users.find(u => u.username.toLowerCase() === username.toLowerCase());
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

// --- Ensure data files exist on startup
(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await ensureFile(USERS_FILE, { users: [] });
    await ensureFile(GAMES_FILE, []);
    await ensureFile(CONFIG_FILE, {});
        await ensureFile(BANNER_FILE, `enabled: true
id: default
message: "Welcome to WaterWall!"
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

app.get('/api/config', async (req, res) => {
    const [config, banner] = await Promise.all([loadConfig(), loadBannerConfig()]);
    res.json({ ...config, banner });
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
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
    if (username.length < 3 || username.length > 24) return res.status(400).json({ error: 'Username must be 3-24 characters' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const users = await loadUsers();
    const config = await loadConfig();
    const defaultSettings = defaultSettingsFromConfig(config);
    const existing = await getUserByUsername(users, username);
    if (existing) return res.status(409).json({ error: 'Username already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    const user = {
        id: crypto.randomUUID(),
        username,
        passwordHash,
        favorites: [],
        profile: {
            username,
            accentColor: (await loadConfig()).defaults?.accentColor || '#58a6ff',
            avatar: null
        },
        settings: defaultSettings,
        friends: { accepted: [], incoming: [], outgoing: [], blocked: [] },
        presence: { online: true, gameId: null, lastSeen: now },
        createdAt: now,
        updatedAt: now
    };
    users.push(user);
    await saveUsers(users);

    const token = signToken(user);
    setSessionCookie(res, token);
    res.status(201).json({ user: sanitizeUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

    const users = await loadUsers();
    const user = await getUserByUsername(users, username);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.passwordHash || '');
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    setPresence(user, { online: true });
    user.updatedAt = new Date().toISOString();
    await saveUsers(users);

    const token = signToken(user);
    setSessionCookie(res, token);
    res.json({ user: sanitizeUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME);
    (async () => {
        const users = await loadUsers();
        const token = req.cookies[COOKIE_NAME];
        if (token) {
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                const me = await getUserById(users, decoded.id);
                if (me) {
                    setPresence(me, { online: false, gameId: null });
                    me.updatedAt = new Date().toISOString();
                    await saveUsers(users);
                }
            } catch (_) {}
        }
    })();
    res.json({ success: true });
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
    const token = signToken(me);
    setSessionCookie(res, token);
    res.json({ user: sanitizeUser(me) });
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
    return out;
}

app.get('/api/settings', requireAuth, async (req, res) => {
    const users = await loadUsers();
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });
    res.json({ settings: me.settings || defaultSettingsFromConfig(await loadConfig()) });
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
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });
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

    const token = req.cookies[COOKIE_NAME];
    const decoded = token ? decodeSessionToken(token) : null;
    let users = null;
    let me = null;

    if (decoded?.id) {
        users = await loadUsers();
        me = await getUserById(users, decoded.id);
    }

    if (me) {
        const nextGameId = gameId === undefined ? (me.presence?.gameId || null) : gameId;
        setPresence(me, { online: online !== false, gameId: nextGameId });
        me.updatedAt = new Date().toISOString();
        await saveUsers(users);
        const existingGuest = req.cookies[GUEST_COOKIE];
        if (existingGuest) guestHeartbeats.delete(existingGuest);
    } else {
        let guestId = req.cookies[GUEST_COOKIE] || crypto.randomUUID();
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
    }

    const onlineGuests = guestOnlineCount(now);
    const onlineUsers = users ? users.filter(u => isUserOnline(u, now)).length : null;
    res.json({ ok: true, onlineGuests, onlineUsers });
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

// --- Static frontend
app.use(express.static(FRONTEND_DIR, { extensions: ['html'] }));
app.get('*', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`✅ WaterWall backend running on http://localhost:${PORT}`);
});
