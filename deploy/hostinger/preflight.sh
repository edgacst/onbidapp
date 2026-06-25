#!/usr/bin/env bash
set -euo pipefail

# 기존 nginx 설정 백업 + 도메인 충돌 검사
# 사용: bash deploy/hostinger/preflight.sh onbid.example.com

DOMAIN="${1:-}"
NGINX_DIR="/etc/nginx"
BACKUP_ROOT="/opt/onbidapp/backups/nginx"

if [[ "${EUID}" -ne 0 ]]; then
  echo "root 로 실행하세요."
  exit 1
fi

if [[ -z "${DOMAIN}" ]] || [[ "${DOMAIN}" == "_" ]]; then
  echo "❌ 전용 서브도메인이 필요합니다. (예: onbid.example.com)"
  echo "   기존 사이트 보호를 위해 IP 단독·default_server 방식은 사용하지 않습니다."
  exit 1
fi

echo "=== 사전 점검: ${DOMAIN} ==="
echo ""

echo "[1] 메모리 / 디스크"
free -h | head -n 2
df -h / | tail -n 1
echo ""

echo "[2] 포트 사용 (80/443/3010)"
ss -tlnp | grep -E ':80 |:443 |:3010 ' || echo "  (3010 비어 있음 — 에드가공매 기본 포트)"
echo ""

echo "[3] 기존 nginx 사이트"
if [[ -d "${NGINX_DIR}/sites-enabled" ]]; then
  ls -la "${NGINX_DIR}/sites-enabled/"
else
  echo "  sites-enabled 없음"
fi
echo ""

echo "[4] server_name 충돌 검사"
CONFLICT=0
while IFS= read -r file; do
  [[ -f "${file}" ]] || continue
  if grep -E "server_name|listen" "${file}" | grep -q "${DOMAIN}"; then
    echo "  ⚠️  충돌 가능: ${file}"
    CONFLICT=1
  fi
done < <(find "${NGINX_DIR}" -type f \( -path "*/sites-enabled/*" -o -path "*/sites-available/*" -o -name "nginx.conf" \) 2>/dev/null)

if [[ "${CONFLICT}" -eq 1 ]]; then
  echo ""
  echo "❌ '${DOMAIN}' 이(가) 기존 nginx 설정에 이미 있습니다."
  echo "   다른 서브도메인을 쓰세요. (예: auction.example.com)"
  exit 1
fi
echo "  ✅ '${DOMAIN}' 충돌 없음"
echo ""

STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="${BACKUP_ROOT}/${STAMP}"
mkdir -p "${DEST}"
cp -a "${NGINX_DIR}/." "${DEST}/" 2>/dev/null || true
echo "[5] nginx 백업 완료: ${DEST}"
echo ""
echo "✅ 사전 점검 통과 — setup-existing.sh 실행 가능"
