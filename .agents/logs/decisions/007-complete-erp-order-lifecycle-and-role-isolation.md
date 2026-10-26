# ADR 007: Complete ERP Order Lifecycle, Strict Role Isolation & Metrics Reconciliation

## Status
Accepted / Implemented

## Context & Problem
Previously, orders suffered from role bleed and execution inconsistencies:
1. Orders with `deliveryType === 'DELIVERY'` appeared in Warehouse and Cashier queues instead of staying isolated in the Driver route.
2. Cashier payment confirmation automatically marked `isLoaded = true` regardless of whether warehouse operators had physically picked the goods.
3. Multiple operators could simultaneously open an order without atomic claiming, causing collisions.
4. Quick-skip buttons bypassed the item-by-item verification assistant.
5. Warehousemen could mistakenly hand over goods directly to customers rather than delivering to Cashier (Mostrador) or Carga (Bahía).
6. Metrics in SuperAdmin and Reports missed orders in `READY_FOR_PICKUP_PAID`, causing discrepancies between financial numbers and physical orders.

## Solution Architecture
1. **Delivery Isolation:** `deliveryType === 'DELIVERY'` orders are 100% exclusive to the Delivery dashboard queue (`/dashboard/delivery`). Filtered out completely from `sales` and `inventory`.
2. **First-Come, First-Served Atomic Claiming:** `claim_order` / `claim_loading` uses transaction locks to set `loadedByUid`, `loadedBy`, and `status = 'PREPARANDO'`. Any competing operator receives HTTP 409 Conflict with the name of the claiming operator.
3. **Real 1-by-1 Picking:** Removed quick-skip buttons in warehouse (`✓ Caja`, `🏗️ Patio`). The operator must review items 1-by-1 in `OrderPickingAssistant`.
4. **Warehouse Boundary Enforcement:** Warehouse operators only hand over to `caja` (Mostrador) or `carga` (Bahía de carga). Calling `confirm_pickup_receipt` directly from role `inventory` is forbidden (HTTP 403).
5. **Cashier Paywall:** Removed auto-surtido bypass. `cashier_payment` stamps `confirmedAt` and updates `status` to `READY_FOR_PICKUP_PAID` (if already loaded) or `paid` (if loading remains in progress).
6. **Physical Handover & Closing:** Carga/Caja requires verified payment (`confirmedAt`) before allowing delivery handover with photo and signature (PoD). Decrements physical `stock` and cleans `reservedStock`.
7. **Customer Visibility & Cancellation:** `/cuenta` exposes live status (`Cancelado`, `Listo para entrega`, `En recolección`, etc.) with full `OrderEvent` audit history.
8. **Metrics Reconciliation:** SuperAdmin (`SuperAdminDashboard.tsx`), Reports (`reports/page.tsx`), and Admin Sales (`admin/sales/page.tsx`) include `READY_FOR_PICKUP_PAID` and `confirmedAt` orders in `VALID_SALES` while cleanly excluding cancelled/refunded orders.
