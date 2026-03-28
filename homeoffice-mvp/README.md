# Homeoffice MVP — Deployment Guide

> **Zwei Varianten:** Docker Compose (einfacher Einstieg) oder k3s (Kubernetes, Produktion)

---

## 🐳 Docker Compose Deployment (Empfohlen für den Einstieg)

### Voraussetzungen
- Docker + Docker Compose v2
- Port 80, 443, 10000/UDP in der Firewall offen
- Account bei [duckdns.org](https://www.duckdns.org/) (kostenlos)

### Schnellstart

```bash
# 1. Konfiguration anlegen
cp .env.example .env
nano .env   # Alle CHANGE_ME_* und Domain-Werte ausfüllen

# 2. Verzeichnisse und acme.json anlegen
#    (acme.json muss chmod 600 haben, sonst verweigert Traefik den Start)
STORAGE=${STORAGE_PATH:-./data}
mkdir -p ${STORAGE}/mattermost ${STORAGE}/nextcloud ${STORAGE}/traefik/letsencrypt
touch ${STORAGE}/traefik/letsencrypt/acme.json
chmod 600 ${STORAGE}/traefik/letsencrypt/acme.json

# 3. Starten
docker compose up -d

# 4. Status prüfen
docker compose ps
docker compose logs -f duckdns   # DuckDNS-Updates beobachten
```

### DuckDNS einrichten
1. Account auf https://www.duckdns.org/ anlegen
2. Subdomain wählen (z.B. `myhome` → `myhome.duckdns.org`)
3. Token von der Startseite kopieren
4. In `.env` eintragen:
   ```
   DOMAIN=myhome.duckdns.org
   DUCKDNS_TOKEN=dein-token
   DUCKDNS_SUBDOMAINS=myhome
   JVB_ADVERTISE_IPS=myhome.duckdns.org
   ```

Der DuckDNS-Container aktualisiert automatisch alle 5 Minuten die IP — auch der Jitsi JVB (Videobridge) bleibt so immer erreichbar.

### Externen Speicher einbinden (Optional)

Trage in `.env` den Pfad zu deinem Speichermedium ein:
```
STORAGE_PATH=/mnt/nas/homeoffice
# oder
STORAGE_PATH=/mnt/usb/homeoffice
```

Folgende Dienste legen ihre Daten dort ab:
- `Mattermost` → `$STORAGE_PATH/mattermost/` (Uploads, Plugins)
- `Nextcloud` → `$STORAGE_PATH/nextcloud/` (alle Dateien)
- `Traefik` → `$STORAGE_PATH/traefik/letsencrypt/` (SSL-Zertifikate)

Ohne `STORAGE_PATH` wird `./data/` neben der `docker-compose.yml` verwendet.

### Nach dem Start: LLDAP einrichten

1. `https://ldap.${DOMAIN}` aufrufen
2. Login: `admin` / Wert aus `LLDAP_LDAP_USER_PASS`
3. Gruppe anlegen: `homeoffice_users`
4. Demo-User anlegen und der Gruppe zuweisen

### Keycloak → LLDAP User Federation einrichten

1. Keycloak Admin öffnen → Realm `homeoffice` → **User Federation → Add provider → LDAP**
2. Konfiguration:

| Feld | Wert |
|---|---|
| Connection URL | `ldap://lldap:3890` |
| Bind DN | `uid=admin,ou=people,dc=…` (deine Base DN) |
| Bind Credential | `LLDAP_LDAP_USER_PASS` |
| Users DN | `ou=people,dc=…` |
| Username LDAP attribute | `uid` |
| RDN LDAP attribute | `uid` |
| UUID LDAP attribute | `entryUUID` |
| User Object Classes | `inetOrgPerson` |

3. **Test connection → Test authentication → Save**
4. **Sync all users** — alle LLDAP-User erscheinen jetzt in Keycloak
5. Mattermost + Nextcloud erben die User automatisch über OIDC (kein weiterer Schritt)

---

# Homeoffice MVP — k3s Deployment

## Stack

| Dienst       | URL                        | Zweck                        |
|--------------|----------------------------|------------------------------|
| Keycloak     | auth.YOURDOMAIN.de         | SSO / OAuth2 / OIDC          |
| Mattermost   | chat.YOURDOMAIN.de         | Chat, Notifications, Plugins |
| Jitsi Meet   | meet.YOURDOMAIN.de         | Video-Konferenzen            |
| Nextcloud    | files.YOURDOMAIN.de        | Dateien, WebDAV              |
| LLDAP        | ldap.YOURDOMAIN.de         | Benutzerverwaltung (LDAP)    |

## Voraussetzungen

- k3s-Cluster mit `nginx`-Ingress-Controller
- `cert-manager` mit `letsencrypt-prod` ClusterIssuer
- DNS-Einträge für alle 4 Subdomains → Cluster-IP

## Deployment

```bash
# 1. Namespace
kubectl apply -f base/namespace.yaml

# 2. Alle Komponenten deployen (LLDAP zuerst — Keycloak braucht es)
kubectl apply -f deploy/04-lldap.yaml
kubectl apply -f keycloak/
kubectl apply -f nextcloud/
kubectl apply -f mattermost/
kubectl apply -f jitsi/
```

## Konfiguration vor dem Deploy

Ersetze in allen YAML-Dateien:
- `YOURDOMAIN.de` → deine echte Domain
- Alle `CHANGE_ME_*` Werte → sichere Passwörter (z.B. `openssl rand -base64 32`)

## Nach dem Deploy: Keycloak Realm einrichten

1. Login: https://auth.YOURDOMAIN.de → Admin Console
2. Realm erstellen: `homeoffice`
3. Client für Mattermost erstellen:
   - Client ID: `mattermost`
   - Client Protocol: `openid-connect`
   - Access Type: `confidential`
   - Valid Redirect URIs: `https://chat.YOURDOMAIN.de/*`
   - Kopiere den Secret → in `mattermost.yaml` als `CHANGE_ME_OIDC_SECRET`
4. Client für Nextcloud erstellen (analog, mit Social Login App)

## Mattermost Plugins aktivieren

Nach dem ersten Start im Admin Panel:
- **Jitsi Plugin**: Marketplace → Jitsi → Konfigurieren → Server URL: `https://meet.YOURDOMAIN.de`
- **Nextcloud Plugin**: Marketplace → Nextcloud Files → Server URL: `https://files.YOURDOMAIN.de`

## Jitsi Hinweis

JVB benötigt `hostNetwork: true` für UDP-Mediendaten (Port 10000).
`JVB_ADVERTISE_IPS` muss auf die öffentliche IP des Nodes gesetzt werden.

## Architektur

```
Browser
  │
  ├─ chat.YOURDOMAIN.de  → Mattermost (Chat + Jitsi-Button + Nextcloud-Links)
  ├─ meet.YOURDOMAIN.de  → Jitsi Meet (Video, eingebettet in Mattermost)
  ├─ files.YOURDOMAIN.de → Nextcloud (Dateien, via Mattermost-Plugin)
  ├─ auth.YOURDOMAIN.de  → Keycloak (SSO für alle drei)
  └─ ldap.YOURDOMAIN.de  → LLDAP Web UI (Benutzerverwaltung)

Datenfluss User Federation:
  LLDAP (user store) ──LDAP──▶ Keycloak (sync) ──OIDC──▶ Mattermost / Nextcloud
```
