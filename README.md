# BUNKKER E.C.O.S.

**Ecosistema Comercial Omnipotente Sincronizado** — ERP/POS local-first para negocios físicos.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/ataca3000/bunnkker-e.c.o.s-baas&project-name=bunnkker-ecos)
[![License: BSL 1.1](https://img.shields.io/badge/License-BSL_1.1-yellow.svg)](./LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black)](https://nextjs.org/)
[![Electron](https://img.shields.io/badge/Electron-Desktop-47848F)](https://www.electronjs.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748)](https://www.prisma.io/)

🔗 **Demo en vivo:** [bunnkker-e-c-o-s-baas.vercel.app](https://bunnkker-e-c-o-s-baas.vercel.app/)

---

## Qué es

Sistema completo para operar un negocio físico (ferretería, abarrotes, distribuidora) desde múltiples terminales conectadas por WiFi local. Funciona sin internet. Cuando hay conexión, sincroniza con la nube automáticamente.

## Qué hace

- **Punto de Venta (POS)** con cobro en efectivo, tarjeta y multimoneda
- **Inventario** con ubicación física por estante/fila y drag & drop
- **8 roles de acceso** (dueño, gerente, cajero, bodeguero, chofer, patio, marketing, mostrador)
- **Sincronización P2P** entre cajas por red WiFi/LAN sin servidor externo
- **Funciona offline** — cada terminal tiene su base de datos SQLite local
- **Auditoría cifrada** de cada operación con AES-256
- **Facturación CFDI** (México) vía Facturapi
- **Backup automático** a USB cifrado cuando se conecta una llave física
- **Marketing** con publicación coordinada en 16 redes sociales (OMNIPULSE)
- **B2B entre sucursales** — una tienda puede pedir stock a otra automáticamente
- **IA local** que recomienda ajustes de precios por rotación de inventario

## Stack técnico

| Capa | Tecnología |
|---|---|
| Frontend + API | Next.js 15 + React 19 |
| Base de datos nube | Supabase (PostgreSQL) |
| Base de datos local | SQLite vía Prisma |
| Desktop | Electron (Windows .exe) |
| Sync P2P | Socket.IO + mDNS |
| Pagos | Stripe + MercadoPago |
| Facturación | Facturapi (CFDI México) |

## Cómo funciona la red local

```
Terminal Maestro (arranca servidor)
├── Caja 1 (se conecta por WiFi)
├── Caja 2 (se conecta por WiFi)
└── Bodega  (se conecta por WiFi)
```

El maestro corre Next.js en puerto 3000 y el radio server en 3001/3002. Los nodos simplemente abren el navegador apuntando al IP del maestro. Se detectan automáticamente por mDNS.

## Roles y acceso

| PIN | Rol | Dashboard |
|---|---|---|
| 0000 | Dueño (superadmin) | Panel completo con KPIs, IA y control total |
| 1111 | Gerente (admin) | Igual que dueño sin demo/suscripción |
| 2222 | Cajero (sales) | POS con carrito, cobro y corte de caja |
| 3333 | Bodeguero (inventory) | Inventario, estanterías, merma, import/export Excel |
| 4444 | Marketing | Branding, OMNIPULSE, editor de tienda, QR |
| 5555 | Chofer (driver) | Entregas, rutas GPS, confirmación por PIN |
| 6666 | Patio (carga/descarga) | Cola de carga, bahías, tiempos |
| 7777 | Mostrador (pickup) | Ventanillas y cajones de recolección |

Los PINs son de fábrica. Al primer uso, el sistema pide cambiarlos.

## Instalación local (desarrollo)

```bash
# Clonar
git clone https://github.com/ataca3000/bunnkker-e.c.o.s-baas.git
cd bunnkker-e.c.o.s-baas

# Instalar dependencias
npm install --legacy-peer-deps

# Configurar base de datos local
cp .env.example .env.local
# Editar .env.local con tu DATABASE_URL de Supabase o SQLite

# Generar cliente Prisma
npx prisma generate

# Sembrar datos de prueba
npm run db:seed

# Arrancar (Next.js + Radio Server)
npm run dev
```

## Deploy en Vercel

1. Conectar el repo en [vercel.com](https://vercel.com)
2. Configurar variables de entorno:
   - `DATABASE_URL` — URL de Supabase PostgreSQL
   - `INTERNAL_API_SECRET` — clave secreta para firmas HMAC
   - `COOKIE_SECRET` — secreto para cookies de sesión
3. Deploy automático en cada push a `main`

## Empaquetar como .exe (Windows)

```bash
npm run build:standalone
npm run dist:win
```

Genera un instalador NSIS en la carpeta `dist/`.

## Estructura principal

```
├── src/
│   ├── app/                  # Páginas y API routes (Next.js App Router)
│   │   ├── login/            # Login dual (cliente + staff)
│   │   ├── dashboard/        # Dashboards por rol (sales, inventory, etc.)
│   │   └── api/              # Endpoints REST
│   ├── components/dashboard/ # Componentes Worker por rol
│   ├── lib/                  # Servicios core
│   │   ├── ai/               # Motor IA local (engine + balanceEffect)
│   │   ├── omnipulse/        # Marketing 16 redes sociales
│   │   ├── audit.ts          # Auditoría cifrada AES-256
│   │   ├── localSync.ts      # Sync offline WAL + mDNS
│   │   ├── prisma.ts         # Cliente Prisma (PostgreSQL/SQLite)
│   │   └── redis.ts          # Redis con fallback en memoria
│   └── context/              # AuthContext (polling cada 10s)
├── prisma/
│   ├── schema.prisma         # 13 modelos (PostgreSQL)
│   └── seed.js               # Datos de prueba
├── electron-main.js          # Ciclo de vida Electron (maestro/nodo)
├── radio-server.js           # Sync P2P (:3001) + Radio voz (:3002)
└── preload.js                # Bridge IPC Electron
```

## Documentación técnica

Los documentos de arquitectura y registro están en el directorio `docs/`:

- [Memoria Técnica INDAUTOR](./docs/BUNKKER_ECOS_MEMORIA_TECNICA_INDAUTOR.md)
- [Arquitectura del Sistema](./docs/ARCHITECTURE.md)
- [Mapa de Funcionalidad](./docs/FUNCTIONALITY_MAP.md)
- [Mapa de Roles](./docs/ROLES_MAP.md)
- [Políticas de Seguridad](./docs/SECURITY.md)

---

## Licencia

**Business Source License 1.1** — Puedes ver, modificar y probar el código libremente. Uso en producción requiere licencia comercial. Ver [LICENSE](./LICENSE) para detalles.

Se convierte automáticamente en Apache 2.0 el 14 de septiembre de 2030.

---

© 2026 **Luis Felipe Durán Salinas (Philip Durán) / Brecha Soluciones S.A. de C.V.**  
Todos los derechos reservados. Obra registrada ante INDAUTOR — México.
