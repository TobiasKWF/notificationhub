#!/usr/bin/env bash
# =============================================================================
# NotificationHub – Install Script
# Debian 13 (Trixie) – bare-metal or LXC container
# Usage: curl -fsSL https://raw.githubusercontent.com/TobiasKWF/notificationhub/main/install.sh | bash
# =============================================================================
set -euo pipefail

# ---------- Colours ----------
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ OK ]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()   { echo -e "${RED}[FAIL]${NC}  $*" >&2; exit 1; }

# ---------- Defaults ----------
INSTALL_DIR="/opt/notificationhub"
DATA_DIR="/var/lib/notificationhub"
SERVICE_USER="notificationhub"
PORT="${PORT:-3000}"
NODE_MAJOR=22
REPO_URL="https://github.com/TobiasKWF/notificationhub.git"
GIT_BRANCH="${GIT_BRANCH:-main}"

# ---------- Root check ----------
[[ $EUID -eq 0 ]] || die "Run as root (sudo $0)"

# ---------- OS check ----------
if [[ -f /etc/os-release ]]; then
  . /etc/os-release
  info "Detected OS: ${PRETTY_NAME:-unknown}"
  [[ "${ID:-}" == "debian" ]] || warn "This script is tested on Debian; your mileage may vary."
fi

# ---------- 1. System packages ----------
info "Updating apt and installing prerequisites…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq \
  curl git ca-certificates gnupg lsb-release \
  build-essential python3 sqlite3 \
  nginx openssl
ok "System packages installed."

# ---------- 2. Node.js ----------
if command -v node &>/dev/null && [[ "$(node -e 'process.stdout.write(process.version.slice(1).split(\".\")[0])')" -ge "$NODE_MAJOR" ]]; then
  ok "Node.js $(node --version) already present."
else
  info "Installing Node.js ${NODE_MAJOR}.x via NodeSource…"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
  ok "Node.js $(node --version) installed."
fi

# ---------- 3. System user ----------
if ! id "$SERVICE_USER" &>/dev/null; then
  info "Creating system user '${SERVICE_USER}'…"
  useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
  ok "User created."
fi

# ---------- 4. Clone / update ----------
if [[ -d "${INSTALL_DIR}/.git" ]]; then
  info "Updating existing installation in ${INSTALL_DIR}…"
  git -C "$INSTALL_DIR" fetch --quiet origin
  git -C "$INSTALL_DIR" checkout --quiet "$GIT_BRANCH"
  git -C "$INSTALL_DIR" pull --quiet --ff-only origin "$GIT_BRANCH"
else
  info "Cloning repository to ${INSTALL_DIR}…"
  git clone --quiet --branch "$GIT_BRANCH" --depth 1 "$REPO_URL" "$INSTALL_DIR"
fi
ok "Repository ready."

# ---------- 5. Data directory ----------
info "Creating data directory ${DATA_DIR}…"
mkdir -p "${DATA_DIR}"
chown "${SERVICE_USER}:${SERVICE_USER}" "${DATA_DIR}"
ok "Data directory ready."

# ---------- 6. Environment file ----------
ENV_FILE="${INSTALL_DIR}/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  info "Generating .env from template…"
  cp "${INSTALL_DIR}/.env.example" "$ENV_FILE"

  JWT_SECRET=$(openssl rand -hex 32)
  APP_SECRET=$(openssl rand -hex 16)
  ADMIN_PASS=$(openssl rand -base64 12)

  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|"     "$ENV_FILE"
  sed -i "s|^APP_SECRET=.*|APP_SECRET=${APP_SECRET}|"     "$ENV_FILE"
  sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADMIN_PASS}|" "$ENV_FILE"
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=file:${DATA_DIR}/notificationhub.db|" "$ENV_FILE"
  sed -i "s|^PORT=.*|PORT=${PORT}|"                       "$ENV_FILE"
  sed -i "s|^NODE_ENV=.*|NODE_ENV=production|"            "$ENV_FILE"

  chmod 640 "$ENV_FILE"
  chown "root:${SERVICE_USER}" "$ENV_FILE"

  warn "Admin password auto-generated: ${ADMIN_PASS}"
  warn "Change it after first login! (stored in ${ENV_FILE})"
else
  info ".env already exists – skipping generation."
fi

# ---------- 7. npm install + build ----------
info "Installing npm dependencies…"
cd "$INSTALL_DIR"
npm ci --prefer-offline --quiet
ok "Dependencies installed."

info "Building backend…"
npm run build --workspace=packages/backend --quiet
ok "Backend built."

info "Building frontend…"
npm run build --workspace=packages/frontend --quiet
ok "Frontend built."

# ---------- 8. Database migration ----------
info "Running database migrations…"
set -a; source "$ENV_FILE"; set +a
npm run db:migrate --workspace=packages/backend
ok "Migrations applied."

# ---------- 9. Symlink data dir into backend dist ----------
DIST_DATA_DIR="${INSTALL_DIR}/packages/backend/dist/data"
mkdir -p "${DIST_DATA_DIR}"
mount --bind "${DATA_DIR}" "${DIST_DATA_DIR}" 2>/dev/null || \
  { mkdir -p "${DIST_DATA_DIR}" && ln -sfn "${DATA_DIR}" "${DIST_DATA_DIR}"; }

# ---------- 10. systemd service ----------
info "Installing systemd service…"
cat > /etc/systemd/system/notificationhub.service <<EOF
[Unit]
Description=NotificationHub
After=network.target
Requires=network.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
WorkingDirectory=${INSTALL_DIR}/packages/backend
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/node ${INSTALL_DIR}/packages/backend/dist/index.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=notificationhub
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=${DATA_DIR}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --quiet notificationhub
systemctl restart notificationhub
ok "Service started."

# ---------- 11. nginx reverse proxy ----------
info "Configuring nginx reverse proxy on port 80…"
SERVER_NAME=$(hostname -f 2>/dev/null || echo '_')

cat > /etc/nginx/sites-available/notificationhub <<EOF
server {
    listen 80;
    server_name ${SERVER_NAME};

    # Frontend static files
    root ${INSTALL_DIR}/packages/frontend/dist;
    index index.html;

    # WebSocket
    location /ws {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 86400;
    }

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

ln -sf /etc/nginx/sites-available/notificationhub /etc/nginx/sites-enabled/notificationhub
rm -f /etc/nginx/sites-enabled/default
nginx -t -q && systemctl reload nginx
ok "nginx configured."

# ---------- Done ----------
IP=$(hostname -I | awk '{print $1}')
echo
echo -e "${GREEN}╔═══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   NotificationHub installed successfully!     ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════╝${NC}"
echo
echo -e "  URL:      ${CYAN}http://${IP}/${NC}"
echo -e "  Admin:    ${CYAN}$(grep '^ADMIN_EMAIL' ${ENV_FILE} | cut -d= -f2)${NC}"
echo -e "  Password: ${YELLOW}$(grep '^ADMIN_PASSWORD' ${ENV_FILE} | cut -d= -f2)${NC}"
echo -e "  Logs:     journalctl -u notificationhub -f"
echo -e "  Config:   ${ENV_FILE}"
echo
warn "Change the admin password immediately after first login!"
