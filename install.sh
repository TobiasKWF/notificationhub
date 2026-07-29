#!/usr/bin/env bash
# =============================================================================
# NotificationHub – Install Script
# Debian 13 (Trixie) – bare-metal, VM or Proxmox LXC
#
# Usage (as root):
#   bash <(curl -fsSL https://raw.githubusercontent.com/TobiasKWF/notificationhub/main/install.sh)
#
# Environment overrides:
#   PORT=3000          HTTP port for the Node.js backend
#   GIT_BRANCH=main    Git branch / tag to install
#   DB_TYPE=sqlite     "sqlite" | "mariadb"  (default: sqlite)
#   DB_HOST=127.0.0.1  MariaDB host          (used when DB_TYPE=mariadb)
#   DB_PORT=3306       MariaDB port
#   DB_NAME=notificationhub
#   DB_USER=notificationhub
#   DB_PASS=           Auto-generated if empty
#   INSTALL_MARIADB=1  Install MariaDB locally (only when DB_TYPE=mariadb, default: 1)
#   ADMIN_EMAIL=admin@localhost
# =============================================================================
set -euo pipefail

# ──── Colours ──────────────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BOLD='\033[1m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ OK ]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()   { echo -e "${RED}[FAIL]${NC}  $*" >&2; exit 1; }
step()  { echo -e "\n${BOLD}${CYAN}==> $*${NC}"; }

# ──── Root check ────────────────────────────────────────────────────────────────────────────
[[ $EUID -eq 0 ]] || die "Run as root (sudo bash install.sh)"

# ──── OS check ───────────────────────────────────────────────────────────────────────────────
if [[ -f /etc/os-release ]]; then
  source /etc/os-release
  info "Detected OS: ${PRETTY_NAME:-unknown}"
  [[ "${ID:-}" == "debian" ]] || warn "Tested on Debian 13 – other distros may need adjustments."
  if [[ "${VERSION_CODENAME:-}" != "trixie" && "${VERSION_ID:-}" != "13" ]]; then
    warn "Script is optimised for Debian 13 (Trixie). Detected: ${VERSION_CODENAME:-unknown}."
  fi
fi

# ──── Defaults ─────────────────────────────────────────────────────────────────────────────
INSTALL_DIR="/opt/notificationhub"
DATA_DIR="/var/lib/notificationhub"
SERVICE_USER="notificationhub"
PORT="${PORT:-3000}"
NODE_MAJOR=22
REPO_URL="https://github.com/TobiasKWF/notificationhub.git"
GIT_BRANCH="${GIT_BRANCH:-main}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@localhost}"

# DB defaults
DB_TYPE="${DB_TYPE:-sqlite}"          # sqlite | mariadb
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-notificationhub}"
DB_USER="${DB_USER:-notificationhub}"
DB_PASS="${DB_PASS:-}"
INSTALL_MARIADB="${INSTALL_MARIADB:-1}"  # 1 = install mariadb-server locally if DB_TYPE=mariadb

# ──── Interactive DB selection (skip if DB_TYPE already set in env) ─────────────────────
if [[ -t 0 && -z "${DB_TYPE_SET:-}" ]]; then
  echo
  echo -e "${BOLD}Database Backend${NC}"
  echo "  1) SQLite   – simple, no extra setup, good for < 100k notifications"
  echo "  2) MariaDB  – recommended for production / high volume"
  echo
  read -rp "Choose [1/2] (default: 1): " _db_choice
  case "${_db_choice:-1}" in
    2) DB_TYPE="mariadb" ;;
    *) DB_TYPE="sqlite"  ;;
  esac
fi

if [[ "$DB_TYPE" == "mariadb" ]]; then
  if [[ -t 0 ]]; then
    echo
    echo -e "${BOLD}MariaDB Setup${NC}"
    read -rp "  Install MariaDB locally? [Y/n]: " _inst
    [[ "${_inst:-y}" =~ ^[Nn] ]] && INSTALL_MARIADB=0 || INSTALL_MARIADB=1

    if [[ "$INSTALL_MARIADB" == "0" ]]; then
      read -rp "  MariaDB host   [${DB_HOST}]: "  _h;  [[ -n "$_h" ]] && DB_HOST="$_h"
      read -rp "  MariaDB port   [${DB_PORT}]: "  _p;  [[ -n "$_p" ]] && DB_PORT="$_p"
      read -rp "  Database name  [${DB_NAME}]: "  _n;  [[ -n "$_n" ]] && DB_NAME="$_n"
      read -rp "  DB user        [${DB_USER}]: "  _u;  [[ -n "$_u" ]] && DB_USER="$_u"
      read -rsp "  DB password (leave blank to generate): " _pw; echo
      [[ -n "$_pw" ]] && DB_PASS="$_pw"
    fi
  fi
fi

# Generate DB password if still empty
[[ -z "$DB_PASS" ]] && DB_PASS=$(openssl rand -base64 18 | tr -dc 'a-zA-Z0-9' | head -c 24)

# ──── 1. System packages ──────────────────────────────────────────────────────────────────────
step "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq

PKGS=(curl git ca-certificates gnupg lsb-release build-essential python3 nginx openssl)
[[ "$DB_TYPE" == "sqlite" ]] && PKGS+=(sqlite3)

apt-get install -y -qq "${PKGS[@]}"
ok "System packages installed."

# ──── 2. Node.js ──────────────────────────────────────────────────────────────────────────────
step "Setting up Node.js ${NODE_MAJOR}"
if command -v node &>/dev/null; then
  _node_ver=$(node -e 'process.stdout.write(process.version.slice(1).split(".")[0])')
  if [[ "$_node_ver" -ge "$NODE_MAJOR" ]]; then
    ok "Node.js $(node --version) already installed."
  else
    warn "Node.js ${_node_ver}.x found, upgrading to ${NODE_MAJOR}.x…"
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt-get install -y -qq nodejs
    ok "Node.js $(node --version) installed."
  fi
else
  info "Installing Node.js ${NODE_MAJOR}.x via NodeSource…"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
  ok "Node.js $(node --version) installed."
fi

# ──── 3. MariaDB (optional) ───────────────────────────────────────────────────────────────────
if [[ "$DB_TYPE" == "mariadb" && "$INSTALL_MARIADB" == "1" ]]; then
  step "Installing MariaDB server"
  apt-get install -y -qq mariadb-server mariadb-client
  systemctl enable --quiet mariadb
  systemctl start mariadb
  ok "MariaDB installed and running."

  info "Creating database '${DB_NAME}' and user '${DB_USER}'…"
  mysql --defaults-extra-file=/dev/null -u root <<-SQL
    CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`
      CHARACTER SET utf8mb4
      COLLATE utf8mb4_unicode_ci;
    CREATE USER IF NOT EXISTS '${DB_USER}'@'${DB_HOST}'
      IDENTIFIED BY '${DB_PASS}';
    GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'${DB_HOST}';
    FLUSH PRIVILEGES;
SQL
  ok "Database and user created."

elif [[ "$DB_TYPE" == "mariadb" && "$INSTALL_MARIADB" == "0" ]]; then
  step "Using external MariaDB at ${DB_HOST}:${DB_PORT}"
  if command -v mysql &>/dev/null; then
    if mysql -h "${DB_HOST}" -P "${DB_PORT}" -u "${DB_USER}" -p"${DB_PASS}" \
        -e "SELECT 1;" "${DB_NAME}" &>/dev/null; then
      ok "Connection to external MariaDB successful."
    else
      warn "Could not connect to ${DB_HOST}:${DB_PORT} as '${DB_USER}'. Check credentials."
      warn "Continuing – migration may fail if DB is unreachable."
    fi
  else
    apt-get install -y -qq mariadb-client
  fi
fi

# ──── 4. System user ───────────────────────────────────────────────────────────────────────────
step "Configuring system user"
if ! id "$SERVICE_USER" &>/dev/null; then
  useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
  ok "System user '${SERVICE_USER}' created."
else
  ok "System user '${SERVICE_USER}' already exists."
fi

# ──── 5. Clone / update repository ────────────────────────────────────────────────────────────
step "Fetching NotificationHub repository"
if [[ -d "${INSTALL_DIR}/.git" ]]; then
  info "Existing installation found – updating to branch '${GIT_BRANCH}'…"
  git -C "$INSTALL_DIR" fetch --quiet origin
  git -C "$INSTALL_DIR" checkout --quiet "$GIT_BRANCH"
  git -C "$INSTALL_DIR" pull --quiet --ff-only origin "$GIT_BRANCH"
else
  info "Cloning to ${INSTALL_DIR}…"
  git clone --quiet --branch "$GIT_BRANCH" --depth 1 "$REPO_URL" "$INSTALL_DIR"
fi
ok "Repository ready at ${INSTALL_DIR}."

# ──── 6. Data directory ───────────────────────────────────────────────────────────────────────
step "Preparing data directory"
mkdir -p "${DATA_DIR}"
chown "${SERVICE_USER}:${SERVICE_USER}" "${DATA_DIR}"
ok "Data directory: ${DATA_DIR}"

# ──── 7. Environment file ──────────────────────────────────────────────────────────────────────
step "Generating environment configuration"
ENV_FILE="${INSTALL_DIR}/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  cp "${INSTALL_DIR}/.env.example" "$ENV_FILE"

  JWT_SECRET=$(openssl rand -hex 32)
  APP_SECRET=$(openssl rand -hex 16)
  ADMIN_PASS=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 16)

  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|"           "$ENV_FILE"
  sed -i "s|^APP_SECRET=.*|APP_SECRET=${APP_SECRET}|"           "$ENV_FILE"
  sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADMIN_PASS}|"   "$ENV_FILE"
  sed -i "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=${ADMIN_EMAIL}|"         "$ENV_FILE"
  sed -i "s|^PORT=.*|PORT=${PORT}|"                             "$ENV_FILE"
  sed -i "s|^NODE_ENV=.*|NODE_ENV=production|"                  "$ENV_FILE"

  if [[ "$DB_TYPE" == "mariadb" ]]; then
    sed -i "s|^DATABASE_PROVIDER=.*|DATABASE_PROVIDER=mysql|"   "$ENV_FILE"
    sed -i "s|^DATABASE_URL=file.*|DATABASE_URL=mysql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?connection_limit=10|" "$ENV_FILE"
  else
    sed -i "s|^DATABASE_PROVIDER=.*|DATABASE_PROVIDER=sqlite|"  "$ENV_FILE"
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=file:${DATA_DIR}/notificationhub.db|" "$ENV_FILE"
  fi

  chmod 640 "$ENV_FILE"
  chown "root:${SERVICE_USER}" "$ENV_FILE"

  ok ".env generated."
  warn "Admin password (auto-generated): ${BOLD}${ADMIN_PASS}${NC}"
  warn "Change it after first login! Stored in: ${ENV_FILE}"
  ADMIN_PASS_GENERATED="$ADMIN_PASS"
else
  info ".env already exists – skipping. Re-run with the file deleted to regenerate."
  ADMIN_PASS_GENERATED=$(grep '^ADMIN_PASSWORD' "${ENV_FILE}" | cut -d= -f2)
fi

# ──── 8. npm install + build ──────────────────────────────────────────────────────────────────────
step "Installing npm dependencies"
cd "$INSTALL_DIR"
# --legacy-peer-deps: avoids conflicts from transitive peer deps (e.g. browserslist)
npm install --legacy-peer-deps --quiet
ok "Dependencies installed."

step "Building backend + frontend"
npm run build --workspace=packages/backend  --quiet
npm run build --workspace=packages/frontend --quiet
ok "Build complete."

# ──── 9. Prisma: generate client + run migrations ──────────────────────────────────────────────
step "Running database migrations"
set -a; source "$ENV_FILE"; set +a

cd "${INSTALL_DIR}/packages/backend"
npx prisma generate
npx prisma migrate deploy
ok "Migrations applied (${DB_TYPE})."

if ! npx prisma db seed 2>&1 | grep -q 'Admin already exists'; then
  ok "Database seeded."
fi

cd "$INSTALL_DIR"

# ──── 10. systemd service ──────────────────────────────────────────────────────────────────────────
step "Installing systemd service"

_db_after="network.target"
[[ "$DB_TYPE" == "mariadb" && "$INSTALL_MARIADB" == "1" ]] && _db_after="network.target mariadb.service"

cat > /etc/systemd/system/notificationhub.service <<EOF
[Unit]
Description=NotificationHub – Notification Routing Engine
Documentation=https://github.com/TobiasKWF/notificationhub
After=${_db_after}
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
StartLimitBurst=5
StartLimitIntervalSec=60
StandardOutput=journal
StandardError=journal
SyslogIdentifier=notificationhub

# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${DATA_DIR}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --quiet notificationhub
systemctl restart notificationhub
ok "notificationhub.service enabled and started."

# ──── 11. nginx reverse proxy ─────────────────────────────────────────────────────────────────────
step "Configuring nginx"
SERVER_NAME=$(hostname -f 2>/dev/null || echo '_')

cat > /etc/nginx/sites-available/notificationhub <<EOF
server {
    listen 80;
    server_name ${SERVER_NAME};

    root ${INSTALL_DIR}/packages/frontend/dist;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    location ~* \.(js|css|woff2?|png|svg|ico)\$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }

    location = /health {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_set_header Host \$host;
    }

    location /ws {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 86400;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

ln -sf /etc/nginx/sites-available/notificationhub /etc/nginx/sites-enabled/notificationhub
rm -f /etc/nginx/sites-enabled/default
nginx -t -q && systemctl reload nginx
ok "nginx configured."

# ──── 12. Firewall hint ───────────────────────────────────────────────────────────────────────────
if command -v ufw &>/dev/null; then
  ufw allow 80/tcp  &>/dev/null || true
  ufw allow 443/tcp &>/dev/null || true
  ok "ufw rules for port 80/443 added."
fi

# ──── Done ───────────────────────────────────────────────────────────────────────────────────
IP=$(hostname -I | awk '{print $1}')

echo
echo -e "${GREEN}${BOLD}"
echo -e "  ╭───────────────────────────────────────────╮"
echo -e "  │   NotificationHub installed! 🔔           │"
echo -e "  ╰───────────────────────────────────────────╯"
echo -e "${NC}"
echo -e "  ${BOLD}URL${NC}        http://${IP}/"
echo -e "  ${BOLD}Admin${NC}      ${ADMIN_EMAIL}"
echo -e "  ${BOLD}Password${NC}   ${YELLOW}${ADMIN_PASS_GENERATED}${NC}"
echo -e "  ${BOLD}Database${NC}   ${DB_TYPE^^}$([ "$DB_TYPE" = 'mariadb' ] && echo " @ ${DB_HOST}:${DB_PORT}/${DB_NAME}" || echo " (${DATA_DIR}/notificationhub.db)")"
echo
echo -e "  ${BOLD}Logs${NC}       journalctl -u notificationhub -f"
echo -e "  ${BOLD}Config${NC}     ${ENV_FILE}"
echo -e "  ${BOLD}Update${NC}     git -C ${INSTALL_DIR} pull && npm install --legacy-peer-deps && systemctl restart notificationhub"
echo
warn "Change the admin password immediately after first login!"
