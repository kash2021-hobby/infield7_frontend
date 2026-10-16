#!/usr/bin/env bash
# Pull is on you. This rebuilds and restarts this website only.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm ci
npm run build
sudo systemctl restart infield7-web
echo "Website updated. journalctl -u infield7-web -f"
