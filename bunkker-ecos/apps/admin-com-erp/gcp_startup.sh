#!/bin/bash
# Script de Inicio (Startup Script) para Google Cloud Console (Compute Engine)
# Esto instalará Docker, Caddy y Next.js en la VM automáticamente.

echo "Iniciando instalación de Infraestructura Dual (Lanzador + ERP)..."

# 1. Actualizar sistema e instalar dependencias
apt-get update
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl git ca-certificates gnupg

# 2. Instalar NodeJS (v20) y npm
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2

# 3. Instalar Caddy Server (para HTTPS automático)
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy

# 4. Configurar Caddy para Enrutamiento Dual
cat << 'EOF' > /etc/caddy/Caddyfile
{
    on_demand_tls {
        ask http://localhost:3000/api/tls-check
        interval 2m
        burst 5
    }
}

# 1. Tráfico del Lanzador SaaS (Apunta al puerto 3001)
admin.com, www.admin.com {
    reverse_proxy localhost:3001
}

# 2. Tráfico de Inquilinos ERP (Wildcards y Dominios Personalizados apuntan al puerto 3000)
https:// {
    tls {
        on_demand
    }
    reverse_proxy localhost:3000
}
EOF

# Reiniciar Caddy con la nueva configuración
systemctl restart caddy

# 5. Desplegar los Repositorios
mkdir -p /var/www
cd /var/www

# --- A) Desplegar ERP (admin.com) ---
git clone https://github.com/ataca3000/admin.com.erp.git
cd admin.com.erp
npm install
npm run build
pm2 start npm --name "erp-node-3000" -- run start -- -p 3000
cd ..

# --- B) Desplegar Lanzador (admin-launcher) ---
# ¡Asegúrate de haber subido tu admin-launcher a este repositorio!
git clone https://github.com/ataca3000/admin-launcher.git
cd admin-launcher
npm install
npm run build
pm2 start npm --name "launcher-node-3001" -- run start -- -p 3001
cd ..

# Guardar estado de PM2 para reinicios automáticos
pm2 save
pm2 startup

echo "¡Infraestructura Dual configurada exitosamente!"
