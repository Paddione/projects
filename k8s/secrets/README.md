# Kubernetes Secrets

This directory contains generated Kubernetes Secret manifests.

**IMPORTANT**: These files contain sensitive credentials and should NEVER be committed to version control.

## Generating Secrets

Run the secret generation script:

```bash
../scripts/utils/generate-secrets.sh
```

This reads from the root `.env` file and creates:
- `postgres-secret.yaml` - PostgreSQL credentials
- `auth-secret.yaml` - Auth service secrets (JWT, OAuth, SMTP)
- `l2p-backend-secret.yaml` - L2P backend secrets
- `payment-secret.yaml` - Payment service secrets (Stripe, NextAuth)
- `videovault-secret.yaml` - VideoVault secrets
- `traefik-secret.yaml` - Traefik dashboard auth
- `tls-secret.yaml` - TLS certificates (if available)

## Applying Secrets

```bash
kubectl apply -f .
```

## Creating TLS Secret Manually

If TLS certificates aren't auto-generated:

```bash
kubectl create secret tls korczewski-tls \
  --cert=/path/to/fullchain.pem \
  --key=/path/to/privkey.pem \
  -n korczewski-infra
```

## Security Notes

1. All secret files are gitignored
2. Never commit `.env` files or secret YAMLs
3. Use strong, unique passwords (generate with `openssl rand -hex 32`)
4. Rotate secrets periodically
5. Consider using external secret managers (Vault, AWS Secrets Manager) for production
