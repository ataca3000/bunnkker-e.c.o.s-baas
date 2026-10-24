# ADR — Perfeccionamiento Forense N3: Atomicidad Prisma, Corte de Caja Ciego e Invariante de Inventario

- **Fecha:** 2026-10-24
- **Estado:** Implementado y Verificado (Fase D Protocolo N3)

## 1. Problema → Causa Raíz → Solución

### 1.1 Split-Brain por Excepciones de Negocio en `src/lib/prisma.ts`
- **Problema:** Cuando una transacción (`prisma.$transaction`) lanzaba una excepción de negocio (`INSUFFICIENT_STOCK` u `ORDER_CONFLICT`), el proxy de resiliencia activaba permanentemente `hasFailed = true`, desconectando SQLite/PostgreSQL y re-ejecutando la operación contra el almacén en memoria.
- **Causa Raíz:** El bloque `catch` de `createResilientPrismaClient()` no distinguía entre fallos de conectividad/inicialización del motor de base de datos y excepciones de validación de negocio.
- **Solución:** Se implementó `isDatabaseConnectivityFailure(err)` para que únicamente errores reales de conexión/motor (`PrismaClientInitializationError`, `P10xx`, `ECONNREFUSED`) activen el fallback en memoria.

### 1.2 Reservas Huérfanas en Carritos Multi-Producto (`$transaction` en Memoria)
- **Problema:** Si una orden con varios productos reservaba el primer artículo y fallaba al validar el segundo, el incremento en `reservedStock` del primer artículo no se revertía.
- **Causa Raíz:** `createInMemoryPrisma().$transaction` ejecutaba el callback directamente sobre `proxy` sin bitácora de reversión (`undoLog`).
- **Solución:** Se incorporó un `undoLog` transaccional por invocación de `$transaction` que revierte en orden inverso (`LIFO`) todas las mutaciones (`create`, `update`, `updateMany`, `upsert`, `delete`, `deleteMany`) si la transacción aborta.

### 1.3 Invariante de Stock en Ventas `LOCAL` / `'piso'` y Protección del Límite de 120 Ventas
- **Problema:**
  1. `deliveryMethod: 'piso'` sin `deliveryType` caía en `'LOCAL'`, y al cobrarse en `cashier_payment` pasaba a `COMPLETED` incrementando `reservedStock` sin descontar `stock` físico jamás.
  2. `recordPersistentSale(tenantId)` se disparaba incluso en solicitudes `pending_payment` no pagadas.
  3. El fallback genérico de `PATCH /api/orders` permitía mass-assignment de `total`, `tenantId` y `status: 'paid'`.
- **Causa Raíz:** Desalineación entre los estados terminales (`COMPLETED` vs `DELIVERED`) y las compuertas de cobro/creación.
- **Solución:**
  1. Homologación de `'piso'` a `'PICKUP'` en `POST /api/orders` y `CartDrawer.tsx`.
  2. Descuento directo de `stock` físico con OCC cuando `cashier_payment` transiciona directamente a `COMPLETED`.
  3. Contabilización en `recordPersistentSale` únicamente al nacer pagada la orden o al confirmarse en `cashier_payment`.
  4. Restricción de `allowedFields` por rol en `PATCH /api/orders` y transacción atómica en `DELETE /api/orders`.

### 1.4 Inmunidad del Corte de Caja Ciego ante Órdenes Canceladas/Reembolsadas
- **Problema:** Órdenes cobradas (`confirmedAt !== null`) que posteriormente eran canceladas (`cancelled`) o reembolsadas (`refunded`) seguían sumándose al efectivo esperado del turno, provocando falsos faltantes (`CASH_MISMATCH_DETECTED`).
- **Causa Raíz:** `calculateExpectedAmount` y `POST /api/sales/close-register` usaban `OR: [{ status: { in: ALLOWED_CLOSE_STATUSES } }, { confirmedAt: { not: null } }]` sin excluir estados anulados.
- **Solución:** Se añadió `EXCLUDED_CLOSE_STATUSES` y `CASH_PAYMENT_METHODS` en `src/lib/financial.ts` y `src/app/api/sales/close-register/route.ts`, evaluando además la ventana del turno por `confirmedAt ?? date`.
