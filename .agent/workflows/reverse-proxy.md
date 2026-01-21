---
description: Manage Traefik Ingress Controller (Kubernetes)
---

This workflow explains how to manage Traefik as the Kubernetes ingress controller.

## Overview

Traefik runs as a Kubernetes deployment in the `korczewski-infra` namespace, handling TLS termination and routing via IngressRoute CRDs.

### Architecture
- **Namespace**: `korczewski-infra`
- **Ports**: 80 (HTTP), 443 (HTTPS), 8080 (dashboard)
- **Manifests**: `k8s/infrastructure/traefik/`
- **Dashboard**: https://traefik.korczewski.de

## Configuration Files

| File | Purpose |
|------|---------|
| `deployment.yaml` | Traefik deployment and args |
| `service.yaml` | LoadBalancer service |
| `middlewares.yaml` | Security headers, rate limiting |
| `ingressroute-dashboard.yaml` | Dashboard routing |
| `tlsstore.yaml` | Default TLS certificate |

## Managing Traefik

### View Logs
```bash
kubectl logs -n korczewski-infra -l app=traefik --tail=50
```

### Restart Traefik
```bash
kubectl rollout restart deployment/traefik -n korczewski-infra
```

### Deploy/Update
```bash
./k8s/scripts/deploy/deploy-traefik.sh
```

### Check Status
```bash
kubectl get pods -n korczewski-infra -l app=traefik
kubectl get svc -n korczewski-infra traefik
```

## Adding New Services

Add an IngressRoute in the service's k8s directory:

```yaml
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: myservice
  namespace: korczewski-services
spec:
  entryPoints:
    - websecure
  routes:
    - match: Host(`myservice.korczewski.de`)
      kind: Rule
      services:
        - name: myservice
          port: 8080
  tls:
    secretName: korczewski-tls
```

## Secrets

From `k8s/secrets/`:
- `korczewski-tls` - TLS certificate
- `traefik-dashboard-auth` - Dashboard credentials

Generated from root `.env`:
- `TRAEFIK_DASHBOARD_USER`
- `TRAEFIK_DASHBOARD_PASSWORD_HASH`

## Troubleshooting

### Check IngressRoutes
```bash
kubectl get ingressroutes -A
```

### View routing configuration
```bash
kubectl port-forward -n korczewski-infra svc/traefik 8080:8080
curl http://localhost:8080/api/http/routers | jq
```

### Test service locally
```bash
curl -k -H "Host: myservice.korczewski.de" https://localhost/
```
