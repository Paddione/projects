# Jitsi Meet Deployment — Design Spec

**Date:** 2026-03-23
**Status:** Approved
**Domain:** meet.korczewski.de

## Problem Statement

The existing Jitsi deployment in `korczewski-jitsi` namespace has three issues:

1. **Stale public IP** — JVB advertises `217.195.151.120`, Coturn advertises `217.195.151.217`, actual public IP is dynamic (currently `217.195.151.253`). Every ISP IP rotation breaks calls silently.
2. **Under-resourced JVB** — 1 CPU / 512Mi cannot handle 4-participant 720p SFU forwarding (12 simultaneous media streams).
3. **No configuration in git** — All manifests were applied ad-hoc via `kubectl apply`. No deploy script, no kustomization, no reproducibility.

Additionally: no authentication (rooms are open), TURN credential is in a ConfigMap instead of a Secret, and JVB has a LoadBalancer service on `10.10.0.40` conflicting with Traefik.

## Goals

- 4 participants streaming video at 720p with simulcast
- Self-healing public IP resolution (no manual patching on ISP IP change)
- JWT authentication via existing auth service (`auth.korczewski.de`)
- Guest invite links (room-locked, time-limited, no account required)
- All configuration in git, deployable via `deploy-jitsi.sh`

## Architecture

```
Namespace: korczewski-jitsi          Node: k3s-1 (amd64)

  Jicofo ◄──XMPP──► Prosody ◄──XMPP──► JVB (hostNetwork :10000/UDP)
                       │ BOSH                      │
                    Web (:80)              hostNetwork :10000
                       │                           │
  Coturn (hostNetwork :3478,:5349,:49152-49401)    │
                       │                           │
              Traefik (HTTPS)                      │
              meet.korczewski.de                   │
                                                   │
              Router NAT ──────────────────────────┘
              UDP 10000, UDP+TCP 3478, TCP 5349,
              UDP 49152-49401 → 10.0.3.1
```

All pods scheduled on `k3s-1` via `nodeSelector: kubernetes.io/hostname: k3s-1` — this is mandatory for JVB and Coturn (hostNetwork + router port forwarding targets k3s-1's IP), and applied to Prosody/Jicofo/Web for locality. JVB and Coturn use `hostNetwork: true` with `dnsPolicy: ClusterFirstWithHostNet` (required so internal service DNS like `prosody.korczewski-jitsi.svc.cluster.local` resolves via CoreDNS, not host resolver). Web served via Traefik IngressRoute. Colibri WebSocket (`/colibri-ws`) routed through Traefik to JVB's HTTP port (works because the ClusterIP service's endpoint resolves to the node IP when the pod uses hostNetwork).

**Single-node risk:** All Jitsi components are on k3s-1. If that node goes down, Jitsi is fully unavailable. Accepted trade-off for a personal deployment — hostNetwork and port forwarding require a fixed node.

## Dynamic IP Resolution

JVB and Coturn use init containers to resolve the current public IP at startup:

```
Init Container (busybox):
  nslookup meet.korczewski.de | awk '/^Address: / { print $2 }' > /config/public-ip

Main Container:
  export JVB_ADVERTISE_IPS=$(cat /config/public-ip)
  exec /init
```

Uses `nslookup` (available in busybox, no extra packages needed) instead of `dig`. Note: busybox `nslookup` output format varies — the exact awk pattern must be tested against the chosen init container image during implementation. A robust alternative: `nslookup meet.korczewski.de 1.1.1.1 | tail -n 2 | head -n 1 | awk '{ print $NF }'`.

Coturn uses the same pattern but needs a different mechanism: the ConfigMap contains a `turnserver.conf` template with a placeholder (`__PUBLIC_IP__`). The init container resolves the IP, then `sed` replaces the placeholder into a writable emptyDir volume. The main container mounts the writable copy instead of the ConfigMap directly.

This self-heals on pod restart. Since ISP IP changes typically cause brief connectivity loss, pods naturally restart and pick up the new IP.

## Resource Sizing (4 participants at 720p)

| Component | CPU req/limit | Memory req/limit | Notes |
|-----------|--------------|-----------------|-------|
| JVB | 500m / 2000m | 384Mi / 768Mi | SFU: 4 in × 3 out = 12 streams, ~24 Mbps |
| Prosody | 100m / 500m | 128Mi / 256Mi | XMPP signaling only |
| Jicofo | 100m / 500m | 128Mi / 256Mi | Conference orchestration |
| Web | 50m / 250m | 64Mi / 128Mi | Static nginx |
| Coturn | 100m / 500m | 64Mi / 256Mi | TURN relay fallback |

## 720p Video Configuration

Custom `config.js` overrides mounted into the web container:

```javascript
config.resolution = 720;
config.constraints = {
    video: {
        height: { ideal: 720, max: 720, min: 360 }
    }
};
config.maxFullResolutionParticipants = 4;
config.channelLastN = 4;
config.startVideoMuted = 0;
config.disableSimulcast = false;  // simulcast for bandwidth adaptation
```

Simulcast sends 720p + 360p + 180p layers. JVB selects the best layer per viewer based on available bandwidth. All 4 participants get 720p when bandwidth permits; graceful degradation to 360p on weak connections.

## Authentication — JWT via Auth Service

### Authenticated User Flow

1. User visits `meet.korczewski.de/roomname`
2. Jitsi Web detects no JWT → redirects to `auth.korczewski.de/api/jitsi/authorize?redirect_uri=https://meet.korczewski.de/roomname`
3. Auth service validates session (cookie/login) → mints Jitsi JWT → redirects back with `?jwt=<token>`
4. Prosody validates JWT signature (HS256, shared `JITSI_JWT_SECRET`) → user joins as moderator with name + avatar

### Jitsi JWT Format

```json
{
  "iss": "jitsi-meet",
  "sub": "meet.korczewski.de",
  "aud": "jitsi-meet",
  "room": "*",
  "exp": 1711234567,
  "context": {
    "user": {
      "name": "Patrick",
      "email": "patrick@korczewski.de",
      "avatar": "https://auth.korczewski.de/avatars/1.jpg"
    },
    "features": {
      "recording": false,
      "livestreaming": false
    }
  }
}
```

### Guest Invite Flow

Authenticated moderator creates a guest link:

```
POST auth.korczewski.de/api/jitsi/invite
Body: { room: "familycall", expires_in: "2h" }

Returns: { url: "https://meet.korczewski.de/familycall?jwt=<guest-token>" }
```

Guest token differences:
- `room`: locked to specific room name (not `*`)
- `context.user.name`: "Guest" (guest sets display name in Jitsi UI)
- `context.user.guest`: true
- Short-lived expiry (default 2h)
- No moderator privileges

### Prosody Configuration (via env vars)

The official `jitsi/prosody` Docker image generates its Prosody config from environment variables at startup. Do NOT edit Lua config directly — use these env vars in the ConfigMap/Secret:

```yaml
# ConfigMap (jitsi-config)
ENABLE_AUTH: "1"
AUTH_TYPE: "jwt"
JWT_APP_ID: "jitsi-meet"
JWT_ACCEPTED_ISSUERS: "jitsi-meet"
JWT_ACCEPTED_AUDIENCES: "jitsi-meet"
JWT_ALLOW_EMPTY: "0"
ENABLE_GUESTS: "1"

# Secret (jitsi-secrets)
JWT_APP_SECRET: "<JITSI_JWT_SECRET>"
```

Guest access: `ENABLE_GUESTS=1` creates the `guest.meet.internal` VirtualHost with anonymous auth, but `JWT_ALLOW_EMPTY=0` on the main domain means only the guest domain allows tokenless access. Guests arriving via invite links carry a valid JWT (room-locked, time-limited), so they authenticate on the main domain. Guests without a token can only enter the lobby on the guest domain, where the moderator must admit them manually.

**Important:** `JVB_WS_DOMAIN` and `JVB_WS_SERVER_ID` must be carried forward from the current ConfigMap for Colibri WebSocket to work:

```yaml
JVB_WS_DOMAIN: "meet.korczewski.de"
JVB_WS_SERVER_ID: "jvb.meet.korczewski.de"
```

## Auth Service Changes

### New Endpoints

These are simple authenticated endpoints (not OAuth 2.0 flows) — the auth service validates the user's session and mints a purpose-specific JWT. No OAuth client registration needed (unlike the L2P flow which uses authorization codes).

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/jitsi/authorize` | Validates session, mints Jitsi JWT, redirects to Jitsi with `?jwt=` |
| POST | `/api/jitsi/invite` | Authenticated: creates room-locked guest invite JWT |

### New Code

| File | Change |
|------|--------|
| `services/TokenService.ts` | `generateJitsiToken(user, room)` — signs JWT with `JITSI_JWT_SECRET` in Prosody's expected format |
| `services/TokenService.ts` | `generateGuestInvite(room, expiresIn)` — room-locked, short-lived guest JWT |
| `routes/jitsi.ts` | New route file: `GET /authorize` — session check, JWT mint, redirect |
| `routes/jitsi.ts` | `POST /invite` — requires auth, creates guest link |
| `server.ts` | Mount `/api/jitsi` router |
| `.env` | `JITSI_JWT_SECRET` — shared secret, also configured in Prosody |

Approximately 70 lines of new code.

## Security

- `TURN_CREDENTIAL` moved from ConfigMap to Secret
- `secrets.yaml` is `.gitignored` (applied manually). Full Secret keys:
  - `JWT_APP_SECRET` — Jitsi JWT signing (shared with auth service)
  - `TURN_CREDENTIAL` — TURN auth secret (moved from ConfigMap)
  - `JICOFO_AUTH_PASSWORD` — Jicofo XMPP auth
  - `JICOFO_COMPONENT_SECRET` — Jicofo component auth
  - `JVB_AUTH_PASSWORD` — JVB XMPP auth
- Guest tokens are room-locked and time-limited (default 2h)
- Authenticated users get `room: "*"` (access all rooms) with moderator status
- `JWT_ALLOW_EMPTY=0` on main domain — tokenless access blocked; guest domain allows lobby entry but moderator must admit

## File Structure

### Kubernetes Manifests (`jitsi/`)

```
jitsi/
├── namespace.yaml
├── configmap-jitsi.yaml          # XMPP domains, TURN refs, JWT app_id
├── configmap-coturn.yaml         # turnserver.conf template
├── configmap-web.yaml            # custom-config.js (720p + JWT redirect)
├── deployment-prosody.yaml       # JWT token_verification enabled
├── deployment-jicofo.yaml        # nodeSelector: k3s-1
├── deployment-jvb.yaml           # init container, 2 CPU / 768Mi, hostNetwork
├── deployment-web.yaml           # mounts custom-config.js
├── deployment-coturn.yaml        # init container, relay 49152-49401, hostNetwork
├── service-prosody.yaml          # ClusterIP
├── service-jvb-http.yaml         # ClusterIP (colibri-ws only)
├── service-web.yaml              # ClusterIP
├── service-coturn.yaml           # ClusterIP
├── ingressroute.yaml             # Traefik: meet.korczewski.de + /colibri-ws
├── kustomization.yaml
└── .gitignore                    # secrets.yaml
```

Removed: JVB LoadBalancer service (conflicted with Traefik on 10.10.0.40, unused due to hostNetwork).

**Migration cleanup:** The deploy script must delete the stale JVB LoadBalancer service before applying new manifests: `kubectl delete svc jvb -n korczewski-jitsi`. The relay port range (49152-49401) does not need explicit `containerPort`/`hostPort` entries — `hostNetwork: true` makes all host ports accessible to the pod.

### Auth Service

```
auth/src/services/TokenService.ts    # + generateJitsiToken(), generateGuestInvite()
auth/src/routes/jitsi.ts             # NEW: GET /authorize, POST /invite
auth/src/server.ts                   # mount /api/jitsi router
auth/.env                            # + JITSI_JWT_SECRET
```

### Deploy Script

```
k8s/scripts/deploy/deploy-jitsi.sh
```

Applies manifests via `kubectl apply -k` (not skaffold — no Jitsi profile exists), restarts deployments, records in deploy-tracker with service name `jitsi`. No image build (uses official `jitsi/*:stable-9364` images).

## Port Forwarding (Router)

All forwarded to `10.0.3.1` (k3s-1):

| Port | Protocol | Purpose |
|------|----------|---------|
| 10000 | UDP | JVB media |
| 3478 | UDP + TCP | TURN signaling |
| 5349 | TCP | TURNS (TLS) |
| 49152-49401 | UDP | TURN relay (250 ports) |

## Deployment Conventions

- **`imagePullPolicy: Always`** on all deployments (matches project convention)
- **Health probes:**
  - JVB: HTTP readiness/liveness on `:8080/about/health`
  - Prosody: TCP probe on `:5222`
  - Web: HTTP probe on `:80`
  - Jicofo: TCP probe on `:8888` (REST API)
- **Carried-forward env vars** from current ConfigMap (must not be dropped):
  - `XMPP_BOSH_URL_BASE`, `XMPP_DOMAIN`, `XMPP_AUTH_DOMAIN`, `XMPP_MUC_DOMAIN`, `XMPP_INTERNAL_MUC_DOMAIN`, `XMPP_GUEST_DOMAIN`, `XMPP_SERVER`
  - `JVB_WS_DOMAIN`, `JVB_WS_SERVER_ID`, `JVB_PORT`, `JVB_AUTH_USER`, `JVB_ENABLE_APIS`, `COLIBRI_REST_ENABLED`
  - `JICOFO_AUTH_USER`, `DISABLE_HTTPS`, `ENABLE_LETSENCRYPT`, `TZ`
- **TLS secret:** `korczewski-tls` must exist in `korczewski-jitsi` namespace (currently present, copied from infra). Used by Coturn for TURNS. If cert renewal rotates this secret in `korczewski-infra`, it must be synced to `korczewski-jitsi` too.

## Testing Plan

1. Deploy manifests, verify all pods Running
2. Check init container logs — confirm resolved IP matches current public IP
3. Open `meet.korczewski.de` — should redirect to auth login
4. Authenticate — should return to Jitsi with JWT, display name visible
5. Create guest invite — share link, verify guest can join specific room only
6. 2-person call — verify P2P video at 720p
7. 4-person call — verify SFU mode, all streams at 720p, check JVB resource usage
8. Test TURN fallback — connect from a restrictive network (mobile hotspot), verify coturn relay works
