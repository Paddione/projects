# Arena Auth Integration + Infrastructure IngressRoutes

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire arena frontend/backend to the shared auth service via Traefik ForwardAuth cookies, and add Traefik IngressRoutes for Proxmox (10.0.0.7) and FritzBox (10.0.0.1).

**Architecture:** Cookie-based auth via Traefik ForwardAuth (Approach A). The arena backend `/api` routes already use `user-auth-chain` middleware, which injects `X-Auth-User-Id`/`X-Auth-User`/`X-Auth-Email`/`X-Auth-Role` headers on authenticated requests. The frontend loads without auth (uses `default-chain`), checks auth status via `/api/auth/me`, and redirects to `auth.korczewski.de` if unauthenticated. No localStorage tokens — cookies handle everything.

**Tech Stack:** React 18, Express, Zustand, Traefik v3 IngressRoutes, K8s ExternalName services

---

## Task 1: Backend — Add auth middleware + `/api/auth/me` endpoint

**Files:**
- Create: `arena/backend/src/middleware/auth.ts`
- Modify: `arena/backend/src/app.ts`

**Step 1: Create auth middleware**

Create `arena/backend/src/middleware/auth.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';

export interface AuthUser {
    userId: number;
    username: string;
    email: string;
    role: string;
}

/**
 * Extract user info from Traefik ForwardAuth headers.
 * These headers are injected by the user-auth-chain middleware
 * after successful authentication via auth.korczewski.de.
 */
export function extractAuthUser(req: Request): AuthUser | null {
    const userId = req.headers['x-auth-user-id'];
    const username = req.headers['x-auth-user'];
    const email = req.headers['x-auth-email'];
    const role = req.headers['x-auth-role'];

    const userIdStr = Array.isArray(userId) ? userId[0] : userId;
    const usernameStr = Array.isArray(username) ? username[0] : username;
    const emailStr = Array.isArray(email) ? email[0] : email;
    const roleStr = Array.isArray(role) ? role[0] : role;

    if (userIdStr) {
        return {
            userId: parseInt(userIdStr, 10),
            username: usernameStr || emailStr?.split('@')[0] || 'player',
            email: emailStr || '',
            role: roleStr || 'USER',
        };
    }
    return null;
}

/**
 * Middleware that attaches Traefik auth headers to req.user.
 * Does NOT reject unauthenticated requests — Traefik ForwardAuth
 * already handles that at the ingress layer. This just reads
 * the headers that ForwardAuth injects.
 */
export function attachAuthUser(req: Request, _res: Response, next: NextFunction): void {
    (req as any).user = extractAuthUser(req);
    next();
}
```

**Step 2: Add middleware and `/api/auth/me` endpoint to app.ts**

In `arena/backend/src/app.ts`, add after line 16 (`app.use(express.json())`):

```typescript
import { attachAuthUser, extractAuthUser } from './middleware/auth.js';

// Attach Traefik auth headers to every request
app.use(attachAuthUser);
```

Add before the LOBBIES section (after the HEALTH section, ~line 40):

```typescript
// ============================================================================
// AUTH
// ============================================================================

app.get('/api/auth/me', (req, res) => {
    const user = (req as any).user;
    if (!user) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    res.json({ user });
});
```

**Step 3: Update lobby creation to use auth user**

In `arena/backend/src/app.ts`, update the `POST /api/lobbies` handler (line 47-54):

```typescript
app.post('/api/lobbies', async (req, res) => {
    try {
        const user = (req as any).user;
        const lobby = await lobbyService.createLobby({
            hostId: user?.userId ?? req.body.hostId,
            username: user?.username ?? req.body.username,
            settings: req.body.settings,
        });
        res.status(201).json(lobby);
    } catch (error) {
        res.status(400).json({ error: (error as Error).message });
    }
});
```

**Step 4: Commit**

```bash
git add arena/backend/src/middleware/auth.ts arena/backend/src/app.ts
git commit -m "feat(arena): add auth middleware extracting Traefik ForwardAuth headers"
```

---

## Task 2: Frontend — Add AuthGuard and auth store

**Files:**
- Create: `arena/frontend/src/stores/authStore.ts`
- Create: `arena/frontend/src/components/AuthGuard.tsx`
- Modify: `arena/frontend/src/services/apiService.ts`
- Modify: `arena/frontend/src/App.tsx`

**Step 1: Add `credentials: 'include'` and auth API to apiService**

In `arena/frontend/src/services/apiService.ts`, update `fetchJSON` (line 11-21) to include credentials, and add `AUTH_SERVICE_URL` env reading and `getMe()`:

```typescript
import { io, Socket } from 'socket.io-client';

const env = (window as any).__IMPORT_META_ENV__ || {};
const API_URL = import.meta.env.VITE_API_URL || env.VITE_API_URL || '';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || env.VITE_SOCKET_URL || window.location.origin;
const AUTH_SERVICE_URL = import.meta.env.VITE_AUTH_SERVICE_URL || env.VITE_AUTH_SERVICE_URL || '';

// ============================================================================
// REST API
// ============================================================================

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_URL}${url}`, {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        ...options,
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || res.statusText);
    }
    return res.json();
}

export const api = {
    // Auth
    getMe: () => fetchJSON<{ user: { userId: number; username: string; email: string; role: string } }>('/api/auth/me'),
    getAuthServiceUrl: () => AUTH_SERVICE_URL,

    // Health
    health: () => fetchJSON<{ status: string }>('/api/health'),

    // Lobbies
    createLobby: (data: { settings?: Record<string, unknown> }) =>
        fetchJSON('/api/lobbies', { method: 'POST', body: JSON.stringify(data) }),

    getLobby: (code: string) => fetchJSON(`/api/lobbies/${code}`),
    getActiveLobbies: () => fetchJSON('/api/lobbies'),
    deleteLobby: (code: string) => fetchJSON(`/api/lobbies/${code}`, { method: 'DELETE' }),

    // Players
    getPlayer: (authUserId: number) => fetchJSON(`/api/players/${authUserId}`),
    createPlayer: (data: { authUserId: number; username: string; selectedCharacter?: string }) =>
        fetchJSON('/api/players', { method: 'POST', body: JSON.stringify(data) }),

    // Leaderboard
    getLeaderboard: () => fetchJSON('/api/leaderboard'),

    // Matches
    getMatches: (limit = 20) => fetchJSON(`/api/matches?limit=${limit}`),
    getMatchResults: (matchId: number) => fetchJSON(`/api/matches/${matchId}/results`),
};

// ... socket section unchanged
```

**Note:** `createLobby` no longer takes `hostId`/`username` — the backend reads those from Traefik headers.

**Step 2: Create auth store**

Create `arena/frontend/src/stores/authStore.ts`:

```typescript
import { create } from 'zustand';

interface AuthUser {
    userId: number;
    username: string;
    email: string;
    role: string;
}

interface AuthStore {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    setUser: (user: AuthUser) => void;
    clearAuth: () => void;
    setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    setUser: (user) => set({ user, isAuthenticated: true, isLoading: false }),
    clearAuth: () => set({ user: null, isAuthenticated: false, isLoading: false }),
    setLoading: (isLoading) => set({ isLoading }),
}));
```

**Step 3: Create AuthGuard component**

Create `arena/frontend/src/components/AuthGuard.tsx`:

```typescript
import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/apiService';
import { useGameStore } from '../stores/gameStore';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading, setUser, clearAuth, setLoading } = useAuthStore();
    const setPlayer = useGameStore((s) => s.setPlayer);

    useEffect(() => {
        let cancelled = false;

        async function checkAuth() {
            setLoading(true);
            try {
                const { user } = await api.getMe();
                if (cancelled) return;
                setUser(user);
                // Sync auth user to game store
                setPlayer(String(user.userId), user.username);
            } catch {
                if (cancelled) return;
                clearAuth();
                // Redirect to auth service
                const authUrl = api.getAuthServiceUrl();
                if (authUrl) {
                    const callbackURL = encodeURIComponent(window.location.href);
                    window.location.href = `${authUrl}/login?callbackURL=${callbackURL}`;
                }
            }
        }

        checkAuth();
        return () => { cancelled = true; };
    }, []);

    if (isLoading) {
        return (
            <div className="page">
                <p style={{ color: 'var(--color-text-muted)' }}>Authenticating...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="page">
                <p style={{ color: 'var(--color-text-muted)' }}>Redirecting to login...</p>
            </div>
        );
    }

    return <>{children}</>;
}
```

**Step 4: Wrap routes with AuthGuard in App.tsx**

Replace `arena/frontend/src/App.tsx`:

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AuthGuard from './components/AuthGuard';
import Home from './components/Home';
import Lobby from './components/Lobby';
import Game from './components/Game';

export default function App() {
    return (
        <BrowserRouter>
            <AuthGuard>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/lobby/:code" element={<Lobby />} />
                    <Route path="/game/:matchId" element={<Game />} />
                </Routes>
            </AuthGuard>
        </BrowserRouter>
    );
}
```

**Step 5: Commit**

```bash
git add arena/frontend/src/stores/authStore.ts arena/frontend/src/components/AuthGuard.tsx arena/frontend/src/services/apiService.ts arena/frontend/src/App.tsx
git commit -m "feat(arena): add AuthGuard with cookie-based auth via Traefik ForwardAuth"
```

---

## Task 3: Frontend — Update Home.tsx to use auth identity

**Files:**
- Modify: `arena/frontend/src/components/Home.tsx`

**Step 1: Remove username input, use auth user**

Replace `arena/frontend/src/components/Home.tsx`:

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/apiService';
import { useGameStore } from '../stores/gameStore';
import { useAuthStore } from '../stores/authStore';

export default function Home() {
    const navigate = useNavigate();
    const setLobby = useGameStore((s) => s.setLobby);
    const user = useAuthStore((s) => s.user);

    const [joinCode, setJoinCode] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleCreate = async () => {
        setIsLoading(true);
        setError('');
        try {
            const lobby: any = await api.createLobby({});
            setLobby(lobby.code, true);
            navigate(`/lobby/${lobby.code}`);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoin = () => {
        if (!joinCode.trim() || joinCode.trim().length !== 6) {
            setError('Enter a valid 6-character lobby code');
            return;
        }
        navigate(`/lobby/${joinCode.trim().toUpperCase()}`);
    };

    return (
        <div className="page">
            <h1 className="page-title">ARENA</h1>
            <p className="page-subtitle">Top-Down Battle Royale</p>

            {user && (
                <p style={{ color: 'var(--color-text-muted)', marginBottom: 'var(--space-md)' }}>
                    Playing as <strong>{user.username}</strong>
                </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', width: '100%', maxWidth: '380px' }}>
                {error && (
                    <p style={{ color: 'var(--color-danger)', fontSize: '0.9rem', textAlign: 'center' }}>
                        {error}
                    </p>
                )}

                <button
                    className="btn btn-primary btn-lg"
                    onClick={handleCreate}
                    disabled={isLoading}
                    id="create-lobby-btn"
                >
                    {isLoading ? 'Creating...' : 'Create Lobby'}
                </button>

                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-md)',
                    color: 'var(--color-text-muted)',
                    margin: 'var(--space-sm) 0',
                }}>
                    <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
                    <span style={{ fontSize: '0.85rem' }}>or join</span>
                    <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                    <input
                        className="input"
                        type="text"
                        placeholder="LOBBY CODE"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                        maxLength={6}
                        style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.2em', textAlign: 'center' }}
                        id="join-code-input"
                        onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                    />
                    <button
                        className="btn btn-ghost"
                        onClick={handleJoin}
                        id="join-lobby-btn"
                    >
                        Join
                    </button>
                </div>
            </div>
        </div>
    );
}
```

**Key changes:**
- Removed `username` state and input — AuthGuard already set player in gameStore
- `createLobby({})` sends empty body — backend reads user from Traefik headers
- Shows "Playing as **username**" from auth store

**Step 2: Commit**

```bash
git add arena/frontend/src/components/Home.tsx
git commit -m "feat(arena): use auth identity in Home, remove username input"
```

---

## Task 4: K8s — Add `VITE_AUTH_SERVICE_URL` to arena-frontend deployment + entrypoint

**Files:**
- Modify: `k8s/services/arena-frontend/deployment.yaml`
- Modify: `arena/frontend/docker-entrypoint.sh`

**Step 1: Add env var to deployment**

In `k8s/services/arena-frontend/deployment.yaml`, add after the `VITE_SOCKET_URL` env var (line 57):

```yaml
            - name: VITE_AUTH_SERVICE_URL
              value: "https://auth.korczewski.de"
```

**Step 2: Add to docker-entrypoint.sh**

In `arena/frontend/docker-entrypoint.sh`, update the `env-config.js` template to include `VITE_AUTH_SERVICE_URL`:

```sh
#!/bin/sh
cat > /usr/share/nginx/html/env-config.js <<EOF
window.__IMPORT_META_ENV__ = {
  VITE_API_URL: "${VITE_API_URL:-}",
  VITE_SOCKET_URL: "${VITE_SOCKET_URL:-}",
  VITE_AUTH_SERVICE_URL: "${VITE_AUTH_SERVICE_URL:-}",
  VITE_NODE_ENV: "${VITE_NODE_ENV:-production}"
};
EOF
exec dumb-init nginx -g "daemon off;"
```

**Step 3: Commit**

```bash
git add k8s/services/arena-frontend/deployment.yaml arena/frontend/docker-entrypoint.sh
git commit -m "feat(arena): add VITE_AUTH_SERVICE_URL to frontend deployment + entrypoint"
```

---

## Task 5: K8s — Add Proxmox IngressRoute (proxmox.korczewski.de → 10.0.0.7:8006)

**Files:**
- Create: `k8s/infrastructure/external-routes/proxmox.yaml`
- Create: `k8s/infrastructure/external-routes/kustomization.yaml`

**Step 1: Create external-routes directory and Proxmox manifest**

Note: ExternalName services require a DNS name, not a bare IP. For bare IPs, create a headless Service + Endpoints pair.

Create `k8s/infrastructure/external-routes/proxmox.yaml`:

```yaml
---
# Service (no selector — manually managed endpoints)
apiVersion: v1
kind: Service
metadata:
  name: proxmox-external
  namespace: korczewski-infra
  labels:
    app.kubernetes.io/part-of: korczewski
    tier: infrastructure
spec:
  type: ClusterIP
  ports:
    - port: 8006
      targetPort: 8006
      protocol: TCP
---
# Manual Endpoints pointing to Proxmox IP
apiVersion: v1
kind: Endpoints
metadata:
  name: proxmox-external
  namespace: korczewski-infra
subsets:
  - addresses:
      - ip: 10.0.0.7
    ports:
      - port: 8006
        protocol: TCP
---
# Traefik IngressRoute
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: proxmox
  namespace: korczewski-infra
  labels:
    app.kubernetes.io/part-of: korczewski
    tier: infrastructure
spec:
  routes:
    - match: Host(`proxmox.korczewski.de`)
      kind: Rule
      services:
        - name: proxmox-external
          port: 8006
          scheme: https
      middlewares:
        - name: admin-auth-chain
  tls: {}
```

**Step 2: Commit**

```bash
git add k8s/infrastructure/external-routes/proxmox.yaml
git commit -m "feat(k8s): add Proxmox IngressRoute (proxmox.korczewski.de → 10.0.0.7:8006)"
```

---

## Task 6: K8s — Add FritzBox IngressRoute (fritz.korczewski.de → 10.0.0.1)

**Files:**
- Create: `k8s/infrastructure/external-routes/fritzbox.yaml`

**Step 1: Create FritzBox manifest**

Create `k8s/infrastructure/external-routes/fritzbox.yaml`:

```yaml
---
# Service (no selector — manually managed endpoints)
apiVersion: v1
kind: Service
metadata:
  name: fritzbox-external
  namespace: korczewski-infra
  labels:
    app.kubernetes.io/part-of: korczewski
    tier: infrastructure
spec:
  type: ClusterIP
  ports:
    - port: 443
      targetPort: 443
      protocol: TCP
---
# Manual Endpoints pointing to FritzBox IP
apiVersion: v1
kind: Endpoints
metadata:
  name: fritzbox-external
  namespace: korczewski-infra
subsets:
  - addresses:
      - ip: 10.0.0.1
    ports:
      - port: 443
        protocol: TCP
---
# Traefik IngressRoute
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: fritzbox
  namespace: korczewski-infra
  labels:
    app.kubernetes.io/part-of: korczewski
    tier: infrastructure
spec:
  routes:
    - match: Host(`fritz.korczewski.de`)
      kind: Rule
      services:
        - name: fritzbox-external
          port: 443
          scheme: https
      middlewares:
        - name: admin-auth-chain
  tls: {}
```

**Step 2: Create kustomization.yaml for external-routes**

Create `k8s/infrastructure/external-routes/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
  - proxmox.yaml
  - fritzbox.yaml
```

**Step 3: Commit**

```bash
git add k8s/infrastructure/external-routes/
git commit -m "feat(k8s): add FritzBox IngressRoute (fritz.korczewski.de → 10.0.0.1)"
```

---

## Task 7: Review and verify

**Step 1: Review Lobby.tsx for playerId usage**

Lobby.tsx uses `playerId` and `username` from `gameStore` (set by AuthGuard via `setPlayer`). The socket `join-lobby` event sends `{ id: playerId, username }` — this should now be the auth user ID. Verify the Lobby component still works correctly with string-ified auth user IDs.

**Step 2: Verify backend compatibility**

The `LobbyService.createLobby()` receives `hostId` as a number. With auth, this is the `auth_user_id` (integer). Verify `LobbyService` doesn't do anything that breaks with real user IDs vs random temp IDs.

**Step 3: Check for other temp ID usages**

Search for `Math.floor(Math.random()` in the arena frontend — should only exist in Home.tsx (now removed). Verify no other components generate temp IDs.

**Step 4: Local dev fallback**

In local dev (no Traefik), `/api/auth/me` will return 401 (no headers). The frontend will try to redirect to `VITE_AUTH_SERVICE_URL`, which defaults to empty string in dev. Add to `arena/frontend/.env.development`:

```
VITE_AUTH_SERVICE_URL=https://auth.korczewski.de
```

Or for fully local dev without auth, the backend can fall back to reading `req.body.hostId` (already handled in Task 1's updated lobby handler).

**Step 5: Deploy and test**

```bash
# Build + deploy to production
./k8s/scripts/deploy/deploy-arena.sh

# Apply external routes
kubectl apply -k k8s/infrastructure/external-routes/

# Verify
curl -sk -o /dev/null -w "%{http_code}" https://arena.korczewski.de/api/auth/me
# Expected: 401 (no cookie) or 200 (with cookie)

curl -sk -o /dev/null -w "%{http_code}" https://proxmox.korczewski.de/
curl -sk -o /dev/null -w "%{http_code}" https://fritz.korczewski.de/
```
