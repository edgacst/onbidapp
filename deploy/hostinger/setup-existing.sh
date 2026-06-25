#!/usr/bin/env bash
set -euo pipefail

# Hostinger 기존 VPS — 기존 사이트에 영향 없이 에드가공매만 추가
#
# 사용:
#   bash deploy/hostinger/preflight.sh onbid.example.com
#   bash deploy/hostinger/setup-existing.sh onbid.example.com
#
# 앱만 먼저 (nginx 건드리지 않음):
#   APP_ONLY=1 bash deploy/hostinger/setup-existing.sh onbid.example.com
#
# nginx 추가 (SSL 제외):
#   SKIP_SSL=1 bash deploy/hostinger/setup-existing.sh onbid.example.com

APP_DIR="/opt/onbidapp"
DOMAIN="${1:-}"
APP_PORT="${2:-3010}"
REPO_URL="${REPO_URL:-https://github.com/edgacst/onbidapp.git}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
APP_ONLY="${APP_ONLY:-0}"
SKIP_SSL="${SKIP_SSL:-0}"
SKIP_NGINX="${SKIP_NGINX:-0}"
NGINX_DIR="/etc/nginx"
BACKUP_ROOT="/opt/onbidapp/backups/nginx"

abort() {
  echo "❌ $*"
  exit 1
}

backup_nginx() {
  local stamp dest
  stamp="$(date +%Y%m%d-%H%M%S)"
  dest="${BACKUP_ROOT}/${stamp}"
  mkdir -p "${dest}"
  cp -a "${NGINX_DIR}/." "${dest}/"
  echo "${dest}" > "${BACKUP_ROOT}/.latest"
  echo "==> nginx 백업: ${dest}"
}

restore_nginx_latest() {
  local latest="${BACKUP_ROOT}/.latest"
  [[ -f "${latest}" ]] || return 1
  local dir
  dir="$(cat "${latest}")"
  cp -a "${dir}/." "${NGINX_DIR}/"
  nginx -t
  systemctl reload nginx
}

nginx_domain_conflict() {
  local domain="$1"
  local file
  while IFS= read -r file; do
    [[ -f "${file}" ]] || continue
    if grep -q "${domain}" "${file}"; then
      return 0
    fi
  done < <(find "${NGINX_DIR}" -type f \( -path "*/sites-enabled/*" -o -path "*/sites-available/*" \) 2>/dev/null)
  return 1
}

if [[ "${EUID}" -ne 0 ]]; then
  abort "root 로 실행하세요."
fi

if [[ -z "${DOMAIN}" ]] || [[ "${DOMAIN}" == "_" ]]; then
  abort "전용 서브도메인이 필요합니다. 예: onbid.example.com (IP/default 방식 금지)"
fi

if [[ "${APP_ONLY}" != "1" && "${SKIP_NGINX}" != "1" ]]; then
  if nginx_domain_conflict "${DOMAIN}"; then
    abort "'${DOMAIN}' 이(가) 기존 nginx에 이미 있습니다. 다른 서브도메인을 쓰세요."
  fi
fi

if ss -tln | grep -q ":${APP_PORT} "; then
  if ! systemctl is-active --quiet onbidapp 2>/dev/null; then
    abort "포트 ${APP_PORT} 사용 중. 다른 포트: bash $0 ${DOMAIN} 3011"
  fi
fi

echo "==> 패키지 (upgrade 없음 — 기존 서비스 영향 최소화)"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y git curl

if ! command -v node >/dev/null 2>&1; then
  echo "==> Node.js 20 설치"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
elif [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]]; then
  echo "==> Node.js 20 설치"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
node -v

mkdir -p "${APP_DIR}"
if [[ ! -d "${APP_DIR}/.git" ]]; then
  git clone "${REPO_URL}" "${APP_DIR}"
else
  git -C "${APP_DIR}" pull --ff-only
fi

cd "${APP_DIR}"

if [[ ! -f .env ]] || ! grep -q '^ONBID_SERVICE_KEY=.\+' .env 2>/dev/null; then
  [[ -f .env ]] || cp deploy/oracle/env.production.example .env
  echo ""
  echo "⚠️  nano ${APP_DIR}/.env  → ONBID_SERVICE_KEY 입력 후 다시 실행"
  exit 0
fi

if grep -q '^PORT=' .env; then
  sed -i "s/^PORT=.*/PORT=${APP_PORT}/" .env
else
  echo "PORT=${APP_PORT}" >> .env
fi

mkdir -p logs
npm install
node scripts/build-prod.mjs

echo "==> systemd (onbidapp — 포트 ${APP_PORT}만 사용, 80/443 미사용)"
cp deploy/hostinger/onbidapp.service /etc/systemd/system/onbidapp.service
systemctl daemon-reload
systemctl enable onbidapp
systemctl restart onbidapp
sleep 1
systemctl is-active --quiet onbidapp

echo "==> 앱 단독 확인"
curl -fsS "http://127.0.0.1:${APP_PORT}/" | head -n 3 || abort "앱이 ${APP_PORT}에서 응답하지 않습니다."

if [[ "${APP_ONLY}" == "1" || "${SKIP_NGINX}" == "1" ]]; then
  echo ""
  echo "✅ 앱만 설치 완료 (nginx 미변경 — 기존 사이트 100% 동일)"
  echo "   내부 테스트: curl http://127.0.0.1:${APP_PORT}/"
  echo "   nginx 연결:   SKIP_NGINX=0 bash deploy/hostinger/setup-existing.sh ${DOMAIN} ${APP_PORT}"
  exit 0
fi

if ! command -v nginx >/dev/null 2>&1; then
  apt-get install -y nginx
fi

backup_nginx

echo "==> nginx: onbidapp 파일만 추가 (기존 파일 수정/삭제 없음)"
sed -e "s/__DOMAIN__/${DOMAIN}/g" -e "s/__PORT__/${APP_PORT}/g" \
  deploy/hostinger/nginx-onbidapp.conf > /etc/nginx/sites-available/onbidapp

if [[ -e /etc/nginx/sites-enabled/onbidapp ]]; then
  abort "sites-enabled/onbidapp 이 이미 있습니다. rollback.sh 후 재시도"
fi

ln -s /etc/nginx/sites-available/onbidapp /etc/nginx/sites-enabled/onbidapp

if ! nginx -t; then
  echo "❌ nginx 검사 실패 — 백업 복구 중"
  rm -f /etc/nginx/sites-enabled/onbidapp
  rm -f /etc/nginx/sites-available/onbidapp
  restore_nginx_latest || true
  abort "nginx 설정을 롤백했습니다. 기존 사이트는 변경 전 상태입니다."
fi

systemctl reload nginx
echo "==> nginx reload 완료 (기존 server 블록은 수정하지 않음)"

if [[ "${SKIP_SSL}" != "1" ]]; then
  if ! command -v certbot >/dev/null 2>&1; then
    apt-get install -y certbot python3-certbot-nginx
  fi
  echo "==> SSL (${DOMAIN} — onbidapp 설정만 수정)"
  CERTBOT_ARGS=(certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --redirect)
  if [[ -n "${CERTBOT_EMAIL}" ]]; then
    CERTBOT_ARGS+=(-m "${CERTBOT_EMAIL}")
  else
    CERTBOT_ARGS+=(--register-unsafely-without-email)
  fi
  if ! "${CERTBOT_ARGS[@]}"; then
    echo "⚠️  SSL 실패 — HTTP는 동작할 수 있음. 나중에:"
    echo "   certbot --nginx -d ${DOMAIN}"
  fi
  if ! nginx -t; then
    echo "❌ certbot 후 nginx 오류 — 백업 복구"
    restore_nginx_latest
    abort "nginx 백업 복구 완료"
  fi
  systemctl reload nginx
fi

echo ""
echo "✅ 완료 — 기존 사이트 nginx 파일은 건드리지 않았습니다"
echo "   백업: $(cat "${BACKUP_ROOT}/.latest" 2>/dev/null || echo '없음')"
echo "   URL:  https://${DOMAIN}"
echo "   롤백: bash ${APP_DIR}/deploy/hostinger/rollback.sh"
