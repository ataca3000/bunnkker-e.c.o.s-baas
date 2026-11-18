<div align="center">

<img src="./docs/assets/bunkker-logo-3d.jpg" width="120" alt="BUNKKER Logo 3D" />

# BUNKKER E.C.O.S. ERP
### Ecosistema Comercial de Operación Sincronizada (Local-First + Cloud + Desktop + Docker)

**ERP y Punto de Venta Local-First con SQLite WAL, Sincronización LAN P2P, Multi-Rol por PIN, Logística PoD, Tablero Ejecutivo, BUNKKER OIL (Solo Lectura) y Firebase AI Logic Híbrida.**

[![Next.js](https://img.shields.io/badge/Next.js-15.5-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![Electron](https://img.shields.io/badge/Electron-Desktop_Win-47848F?style=for-the-badge&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Hosting_%26_AI_Logic-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![License: BSL 1.1](https://img.shields.io/badge/Licencia-BSL_1.1-blue?style=for-the-badge)](./LICENSE)

</div>

---

## 1. Arquitectura General del Sistema

**BUNKKER E.C.O.S.** está diseñado para ferreterías, distribuidoras, abarrotes y bodegas que necesitan operar sin interrupciones aunque falle el internet:

- **Persistencia Local-First y Nube:** SQLite en modo escritorio autónomo (Electron) y PostgreSQL/Prisma en despliegues web/nube (`BUILD_TARGET=web` vs `desktop`), con aislamiento multi-empresa por `tenantId`.
- **Sincronización LAN y Tiempo Real:** `radio-server.js` (Socket.IO) + bus SSE `/api/sync/events` + `BroadcastChannel` para reflejar cambios al instante entre cajas, bodega, patio y celulares.
- **Inteligencia Híbrida (`Firebase AI Logic` + Gemini + Motor Local):**
  - El asistente **LION** (`src/lib/firebaseAiLogic.ts`) opera con `InferenceMode.PREFER_ON_DEVICE` (`firebase/ai`): prioriza ejecución **On-Device** (Gemini Nano / Prompt API cuando el navegador lo soporta), reconecta a **Firebase AI Cloud**, respalda con **Gemini en servidor** (`/api/ai/chat` con `@google/genai`) y cuenta con un **motor determinístico offline** de 0 ms para consultas sin red.
- **BUNKKER OIL (Fase 1 — Solo Lectura):** Explorador de esquema SQLite (`agent-operative/database-explorer/` y `/api/oil/schema-explorer`) con `PRAGMA query_only = ON` integrado en `/dashboard/audit` para mapear tablas, llaves foráneas, índices y cadenas de auditoría sin duplicar motores del ERP.
- **Tablero Ejecutivo (`/dashboard/executive`):** Métricas diarias, semanales y mensuales con **Recharts**, tarjetas KPI con variación porcentual y exportación CSV exacta del filtro activo.

---

## 2. Requisitos Previos e Instalación Inicial

```bash
git clone https://github.com/BRECHACORP/bunnkker-e.c.o.s-baas.git
cd bunnkker-e.c.o.s-baas
npm install --legacy-peer-deps
cp .env.example .env.local
npx prisma generate
```

> Revisa `.env.example` para configurar `DATABASE_URL`, `INTERNAL_API_SECRET`, `GEMINI_API_KEY` (solo servidor) y tus credenciales `NEXT_PUBLIC_FIREBASE_*` / `FIREBASE_CLIENT_EMAIL` si deseas nube, push FCM y Firebase AI Cloud.

---

## 3. Guía Completa de Comandos `npm` (`package.json`)

### A. Desarrollo Local y Emuladores

| Comando | Qué hace exactamente | Cuándo usarlo |
|---|---|---|
| `npm run dev` | Inicia Next.js en `http://0.0.0.0:3000` con `NODE_OPTIONS="--max-old-space-size=4096"` (accesible desde celulares en la misma red Wi-Fi). | Desarrollo diario web y pruebas multi-dispositivo en LAN. |
| `npm run dev:https` | Arranca `next dev --experimental-https -p 3000` con certificado local HTTPS. | Probar cámara (escáner QR/barras), Service Workers PWA/FCM o APIs que exigen contexto seguro HTTPS en móviles LAN. |
| `npm run dev:electron` | Ejecuta `electron .` (`electron-main.js`) apuntando al servidor standalone generado en `.next/standalone/server.js` y levanta `radio-server.js`. | Probar la ventana nativa de escritorio antes de empaquetar el `.exe` (requiere haber corrido antes `npm run build:standalone`). |
| `npm run bridge:windows` | Ejecuta directamente `node radio-server.js` (servidor de sincronización Socket.IO / Radio LAN). | Cuando necesitas correr el puente LAN/Socket independiente para terminales Windows. |
| `npm run emulate:local` | Inicia los emuladores de Firebase importando/exportando `./firebase_data`. | Pruebas locales de reglas/servicios Firebase sin afectar producción. |

### B. Compilación Web y Ejecución en Producción

| Comando | Qué hace exactamente | Cuándo usarlo |
|---|---|---|
| `npm run build` | Ejecuta `scripts/prepare-db.js` (sincroniza esquema Prisma si existe `DATABASE_URL`), genera el cliente (`prisma generate`) y compila Next.js (`next build`). | Build estándar de servidor o CI/CD. |
| `npm run start` | Arranca el servidor Next.js compilado en `0.0.0.0:3000`. | Servir la app web compilada directamente con Node.js. |
| `npm run build:web` | Llama a `node scripts/run-next-build.js web nube` (`NEXT_PUBLIC_APP_ENV=nube`, `output: 'standalone'`). | Compilar bundle standalone para servidores nube, Docker o hosting Node. |
| `npm run build:demo` | Ejecuta `prisma generate` y compila con `NEXT_PUBLIC_APP_ENV=demo`. | Despliegues de demostración pública. |

### C. Empaquetado Escritorio Windows (Electron `.exe`)

| Comando | Qué hace exactamente | Resultado / Notas |
|---|---|---|
| `npm run build:standalone` | 1) Deriva temporalmente `prisma/schema.prisma` a **SQLite** sin modificar tu archivo Postgres original (`run-next-build.js desktop local`).<br>2) Compila Next.js standalone.<br>3) Restaura `schema.prisma` de Postgres.<br>4) Ejecuta `scripts/copy-standalone.js` para copiar `.next/static`, `public`, el motor Prisma SQLite y preparar `node_modules_backup`. | Deja `.next/standalone` listo para Electron 100% offline usando SQLite persistente en `%APPDATA%/.../database.sqlite`. |
| `npm run build:secure` | Alias directo de `npm run build:standalone`. | Paso previo antes de empaquetar. |
| `npm run dist` | Corre `npm run build:secure` y ejecuta `electron-builder` para tu sistema actual. | Genera paquete de escritorio según tu OS. |
| `npm run dist:win` | Corre `npm run build:standalone` y empaqueta el instalador NSIS Windows x64 (`CSC_IDENTITY_AUTO_DISCOVERY=false electron-builder --win --x64`). | Genera el instalador `.exe` dentro de `dist-build-win/`. |
| `npm run win` | Alias corto de `npm run dist:win`. | Atajo rápido para generar el `.exe` de Windows. |
| `npm run dist:publish` | Compila standalone y ejecuta `electron-builder --win --publish always` hacia el repositorio configurado en `package.json`. | Publicación de releases con auto-actualización (`electron-updater`). |

### D. Despliegue en Firebase Hosting / App Hosting

| Comando | Qué hace exactamente | Notas importantes |
|---|---|---|
| `npm run deploy:firebase -- --project <PROJECT_ID>` | Ejecuta `scripts/deploy-firebase.js`: valida `.firebaserc`, verifica `firebase-tools`, habilita `webframeworks`, genera Prisma y ejecuta `firebase deploy --only hosting`. | Soporta `--dry-run` para validar sin subir cambios (`npm run deploy:firebase -- --project gen-lang-client-0344737701 --dry-run`). Para Next.js SSR (`frameworksBackend` en `firebase.json` y `apphosting.yaml`) el proyecto Firebase requiere plan **Blaze** y sesión (`firebase login` o `FIREBASE_TOKEN`). |

### E. Base de Datos, Auditoría, Pruebas y Optimización

| Comando | Propósito |
|---|---|
| `npm run db:migrate` | Aplica migraciones pendientes con `prisma migrate deploy`. |
| `npm run db:seed` | Ejecuta `prisma/seed.js` para sembrar catálogo y usuarios iniciales. |
| `npm run migrate:pins` / `npm run migrate:pins:dry` | Migra PINs heredados a formato con hash seguro (`--dry-run` para simular sin escribir). |
| `npm run lint` | Ejecuta `eslint .` sobre todo el código fuente. |
| `npm run test` | Ejecuta la suite unitaria y de integración con **Vitest** (`vitest run`). |
| `npm run test:logic` | Corre pruebas lógicas adicionales de `scripts/test-logic.js`. |
| `npm run guard:build` | Valida invariantes previos al build (`scripts/build-guard.js`). |
| `npm run validate:schemas` | Verifica consistencia de esquemas (`scripts/validate-schemas.js`). |
| `npm run validate:ports` / `npm run validate:comm` | Diagnóstico de puertos locales (`3000`/`3001`/`3002`) y comunicación LAN. |
| `npm run optimize` | Ejecuta `scripts/optimize-system.mjs` con `--expose-gc` para optimización y limpieza. |

---

## 4. Despliegue con Docker y Docker Compose

El proyecto incluye `Dockerfile` (imagen ligera `node:20-alpine` con usuario no-root `nextjs` y `dumb-init`) y `docker-compose.yml` con volumen persistente `prisma_data:/app/prisma`.

> **Importante sobre el `Dockerfile`:** el `Dockerfile` actual copia `.next/standalone`, `.next/static`, `public` y `prisma` ya compilados previamente desde el host para mantener la imagen final mínima y rápida.

### Pasos para levantar en Docker:

```bash
# 1. Asegúrate de tener .env.local configurado
cp .env.example .env.local

# 2. Compila el bundle standalone en el host
npm run build:web

# 3. Construye la imagen y levanta el contenedor en segundo plano
docker compose up -d --build

# 4. Verifica logs y estado del healthcheck (puerto 3000)
docker compose logs -f app
```

- **Puerto expuesto:** `http://localhost:3000`
- **Persistencia:** los archivos de base de datos en `/app/prisma` quedan guardados en el volumen Docker `prisma_data`.
- **Detener:** `docker compose down` (conserva `prisma_data`) o `docker compose down -v` (borra volúmenes).

---

## 5. Guía Operativa del Flujo Completo: Stock → Cliente → Pedido → Venta → Actualización de Stock

Esta guía describe el ciclo real tal como lo ejecutan las rutas y transacciones atómicas del ERP (`prisma.$transaction` + Control de Concurrencia Optimista **OCC**).

```text
  [1. ALTA / RECARGA STOCK] ──▶ Product.stock ↑  (Almacén: Doble Ciego / SuperAdmin: Precio Doble Confirmación)
            │
            ▼
  [2. CLIENTE NUEVO]        ──▶ Customer (llave única por negocio: tenantId + phone)
            │
            ▼
  [3. CREAR PEDIDO]         ──▶ POST /api/orders  ──▶ Valida (stock - reservedStock) >= cantidad
            │
            ├──▶ Venta directa en mostrador (LOCAL + paid)
            │       └─ Estado: COMPLETED · Descuenta Product.stock inmediato
            │
            └──▶ Pedido cliente o por entregar (pending_payment / PICKUP / PATIO / DELIVERY)
                    │
                    ▼
          [4. COBRO EN CAJA] ──▶ PATCH /api/orders (action: confirm_payment)
                    │            Incrementa Product.reservedStock + Registra flujo para Corte Ciego
                    ▼
          [5. SURTIDO Y ENTREGA PoD]
                    ├─ Almacén / Patio: claim_loading ──▶ complete_loading (caja o carga)
                    ├─ Reparto: claim_delivery (driver)
                    └─ Entrega final (confirm_pickup_receipt / PoD foto+firma):
                         Product.stock ↓  y  Product.reservedStock ↓ (liberación atómica)
```

### Paso 1: Agregar Productos y Recargar Stock (`/dashboard/inventory`)
- **Alta o edición (`/api/products` `POST`):**
  - Se registra `id`, `name`, `stock`, `category`, `barcode`, `estante`, `fila` y multimedia.
  - **Regla Doble Ciego (`inventory`):** el personal de almacén cuenta mercancía física y ubicaciones, pero el servidor bloquea con `403` si intenta modificar `price`. Solo `superadmin` o `admin` sellan precios.
  - **Doble confirmación anti-error (`confirmPrice` y `restockConfirmation.ts`):** al capturar precios o recargar piezas rápidas (`QuickRestockModal`), el operador confirma la cantidad dos veces idénticas antes de sumar al inventario y guardar bitácora en `AuditLog` (`STOCK_UPDATE`, `STOCK_IN`).
- **Compras a proveedores (`/dashboard/purchases`, `/api/purchases`):** registra proveedor, concepto, monto y estado de compra.
- **Mermas y ajustes (`/api/inventory/shrinkage`):** registra faltantes (`missing`, decrementa `stock`) o sobrantes (`surplus`, incrementa `stock`) en `ShrinkageLog`.
- **Papelera segura:** eliminar un producto marca `deletedAt` (soft-delete) para no romper historial de órdenes pasadas.

### Paso 2: Registrar un Cliente Nuevo (`/dashboard/crm` y `/api/customers`)
- **Alta manual en CRM:** captura `name`, `phone`, `email`, `address` y opcionalmente datos fiscales CFDI 4.0 (`rfc`, `razonSocial`, `regimenFiscal`, `usoCFDI`, `codigoPostal`).
- **Aislamiento por negocio (`upsert`):** el identificador operativo es la llave compuesta `@@unique([tenantId, phone])`, evitando duplicados por teléfono dentro del mismo negocio.
- **Auto-registro desde Pedido o Catálogo:** si un cliente compra desde `/catalogo` o mostrador sin haber sido dado de alta antes en CRM, `POST /api/orders` lo resuelve o lo crea automáticamente dentro de la misma transacción.
- **Segmentación automática en CRM:** `/api/customers` clasifica al cliente según historial pagado en `Nuevo`, `Frecuente` (>= 2 pedidos) o `VIP` (>= 5 pedidos y > $50,000).

### Paso 3: Crear un Pedido (`/catalogo` o `/dashboard/sales`)
- **Petición `POST /api/orders`:**
  1. **Idempotencia por `orderId`:** si una terminal reintenta por fallo de Wi-Fi, devuelve la orden existente sin duplicar cobro ni descontar inventario dos veces.
  2. **Disponibilidad real (`stock - reservedStock`):** el servidor verifica que exista inventario neto disponible; nunca permite vender mercancía ya apartada por otra caja.
  3. **Seguridad de precios (Piso de Precio):** el catálogo de cliente toma el precio oficial desde SQLite/Postgres; incluso en caja, roles no administradores no pueden vender por debajo del precio sellado por el SuperAdmin (`PRICE_FLOOR_VIOLATION`).
  4. **Modalidades de entrega (`deliveryType`):**
     - `LOCAL`: Entrega inmediata en mostrador.
     - `PICKUP`: Recolección en ventanilla / mostrador.
     - `PATIO`: Carga pesada en patio de maniobras.
     - `DELIVERY`: Envío a domicilio con geolocalización y PIN de entrega.

### Paso 4: Cobrar la Venta y Hacer Corte de Caja (`/dashboard/sales` y `/dashboard/sales/close-register`)
- **Cobro en POS:**
  - Un pedido enviado desde catálogo nace en `pending_payment` (no suma como venta cobrada hasta pasar por caja).
  - Cuando el cajero cobra en `/dashboard/sales`, envía `PATCH /api/orders` con `action: 'confirm_payment'`, registrando `paymentMethod` (`cash`, `card`, `transfer`, `mercado_pago`, `stripe`), `confirmedAt`, `vendedorId` y `vendedorName`.
- **Corte de Caja Ciego (`/dashboard/sales/close-register`, `POST /api/sales/close-register`):**
  - El cajero captura el efectivo contado (`declaredAmount`) sin ver primero el esperado.
  - El servidor suma las ventas en efectivo (`CASH_PAYMENT_METHODS`) cobradas desde el último cierre (`lastLog`), excluyendo órdenes canceladas o reembolsadas, calcula `discrepancy = declaredAmount - expectedAmount` y guarda el `CashRegisterLog`. Si hay faltante (`discrepancy < 0`), genera alerta en `AuditLog` (`CASH_MISMATCH_DETECTED`) y Firestore.

### Paso 5: Cómo se Actualiza el Stock Exactamente en Cada Escenario

| Momento / Acción | Estado (`Order.status`) | `Product.stock` (Físico) | `Product.reservedStock` (Apartado) | Notas de Auditoría |
|---|---|---|---|---|
| **Alta / Recarga en Inventario** | — | **Sube (+qty)** | Sin cambio | Registra `STOCK_UPDATE` / `STOCK_IN` en `AuditLog`. |
| **Pedido cliente pendiente (`pending_payment`)** | `pending_payment` | Sin cambio | Sin cambio | Valida disponibilidad neta al crear. |
| **Venta directa mostrador (`LOCAL` + `paid`)** | `COMPLETED` | **Baja (-qty)** | Sin cambio | El cliente se lleva el producto en el acto; queda entregado de inmediato. |
| **Pago confirmado para entrega (`PICKUP`/`PATIO`/`DELIVERY`)** | `paid` | Sin cambio | **Sube (+qty)** | Apartado atómico OCC: ninguna otra caja puede vender esas piezas. |
| **Surtido en Bodega / Patio (`claim_loading` → `complete_loading`)** | `READY_FOR_PICKUP_PAID` o `OUT_FOR_DELIVERY` | Sin cambio | Sigue apartado | Bloqueo exclusivo (`loadedByUid`) para evitar surtido doble. Registra `OrderEvent`. |
| **Entrega Validada PoD (`confirm_pickup_receipt` con foto/firma)** | `DELIVERED` | **Baja (-qty)** | **Baja (-qty)** | Salida física real y liberación de reserva en una sola transacción + evento `ORDER_DELIVERED_POD`. |
| **Cancelación / Retorno a anaquel (`return_to_shelf`)** | `cancelled` | Sin cambio (si no había salido) o **Sube (+qty)** (si venía de `refunded`) | **Baja (-qty)** (si estaba pagado/apartado) | Protegido con candado atómico `CANCELADA_STOCK_RESTITUIDO` contra doble devolución. |
| **Merma / Ajuste físico (`/api/inventory/shrinkage`)** | — | **Baja** (`missing`) o **Sube** (`surplus`) | Sin cambio | Registra motivo y responsable en `ShrinkageLog`. |

---

## 6. Matriz de Roles y PINs Iniciales (Personalizable en `/dashboard/team`)

| PIN Clásico | PIN Demo | Rol | Alcance Principal |
|:---:|:---:|---|---|
| `0000` | `A0000` | **Superadmin (Dueño)** | Control total, tablero ejecutivo, precios, auditoría, OIL y configuración. |
| `1111` / `1234` | `A1111` | **Admin (Gerente)** | Reportes, supervisión operativa, inventario y auditoría. |
| `2222` | `A2222` | **Sales (Cajero / POS)** | Cobro en caja, tickets y corte ciego de turno. |
| `3333` | `A3333` | **Inventory (Bodeguero)** | Conteo doble-ciego, recargas, surtido y mermas (sin editar precios). |
| `4444` | `A4444` | **Marketing** | OMNIPULSE y difusión de catálogo. |
| `5555` | `A5555` | **Driver (Repartidor)** | Rutas GPS, PIN de entrega y captura PoD (foto + firma). |
| `6666` | `A6666` | **Carga/Descarga (Patio)** | Despacho de material pesado en patio de maniobras. |
| `7777` | `A7777` | **Pickup (Mostrador)** | Ventanilla de entrega de pedidos listos. |

---

## 7. Licencia

**Business Source License 1.1 (BSL 1.1)** — Consulta el archivo [`LICENSE`](./LICENSE) para términos completos de uso y conversión futura a Apache 2.0.

© 2026 **Brecha Soluciones / BUNKKER E.C.O.S.**
