#!/usr/bin/env bash
# One-time install: Python venv with CPU PyTorch + Ultralytics, Node packages, api/.env.
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -d vision/.venv ]; then python3 -m venv vision/.venv; fi
vision/.venv/bin/pip install -q --upgrade pip
vision/.venv/bin/pip install -q torch torchvision --index-url https://download.pytorch.org/whl/cpu
vision/.venv/bin/pip install -q -r vision/requirements.txt
npm install --no-audit --no-fund
npm --prefix api install --no-audit --no-fund
npm --prefix web install --no-audit --no-fund
[ -f api/.env ] || { cp api/.env.example api/.env; sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=Ys$(openssl rand -hex 14)_Q7/" api/.env; }
echo "Готово. Дальше: ./scripts/setup-db.sh (один раз, нужен sudo) и npm run dev"
