# Jettic Games Setup Guide

This repository contains three deployable parts:

- Frontend site: [frontend](frontend)
- Backend API and data store: [backend](backend)
- Netlify HTTPS relay: [netlify-relay](netlify-relay)

Use this guide to run locally or deploy production.

## Architecture

The project supports two network layouts:

1. Direct API
- Browser -> Backend API

2. Netlify relay (recommended when backend is HTTP-only)
- Browser -> Netlify relay (HTTPS) -> Backend API

The frontend includes relay reachability detection via:

- /.netlify/functions/relay/relay-health
- /relay/relay-health

If relay is reachable but initial content still fails to load, the UI shows a high-load warning.

## Prerequisites

- Node.js 18+
- npm
- Optional for relay local development: Netlify CLI (installed in [netlify-relay/package.json](netlify-relay/package.json))

## Quick Start (Local)

### 1. Start backend

```bash
cd backend
npm install
PORT=3000 npm start
```

On first run, backend seeds files in [backend/data](backend/data) and creates a default admin user.

Default admin login:

- Username: admin
- Email: admin@jettic.local
- Password: password

Change this immediately in non-dev environments.

### 2. Start frontend

```bash
cd frontend
npm install
npm run dev
```

Set API target via environment variables (example in `frontend/.env.local`):

```bash
VITE_BACKEND_URLS=https://relay-a.netlify.app/.netlify/functions/relay,https://relay-b.netlify.app/.netlify/functions/relay
VITE_API_BASE_URL=https://relay-a.netlify.app/.netlify/functions/relay
```

### 3. (Optional) Start relay locally

```bash
cd netlify-relay
npm install
RELAY_TARGET_BASE_URL=http://127.0.0.1:3000 npm run dev
```

Local relay test:

```bash
curl http://localhost:8888/.netlify/functions/relay/relay-health
```

## Where To Put Configuration

This repo does not load backend .env files automatically in code (no dotenv import).
Set backend env vars through your process manager, shell, container, or hosting platform.

Recommended placement:

- Backend variables: runtime environment for the backend process (systemd, pm2, Docker, shell export)
- Frontend Vite variables: frontend/.env.local (create this file) or hosting build env
- Relay variables: Netlify site environment settings (or shell for netlify dev)
- No runtime config file is used for backend URLs or secrets

## Complete Environment Variable Reference

### Backend variables (component: backend)

| Name | Required | Example value | Default | Purpose |
|---|---|---|---|---|
| PORT | No | 3000 | 3000 | HTTP port for backend server |
| JWT_SECRET | Yes | c8f7...long-random-secret...9f2 | none | JWT signing secret. Server startup fails if missing |
| PUBLIC_BASE_URL | No | https://api.example.com | null | Canonical public API URL used for generated links and cookie security defaults |
| REFRESH_TOKEN_TTL_DAYS | No | 14 | 14 | Session refresh lifetime in days |
| COOKIE_SECURE | No | true | Auto: true if PUBLIC_BASE_URL starts with https://, else false | Force Secure cookie flag |
| COOKIE_SAME_SITE | No | none | none when secure, else lax | Cookie SameSite policy |
| COOKIE_DOMAIN | No | .example.com | unset | Cookie domain override |
| SYSTEM_STATS_CACHE_MS | No | 10000 | 10000 (minimum 1000) | Cache duration for system resource stats |
| BCRYPT_ROUNDS | No | 10 | 10 (minimum 8) | Password hashing cost |
| HTTP_LOG_ENABLED | No | true | true (disabled only when set to false) | Enable morgan HTTP request logging |
| HTTP_LOG_FORMAT | No | tiny | tiny in production, dev otherwise | Morgan log format |
| NODE_ENV | No | production | development-like behavior when unset | Influences default HTTP_LOG_FORMAT |
| TRUST_PROXY | No | loopback, linklocal, uniquelocal | loopback, linklocal, uniquelocal | Express trust proxy setting |
| RESET_ADMIN_PASSWORD | No (one-time maintenance flag) | true | false | If true at startup, resets admin password to default |

### Frontend build-time variables (component: frontend)

These apply to the React/Vite source in [frontend/src](frontend/src).

| Name | Required | Example value | Default | Purpose |
|---|---|---|---|---|
| VITE_BACKEND_URLS | No | https://relay-a.netlify.app/.netlify/functions/relay,https://relay-b.netlify.app/.netlify/functions/relay | empty | Comma/newline/semicolon-separated backend or relay URLs used by the static frontend runtime |
| VITE_API_BASE_URL | No | https://your-relay-site.netlify.app/.netlify/functions/relay | Hostname fallback when VITE_BACKEND_URLS is not set | Single backend URL fallback used by static and React clients |
| VITE_API_MIN_REQUEST_INTERVAL_MS | No | 150 | 150 | Client-side minimum request interval throttle |
| VITE_BASE_PATH | No | / | / | Vite base path for built assets |

Example frontend/.env.local:

```bash
VITE_BACKEND_URLS=https://relay-a.netlify.app/.netlify/functions/relay,https://relay-b.netlify.app/.netlify/functions/relay
VITE_API_BASE_URL=https://your-relay-site.netlify.app/.netlify/functions/relay
VITE_API_MIN_REQUEST_INTERVAL_MS=150
VITE_BASE_PATH=/
```

### Relay variables (component: relay)

| Name | Required | Example value | Default | Purpose |
|---|---|---|---|---|
| RELAY_TARGET_BASE_URL | Yes | http://192.0.2.10:3000 | none | Upstream backend base URL the relay forwards to |

Set this in Netlify Site settings -> Environment variables.

## Frontend Runtime Configuration

Frontend backend/relay configuration is environment-driven only.

Use:

- VITE_BACKEND_URLS for multiple relays
- VITE_API_BASE_URL for single fallback
- ?api=<url> query override for debugging

Startup behavior with multiple relay URLs:

1. Frontend shuffles relay order for fairness.
2. It pings all configured relays and picks the first successful responder.
3. Relay priority is then ranked by measured response time.
4. If a relay later fails, requests automatically fail over to the next ranked relay.

## Deploying Each Component

### Backend deployment

1. Deploy [backend](backend) on a Node.js host.
2. Set backend env vars (at least JWT_SECRET in production).
3. Start with npm start.
4. Ensure port/firewall routing allows traffic.

### Relay deployment (Netlify)

1. Deploy [netlify-relay](netlify-relay) as a Netlify site.
2. Build command: npm run build
3. Publish directory: .
4. Functions directory: functions
5. Set RELAY_TARGET_BASE_URL.
6. Verify relay:

```bash
curl https://your-relay-site.netlify.app/.netlify/functions/relay/relay-health
```

Expected response includes:

```json
{
	"ok": true,
	"relay": true,
	"reachable": true
}
```

### Frontend deployment

1. Deploy [frontend](frontend) as static hosting.
2. Set backend/relay URLs using Vite environment variables in your deployment pipeline.
3. If deploying behind subpath, set VITE_BASE_PATH for Vite build flows.

## Operational Notes

- If backend is unreachable and relay is reachable, frontend now surfaces a high-load warning.
- Cookie behavior across origins usually requires:
	- COOKIE_SECURE=true
	- COOKIE_SAME_SITE=none
	- HTTPS end-to-end at browser-facing boundary
- For production, set JWT_SECRET explicitly and rotate default admin credentials.

## Troubleshooting

### Frontend shows offline or slow loading

1. Verify VITE_BACKEND_URLS and/or VITE_API_BASE_URL in frontend environment variables.
2. If using relay, verify relay health endpoint:
	 - /.netlify/functions/relay/relay-health
3. Verify relay target:
	 - RELAY_TARGET_BASE_URL points to a reachable backend URL.

### Auth cookies not persisting across domains

1. Set COOKIE_SECURE=true.
2. Set COOKIE_SAME_SITE=none.
3. Set COOKIE_DOMAIN when needed for shared parent domains.
4. Ensure frontend and relay are served over HTTPS.

