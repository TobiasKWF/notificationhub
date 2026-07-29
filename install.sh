#!/usr/bin/env bash
# =============================================================================
# NotificationHub – Install Script
# Debian 13 (Trixie) – bare-metal, VM or Proxmox LXC
# =============================================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'
BOLD='\033[1m'; NC='\033[0m'
info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[ OK ]${NC}  $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()   { echo -e "${RED}[FAIL]${NC}  $*" >&2; exit 1; }
step()  { echo -e "\n${BOLD}${CYAN}==> $*${NC}"; }

load_env() {
  local file="$1"
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      local key="${line%%=*}"
      local val="${line#*=}"
      val="${val%\'}"; val="${val#\'}"
      val="${val%\"}"; val="${val#\"}"
      export "$key"="$val"
    fi
  done < "$file"
}

[[ $EUID -eq 0 ]] || die "Run as root (sudo bash install.sh)"

if [[ -f /etc/os-release ]]; then
  source /etc/os-release
  info "Detected OS: ${PRETTY_NAME:-unknown}"
  [[ "${ID:-}" == "debian" ]] || warn "Tested on Debian 13 – other distros may need adjustments."
fi

INSTALL_DIR="/opt/notificationhub"
DATA_DIR="/var/lib/notificationhub"
SERVICE_USER="notificationhub"
PORT="${PORT:-3003}"
NODE_MAJOR=22
REPO_URL="https://github.com/TobiasKWF/notificationhub.git"
GIT_BRANCH="${GIT_BRANCH:-main}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@localhost}"
DB_TYPE="${DB_TYPE:-sqlite}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-notificationhub}"
DB_USER="${DB_USER:-notificationhub}"
DB_PASS="${DB_PASS:-}"
INSTALL_MARIADB="${INSTALL_MARIADB:-1}"
PRISMA_VERSION="5.22.0"

if [[ -t 0 && -z "${DB_TYPE_SET:-}" ]]; then
  echo; echo -e "${BOLD}Database Backend${NC}"
  echo "  1) SQLite   – simple, no extra setup"
  echo "  2) MariaDB  – recommended for production"
  echo
  read -rp "Choose [1/2] (default: 1): " _db_choice
  case "${_db_choice:-1}" in
    2) DB_TYPE="mariadb" ;;
    *) DB_TYPE="sqlite"  ;;
  esac
fi

if [[ "$DB_TYPE" == "mariadb" && -t 0 ]]; then
  echo; echo -e "${BOLD}MariaDB Setup${NC}"
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

[[ -z "$DB_PASS" ]] && DB_PASS=$(openssl rand -base64 18 | tr -dc 'a-zA-Z0-9' | head -c 24)

# ──── 1. System packages
step "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
PKGS=(curl git ca-certificates gnupg lsb-release build-essential python3 nginx openssl)
[[ "$DB_TYPE" == "sqlite" ]] && PKGS+=(sqlite3)
apt-get install -y -qq "${PKGS[@]}"
ok "System packages installed."

# ──── 2. Node.js
step "Setting up Node.js ${NODE_MAJOR}"
if command -v node &>/dev/null; then
  _node_ver=$(node -e 'process.stdout.write(process.version.slice(1).split(".")[0])')
  if [[ "$_node_ver" -ge "$NODE_MAJOR" ]]; then
    ok "Node.js $(node --version) already installed."
  else
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt-get install -y -qq nodejs
    ok "Node.js $(node --version) installed."
  fi
else
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
  ok "Node.js $(node --version) installed."
fi

# ──── 3. MariaDB
if [[ "$DB_TYPE" == "mariadb" && "$INSTALL_MARIADB" == "1" ]]; then
  step "Installing MariaDB server"
  apt-get install -y -qq mariadb-server mariadb-client
  systemctl enable --quiet mariadb && systemctl start mariadb
  mysql --defaults-extra-file=/dev/null -u root <<-SQL
    CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE USER IF NOT EXISTS '${DB_USER}'@'${DB_HOST}' IDENTIFIED BY '${DB_PASS}';
    GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'${DB_HOST}';
    FLUSH PRIVILEGES;
SQL
  ok "MariaDB installed and database created."
elif [[ "$DB_TYPE" == "mariadb" && "$INSTALL_MARIADB" == "0" ]]; then
  step "Using external MariaDB at ${DB_HOST}:${DB_PORT}"
  command -v mysql &>/dev/null || apt-get install -y -qq mariadb-client
fi

# ──── 4. System user
step "Configuring system user"
id "$SERVICE_USER" &>/dev/null || useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
ok "System user '${SERVICE_USER}' ready."

# ──── 5. Clone / update repository
step "Fetching NotificationHub repository"
if [[ -d "${INSTALL_DIR}/.git" ]]; then
  git -C "$INSTALL_DIR" fetch --quiet origin
  git -C "$INSTALL_DIR" checkout --quiet "$GIT_BRANCH"
  git -C "$INSTALL_DIR" pull --quiet --ff-only origin "$GIT_BRANCH"
else
  git clone --quiet --branch "$GIT_BRANCH" --depth 1 "$REPO_URL" "$INSTALL_DIR"
fi
ok "Repository ready at ${INSTALL_DIR}."

# ──── 6. Data directory
step "Preparing data directory"
mkdir -p "${DATA_DIR}"
chown "${SERVICE_USER}:${SERVICE_USER}" "${DATA_DIR}"
ok "Data directory: ${DATA_DIR}"

# ──── 7. Environment file
step "Generating environment configuration"
ENV_FILE="${INSTALL_DIR}/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  cp "${INSTALL_DIR}/.env.example" "$ENV_FILE"
  JWT_SECRET=$(openssl rand -hex 32)
  APP_SECRET=$(openssl rand -hex 16)
  ADMIN_PASS=$(openssl rand -base64 12 | tr -dc 'a-zA-Z0-9' | head -c 16)
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|"         "$ENV_FILE"
  sed -i "s|^APP_SECRET=.*|APP_SECRET=${APP_SECRET}|"         "$ENV_FILE"
  sed -i "s|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=${ADMIN_PASS}|" "$ENV_FILE"
  sed -i "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=${ADMIN_EMAIL}|"       "$ENV_FILE"
  sed -i "s|^PORT=.*|PORT=${PORT}|"                           "$ENV_FILE"
  sed -i "s|^NODE_ENV=.*|NODE_ENV=production|"                "$ENV_FILE"
  if [[ "$DB_TYPE" == "mariadb" ]]; then
    sed -i "s|^DATABASE_PROVIDER=.*|DATABASE_PROVIDER=mysql|" "$ENV_FILE"
    sed -i "s|^DATABASE_URL=file.*|DATABASE_URL=mysql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}?connection_limit=10|" "$ENV_FILE"
  else
    sed -i "s|^DATABASE_PROVIDER=.*|DATABASE_PROVIDER=sqlite|" "$ENV_FILE"
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=file:${DATA_DIR}/notificationhub.db|" "$ENV_FILE"
  fi
  chmod 640 "$ENV_FILE"
  chown "root:${SERVICE_USER}" "$ENV_FILE"
  ok ".env generated."
  warn "Admin password (auto-generated): ${BOLD}${ADMIN_PASS}${NC}"
  warn "Change it after first login! Stored in: ${ENV_FILE}"
  ADMIN_PASS_GENERATED="$ADMIN_PASS"
else
  info ".env already exists – skipping."
  ADMIN_PASS_GENERATED=$(awk -F= '/^ADMIN_PASSWORD=/{sub(/^[^=]*=/,""); print; exit}' "${ENV_FILE}" | sed 's/^"//; s/"$//; s/^'"'"'//; s/'"'"'$//')
fi

load_env "$ENV_FILE"

# ──── 8. typescript + tsx in /root/node_modules vorinstallieren
# npm installiert auf diesem System immer nach /root/node_modules (kein globaler Prefix).
# Das passiert BEVOR der Workspace-Install, damit Hoisting keinen Peer-Konflikt abwirft.
step "Pre-installing typescript and tsx into root node_modules"
cd /root
npm install typescript tsx 2>&1 | grep -v '^npm warn' || true

# Pfade nach /root/node_modules sind jetzt garantiert vorhanden
ROOT_TSC="/root/node_modules/.bin/tsc"
ROOT_TSX="/root/node_modules/.bin/tsx"
[[ -x "$ROOT_TSC" ]] || die "typescript konnte nicht in /root/node_modules installiert werden"
[[ -x "$ROOT_TSX" ]] || die "tsx konnte nicht in /root/node_modules installiert werden"
ok "typescript $($ROOT_TSC --version) und tsx in /root/node_modules verfügbar."

# ──── 9. Projekt-Dependencies installieren
step "Installing project dependencies (clean)"
cd "$INSTALL_DIR"
rm -rf node_modules packages/backend/node_modules packages/frontend/node_modules
npm install --legacy-peer-deps
ok "Project dependencies installed."

# ──── 9b. Prisma lokal erzwingen
step "Enforcing Prisma ${PRISMA_VERSION}"
cd "$INSTALL_DIR"
npm install --legacy-peer-deps "prisma@${PRISMA_VERSION}" "@prisma/client@${PRISMA_VERSION}"
ok "Prisma ${PRISMA_VERSION} installed."

# ──── Symlinks: /opt/notificationhub/node_modules/.bin/ → /root/node_modules
# Pakete möglicherweise durch Workspace-Hoisting vorhanden, sonst Fallback auf /root
step "Ensuring tsc and tsx symlinks in workspace .bin/"
BIN_DIR="${INSTALL_DIR}/node_modules/.bin"
mkdir -p "${BIN_DIR}"

# tsc
if [[ ! -x "${BIN_DIR}/tsc" ]]; then
  ln -sf "$ROOT_TSC" "${BIN_DIR}/tsc"
  info "tsc: Symlink auf ${ROOT_TSC} gesetzt."
else
  info "tsc: bereits in ${BIN_DIR} vorhanden."
fi

# tsx
if [[ ! -x "${BIN_DIR}/tsx" ]]; then
  ln -sf "$ROOT_TSX" "${BIN_DIR}/tsx"
  info "tsx: Symlink auf ${ROOT_TSX} gesetzt."
else
  info "tsx: bereits in ${BIN_DIR} vorhanden."
fi

# ──── Alle Build-Binaries final verifizieren
TSC_BIN="${BIN_DIR}/tsc"
TSX_BIN="${BIN_DIR}/tsx"
PRISMA_BIN="${INSTALL_DIR}/node_modules/.bin/prisma"
VITE_BIN="${INSTALL_DIR}/node_modules/.bin/vite"

[[ -x "$TSC_BIN"    ]] || die "tsc nicht gefunden unter ${TSC_BIN}"
[[ -x "$TSX_BIN"    ]] || die "tsx nicht gefunden unter ${TSX_BIN}"
[[ -x "$PRISMA_BIN" ]] || die "prisma nicht gefunden unter ${PRISMA_BIN}"
[[ -x "$VITE_BIN"   ]] || die "vite nicht gefunden unter ${VITE_BIN}"

ok "Alle Build-Tools verifiziert:"
info "  tsc    → $("${TSC_BIN}" --version)"
info "  prisma → $("${PRISMA_BIN}" --version 2>/dev/null | head -1)"
info "  vite   → $("${VITE_BIN}" --version)"

# ──── 10. Prisma schema
step "Selecting Prisma schema for ${DB_TYPE}"
PRISMA_DIR="${INSTALL_DIR}/packages/backend/prisma"
if [[ "$DB_TYPE" == "mariadb" ]]; then
  cp "${PRISMA_DIR}/schema.mysql.prisma" "${PRISMA_DIR}/schema.prisma"
  info "Using MySQL/MariaDB schema."
else
  cp "${PRISMA_DIR}/schema.sqlite.prisma" "${PRISMA_DIR}/schema.prisma"
  info "Using SQLite schema."
fi
ok "Prisma schema selected."

# ──── 11. Prisma generate
step "Generating Prisma client"
cd "${INSTALL_DIR}/packages/backend"
"${PRISMA_BIN}" generate
ok "Prisma client generated."

# ──── 12. Build
step "Building backend"
cd "${INSTALL_DIR}/packages/backend"
"${TSC_BIN}" -p tsconfig.json
ok "Backend compiled."

step "Building frontend"
cd "${INSTALL_DIR}/packages/frontend"
"${TSC_BIN}" -p tsconfig.json --noEmit
"${VITE_BIN}" build
ok "Frontend built."

# ──── 13. DB migrate + seed
step "Running database migrations"
cd "${INSTALL_DIR}/packages/backend"
"${PRISMA_BIN}" migrate deploy
ok "Migrations applied."
if "${PRISMA_BIN}" db seed 2>&1 | grep -q 'Admin already exists'; then
  info "Admin user already exists – skipping seed."
else
  ok "Database seeded."
fi
cd "$INSTALL_DIR"

# ──── 14. systemd
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
ok "notificationhub.service gestartet."

# ──── 15. nginx
step "Configuring nginx"
SERVER_NAME=$(hostname -f 2>/dev/null || echo '_')
cat > /etc/nginx/sites-available/notificationhub <<EOF
server {
    listen 80;
    server_name ${SERVER_NAME};
    root ${INSTALL_DIR}/packages/frontend/dist;
    index index.html;
    gzip on; gzip_vary on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    location ~* \.(js|css|woff2?|png|svg|ico)\$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files \$uri =404;
    }
    location = /health { proxy_pass http://127.0.0.1:${PORT}; proxy_set_header Host \$host; }
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
    location / { try_files \$uri \$uri/ /index.html; }
}
EOF
ln -sf /etc/nginx/sites-available/notificationhub /etc/nginx/sites-enabled/notificationhub
rm -f /etc/nginx/sites-enabled/default
nginx -t -q && systemctl reload nginx
ok "nginx konfiguriert."

# ──── 16. Firewall
if command -v ufw &>/dev/null; then
  ufw allow 80/tcp &>/dev/null || true
  ufw allow 443/tcp &>/dev/null || true
  ok "UFW-Regeln gesetzt."
fi

# ──── Done
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
echo -e "  ${BOLD}Update${NC}     git -C ${INSTALL_DIR} pull && bash ${INSTALL_DIR}/install.sh"
echo
warn "Admin-Passwort nach dem ersten Login sofort ändern!"
