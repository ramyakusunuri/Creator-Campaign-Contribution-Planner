/**
 * Centralized API Client for C24 Platform.
 * Intercepts responses and maps HTTP 401, 403, 404, 409, 422, and 429 to clear, standardized errors.
 */

export class ApiError extends Error {
  public status: number;
  public data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export type KeyRole = 'brand' | 'report' | 'agency';

export interface RequestOptions extends RequestInit {
  keyRole?: KeyRole;
  apiKey?: string;
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { keyRole = 'brand', apiKey, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>)
  };

  if (apiKey) {
    if (keyRole === 'brand') {
      headers['X-Brand-Key'] = apiKey;
    } else if (keyRole === 'report') {
      headers['X-Report-Key'] = apiKey;
    } else if (keyRole === 'agency') {
      headers['X-Agency-Key'] = apiKey;
    }
  }

  let res: Response;
  try {
    res = await fetch(endpoint, {
      ...rest,
      headers
    });
  } catch (netErr: any) {
    throw new ApiError(0, `Network failure: ${netErr.message || 'Unable to connect to server'}`);
  }

  let payload: any = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      payload = await res.json();
    } catch {}
  } else {
    try {
      payload = await res.text();
    } catch {}
  }

  if (!res.ok) {
    const backendMessage = payload?.error || payload?.message;

    let friendlyMessage = backendMessage;
    switch (res.status) {
      case 401:
        friendlyMessage = backendMessage || 'Authentication required (401). Missing or invalid key.';
        break;
      case 403:
        friendlyMessage = backendMessage || 'Access forbidden (403). Your key is not authorized for this resource.';
        break;
      case 404:
        friendlyMessage = backendMessage || 'Resource not found (404).';
        break;
      case 409:
        friendlyMessage = backendMessage || 'Conflict (409). A record with this identifier already exists.';
        break;
      case 422:
        friendlyMessage = backendMessage || 'Unprocessable entity (422). Request blocked by business validation rules.';
        break;
      case 429:
        friendlyMessage = backendMessage || 'Too many requests (429). Rate limit or subscriber capacity exceeded.';
        break;
      default:
        friendlyMessage = backendMessage || `Server responded with HTTP ${res.status}`;
    }

    throw new ApiError(res.status, friendlyMessage, payload);
  }

  return payload as T;
}

export const api = {
  get: <T = any>(url: string, opts?: RequestOptions) => apiRequest<T>(url, { ...opts, method: 'GET' }),
  post: <T = any>(url: string, body?: any, opts?: RequestOptions) =>
    apiRequest<T>(url, { ...opts, method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T = any>(url: string, body?: any, opts?: RequestOptions) =>
    apiRequest<T>(url, { ...opts, method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T = any>(url: string, opts?: RequestOptions) => apiRequest<T>(url, { ...opts, method: 'DELETE' })
};
