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

const APP_VERSION = '3.0.0';
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const GAMES_FILE = path.join(DATA_DIR, 'games.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
const COOKIE_NAME = 'ww_session';

const app = express();

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
        friends: user.friends || { accepted: [], incoming: [], outgoing: [] },
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

// --- Ensure data files exist on startup
(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await ensureFile(USERS_FILE, { users: [] });
    await ensureFile(GAMES_FILE, []);
    await ensureFile(CONFIG_FILE, {});
})();

// --- Core endpoints
app.get('/health', async (req, res) => {
    const games = await loadGames();
    res.json({
        status: 'ok',
        version: APP_VERSION,
        time: new Date().toISOString(),
        games: games.length
    });
});

app.get('/api/config', async (req, res) => {
    const config = await loadConfig();
    res.json(config);
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
        friends: { accepted: [], incoming: [], outgoing: [] },
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

    const token = signToken(user);
    setSessionCookie(res, token);
    res.json({ user: sanitizeUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME);
    res.json({ success: true });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
    const users = await loadUsers();
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });
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
function resolveFriendList(users, ids = []) {
    return ids
        .map(id => users.find(u => u.id === id))
        .filter(Boolean)
        .map(u => ({ id: u.id, username: u.username, avatar: u.profile?.avatar, accentColor: u.profile?.accentColor }));
}

app.get('/api/friends', requireAuth, async (req, res) => {
    const users = await loadUsers();
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });
    const friends = resolveFriendList(users, me.friends?.accepted || []);
    const incoming = resolveFriendList(users, me.friends?.incoming || []);
    const outgoing = resolveFriendList(users, me.friends?.outgoing || []);
    res.json({ friends, incomingRequests: incoming, outgoingRequests: outgoing });
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

    me.friends = me.friends || { accepted: [], incoming: [], outgoing: [] };
    target.friends = target.friends || { accepted: [], incoming: [], outgoing: [] };

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

    me.friends = me.friends || { accepted: [], incoming: [], outgoing: [] };
    other.friends = other.friends || { accepted: [], incoming: [], outgoing: [] };

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

app.post('/api/friends/remove', requireAuth, async (req, res) => {
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: 'Username is required' });
    const users = await loadUsers();
    const me = await getUserById(users, req.user.id);
    if (!me) return res.status(404).json({ error: 'User not found' });
    const other = await getUserByUsername(users, username);
    if (!other) return res.status(404).json({ error: 'User not found' });

    me.friends = me.friends || { accepted: [], incoming: [], outgoing: [] };
    other.friends = other.friends || { accepted: [], incoming: [], outgoing: [] };

    me.friends.accepted = me.friends.accepted.filter(id => id !== other.id);
    other.friends.accepted = other.friends.accepted.filter(id => id !== me.id);
    me.updatedAt = other.updatedAt = new Date().toISOString();
    await saveUsers(users);
    res.json({ success: true });
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
