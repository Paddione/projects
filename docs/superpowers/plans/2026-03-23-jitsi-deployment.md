# Jitsi Meet Deployment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a production-ready Jitsi Meet instance on k3s with dynamic IP resolution, JWT auth via the existing auth service, 720p 4-person video, and all config in git.

**Architecture:** 5 pods (Prosody, Jicofo, JVB, Web, Coturn) in `korczewski-jitsi` namespace, all pinned to k3s-1 via nodeSelector. JVB and Coturn use hostNetwork for UDP media. Init containers resolve the public IP from DNS at boot. Auth service gets new `/api/jitsi/*` endpoints for JWT minting and guest invites.

**Tech Stack:** Kubernetes manifests (Kustomize), official Jitsi Docker images (stable-9364), Express.js + jsonwebtoken (auth service), Traefik IngressRoute, Coturn TURN server.

**Spec:** `docs/superpowers/specs/2026-03-23-jitsi-deployment-design.md`

---

## File Map

### Kubernetes Manifests (all new files in `jitsi/`)

| File | Responsibility |
|------|---------------|
| `jitsi/namespace.yaml` | Namespace declaration |
| `jitsi/configmap-jitsi.yaml` | All Jitsi env vars (XMPP domains, JWT config, TURN refs, WebSocket config) |
| `jitsi/configmap-coturn.yaml` | `turnserver.conf` template with `__PUBLIC_IP__` placeholder |
| `jitsi/configmap-web.yaml` | Custom `config.js` overrides (720p, simulcast, JWT redirect) |
| `jitsi/deployment-prosody.yaml` | Prosody XMPP server with JWT auth env vars |
| `jitsi/deployment-jicofo.yaml` | Jicofo conference focus |
| `jitsi/deployment-jvb.yaml` | JVB with init container for IP resolution, hostNetwork, bumped resources |
| `jitsi/deployment-web.yaml` | Jitsi Web with custom config mount |
| `jitsi/deployment-coturn.yaml` | Coturn with init container for IP resolution, hostNetwork |
| `jitsi/service-prosody.yaml` | ClusterIP for XMPP ports |
| `jitsi/service-jvb-http.yaml` | ClusterIP for colibri-ws (port 8080) |
| `jitsi/service-web.yaml` | ClusterIP for web (port 80) |
| `jitsi/service-coturn.yaml` | ClusterIP for TURN (3478, 5349) |
| `jitsi/ingressroute.yaml` | Traefik routes for meet.korczewski.de + /colibri-ws |
| `jitsi/kustomization.yaml` | Kustomize resource list |
| `jitsi/.gitignore` | Ignore secrets.yaml |

### Deploy Script (new)

| File | Responsibility |
|------|---------------|
| `k8s/scripts/deploy/deploy-jitsi.sh` | Apply manifests, delete stale LB service, restart pods, record in tracker |

### Auth Service (modify existing)

| File | Responsibility |
|------|---------------|
| `auth/src/services/TokenService.ts` | Add `generateJitsiToken()` and `generateGuestInvite()` methods |
| `auth/src/routes/jitsi.ts` | NEW: `GET /authorize` + `POST /invite` endpoints |
| `auth/src/server.ts` | Mount `/api/jitsi` router |

---

## Task 1: Kubernetes Base — Namespace, ConfigMaps, Secrets

**Files:**
- Create: `jitsi/namespace.yaml`
- Create: `jitsi/configmap-jitsi.yaml`
- Create: `jitsi/configmap-coturn.yaml`
- Create: `jitsi/configmap-web.yaml`
- Create: `jitsi/.gitignore`

- [ ] **Step 1: Create namespace.yaml**

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: korczewski-jitsi
```

- [ ] **Step 2: Create configmap-jitsi.yaml**

All Jitsi env vars. Carried forward from current ConfigMap plus new JWT auth vars. The `TURN_CREDENTIAL` and XMPP passwords are NOT here — they go in the Secret.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: jitsi-config
  namespace: korczewski-jitsi
data:
  # XMPP domains
  XMPP_DOMAIN: "meet.internal"
  XMPP_AUTH_DOMAIN: "auth.meet.internal"
  XMPP_GUEST_DOMAIN: "guest.meet.internal"
  XMPP_MUC_DOMAIN: "muc.meet.internal"
  XMPP_INTERNAL_MUC_DOMAIN: "internal-muc.meet.internal"
  XMPP_SERVER: "prosody.korczewski-jitsi.svc.cluster.local"
  XMPP_BOSH_URL_BASE: "http://prosody.korczewski-jitsi.svc.cluster.local:5280"
  # Public URL
  PUBLIC_URL: "https://meet.korczewski.de"
  # JWT Authentication
  ENABLE_AUTH: "1"
  AUTH_TYPE: "jwt"
  JWT_APP_ID: "jitsi-meet"
  JWT_ACCEPTED_ISSUERS: "jitsi-meet"
  JWT_ACCEPTED_AUDIENCES: "jitsi-meet"
  JWT_ALLOW_EMPTY: "0"
  ENABLE_GUESTS: "1"
  # TURN
  TURN_ENABLE: "1"
  TURN_HOST: "meet.korczewski.de"
  TURN_PORT: "3478"
  TURNS_HOST: "meet.korczewski.de"
  TURNS_PORT: "5349"
  TURN_TRANSPORT: "tcp"
  TURN_CREDENTIAL_TYPE: "authSecret"
  # JVB
  JVB_AUTH_USER: "jvb"
  JVB_PORT: "10000"
  JVB_ENABLE_APIS: "rest,colibri"
  COLIBRI_REST_ENABLED: "true"
  JVB_TCP_HARVESTER_DISABLED: "true"
  JVB_ADVERTISE_PRIVATE_CANDIDATES: "false"
  JVB_WS_DOMAIN: "meet.korczewski.de"
  JVB_WS_SERVER_ID: "jvb.meet.korczewski.de"
  # Jicofo
  JICOFO_AUTH_USER: "focus"
  # General
  DISABLE_HTTPS: "1"
  ENABLE_LETSENCRYPT: "0"
  TZ: "Europe/Berlin"
  # Token auth config URL (for Jitsi Web to redirect unauthenticated users)
  TOKEN_AUTH_URL: "https://auth.korczewski.de/api/jitsi/authorize?redirect_uri=https://meet.korczewski.de/{room}"
```

- [ ] **Step 3: Create configmap-coturn.yaml**

Template with `__PUBLIC_IP__` placeholder — init container will sed-replace it.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: coturn-config
  namespace: korczewski-jitsi
data:
  turnserver.conf.template: |
    listening-port=3478
    tls-listening-port=5349
    external-ip=__PUBLIC_IP__
    relay-ip=0.0.0.0
    fingerprint
    lt-cred-mech
    use-auth-secret
    static-auth-secret=__TURN_SECRET__
    realm=meet.korczewski.de
    total-quota=100
    bps-capacity=0
    stale-nonce=600
    no-multicast-peers
    no-cli
    log-file=stdout
    verbose
    min-port=49152
    max-port=49401
    cert=/etc/coturn/tls/tls.crt
    pkey=/etc/coturn/tls/tls.key
```

- [ ] **Step 4: Create configmap-web.yaml**

720p video config + JWT auth redirect overrides.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: jitsi-web-config
  namespace: korczewski-jitsi
data:
  custom-config.js: |
    config.resolution = 720;
    config.constraints = {
        video: {
            height: { ideal: 720, max: 720, min: 360 }
        }
    };
    config.maxFullResolutionParticipants = 4;
    config.channelLastN = 4;
    config.startVideoMuted = 0;
    config.disableSimulcast = false;
```

- [ ] **Step 5: Create jitsi/.gitignore**

```
secrets.yaml
```

- [ ] **Step 6: Apply the Secret manually**

The Secret is NOT in git. Create and apply it directly. Current passwords carried forward, plus new JWT_APP_SECRET and TURN_CREDENTIAL moved from ConfigMap:

```bash
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Secret
metadata:
  name: jitsi-secrets
  namespace: korczewski-jitsi
type: Opaque
stringData:
  JICOFO_AUTH_PASSWORD: "J1c0f0P@ss2026!"
  JICOFO_COMPONENT_SECRET: "c0mp0n3ntS3cr3t2026"
  JVB_AUTH_PASSWORD: "JvbP@ss2026!"
  JWT_APP_SECRET: "<GENERATE_NEW_SECRET>"
  TURN_CREDENTIAL: "TurnS3cr3t2026!Korcz"
EOF
```

**Important:** Generate a real `JWT_APP_SECRET` value (e.g. `openssl rand -base64 32`). This same value must be set as `JITSI_JWT_SECRET` in the auth service's `.env`.

- [ ] **Step 7: Commit**

```bash
git add jitsi/namespace.yaml jitsi/configmap-jitsi.yaml jitsi/configmap-coturn.yaml jitsi/configmap-web.yaml jitsi/.gitignore
git commit -m "feat(jitsi): add namespace and configmaps for Jitsi deployment"
```

---

## Task 2: Kubernetes Services & IngressRoute

**Files:**
- Create: `jitsi/service-prosody.yaml`
- Create: `jitsi/service-jvb-http.yaml`
- Create: `jitsi/service-web.yaml`
- Create: `jitsi/service-coturn.yaml`
- Create: `jitsi/ingressroute.yaml`

- [ ] **Step 1: Create service-prosody.yaml**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: prosody
  namespace: korczewski-jitsi
spec:
  selector:
    app: prosody
  ports:
    - name: xmpp-client
      port: 5222
      targetPort: 5222
    - name: xmpp-server
      port: 5269
      targetPort: 5269
    - name: bosh
      port: 5280
      targetPort: 5280
    - name: component
      port: 5347
      targetPort: 5347
```

- [ ] **Step 2: Create service-jvb-http.yaml**

ClusterIP only — no LoadBalancer (JVB uses hostNetwork for UDP). This service exists only for Traefik to route `/colibri-ws` to JVB's HTTP port. Works because hostNetwork pod's endpoint resolves to node IP.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: jvb-http
  namespace: korczewski-jitsi
spec:
  selector:
    app: jvb
  ports:
    - name: http
      port: 8080
      targetPort: 8080
      protocol: TCP
```

- [ ] **Step 3: Create service-web.yaml**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: jitsi-web
  namespace: korczewski-jitsi
spec:
  selector:
    app: jitsi-web
  ports:
    - port: 80
      targetPort: 80
```

- [ ] **Step 4: Create service-coturn.yaml**

```yaml
apiVersion: v1
kind: Service
metadata:
  name: coturn
  namespace: korczewski-jitsi
spec:
  selector:
    app: coturn
  ports:
    - name: turn-udp
      port: 3478
      protocol: UDP
    - name: turn-tcp
      port: 3478
      protocol: TCP
    - name: turns-tcp
      port: 5349
      protocol: TCP
```

- [ ] **Step 5: Create ingressroute.yaml**

Two routes: colibri-ws to JVB, everything else to web. Colibri-ws route must be listed first (more specific match).

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: jitsi-meet
  namespace: korczewski-jitsi
spec:
  entryPoints:
    - websecure
  routes:
    - kind: Rule
      match: Host(`meet.korczewski.de`) && PathPrefix(`/colibri-ws`)
      services:
        - name: jvb-http
          port: 8080
    - kind: Rule
      match: Host(`meet.korczewski.de`)
      middlewares:
        - name: default-chain
          namespace: korczewski-infra
      services:
        - name: jitsi-web
          port: 80
  tls:
    secretName: korczewski-tls
```

- [ ] **Step 6: Commit**

```bash
git add jitsi/service-prosody.yaml jitsi/service-jvb-http.yaml jitsi/service-web.yaml jitsi/service-coturn.yaml jitsi/ingressroute.yaml
git commit -m "feat(jitsi): add services and IngressRoute"
```

---

## Task 3: Deployments — Prosody, Jicofo, Web

These three are straightforward — no init containers needed. All get `nodeSelector: k3s-1`, `imagePullPolicy: Always`, health probes.

**Files:**
- Create: `jitsi/deployment-prosody.yaml`
- Create: `jitsi/deployment-jicofo.yaml`
- Create: `jitsi/deployment-web.yaml`

- [ ] **Step 1: Create deployment-prosody.yaml**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: prosody
  namespace: korczewski-jitsi
  labels:
    app: prosody
spec:
  replicas: 1
  selector:
    matchLabels:
      app: prosody
  template:
    metadata:
      labels:
        app: prosody
    spec:
      nodeSelector:
        kubernetes.io/hostname: k3s-1
      containers:
        - name: prosody
          image: jitsi/prosody:stable-9364
          imagePullPolicy: Always
          envFrom:
            - configMapRef:
                name: jitsi-config
            - secretRef:
                name: jitsi-secrets
          ports:
            - containerPort: 5222
            - containerPort: 5269
            - containerPort: 5280
            - containerPort: 5347
          readinessProbe:
            tcpSocket:
              port: 5222
            initialDelaySeconds: 10
            periodSeconds: 10
          livenessProbe:
            tcpSocket:
              port: 5222
            initialDelaySeconds: 30
            periodSeconds: 30
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
```

- [ ] **Step 2: Create deployment-jicofo.yaml**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jicofo
  namespace: korczewski-jitsi
  labels:
    app: jicofo
spec:
  replicas: 1
  selector:
    matchLabels:
      app: jicofo
  template:
    metadata:
      labels:
        app: jicofo
    spec:
      nodeSelector:
        kubernetes.io/hostname: k3s-1
      containers:
        - name: jicofo
          image: jitsi/jicofo:stable-9364
          imagePullPolicy: Always
          envFrom:
            - configMapRef:
                name: jitsi-config
            - secretRef:
                name: jitsi-secrets
          readinessProbe:
            tcpSocket:
              port: 8888
            initialDelaySeconds: 10
            periodSeconds: 10
          livenessProbe:
            tcpSocket:
              port: 8888
            initialDelaySeconds: 30
            periodSeconds: 30
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
```

- [ ] **Step 3: Create deployment-web.yaml**

Mounts custom-config.js from ConfigMap into `/config/custom-config.js` — the official Jitsi Web image loads this file automatically.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jitsi-web
  namespace: korczewski-jitsi
  labels:
    app: jitsi-web
spec:
  replicas: 1
  selector:
    matchLabels:
      app: jitsi-web
  template:
    metadata:
      labels:
        app: jitsi-web
    spec:
      nodeSelector:
        kubernetes.io/hostname: k3s-1
      containers:
        - name: web
          image: jitsi/web:stable-9364
          imagePullPolicy: Always
          envFrom:
            - configMapRef:
                name: jitsi-config
            - secretRef:
                name: jitsi-secrets
          ports:
            - containerPort: 80
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 15
            periodSeconds: 30
          volumeMounts:
            - name: web-config
              mountPath: /config/custom-config.js
              subPath: custom-config.js
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 250m
              memory: 128Mi
      volumes:
        - name: web-config
          configMap:
            name: jitsi-web-config
```

- [ ] **Step 4: Commit**

```bash
git add jitsi/deployment-prosody.yaml jitsi/deployment-jicofo.yaml jitsi/deployment-web.yaml
git commit -m "feat(jitsi): add Prosody, Jicofo, and Web deployments"
```

---

## Task 4: Deployment — JVB with Init Container

JVB needs an init container to resolve the public IP from DNS. Uses `hostNetwork: true` and `dnsPolicy: ClusterFirstWithHostNet`. Resources bumped to 2 CPU / 768Mi for 4×720p.

**Files:**
- Create: `jitsi/deployment-jvb.yaml`

- [ ] **Step 1: Create deployment-jvb.yaml**

The init container resolves `meet.korczewski.de` and writes the IP to a shared volume. The main container reads it via a command wrapper that exports the env var before exec'ing the entrypoint.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jvb
  namespace: korczewski-jitsi
  labels:
    app: jvb
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: jvb
  template:
    metadata:
      labels:
        app: jvb
    spec:
      nodeSelector:
        kubernetes.io/hostname: k3s-1
      hostNetwork: true
      dnsPolicy: ClusterFirstWithHostNet
      initContainers:
        - name: resolve-public-ip
          image: busybox:1.36
          command:
            - sh
            - -c
            - |
              IP=$(nslookup meet.korczewski.de 1.1.1.1 2>/dev/null | grep -A1 'Name:' | grep 'Address' | awk '{print $2}')
              if [ -z "$IP" ]; then
                echo "ERROR: Could not resolve meet.korczewski.de"
                exit 1
              fi
              echo "$IP" > /shared/public-ip
              echo "Resolved public IP: $IP"
          volumeMounts:
            - name: shared-ip
              mountPath: /shared
      containers:
        - name: jvb
          image: jitsi/jvb:stable-9364
          imagePullPolicy: Always
          command:
            - sh
            - -c
            - |
              export JVB_ADVERTISE_IPS=$(cat /shared/public-ip)
              echo "JVB advertising IP: $JVB_ADVERTISE_IPS"
              exec /init
          envFrom:
            - configMapRef:
                name: jitsi-config
            - secretRef:
                name: jitsi-secrets
          ports:
            - containerPort: 10000
              hostPort: 10000
              protocol: UDP
            - containerPort: 8080
              protocol: TCP
          readinessProbe:
            httpGet:
              path: /about/health
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /about/health
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 30
          volumeMounts:
            - name: shared-ip
              mountPath: /shared
          resources:
            requests:
              cpu: 500m
              memory: 384Mi
            limits:
              cpu: "2"
              memory: 768Mi
      volumes:
        - name: shared-ip
          emptyDir: {}
```

- [ ] **Step 2: Verify the nslookup command works in busybox:1.36**

Run this to test the parsing works:

```bash
docker run --rm busybox:1.36 sh -c "nslookup meet.korczewski.de 1.1.1.1 2>/dev/null | grep -A1 'Name:' | grep 'Address' | awk '{print \$2}'"
```

Expected: prints the current public IP (e.g. `217.195.151.253`). If the output format differs, adjust the awk pattern in the init container.

- [ ] **Step 3: Commit**

```bash
git add jitsi/deployment-jvb.yaml
git commit -m "feat(jitsi): add JVB deployment with dynamic IP init container"
```

---

## Task 5: Deployment — Coturn with Init Container

Coturn needs the same IP resolution, plus it must template `turnserver.conf` by replacing `__PUBLIC_IP__` and `__TURN_SECRET__` placeholders.

**Files:**
- Create: `jitsi/deployment-coturn.yaml`

- [ ] **Step 1: Create deployment-coturn.yaml**

Init container: resolves IP, reads TURN secret from env, seds both into the template, writes final config to writable volume.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: coturn
  namespace: korczewski-jitsi
  labels:
    app: coturn
spec:
  replicas: 1
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: coturn
  template:
    metadata:
      labels:
        app: coturn
    spec:
      nodeSelector:
        kubernetes.io/hostname: k3s-1
      hostNetwork: true
      dnsPolicy: ClusterFirstWithHostNet
      initContainers:
        - name: resolve-and-template
          image: busybox:1.36
          command:
            - sh
            - -c
            - |
              IP=$(nslookup meet.korczewski.de 1.1.1.1 2>/dev/null | grep -A1 'Name:' | grep 'Address' | awk '{print $2}')
              if [ -z "$IP" ]; then
                echo "ERROR: Could not resolve meet.korczewski.de"
                exit 1
              fi
              echo "Resolved public IP: $IP"
              sed "s|__PUBLIC_IP__|$IP|g; s|__TURN_SECRET__|$TURN_CREDENTIAL|g" \
                /template/turnserver.conf.template > /config/turnserver.conf
              echo "Generated turnserver.conf with external-ip=$IP"
          env:
            - name: TURN_CREDENTIAL
              valueFrom:
                secretKeyRef:
                  name: jitsi-secrets
                  key: TURN_CREDENTIAL
          volumeMounts:
            - name: template
              mountPath: /template
            - name: config
              mountPath: /config
      containers:
        - name: coturn
          image: coturn/coturn:latest
          imagePullPolicy: Always
          args:
            - -c
            - /config/turnserver.conf
          ports:
            - containerPort: 3478
              hostPort: 3478
              protocol: UDP
            - containerPort: 3478
              hostPort: 3478
              protocol: TCP
            - containerPort: 5349
              hostPort: 5349
              protocol: TCP
          resources:
            requests:
              cpu: 100m
              memory: 64Mi
            limits:
              cpu: 500m
              memory: 256Mi
          volumeMounts:
            - name: config
              mountPath: /config
            - name: tls
              mountPath: /etc/coturn/tls
      volumes:
        - name: template
          configMap:
            name: coturn-config
        - name: config
          emptyDir: {}
        - name: tls
          secret:
            secretName: korczewski-tls
            items:
              - key: tls.crt
                path: tls.crt
              - key: tls.key
                path: tls.key
```

- [ ] **Step 2: Commit**

```bash
git add jitsi/deployment-coturn.yaml
git commit -m "feat(jitsi): add Coturn deployment with dynamic IP and templated config"
```

---

## Task 6: Kustomization & Deploy Script

**Files:**
- Create: `jitsi/kustomization.yaml`
- Create: `k8s/scripts/deploy/deploy-jitsi.sh`

- [ ] **Step 1: Create kustomization.yaml**

```yaml
apiVersion: kustomize.io/v1beta1
kind: Kustomization
resources:
  - namespace.yaml
  - configmap-jitsi.yaml
  - configmap-coturn.yaml
  - configmap-web.yaml
  - service-prosody.yaml
  - service-jvb-http.yaml
  - service-web.yaml
  - service-coturn.yaml
  - ingressroute.yaml
  - deployment-prosody.yaml
  - deployment-jicofo.yaml
  - deployment-jvb.yaml
  - deployment-web.yaml
  - deployment-coturn.yaml
```

- [ ] **Step 2: Create deploy-jitsi.sh**

Follows the existing deploy script pattern but skips image build (official images). Includes migration cleanup to delete the stale JVB LoadBalancer service.

```bash
#!/bin/bash
# =============================================================================
# Deploy Jitsi Meet Service
# =============================================================================
# Applies manifests and restarts deployments. No image build needed —
# uses official Jitsi Docker images.
#
# Usage: ./deploy-jitsi.sh [--manifests-only] [--no-health-check]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
PROJECT_ROOT="$(dirname "$K8S_DIR")"
TRACKER="$SCRIPT_DIR/../utils/deploy-tracker.sh"

NAMESPACE="korczewski-jitsi"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_step() { echo -e "\n${BLUE}========================================${NC}"; echo -e "${BLUE}$1${NC}"; echo -e "${BLUE}========================================${NC}"; }

MANIFESTS_ONLY=false
HEALTH_CHECK=true

for arg in "$@"; do
    case $arg in
        --manifests-only) MANIFESTS_ONLY=true ;;
        --no-health-check) HEALTH_CHECK=false ;;
    esac
done

log_step "Deploying Jitsi Meet Service"

# Migration cleanup: delete stale JVB LoadBalancer service if it exists
if kubectl get svc jvb -n "$NAMESPACE" --no-headers 2>/dev/null | grep -q LoadBalancer; then
    log_warn "Deleting stale JVB LoadBalancer service (conflicts with Traefik on 10.10.0.40)..."
    kubectl delete svc jvb -n "$NAMESPACE"
fi

# Apply manifests
log_info "Applying Jitsi manifests..."
kubectl apply -k "$PROJECT_ROOT/jitsi/"

# Restart deployments
if [ "$MANIFESTS_ONLY" = false ]; then
    log_info "Restarting Jitsi deployments..."
    kubectl rollout restart deployment/prosody -n "$NAMESPACE"
    kubectl rollout restart deployment/jicofo -n "$NAMESPACE"
    kubectl rollout restart deployment/jvb -n "$NAMESPACE"
    kubectl rollout restart deployment/jitsi-web -n "$NAMESPACE"
    kubectl rollout restart deployment/coturn -n "$NAMESPACE"
fi

# Wait for rollouts
if [ "$MANIFESTS_ONLY" = false ]; then
    log_info "Waiting for Prosody..."
    kubectl rollout status deployment/prosody -n "$NAMESPACE" --timeout=120s

    log_info "Waiting for Jicofo..."
    kubectl rollout status deployment/jicofo -n "$NAMESPACE" --timeout=120s

    log_info "Waiting for JVB..."
    kubectl rollout status deployment/jvb -n "$NAMESPACE" --timeout=120s

    log_info "Waiting for Jitsi Web..."
    kubectl rollout status deployment/jitsi-web -n "$NAMESPACE" --timeout=120s

    log_info "Waiting for Coturn..."
    kubectl rollout status deployment/coturn -n "$NAMESPACE" --timeout=120s
fi

# Health check
if [ "$HEALTH_CHECK" = true ]; then
    # Check JVB health
    JVB_POD=$(kubectl get pods -n "$NAMESPACE" -l app=jvb \
        -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    if [ -n "$JVB_POD" ]; then
        HEALTH=$(kubectl exec "$JVB_POD" -n "$NAMESPACE" -- \
            wget -q -O- http://localhost:8080/about/health 2>/dev/null || echo "")
        if [ -n "$HEALTH" ]; then
            log_info "JVB health: OK"
        else
            log_warn "JVB health endpoint not responding (may still be starting)"
        fi
    fi

    # Verify init container resolved IP
    JVB_IP=$(kubectl exec "$JVB_POD" -n "$NAMESPACE" -- cat /shared/public-ip 2>/dev/null || echo "unknown")
    log_info "JVB advertising public IP: $JVB_IP"
fi

# Record deployment SHA
if [ -x "$TRACKER" ]; then
    "$TRACKER" set jitsi
fi

log_info "Jitsi Meet deployed successfully!"
kubectl get pods -n "$NAMESPACE"
```

- [ ] **Step 3: Make deploy script executable**

```bash
chmod +x k8s/scripts/deploy/deploy-jitsi.sh
```

- [ ] **Step 4: Commit**

```bash
git add jitsi/kustomization.yaml k8s/scripts/deploy/deploy-jitsi.sh
git commit -m "feat(jitsi): add kustomization and deploy script"
```

---

## Task 7: Auth Service — Jitsi JWT Token Generation

Add `generateJitsiToken()` and `generateGuestInvite()` to TokenService.

**Files:**
- Modify: `auth/src/services/TokenService.ts`

- [ ] **Step 1: Add JITSI_JWT_SECRET to constructor**

In `auth/src/services/TokenService.ts`, add a new private field and read from env:

```typescript
// Add after line 4 (imports):
// (no new imports needed — jwt is already imported)

// Add new field after line 12 (REFRESH_TOKEN_EXPIRY):
private readonly JITSI_JWT_SECRET: string;

// Add to constructor after line 19 (REFRESH_TOKEN_EXPIRY assignment):
this.JITSI_JWT_SECRET = process.env.JITSI_JWT_SECRET || (isTest ? 'test-jitsi-secret' : '');
```

Note: Do NOT add this to the required-secret validation at lines 21-28 — Jitsi JWT is optional (auth service works without Jitsi).

- [ ] **Step 2: Add generateJitsiToken method**

Add after the `decodeToken` method (after line 155):

```typescript
/**
 * Generate a Jitsi Meet JWT for an authenticated user.
 * Format matches Prosody's token_verification module expectations.
 */
generateJitsiToken(user: User, room: string = '*'): string {
  if (!this.JITSI_JWT_SECRET) {
    throw new Error('JITSI_JWT_SECRET not configured');
  }

  return jwt.sign(
    {
      room,
      sub: 'meet.korczewski.de',
      context: {
        user: {
          name: user.name || user.username,
          email: user.email,
          avatar: user.avatar_url || '',
          id: String(user.id),
        },
        features: {
          recording: false,
          livestreaming: false,
        },
      },
    },
    this.JITSI_JWT_SECRET,
    {
      issuer: 'jitsi-meet',
      audience: 'jitsi-meet',
      expiresIn: '24h',
    } as jwt.SignOptions
  );
}

/**
 * Generate a guest invite JWT for a specific Jitsi room.
 * Room-locked, short-lived, no moderator privileges.
 */
generateGuestInvite(room: string, expiresIn: string = '2h'): string {
  if (!this.JITSI_JWT_SECRET) {
    throw new Error('JITSI_JWT_SECRET not configured');
  }

  return jwt.sign(
    {
      room,
      sub: 'meet.korczewski.de',
      context: {
        user: {
          name: 'Guest',
          guest: true,
        },
        features: {
          recording: false,
          livestreaming: false,
        },
      },
    },
    this.JITSI_JWT_SECRET,
    {
      issuer: 'jitsi-meet',
      audience: 'jitsi-meet',
      expiresIn,
    } as jwt.SignOptions
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add auth/src/services/TokenService.ts
git commit -m "feat(auth): add Jitsi JWT token generation methods"
```

---

## Task 8: Auth Service — Jitsi Routes

New route file for `/api/jitsi/authorize` (GET) and `/api/jitsi/invite` (POST).

**Files:**
- Create: `auth/src/routes/jitsi.ts`
- Modify: `auth/src/server.ts`

- [ ] **Step 1: Create auth/src/routes/jitsi.ts**

```typescript
import express, { type Request, type Response } from 'express';
import { TokenService } from '../services/TokenService.js';
import { authenticate } from '../middleware/authenticate.js';
import { csrfProtection } from '../middleware/csrf.js';  // same pattern as other routes
import { db } from '../config/database.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const router = express.Router();
const tokenService = new TokenService();

/**
 * GET /api/jitsi/authorize
 *
 * Validates user session, mints a Jitsi JWT, and redirects back to Jitsi
 * with the token in the URL. If not authenticated, redirects to login page
 * with a return URL pointing back here.
 */
router.get('/authorize', authenticate, async (req: Request, res: Response) => {
  try {
    const redirectUri = req.query.redirect_uri as string;
    if (!redirectUri) {
      res.status(400).json({ error: 'redirect_uri is required' });
      return;
    }

    // Validate redirect_uri points to our Jitsi instance
    if (!redirectUri.startsWith('https://meet.korczewski.de')) {
      res.status(400).json({ error: 'Invalid redirect_uri' });
      return;
    }

    // Fetch full user from DB (req.user from JWT only has subset of fields)
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Extract room name from redirect URI
    const url = new URL(redirectUri);
    const room = url.pathname.replace(/^\//, '') || '*';

    const jitsiToken = tokenService.generateJitsiToken(user, room);

    // Redirect back to Jitsi with JWT
    const separator = redirectUri.includes('?') ? '&' : '?';
    res.redirect(`${redirectUri}${separator}jwt=${jitsiToken}`);
  } catch (error) {
    console.error('Jitsi authorize error:', error);
    res.status(500).json({ error: 'Failed to generate Jitsi token' });
  }
});

/**
 * POST /api/jitsi/invite
 *
 * Creates a guest invite link for a specific Jitsi room.
 * Requires authentication — only logged-in users can create invites.
 */
router.post('/invite', csrfProtection, authenticate, async (req: Request, res: Response) => {
  try {
    const { room, expires_in } = req.body;

    if (!room || typeof room !== 'string') {
      res.status(400).json({ error: 'room is required' });
      return;
    }

    // Sanitize room name (Jitsi room names are lowercase alphanumeric)
    const sanitizedRoom = room.toLowerCase().replace(/[^a-z0-9\-_]/g, '');
    if (!sanitizedRoom) {
      res.status(400).json({ error: 'Invalid room name' });
      return;
    }

    const expiresIn = expires_in || '2h';

    // Validate expires_in format (e.g., "1h", "2h", "30m")
    if (!/^\d+[hm]$/.test(expiresIn)) {
      res.status(400).json({ error: 'expires_in must be like "2h" or "30m"' });
      return;
    }

    const guestToken = tokenService.generateGuestInvite(sanitizedRoom, expiresIn);

    res.json({
      url: `https://meet.korczewski.de/${sanitizedRoom}?jwt=${guestToken}`,
      room: sanitizedRoom,
      expires_in: expiresIn,
    });
  } catch (error) {
    console.error('Jitsi invite error:', error);
    res.status(500).json({ error: 'Failed to generate invite' });
  }
});

export default router;
```

- [ ] **Step 2: Mount the router in server.ts**

In `auth/src/server.ts`, add the import and mount. Find the routes section (around line 160) and add:

```typescript
// Add import at top of file (with other route imports):
import jitsiRoutes from './routes/jitsi.js';

// Add mount after line 230 (after the oauth routes mount):
// Jitsi JWT auth (GET /authorize is redirect-based so no CSRF; POST /invite has CSRF via route-level middleware)
app.use('/api/jitsi', authLimiter, jitsiRoutes);
```

- [ ] **Step 3: Add Jitsi endpoints to the API info response**

In `auth/src/server.ts`, find the `app.get('/api', ...)` handler (around line 167) and add to the `endpoints` object:

```typescript
jitsi: {
  authorize: 'GET /api/jitsi/authorize?redirect_uri={url}',
  invite: 'POST /api/jitsi/invite',
},
```

- [ ] **Step 4: Commit**

```bash
git add auth/src/routes/jitsi.ts auth/src/server.ts
git commit -m "feat(auth): add Jitsi authorize and guest invite endpoints"
```

---

## Task 9: Deploy & Verify Jitsi Infrastructure

Apply the k8s manifests and verify all pods come up healthy.

- [ ] **Step 1: Generate and apply the Secret**

```bash
JITSI_JWT_SECRET=$(openssl rand -base64 32)
echo "Generated JITSI_JWT_SECRET: $JITSI_JWT_SECRET"
echo "Save this value — it must also go into auth service .env"

kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: jitsi-secrets
  namespace: korczewski-jitsi
type: Opaque
stringData:
  JICOFO_AUTH_PASSWORD: "J1c0f0P@ss2026!"
  JICOFO_COMPONENT_SECRET: "c0mp0n3ntS3cr3t2026"
  JVB_AUTH_PASSWORD: "JvbP@ss2026!"
  JWT_APP_SECRET: "$JITSI_JWT_SECRET"
  TURN_CREDENTIAL: "TurnS3cr3t2026!Korcz"
EOF
```

- [ ] **Step 2: Run the deploy script**

```bash
./k8s/scripts/deploy/deploy-jitsi.sh
```

Expected: All 5 deployments roll out successfully. Stale JVB LoadBalancer service is deleted. Deploy tracker records the SHA.

- [ ] **Step 3: Verify init container IP resolution**

```bash
kubectl logs -n korczewski-jitsi deployment/jvb -c resolve-public-ip
kubectl logs -n korczewski-jitsi deployment/coturn -c resolve-and-template
```

Expected: Both log "Resolved public IP: 217.195.151.253" (or current public IP).

- [ ] **Step 4: Verify all pods are Running with health checks passing**

```bash
kubectl get pods -n korczewski-jitsi
kubectl describe pod -n korczewski-jitsi -l app=jvb | grep -A5 "Readiness\|Liveness"
```

Expected: All 5 pods Running, readiness probes passing.

- [ ] **Step 5: Verify the stale JVB LoadBalancer is gone**

```bash
kubectl get svc -n korczewski-jitsi
```

Expected: Only `prosody`, `jitsi-web`, `jvb-http`, `coturn` services (all ClusterIP). No `jvb` LoadBalancer.

---

## Task 10: Deploy Auth Service with Jitsi JWT

- [ ] **Step 1: Add JITSI_JWT_SECRET to auth service environment**

Add to auth service's k8s Secret or ConfigMap (wherever `JWT_SECRET` is configured):

```bash
# The value must match what was generated in Task 9 Step 1
kubectl get secret auth-secrets -n korczewski-services -o yaml  # check current structure
# Then patch or recreate with JITSI_JWT_SECRET added
```

Also add to auth service `.env` for local dev:
```
JITSI_JWT_SECRET=<same value from Task 9>
```

- [ ] **Step 2: Deploy auth service**

```bash
./k8s/scripts/deploy/deploy-auth.sh
```

- [ ] **Step 3: Verify Jitsi endpoints are available**

```bash
curl -s https://auth.korczewski.de/api | jq '.endpoints.jitsi'
```

Expected:
```json
{
  "authorize": "GET /api/jitsi/authorize?redirect_uri={url}",
  "invite": "POST /api/jitsi/invite"
}
```

---

## Task 11: End-to-End Verification

- [ ] **Step 1: Test unauthenticated access**

Open `https://meet.korczewski.de/testroom` in browser. Should redirect to auth service login (or show Jitsi's "authentication required" screen with link to `TOKEN_AUTH_URL`).

- [ ] **Step 2: Test authenticated access**

After logging in via auth service, should redirect back to `meet.korczewski.de/testroom?jwt=<token>` and enter the room with your display name and avatar shown.

- [ ] **Step 3: Test guest invite**

```bash
# Get a valid access token first (login via auth service)
TOKEN="<your-access-token>"
curl -X POST https://auth.korczewski.de/api/jitsi/invite \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"room": "testroom", "expires_in": "2h"}'
```

Expected: Returns `{ url: "https://meet.korczewski.de/testroom?jwt=..." }`. Opening that URL should enter the room as "Guest".

- [ ] **Step 4: Test 2-person P2P call**

Join from two different devices/browsers. Verify video connects at 720p (check Jitsi stats via `cmd+i` or the "Connection" indicator).

- [ ] **Step 5: Test 4-person SFU call**

Join from 4 devices. With 3+ participants, Jitsi switches to SFU mode through JVB. Verify all participants have video, check JVB resource usage:

```bash
kubectl top pod -n korczewski-jitsi -l app=jvb
```

Expected: CPU usage rises but stays under 2000m limit. Memory under 768Mi.

- [ ] **Step 6: Verify TURN/Coturn works**

Check coturn logs during a call:

```bash
kubectl logs -n korczewski-jitsi deployment/coturn --tail=20
```

If a participant is behind strict NAT, should see TURN allocations in the logs.

---

## Task 12: Router Port Forwarding Verification

This is a manual step — verify on the router's admin interface.

- [ ] **Step 1: Confirm port forwards to 10.0.3.1 (k3s-1)**

| Port | Protocol | Target |
|------|----------|--------|
| 10000 | UDP | 10.0.3.1 |
| 3478 | UDP + TCP | 10.0.3.1 |
| 5349 | TCP | 10.0.3.1 |
| 49152-49401 | UDP | 10.0.3.1 |

- [ ] **Step 2: Test UDP 10000 reachability from outside**

From a phone on mobile data (not on local WiFi):

```bash
# On k3s-1, listen:
nc -u -l 10000

# From external device:
echo "test" | nc -u meet.korczewski.de 10000
```

Or simply verify via a Jitsi call from a mobile device on cellular data.

---

## Task 13: Final Commit & Cleanup

- [ ] **Step 1: Verify all files are committed**

```bash
git status
```

All `jitsi/` files and auth service changes should be committed.

- [ ] **Step 2: Verify deploy tracker**

```bash
./k8s/scripts/utils/deploy-tracker.sh status
```

Expected: `jitsi` service shows current commit SHA.

- [ ] **Step 3: Push**

```bash
git push
```
