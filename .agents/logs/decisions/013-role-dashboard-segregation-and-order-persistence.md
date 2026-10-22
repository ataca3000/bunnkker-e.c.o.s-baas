# 013. Segregación de Consolas por Rol, Vista Maestra SuperAdmin y Persistencia de Pedidos

- **Fecha:** 2026-10-22
- **Estado:** Implementado & Validado (14 suites, 120 tests verdes)
- **Áreas Afectadas:** `src/app/dashboard/`, `src/app/api/orders/route.ts`, `src/lib/digitalTicket.ts`, `src/components/sales/caja-movil/TicketHistoryModal.tsx`

---

## 1. Contexto & Diagnóstico Forense

1. **Desaparición de Pedidos:**
   - En `src/app/api/orders/route.ts`, cada orden nueva creaba un `expiresAt = Date.now() + 30 * 60 * 1000`.
   - En cada llamada a `GET /api/orders`, un ciclo forzaba la cancelación automática de cualquier pedido con reserva pendiente que superara 30 minutos, provocando que los pedidos de mostrador, patio y reparto desaparecieran de las pizarras de trabajo.
2. **Duplicación de Pedidos en Pizarras:**
   - La vista de Patio (`/dashboard/patio`) no filtraba `pendingLoads` por canal de entrega (`deliveryType === 'PATIO'`), provocando que pedidos de mostrador y pedidos de chofer a domicilio aparecieran erróneamente en el patio de carga pesada.
3. **Consolas Desalineadas y Vistas Duplicadas en SuperAdmin:**
   - En `SuperAdminDashboard.tsx`, el botón de ventas dirigía a `/dashboard/admin/sales` (una tabla obsoleta y duplicada) en vez de al POS real (`/dashboard/sales`).
   - Los accesos a Patio (`/dashboard/patio`) y Mostrador (`/dashboard/pickup`) no estaban unificados en la consola central del Super Admin.
   - Existía la ruta `/dashboard/tests` que ensuciaba la interfaz de producción.
4. **Independencia Operativa por Rol:**
   - Siguiendo la arquitectura del usuario, el Super Admin tiene la vista maestra con acceso a todos los dashboards juntos, mientras que cada trabajador que inicia sesión con su rol y PIN personal opera en su copia designada de forma aislada e independiente.

---

## 2. Acciones Realizadas

1. **Eliminación de Auto-Expiración Artificial:**
   - Eliminado el ciclo de auto-cancelación en `GET /api/orders`.
   - Asignación de `expiresAt: null` por defecto en `POST /api/orders` (solo se aplica si se envía explícitamente en el body).
2. **Segregación Estricta de Canales de Entrega:**
   - En `src/app/dashboard/patio/page.tsx`: `pendingLoads` y `readyPatioLoads` filtran exclusivamente pedidos de Patio/Carga pesada (`deliveryType === 'PATIO' || deliveryMethod === 'patio' || selectedDeliveryLocation === 'carga'`), excluyendo expresamente entregas a domicilio y mostrador.
   - En `src/app/dashboard/pickup/page.tsx`: se excluyen expresamente pedidos de repartidor y patio.
   - En `src/app/dashboard/delivery/page.tsx`: exclusivo para pedidos con `deliveryMethod === 'repartidor' || deliveryType === 'DELIVERY'`.
3. **Unificación y Limpieza de Dashboards:**
   - `src/app/dashboard/page.tsx` enruta a cada rol directamente a su consola operativa completa (`SalesDashboard`, `InventoryDashboard`, `PatioDashboard`, `DeliveryDashboard`, `PickupDashboard`, `MarketingDashboard`).
   - En `SuperAdminDashboard.tsx`, se integran todas las consolas operativas bajo la sección de Operaciones y Logística (`patio`, `pickup`, `inventory`, `delivery`, `sales`).
   - Eliminadas las páginas redundantes `src/app/dashboard/admin/sales/page.tsx` y `src/app/dashboard/tests/page.tsx`.
4. **Notas en Tickets Digitales:**
   - Añadido campo `notes?: string[]` a `DigitalTicket` en `src/lib/digitalTicket.ts`.
   - Implementada la función `addNoteToDigitalTicket(cajaId, ticketId, noteText)` que añade notas fechadas e inmutables sin alterar montos ni borrar tickets.
   - Añadido formulario de notas y visualización en `TicketHistoryModal.tsx`.
