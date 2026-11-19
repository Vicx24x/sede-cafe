#!/usr/bin/env bash
# Actualiza la app en la VM después de subir cambios a GitHub.
#   bash deploy/actualizar.sh                    -> trae cambios y reinicia (conserva los datos)
#   bash deploy/actualizar.sh --reiniciar-datos  -> además BORRA la base y carga los datos de demostración
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

git pull
npm ci --prefix backend --omit=dev
npm ci --prefix frontend
npm run build --prefix frontend

if [ "${1:-}" = "--reiniciar-datos" ]; then
  echo "Reiniciando la base de datos con los datos de demostración..."
  npm run db:reset --prefix backend
else
  npm run db:init --prefix backend
fi

pm2 restart sede-cafe
sleep 2
echo "Actualizado: $(curl -s http://localhost/api/health)"
