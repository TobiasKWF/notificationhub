# 🔔 NotificationHub

> **Self-hosted Notification Routing Engine** — The Node-RED for notifications.

NotificationHub is a modern, self-hosted notification hub that acts as a central routing engine between your applications and notification services.

Applications send notifications **once** to NotificationHub. A powerful rules engine then filters, transforms, prioritizes, and forwards them to one or more providers — Telegram, ntfy, Discord, Slack, Email, Pushover, and more.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22.x-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED.svg)](docker-compose.yml)

---

## ✨ Features

- **Unified Inbox** — receive notifications via REST API, MQTT, or Webhooks
- **Rules Engine** — no-code drag-and-drop rule builder in the UI
- **Notification History** — full-text search, filter, export (JSON/CSV), retention policies
- **Multi-Provider** — ntfy, Telegram, Discord, Slack, Email, Pushbullet, Pushover, Gotify, MQTT, Webhook
- **Escalation & Repeat** — acknowledge critical alerts, escalate if unacknowledged
- **Quiet Hours** — route notifications differently by time of day / day of week
- **Duplicate Detection** — merge repeated notifications into a single grouped alert
- **Rate Limiting** — per source / host / service / provider
- **Templates** — Markdown-aware, variable interpolation (`{{title}}`, `{{hostname}}`, …)
- **Dark Mode** — beautiful dark-first dashboard, Grafana-quality UI
- **PWA** — installable, mobile-friendly, live updates via WebSocket
- **Multi-User** — Admin / Operator / Viewer roles + API tokens
- **Plugin System** — install new providers and widgets without recompiling
- **Docker-native** — single `docker compose up`, multi-arch (AMD64 + ARM64)

---

## 🚀 Quick Start

```bash
git clone https://github.com/TobiasKWF/notificationhub.git
cd notificationhub
cp .env.example .env
docker compose up -d
```

Open **http://localhost:3000** — default credentials: `admin` / `changeme`

---

## 📬 Send Your First Notification

```bash
curl -X POST http://localhost:3000/api/v1/notify \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "source": "Unraid",
    "service": "Docker",
    "title": "Container stopped",
    "message": "Grafana has stopped",
    "priority": "warning",
    "tags": ["docker", "grafana"],
    "hostname": "server01"
  }'
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Sources                                  │
│  Unraid │ Proxmox │ Home Assistant │ Grafana │ Scripts │ MQTT   │
└─────────────────────────┬───────────────────────────────────────┘
                          │  REST API / MQTT / Webhook
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NotificationHub                             │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  Ingestion  │→ │ Rules Engine │→ │  Provider Adapters   │   │
│  │  Layer      │  │              │  │                      │   │
│  └─────────────┘  └──────────────┘  │ ntfy │ Telegram     │   │
│         │               │           │ Discord │ Slack      │   │
│         ▼               ▼           │ Email │ Pushover    │   │
│  ┌─────────────┐  ┌──────────────┐  │ Gotify │ Webhook    │   │
│  │  History DB │  │ Escalation   │  └──────────────────────┘   │
│  │  (Prisma +  │  │ Engine       │                              │
│  │  SQLite/PG) │  └──────────────┘                              │
│  └─────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    React Dashboard (Vite)                        │
│   Dashboard │ Rules │ History │ Providers │ Settings │ API Docs  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Project Structure

```
notificationhub/
├── packages/
│   ├── backend/          # Node.js + TypeScript + Fastify
│   │   ├── src/
│   │   │   ├── api/      # REST routes (v1)
│   │   │   ├── core/     # Rules engine, escalation, dedup
│   │   │   ├── ingestion/# REST, MQTT, Webhook ingestion
│   │   │   ├── providers/# Notification provider adapters
│   │   │   ├── plugins/  # Plugin loader
│   │   │   ├── jobs/     # Background jobs (escalation, cleanup)
│   │   │   ├── auth/     # JWT, API tokens, OAuth
│   │   │   └── db/       # Prisma client + migrations
│   │   └── prisma/
│   │       └── schema.prisma
│   └── frontend/         # React + Vite + TailwindCSS + shadcn/ui
│       └── src/
│           ├── pages/    # Dashboard, Rules, History, Settings …
│           ├── components/
│           ├── hooks/
│           └── lib/
├── docs/                 # Architecture & API documentation
├── examples/             # Example configs and integrations
├── docker-compose.yml
├── docker-compose.prod.yml
├── Dockerfile.backend
├── Dockerfile.frontend
└── .env.example
```

---

## 🔌 Supported Providers

| Provider | Status |
|---|---|
| ntfy | ✅ Planned |
| Telegram | ✅ Planned |
| Discord | ✅ Planned |
| Slack | ✅ Planned |
| Email (SMTP) | ✅ Planned |
| Pushbullet | ✅ Planned |
| Pushover | ✅ Planned |
| Gotify | ✅ Planned |
| MQTT | ✅ Planned |
| Generic Webhook | ✅ Planned |

---

## ⚙️ Configuration

All configuration is managed through the web UI. No manual YAML editing required.

See [`.env.example`](.env.example) for available environment variables.

See [`docs/configuration.md`](docs/configuration.md) for detailed configuration documentation.

---

## 📖 Documentation

- [Architecture](docs/architecture.md)
- [REST API](docs/api.md)
- [Provider Setup](docs/providers/)
- [Rules Engine](docs/rules-engine.md)
- [Docker Deployment](docs/docker.md)
- [Unraid / Proxmox](docs/deployment/)

---

## 🛠️ Development

```bash
# Install dependencies
npm install

# Start backend (dev mode)
npm run dev:backend

# Start frontend (dev mode)
npm run dev:frontend

# Run both in parallel
npm run dev

# Database migrations
npm run db:migrate

# Build for production
npm run build
```

---

## 🐳 Docker

```bash
# Development
docker compose up

# Production (with PostgreSQL)
docker compose -f docker-compose.prod.yml up -d

# Build multi-arch image
docker buildx build --platform linux/amd64,linux/arm64 -t notificationhub .
```

---

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

---

## 📄 License

MIT — see [LICENSE](LICENSE)
