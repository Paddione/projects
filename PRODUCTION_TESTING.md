# Production Testing Guide

Comprehensive functional testing checklist for all production services at `*.korczewski.de`.
Run these tests after deployments, infrastructure changes, or as periodic health verification.

---

## 0. Infrastructure Health

### 0.1 Cluster Nodes
- [ ] All 6 nodes report `Ready` (`kubectl get nodes`)
- [ ] No `NotReady` or `SchedulingDisabled` conditions
- [ ] All pods running (`kubectl get pods -A` — no CrashLoopBackOff or Pending)

### 0.2 PostgreSQL
- [ ] `pg_isready` succeeds: `kubectl exec -it statefulset/postgres -n korczewski-infra -- pg_isready`
- [ ] All databases exist: `auth_db`, `l2p_db`, `shop_db`, `videovault_db`, `arena_db`
- [ ] PVC is bound: `kubectl get pvc -n korczewski-infra`

### 0.3 Traefik
- [ ] Dashboard accessible at https://traefik.korczewski.de (basic auth)
- [ ] HTTP → HTTPS redirect works (curl `http://l2p.korczewski.de` returns 301/308)
- [ ] TLS certificate valid and not expired: `echo | openssl s_client -connect l2p.korczewski.de:443 2>/dev/null | openssl x509 -noout -dates`
- [ ] All IngressRoutes present: `kubectl get ingressroutes -A`

### 0.4 DNS & Networking
- [ ] All production domains resolve: `auth`, `l2p`, `shop`, `videovault`, `video`, `arena`, `sos`, `traefik`, `registry`
- [ ] kube-vip VIP reachable at `10.10.0.20`
- [ ] LoadBalancer IP assigned to Traefik at `10.10.0.40`

### 0.5 Storage
- [ ] All PVCs bound: `kubectl get pvc -n korczewski-services`
- [ ] SMB-CSI driver healthy: `kubectl get pods -n kube-system -l app=csi-smb-controller`
- [ ] VideoVault media mount readable (check pod logs for mount errors)

### 0.6 Deploy State
- [ ] `./k8s/scripts/utils/deploy-tracker.sh status` — all services show 0 undeployed commits
- [ ] No stale images (pods running latest SHA)

---

## 1. Auth Service

**URL**: https://auth.korczewski.de
**Health**: `GET /health/live`, `GET /health/ready`

### 1.1 Health Endpoints
- [ ] `curl https://auth.korczewski.de/health/live` returns 200
- [ ] `curl https://auth.korczewski.de/health/ready` returns 200

### 1.2 Registration & Login
- [ ] Register a new user via `POST /api/auth/register` — returns user object + token
- [ ] Login with registered credentials via `POST /api/auth/login` — returns JWT
- [ ] Invalid credentials return 401
- [ ] Rate limiting triggers after 5 login attempts in 15 minutes (429 response)

### 1.3 Token Lifecycle
- [ ] `GET /api/auth/verify` with valid token returns user data
- [ ] `POST /api/auth/refresh` with valid refresh token returns new access token
- [ ] Expired token returns 401
- [ ] `POST /api/auth/logout` invalidates session

### 1.4 OAuth (Google)
- [ ] `GET /api/oauth/providers` lists Google
- [ ] `GET /api/oauth/google` redirects to Google consent screen
- [ ] Callback creates/links user account and sets session

### 1.5 User Profile
- [ ] `GET /api/user/me` returns current user profile
- [ ] `PATCH /api/user/profile` updates display name

### 1.6 ForwardAuth (Traefik)
- [ ] `/api/auth/forward-auth` returns 200 for authenticated requests (used by Traefik middleware)
- [ ] Returns 401 for unauthenticated requests

### 1.7 App Catalog
- [ ] `GET /api/apps` returns registered apps (l2p, videovault, shop, arena)
- [ ] Default apps are auto-granted to new users

### 1.8 Password Reset
- [ ] `POST /api/auth/forgot-password` with valid email returns 200 (sends email via SMTP)
- [ ] Reset link in email works and allows password change

---

## 2. L2P (Quiz Platform)

**URL**: https://l2p.korczewski.de
**Health**: `GET /api/health`

### 2.1 Health & Loading
- [ ] `curl https://l2p.korczewski.de/api/health` returns 200 with DB status
- [ ] Frontend loads at https://l2p.korczewski.de — React SPA renders
- [ ] `env-config.js` loads without caching issues (runtime URL injection)
- [ ] No console errors on page load

### 2.2 Authentication
- [ ] Login page renders with username/password fields
- [ ] Login via local credentials works (JWT flow)
- [ ] Login via auth service (unified auth) works
- [ ] AuthGuard redirects unauthenticated users to login
- [ ] Logout clears both localStorage (`auth_token`, `user_data`) and Zustand store

### 2.3 Lobby System
- [ ] Create a lobby — lobby code generated, creator is host
- [ ] Join lobby with code — player appears in lobby
- [ ] Lobby list (`GET /api/lobbies`) shows active lobbies
- [ ] Real-time updates via Socket.io — joining/leaving players update lobby view
- [ ] Ready toggle works — all players ready enables "Start Game"
- [ ] Host can start game when all players are ready

### 2.4 Game Flow
- [ ] Game starts — question appears with timer countdown
- [ ] Submit answer — score updates based on correctness and speed
- [ ] All questions complete — results screen shows rankings
- [ ] WebSocket events flow correctly: `game-started` → `question-started` → answer → next question → `game-ended`

### 2.5 Perks
- [ ] Perk drafts available during game setup
- [ ] Draft-based perks: `perk:pick` and `perk:dump` events work
- [ ] Chosen perks affect gameplay (time extensions, scoring multipliers, etc.)

### 2.6 Characters & Progression
- [ ] Character list loads (`GET /api/characters`)
- [ ] Character selection persists across sessions
- [ ] XP and level progression tracked after games

### 2.7 Leaderboard
- [ ] Hall of Fame loads (`GET /api/hall-of-fame`)
- [ ] Rankings reflect actual game results

### 2.8 Socket.io Connection
- [ ] WebSocket connects on page load (check browser DevTools → Network → WS)
- [ ] Reconnects after brief disconnection
- [ ] Error events (`*-error`) are handled gracefully in UI

---

## 3. Arena (Battle Royale)

**URL**: https://arena.korczewski.de
**Health**: `GET /api/health`

### 3.1 Health & Loading
- [ ] `curl https://arena.korczewski.de/api/health` returns 200
- [ ] Frontend loads — PixiJS canvas renders
- [ ] All sprite atlases load (no 404s in Network tab)
- [ ] Audio assets load (OGG/MP3 — check no CSP violations)
- [ ] No `worker-src` or `connect-src` CSP errors in console

### 3.2 Lobby
- [ ] Create lobby — lobby code displayed
- [ ] Join lobby with code — player appears
- [ ] Lobby browser lists active lobbies (`GET /api/lobbies`)
- [ ] Character selection works
- [ ] Host can start match

### 3.3 Gameplay
- [ ] Game renders at target framerate (check for dropped frames)
- [ ] Player movement (WASD / touch controls) sends input via Socket.io
- [ ] Weapons fire correctly (muzzle flash VFX, hit detection)
- [ ] Items spawn and are pickable (health pack, armor plate, machine gun)
- [ ] Grenade launcher works (projectile + explosion VFX + area damage)
- [ ] Cover objects provide protection

### 3.4 Audio
- [ ] Background music plays in lobby and battle
- [ ] Sound effects work: gunshots, footsteps, grenade, pickup, impacts
- [ ] Victory/defeat stings play at match end
- [ ] Volume controls function

### 3.5 Match Lifecycle
- [ ] Zone shrinks over time — damage applied outside zone
- [ ] Last player standing wins — match results screen appears
- [ ] Stats tracked: kills, damage, survival time
- [ ] Match rewards (XP/coins) awarded
- [ ] Spectator mode activates after elimination

### 3.6 Touch Controls
- [ ] Virtual joystick renders on mobile/touch devices
- [ ] Movement and aiming respond to touch input
- [ ] Fire button works

---

## 4. Shop

**URL**: https://shop.korczewski.de
**Health**: `GET /api/health/live`, `GET /api/health/ready`

### 4.1 Health & Loading
- [ ] `curl https://shop.korczewski.de/api/health/live` returns 200
- [ ] `curl https://shop.korczewski.de/api/health/ready` returns 200
- [ ] Frontend loads — Next.js page renders
- [ ] No hydration errors in console

### 4.2 Authentication
- [ ] Login via auth service works
- [ ] Protected pages redirect to login when unauthenticated

### 4.3 Product Display
- [ ] Products/items render on the storefront
- [ ] Product detail pages load correctly

### 4.4 Stripe Checkout
- [ ] "Buy" initiates Stripe checkout session (`POST /api/stripe/checkout`)
- [ ] Stripe checkout page loads with correct amount
- [ ] Successful test payment triggers webhook (`POST /api/stripe/webhook`)
- [ ] Order confirmation / notification appears

### 4.5 Notifications
- [ ] `GET /api/notifications` returns user notifications
- [ ] `POST /api/notifications/read` marks notifications as read

---

## 5. VideoVault

**URL**: https://videovault.korczewski.de (alias: https://video.korczewski.de)
**Health**: `GET /api/health/public`

### 5.1 Health & Loading
- [ ] `curl https://videovault.korczewski.de/api/health/public` returns 200
- [ ] `curl https://videovault.korczewski.de/api/db/health` returns DB status
- [ ] Frontend loads — React SPA renders
- [ ] Alias https://video.korczewski.de also works

### 5.2 Authentication
- [ ] Admin login required for write operations
- [ ] Basic auth (VIDEO_ADMIN_USER / VIDEO_ADMIN_PASS) accepted
- [ ] Unauthenticated requests to protected endpoints return 401

### 5.3 Video Management
- [ ] `GET /api/videos` returns video list
- [ ] Video metadata displays correctly (title, tags, duration)
- [ ] Bulk upsert works (`POST /api/videos/bulk_upsert`)
- [ ] Edit video metadata (`PATCH /api/videos/:id`)
- [ ] Delete video (`DELETE /api/videos/:id`)
- [ ] Batch delete works (`POST /api/videos/batch_delete`)

### 5.4 File System Access (Chromium only)
- [ ] Directory picker opens and scans for video files
- [ ] File handles stored in session (lost on reload — expected)
- [ ] Rescan restores file handles

### 5.5 Tag System
- [ ] `GET /api/tags` returns tag list
- [ ] Tag merge works (`POST /api/tags/merge`)
- [ ] Filtering by tags works in UI

### 5.6 Thumbnails & Duplicates
- [ ] Thumbnail generation works (`GET /api/thumbnails/:id`)
- [ ] Duplicate detection runs (`POST /api/duplicates/compute`)

### 5.7 Filter Presets
- [ ] `GET /api/presets` returns saved presets
- [ ] Create new preset (`POST /api/presets`)

### 5.8 Storage Mounts
- [ ] SMB-backed PVCs are mounted and readable
- [ ] Media directory listing works (`GET /api/roots`)
- [ ] Video streaming from SMB storage works

---

## 6. SOS (Taschentherapeut)

**URL**: https://sos.korczewski.de
**Health**: `GET /health/live`, `GET /health/ready`

### 6.1 Health & Loading
- [ ] `curl https://sos.korczewski.de/health/live` returns 200
- [ ] `curl https://sos.korczewski.de/health/ready` returns 200
- [ ] Homepage loads — static HTML renders
- [ ] No console errors

### 6.2 Navigation
- [ ] All 15 screens are navigable
- [ ] Back/forward navigation works (SPA routing)
- [ ] No broken links or missing assets

### 6.3 Content
- [ ] German text renders correctly (UTF-8 encoding)
- [ ] All UI elements are responsive (mobile-friendly)
- [ ] No authentication required (public app)

---

## 7. Assetgenerator (Local Tool)

**URL**: http://localhost:5200 (not deployed to k8s)
**Note**: Local development tool only — test when running locally.

### 7.1 Prerequisites
- [ ] Python3, ffmpeg, CUDA detected on startup (prereq warning bar)
- [ ] Server starts with `node --watch server.js --project arena`

### 7.2 Navigation & Views
- [ ] Project selector: Global Library default, then projects (arena, l2p)
- [ ] Audio / Visual tab toggle works
- [ ] Filter bar: All / SFX / Music / Flagged
- [ ] Scan button hidden for Global Library, visible for projects

### 7.3 Global Library
- [ ] Library cards render with category badges, waveforms
- [ ] Play button plays WAV audio from NAS
- [ ] Edit prompt, duration, seed — Save flash confirms
- [ ] Flag / Unflag toggle works with orange styling
- [ ] Per-item Regen: Generating → Processing → waveform refresh
- [ ] Status bar appears during generation with progress and elapsed time
- [ ] Pipeline log shows timestamped events
- [ ] Bulk Regenerate Flagged: SSE stream with progress
- [ ] Add to Library: ID, name, category fields — creates new card
- [ ] Delete sound: confirmation dialog, card removed

### 7.4 Project Slots
- [ ] Slot rows show: target path, play button, library dropdown, sync status
- [ ] Change slot assignment — row flashes, log confirms
- [ ] Add Audio Slot: assign new library sound to path
- [ ] Remove slot with × button

### 7.5 Library ↔ Project Sync
- [ ] Sync copies OGG+MP3 to project output directory
- [ ] Stale badges turn green after sync
- [ ] Import project sounds to library preserves metadata

### 7.6 Visual Pipeline
- [ ] Visual tab shows assets by category (characters, weapons, items, tiles, cover, ui)
- [ ] 4-phase pipeline: concept → model → render → pack
- [ ] Per-phase generation with SSE progress
- [ ] Downstream phases marked stale when upstream regenerates

### 7.7 Data Integrity
- [ ] Duration: rounded to 1 decimal (no IEEE 754 artifacts)
- [ ] Seeds: exact integers (no precision loss)
- [ ] Concurrent generation returns 409 (separate audio/visual locks)

---

## 8. Cross-Service Integration

### 8.1 Auth ↔ Services
- [ ] L2P login via auth service works (token exchange)
- [ ] Shop login via auth service works
- [ ] Arena login via auth service works
- [ ] VideoVault admin auth works independently
- [ ] Token refresh across services (expired token → refresh → retry)

### 8.2 Database Isolation
- [ ] Each service uses its own database (no cross-DB queries)
- [ ] Service restart doesn't affect other services' data

### 8.3 Traefik Routing
- [ ] Each domain routes to the correct service
- [ ] WebSocket upgrade works for L2P and Arena (`/socket.io/*`)
- [ ] Middleware chain applies correctly (CORS, headers, compression)
- [ ] Rate limit headers present: `X-RateLimit-Warning` when approaching limits

### 8.4 CORS
- [ ] Cross-origin requests from `*.korczewski.de` are allowed
- [ ] Requests from unauthorized origins are blocked

### 8.5 TLS
- [ ] All services accessible via HTTPS only
- [ ] HTTP requests redirect to HTTPS
- [ ] Certificate covers `*.korczewski.de` wildcard

---

## 9. Quick Smoke Test

Fast verification after any deployment (2 minutes):

1. [ ] **Nodes**: `kubectl get nodes` — all Ready
2. [ ] **Pods**: `kubectl get pods -n korczewski-services` — all Running
3. [ ] **Auth**: `curl -s https://auth.korczewski.de/health/live` — 200
4. [ ] **L2P**: `curl -s https://l2p.korczewski.de/api/health` — 200
5. [ ] **L2P UI**: Open https://l2p.korczewski.de — login page renders
6. [ ] **Arena**: `curl -s https://arena.korczewski.de/api/health` — 200
7. [ ] **Arena UI**: Open https://arena.korczewski.de — game loads
8. [ ] **Shop**: `curl -s https://shop.korczewski.de/api/health/live` — 200
9. [ ] **VideoVault**: `curl -s https://videovault.korczewski.de/api/health/public` — 200
10. [ ] **SOS**: `curl -s https://sos.korczewski.de/health/live` — 200
11. [ ] **Traefik**: `curl -s https://traefik.korczewski.de/ping` — 200
12. [ ] **Deploy state**: `./k8s/scripts/utils/deploy-tracker.sh status` — no undeployed commits

---

## 10. Automated Health Check Script

```bash
# Quick health check (all production services)
for url in \
  "https://auth.korczewski.de/health/live" \
  "https://l2p.korczewski.de/api/health" \
  "https://arena.korczewski.de/api/health" \
  "https://shop.korczewski.de/api/health/live" \
  "https://videovault.korczewski.de/api/health/public" \
  "https://sos.korczewski.de/health/live"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$status" = "200" ]; then
    echo "OK  $url"
  else
    echo "FAIL ($status) $url"
  fi
done
```

---

## Environment Notes

- **Cluster**: 6-node bare-metal k3s (3 CP amd64 + 3 worker arm64)
- **Registry**: `registry.local:5000` (in-cluster) / `registry.korczewski.de` (external)
- **TLS**: Wildcard `*.korczewski.de` via Let's Encrypt DNS-01 (IPv64)
- **VIP**: API at `10.10.0.20`, Traefik LB at `10.10.0.40`
- **Assetgenerator**: Local only (not deployed) — requires Python3, ffmpeg, CUDA
