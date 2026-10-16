#!/usr/bin/env bash
# Install this website as its own systemd service. Run from this folder on the VPS:
#   sudo bash deploy/install.sh
# Does not change ufw and does not stop any other app.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN_USER="${SUDO_USER:-$(whoami)}"

if [[ ! -f "$ROOT/.env.production" ]]; then
  cp "$ROOT/.env.example" "$ROOT/.env.production"
  chown "$RUN_USER" "$ROOT/.env.production"
  echo "Created $ROOT/.env.production from the example."
  echo "Set NEXT_PUBLIC_API_URL to the public API URL, then run this again so the site can build."
  exit 1
fi

echo "==> npm ci && build"
sudo -u "$RUN_USER" bash -c "cd '$ROOT' && npm ci && npm run build"

echo "==> systemd"
sed -e "s#__ROOT__#${ROOT}#g" -e "s#__USER__#${RUN_USER}#g" \
  "$ROOT/deploy/infield7-web.service" > /etc/systemd/system/infield7-web.service
systemctl daemon-reload
systemctl enable infield7-web
systemctl restart infield7-web

echo
echo "Web service: systemctl status infield7-web"
echo "Add deploy/nginx.conf to your existing Nginx, then reload Nginx."
