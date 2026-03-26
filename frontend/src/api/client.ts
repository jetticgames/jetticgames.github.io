export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface HealthResponse {
  status: string;
  version?: string;
  time?: string;
  games?: number;
  players?: number;
  onlineUsers?: number;
  onlineGuests?: number;
  totalUsers?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user?: {
    id: string;
    username?: string;
    email?: string;
  };
  accessToken?: string;
}

type RelayEnvelope<T> = {
  ok?: boolean;
  status?: number;
  data?: T;
  error?:
    | {
        message?: string;
        details?: unknown;
      }
    | string;
  message?: string;
};

type ApiRequestInit = RequestInit & {
  timeoutMs?: number;
  notifyOnError?: boolean;
};

export class ApiError extends Error {
  readonly method: string
  readonly path: string
  readonly url?: string
  readonly status?: number
  readonly statusText?: string
  readonly isTimeout: boolean
  readonly isNetworkError: boolean

  constructor({
    message,
    method,
    path,
    url,
    status,
    statusText,
    isTimeout = false,
    isNetworkError = false
  }: {
    message: string
    method: string
    path: string
    url?: string
    status?: number
    statusText?: string
    isTimeout?: boolean
    isNetworkError?: boolean
  }) {
    super(message)
    this.name = 'ApiError'
    this.method = method
    this.path = path
    this.url = url
    this.status = status
    this.statusText = statusText
    this.isTimeout = isTimeout
    this.isNetworkError = isNetworkError
  }
}

type ApiErrorHandler = (error: ApiError) => void

export interface MeResponse {
  user: {
    id: string;
    username?: string;
    email?: string;
  };
}

export class ApiClient {
  private readonly baseUrl: string
  private readonly getToken: () => string | null
  private readonly setToken: (token: string | null) => void
  private readonly minRequestIntervalMs: number
  private readonly onError?: ApiErrorHandler
  private requestQueue: Promise<void> = Promise.resolve()
  private lastRequestAt = 0

  constructor(
    baseUrl: string,
    getToken: () => string | null,
    setToken: (token: string | null) => void,
    minRequestIntervalMs = 150,
    onError?: ApiErrorHandler
  ) {
    this.baseUrl = baseUrl
    this.getToken = getToken
    this.setToken = setToken
    this.minRequestIntervalMs = Math.max(0, minRequestIntervalMs)
    this.onError = onError
  }

  private throwApiError(error: ApiError, notify = true): never {
    if (notify) this.onError?.(error)
    throw error
  }

  private async waitForRequestWindow() {
    const run = async () => {
      const elapsed = Date.now() - this.lastRequestAt;
      const delay = Math.max(0, this.minRequestIntervalMs - elapsed);
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      this.lastRequestAt = Date.now();
    };

    const queued = this.requestQueue.then(run, run);
    this.requestQueue = queued.catch(() => undefined);
    await queued;
  }

  private buildUrlCandidates(path: string) {
    const safePath = path.startsWith('/') ? path : `/${path}`;
    const base = this.baseUrl.replace(/\/+$/, '');
    const candidates = [`${base}${safePath}`];

    if (base.endsWith('/relay')) {
      candidates.push(`${base.slice(0, -'/relay'.length)}/.netlify/functions/relay${safePath}`);
    }
    if (base.endsWith('/.netlify/functions/relay')) {
      candidates.push(`${base.slice(0, -'/.netlify/functions/relay'.length)}/relay${safePath}`);
    }

    return Array.from(new Set(candidates));
  }

  private shouldRetryWithAlternateRelayPath(response: Response, attemptedUrl: string) {
    const ct = (response.headers.get('content-type') || '').toLowerCase();
    return response.status === 404 && ct.includes('text/html') && /\/relay\//.test(attemptedUrl);
  }

  private async parseJson(response: Response) {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (err) {
      console.warn('Failed to parse JSON', err);
      return null;
    }
  }

  async request<T = unknown>(path: string, init: ApiRequestInit = {}): Promise<T> {
    await this.waitForRequestWindow();

    const safePath = path.startsWith('/') ? path : `/${path}`;
    const method = (init.method || 'GET').toUpperCase();
    const notifyOnError = init.notifyOnError !== false;
    const timeoutMs = Math.max(1000, Number(init.timeoutMs) || 5000);

    const headers = new Headers(init.headers || {});
    if (!headers.has('Content-Type') && init.body) {
      headers.set('Content-Type', 'application/json');
    }

    const token = this.getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const urlCandidates = this.buildUrlCandidates(path);
    let response: Response | null = null;
    let networkError: ApiError | null = null;

    for (let i = 0; i < urlCandidates.length; i += 1) {
      const candidate = urlCandidates[i];
      try {
        response = await fetch(candidate, {
          ...init,
          headers,
          credentials: 'include',
          signal: init.signal || controller.signal
        });
      } catch (err: unknown) {
        const errName = err instanceof Error ? err.name : '';
        const mixedContent =
          typeof window !== 'undefined' &&
          window.location.protocol === 'https:' &&
          this.baseUrl.startsWith('http://');
        const message =
          errName === 'AbortError'
            ? `${method} ${safePath} timed out after ${timeoutMs}ms`
            : mixedContent
              ? `${method} ${safePath} was blocked by browser mixed-content policy (HTTPS page cannot call HTTP API). Use an HTTPS backend URL.`
              : `Unable to reach backend for ${method} ${safePath}`;
        networkError = new ApiError({
          message,
          method,
          path: safePath,
          url: candidate,
          isTimeout: errName === 'AbortError',
          isNetworkError: true
        });
        if (i === urlCandidates.length - 1) {
          clearTimeout(timeout);
          this.throwApiError(networkError, notifyOnError);
        }
        continue;
      }

      if (this.shouldRetryWithAlternateRelayPath(response, candidate) && i < urlCandidates.length - 1) {
        continue;
      }
      break;
    }

    clearTimeout(timeout);

    if (!response) {
      this.throwApiError(
        networkError ||
          new ApiError({
            message: `Unable to reach backend for ${method} ${safePath}`,
            method,
            path: safePath,
            isNetworkError: true
          }),
        notifyOnError
      );
    }

    const data = (await this.parseJson(response)) as RelayEnvelope<T> | null;
    if (!response.ok) {
      const envelopeError = data?.error;
      const detailMessage =
        (typeof envelopeError === 'object' && envelopeError ? envelopeError.message : undefined) ||
        (typeof envelopeError === 'string' ? envelopeError : undefined) ||
        data?.message ||
        response.statusText;
      const statusLine = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
      const message = `${method} ${safePath} failed (${statusLine})${
        detailMessage ? `: ${detailMessage}` : ''
      }`;
      this.throwApiError(
        new ApiError({
          message,
          method,
          path: safePath,
          url: response.url,
          status: response.status,
          statusText: response.statusText
        }),
        notifyOnError
      );
    }

    if (data && data.ok === true && Object.prototype.hasOwnProperty.call(data, 'data')) {
      return data.data as T;
    }

    return data as T;
  }

  async health() {
    return this.request<HealthResponse>('/health');
  }

  async login(payload: LoginRequest) {
    const data = await this.request<LoginResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (data?.accessToken) this.setToken(data.accessToken);
    return data;
  }

  async me() {
    return this.request<MeResponse>('/api/auth/me', { notifyOnError: false });
  }

  async logout() {
    await this.request('/api/auth/logout', { method: 'POST' });
    this.setToken(null);
  }
}
