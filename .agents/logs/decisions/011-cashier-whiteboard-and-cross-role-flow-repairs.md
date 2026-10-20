# ADR 011: Reparación de Tuberías de Flujo Cruzado (Caja, Mostrador y Patio)

## Contexto y Síntomas
En el ciclo de ventas entre roles (Catálogo $\to$ Almacén $\to$ Caja $\to$ Mostrador/Patio/Reparto):
1. **Pizarra de Caja Incompleta:** Los pedidos cobrados (`paid`) o surtidos con cobro previo (`READY_FOR_PICKUP_PAID`) desaparecían de la pantalla del cajero (`/dashboard/sales`).
2. **Bloqueo 409 al Cobrar:** Si un asesor/vendedor de piso levantaba el pedido en tablet (`vendedorId`), o si el cliente tardaba en la fila (`expiresAt`), el cajero en ventanilla recibía error de conflicto y no podía cobrar.
3. **Falso fallo en PoD:** En `confirm_pickup_receipt`, la consulta requería `confirmedAt: { not: null }`, fallando si la orden venía de un canal sin timestamp explícito.
4. **Mezcla de Pizarras:** Mostrador Pickup (7777) mostraba pedidos pesados de Bahía de Carga (6666).

## Decisiones Aplicadas
1. **Ampliación de Pizarra de Caja:**
   - Se incorporó `paid`, `PREPARANDO` y `READY_FOR_PICKUP_PAID` a `PENDING_CASHIER_STATUSES`.
   - Se alinearon los filtros y contadores de pestañas *"Por Cobrar"* y *"Listos Entrega"*.
2. **Relevo Multi-Vendedor en Caja:**
   - Cualquier usuario con rol de caja (`sales`, `billing`, `admin`, `superadmin`) puede cobrar cualquier pedido listo.
   - Si `vendedorId` ya existía (asesor de piso), se preserva su comisión/crédito; si no existía, se le asigna al cajero.
   - El cobro presencial en mostrador desactiva el bloqueo por timer expirado.
3. **Validación PoD Limpia:**
   - `confirm_pickup_receipt` asegura `confirmedAt` en la entrega física sin arrojar 409 espurios.
4. **Segregación Nítida Mostrador vs Patio:**
   - [`src/app/dashboard/pickup/page.tsx`](file:///c:/Users/codem/bunnkker-e.c.o.s-baas/src/app/dashboard/pickup/page.tsx) filtra estrictamente `deliveryType !== 'PATIO'`.

## Verificación
- 13 archivos de prueba, 114 pruebas en verde (100% passing).
- Commit: `5ef494b`.
