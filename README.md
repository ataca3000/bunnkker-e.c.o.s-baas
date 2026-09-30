# BUNKKER E.C.O.S.
<img width="1279" height="591" alt="Captura de pantalla 2026-09-14 214300" src="https://github.com/user-attachments/assets/66e4bd2b-df7f-4fdc-82f0-052160a21d22" />

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
- **Plataforma de Administración y Operación:** Catálogo virtual local sin filas, sync híbrido bidireccional y multi-dispositivo LAN.
- **Acceso Multi-Dispositivo LAN (Wi-Fi Local):** Protocolo dinámico HTTP/HTTPS para que cualquier celular (iOS/Android), tablet o laptop en la red local (`http://192.168.x.x:3000`) ingrese por PIN sin rechazo de cookies.
- **Cola de Trabajo por Rol & Pizarrón Público (Kanban):** Sistema de colas por rol (Cajero, Almacén, Chofer, Patio) con reclamo exclusivo (*Lock-Claim*) y liberación/delegación instantánea en 1-click (*release_order*).
- **Reserva de Inventario con TTL de 30 Minutos:** Los productos en el carrito reservan stock en vivo con temporizador de expiración automática de 30 minutos.
- **Punto de Venta (POS):** Cobro en efectivo, tarjeta (Stripe/MercadoPago), corte de caja e inspección opcional de transferencias.
- **Licenciamiento 1 PC Maestro = 1 Tienda:** Licencia atada al HWID físico de la máquina con gateways QR dedicados por rol.
- **Asistente Oficial:** Mascota **Lion - Tu Gerente de Sucursal** en login, onboarding y barra de aplicación.
- **Inventario:** Ubicación física por estante/fila y drag & drop.
- **Sincronización P2P:** Entre cajas por red WiFi/LAN sin servidor externo.
- **Funciona offline:** Cada terminal tiene su base de datos SQLite local persistente.
- **Auditoría cifrada:** Registro de operaciones cifrado en AES-256.

## Qué hace la red local y multi-dispositivo

```
Terminal Maestro (Next.js :3000 + Radio Server :3001)
├── Caja Mobile / Celular (Acceso WiFi por IP LAN 192.168.X.X)
├── Tablet Almacén / QR (Escaneo de estanterías y recolección)
└── Chofer / Repartidor (PWA offline con captura de firma)
```

El maestro corre Next.js en puerto 3000 y el radio server en 3001/3002. Los nodos y teléfonos abren el navegador apuntando a la IP del maestro (`http://192.168.x.x:3000`). Se detectan automáticamente por mDNS y conservan cookies de sesión mediante resolución dinámica de protocolo.

## Roles y PINs de Acceso

| PIN Numérico | PIN Alfanumérico | Rol | Dashboard / Función |
|---|---|---|---|
| `0000` | `A0000` | Dueño (superadmin) | Panel completo con KPIs, IA y control total |
| `1111` / `1234` | `A1111` | Gerente (admin) | Control operativo, activación de pagos web e inspección |
| `2222` | `A2222` | Cajero (sales) | POS, cobro en efectivo/tarjeta, validación serial |
| `3333` | `A3333` | Bodeguero (inventory) | Estanterías, escaneo QR, cola de surtido |
| `4444` | `A4444` | Diseñador (marketing) | OMNIPULSE, editor de tienda, QR por rol |
| `5555` | `A5555` | Chofer (driver) | Entregas, rutas GPS, firma digital del cliente |
| `6666` | `A6666` | Patio (carga_descarga) | Carga/descarga, bahías y tiempos de patio |
| `7777` | `A7777` | Mostrador (pickup) | Pick-Up y ventanillas de recolección |

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
