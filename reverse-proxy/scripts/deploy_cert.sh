#!/bin/bash
set -e
# Copy new certificates to the directory mounted by Traefik
cp /etc/letsencrypt/live/korczewski.de/fullchain.pem /etc/ssl/korczewski.de/fullchain.pem
cp /etc/letsencrypt/live/korczewski.de/privkey.pem /etc/ssl/korczewski.de/privkey.pem
chmod 644 /etc/ssl/korczewski.de/fullchain.pem
chmod 600 /etc/ssl/korczewski.de/privkey.pem

# Touch the TLS configuration file to trigger Traefik reload of certificates
touch /home/patrick/projects/reverse-proxy/config/dynamic/tls.yml
