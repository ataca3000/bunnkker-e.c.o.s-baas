# ADR-2026-10-24: Reorganización Tricolor de Cola de Pedidos en Caja y Limpieza de Datos Demo

## 1. Contexto & Requerimiento
1. **Reorganización de la Cola de Caja Móvil (`/dashboard/sales` tab `online`)**:
   - **🟢 Verde ("Por Tomar"):** Pedidos disponibles/libres para tomar o asignar al cajero.
   - **🟡 Amarillo ("Por Preparar"):** Pedidos en almacén o pendientes de surtido/picking.
   - **🔵 Azul ("Listos para Cobrar"):** Pedidos listos con surtido completo. **Regla de Caja Universal:** Caja centraliza el cobro de todos los vendedores/roles sin filtro excluyente de usuario.
   - **🟠 Columna Lateral:** Control de Caja Móvil, Botón de Historial de Tickets a pantalla completa y acceso a Corte de Caja.
2. **Modal de Historial de Tickets a Pantalla Completa:**
   - Rediseño de [`TicketHistoryModal.tsx`](file:///c:/Users/codem/bunnkker-e.c.o.s-baas/src/components/sales/caja-movil/TicketHistoryModal.tsx) a `fixed inset-0 w-screen h-screen` con métricas del turno (Total Cobrado, Válidos, Cancelados, Facturados SAT), cuadrícula responsiva y vista detallada.
3. **Limpieza de Datos Demo:**
   - Eliminación de productos demo (`PROD-101` a `PROD-105`) y pedidos demo (`ORD-TEST-1`, `TEST-PATIO-*`).
   - Conservación total de las tablas y modelos de base de datos (`product`, `order`, `orderItem`, `orderEvent`, `user`, etc.) para comenzar el registro limpio de inventario y ventas reales.

## 2. Archivos Intervenidos
- [`src/components/sales/caja-movil/TriColorOrdersBoard.tsx`](file:///c:/Users/codem/bunnkker-e.c.o.s-baas/src/components/sales/caja-movil/TriColorOrdersBoard.tsx): Nuevo tablero modular con las 3 columnas por color + lateral de métricas/control.
- [`src/components/sales/caja-movil/TicketHistoryModal.tsx`](file:///c:/Users/codem/bunnkker-e.c.o.s-baas/src/components/sales/caja-movil/TicketHistoryModal.tsx): Panel expandido a pantalla completa (Fullscreen).
- [`src/app/dashboard/sales/page.tsx`](file:///c:/Users/codem/bunnkker-e.c.o.s-baas/src/app/dashboard/sales/page.tsx): Integración de `TriColorOrdersBoard`, segmentación de pedidos y conmutador `Tablero 3 Colores / Lista`.
- [`src/lib/prisma.ts`](file:///c:/Users/codem/bunnkker-e.c.o.s-baas/src/lib/prisma.ts): Eliminación de semillas demo y prevención de reinyección automática sobre arrays vacíos.
- [`.prisma_memory_store.json`](file:///c:/Users/codem/bunnkker-e.c.o.s-baas/.prisma_memory_store.json): Vaciado de `product`, `order`, `orderItem` y `orderEvent`.

## 3. Verificación
- TypeScript: `npx tsc -p tsconfig.json --noEmit` -> Código de salida 0 (0 errores).
- Vitest: `npx vitest run` -> 15 suites, 138 tests exitosos (100% passed).
