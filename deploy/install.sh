#!/usr/bin/env bash
# MinersHaven — native (no Docker) installer for Ubuntu 22.04/24.04 & Debian 12.
# Installs: Python venv backend (systemd), MongoDB (local), Node build of the frontend, nginx (+ optional Let's Encrypt).
# Re-run any time to update: it rebuilds and restarts, keeping backend/.env and the database.
#
#   sudo ./deploy/install.sh                                   # HTTP on server IP, reads Miningcore at 127.0.0.1:4000
#   sudo ./deploy/install.sh --domain pool.example.com --email you@example.com   # + HTTPS
#   sudo ./deploy/install.sh --demo                            # demo data, no Miningcore needed
set -euo pipefail

DOMAIN=""; EMAIL=""; MC_URL="http://127.0.0.1:4000"; DATA_SOURCE="miningcore"; STRATUM_HOST=""
APP_DIR="/opt/minershaven"; APP_USER="minershaven"; API_PORT="8001"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --miningcore-url) MC_URL="$2"; shift 2 ;;
    --stratum-host) STRATUM_HOST="$2"; shift 2 ;;
    --demo) DATA_SOURCE="demo"; shift ;;
    --dir) APP_DIR="$2"; shift 2 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

[[ $EUID -eq 0 ]] || { echo "Run as root: sudo $0 $*"; exit 1; }
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
log() { echo -e "\033[1;32m[minershaven]\033[0m $*"; }

. /etc/os-release
OS_ID="$ID"; CODENAME="${VERSION_CODENAME:-}"
[[ "$OS_ID" == "ubuntu" || "$OS_ID" == "debian" ]] || { echo "Supported: Ubuntu / Debian (found $OS_ID)"; exit 1; }

# ---------- system packages ----------
log "Installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl gnupg ca-certificates rsync nginx python3 python3-venv python3-pip openssl

# ---------- Node.js 24 + yarn 1 (build only) ----------
if ! command -v node >/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]]; then
  log "Installing Node.js 24"
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
command -v yarn >/dev/null || npm install -g yarn@1

# ---------- MongoDB 8.0 (local) ----------
if ! command -v mongod >/dev/null; then
  grep -q avx /proc/cpuinfo || echo "WARNING: CPU lacks AVX — MongoDB 5+ will not start on this machine."
  log "Installing MongoDB 8.0"
  curl -fsSL https://pgp.mongodb.com/server-8.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg --yes
  if [[ "$OS_ID" == "ubuntu" ]]; then
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${CODENAME}/mongodb-org/8.0 multiverse" \
      > /etc/apt/sources.list.d/mongodb-org-8.0.list
  else
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/debian ${CODENAME}/mongodb-org/8.0 main" \
      > /etc/apt/sources.list.d/mongodb-org-8.0.list
  fi
  apt-get update -y
  apt-get install -y mongodb-org
fi
systemctl enable --now mongod

# ---------- app user + files ----------
id "$APP_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR"
if [[ "$SRC_DIR" != "$APP_DIR" ]]; then
  log "Copying app to $APP_DIR"
  rsync -a --delete \
    --exclude '.git' --exclude 'frontend/node_modules' --exclude 'frontend/dist' --exclude 'backend/.venv' \
    --exclude 'backend/.env' --exclude 'tests' --exclude '.emergent' --exclude 'memory' --exclude 'test_reports' \
    --exclude '__pycache__' "$SRC_DIR/" "$APP_DIR/"
fi

# ---------- backend/.env (created once, never overwritten) ----------
ENV_FILE="$APP_DIR/backend/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  log "Creating $ENV_FILE"
  ADMIN_PW="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-20)"
  PUBLIC_HOST="${DOMAIN:-$(curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}')}"
  if [[ -n "$DOMAIN" && -n "$EMAIL" ]]; then SECURE=true; ORIGIN="https://$DOMAIN"; else SECURE=false; ORIGIN="http://$PUBLIC_HOST"; fi
  cat > "$ENV_FILE" <<EOF
MONGO_URL="mongodb://127.0.0.1:27017"
DB_NAME="minershaven"
CORS_ORIGINS="$ORIGIN"
ADMIN_PASSWORD="$ADMIN_PW"
ADMIN_JWT_SECRET="$(openssl rand -hex 32)"
COOKIE_SECURE="$SECURE"
DATA_SOURCE="$DATA_SOURCE"
MININGCORE_API_URL="$MC_URL"
MININGCORE_CACHE_SECONDS="10"
STRATUM_HOST="${STRATUM_HOST:-$PUBLIC_HOST}"
EOF
  NEW_PW="$ADMIN_PW"
fi
chmod 600 "$ENV_FILE"

# ---------- backend venv ----------
log "Installing backend dependencies"
python3 -m venv "$APP_DIR/backend/.venv"
"$APP_DIR/backend/.venv/bin/pip" install --upgrade pip -q
"$APP_DIR/backend/.venv/bin/pip" install -q -r "$APP_DIR/backend/requirements.prod.txt"

# ---------- frontend build ----------
log "Building frontend"
cd "$APP_DIR/frontend"
yarn install --frozen-lockfile --network-timeout 600000
DISABLE_VISUAL_EDITS=true DISABLE_EMERGENT_OVERLAY=true DISABLE_HOT_RELOAD=true yarn build
cd - >/dev/null
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

# ---------- systemd ----------
log "Installing systemd service minershaven-api"
sed -e "s|__APP_DIR__|$APP_DIR|g" -e "s|__APP_USER__|$APP_USER|g" -e "s|__API_PORT__|$API_PORT|g" \
  "$APP_DIR/deploy/minershaven-api.service" > /etc/systemd/system/minershaven-api.service
systemctl daemon-reload
systemctl enable minershaven-api
systemctl restart minershaven-api

# ---------- nginx ----------
log "Configuring nginx"
sed -e "s|__APP_DIR__|$APP_DIR|g" -e "s|__SERVER_NAME__|${DOMAIN:-_}|g" -e "s|__API_PORT__|$API_PORT|g" \
  "$APP_DIR/deploy/nginx.conf" > /etc/nginx/sites-available/minershaven
ln -sf /etc/nginx/sites-available/minershaven /etc/nginx/sites-enabled/minershaven
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 'Nginx Full' >/dev/null || true
fi

# ---------- HTTPS ----------
if [[ -n "$DOMAIN" && -n "$EMAIL" ]]; then
  log "Requesting Let's Encrypt certificate for $DOMAIN"
  apt-get install -y certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" -m "$EMAIL" --agree-tos -n --redirect || echo "certbot failed — check DNS points to this server, then re-run."
fi

# ---------- health ----------
for i in $(seq 30); do curl -fsS "http://127.0.0.1:$API_PORT/api/" >/dev/null && break; sleep 1; done
if curl -fsS "http://127.0.0.1:$API_PORT/api/pool/stats" >/dev/null; then
  log "API healthy"
else
  echo "WARNING: /api/pool/stats failed. If DATA_SOURCE=miningcore, check Miningcore's API is enabled and reachable at $MC_URL."
  echo "         Logs: journalctl -u minershaven-api -n 50"
fi

URL="http://${DOMAIN:-$(hostname -I | awk '{print $1}')}"
if [[ -n "$DOMAIN" && -n "$EMAIL" ]]; then URL="https://$DOMAIN"; fi
log "Done → $URL"
if [[ -n "${NEW_PW:-}" ]]; then log "Admin passkey (save it, shown once): $NEW_PW   — change anytime in $ENV_FILE then: systemctl restart minershaven-api"; fi
