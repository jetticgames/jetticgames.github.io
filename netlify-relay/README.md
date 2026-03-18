# Netlify Relay Proxy

This folder contains a standalone Netlify relay that lets an HTTPS frontend call an HTTP backend:

User -> Netlify HTTPS relay -> HTTP backend

## How it works

- Frontend sends requests to `https://<your-netlify-site>/relay/...`
- Netlify Function forwards to `RELAY_TARGET_BASE_URL` with the same path/query
- Example: `/relay/health` -> `http://YOUR_BACKEND_IP:3000/health`

## Environment variables (Netlify site settings)

- `RELAY_TARGET_BASE_URL` (required)
  - Example: `http://192.9.175.177:3000`

The relay now allows cross-origin callers without an allowlist so you can iterate faster while you rework security.

## Deploy on Netlify

1. Create a new Netlify site from this folder (`netlify-relay`) as the base directory.
2. Build command: `npm run build`
3. Publish directory: `.`
4. Functions directory: `functions`
5. Add env vars above.
6. Deploy.

## Local dev

```bash
cd netlify-relay
npm install
RELAY_TARGET_BASE_URL=http://127.0.0.1:3000 npm run dev
```

## Frontend config example

Set your frontend backend URL to the Netlify relay URL, for example:

```js
window.JETTIC_CONFIG = {
  backendUrl: 'https://your-relay-site.netlify.app/relay'
};
```

Then frontend call `/health` becomes:

- `https://your-relay-site.netlify.app/relay/health` (HTTPS)
- relay forwards to `http://YOUR_BACKEND_IP:3000/health` (HTTP behind relay)

## Notes

- This is a relay, not end-to-end TLS to your backend.
- Relay forwards `Set-Cookie` response headers so backend cookie sessions work through Netlify.
- JSON responses are normalized to this shape:

```json
{
  "ok": true,
  "status": 200,
  "data": { "...": "backend JSON payload" },
  "meta": { "via": "netlify-relay" }
}
```

- Error responses are normalized to this shape:

```json
{
  "ok": false,
  "status": 400,
  "error": {
    "message": "Readable error message",
    "details": { "...": "backend JSON error payload" }
  }
}
```
