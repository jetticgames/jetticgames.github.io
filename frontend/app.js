// Jettic Games frontend v3 - rebuilt
(() => {
    'use strict';

    const backendUrl = window.JETTIC_BACKEND_URL || window.location.origin;
    const ONLINE_PING_INTERVAL = 30 * 1000;

    const state = {
        games: [],
        filtered: [],
        categories: [],
        favorites: new Set(),
        banner: null,
        user: null,
        friends: { friends: [], incomingRequests: [], outgoingRequests: [], blocked: [] },
        settings: null,
        currentGame: null,
        proxyEnabled: false
    };

    const runtime = {
        cursorEl: null,
        cursorHandler: null,
        particle: { canvas: null, ctx: null, particles: [], anim: null },
        friendsPoll: null,
        friendsSnapshot: null,
        friendsPlayingMap: new Map(),
        onlinePing: null,
        healthPoll: null,
        currentPage: 'home',
        clockTimer: null,
        closingGame: null,
        closeTicker: null,
        settingsSaveTimer: null
    };

    const els = {};

    const api = {
        async request(path, options = {}) {
            const res = await fetch(`${backendUrl}${path}`, {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
                ...options
            });
            if (!res.ok) {
                let msg = res.statusText;
                try { msg = (await res.json()).error || msg; } catch (_) {}
                const err = new Error(msg);
                err.status = res.status;
                throw err;
            }
            const ct = res.headers.get('content-type') || '';
            return ct.includes('application/json') ? res.json() : res.text();
        },
        get: (p) => api.request(p),
        post: (p, b) => api.request(p, { method: 'POST', body: JSON.stringify(b || {}) }),
        put: (p, b) => api.request(p, { method: 'PUT', body: JSON.stringify(b || {}) })
    };

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        cacheElements();
        bindNavigation();
        bindAuthModal();
        bindSettingsForm();
        bindFriendsUI();
        bindFavoritesUI();
        bindGameControls();
        bindLogoutModal();
        registerServiceWorker();
        applyClockSetting(true);
        applyCurrentSectionSetting(true);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') sendOnlinePing();
        });
        window.addEventListener('focus', () => sendOnlinePing());
        setActiveNav('home');
        showPage('home');
        loadInitial();
    }

    function cacheElements() {
        Object.assign(els, {
            loader: document.getElementById('appPageLoader'),
            navItems: Array.from(document.querySelectorAll('.nav-item')),
            pages: {
                home: document.getElementById('homePage'),
                favorites: document.getElementById('favoritesPage'),
                friends: document.getElementById('friendsPage'),
                settings: document.getElementById('settingsPage'),
                profile: document.getElementById('profilePage'),
                game: document.getElementById('gamePage')
            },
            statsGames: document.querySelector('[data-stat="games"]'),
            statsCategories: document.querySelector('[data-stat="categories"]'),
            statusDot: document.getElementById('statusDot'),
            statusText: document.getElementById('statusText'),
            statusClockText: document.getElementById('statusClockText'),
            headerClock: document.getElementById('headerClock'),
            searchInput: document.getElementById('searchInput'),
            homeBanner: document.getElementById('homeBanner'),
            categoryTabs: document.getElementById('categoryTabs'),
            allGames: document.getElementById('allGames'),
            favoritesGrid: document.getElementById('favoritesGrid'),
            favoritesEmpty: document.getElementById('favoritesEmpty'),
            favoritesLoginBox: document.getElementById('favoritesLoginBox'),
            favoritesLoginNotice: document.getElementById('favoritesLoginNotice'),
            favoritesLoginBtn: document.getElementById('favoritesLoginBtn'),
            accountNavItem: document.getElementById('accountNavItem'),
            accountLabel: document.getElementById('accountLabel'),
            accountAvatar: document.getElementById('accountAvatar'),
            profileDropdown: document.getElementById('profileDropdown'),
            openProfileSettingsBtn: document.getElementById('openProfileSettingsBtn'),
            openSettingsBtn: document.getElementById('openSettingsBtn'),
            logoutFromDropdownBtn: document.getElementById('logoutFromDropdownBtn'),
            friendsAuthNotice: document.getElementById('friendsAuthNotice'),
            friendsAuthNoticeBox: document.getElementById('friendsAuthNoticeBox'),
            friendsContent: document.getElementById('friendsContent'),
            friendsTabNav: document.getElementById('friendsTabNav'),
            friendsTabPanels: Array.from(document.querySelectorAll('.friends-tab-panel')),
            friendsList: document.getElementById('friendsList'),
            manageFriendsList: document.getElementById('manageFriendsList'),
            manageIncomingList: document.getElementById('manageIncomingList'),
            manageOutgoingList: document.getElementById('manageOutgoingList'),
            blockedList: document.getElementById('blockedList'),
            openAddFriendModalBtn: document.getElementById('openAddFriendModalBtn'),
            openAddFriendModalBtnInline: document.getElementById('openAddFriendModalBtnInline'),
            addFriendModal: document.getElementById('addFriendModal'),
            addFriendModalForm: document.getElementById('addFriendModalForm'),
            addFriendModalInput: document.getElementById('addFriendModalInput'),
            addFriendModalFeedback: document.getElementById('addFriendModalFeedback'),
            closeAddFriendModal: document.getElementById('closeAddFriendModal'),
            addFriendModalOverlay: document.getElementById('addFriendModalOverlay'),
            friendsLoginBtn: document.getElementById('friendsLoginBtn'),
            friendsCount: document.getElementById('friendsCount'),
            pendingCount: document.getElementById('pendingCount'),
            profileForm: document.getElementById('profileForm'),
            profileUsername: document.getElementById('profileUsername'),
            profileColor: document.getElementById('profileColor'),
            avatarInput: document.getElementById('avatarInput'),
            avatarPreview: document.getElementById('avatarPreview'),
            avatarPlaceholder: document.getElementById('avatarPlaceholder'),
            profileSaveIndicator: document.getElementById('profileSaveIndicator'),
            settingAccent: document.getElementById('settingAccent'),
            settingProxyDefault: document.getElementById('settingProxyDefault'),
            settingParticles: document.getElementById('settingParticles'),
            settingParticleCount: document.getElementById('settingParticleCount'),
            settingParticleSpeed: document.getElementById('settingParticleSpeed'),
            settingCursor: document.getElementById('settingCursor'),
            settingCursorSize: document.getElementById('settingCursorSize'),
            settingCursorColor: document.getElementById('settingCursorColor'),
            settingShowClock: document.getElementById('settingShowClock'),
            settingsFeedback: document.getElementById('settingsFeedback'),
            gameFrame: document.getElementById('gameFrame'),
            gameTitle: document.getElementById('gameTitle'),
            gameCategory: document.getElementById('gameCategory'),
            gameDescription: document.getElementById('gameDescription'),
            gameFriendAvatars: document.getElementById('gameFriendAvatars'),
            gameLoadingOverlay: document.getElementById('gameLoadingOverlay'),
            loadingStatusText: document.getElementById('loadingStatusText'),
            loadingHintText: document.getElementById('loadingHintText'),
            loadingProxyToggle: document.getElementById('loadingProxyToggle'),
            proxyToggleGame: document.getElementById('proxyToggleGame'),
            gameFavBtn: document.getElementById('gameFavBtn'),
            fullscreenBtn: document.getElementById('fullscreenBtn'),
            offlineOverlays: document.getElementById('offlineOverlays'),
            authModal: document.getElementById('authModal'),
            authTabs: Array.from(document.querySelectorAll('.auth-tab')),
            authForm: document.getElementById('authForm'),
            authFeedback: document.getElementById('authFeedback'),
            closeAuthModal: document.getElementById('closeAuthModal'),
            logoutConfirmModal: document.getElementById('logoutConfirmModal'),
            logoutConfirmBtn: document.getElementById('logoutConfirmBtn'),
            logoutCancelBtn: document.getElementById('logoutCancelBtn'),
            toast: document.getElementById('jg-toast'),
            notificationStack: document.getElementById('notificationStack'),
            sidebarCurrentPlaying: document.getElementById('sidebarCurrentPlaying'),
            sidebarHistory: document.getElementById('sidebarHistory'),
            sidebarOnlineFriends: document.getElementById('sidebarOnlineFriends'),
            sidebarCurrentSection: document.getElementById('sidebarCurrentSection'),
            sidebarHistorySection: document.getElementById('sidebarHistorySection'),
            sidebarOnlineSection: document.getElementById('sidebarOnlineSection'),
            settingShowCurrent: document.getElementById('settingShowCurrent')
        });
    }

    function bindNavigation() {
        els.navItems.forEach((item) => item.addEventListener('click', (e) => {
            const page = item.dataset.page;
            if (!page) return; // Skip non-navigation items like account
            e.preventDefault();
            setActiveNav(page);
            showPage(page);
        }));

        els.accountNavItem?.addEventListener('click', (e) => {
            e.preventDefault();
            if (state.user) {
                toggleAccountDropdown();
            } else {
                openAuthModal('login');
            }
        });

        els.openProfileSettingsBtn?.addEventListener('click', () => { hideProfileDropdown(); showPage('profile'); });
        els.openSettingsBtn?.addEventListener('click', () => { hideProfileDropdown(); showPage('settings'); });
        els.logoutFromDropdownBtn?.addEventListener('click', () => { hideProfileDropdown(); showLogoutConfirm(); });

        document.addEventListener('click', (e) => {
            if (e.target.closest('#accountNavItem') || e.target.closest('#accountDropdown')) return;
            hideAccountDropdown();
        });

        document.getElementById('accountProfileBtn')?.addEventListener('click', () => { hideAccountDropdown(); showPage('profile'); });
        document.getElementById('accountLogoutBtn')?.addEventListener('click', () => { hideAccountDropdown(); showLogoutConfirm(); });
    }

    function bindAuthModal() {
        els.authTabs.forEach((tab) => tab.addEventListener('click', () => {
            els.authTabs.forEach((t) => t.classList.toggle('active', t === tab));
            els.authModal.dataset.mode = tab.dataset.tab;
        }));
        els.closeAuthModal?.addEventListener('click', closeAuthModal);
        els.authModal?.querySelector('.modal-overlay')?.addEventListener('click', closeAuthModal);
        els.authForm?.addEventListener('submit', handleAuthSubmit);
    }

    function bindSearch() {
        els.searchInput?.addEventListener('input', () => filterAndRender());
    }

    function bindProfileForm() {
        if (!els.profileForm) return;
        els.profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!state.user) return openAuthModal('login');
            const payload = {
                username: els.profileUsername.value.trim(),
                accentColor: els.profileColor.value,
                avatar: els.avatarPreview?.dataset?.value || null
            };
            toggleSaving(true);
            try {
                const { user } = await api.put('/api/profile', payload);
                state.user = normalizeUser(user);
                state.settings = user.settings || state.settings;
                applyAccent(user.profile?.accentColor);
                showToast('Profile saved');
                populateProfileForm();
            } catch (err) {
                showToast(err.message || 'Failed to save profile', true);
            } finally {
                toggleSaving(false);
            }
        });

        els.avatarInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 1.5 * 1024 * 1024) {
                showToast('Avatar must be under 1.5 MB', true);
                e.target.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                els.avatarPreview.src = reader.result;
                els.avatarPreview.style.display = 'block';
                els.avatarPreview.dataset.value = reader.result;
                els.avatarPlaceholder.style.display = 'none';
            };
            reader.readAsDataURL(file);
        });
    }

    function bindSettingsForm() {
        const autoSaveInputs = [
            els.settingAccent,
            els.settingProxyDefault,
            els.settingParticles,
            els.settingParticleCount,
            els.settingParticleSpeed,
            els.settingCursor,
            els.settingCursorSize,
            els.settingCursorColor,
            els.settingShowClock,
            els.settingShowCurrent
        ].filter(Boolean);

        autoSaveInputs.forEach((input) => {
            const evt = input.type === 'color' || input.type === 'number' ? 'input' : 'change';
            input.addEventListener(evt, () => queueSaveSettings());
        });

        els.settingShowClock?.addEventListener('change', (e) => {
            applyClockSetting(e.target.checked);
        });
        els.settingShowCurrent?.addEventListener('change', (e) => {
            applyCurrentSectionSetting(e.target.checked);
        });

    }

    function bindFriendsUI() {
        els.friendsLoginBtn?.addEventListener('click', () => openAuthModal('login'));

        els.friendsTabNav?.addEventListener('click', (e) => {
            const btn = e.target.closest('.friends-tab');
            if (!btn) return;
            const tab = btn.dataset.tab;
            if (tab === 'add') {
                openAddFriendModal();
                return;
            }
            switchFriendsPanel(tab, btn);
        });

        const openAdd = () => openAddFriendModal();
        els.openAddFriendModalBtn?.addEventListener('click', openAdd);
        els.openAddFriendModalBtnInline?.addEventListener('click', openAdd);

        els.addFriendModalForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!state.user) return openAuthModal('login');
            const username = (els.addFriendModalInput.value || '').trim();
            if (!username) return;
            els.addFriendModalFeedback.textContent = '';
            try {
                await api.post('/api/friends/request', { username });
                els.addFriendModalFeedback.textContent = `Request sent to ${username}`;
                els.addFriendModalFeedback.style.color = '#58a6ff';
                els.addFriendModalInput.value = '';
                setTimeout(closeAddFriendModal, 500);
                await loadFriends();
            } catch (err) {
                els.addFriendModalFeedback.textContent = err.message || 'Failed to send request';
                els.addFriendModalFeedback.style.color = '#f85149';
            }
        });

        const closeAdd = () => closeAddFriendModal();
        els.closeAddFriendModal?.addEventListener('click', closeAdd);
        els.addFriendModalOverlay?.addEventListener('click', closeAdd);
    }

    function bindFavoritesUI() {
        els.favoritesLoginBtn?.addEventListener('click', () => openAuthModal('login'));
    }

    function switchFriendsPanel(tab, btn) {
        const current = els.friendsTabPanels.find((p) => p.classList.contains('active'));
        const next = els.friendsTabPanels.find((p) => p.dataset.panel === tab);
        if (!next || current === next) return;

        els.friendsTabNav.querySelectorAll('.friends-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));

        [current, next].forEach((p) => p?.classList.add('animating'));
        current?.classList.add('slide-out');
        next.classList.add('slide-in', 'active');

        setTimeout(() => {
            current?.classList.remove('active', 'slide-out', 'animating');
            next.classList.remove('slide-in', 'animating');
        }, 260);
    }

    function bindGameControls() {
        els.proxyToggleGame?.addEventListener('click', () => {
            state.proxyEnabled = !state.proxyEnabled;
            updateProxyUI();
            if (state.currentGame) loadGameFrame(state.currentGame);
        });
        els.loadingProxyToggle?.addEventListener('click', () => {
            state.proxyEnabled = !state.proxyEnabled;
            updateProxyUI();
            if (state.currentGame) loadGameFrame(state.currentGame);
        });
        els.gameFavBtn?.addEventListener('click', () => {
            if (!state.currentGame) return;
            toggleFavorite(state.currentGame.id);
        });
        els.fullscreenBtn?.addEventListener('click', () => {
            const wrap = document.querySelector('.game-frame-wrapper');
            if (!wrap) return;
            if (!document.fullscreenElement) wrap.requestFullscreen?.(); else document.exitFullscreen?.();
        });
    }

    function bindLogoutModal() {
        els.logoutConfirmBtn?.addEventListener('click', async () => { await logout(); hideLogoutConfirm(); });
        els.logoutCancelBtn?.addEventListener('click', hideLogoutConfirm);
    }

    async function loadInitial() {
        showLoader(true);
        try {
            const [config, games, stats, me] = await Promise.all([
                api.get('/api/config').catch(() => null),
                api.get('/api/games'),
                api.get('/api/stats').catch(() => null),
                api.get('/api/auth/me').catch(() => null)
            ]);
            state.games = games || [];
            state.filtered = state.games.slice();
            state.categories = buildCategories(state.games);
            state.banner = config?.banner || null;
            buildCategoryTabs();
            renderHomeBanner(state.banner);
            renderGames();
            if (stats) updateStats(stats); else updateStats({ totalGames: state.games.length, categoryCount: state.categories.length });
            if (me?.user) {
                state.user = normalizeUser(me.user);
                state.favorites = new Set((me.user.favorites || []).map(String));
                state.settings = me.user.settings || null;
                await loadSettingsIfNeeded();
                await loadFriends();
                startFriendsPolling();
                updateAccountAvatar(state.user);
                updatePresence(true, null);
                refreshUserUI();
                renderPlayHistory();
            } else {
                refreshUserUI();
            }
        } catch (err) {
            showToast(err.message || 'Failed to load data', true);
        } finally {
            startOnlineHeartbeat();
            startHealthPolling();
            showLoader(false);
        }
    }

    function startFriendsPolling() {
        if (runtime.friendsPoll) clearInterval(runtime.friendsPoll);
        if (!state.user) return;
        runtime.friendsPoll = setInterval(() => {
            loadFriends();
        }, 20000);
    }

    function startOnlineHeartbeat() {
        if (runtime.onlinePing) clearInterval(runtime.onlinePing);
        sendOnlinePing();
        runtime.onlinePing = setInterval(() => {
            sendOnlinePing();
        }, ONLINE_PING_INTERVAL);
    }

    function startHealthPolling() {
        if (runtime.healthPoll) clearInterval(runtime.healthPoll);
        updateHealth();
        runtime.healthPoll = setInterval(() => {
            updateHealth();
        }, 5000);
    }

    function sendOnlinePing(gameIdOverride) {
        const payload = { online: true };
        if (gameIdOverride !== undefined) {
            payload.gameId = gameIdOverride;
        } else if (state.currentGame) {
            payload.gameId = state.currentGame.id;
        }
        return api.post('/api/online/ping', payload)
            .then((res) => {
                if (Array.isArray(res?.lastPlayed)) updateLastPlayedState(res.lastPlayed);
                return res;
            })
            .catch(() => {});
    }

    function updatePresence(online = true, gameId = null) {
        if (!online) return api.post('/api/online/ping', { online: false, gameId: null }).catch(() => {});
        return sendOnlinePing(gameId);
    }

    function updateStats(stats) {
        if (!stats) return;
        if (els.statsGames) els.statsGames.textContent = stats.totalGames ?? stats.games ?? '—';
        if (els.statsCategories) els.statsCategories.textContent = stats.categoryCount ?? '—';
    }

    async function loadSettingsIfNeeded() {
        if (!state.user) return;
        if (state.settings) { applySettingsToUI(state.settings); return; }
        try {
            const { settings } = await api.get('/api/settings');
            state.settings = settings;
            applySettingsToUI(settings);
        } catch (_) {}
    }

    function buildCategories(games) {
        const cats = new Set(['all']);
        games.forEach((g) => { if (g.category) cats.add(g.category); });
        return Array.from(cats);
    }

    function renderHomeBanner(banner) {
        if (!els.homeBanner) return;
        els.homeBanner.innerHTML = '';
        if (!banner || !banner.message) {
            els.homeBanner.style.display = 'none';
            return;
        }
        if (isBannerDismissed(banner)) {
            els.homeBanner.style.display = 'none';
            return;
        }

        const wrap = document.createElement('div');
        wrap.className = 'home-banner';
        wrap.style.background = banner.background || '#11161f';
        wrap.style.color = banner.textColor || '#e5e7eb';

        const text = document.createElement('div');
        text.className = 'home-banner-text';

        const title = document.createElement('div');
        title.className = 'home-banner-title';
        title.textContent = banner.message;
        text.appendChild(title);

        if (banner.description) {
            const desc = document.createElement('div');
            desc.className = 'home-banner-description';
            desc.textContent = banner.description;
            text.appendChild(desc);
        }

        const actions = document.createElement('div');
        actions.className = 'home-banner-actions';

        if (banner.button?.enabled && banner.button.url) {
            const btn = document.createElement('a');
            btn.className = 'banner-btn';
            btn.href = banner.button.url;
            btn.target = banner.button.url.startsWith('#') ? '_self' : '_blank';
            btn.rel = 'noopener';
            btn.textContent = banner.button.label || 'Learn more';
            btn.style.background = banner.button.background || '#1f6feb';
            btn.style.color = banner.button.textColor || '#ffffff';
            actions.appendChild(btn);
        }

        if (banner.dismissible !== false) {
            const close = document.createElement('button');
            close.type = 'button';
            close.className = 'banner-dismiss';
            close.innerHTML = '<i class="fas fa-times"></i>';
            close.addEventListener('click', () => {
                markBannerDismissed(banner);
                renderHomeBanner(null);
            });
            actions.appendChild(close);
        }

        wrap.appendChild(text);
        wrap.appendChild(actions);
        els.homeBanner.appendChild(wrap);
        els.homeBanner.style.display = 'block';
    }

    function isBannerDismissed(banner) {
        if (!banner || banner.dismissible === false) return false;
        const key = `jg_banner_dismiss_${banner.id || 'default'}`;
        const raw = localStorage.getItem(key);
        if (!raw) return false;
        try {
            const data = JSON.parse(raw);
            const cooldownMs = Math.max(0, (banner.dismissCooldownHours || 0) * 3600 * 1000);
            if (!cooldownMs) return false;
            return Date.now() - (data.ts || 0) < cooldownMs;
        } catch (_) {
            return false;
        }
    }

    function markBannerDismissed(banner) {
        if (!banner || banner.dismissible === false) return;
        const key = `jg_banner_dismiss_${banner.id || 'default'}`;
        localStorage.setItem(key, JSON.stringify({ ts: Date.now() }));
    }

    function buildCategoryTabs() {
        if (!els.categoryTabs) return;
        els.categoryTabs.innerHTML = '';
        state.categories.forEach((cat, idx) => {
            const btn = document.createElement('button');
            btn.className = `cat-tab${idx === 0 ? ' active' : ''}`;
            btn.textContent = cat === 'all' ? 'All' : capitalize(cat);
            btn.dataset.category = cat;
            btn.addEventListener('click', () => {
                els.categoryTabs.querySelectorAll('.cat-tab').forEach((b) => b.classList.remove('active'));
                btn.classList.add('active');
                filterAndRender();
            });
            els.categoryTabs.appendChild(btn);
        });
    }

    function filterAndRender() {
        const query = (els.searchInput?.value || '').toLowerCase();
        const activeBtn = els.categoryTabs?.querySelector('.cat-tab.active');
        const activeCat = activeBtn ? activeBtn.dataset.category : 'all';
        state.filtered = state.games.filter((g) => {
            const matchesQuery = !query || g.title.toLowerCase().includes(query) || (g.description || '').toLowerCase().includes(query);
            const matchesCat = activeCat === 'all' || (g.category || '').toLowerCase() === activeCat.toLowerCase();
            return matchesQuery && matchesCat;
        });
        renderGames();
    }

    function renderGames() {
        if (!els.allGames) return;
        els.allGames.innerHTML = '';
        const frag = document.createDocumentFragment();
        state.filtered.forEach((game, idx) => frag.appendChild(buildGameCard(game, idx)));
        els.allGames.appendChild(frag);
    }

    const placeholderThumb = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270" fill="none"><rect width="480" height="270" fill="%23161b22"/><path d="M70 190h340M70 150h200M70 110h140" stroke="%2330363d" stroke-width="14" stroke-linecap="round"/><circle cx="380" cy="110" r="38" stroke="%2358a6ff" stroke-width="12"/></svg>';

    function buildGameCard(game, idx = 0) {
        const thumb = game.thumbnail || placeholderThumb;
        const card = document.createElement('div');
        card.className = 'game-card';
        card.dataset.id = game.id;
        card.style.animationDelay = `${Math.min(idx, 60) * 60}ms`;
        card.innerHTML = `
            <div class="card-friend-avatars"></div>
            <div class="game-thumb">
                <img src="${thumb}" alt="${game.title}" loading="lazy" />
                <div class="game-card-overlay"></div>
            </div>
            <div class="game-card-content">
                <div class="game-card-title">${game.title}</div>
                <div class="game-card-category">${capitalize(game.category || 'Other')}</div>
            </div>
            <div class="game-card-actions">
                <button class="icon-btn small fav-toggle" aria-label="Favorite" data-id="${game.id}"><i class="fas fa-heart"></i></button>
            </div>`;

        const img = card.querySelector('img');
        img.addEventListener('error', () => { img.src = placeholderThumb; });

        card.addEventListener('click', (e) => {
            if (e.target.closest('.fav-toggle')) return;
            openGame(game.id);
        });
        card.querySelector('.fav-toggle').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(game.id);
        });
        updateFavButton(card.querySelector('.fav-toggle'), game.id);
        renderCardFriends(card, game.id);
        return card;
    }

    function renderCardFriends(card, gameId) {
        const wrap = card.querySelector('.card-friend-avatars');
        if (!wrap) return;
        wrap.innerHTML = '';
        const friends = runtime.friendsPlayingMap.get(String(gameId)) || [];
        if (!friends.length) { wrap.style.display = 'none'; return; }
        wrap.style.display = 'flex';
        const maxShow = 3;
        friends.slice(0, maxShow).forEach((f) => {
            const pill = document.createElement('div');
            pill.className = 'card-avatar-pill';
            if (f.avatar) pill.style.backgroundImage = `url(${f.avatar})`; else pill.textContent = (f.username || '?')[0].toUpperCase();
            wrap.appendChild(pill);
        });
        if (friends.length > maxShow) {
            const more = document.createElement('div');
            more.className = 'card-avatar-pill more';
            more.textContent = `+${friends.length - maxShow}`;
            wrap.appendChild(more);
        }
    }

    function renderFavoritesPage() {
        if (!els.favoritesGrid) return;
        const isAuthed = !!state.user;
        const favGames = isAuthed ? state.games.filter((g) => state.favorites.has(String(g.id))) : [];

        els.favoritesGrid.innerHTML = '';

        if (els.favoritesLoginBox) els.favoritesLoginBox.style.display = isAuthed ? 'none' : 'block';
        if (!isAuthed) {
            if (els.favoritesAuthHint) els.favoritesAuthHint.style.display = 'none';
            if (els.favoritesGrid) els.favoritesGrid.style.display = 'none';
            if (els.favoritesEmpty) els.favoritesEmpty.style.display = 'none';
            return;
        }

        if (els.favoritesAuthHint) els.favoritesAuthHint.style.display = 'none';
        if (els.favoritesGrid) els.favoritesGrid.style.display = 'grid';

        if (!favGames.length) {
            if (els.favoritesEmpty) els.favoritesEmpty.style.display = 'block';
            return;
        }
        if (els.favoritesEmpty) els.favoritesEmpty.style.display = 'none';

        const frag = document.createDocumentFragment();
        favGames.forEach((g, idx) => frag.appendChild(buildGameCard(g, idx)));
        els.favoritesGrid.appendChild(frag);
    }

    function renderGameFriends(gameId) {
        const wrap = els.gameFriendAvatars;
        if (!wrap) return;
        wrap.innerHTML = '';
        const friends = runtime.friendsPlayingMap.get(String(gameId)) || [];
        if (!friends.length) { wrap.style.display = 'none'; return; }
        wrap.style.display = 'flex';
        const maxShow = 4;
        friends.slice(0, maxShow).forEach((f) => {
            const pill = document.createElement('div');
            pill.className = 'card-avatar-pill';
            if (f.avatar) pill.style.backgroundImage = `url(${f.avatar})`; else pill.textContent = (f.username || '?')[0].toUpperCase();
            wrap.appendChild(pill);
        });
        if (friends.length > maxShow) {
            const more = document.createElement('div');
            more.className = 'card-avatar-pill more';
            more.textContent = `+${friends.length - maxShow}`;
            wrap.appendChild(more);
        }
    }

    async function openGame(gameId) {
        const game = state.games.find((g) => String(g.id) === String(gameId));
        if (!game) return;
        cancelCloseTimer(true);
        state.currentGame = game;
        els.gameTitle.textContent = game.title;
        els.gameCategory.textContent = capitalize(game.category || 'Other');
        els.gameDescription.textContent = game.description || '';
        showPage('game');
        updateGameFavoriteButton(game.id);
        state.proxyEnabled = state.settings?.proxyDefault || false;
        updateProxyUI();
        updatePresence(true, game.id);
        renderGameFriends(game.id);
        updateLocalLastPlayed(game.id);
        loadGameFrame(game);
    }

    function loadGameFrame(game) {
        if (!els.gameFrame) return;
        els.gameLoadingOverlay.style.display = 'flex';
        els.loadingStatusText.textContent = 'Loading game...';
        els.loadingHintText.textContent = state.proxyEnabled ? 'Proxy enabled' : 'Direct load';
        const src = state.proxyEnabled ? `${backendUrl}/proxy?url=${encodeURIComponent(game.embed)}` : game.embed;
        els.gameFrame.src = src;
        const onLoad = () => {
            els.gameLoadingOverlay.style.display = 'none';
            els.gameFrame.removeEventListener('load', onLoad);
        };
        els.gameFrame.addEventListener('load', onLoad);
    }

    function toggleFavorite(gameId) {
        if (!state.user) {
            pushNotification('Sign in required', 'Create an account to save favorites to your profile.', 'warning');
            return;
        }
        api.post('/api/favorites/toggle', { gameId: String(gameId) })
            .then(({ favorites }) => {
                state.favorites = new Set((favorites || []).map(String));
                renderFavoritesPage();
                renderGames();
                updateGameFavoriteButton(gameId);
                if (state.currentGame?.id === gameId) renderGameFriends(gameId);
            })
            .catch((err) => showToast(err.message || 'Failed to update favorites', true));
    }

    function updateGameFavoriteButton(gameId) {
        const isFav = state.favorites.has(String(gameId));
        els.gameFavBtn?.classList.toggle('active', isFav);
        els.gameFavBtn?.setAttribute('aria-pressed', isFav ? 'true' : 'false');
        renderGameFriends(gameId);
    }

    function updateFavButton(btn, gameId) {
        if (!btn) return;
        const isFav = state.favorites.has(String(gameId));
        btn.classList.toggle('active', isFav);
        btn.setAttribute('aria-pressed', isFav ? 'true' : 'false');
    }

    async function loadFriends() {
        if (!state.user) return;
        try {
            const data = await api.get('/api/friends');
            diffFriendsAndNotify(runtime.friendsSnapshot, data);
            runtime.friendsSnapshot = snapshotFriends(data);
            state.friends = data;
            runtime.friendsPlayingMap = buildFriendsPlayingMap(data);
            renderFriends();
        } catch (err) {
            showToast(err.message || 'Friends unavailable', true);
            els.friendsContent.style.display = 'none';
            if (els.friendsAuthNotice) els.friendsAuthNotice.style.display = state.user ? 'none' : 'block';
            if (els.friendsAuthNoticeBox) els.friendsAuthNoticeBox.style.display = state.user ? 'none' : 'block';
        }
    }

    function snapshotFriends(data = {}) {
        const norm = (arr = []) => arr.map((u) => u.username).filter(Boolean);
        const presence = {};
        (data.friends || []).forEach((u) => {
            presence[u.username] = {
                online: !!u.presence?.online,
                gameId: u.presence?.gameId || null
            };
        });
        return {
            friends: norm(data.friends),
            incoming: norm(data.incomingRequests),
            outgoing: norm(data.outgoingRequests),
            presence
        };
    }

    function diffFriendsAndNotify(prev, next) {
        if (!prev) return;
        const incomingNew = (next.incomingRequests || []).filter((u) => !prev.incoming?.includes(u.username));
        incomingNew.forEach((u) => pushNotification('Friend request', `${u.username} sent you a friend request`, 'info'));

        const accepted = (next.friends || []).filter((u) => prev.outgoing?.includes(u.username));
        accepted.forEach((u) => pushNotification('Request accepted', `${u.username} accepted your friend request`, 'success'));

        const prevPresence = prev.presence || {};
        const nextPresence = {};
        (next.friends || []).forEach((u) => { nextPresence[u.username] = u.presence || {}; });
        Object.entries(nextPresence).forEach(([name, pres]) => {
            const prevP = prevPresence[name] || {};
            if (prevP.online !== pres.online) {
                pushNotification('Presence', `${name} is now ${pres.online ? 'online' : 'offline'}`, pres.online ? 'success' : 'warning');
            }
            if (pres.online && pres.gameId && pres.gameId !== prevP.gameId) {
                const title = getGameTitleById(pres.gameId) || 'a game';
                pushNotification('Now playing', `${name} started playing ${title}`, 'info');
            }
        });
    }

    function buildFriendsPlayingMap(data) {
        const map = new Map();
        (data?.friends || []).forEach((f) => {
            const gid = f.presence?.gameId;
            if (!f.presence?.online || !gid) return;
            const key = String(gid);
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(f);
        });
        return map;
    }

    function renderFriends() {
        if (!state.user) {
            els.friendsAuthNotice.style.display = 'block';
            els.friendsContent.style.display = 'none';
            if (els.friendsTabNav) els.friendsTabNav.style.display = 'none';
            return;
        }

        const { friends = [], incomingRequests = [], outgoingRequests = [], blocked = [] } = state.friends || {};

        els.friendsAuthNotice.style.display = 'none';
        els.friendsContent.style.display = 'grid';
        if (els.friendsTabNav) els.friendsTabNav.style.display = 'flex';
        if (els.addFriendModal) els.addFriendModal.style.display = 'none';

        renderUserList(els.friendsList, friends, { statusText: 'Friend', emptyText: 'No friends yet.' });

        renderUserList(els.manageFriendsList, friends, {
            statusText: 'Friend',
            emptyText: 'No friends to manage.',
            actions: [
                { label: 'Remove', icon: 'fa-xmark', action: (user) => removeFriend(user.username), success: (user) => `Removed ${user.username}` },
                { label: 'Block', icon: 'fa-ban', action: (user) => blockUser(user.username), tone: 'danger', success: (user) => `Blocked ${user.username}` }
            ]
        });
        renderUserList(els.manageIncomingList, incomingRequests, {
            statusText: 'Incoming request',
            emptyText: 'No incoming requests.',
            actions: [
                { label: 'Accept', icon: 'fa-check', tone: 'positive', action: (user) => respondToRequest(user.username, 'accept'), success: (user) => `Accepted ${user.username}` },
                { label: 'Decline', icon: 'fa-xmark', tone: 'danger', action: (user) => respondToRequest(user.username, 'decline'), success: (user) => `Declined ${user.username}` },
                { label: 'Block', icon: 'fa-ban', tone: 'danger', action: (user) => blockUser(user.username), success: (user) => `Blocked ${user.username}` }
            ]
        });
        renderUserList(els.manageOutgoingList, outgoingRequests, {
            statusText: 'Awaiting approval',
            emptyText: 'No outgoing requests.',
            actions: [
                { label: 'Cancel', icon: 'fa-xmark', tone: 'danger', action: (user) => cancelRequest(user.username), success: (user) => `Canceled request to ${user.username}` }
            ]
        });
        renderUserList(els.blockedList, blocked, {
            statusText: 'Blocked',
            emptyText: 'No blocked users.',
            actions: [
                { label: 'Unblock', icon: 'fa-unlock', action: (user) => unblockUser(user.username), success: (user) => `Unblocked ${user.username}` }
            ]
        });

        els.friendsCount.textContent = friends.length;
        els.pendingCount.textContent = incomingRequests.length;

        // update overlays for current game
        if (state.currentGame) renderGameFriends(state.currentGame.id);
        renderGames();
        renderOnlineFriends();
    }

    function renderUserList(container, list = [], options = {}) {
        if (!container) return;
        const { emptyText = 'Nothing here yet.', statusText = '', actions = [] } = options;
        container.innerHTML = '';
        if (!list.length) {
            container.innerHTML = `<li class="muted-hint">${emptyText}</li>`;
            return;
        }
        list.forEach((user) => {
            const li = document.createElement('li');
            li.className = 'friend-row';

            const avatar = document.createElement('div');
            avatar.className = 'friend-avatar';
            if (user.avatar) {
                avatar.style.backgroundImage = `url(${user.avatar})`;
            } else {
                avatar.style.background = user.accentColor || '#58a6ff';
                avatar.textContent = (user.username || '?')[0].toUpperCase();
            }

            const meta = document.createElement('div');
            meta.className = 'friend-meta';
            const name = document.createElement('div');
            name.className = 'friend-name';
            name.textContent = user.username;
            const status = document.createElement('div');
            status.className = 'friend-status';
            status.textContent = buildFriendStatus(user, statusText);
            meta.append(name, status);

            const actionsWrap = document.createElement('div');
            actionsWrap.className = 'friend-actions';
            actionsWrap.style.display = 'flex';
            actionsWrap.style.gap = '8px';

            actions.forEach(({ label, action, tone, success, icon }) => {
                const btn = document.createElement('button');
                btn.className = 'friend-action-btn';
                btn.setAttribute('aria-label', label);
                if (tone === 'danger') btn.classList.add('danger');
                if (tone === 'positive') btn.classList.add('positive');
                btn.innerHTML = `<i class="fas ${icon || 'fa-check'}"></i>`;
                btn.addEventListener('click', async () => {
                    const successMsg = typeof success === 'function' ? success(user) : success;
                    await performFriendAction(() => action(user), successMsg);
                });
                actionsWrap.appendChild(btn);
            });

            li.append(avatar, meta);
            if (actionsWrap.childElementCount) li.appendChild(actionsWrap);
            container.appendChild(li);
        });
    }

    function buildFriendStatus(user, fallback) {
        const presence = user?.presence;
        if (!presence) return fallback || 'Online';
        if (presence.online && presence.gameId) {
            const title = getGameTitleById(presence.gameId);
            return title ? `Playing ${title}` : 'Playing';
        }
        if (presence.online) return 'Online';
        return 'Offline';
    }

    async function performFriendAction(actionFn, successMessage) {
        try {
            await actionFn();
            if (successMessage) showToast(successMessage);
            await loadFriends();
        } catch (err) {
            showToast(err.message || 'Action failed', true);
        }
    }

    function respondToRequest(username, action) {
        return api.post('/api/friends/respond', { username, action });
    }

    function removeFriend(username) {
        return api.post('/api/friends/remove', { username });
    }

    function blockUser(username) {
        return api.post('/api/friends/block', { username });
    }

    function unblockUser(username) {
        return api.post('/api/friends/unblock', { username });
    }

    function cancelRequest(username) {
        return api.post('/api/friends/cancel', { username });
    }

    function applySettingsToUI(settings) {
        if (!settings) return;
        if (els.settingAccent) els.settingAccent.value = settings.accentColor || '#58a6ff';
        if (els.settingProxyDefault) els.settingProxyDefault.checked = !!settings.proxyDefault;
        if (els.settingParticles) els.settingParticles.checked = settings.particlesEnabled !== false;
        if (els.settingParticleCount) els.settingParticleCount.value = settings.particleCount ?? 50;
        if (els.settingParticleSpeed) els.settingParticleSpeed.value = settings.particleSpeed ?? 0.5;
        if (els.settingCursor) els.settingCursor.checked = settings.cursorEnabled !== false;
        if (els.settingCursorSize) els.settingCursorSize.value = settings.cursorSize ?? 8;
        if (els.settingCursorColor) els.settingCursorColor.value = settings.cursorColor || '#ffffff';
        if (els.settingShowClock) els.settingShowClock.checked = settings.showClock !== false;
        if (els.settingShowCurrent) els.settingShowCurrent.checked = settings.showCurrent !== false;
        applySettingsBehavior(settings);
    }

    function applyAccent(color) {
        if (!color) return;
        document.documentElement.style.setProperty('--accent-color', color);
    }

    function applySettingsBehavior(settings) {
        if (!settings) return;
        applyAccent(settings.accentColor);
        state.proxyEnabled = !!settings.proxyDefault;
        if (settings.cursorEnabled !== false) {
            enableCustomCursor(settings);
        } else {
            disableCustomCursor();
        }
        if (settings.particlesEnabled !== false) {
            startParticles(settings);
        } else {
            stopParticles();
        }
        updateProxyUI();
        applyClockSetting(settings.showClock !== false);
        applyCurrentSectionSetting(settings.showCurrent !== false);
    }

    async function updateHealth() {
        try {
            const health = await api.get('/health');
            const players = Number.isFinite(health.players) ? health.players : (Number.isFinite(health.games) ? health.games : null);
            if (players === null) throw new Error('Bad health payload');
            setStatus(true, `Online - ${players} Players`);
        } catch (_) {
            setStatus(false, 'Offline - Check Network');
        }
    }

    function setStatus(isOnline, text) {
        els.statusDot?.classList.toggle('online', isOnline);
        els.statusDot?.classList.toggle('offline', !isOnline);
        els.statusText.textContent = text;
        els.statusText.classList.toggle('online', isOnline);
        els.statusText.classList.toggle('offline', !isOnline);
    }

    function refreshUserUI() {
        if (state.user) {
            els.accountLabel.textContent = state.user.username;
            if (els.friendsAuthNotice) els.friendsAuthNotice.style.display = 'none';
            if (els.friendsAuthNoticeBox) els.friendsAuthNoticeBox.style.display = 'none';
            els.friendsContent.style.display = 'grid';
            populateProfileForm();
            applySettingsToUI(state.settings || state.user.settings);
            updateAccountAvatar(state.user);
        } else {
            els.accountLabel.textContent = 'Log in';
            if (els.friendsAuthNotice) els.friendsAuthNotice.style.display = 'block';
            if (els.friendsAuthNoticeBox) els.friendsAuthNoticeBox.style.display = 'block';
            els.friendsContent.style.display = 'none';
            state.favorites = new Set();
            state.friends = { friends: [], incomingRequests: [], outgoingRequests: [], blocked: [] };
            if (els.friendsCount) els.friendsCount.textContent = '0';
            if (els.pendingCount) els.pendingCount.textContent = '0';
            updateAccountAvatar(null);
        }
            closeAddFriendModal();
        renderPlayHistory();
        renderFavoritesPage();
    }

        function updateAccountAvatar(user) {
            if (!els.accountAvatar) return;
            const avatarUrl = user?.profile?.avatar;
            els.accountAvatar.style.backgroundImage = avatarUrl ? `url(${avatarUrl})` : 'none';
            els.accountAvatar.textContent = avatarUrl ? '' : (user?.username?.[0]?.toUpperCase() || '');
        }

    function populateProfileForm() {
        if (!state.user) return;
        els.profileUsername.value = state.user.username || '';
        els.profileColor.value = state.user.profile?.accentColor || '#58a6ff';
        if (state.user.profile?.avatar) {
            els.avatarPreview.src = state.user.profile.avatar;
            els.avatarPreview.style.display = 'block';
            els.avatarPreview.dataset.value = state.user.profile.avatar;
            els.avatarPlaceholder.style.display = 'none';
        }
    }

    function setActiveNav(page) {
        els.navItems.forEach((item) => item.classList.toggle('active', item.dataset.page === page));
    }

    function showPage(page) {
        const next = els.pages?.[page];
        if (!next) return;

        const currentKey = runtime.currentPage;
        const current = currentKey ? els.pages?.[currentKey] : null;
        if (current === next) return;

        const wasGame = runtime.currentPage === 'game' && state.currentGame;

        if (current) {
            current.classList.remove('active');
            current.classList.add('leaving');
            setTimeout(() => {
                current.classList.remove('leaving', 'is-visible');
                current.style.display = 'none';
            }, 340);
        }

        next.style.display = 'block';
        next.classList.remove('leaving');
        next.classList.add('is-visible');
        requestAnimationFrame(() => next.classList.add('active'));
        runtime.currentPage = page;
        if (page === 'favorites') renderFavoritesPage();
        if (page === 'home') filterAndRender();
        if (page !== 'game' && wasGame) {
            beginCloseCurrentGame();
        } else if (page !== 'game') {
            updatePresence(true, null);
        }
        renderPlayHistory();
        renderOnlineFriends();
    }

    function toggleProfileDropdown() {
        if (!els.profileDropdown) return;
        const open = els.profileDropdown.getAttribute('aria-hidden') === 'false';
        els.profileDropdown.setAttribute('aria-hidden', open ? 'true' : 'false');
    }

    function openAddFriendModal() {
        if (!state.user) {
            openAuthModal('login');
            return;
        }
        if (!els.addFriendModal) return;
        els.addFriendModal.style.display = 'flex';
        els.addFriendModalInput?.focus();
    }

    function closeAddFriendModal() {
        if (!els.addFriendModal) return;
        els.addFriendModal.style.display = 'none';
        if (els.addFriendModalFeedback) els.addFriendModalFeedback.textContent = '';
    }

    function toggleAccountDropdown() {
        const drop = document.getElementById('accountDropdown');
        if (!drop) return;
        const open = drop.getAttribute('aria-hidden') === 'false';
        drop.setAttribute('aria-hidden', open ? 'true' : 'false');
    }

    function hideAccountDropdown() {
        const drop = document.getElementById('accountDropdown');
        if (drop) drop.setAttribute('aria-hidden', 'true');
    }

    function hideProfileDropdown() {
        if (els.profileDropdown) els.profileDropdown.setAttribute('aria-hidden', 'true');
    }

    function openAuthModal(defaultTab = 'login') {
        if (!els.authModal) return;
        els.authModal.style.display = 'flex';
        els.authModal.dataset.mode = defaultTab;
        els.authTabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === defaultTab));
    }

    function closeAuthModal() {
        if (els.authModal) els.authModal.style.display = 'none';
    }

    async function handleAuthSubmit(e) {
        e.preventDefault();
        const mode = els.authModal.dataset.mode || 'login';
        const username = els.authForm.username.value.trim();
        const password = els.authForm.password.value;
        els.authFeedback.textContent = '';
        try {
            const path = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
            const { user } = await api.post(path, { username, password });
            state.user = normalizeUser(user);
            state.favorites = new Set((user.favorites || []).map(String));
            state.settings = user.settings || null;
            await loadSettingsIfNeeded();
            await loadFriends();
            startFriendsPolling();
            updateAccountAvatar(state.user);
            updatePresence(true, null);
            refreshUserUI();
            renderPlayHistory();
            closeAuthModal();
            showToast(mode === 'register' ? 'Account created' : 'Signed in');
        } catch (err) {
            els.authFeedback.textContent = err.message || 'Authentication failed';
        }
    }

    async function logout() {
        try { await api.post('/api/auth/logout'); } catch (_) {}
        state.user = null;
        state.favorites = new Set();
        state.settings = null;
        state.friends = { friends: [], incomingRequests: [], outgoingRequests: [], blocked: [] };
        runtime.friendsSnapshot = null;
        if (runtime.friendsPoll) { clearInterval(runtime.friendsPoll); runtime.friendsPoll = null; }
        runtime.friendsPlayingMap = new Map();
        cancelCloseTimer(true);
        stopGameFrame();
        disableCustomCursor();
        stopParticles();
        refreshUserUI();
        renderOnlineFriends();
        showPage('home');
    }

    function showLogoutConfirm() {
        if (els.logoutConfirmModal) els.logoutConfirmModal.style.display = 'flex';
    }

    function hideLogoutConfirm() {
        if (els.logoutConfirmModal) els.logoutConfirmModal.style.display = 'none';
    }

    function updateProxyUI() {
        const active = state.proxyEnabled;
        els.proxyToggleGame?.classList.toggle('off', !active);
        els.proxyToggleGame?.setAttribute('aria-pressed', active ? 'true' : 'false');
        els.loadingProxyToggle?.classList.toggle('off', !active);
        els.loadingProxyToggle?.setAttribute('aria-pressed', active ? 'true' : 'false');
        if (els.loadingHintText) els.loadingHintText.textContent = active ? 'Proxy enabled' : 'Direct load';
        if (state.currentGame) renderGameFriends(state.currentGame.id);
    }

    function showLoader(show) {
        if (!els.loader) return;
        els.loader.style.display = show ? 'flex' : 'none';
        if (!show) els.loader.classList.add('fade-out');
    }

    function toggleSaving(isSaving) {
        if (!els.profileSaveIndicator) return;
        els.profileSaveIndicator.style.display = isSaving ? 'inline-block' : 'none';
        els.profileForm.querySelectorAll('input, button').forEach((el) => { el.disabled = isSaving; });
    }

    function setSettingsFeedback(msg, isError) {
        if (!els.settingsFeedback) return;
        els.settingsFeedback.textContent = msg;
        els.settingsFeedback.style.color = isError ? '#f85149' : '#58a6ff';
    }

    function buildSettingsPayload() {
        return {
            accentColor: els.settingAccent?.value,
            proxyDefault: !!els.settingProxyDefault?.checked,
            particlesEnabled: els.settingParticles?.checked !== false,
            particleCount: Number(els.settingParticleCount?.value || 0),
            particleSpeed: Number(els.settingParticleSpeed?.value || 0),
            cursorEnabled: els.settingCursor?.checked !== false,
            cursorSize: Number(els.settingCursorSize?.value || 8),
            cursorColor: els.settingCursorColor?.value,
            showClock: els.settingShowClock ? els.settingShowClock.checked : true,
            showCurrent: els.settingShowCurrent ? els.settingShowCurrent.checked : true
        };
    }

    function queueSaveSettings() {
        if (!state.user) {
            setSettingsFeedback('Log in to save settings', true);
            return;
        }
        if (runtime.settingsSaveTimer) clearTimeout(runtime.settingsSaveTimer);
        setSettingsFeedback('Saving...', false);
        runtime.settingsSaveTimer = setTimeout(() => {
            saveSettings();
        }, 200);
    }

    async function saveSettings() {
        if (!state.user) return openAuthModal('login');
        const payload = buildSettingsPayload();
        setSettingsFeedback('Saving...', false);
        try {
            const { settings } = await api.put('/api/settings', payload);
            state.settings = settings;
            applySettingsBehavior(settings);
            setSettingsFeedback('Saved', false);
        } catch (err) {
            setSettingsFeedback(err.message || 'Failed to save', true);
        }
    }

    function showToast(message, isError = false) {
        if (!els.toast) return;
        const el = els.toast;
        el.textContent = message;
        el.style.display = 'block';
        el.style.position = 'fixed';
        el.style.bottom = '24px';
        el.style.right = '24px';
        el.style.padding = '12px 16px';
        el.style.background = isError ? '#f85149' : '#238636';
        el.style.color = '#fff';
        el.style.borderRadius = '10px';
        el.style.boxShadow = '0 10px 30px rgba(0,0,0,0.35)';
        clearTimeout(el._hideTimer);
        el._hideTimer = setTimeout(() => { el.style.display = 'none'; }, 3000);
    }

    function pushNotification(title, message, type = 'info') {
        if (!els.notificationStack) return;
        const card = document.createElement('div');
        card.className = `notification-card ${type}`;
        card.innerHTML = `
            <div class="notification-icon"><i class="fas ${iconForType(type)}"></i></div>
            <div class="notification-body">
                <div class="notification-title">${title}</div>
                <div class="notification-text">${message}</div>
            </div>
            <button class="notification-close" aria-label="Dismiss"><i class="fas fa-times"></i></button>
        `;
        const remove = () => {
            if (card.classList.contains('exiting')) return;
            card.classList.add('exiting');
            card.addEventListener('animationend', () => card.remove(), { once: true });
        };
        card.querySelector('.notification-close')?.addEventListener('click', remove);
        els.notificationStack.appendChild(card);
        const timer = setTimeout(remove, 4000);
        card.addEventListener('mouseenter', () => clearTimeout(timer));
        card.addEventListener('mouseleave', () => setTimeout(remove, 1200));
    }

    function iconForType(type) {
        switch (type) {
            case 'success': return 'fa-check-circle';
            case 'warning': return 'fa-exclamation-circle';
            case 'error': return 'fa-times-circle';
            default: return 'fa-bell';
        }
    }

    function getGameTitleById(id) {
        if (!id) return '';
        const game = state.games.find((g) => String(g.id) === String(id));
        return game?.title || '';
    }

    function buildMiniAvatar(user) {
        if (!user) return null;
        const div = document.createElement('div');
        div.className = 'mini-avatar';
        const avatarUrl = user.profile?.avatar || user.avatar;
        if (avatarUrl) div.style.backgroundImage = `url(${avatarUrl})`;
        else {
            const color = user.profile?.accentColor || user.accentColor;
            if (color) div.style.background = color;
            div.textContent = (user.username || '?')[0].toUpperCase();
        }
        return div;
    }

    function capitalize(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''; }

    function enableCustomCursor(settings) {
        const size = settings.cursorSize ?? 8;
        const color = settings.cursorColor || '#ffffff';
        document.body.classList.add('custom-cursor-enabled');
        document.documentElement.style.setProperty('--cursor-size', `${size}px`);
        document.documentElement.style.setProperty('--cursor-color', color);
        if (!runtime.cursorEl) {
            const dot = document.createElement('div');
            dot.className = 'custom-cursor-dot';
            document.body.appendChild(dot);
            runtime.cursorEl = dot;
            runtime.cursorHandler = (e) => {
                dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
            };
            window.addEventListener('pointermove', runtime.cursorHandler);
        }
    }

    function disableCustomCursor() {
        document.body.classList.remove('custom-cursor-enabled');
        if (runtime.cursorEl) {
            runtime.cursorEl.remove();
            runtime.cursorEl = null;
        }
        if (runtime.cursorHandler) {
            window.removeEventListener('pointermove', runtime.cursorHandler);
            runtime.cursorHandler = null;
        }
    }

    function startParticles(settings) {
        const canvas = runtime.particle.canvas || (runtime.particle.canvas = document.getElementById('particleBackground'));
        if (!canvas) return;
        const ctx = runtime.particle.ctx || (runtime.particle.ctx = canvas.getContext('2d'));
        const count = Math.min(Math.max(settings.particleCount ?? 50, 0), 300);
        const speed = settings.particleSpeed ?? 0.5;
        const color = settings.particleColor || '#58a6ff';
        canvas.style.display = 'block';

        const resize = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        };
        resize();
        window.removeEventListener('resize', runtime.particle._resize);
        runtime.particle._resize = resize;
        window.addEventListener('resize', resize);

        runtime.particle.particles = Array.from({ length: count }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * speed,
            vy: (Math.random() - 0.5) * speed,
            r: 1.2 + Math.random() * 1.6
        }));

        const tick = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = color;
            for (const p of runtime.particle.particles) {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0) p.x = canvas.width;
                if (p.x > canvas.width) p.x = 0;
                if (p.y < 0) p.y = canvas.height;
                if (p.y > canvas.height) p.y = 0;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fill();
            }
            runtime.particle.anim = requestAnimationFrame(tick);
        };

        cancelAnimationFrame(runtime.particle.anim);
        runtime.particle.anim = requestAnimationFrame(tick);
    }

    function stopParticles() {
        const canvas = runtime.particle.canvas || document.getElementById('particleBackground');
        if (canvas) {
            canvas.style.display = 'none';
        }
        if (runtime.particle.anim) cancelAnimationFrame(runtime.particle.anim);
        runtime.particle.anim = null;
    }

    function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    function normalizeUser(user) {
        if (!user) return null;
        const normalized = { ...user };
        normalized.profile = normalized.profile || {};
        normalized.profile.lastPlayed = Array.isArray(normalized.profile.lastPlayed) ? normalized.profile.lastPlayed : [];
        return normalized;
    }

    function updateLocalLastPlayed(gameId) {
        if (!state.user || !gameId) return;
        state.user.profile = state.user.profile || {};
        const existing = Array.isArray(state.user.profile.lastPlayed) ? state.user.profile.lastPlayed.slice() : [];
        const idStr = String(gameId);
        const filtered = existing.filter((id) => String(id) !== idStr);
        filtered.unshift(idStr);
        state.user.profile.lastPlayed = filtered.slice(0, 10);
        renderPlayHistory();
    }

    function updateLastPlayedState(list) {
        if (!state.user || !Array.isArray(list)) return;
        state.user.profile = state.user.profile || {};
        state.user.profile.lastPlayed = list.map((id) => String(id));
        renderPlayHistory();
    }

    function getLastPlayedGames() {
        return Array.isArray(state.user?.profile?.lastPlayed) ? state.user.profile.lastPlayed : [];
    }

    function renderPlayHistory() {
        renderCurrentlyPlaying();
        renderPreviouslyPlayed();
        renderOnlineFriends();
    }

    function renderOnlineFriends() {
        const list = els.sidebarOnlineFriends;
        if (!list) return;
        list.innerHTML = '';
        if (!state.user) {
            list.innerHTML = '<li class="sidebar-empty">Sign in to see friends online</li>';
            return;
        }
        const online = (state.friends?.friends || []).filter((f) => f.presence?.online);
        if (!online.length) {
            list.innerHTML = '<li class="sidebar-empty">No friends online</li>';
            return;
        }
        const frag = document.createDocumentFragment();
        online.slice(0, 10).forEach((f) => {
            const li = document.createElement('li');
            li.className = 'sidebar-online-item';
            const avatar = buildMiniAvatar(f);
            if (avatar) li.appendChild(avatar);
            const meta = document.createElement('div');
            meta.className = 'sidebar-online-meta';
            const name = document.createElement('span');
            name.className = 'mini-text';
            name.textContent = f.username;
            const game = document.createElement('span');
            game.className = 'mini-subtext';
            const title = f.presence?.gameId ? getGameTitleById(f.presence.gameId) || 'Playing' : 'Online';
            game.textContent = title;
            meta.append(name, game);
            li.appendChild(meta);
            li.addEventListener('click', () => {
                if (f.presence?.gameId) openGame(f.presence.gameId);
            });
            frag.appendChild(li);
        });
        list.appendChild(frag);
    }

    function renderCurrentlyPlaying() {
        const list = els.sidebarCurrentPlaying;
        if (!list) return;
        list.innerHTML = '';
        if (!state.user) {
            list.innerHTML = '<li class="sidebar-empty">Sign in to show activity</li>';
            return;
        }
        const activeGame = state.currentGame || runtime.closingGame?.game;
        if (!activeGame) {
            list.innerHTML = '<li class="sidebar-empty">Not playing right now</li>';
            return;
        }
        const item = document.createElement('li');
        item.className = 'sidebar-mini-item active-game';
        const isClosing = !!runtime.closingGame && !state.currentGame;
        const progress = isClosing ? runtime.closingGame.progress || 0 : 1;
        const left = document.createElement('div');
        left.className = 'mini-left';
        const ring = document.createElement('div');
        ring.className = 'sidebar-mini-progress';
        ring.style.setProperty('--progress', `${Math.round(progress * 100)}%`);
        left.appendChild(ring);
        const titleEl = document.createElement('span');
        titleEl.className = 'mini-text';
        titleEl.textContent = activeGame.title;
        left.appendChild(titleEl);
        item.appendChild(left);

        const avatar = buildMiniAvatar(state.user);
        if (avatar) item.appendChild(avatar);
        item.addEventListener('click', () => openGame(activeGame.id));
        list.appendChild(item);
    }

    function renderPreviouslyPlayed() {
        const list = els.sidebarHistory;
        if (!list) return;
        list.innerHTML = '';
        if (!state.user) {
            list.innerHTML = '<li class="sidebar-empty">Sign in to track play history</li>';
            return;
        }
        const lastPlayed = getLastPlayedGames();
        if (!lastPlayed.length) {
            list.innerHTML = '<li class="sidebar-empty">No previous games yet</li>';
            return;
        }
        const frag = document.createDocumentFragment();
        lastPlayed.slice(0, 10).forEach((id) => {
            const title = getGameTitleById(id) || 'Unknown Game';
            const li = document.createElement('li');
            li.className = 'sidebar-mini-item';
            const left = document.createElement('div');
            left.className = 'mini-left';
            const text = document.createElement('span');
            text.className = 'mini-text';
            text.textContent = title;
            left.appendChild(text);
            li.appendChild(left);
            const icon = document.createElement('i');
            icon.className = 'fas fa-arrow-up-right-from-square';
            li.appendChild(icon);
            li.addEventListener('click', () => openGame(id));
            frag.appendChild(li);
        });
        list.appendChild(frag);
    }

    function applyClockSetting(show) {
        const enable = show !== false;
        if (!els.headerClock) return;
        els.headerClock.style.display = enable ? 'flex' : 'none';
        if (enable) {
            startClock();
        } else {
            stopClock();
        }
    }

    function startClock() {
        if (runtime.clockTimer) clearInterval(runtime.clockTimer);
        const tick = () => {
            if (!els.statusClockText) return;
            const now = new Date();
            const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const date = now.toLocaleDateString();
            els.statusClockText.textContent = `${time} • ${date}`;
        };
        tick();
        runtime.clockTimer = setInterval(tick, 1000);
    }

    function stopClock() {
        if (runtime.clockTimer) clearInterval(runtime.clockTimer);
        runtime.clockTimer = null;
    }

    function applyCurrentSectionSetting(show) {
        const enable = show !== false;
        if (els.sidebarCurrentSection) els.sidebarCurrentSection.style.display = enable ? 'list-item' : 'none';
    }

    function beginCloseCurrentGame() {
        if (!state.currentGame && !runtime.closingGame) return;
        const game = state.currentGame || runtime.closingGame?.game;
        state.currentGame = null;
        if (!game) return;
        runtime.closingGame = { game, endAt: Date.now() + 10000, progress: 0 };
        updatePresence(true, null);
        startCloseTimer();
        renderPlayHistory();
    }

    function startCloseTimer() {
        if (runtime.closeTicker) cancelAnimationFrame(runtime.closeTicker);
        const tick = () => {
            if (!runtime.closingGame) return;
            const total = runtime.closingGame.endAt - (runtime.closingGame.startAt || (runtime.closingGame.endAt - 10000));
            const remaining = runtime.closingGame.endAt - Date.now();
            const elapsed = total - remaining;
            const progress = Math.min(1, Math.max(0, elapsed / total));
            runtime.closingGame.progress = progress;
            if (remaining <= 0) {
                finalizeClosingGame();
                return;
            }
            renderCurrentlyPlaying();
            runtime.closeTicker = requestAnimationFrame(tick);
        };
        runtime.closingGame.startAt = runtime.closingGame.startAt || Date.now();
        runtime.closeTicker = requestAnimationFrame(tick);
    }

    function cancelCloseTimer(stopFrame = false) {
        if (runtime.closeTicker) cancelAnimationFrame(runtime.closeTicker);
        runtime.closeTicker = null;
        runtime.closingGame = null;
        if (stopFrame) stopGameFrame();
    }

    function finalizeClosingGame() {
        stopGameFrame();
        runtime.closingGame = null;
        if (runtime.closeTicker) cancelAnimationFrame(runtime.closeTicker);
        runtime.closeTicker = null;
        renderPlayHistory();
    }

    function stopGameFrame() {
        if (els.gameFrame) {
            els.gameFrame.src = 'about:blank';
        }
    }
})();
