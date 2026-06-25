#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  exec sudo bash "$0" "$@"
fi

APP_DIR="/opt/onbidapp"
APP_USER="${SUDO_USER:-ubuntu}"

cd "${APP_DIR}"

echo "==> git pull"
sudo -u "${APP_USER}" git pull --ff-only

echo "==> npm install"
sudo -u "${APP_USER}" npm install

echo "==> build"
sudo -u "${APP_USER}" node scripts/build-prod.mjs

echo "==> restart"
sudo systemctl restart onbidapp
sleep 1
systemctl is-active --quiet onbidapp

echo "✅ 배포 완료 — $(date -Iseconds)"
systemctl status onbidapp --no-pager -l | head -n 12
