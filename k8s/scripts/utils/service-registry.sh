#!/bin/bash
# =============================================================================
# Service Registry — Single source of truth for all deployed services
# =============================================================================
# Source this file in any script that needs the canonical service list.
#
# Usage:
#   source "$(dirname "$0")/utils/service-registry.sh"    # from k8s/scripts/
#   source "$(dirname "$0")/../k8s/scripts/utils/service-registry.sh"  # from scripts/
#
# Provides:
#   SERVICES[@]              — canonical service name list
#   SERVICE_DIR[name]        — project directory relative to repo root
#   SERVICE_URL[name]        — production URL (https://<name>.korczewski.de)
#   SERVICE_HEALTH[name]     — health check path
#   SERVICE_PORT[name]       — container port for health checks
#   SERVICE_K8S_LABEL[name]  — Kubernetes app label
#   SERVICE_NAMESPACE[name]  — Kubernetes namespace
#   SERVICE_DB[name]         — database name (empty if none)
#   SERVICE_DB_VAR[name]     — env var for DB password (empty if none)
# =============================================================================

# Ordered list of all services
SERVICES=(auth l2p shop videovault sos arena)

# Associative arrays
declare -A SERVICE_DIR=(
  [auth]="auth"
  [l2p]="l2p"
  [shop]="shop"
  [videovault]="VideoVault"
  [sos]="SOS"
  [arena]="arena"
)

declare -A SERVICE_URL=(
  [auth]="https://auth.korczewski.de"
  [l2p]="https://l2p.korczewski.de"
  [shop]="https://shop.korczewski.de"
  [videovault]="https://videovault.korczewski.de"
  [sos]="https://sos.korczewski.de"
  [arena]="https://arena.korczewski.de"
)

declare -A SERVICE_HEALTH=(
  [auth]="/health"
  [l2p]="/api/health"
  [shop]="/"
  [videovault]="/api/health"
  [sos]="/health"
  [arena]="/api/health"
)

declare -A SERVICE_PORT=(
  [auth]="5500"
  [l2p]="3001"
  [shop]="3000"
  [videovault]="5000"
  [sos]="3005"
  [arena]="3003"
)

declare -A SERVICE_K8S_LABEL=(
  [auth]="app=auth"
  [l2p]="app=l2p-backend"
  [shop]="app=shop"
  [videovault]="app=videovault"
  [sos]="app=sos"
  [arena]="app=arena-backend"
)

declare -A SERVICE_NAMESPACE=(
  [auth]="korczewski-services"
  [l2p]="korczewski-services"
  [shop]="korczewski-services"
  [videovault]="korczewski-services"
  [sos]="korczewski-services"
  [arena]="korczewski-services"
)

declare -A SERVICE_DB=(
  [auth]="auth_db"
  [l2p]="l2p_db"
  [shop]="shop_db"
  [videovault]="videovault_db"
  [sos]=""
  [arena]=""
)

declare -A SERVICE_DB_VAR=(
  [auth]="AUTH_DB_PASSWORD"
  [l2p]="L2P_DB_PASSWORD"
  [shop]="SHOP_DB_PASSWORD"
  [videovault]="VIDEOVAULT_DB_PASSWORD"
  [sos]=""
  [arena]=""
)
