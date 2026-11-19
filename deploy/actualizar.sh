#!/usr/bin/env bash
# Actualiza la app en la VM después de subir cambios a GitHub.
#   bash deploy/actualizar.sh
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

git pull
npm ci --prefix backend --omit=dev
npm ci --prefix frontend
npm run build --prefix frontend
npm run db:init --prefix backend
pm2 restart sede-cafe
echo "Actualizado: $(curl -s http://localhost/api/health)"
