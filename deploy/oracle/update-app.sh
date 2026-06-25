#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  exec sudo bash "$0" "$@"
fi

APP_DIR="/opt/onbidapp"
APP_USER="${SUDO_USER:-root}"

if [[ "${APP_USER}" == "root" ]] || [[ "$(id -u)" -eq 0 && -z "${SUDO_USER:-}" ]]; then
  RUN_AS=()
else
  RUN_AS=(sudo -u "${APP_USER}")
fi

cd "${APP_DIR}"

echo "==> git pull"
"${RUN_AS[@]}" git pull --ff-only

echo "==> npm install"
"${RUN_AS[@]}" npm install

echo "==> build"
"${RUN_AS[@]}" node scripts/build-prod.mjs

echo "==> restart"
sudo systemctl restart onbidapp
sleep 1
systemctl is-active --quiet onbidapp

echo "✅ 배포 완료 — $(date -Iseconds)"
systemctl status onbidapp --no-pager -l | head -n 12
