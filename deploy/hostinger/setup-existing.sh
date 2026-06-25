#!/usr/bin/env bash
set -euo pipefail

# Hostinger 등 기존 VPS에 사이트가 있을 때 — 에드가공매만 추가
# 사용: bash deploy/hostinger/setup-existing.sh [도메인] [포트]
# 예:   bash deploy/hostinger/setup-existing.sh onbid.example.com 3000
# 도메인 없이 IP 테스트: bash deploy/hostinger/setup-existing.sh _ 3000

APP_DIR="/opt/onbidapp"
DOMAIN="${1:-}"
APP_PORT="${2:-3000}"
REPO_URL="${REPO_URL:-https://github.com/edgacst/onbidapp.git}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "root 로 실행하세요: sudo bash deploy/hostinger/setup-existing.sh [도메인] [포트]"
  exit 1
fi

if [[ -z "${DOMAIN}" ]]; then
  echo "도메인을 넣으세요. IP 테스트만 할 때는 _ 를 사용합니다."
  echo "  bash deploy/hostinger/setup-existing.sh onbid.example.com 3000"
  exit 1
fi

if ss -tln | grep -q ":${APP_PORT} "; then
  if ! systemctl is-active --quiet onbidapp 2>/dev/null; then
    echo "❌ 포트 ${APP_PORT} 이(가) 이미 다른 프로그램이 사용 중입니다."
    echo "   다른 포트로 다시 실행: bash deploy/hostinger/setup-existing.sh ${DOMAIN} 3001"
    ss -tlnp | grep ":${APP_PORT} " || true
    exit 1
  fi
fi

echo "==> 필수 패키지 확인"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git curl nginx certbot python3-certbot-nginx

if ! command -v node >/dev/null 2>&1 || [[ "$(node -p process.versions.node.split('.')[0])" -lt 20 ]]; then
  echo "==> Node.js 20 설치"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v
npm -v

mkdir -p "${APP_DIR}"

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "==> 저장소 클론"
  git clone "${REPO_URL}" "${APP_DIR}"
else
  echo "==> 저장소 이미 있음 — pull"
  git -C "${APP_DIR}" pull --ff-only
fi

cd "${APP_DIR}"

if [[ ! -f "${APP_DIR}/.env" ]]; then
  cp deploy/oracle/env.production.example .env
  echo ""
  echo "⚠️  ${APP_DIR}/.env 에 ONBID_SERVICE_KEY 를 넣은 뒤 다시 실행하세요:"
  echo "    nano ${APP_DIR}/.env"
  echo "    bash deploy/hostinger/setup-existing.sh ${DOMAIN} ${APP_PORT}"
  exit 0
fi

if ! grep -q '^ONBID_SERVICE_KEY=.\+' .env 2>/dev/null; then
  echo "⚠️  .env 의 ONBID_SERVICE_KEY 가 비어 있습니다."
  echo "    nano ${APP_DIR}/.env"
  exit 1
fi

if ! grep -q '^PORT=' .env 2>/dev/null; then
  echo "PORT=${APP_PORT}" >> .env
else
  sed -i "s/^PORT=.*/PORT=${APP_PORT}/" .env
fi

mkdir -p logs

echo "==> npm install + build"
npm install
node scripts/build-prod.mjs

echo "==> systemd (onbidapp)"
cp deploy/hostinger/onbidapp.service /etc/systemd/system/onbidapp.service
systemctl daemon-reload
systemctl enable onbidapp
systemctl restart onbidapp
sleep 1
systemctl is-active --quiet onbidapp

echo "==> nginx 사이트 추가만 (기존 사이트 유지)"
if [[ "${DOMAIN}" == "_" ]]; then
  SERVER_NAME="_"
else
  SERVER_NAME="${DOMAIN}"
fi

sed -e "s/__DOMAIN__/${SERVER_NAME}/g" -e "s/__PORT__/${APP_PORT}/g" \
  deploy/hostinger/nginx-onbidapp.conf > /etc/nginx/sites-available/onbidapp

ln -sf /etc/nginx/sites-available/onbidapp /etc/nginx/sites-enabled/onbidapp

echo "==> nginx 설정 검사"
nginx -t
systemctl reload nginx

if [[ "${DOMAIN}" != "_" ]]; then
  echo "==> SSL 발급 (${DOMAIN})"
  CERTBOT_ARGS=(--nginx -d "${DOMAIN}" --non-interactive --agree-tos --redirect)
  if [[ -n "${CERTBOT_EMAIL}" ]]; then
    CERTBOT_ARGS+=(-m "${CERTBOT_EMAIL}")
  else
    CERTBOT_ARGS+=(--register-unsafely-without-email)
  fi
  certbot "${CERTBOT_ARGS[@]}" || {
    echo "certbot 실패 — DNS가 이 서버 IP를 가리키는지 확인 후:"
    echo "  certbot --nginx -d ${DOMAIN}"
  }
fi

echo ""
echo "✅ 에드가공매 추가 완료 (기존 사이트는 그대로)"
echo "   상태: systemctl status onbidapp"
echo "   로그: tail -f ${APP_DIR}/logs/server.log"
if [[ "${DOMAIN}" != "_" ]]; then
  echo "   URL:  https://${DOMAIN}"
else
  echo "   URL:  http://$(curl -fsSL https://ifconfig.me 2>/dev/null || echo '공인IP'):80 (server_name _)"
fi
echo "   업데이트: bash ${APP_DIR}/deploy/oracle/update-app.sh"
