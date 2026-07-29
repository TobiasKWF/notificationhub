# 🔔 NotificationHub

> **Self-hosted Notification Routing Engine** — empfängt Benachrichtigungen von beliebigen Quellen und leitet sie per Regelwerk an Telegram, ntfy, Discord, E-Mail, Webhooks und mehr weiter.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED.svg)](docker-compose.yml)

---

## ✨ Features

- **Unified Inbox** — REST API, MQTT und Webhook als Eingangskanäle
- **Rules Engine** — filterbasiertes Regelwerk mit AND/OR-Logik
- **Notification History** — Volltextsuche, Filter, Paginierung, Retention
- **Multi-Provider** — ntfy, Telegram, Discord, E-Mail (SMTP), MQTT, Webhook
- **Acknowledge & Delete** — Quittierung kritischer Alerts direkt im Dashboard
- **Live-Feed** — WebSocket-Push in Echtzeit
- **Dark-Mode Dashboard** — React + Vite + Tailwind + shadcn/ui
- **Multi-User** — Admin/Operator/Viewer + JWT-Auth
- **Docker-native** — `docker compose up`, multi-arch AMD64 + ARM64
- **LXC-ready** — Ein-Zeilen-Installscript für Debian 13 / Proxmox LXC

---

## 🚀 Quick Start

### Option A — Docker (empfohlen)

```bash
git clone https://github.com/TobiasKWF/notificationhub.git
cd notificationhub
cp .env.example .env          # Secrets anpassen!
docker compose up -d
```

Browser: **http://localhost:3000** · Login: `admin@localhost` / `changeme`

### Option B — Debian 13 / Proxmox LXC

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/TobiasKWF/notificationhub/main/install.sh)
```

Das Script installiert Node.js 22, baut Backend + Frontend, richtet einen systemd-Service und nginx-Reverse-Proxy auf Port 80 ein und gibt am Ende IP + Auto-generiertes Admin-Passwort aus.

### Option C — Manuell (Entwicklung)

```bash
git clone https://github.com/TobiasKWF/notificationhub.git
cd notificationhub
cp .env.example .env
npm install
npm run db:migrate
npm run dev          # Backend :3000 + Frontend :5173 parallel
```

---

## 📬 API — Benachrichtigung senden

### `POST /api/v1/notify`

Haupteingangspunkt. Akzeptiert Benachrichtigungen von beliebigen Quellen.

**Headers**
```
Content-Type: application/json
Authorization: Bearer <JWT-Token>   # oder X-API-Key: <token>
```

**Request-Body**

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `source` | string | ✅ | Quelle (z. B. `"Proxmox"`, `"Grafana"`) |
| `title` | string | ✅ | Kurztitel |
| `message` | string | ✅ | Volltext (max. 4096 Zeichen) |
| `priority` | enum | – | `INFO` `SUCCESS` `WARNING` `ERROR` `CRITICAL` `EMERGENCY` (default: `INFO`) |
| `service` | string | – | Dienst innerhalb der Quelle |
| `hostname` | string | – | Hostname / IP |
| `tags` | string[] | – | Freitags-Tags |
| `externalId` | string | – | Externe ID für Dedup |
| `timestamp` | ISO8601 | – | Überschreibt Server-Timestamp |
| `extra` | object | – | Beliebige Zusatzdaten (werden gespeichert) |

**Response `202 Accepted`**
```json
{ "id": "clx...", "received": true, "timestamp": "2026-07-29T10:00:00.000Z" }
```

---

## 🔧 API-Beispiele

### Proxmox — Backup-Ergebnis

```bash
curl -s -X POST http://localhost:3000/api/v1/notify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "source": "Proxmox",
    "service": "vzdump",
    "title": "Backup vm-100 abgeschlossen",
    "message": "Backup von vm-100 (ubuntu-prod) erfolgreich. Dauer: 4m 12s, Größe: 8.3 GB.",
    "priority": "SUCCESS",
    "hostname": "pve01",
    "tags": ["backup", "vm-100"]
  }'
```

### Grafana Alert

```bash
curl -s -X POST http://localhost:3000/api/v1/notify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "source": "Grafana",
    "service": "AlertManager",
    "title": "CPU > 90% auf server02",
    "message": "CPU-Auslastung auf server02 liegt bei 94% (Schwellwert: 90%). Zeitraum: 5 Minuten.",
    "priority": "ERROR",
    "hostname": "server02",
    "tags": ["cpu", "performance"],
    "extra": { "value": 94, "threshold": 90, "duration": "5m" }
  }'
```

### Home Assistant

```bash
curl -s -X POST http://localhost:3000/api/v1/notify \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "source": "HomeAssistant",
    "service": "binary_sensor.front_door",
    "title": "Haustür geöffnet",
    "message": "Die Haustür wurde um 08:14 geöffnet.",
    "priority": "INFO",
    "hostname": "ha.local",
    "tags": ["door", "security"]
  }'
```

### Docker-Container down (Bash-Script)

```bash
#!/usr/bin/env bash
# /usr/local/bin/docker-notify.sh <container-name> <status>
NHUB_URL="http://localhost:3000"
NHUB_TOKEN="your-token"

curl -s -X POST "${NHUB_URL}/api/v1/notify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${NHUB_TOKEN}" \
  -d "{
    \"source\": \"Docker\",
    \"service\": \"${1}\",
    \"title\": \"Container ${2}: ${1}\",
    \"message\": \"Docker-Container '${1}' ist in den Status '${2}' gewechselt.\",
    \"priority\": \"WARNING\",
    \"hostname\": \"$(hostname)\",
    \"tags\": [\"docker\", \"${1}\"]
  }"
```

### Python (z. B. aus einem Skript oder Cron-Job)

```python
import requests

NHUB_URL = "http://localhost:3000"
NHUB_TOKEN = "your-token"

def notify(source, title, message, priority="INFO", **kwargs):
    resp = requests.post(
        f"{NHUB_URL}/api/v1/notify",
        headers={"Authorization": f"Bearer {NHUB_TOKEN}"},
        json={"source": source, "title": title, "message": message, "priority": priority, **kwargs},
        timeout=5,
    )
    resp.raise_for_status()
    return resp.json()

# Beispiel
notify(
    source="BackupScript",
    title="Datenbank-Backup fehlgeschlagen",
    message="pg_dump für 'production' schlug fehl: Connection refused",
    priority="CRITICAL",
    hostname="db01",
    tags=["database", "backup"],
)
```

### Node.js

```js
const NHUB_URL = 'http://localhost:3000';
const NHUB_TOKEN = 'your-token';

async function notify({ source, title, message, priority = 'INFO', ...rest }) {
  const res = await fetch(`${NHUB_URL}/api/v1/notify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${NHUB_TOKEN}`,
    },
    body: JSON.stringify({ source, title, message, priority, ...rest }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Beispiel
await notify({
  source: 'CronJob',
  title: 'Zertifikat läuft bald ab',
  message: 'TLS-Zertifikat für example.com läuft in 7 Tagen ab.',
  priority: 'WARNING',
  hostname: 'proxy01',
  tags: ['ssl', 'certificate'],
});
```

### MQTT (alternativ zu REST)

```bash
mosquitto_pub -h localhost -p 1883 \
  -t "notifications/proxmox" \
  -m '{
    "source": "Proxmox",
    "title": "Node pve02 offline",
    "message": "pve02 antwortet nicht mehr auf Heartbeats.",
    "priority": "CRITICAL",
    "hostname": "pve02"
  }'
```

> MQTT muss in `.env` aktiviert sein: `MQTT_ENABLED=true`

---

## 📖 Weitere API-Endpunkte

### Authentifizierung

```bash
# Login → JWT Token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@localhost", "password": "changeme"}'
# → { "token": "eyJ...", "user": { ... } }

# Aktuell eingeloggten User
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### Notifications lesen

```bash
# Letzte 20 Notifications
curl "http://localhost:3000/api/v1/notifications?limit=20&page=1" \
  -H "Authorization: Bearer $TOKEN"

# Nur CRITICAL, noch nicht quittiert, Suche
curl "http://localhost:3000/api/v1/notifications?priority=CRITICAL&search=proxmox" \
  -H "Authorization: Bearer $TOKEN"

# Zeitraum-Filter
curl "http://localhost:3000/api/v1/notifications?since=2026-07-01&until=2026-07-29" \
  -H "Authorization: Bearer $TOKEN"

# Stats-Zusammenfassung
curl http://localhost:3000/api/v1/notifications/stats/summary \
  -H "Authorization: Bearer $TOKEN"

# Einzelne Notification (mit Routing-Ergebnis)
curl http://localhost:3000/api/v1/notifications/clx123abc \
  -H "Authorization: Bearer $TOKEN"

# Quittieren
curl -X POST http://localhost:3000/api/v1/notifications/clx123abc/acknowledge \
  -H "Authorization: Bearer $TOKEN"

# Löschen
curl -X DELETE http://localhost:3000/api/v1/notifications/clx123abc \
  -H "Authorization: Bearer $TOKEN"
```

### Provider verwalten

```bash
# Alle Provider
curl http://localhost:3000/api/v1/providers -H "Authorization: Bearer $TOKEN"

# Neuen Telegram-Provider anlegen
curl -X POST http://localhost:3000/api/v1/providers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Telegram Alarmgruppe",
    "type": "telegram",
    "isEnabled": true,
    "config": {
      "botToken": "123456:ABC-DEF",
      "chatId": "-1001234567890"
    }
  }'

# Provider testen
curl -X POST http://localhost:3000/api/v1/providers/clx123abc/test \
  -H "Authorization: Bearer $TOKEN"
```

### Health Check

```bash
curl http://localhost:3000/health
# → { "status": "ok", "uptime": 12345, "timestamp": "..." }
```

---

## 🔌 Provider-Status

| Provider | Implementiert |
|---|---|
| ntfy | ✅ |
| Telegram | ✅ |
| Discord | ✅ |
| Email (SMTP) | ✅ |
| MQTT (out) | ✅ |
| Generic Webhook | ✅ |
| Slack | 🔜 geplant |
| Pushover | 🔜 geplant |
| Gotify | 🔜 geplant |

---

## 🏗️ Architektur

```
┌──────────────────────────────────────────────────────────────┐
│                         Sources                              │
│  Proxmox · Grafana · Home Assistant · Docker · Bash/Python   │
└──────────────────────┬───────────────────────────────────────┘
                       │  REST API  /  MQTT
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                     NotificationHub                          │
│  Ingestion  →  Rules Engine  →  Provider Adapters            │
│  History DB (Prisma + SQLite/PostgreSQL)                     │
└──────────────────────┬───────────────────────────────────────┘
                       │  WebSocket (live feed)
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              React Dashboard (Vite + shadcn/ui)              │
│  Dashboard · Notifications · Rules · Providers · Settings    │
└──────────────────────────────────────────────────────────────┘
```

---

## 📦 Projektstruktur

```
notificationhub/
├── packages/
│   ├── backend/              # Fastify + TypeScript + Prisma
│   │   ├── src/
│   │   │   ├── api/v1/       # REST-Routen (auth, notify, notifications, rules, providers, settings, users)
│   │   │   ├── core/         # Rules Engine
│   │   │   ├── providers/    # ntfy, telegram, discord, email, mqtt, webhook
│   │   │   ├── ingestion/    # MQTT-Listener
│   │   │   ├── jobs/         # Retention-Cronjob
│   │   │   └── lib/          # prisma, logger, eventBus
│   │   └── prisma/
│   │       └── schema.prisma
│   └── frontend/             # React + Vite + Tailwind + shadcn/ui
│       └── src/
│           ├── pages/        # Dashboard, Notifications, Rules, Providers, Settings, Users
│           ├── components/   # AppLayout, ui/*
│           ├── lib/          # api.ts, websocket.ts, utils.ts
│           └── stores/       # auth, notifications, toast (Zustand)
├── install.sh                # Debian 13 / Proxmox LXC Installer
├── docker-compose.yml
├── docker-compose.prod.yml
├── Dockerfile.backend
└── .env.example
```

---

## ⚙️ Konfiguration

Alle Werte über `.env` (Kopie von `.env.example`).

Wichtigste Variablen:

| Variable | Default | Beschreibung |
|---|---|---|
| `PORT` | `3000` | HTTP-Port |
| `DATABASE_URL` | `file:./data/notificationhub.db` | SQLite oder PostgreSQL |
| `JWT_SECRET` | — | **Pflicht**, min. 32 Zeichen |
| `ADMIN_EMAIL` | `admin@localhost` | Erster Admin-User |
| `ADMIN_PASSWORD` | `changeme` | **Sofort ändern!** |
| `MQTT_ENABLED` | `false` | MQTT-Listener aktivieren |
| `RETENTION_DAYS` | `90` | Wie lange Notifications behalten |

---

## 🐳 Docker

```bash
# Entwicklung
docker compose up

# Produktion (mit PostgreSQL)
docker compose -f docker-compose.prod.yml up -d

# Multi-Arch-Build
docker buildx build --platform linux/amd64,linux/arm64 -t notificationhub -f Dockerfile.backend .
```

---

## 🛠️ Entwicklung

```bash
npm install
npm run db:migrate       # Prisma-Migrationen ausführen
npm run dev              # Backend :3000 + Frontend :5173
npm run build            # Production-Build beider Packages
npm run typecheck        # TypeScript-Check
npm run test             # Tests (vitest)
```

---

## 📄 Lizenz

MIT — siehe [LICENSE](LICENSE)
