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
- `ipv64-secret.yaml` - IPv64 DNS credentials (ACME DNS-01)
- `smb-secret.yaml` - SMB credentials (infra + services namespaces)
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

## External Secret Manager: HashiCorp Vault

For production-grade secret management, we use **HashiCorp Vault**.

### Saving Secrets to Vault

1. **Deploy Vault**:
   ```bash
   kubectl apply -k ../infrastructure/vault
   ```

2. **Sync .env to Vault**:
   If you have the `vault` CLI installed, use the sync script:
   ```bash
   ../scripts/utils/vault-sync.sh
   ```

3. **Manual Entry**:
   ```bash
   vault kv put secret/auth JWT_SECRET=... GOOGLE_CLIENT_ID=...
   ```

### Integrating with Kubernetes

We recommend the **External Secrets Operator (ESO)** to automatically sync Vault secrets into native Kubernetes Secret objects. This allows the services to remain infrastructure-agnostic.

1. Deploy ESO: `kubectl apply -k ../infrastructure/external-secrets`
2. Create a `SecretStore` to connect ESO to Vault.
3. Create `ExternalSecret` objects for each service.

## Security Notes

1. All local secret files (`*.yaml`) are gitignored.
2. Never commit `.env` files or secret YAMLs.
3. Use strong, unique passwords.
4. Vault secrets should be unsealed manually after a cluster restart.
