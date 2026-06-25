#!/usr/bin/env bash
set -euo pipefail

# 에드가공매만 제거 (기존 nginx 사이트는 백업에서 복구 가능)
APP_DIR="/opt/onbidapp"

if [[ "${EUID}" -ne 0 ]]; then
  exec sudo bash "$0" "$@"
fi

echo "==> onbidapp 서비스 중지"
systemctl disable onbidapp 2>/dev/null || true
systemctl stop onbidapp 2>/dev/null || true
rm -f /etc/systemd/system/onbidapp.service
systemctl daemon-reload

echo "==> nginx onbidapp 설정만 제거"
rm -f /etc/nginx/sites-enabled/onbidapp
rm -f /etc/nginx/sites-available/onbidapp

if nginx -t 2>/dev/null; then
  systemctl reload nginx
  echo "✅ nginx reload 완료 (기존 사이트만 남음)"
else
  echo "❌ nginx 설정 오류 — 백업에서 복구하세요:"
  echo "   ls /opt/onbidapp/backups/nginx/"
  echo "   cp -a /opt/onbidapp/backups/nginx/최신폴더/nginx/. /etc/nginx/"
  exit 1
fi

echo ""
echo "에드가공매 앱 파일은 ${APP_DIR} 에 그대로 있습니다."
echo "완전 삭제: rm -rf ${APP_DIR}"
