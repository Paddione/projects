# Homeoffice MVP — Deployment Guide

> **Zwei Varianten:** Docker Compose (einfacher Einstieg) oder k3s (Kubernetes, Produktion)

---

## 🚚 Migration von bestehenden Systemen

Bevor oder nach dem Deployment können vorhandene Daten aus Slack, Teams und anderen Systemen importiert werden.

### Migration Assistant (interaktives Menü)

```bash
# Voraussetzungen (einmalig)
sudo apt install curl jq python3 unzip   # Linux / WSL
brew install curl jq python3 unzip       # macOS

# Starten
chmod +x scripts/migrate.sh
./scripts/migrate.sh

# Nur Vorschau — keine Änderungen
./scripts/migrate.sh --dry-run
```

Beim ersten Start:
1. **Server-URLs + Zugangsdaten eingeben** (Mattermost, Nextcloud, LLDAP)
2. **Automatischer Scan** — sucht auf dem lokalen Rechner nach:
   - Slack-Export-ZIPs und lokalem Slack-Cache
   - Teams GDPR-Export und lokalem Teams-Cache
   - Bestehenden Mattermost/Nextcloud-Clients
3. **Quelle auswählen oder Pfad manuell eingeben**
4. **Import starten**

Läuft auf: Linux, macOS, Windows (WSL)

---

### Slack → Mattermost

**Schritt 1: Export erstellen** (braucht Workspace Admin-Rechte)
> Slack → Settings & Permissions → Import/Export Data → Export → All Messages

**Schritt 2: Importieren**
```bash
./scripts/migrate.sh
# → [1] Slack importieren → ZIP-Datei auswählen
```

Was wird importiert:
- ✅ Alle öffentlichen und privaten Kanäle
- ✅ Kanal-Nachrichten mit Zeitstempeln
- ✅ User-Konten (werden in Mattermost angelegt)
- ✅ @mentions und ~channel-Links umgewandelt
- ⚠️ Dateien/Anhänge: nur als Referenz, kein Binary-Upload

---

### Microsoft Teams → Mattermost + Nextcloud

**Schritt 1: GDPR-Export anfordern** (kein Admin nötig)
> myaccount.microsoft.com → Datenschutz → Daten herunterladen
> Auswählen: Teams Chat, Dateien, Kalender, Kontakte → ZIP herunterladen

**Schritt 2: Importieren**
```bash
./scripts/migrate.sh
# → [2] Teams importieren → ZIP-Datei auswählen
```

Was wird importiert:

| Quelle | Ziel | Format |
|---|---|---|
| Teams Chats / Kanäle | Mattermost | Nachrichten mit Zeitstempeln |
| Dateien & Anhänge | Nextcloud `/Teams-Import/` | WebDAV Upload |
| Kalender | Nextcloud Calendar | iCal `.ics` |
| Kontakte | Nextcloud Contacts | vCard `.vcf` |

---

### Benutzer → LLDAP

```bash
# CSV-Import
./scripts/migrate.sh → [3] Benutzer importieren

# Oder direkt:
./scripts/import-users.sh --csv meine-user.csv --url http://localhost:17170

# Aus bestehendem LDAP exportieren und importieren:
ldapsearch -x -H ldap://alter-server -b "dc=firma,dc=de" > export.ldif
./scripts/import-users.sh --ldif export.ldif
```

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

### Nach dem Start: User-Import & LDAP einrichten

#### Option A — User aus CSV / LDIF importieren (Bulk-Import)

```bash
# Voraussetzungen
apt install curl jq

# Beispiel-CSV ansehen
cat scripts/users-example.csv

# CSV importieren (LLDAP läuft lokal auf Port 17170)
chmod +x scripts/import-users.sh
./scripts/import-users.sh --csv meine-user.csv \
  --url http://localhost:17170 \
  --pass <LLDAP_LDAP_USER_PASS>

# LDIF importieren (z.B. Export aus bestehendem LDAP/AD)
./scripts/import-users.sh --ldif export.ldif \
  --url http://localhost:17170 \
  --pass <LLDAP_LDAP_USER_PASS>

# Vorschau ohne Änderungen
./scripts/import-users.sh --csv meine-user.csv --dry-run
```

**CSV-Format:**
```
username,email,display_name,groups,first_name,last_name
anna.schmidt,anna@example.com,Anna Schmidt,"homeoffice_users;admins",Anna,Schmidt
```

- `groups`: semikolon-getrennt, werden automatisch angelegt
- Alle User bekommen ein Einmal-Passwort (`ChangeMe123!`) und müssen es beim ersten Login ändern

#### Option B — Bestehendes LDAP / Active Directory anbinden

Falls schon ein LDAP-Server (z.B. AD, OpenLDAP, 389ds) vorhanden ist, kann Keycloak direkt dort federieren — LLDAP wird dann als Zwischenschicht übersprungen:

1. Keycloak Admin → Realm `homeoffice` → **User Federation → Add provider → LDAP**
2. Konfiguration für **Active Directory:**

| Feld | Wert |
|---|---|
| Vendor | Active Directory |
| Connection URL | `ldap://dein-ad-server:389` (oder ldaps://…:636) |
| Bind DN | `cn=serviceaccount,dc=firma,dc=de` |
| Bind Credential | Service-Account-Passwort |
| Users DN | `cn=Users,dc=firma,dc=de` |
| Username LDAP attribute | `sAMAccountName` |
| UUID LDAP attribute | `objectGUID` |
| User Object Classes | `person,organizationalPerson,user` |

3. Konfiguration für **OpenLDAP / LLDAP:**

| Feld | Wert |
|---|---|
| Vendor | Other |
| Connection URL | `ldap://lldap:3890` |
| Bind DN | `uid=admin,ou=people,dc=example,dc=com` |
| Bind Credential | `LLDAP_LDAP_USER_PASS` |
| Users DN | `ou=people,dc=example,dc=com` |
| Username LDAP attribute | `uid` |
| UUID LDAP attribute | `entryUUID` |
| User Object Classes | `inetOrgPerson` |

4. **Test connection → Test authentication → Save → Sync all users**
5. Mattermost + Nextcloud erhalten die User automatisch über OIDC — kein weiterer Schritt

#### Option C — LDAP-Gruppen als Keycloak-Rollen mappen

Damit AD/LDAP-Gruppen direkt als Rollen in Mattermost/Nextcloud landen:

1. Keycloak → User Federation → LLDAP/AD → **Mappers → Add mapper**
2. Typ: `group-ldap-mapper`
3. LDAP Groups DN: `ou=groups,dc=…`
4. Group Name LDAP Attribute: `cn`
5. Save → **Sync LDAP Groups**

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
