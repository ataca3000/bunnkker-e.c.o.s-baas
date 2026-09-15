# BUNKKER E.C.O.S.

ERP/POS local-first para operaciones comerciales, inventario, caja, pickup y entregas con sincronización offline.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ataca3000/bunnkker-e.c.o.s-baas&project-name=bunnkker-ecos)

## Template web para Vercel

Esta instalación ejecuta la superficie web multirol de BUNKKER E.C.O.S. El bridge LAN, Electron, impresora térmica y radio local son módulos opcionales para instalaciones de escritorio; no son necesarios para desplegar el dashboard en Vercel.

Incluye:

- Dashboard multirol para administración, caja, almacén, pickup y reparto.
- Pedidos con estados controlados, tickets digitales y auditoría.
- Mapa de entregas, toma atómica de pedidos y reconciliación offline.
- PWA/service worker para rutas y acciones pendientes sin conexión.
- PostgreSQL con Prisma y configuración lista para Vercel.

## Deploy

1. Pulsa **Deploy with Vercel** o importa este repositorio en Vercel.
2. Selecciona el framework **Next.js**.
3. Configura las variables de `.env.example` en Project Settings → Environment Variables.
4. Conecta una base PostgreSQL y ejecuta la migración Prisma en el entorno de despliegue.
5. Abre `/login` y crea la primera cuenta administrativa desde el flujo de onboarding.

No se incluyen cuentas, productos ni pedidos ficticios. El sistema inicia vacío para que cada instalación configure su propio negocio.

## Desarrollo

```bash
npm install
npm run dev
```

La aplicación web queda en `http://localhost:3000`. Para activar los servicios locales de escritorio usa `npm run dev:desktop`; esos servicios requieren Node/Electron y no forman parte del runtime serverless de Vercel.

## Variables

Copia `.env.example` a tu gestor de secretos. Nunca subas valores reales al repositorio. `DATABASE_URL` e `INTERNAL_API_SECRET` son necesarios para proteger el runtime web; Stripe, Firebase y Redis solo son necesarios si habilitas esos módulos.

## Comandos de validación

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

## Licencia

© 2026 Brecha Soluciones S.A. de C.V. / Luis Felipe Durán Salinas. Todos los derechos reservados.
