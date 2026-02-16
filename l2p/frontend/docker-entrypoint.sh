#!/bin/sh
cat > /usr/share/nginx/html/env-config.js <<EOF
window.__IMPORT_META_ENV__ = {
  VITE_API_URL: "${VITE_API_URL:-}",
  VITE_SOCKET_URL: "${VITE_SOCKET_URL:-}",
  VITE_AUTH_SERVICE_URL: "${VITE_AUTH_SERVICE_URL:-}",
  VITE_NODE_ENV: "${VITE_NODE_ENV:-production}",
  VITE_APP_ENVIRONMENT: "${VITE_APP_ENVIRONMENT:-production}"
};
EOF
exec dumb-init nginx -g "daemon off;"
