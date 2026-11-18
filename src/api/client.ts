export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const SESSION_FALLBACK_KEY = 'cc_session_fallback';

export function getFallbackSessionToken(): string | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage.getItem(SESSION_FALLBACK_KEY) : null;
  } catch {
    return null;
  }
}

export function setFallbackSessionToken(token: string | null): void {
  try {
    if (typeof window === 'undefined') return;
    if (token) {
      window.sessionStorage.setItem(SESSION_FALLBACK_KEY, token);
    } else {
      window.sessionStorage.removeItem(SESSION_FALLBACK_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const fallbackToken = getFallbackSessionToken();
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(fallbackToken ? { Authorization: `Bearer ${fallbackToken}` } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };

  if (url.startsWith('/api/auth/logout')) {
    setFallbackSessionToken(null);
  }

  const method = (options.method || 'GET').toUpperCase();
  const isIdempotent = method === 'GET' || method === 'HEAD';
  const maxAttempts = isIdempotent ? 3 : 1;

  let res: Response | null = null;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (options.signal?.aborted) break;
    try {
      res = await fetch(url, {
        ...options,
        headers,
        credentials: 'include',
      });
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts && !options.signal?.aborted) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 350));
        continue;
      }
    }
  }

  if (!res || lastError) {
    throw new ApiError('Network connection error. Please check your connection and try again.', 0);
  }

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'Unexpected server response.' };
  }

  if (url.startsWith('/api/auth/logout')) {
    setFallbackSessionToken(null);
  } else if (res.ok && data && typeof data.sessionToken === 'string' && data.sessionToken) {
    setFallbackSessionToken(data.sessionToken);
  } else if (res.status === 401) {
    setFallbackSessionToken(null);
  }

  if (!res.ok) {
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  }
  return data as T;
}
