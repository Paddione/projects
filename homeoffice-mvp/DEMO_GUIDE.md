# Homeoffice MVP — Demo Guide

## Zugangsdaten

### Dienste
| URL | Dienst |
|---|---|
| https://chat.korczewski.de | Mattermost (Chat) |
| https://meet.korczewski.de | Jitsi (Video) |
| https://files.korczewski.de | Nextcloud (Dateien) |
| https://sso.korczewski.de | Keycloak (Admin) |

### Demo-User (für alle Dienste)
| Benutzer | Passwort | Name |
|---|---|---|
| anna.schmidt | Demo2026! | Anna Schmidt |
| max.mueller | Demo2026! | Max Müller |
| lisa.berger | Demo2026! | Lisa Berger |

### Admin-Zugänge
| Dienst | User | Passwort |
|---|---|---|
| Mattermost | patrick (p.korczewski@gmail.com) | Admin2026!Korcz |
| Nextcloud | admin | → .env.secrets |
| Keycloak | admin | → .env.secrets |

## Was ist voreingerichtet?

### Mattermost
- Team "Homeoffice MVP Demo"
- Channels: #town-square, #ankuendigungen, #projektplanung, #technik, #smalltalk
- Beispielgespräche in allen Channels
- Demo-User angelegt und eingeladen

### Nextcloud
- Ordnerstruktur: Homeoffice-Demo/
  - 01_Projektdokumentation/Anforderungen_v1.0.md
  - 02_Technik/Architektur.md
  - 03_Meetings/Protokoll_2026-03-28.md
- Demo-User angelegt

### Keycloak
- Realm: homeoffice
- Client: mattermost (SSO-Login)
- Client: nextcloud (SSO-Login)
- Demo-User mit SSO-Accounts

## Demo-Flow (Empfehlung)

1. **Login** → https://chat.korczewski.de → "Mit Keycloak anmelden" → Zeigt SSO
2. **Chat** → Channel #projektplanung → Beispieldiskussion zeigen
3. **Video-Call** → Auf Kamera-Symbol klicken → Jitsi startet direkt im Browser
4. **Dateien** → Büroklammer-Symbol → Link zu Nextcloud teilen
5. **Nextcloud** → https://files.korczewski.de → Projektdokumentation zeigen
6. **Admin** → https://sso.korczewski.de → Keycloak Realm zeigen (User-Management)

## User einladen
Neue User über Keycloak anlegen: https://sso.korczewski.de/admin/homeoffice/console
→ Users → Add user → Password setzen → Mattermost-Login funktioniert automatisch per SSO
