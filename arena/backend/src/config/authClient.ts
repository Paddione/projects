const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:5500';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

export async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${AUTH_SERVICE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  return fetch(url, { ...options, headers });
}

export async function authFetchInternal(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Internal-API-Key': INTERNAL_API_KEY,
    ...(options.headers as Record<string, string> || {}),
  };
  return authFetch(path, { ...options, headers });
}

export async function fetchUserProfile(authToken: string): Promise<any> {
  const res = await authFetch('/api/profile', {
    headers: { 'Authorization': `Bearer ${authToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}
