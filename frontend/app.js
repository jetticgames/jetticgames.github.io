// WaterWall frontend (rebuilt) - v3.0.0
(() => {
    'use strict';

    const backendUrl = (typeof window !== 'undefined' && window.WATERWALL_BACKEND_URL) || window.location.origin;

    const state = {
        config: null,
        games: [],
        filteredGames: [],
        categories: [],
        favorites: new Set(),
        user: null,
        friends: { friends: [], incomingRequests: [], outgoingRequests: [] },
        currentGame: null,
        proxyEnabled: false,
        showingFavoritesOnly: false
    };

    let els = {};

    const api = {
        async request(path, options = {}) {
            const res = await fetch(`${backendUrl}${path}`, {
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
                ...options
            });
            if (!res.ok) {
                let message = res.statusText;
                try {
                    const body = await res.json();
                    message = body.error || message;
                } catch (_) {
                    // ignore
                }
                const err = new Error(message);
                err.status = res.status;
                throw err;
            }
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) return res.json();
            return res.text();
        },
        get: (path) => api.request(path),
        post: (path, body) => api.request(path, { method: 'POST', body: JSON.stringify(body || {}) }),
        put: (path, body) => api.request(path, { method: 'PUT', body: JSON.stringify(body || {}) })
    };

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        cacheElements();
        bindNavigation();
        bindSearch();
        bindProfileForm();
        bindFriendsUI();
        bindGameControls();
        bindGlobalEvents();
        registerServiceWorker();
        loadInitialData();
    }

    function cacheElements() {
        els = {
            loader: document.getElementById('appPageLoader'),
            navItems: Array.from(document.querySelectorAll('.nav-item')),
            pages: {
                home: document.getElementById('homePage'),
                friends: document.getElementById('friendsPage'),
                profile: document.getElementById('profileSettingsPage'),
                game: document.getElementById('gamePage')
            },
            statsGames: document.querySelector('[data-stat="games"]'),
            statsCategories: document.querySelector('[data-stat="categories"]'),
            statusDot: document.getElementById('statusDot'),
            statusText: document.getElementById('statusText'),
            searchInput: document.getElementById('searchInput'),
            categoryTabs: document.getElementById('categoryTabs'),
            allGamesGrid: document.getElementById('allGames'),
            favoritesSection: document.getElementById('favoriteGamesSection'),
            favoritesGrid: document.getElementById('favoriteGamesGrid'),
            favoritesTitle: document.getElementById('favoritesTitle'),
            accountLabel: document.getElementById('accountLabel'),
            accountNavItem: document.getElementById('accountNavItem'),
            profileDropdown: document.getElementById('profileDropdown'),
            profileBtn: document.getElementById('openProfileSettingsBtn'),
            logoutBtn: document.getElementById('logoutFromDropdownBtn'),
            friendsAuthNotice: document.getElementById('friendsAuthNotice'),
            friendsUnavailableNotice: document.getElementById('friendsUnavailableNotice'),
            friendsContent: document.getElementById('friendsContent'),
            friendsTabs: Array.from(document.querySelectorAll('.friends-tab')),
            friendsTabPanels: {
                overview: document.getElementById('friendsTabOverview'),
                friends: document.getElementById('friendsTabFriends'),
                requests: document.getElementById('friendsTabRequests'),
                add: document.getElementById('friendsTabAdd')
            },
            friendsLists: {
                presence: document.getElementById('presenceList'),
                friends: document.getElementById('friendsList'),
                incoming: document.getElementById('incomingList'),
                outgoing: document.getElementById('outgoingList')
            },
            friendsCounts: {
                total: document.getElementById('totalFriendsCount'),
                online: document.getElementById('onlineFriendsCount'),
                pending: document.getElementById('pendingRequestsCount')
            },
            addFriendForm: document.getElementById('addFriendForm'),
            addFriendInput: document.getElementById('addFriendUsername'),
            addFriendFeedback: document.getElementById('addFriendFeedback'),
            friendsLoginBtn: document.getElementById('friendsLoginBtn'),
            profileForm: document.getElementById('profileForm'),
            profileUsername: document.getElementById('profileUsername'),
            profileColor: document.getElementById('profileColor'),
            profileSaveIndicator: document.getElementById('profileSaveIndicator'),
            avatarInput: document.getElementById('avatarInput'),
            avatarPreview: document.getElementById('avatarPreview'),
            avatarPlaceholder: document.getElementById('avatarPlaceholder'),
            gameFrame: document.getElementById('gameFrame'),
            gameTitle: document.getElementById('gameTitle'),
            gameCategory: document.getElementById('gameCategory'),
            gameDescription: document.getElementById('gameDescription'),
            gameLoadingOverlay: document.getElementById('gameLoadingOverlay'),
            loadingStatusText: document.getElementById('loadingStatusText'),
            loadingHintText: document.getElementById('loadingHintText'),
            loadingProxyToggle: document.getElementById('loadingProxyToggle'),
            proxyToggleGame: document.getElementById('proxyToggleGame'),
            gameFavBtn: document.querySelector('.game-info-right .fav-btn'),
            fullscreenBtn: document.querySelector('[data-action="fullscreen"]'),
            offlineOverlays: document.getElementById('offlineOverlays'),
            logoutConfirmModal: document.getElementById('logoutConfirmModal'),
            logoutConfirmBtn: document.getElementById('logoutConfirmBtn'),
            logoutCancelBtn: document.getElementById('logoutCancelBtn')
        };
    }

    function bindNavigation() {
        els.navItems.forEach((item) => {
            item.addEventListener('click', (event) => {
                event.preventDefault();
                const page = item.dataset.page;
                setActiveNav(page);
                if (page === 'favorites') {
                    state.showingFavoritesOnly = true;
                    renderGames();
                    scrollToFavorites();
                } else {
                    state.showingFavoritesOnly = false;
                    showPage(page);
                }
            });
        });

        els.accountNavItem?.addEventListener('click', (e) => {
            e.preventDefault();
            if (!state.user) {
                openAuthModal('login');
            } else {
                toggleProfileDropdown();
            }
        });

        els.profileBtn?.addEventListener('click', () => {
            hideProfileDropdown();
            showPage('profile');
        });

        els.logoutBtn?.addEventListener('click', () => {
            hideProfileDropdown();
            showLogoutConfirm();
        });
    }

    function bindSearch() {
        els.searchInput?.addEventListener('input', () => {
            filterGames();
        });
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
            toggleProfileSaving(true);
            try {
                const { user } = await api.put('/api/profile', payload);
                state.user = user;
                refreshUserUI();
                showToast('Profile updated');
            } catch (err) {
                showToast(err.message || 'Failed to save profile', true);
            } finally {
                toggleProfileSaving(false);
            }
        });

        els.avatarInput?.addEventListener('change', async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 1.5 * 1024 * 1024) {
                showToast('Avatar must be under 1.5 MB', true);
                e.target.value = '';
                return;
            }
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result;
                els.avatarPreview.src = dataUrl;
                els.avatarPreview.style.display = 'block';
                els.avatarPlaceholder.style.display = 'none';
                els.avatarPreview.dataset.value = dataUrl;
            };
            reader.readAsDataURL(file);
        });
    }

    function bindFriendsUI() {
        els.friendsTabs.forEach((tab) => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;
                els.friendsTabs.forEach((t) => t.classList.toggle('active', t === tab));
                Object.entries(els.friendsTabPanels).forEach(([key, panel]) => {
                    panel.classList.toggle('active', key === target);
                });
            });
        });

        els.addFriendForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!state.user) return openAuthModal('login');
            const username = els.addFriendInput.value.trim();
            if (!username) return;
            els.addFriendFeedback.textContent = '';
            try {
                await api.post('/api/friends/request', { username });
                els.addFriendFeedback.textContent = `Request sent to ${username}`;
                els.addFriendFeedback.style.color = '#58a6ff';
                await loadFriends();
            } catch (err) {
                els.addFriendFeedback.textContent = err.message || 'Failed to send request';
                els.addFriendFeedback.style.color = '#f85149';
            }
        });

        els.friendsLoginBtn?.addEventListener('click', () => openAuthModal('login'));
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
            const frameWrapper = document.querySelector('.game-frame-wrapper');
            if (!frameWrapper) return;
            if (!document.fullscreenElement) {
                frameWrapper.requestFullscreen?.();
            } else {
                document.exitFullscreen?.();
            }
        });
    }

    function bindGlobalEvents() {
        window.addEventListener('online', updateOfflineState);
        window.addEventListener('offline', updateOfflineState);
        document.addEventListener('click', (e) => {
            if (els.profileDropdown?.contains(e.target) || els.accountNavItem?.contains(e.target)) return;
            hideProfileDropdown();
        });

        els.logoutConfirmBtn?.addEventListener('click', async () => {
            await logout();
            hideLogoutConfirm();
        });
        els.logoutCancelBtn?.addEventListener('click', hideLogoutConfirm);
    }

    async function loadInitialData() {
        showLoader(true);
        try {
            const [config, games, stats, user] = await Promise.all([
                api.get('/api/config').catch(() => null),
                api.get('/api/games'),
                api.get('/api/stats').catch(() => null),
                api.get('/api/auth/me').catch(() => null)
            ]);
            state.config = config;
            state.games = games || [];
            state.filteredGames = state.games.slice();
            state.categories = buildCategories(state.games);
            if (user?.user) {
                state.user = user.user;
                state.favorites = new Set(state.user.favorites || []);
                await loadFriends();
            }
            if (stats) updateStats(stats);
            renderCategoryTabs();
            renderGames();
            renderFavorites();
            refreshUserUI();
            await updateHealthStatus();
        } catch (err) {
            showToast(err.message || 'Failed to load data', true);
        } finally {
            showLoader(false);
            updateOfflineState();
        }
    }

    function buildCategories(games) {
        const cats = new Set(['all']);
        games.forEach((g) => { if (g.category) cats.add(g.category); });
        return Array.from(cats);
    }

    function renderCategoryTabs() {
        if (!els.categoryTabs) return;
        els.categoryTabs.innerHTML = '';
        state.categories.forEach((cat, idx) => {
            const btn = document.createElement('button');
            btn.className = `cat-tab${idx === 0 ? ' active' : ''}`;
            btn.textContent = cat === 'all' ? 'All' : capitalize(cat);
            btn.dataset.category = cat;
            btn.addEventListener('click', () => {
                Array.from(els.categoryTabs.children).forEach((c) => c.classList.remove('active'));
                btn.classList.add('active');
                filterGames();
            });
            els.categoryTabs.appendChild(btn);
        });
    }

    function filterGames() {
        const query = (els.searchInput?.value || '').toLowerCase();
        const activeCatBtn = els.categoryTabs?.querySelector('.cat-tab.active');
        const activeCategory = activeCatBtn ? activeCatBtn.dataset.category : 'all';
        state.filteredGames = state.games.filter((game) => {
            const matchesQuery = !query ||
                game.title.toLowerCase().includes(query) ||
                (game.description || '').toLowerCase().includes(query);
            const matchesCategory = activeCategory === 'all' || (game.category || '').toLowerCase() === activeCategory.toLowerCase();
            const matchesFavorites = !state.showingFavoritesOnly || state.favorites.has(String(game.id));
            return matchesQuery && matchesCategory && matchesFavorites;
        });
        renderGames();
    }

    function renderGames() {
        if (!els.allGamesGrid) return;
        els.allGamesGrid.innerHTML = '';
        const list = state.filteredGames;
        if (!list.length) {
            els.allGamesGrid.innerHTML = '<p class="muted-hint">No games match your filters.</p>';
            return;
        }
        const frag = document.createDocumentFragment();
        list.forEach((game) => frag.appendChild(buildGameCard(game)));
        els.allGamesGrid.appendChild(frag);
    }

    function buildGameCard(game) {
        const card = document.createElement('div');
        card.className = 'game-card';
        card.dataset.id = game.id;
        card.innerHTML = `
            <div class="game-thumb" style="background-image:url('${game.thumbnail || 'images/placeholder.png'}')"></div>
            <div class="game-info">
                <div class="game-meta">
                    <span class="game-category">${capitalize(game.category || 'Other')}</span>
                    <button class="icon-btn small fav-toggle" aria-label="Favorite" data-id="${game.id}">
                        <i class="fas fa-heart"></i>
                    </button>
                </div>
                <h3>${game.title}</h3>
                <p>${(game.description || '').slice(0, 96)}${(game.description || '').length > 96 ? '…' : ''}</p>
            </div>`;

        card.addEventListener('click', (e) => {
            if (e.target.closest('.fav-toggle')) return;
            openGame(game.id);
        });
        card.querySelector('.fav-toggle').addEventListener('click', (e) => {
            e.stopPropagation();
            toggleFavorite(game.id);
        });
        updateCardFavoriteState(card, game.id);
        return card;
    }

    function renderFavorites() {
        if (!els.favoritesGrid) return;
        const favGames = state.games.filter((g) => state.favorites.has(String(g.id)));
        els.favoritesSection.style.display = favGames.length ? 'block' : 'none';
        els.favoritesGrid.innerHTML = '';
        if (!favGames.length) return;
        const frag = document.createDocumentFragment();
        favGames.forEach((game) => frag.appendChild(buildGameCard(game)));
        els.favoritesGrid.appendChild(frag);
    }

    async function openGame(gameId) {
        const game = state.games.find((g) => String(g.id) === String(gameId));
        if (!game) return;
        state.currentGame = game;
        els.gameTitle.textContent = game.title;
        els.gameCategory.textContent = capitalize(game.category || 'Other');
        els.gameDescription.textContent = game.description || '';
        setActiveNav(null);
        showPage('game');
        updateGameFavoriteButton(game.id);
        loadGameFrame(game);
    }

    function loadGameFrame(game) {
        if (!els.gameFrame) return;
        els.gameLoadingOverlay.style.display = 'flex';
        els.loadingStatusText.textContent = 'Loading game...';
        els.loadingHintText.textContent = state.proxyEnabled ? 'Proxy enabled for this session' : 'Direct loading';
        const src = state.proxyEnabled ? `${backendUrl}/proxy?url=${encodeURIComponent(game.embed)}` : game.embed;
        els.gameFrame.src = src;
        const onLoad = () => {
            els.gameLoadingOverlay.style.display = 'none';
            els.gameFrame.removeEventListener('load', onLoad);
        };
        els.gameFrame.addEventListener('load', onLoad);
    }

    function toggleFavorite(gameId) {
        if (!state.user) return openAuthModal('login');
        api.post('/api/favorites/toggle', { gameId: String(gameId) })
            .then(({ favorites }) => {
                state.favorites = new Set(favorites || []);
                renderFavorites();
                renderGames();
                updateGameFavoriteButton(gameId);
            })
            .catch((err) => showToast(err.message || 'Failed to update favorites', true));
    }

    function updateGameFavoriteButton(gameId) {
        if (!els.gameFavBtn) return;
        const isFav = state.favorites.has(String(gameId));
        els.gameFavBtn.classList.toggle('active', isFav);
        els.gameFavBtn.setAttribute('aria-pressed', isFav ? 'true' : 'false');
    }

    function updateCardFavoriteState(card, gameId) {
        const btn = card.querySelector('.fav-toggle');
        if (!btn) return;
        const isFav = state.favorites.has(String(gameId));
        btn.classList.toggle('active', isFav);
        btn.setAttribute('aria-pressed', isFav ? 'true' : 'false');
    }

    function showPage(page) {
        Object.entries(els.pages).forEach(([key, el]) => {
            if (!el) return;
            const shouldShow = key === page || (page === 'favorites' && key === 'home');
            el.style.display = shouldShow ? 'block' : 'none';
            el.classList.toggle('active', shouldShow);
        });
        if (page === 'home' || page === 'favorites') {
            filterGames();
        }
    }

    function setActiveNav(page) {
        els.navItems.forEach((item) => item.classList.toggle('active', item.dataset.page === page));
        if (page) showPage(page);
    }

    function scrollToFavorites() {
        if (!els.favoritesSection) return;
        showPage('home');
        setTimeout(() => {
            els.favoritesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 150);
    }

    function updateStats(stats) {
        if (els.statsGames) els.statsGames.textContent = stats.totalGames ?? state.games.length;
        if (els.statsCategories) els.statsCategories.textContent = stats.categoryCount ?? state.categories.length;
    }

    async function updateHealthStatus() {
        try {
            const health = await api.get('/health');
            setStatus(true, `Online · ${health.games} games`);
        } catch (_) {
            setStatus(false, 'Offline');
        }
    }

    function setStatus(isOnline, text) {
        if (!els.statusDot || !els.statusText) return;
        els.statusDot.classList.toggle('online', isOnline);
        els.statusDot.classList.toggle('offline', !isOnline);
        els.statusText.classList.toggle('online', isOnline);
        els.statusText.classList.toggle('offline', !isOnline);
        els.statusText.textContent = text;
    }

    function refreshUserUI() {
        if (state.user) {
            els.accountLabel.textContent = state.user.username;
            if (state.user.profile?.accentColor && document.documentElement) {
                document.documentElement.style.setProperty('--accent-color', state.user.profile.accentColor);
            }
            els.friendsAuthNotice.style.display = 'none';
            els.friendsContent.style.display = 'block';
            populateProfileForm();
            loadFriends();
        } else {
            els.accountLabel.textContent = 'Sign in / Sign up';
            els.friendsAuthNotice.style.display = 'block';
            els.friendsContent.style.display = 'none';
        }
    }

    function populateProfileForm() {
        if (!state.user) return;
        if (els.profileUsername) els.profileUsername.value = state.user.username || '';
        if (els.profileColor) els.profileColor.value = state.user.profile?.accentColor || '#58a6ff';
        if (state.user.profile?.avatar && els.avatarPreview) {
            els.avatarPreview.src = state.user.profile.avatar;
            els.avatarPreview.style.display = 'block';
            els.avatarPlaceholder.style.display = 'none';
            els.avatarPreview.dataset.value = state.user.profile.avatar;
        }
    }

    async function loadFriends() {
        if (!state.user) return;
        try {
            const data = await api.get('/api/friends');
            state.friends = data;
            renderFriends();
        } catch (err) {
            console.warn('Friends load failed', err);
            els.friendsUnavailableNotice.style.display = 'block';
            els.friendsContent.style.display = 'none';
        }
    }

    function renderFriends() {
        const { friends = [], incomingRequests = [], outgoingRequests = [] } = state.friends || {};
        els.friendsUnavailableNotice.style.display = 'none';
        els.friendsContent.style.display = 'block';
        renderFriendList(els.friendsLists.friends, friends, true);
        renderFriendList(els.friendsLists.presence, friends.slice(0, 5), false);
        renderRequests(els.friendsLists.incoming, incomingRequests, 'accept');
        renderRequests(els.friendsLists.outgoing, outgoingRequests, 'pending');
        els.friendsCounts.total.textContent = friends.length;
        els.friendsCounts.online.textContent = friends.length;
        els.friendsCounts.pending.textContent = incomingRequests.length;
    }

    function renderFriendList(container, list, allowRemove) {
        if (!container) return;
        container.innerHTML = '';
        if (!list.length) {
            container.innerHTML = '<li class="muted-hint">No friends yet.</li>';
            return;
        }
        list.forEach((friend) => {
            const li = document.createElement('li');
            li.className = 'friend-row';
            li.innerHTML = `
                <div class="friend-avatar" style="background:${friend.accentColor || '#58a6ff'}">${friend.username?.[0]?.toUpperCase() || '?'}</div>
                <div class="friend-meta">
                    <div class="friend-name">${friend.username}</div>
                    <div class="friend-status">Online</div>
                </div>
            `;
            if (allowRemove) {
                const btn = document.createElement('button');
                btn.textContent = 'Remove';
                btn.className = 'update-check-btn';
                btn.addEventListener('click', async () => {
                    await api.post('/api/friends/remove', { username: friend.username });
                    await loadFriends();
                });
                li.appendChild(btn);
            }
            container.appendChild(li);
        });
    }

    function renderRequests(container, list, mode) {
        if (!container) return;
        container.innerHTML = '';
        if (!list.length) {
            container.innerHTML = '<li class="muted-hint">Nothing here yet.</li>';
            return;
        }
        list.forEach((friend) => {
            const li = document.createElement('li');
            li.className = 'friend-row';
            li.innerHTML = `
                <div class="friend-avatar" style="background:${friend.accentColor || '#58a6ff'}">${friend.username?.[0]?.toUpperCase() || '?'}</div>
                <div class="friend-meta">
                    <div class="friend-name">${friend.username}</div>
                    <div class="friend-status">Request</div>
                </div>
            `;
            if (mode === 'accept') {
                const accept = document.createElement('button');
                accept.textContent = 'Accept';
                accept.className = 'update-check-btn';
                accept.addEventListener('click', async () => {
                    await api.post('/api/friends/respond', { username: friend.username, action: 'accept' });
                    await loadFriends();
                });
                const decline = document.createElement('button');
                decline.textContent = 'Decline';
                decline.className = 'update-check-btn';
                decline.addEventListener('click', async () => {
                    await api.post('/api/friends/respond', { username: friend.username, action: 'decline' });
                    await loadFriends();
                });
                li.append(accept, decline);
            } else {
                const pending = document.createElement('span');
                pending.className = 'muted-hint';
                pending.textContent = 'Pending';
                li.appendChild(pending);
            }
            container.appendChild(li);
        });
    }

    function updateProxyUI() {
        const active = state.proxyEnabled;
        if (els.proxyToggleGame) {
            els.proxyToggleGame.classList.toggle('off', !active);
            els.proxyToggleGame.setAttribute('aria-pressed', active ? 'true' : 'false');
            els.proxyToggleGame.title = active ? 'Proxy Enabled' : 'Proxy Disabled';
        }
    }

    function showLoader(show) {
        if (!els.loader) return;
        els.loader.style.display = show ? 'flex' : 'none';
        if (!show) els.loader.classList.add('fade-out');
    }

    function updateOfflineState() {
        const offline = !navigator.onLine;
        if (els.offlineOverlays) els.offlineOverlays.style.display = offline ? 'block' : 'none';
    }

    function toggleProfileSaving(isSaving) {
        if (els.profileSaveIndicator) els.profileSaveIndicator.style.display = isSaving ? 'inline-block' : 'none';
        if (els.profileForm) els.profileForm.querySelectorAll('input, button').forEach((el) => { el.disabled = isSaving; });
    }

    function showToast(message, isError = false) {
        console[isError ? 'warn' : 'log'](message);
        const existing = document.getElementById('ww-toast');
        if (existing) existing.remove();
        const el = document.createElement('div');
        el.id = 'ww-toast';
        el.textContent = message;
        el.style.position = 'fixed';
        el.style.bottom = '24px';
        el.style.right = '24px';
        el.style.padding = '12px 16px';
        el.style.background = isError ? '#f85149' : '#238636';
        el.style.color = '#fff';
        el.style.borderRadius = '10px';
        el.style.zIndex = '20000';
        el.style.boxShadow = '0 10px 30px rgba(0,0,0,0.35)';
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 3200);
    }

    function capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function toggleProfileDropdown() {
        if (!els.profileDropdown) return;
        const isOpen = els.profileDropdown.getAttribute('aria-hidden') === 'false';
        els.profileDropdown.setAttribute('aria-hidden', isOpen ? 'true' : 'false');
    }

    function hideProfileDropdown() {
        if (els.profileDropdown) els.profileDropdown.setAttribute('aria-hidden', 'true');
    }

    async function logout() {
        try {
            await api.post('/api/auth/logout');
        } finally {
            state.user = null;
            state.favorites = new Set();
            refreshUserUI();
            renderFavorites();
            renderGames();
            showPage('home');
        }
    }

    function showLogoutConfirm() {
        if (els.logoutConfirmModal) els.logoutConfirmModal.style.display = 'flex';
    }

    function hideLogoutConfirm() {
        if (els.logoutConfirmModal) els.logoutConfirmModal.style.display = 'none';
    }

    // --- Auth modal ---
    function openAuthModal(defaultTab = 'login') {
        let modal = document.getElementById('authModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'authModal';
            modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="auth-modal">
                <div class="auth-tabs">
                    <button data-tab="login" class="auth-tab active">Login</button>
                    <button data-tab="register" class="auth-tab">Register</button>
                </div>
                <form id="authForm" class="auth-form">
                    <label>Username
                        <input type="text" name="username" required minlength="3" maxlength="24" />
                    </label>
                    <label>Password
                        <input type="password" name="password" required minlength="6" />
                    </label>
                    <button type="submit" class="update-check-btn">Continue</button>
                    <p class="auth-feedback" id="authFeedback"></p>
                </form>
                <button class="icon-btn" id="closeAuthModal" style="position:absolute; top:10px; right:10px;"><i class="fas fa-times"></i></button>
            </div>`;
            modal.style.position = 'fixed';
            modal.style.inset = '0';
            modal.style.zIndex = '16000';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.querySelector('.modal-overlay').style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.55);backdrop-filter:blur(2px);';
            modal.querySelector('.auth-modal').style.cssText = 'position:relative;background:#161b22;border:1px solid #30363d;padding:20px 22px;border-radius:12px;width:320px;box-shadow:0 10px 40px rgba(0,0,0,0.6);display:flex;flex-direction:column;gap:12px;';
            modal.querySelectorAll('.auth-tab').forEach((tab) => {
                tab.addEventListener('click', () => {
                    modal.querySelectorAll('.auth-tab').forEach((t) => t.classList.remove('active'));
                    tab.classList.add('active');
                });
            });
            modal.querySelector('#closeAuthModal').addEventListener('click', closeAuthModal);
            modal.querySelector('.modal-overlay').addEventListener('click', closeAuthModal);
            modal.querySelector('#authForm').addEventListener('submit', handleAuthSubmit);
            document.body.appendChild(modal);
        } else {
            modal.style.display = 'flex';
        }
        modal.querySelectorAll('.auth-tab').forEach((tab) => {
            tab.classList.toggle('active', tab.dataset.tab === defaultTab);
        });
        modal.dataset.mode = defaultTab;
    }

    function closeAuthModal() {
        const modal = document.getElementById('authModal');
        if (modal) modal.style.display = 'none';
    }

    async function handleAuthSubmit(e) {
        e.preventDefault();
        const form = e.target;
        const mode = form.closest('#authModal').dataset.mode || 'login';
        const username = form.username.value.trim();
        const password = form.password.value;
        const feedback = document.getElementById('authFeedback');
        feedback.textContent = '';
        try {
            const path = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
            const { user } = await api.post(path, { username, password });
            state.user = user;
            state.favorites = new Set(user.favorites || []);
            refreshUserUI();
            renderFavorites();
            renderGames();
            closeAuthModal();
            showToast(mode === 'register' ? 'Account created' : 'Signed in');
        } catch (err) {
            feedback.textContent = err.message || 'Authentication failed';
        }
    }

    // --- Service worker ---
    function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('SW registration failed', err));
    }
})();
