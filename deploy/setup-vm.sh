#!/usr/bin/env bash
# =====================================================================
#  Instalación completa de Sede Café en una VM Ubuntu 22.04 / 24.04
#  (Azure, IBM Cloud o cualquier servidor Linux)
#
#  Uso, dentro de la carpeta del proyecto ya clonado:
#      bash deploy/setup-vm.sh
#
#  Qué hace:
#   1. Instala Node.js 22, PostgreSQL, Nginx, Git y PM2
#   2. Crea la base de datos y su usuario con una contraseña aleatoria
#   3. Genera backend/.env automáticamente
#   4. Instala dependencias, compila el frontend, crea tablas y datos demo
#   5. Arranca la app con PM2 y la publica en el puerto 80 con Nginx
# =====================================================================
set -euo pipefail

DIR_PROYECTO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_NOMBRE="sede_cafe"
DB_USUARIO="sedecafe"

paso() { echo -e "\n\033[1;33m==> $1\033[0m"; }

cd "$DIR_PROYECTO"

paso "1/7 Actualizando paquetes del sistema"
sudo apt-get update -y
sudo apt-get install -y curl git nginx postgresql postgresql-contrib openssl ca-certificates

# Las VM pequeñas (B1s, 1 GB de RAM) pueden quedarse sin memoria al compilar.
if [ "$(free -m | awk '/Mem:/ {print $2}')" -lt 2000 ] && ! swapon --show | grep -q /swapfile; then
  paso "Creando 2 GB de memoria swap (la VM tiene poca RAM)"
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab > /dev/null
fi

paso "2/7 Instalando Node.js 22 y PM2"
if ! command -v node > /dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
sudo npm install -g pm2
node -v && npm -v

paso "3/7 Configurando PostgreSQL"
sudo systemctl enable --now postgresql
if [ -f backend/.env ]; then
  echo "backend/.env ya existe: se conserva (no se cambia la contraseña)."
else
  DB_PASSWORD="$(openssl rand -hex 16)"
  if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USUARIO}'" | grep -q 1; then
    sudo -u postgres psql -c "ALTER USER ${DB_USUARIO} WITH PASSWORD '${DB_PASSWORD}';"
  else
    sudo -u postgres psql -c "CREATE USER ${DB_USUARIO} WITH PASSWORD '${DB_PASSWORD}';"
  fi
  if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NOMBRE}'" | grep -q 1; then
    sudo -u postgres psql -c "CREATE DATABASE ${DB_NOMBRE} OWNER ${DB_USUARIO};"
  fi

  paso "4/7 Generando backend/.env"
  cat > backend/.env <<EOF
DATABASE_URL="postgres://${DB_USUARIO}:${DB_PASSWORD}@localhost:5432/${DB_NOMBRE}"
JWT_SECRET="$(openssl rand -hex 32)"
JWT_EXPIRES_IN="8h"
PORT=3000
NODE_ENV=production
EOF
  chmod 600 backend/.env
fi

paso "5/7 Instalando dependencias y compilando el frontend"
npm ci --prefix backend --omit=dev
npm ci --prefix frontend
npm run build --prefix frontend

paso "6/7 Creando tablas y cargando datos de demostración"
npm run db:init --prefix backend
npm run db:seed --prefix backend

paso "7/7 Arrancando con PM2 y configurando Nginx"
pm2 delete sede-cafe > /dev/null 2>&1 || true
pm2 start ecosystem.config.cjs
pm2 save
sudo env PATH="$PATH" pm2 startup systemd -u "$USER" --hp "$HOME" > /dev/null

sudo cp deploy/nginx-sede-cafe.conf /etc/nginx/sites-available/sede-cafe
sudo ln -sf /etc/nginx/sites-available/sede-cafe /etc/nginx/sites-enabled/sede-cafe
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

sleep 2
IP_PUBLICA="$(curl -s --max-time 5 https://ifconfig.me || echo 'TU_IP_PUBLICA')"
echo
echo "Prueba local: $(curl -s http://localhost/api/health || echo 'sin respuesta')"
echo
echo -e "\033[1;32m¡Listo! Abre en tu navegador:  http://${IP_PUBLICA}\033[0m"
echo "Usuarios demo (contraseña SedeCafe2026): admin@sedecafe.com, almacen@sedecafe.com, centro@sedecafe.com"
echo "Recuerda abrir el puerto 80 (HTTP) en el grupo de seguridad de red de la VM."
