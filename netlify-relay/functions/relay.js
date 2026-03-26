const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length'
]);

const RELAY_UPSTREAM_TIMEOUT_MS = 120000;

function normalizeBaseUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  return value.replace(/\/+$/, '');
}

function getCorsOrigin(requestOrigin) {
  return requestOrigin || '*';
}

function getPathSuffix(event) {
  const splat = event.pathParameters && event.pathParameters.splat;
  if (splat) return `/${splat}`;

  const path = String(event.path || '');
  const marker = '/.netlify/functions/relay';
  const idx = path.indexOf(marker);
  if (idx === -1) return '/';

  const tail = path.slice(idx + marker.length);
  return tail.startsWith('/') ? tail : `/${tail}`;
}

function isRelayHealthPath(pathSuffix) {
  return pathSuffix === '/relay-health';
}

function buildTargetUrl(baseUrl, event, suffix = getPathSuffix(event)) {
  const query = String(event.rawQuery || event.rawQueryString || buildQueryString(event.queryStringParameters));
  return `${baseUrl}${suffix}${query ? `?${query}` : ''}`;
}

function buildQueryString(queryStringParameters) {
  if (!queryStringParameters || typeof queryStringParameters !== 'object') return '';
  const pairs = [];
  for (const [key, value] of Object.entries(queryStringParameters)) {
    if (value == null) continue;
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return pairs.join('&');
}

function decodeBody(event) {
  if (!event.body) return undefined;
  if (event.isBase64Encoded) return Buffer.from(event.body, 'base64');
  return event.body;
}

function splitSetCookieHeader(value) {
  if (!value) return [];
  return String(value)
    .split(/,(?=\s*[^;,=\s]+=[^;,=\s]+)/g)
    .map((v) => v.trim())
    .filter(Boolean);
}

function getSetCookieValues(headers) {
  if (!headers) return [];
  if (typeof headers.getSetCookie === 'function') {
    const values = headers.getSetCookie();
    if (Array.isArray(values) && values.length) return values;
  }
  const combined = headers.get('set-cookie');
  return splitSetCookieHeader(combined);
}

function withRelayHeaders(baseHeaders = {}) {
  return {
    ...baseHeaders,
    'x-relay-version': '2'
  };
}

exports.handler = async (event) => {
  const baseUrl = normalizeBaseUrl(process.env.RELAY_TARGET_BASE_URL);
  if (!baseUrl) {
    return {
      statusCode: 500,
      headers: withRelayHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({ error: 'Missing RELAY_TARGET_BASE_URL environment variable' })
    };
  }

  const method = String(event.httpMethod || 'GET').toUpperCase();
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';
  const requestedHeaders =
    event.headers?.['access-control-request-headers'] ||
    event.headers?.['Access-Control-Request-Headers'] ||
    'Content-Type, Authorization, X-Requested-With';
  const corsOrigin = getCorsOrigin(requestOrigin);

  const corsHeaders = {
    'access-control-allow-origin': corsOrigin,
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': requestedHeaders,
    'access-control-allow-credentials': 'true',
    'access-control-max-age': '86400',
    vary: 'Origin, Access-Control-Request-Headers',
    'x-relay-version': '2'
  };

  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ''
    };
  }

  const pathSuffix = getPathSuffix(event);
  if (isRelayHealthPath(pathSuffix)) {
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'content-type': 'application/json',
        'cache-control': 'no-store'
      },
      body: JSON.stringify({
        ok: true,
        relay: true,
        reachable: true,
        timestamp: new Date().toISOString()
      })
    };
  }

  const targetUrl = buildTargetUrl(baseUrl, event, pathSuffix);

  const upstreamHeaders = new Headers();
  for (const [key, value] of Object.entries(event.headers || {})) {
    if (value == null) continue;
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) continue;
    if (lower === 'origin') continue;
    upstreamHeaders.set(key, String(value));
  }

  if (!upstreamHeaders.has('x-forwarded-proto')) upstreamHeaders.set('x-forwarded-proto', 'https');
  if (!upstreamHeaders.has('x-forwarded-host') && event.headers?.host) {
    upstreamHeaders.set('x-forwarded-host', event.headers.host);
  }

  let upstreamResponse;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RELAY_UPSTREAM_TIMEOUT_MS);
  try {
    upstreamResponse = await fetch(targetUrl, {
      method,
      headers: upstreamHeaders,
      body: ['GET', 'HEAD'].includes(method) ? undefined : decodeBody(event),
      signal: controller.signal,
      redirect: 'follow'
    });
  } catch (error) {
    clearTimeout(timeout);
    if (error?.name === 'AbortError') {
      return {
        statusCode: 504,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
        body: JSON.stringify({
          error: 'Upstream backend timed out',
          detail: `Relay waited ${RELAY_UPSTREAM_TIMEOUT_MS}ms for backend response`
        })
      };
    }
    return {
      statusCode: 502,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to reach backend', detail: error.message })
    };
  } finally {
    clearTimeout(timeout);
  }

  const responseHeaders = { ...corsHeaders };
  const setCookieValues = getSetCookieValues(upstreamResponse.headers);
  upstreamResponse.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) return;
    if (lower === 'set-cookie') return;
    responseHeaders[key] = value;
  });

  const contentType = upstreamResponse.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const isText =
    contentType.startsWith('text/') ||
    isJson ||
    contentType.includes('application/javascript') ||
    contentType.includes('application/xml') ||
    contentType.includes('application/x-www-form-urlencoded');

  if (isText) {
    return {
      statusCode: upstreamResponse.status,
      headers: responseHeaders,
      ...(setCookieValues.length ? { multiValueHeaders: { 'set-cookie': setCookieValues } } : {}),
      body: await upstreamResponse.text()
    };
  }

  const buffer = Buffer.from(await upstreamResponse.arrayBuffer());
  return {
    statusCode: upstreamResponse.status,
    headers: responseHeaders,
    ...(setCookieValues.length ? { multiValueHeaders: { 'set-cookie': setCookieValues } } : {}),
    body: buffer.toString('base64'),
    isBase64Encoded: true
  };
};
