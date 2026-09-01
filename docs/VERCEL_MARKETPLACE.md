# BUNKKER E.C.O.S. — Template para Vercel

BUNKKER E.C.O.S. es un ERP/POS local-first para comercios que necesitan operar sin depender de Internet y sincronizar cuando la conectividad vuelve.

## Propuesta

- Operación local con SQLite/Prisma y bridge LAN.
- Dashboard multirol para administración, ventas, inventario, reparto y facturación.
- Radio interna por Wi‑Fi en el puerto 3002.
- Billing de suscripciones mediante Stripe Checkout y webhooks.
- Despliegue cloud en Vercel con PostgreSQL/Neon.

## Deploy to Vercel

1. Importa el repositorio en Vercel.
2. Configura `DATABASE_URL` con PostgreSQL/Neon.
3. Configura Firebase Admin y `INTERNAL_API_SECRET`.
4. Añade Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` y Price IDs.
5. Ejecuta `prisma migrate deploy` durante el proceso de preparación de la base.
6. Configura el webhook de Stripe hacia `/api/stripe/webhook`.

## Suscripciones

El template separa tres niveles de producto: Local, Híbrido y Enterprise. El servidor valida que el Price ID solicitado esté configurado; el cliente no puede enviar precios ni alterar el importe. Enterprise queda como plan de contacto hasta disponer de un precio y condiciones comerciales aprobadas.

## Bridge Windows

En el PC servidor, copia `.env.example` a `.env.local`, establece la IP LAN del equipo y ejecuta:

```powershell
npm install
npm run bridge:windows
```

La radio queda disponible en `http://IP_DEL_PC:3002` y el diagnóstico en `/health`. No expongas el puerto 3002 directamente a Internet; utiliza una VPN o relay autenticado si necesitas acceso remoto.

## Estado de robustez

El núcleo tiene una buena base funcional, pero debe considerarse production-ready únicamente después de verificar las variables del entorno, migraciones PostgreSQL, webhook firmado, backups y pruebas de integración. Los fallbacks de demo/local deben mantenerse fuera de producción.

© 2026 Brecha Soluciones S.A. de C.V. / Luis Felipe Durán Salinas.
