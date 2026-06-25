#!/usr/bin/env bash
set -euo pipefail

# Oracle Cloud Ubuntu VM 최초 1회 설정
# 사용: bash deploy/oracle/setup-vm.sh [도메인]
# 예:   bash deploy/oracle/setup-vm.sh onbid.example.com

APP_DIR="/opt/onbidapp"
APP_USER="${SUDO_USER:-ubuntu}"
DOMAIN="${1:-}"
REPO_URL="${REPO_URL:-https://github.com/edgacst/onbidapp.git}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "root 권한이 필요합니다: sudo bash deploy/oracle/setup-vm.sh [도메인]"
  exit 1
fi

echo "==> 패키지 업데이트"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

echo "==> 기본 도구 설치"
apt-get install -y curl git nginx ufw certbot python3-certbot-nginx

echo "==> Node.js 20 설치"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -p process.versions.node.split('.')[0])" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

echo "==> 방화벽 (ufw)"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

echo "==> 앱 디렉터리 준비: ${APP_DIR}"
mkdir -p "${APP_DIR}"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "==> 저장소 클론"
  sudo -u "${APP_USER}" git clone "${REPO_URL}" "${APP_DIR}"
else
  echo "==> 저장소 이미 있음 (${APP_DIR})"
fi

echo "==> npm 의존성 설치"
sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}' && npm install"

if [[ ! -f "${APP_DIR}/.env" ]]; then
  cp "${APP_DIR}/deploy/oracle/env.production.example" "${APP_DIR}/.env"
  chown "${APP_USER}:${APP_USER}" "${APP_DIR}/.env"
  echo ""
  echo "⚠️  ${APP_DIR}/.env 를 편집해 ONBID_SERVICE_KEY 를 넣으세요:"
  echo "    nano ${APP_DIR}/.env"
  echo ""
fi

mkdir -p "${APP_DIR}/logs"
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}/logs"

echo "==> 프로덕션 빌드"
sudo -u "${APP_USER}" bash -lc "cd '${APP_DIR}' && node scripts/build-prod.mjs"

echo "==> systemd 서비스 등록"
cp "${APP_DIR}/deploy/oracle/onbidapp.service" /etc/systemd/system/onbidapp.service
systemctl daemon-reload
systemctl enable onbidapp
systemctl restart onbidapp

if [[ -n "${DOMAIN}" ]]; then
  echo "==> nginx + SSL (${DOMAIN})"
  sed "s/__DOMAIN__/${DOMAIN}/g" "${APP_DIR}/deploy/oracle/nginx-onbidapp.conf" > /etc/nginx/sites-available/onbidapp
  ln -sf /etc/nginx/sites-available/onbidapp /etc/nginx/sites-enabled/onbidapp
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx
  CERTBOT_ARGS=(--nginx -d "${DOMAIN}" --non-interactive --agree-tos --redirect)
  if [[ -n "${CERTBOT_EMAIL}" ]]; then
    CERTBOT_ARGS+=(-m "${CERTBOT_EMAIL}")
  else
    CERTBOT_ARGS+=(--register-unsafely-without-email)
  fi
  if ! certbot "${CERTBOT_ARGS[@]}"; then
    echo "certbot 자동 발급 실패 — 이메일/도메인 DNS 확인 후 수동 실행:"
    echo "  sudo certbot --nginx -d ${DOMAIN}"
  fi
else
  echo "==> 도메인 없음 — IP로만 접속 (HTTP)"
  cat > /etc/nginx/sites-available/onbidapp <<'NGINX'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX
  ln -sf /etc/nginx/sites-available/onbidapp /etc/nginx/sites-enabled/onbidapp
  rm -f /etc/nginx/sites-enabled/default
  nginx -t
  systemctl reload nginx
fi

echo ""
echo "✅ VM 설정 완료"
echo "   서비스 상태: systemctl status onbidapp"
echo "   로그:         tail -f ${APP_DIR}/logs/server.log"
if [[ -n "${DOMAIN}" ]]; then
  echo "   접속 URL:     https://${DOMAIN}"
else
  PUBLIC_IP="$(curl -fsSL https://ifconfig.me || true)"
  echo "   접속 URL:     http://${PUBLIC_IP:-공인IP}"
  echo "   ※ Oracle 콘솔 → VCN 보안 목록에서 TCP 80, 443 인바운드 허용 확인"
fi
echo "   코드 업데이트: bash ${APP_DIR}/deploy/oracle/update-app.sh"
