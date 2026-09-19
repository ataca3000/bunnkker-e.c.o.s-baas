# 🚀 Guía de Despliegue en Producción (Vercel & Local Edge)

Instrucciones para desplegar BUNKKER E.C.O.S. en Vercel, Docker y Servidores Locales de Sucursal.

## 1. Despliegue en Vercel (Cloud BaaS Mirror)

1. Conecta el repositorio de GitHub en la consola de Vercel.
2. Configura las siguientes Variables de Entorno en el proyecto:
   - `DATABASE_URL`: URL de PostgreSQL (Neon / Supabase con pooling).
   - `DATABASE_URL_UNPOOLED`: Conexión directa a PostgreSQL.
   - `NEXTAUTH_SECRET`: Secreto para tokens JWT.
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`: ID del proyecto Firebase.
3. Ejecutar las migraciones de Prisma en el build command:
   ```bash
   npx prisma migrate deploy && next build
   ```

## 2. Despliegue Local Edge (Servidor de Sucursal / Electron)

Para ejecutar el nodo servidor maestro en una tienda física sin dependencia continua de internet:

```bash
# Iniciar servidor local embebido
npm run start:standalone

# O mediante Docker Compose
docker-compose up -d
```

### Configuración de Red LAN y mDNS
Ejecuta `configurar-red.bat` o `scripts/mdns.js` para habilitar el descubrimiento automático de nodos P2P en el puerto `3000`.
