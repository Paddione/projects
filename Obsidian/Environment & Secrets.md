# Environment & Secrets

Short, safe rules for working with env files.

## Standard layout
- `.env.example` is the template.
- `.env-dev` and `.env-prod` are local-only (gitignored).
- Some services also use `.env.test` for automated testing.

## Setup checklist
1. Copy `.env.example` to `.env-dev` in each service you run.
2. Keep values consistent with `shared-infrastructure/.env-dev`.
3. Use `localhost` in local-only setups and `shared-postgres` in Docker.

## Rules to follow
1. Never commit `.env-dev` or `.env-prod`.
2. Use alphanumeric-only DB passwords.
3. Keep secrets unique per environment.

## Secret generation
```bash
# JWT/session secrets
openssl rand -hex 32

# Alphanumeric DB passwords
openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32 && echo
```

## Validation
```bash
npm run validate:env
npm run validate:env:dev
npm run validate:env:prod
```
