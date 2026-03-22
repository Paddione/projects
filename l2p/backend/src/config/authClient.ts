const AUTH_SERVICE_URL = process.env['AUTH_SERVICE_URL'] || 'http://localhost:5500';

export async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${AUTH_SERVICE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  return fetch(url, { ...options, headers });
}

// Internal service-to-service calls — access is enforced by NetworkPolicy,
// no shared secret needed.
export async function authFetchInternal(path: string, options: RequestInit = {}): Promise<Response> {
  return authFetch(path, options);
}

export async function fetchUserProfile(authToken: string): Promise<any> {
  const res = await authFetch('/api/profile', {
    headers: { 'Authorization': `Bearer ${authToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}
