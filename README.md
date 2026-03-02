# Jettic Games

Public documentation for the current Jettic Games stack. The project is a full-stack web app with an Express backend and a single-page frontend that it serves.

## Overview
- Backend: Express API with authentication, admin tools, analytics snapshots, and a lightweight CORS proxy for embeds. Static assets (SPA bundle and game thumbnails) are served from the same server.
- Frontend: Modern SPA (vanilla/ES modules) rendered from `frontend/dist` at runtime; uses the API for auth, game data, friends, and admin flows.
- Storage: File-backed JSON/YAML under `backend/data/` for users, sessions, games, banner config, requests, reports, and analytics. Game thumbnails live in `backend/images/` and are served from `/images/*`.

## Repository layout
- backend/server.js — Express API, auth, admin, proxy, sitemap, and static hosting (including `/images`).
- backend/data/ — JSON/YAML stores (users, games, config, banner, requests, reports, analytics, sessions).
- backend/images/ — Game thumbnails referenced by `backend/data/games.json`.
- frontend/ — Source for the SPA; built output lives in `frontend/dist/` and is what the backend serves.
- frontend/public/ — Static assets copied into the build (config, version, icons, service worker, etc.).

## Local development
Requirements: Node 18+.

```sh
# Backend (serves API + SPA)
cd backend
npm install
npm run dev   # http://localhost:3000

# Frontend (if you need to rebuild the bundle)
cd ../frontend
npm install
npm run build # outputs to frontend/dist consumed by the backend
```

Data files are created on first run. Because storage is local JSON/YAML, avoid committing real user data or secrets.

## Configuration
- PORT (default 3000)
- PUBLIC_BASE_URL — base used for sitemap and absolute asset URLs when behind a proxy
- JWT_SECRET — overrides the generated secret at `backend/data/session-secret.txt`
- ACCESS_TOKEN_TTL_SECONDS (default 3600)
- REFRESH_TOKEN_TTL_DAYS (default 14)
- COOKIE_SECURE (true in production by default)
- COOKIE_SAME_SITE (defaults to none when secure, otherwise lax)
- COOKIE_DOMAIN (optional)
- TRUST_PROXY — Express trust proxy setting; defaults to `loopback, linklocal, uniquelocal`

## Admin access (local)
- Seed an admin user by setting `admin: true` on an account in `backend/data/users.json`.
- Use the Admin page in the app to manage games, users (ban/unban/delete), defaults/presets, banner, analytics, requests, and reports.

## Notes
- Legacy worker-based hosting is gone; everything runs through the Express server.
- Thumbnails are expected to be relative paths like `images/foo.png` in `backend/data/games.json` and are served from `/images` by the backend.

