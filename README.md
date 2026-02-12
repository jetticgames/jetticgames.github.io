# Jettic Games (Developer Guide)

Internal notes for the current Jettic Games stack. This is a private repository; keep operational details inside the team.

## What’s here
- Full-stack app: Express backend (v3) serves both API and the SPA in frontend/.
- File-backed storage in backend/data/ for users, sessions, games, config, requests, reports, and analytics snapshots.
- Social layer: friends, presence/online pings, favorites, playtime tracking, banners, and UI defaults configurable by admins.
- Simple CORS proxy for game embeds plus sitemap generation for shared game links.
- Single deployment target: the Express server started via npm scripts.

## Repository layout
- backend/server.js — Express API, auth, admin, proxy, sitemap, and static file hosting.
- backend/data/ — JSON/YAML data stores (users, games, config, banner, requests, reports, analytics, sessions).
- frontend/ — SPA assets (HTML, JS, CSS, SW) loaded from the same origin as the API.
- backend/README*.md — Additional deployment and API notes; some refer to the legacy worker.

## Key backend capabilities
- Auth: username/email + password, JWT access + refresh cookies, profile edits (username, email, password, avatar, accent color).
- Settings: per-user UI preferences (accent, particles, cursor, clock/current sections, panic button, tab disguise) with admin-defined defaults/presets.
- Content: GET /api/games with search/category filters, GET /api/games/:id, GET /api/stats.
- Favorites: toggle and list favorites per user.
- Friends & presence: send/respond/cancel/remove/block/unblock, presence pings, playtime tracking, last played history, online guests/users counts.
- Requests & reports: users can submit; admins review/update/delete.
- Admin: manage games, users (ban/unban/delete), defaults/presets, banner, analytics snapshots, and view relations/login history.
- Banner: YAML-backed announcement bar with optional CTA button.
- Proxy: GET /proxy?url=... streams remote content with permissive CORS (no HTML rewriting).
- SEO: dynamic sitemap.xml generated from games list.

## Running locally
Requirements: Node 18+.

```
cd backend
npm install
npm run dev   # starts Express, serves API + SPA on http://localhost:3000
```

Data files are created on first run. Because storage is local JSON/YAML, commits can easily include sensitive state—review backend/data/ before pushing.

## Environment knobs
- PORT (default 3000)
- PUBLIC_BASE_URL — used for sitemap/base URL generation when behind a proxy.
- JWT_SECRET — overrides generated secret stored in backend/data/session-secret.txt.
- ACCESS_TOKEN_TTL_SECONDS (default 3600), REFRESH_TOKEN_TTL_DAYS (default 30).
- COOKIE_SECURE (true in production by default), COOKIE_SAME_SITE (defaults to none when secure, otherwise lax), COOKIE_DOMAIN (optional).
- TRUST_PROXY — Express trust proxy setting; defaults to loopback, linklocal, uniquelocal.

## Admin workflow (in-app UI)
- Log in with an admin account (set admin: true in backend/data/users.json if seeding locally).
- Manage games, users, requests, reports, defaults/presets, banner, and analytics from the Admin page in the SPA.

## Notes
- The legacy Cloudflare Worker code and configs have been removed; all runtime paths go through the Express server.

## Troubleshooting
- CORS/proxy issues: confirm you are hitting the Express proxy (/proxy) and not the legacy worker routes.
- Session/auth: verify cookies are set for the current domain and JWT_SECRET is consistent between restarts if you persist sessions.
- Data anomalies: stop the server before manually editing JSON/YAML in backend/data/ to avoid concurrent writes.
