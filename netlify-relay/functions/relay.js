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

function normalizeBaseUrl(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  return value.replace(/\/+$/, '');
}

function splitAllowedOrigins(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function getCorsOrigin(requestOrigin, allowedOrigins) {
  if (!requestOrigin) return '*';
  if (!allowedOrigins.length) return '*';
  if (allowedOrigins.includes('*')) return '*';
  return allowedOrigins.includes(requestOrigin) ? requestOrigin : '';
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

function buildTargetUrl(baseUrl, event) {
  const suffix = getPathSuffix(event);
  const query = String(event.rawQuery || '');
  return `${baseUrl}${suffix}${query ? `?${query}` : ''}`;
}

function decodeBody(event) {
  if (!event.body) return undefined;
  if (event.isBase64Encoded) return Buffer.from(event.body, 'base64');
  return event.body;
}

exports.handler = async (event) => {
  const baseUrl = normalizeBaseUrl(process.env.RELAY_TARGET_BASE_URL);
  if (!baseUrl) {
    return {
      statusCode: 500,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Missing RELAY_TARGET_BASE_URL environment variable' })
    };
  }

  const method = String(event.httpMethod || 'GET').toUpperCase();
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';
  const allowedOrigins = splitAllowedOrigins(process.env.RELAY_ALLOWED_ORIGINS);
  const corsOrigin = getCorsOrigin(requestOrigin, allowedOrigins);

  const corsHeaders = {
    'access-control-allow-origin': corsOrigin || 'null',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization, X-Requested-With',
    'access-control-allow-credentials': 'true',
    'access-control-max-age': '86400',
    vary: 'Origin'
  };

  if (!corsOrigin) {
    return {
      statusCode: 403,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Origin not allowed' })
    };
  }

  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders,
      body: ''
    };
  }

  const targetUrl = buildTargetUrl(baseUrl, event);

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
  try {
    upstreamResponse = await fetch(targetUrl, {
      method,
      headers: upstreamHeaders,
      body: ['GET', 'HEAD'].includes(method) ? undefined : decodeBody(event),
      redirect: 'follow'
    });
  } catch (error) {
    return {
      statusCode: 502,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to reach backend', detail: error.message })
    };
  }

  const responseHeaders = { ...corsHeaders };
  upstreamResponse.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (HOP_BY_HOP_HEADERS.has(lower)) return;
    if (lower === 'set-cookie') return;
    responseHeaders[key] = value;
  });

  const contentType = upstreamResponse.headers.get('content-type') || '';
  const isText =
    contentType.startsWith('text/') ||
    contentType.includes('application/json') ||
    contentType.includes('application/javascript') ||
    contentType.includes('application/xml') ||
    contentType.includes('application/x-www-form-urlencoded');

  if (isText) {
    return {
      statusCode: upstreamResponse.status,
      headers: responseHeaders,
      body: await upstreamResponse.text()
    };
  }

  const buffer = Buffer.from(await upstreamResponse.arrayBuffer());
  return {
    statusCode: upstreamResponse.status,
    headers: responseHeaders,
    body: buffer.toString('base64'),
    isBase64Encoded: true
  };
};
