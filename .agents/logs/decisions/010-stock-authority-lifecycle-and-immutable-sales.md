# ADR 010: Solidificación del Ciclo de Vida de Stock, Autoridad de Inventario y Ventas Cerradas Inmutables

## 1. Contexto y Problema
En el flujo de inventario con múltiples operadores conectados vía Wi-Fi local existían discrepancias y riesgos críticos:
1. **Doble Descuento**: Las órdenes de staff restaban `stock` físico en la creación del pedido (`POST /api/orders`) y volvían a descontar `stock` y `reservedStock` al momento de la entrega validada (PoD).
2. **Inventario Fantasma**: Al buscar un producto no encontrado, se auto-creaba con `stock: 100`, inventando existencias que no existen en bodega.
3. **Reacomodo No Idempotente**: Las cancelaciones y devoluciones (`return_to_shelf`) permitían sumar stock reiteradamente si se reintentaba la petición por fallas en la red Wi-Fi.
4. **Ventas Cerradas Vulnerables**: Permitir la cancelación o reembolso descontrolado sobre pedidos ya entregados (`DELIVERED`/`COMPLETED`) causaba recuentos erróneos e inflaba el stock real.

## 2. Decisión Tomada (Axiomas de Inventario)
1. **Separación Estricta entre Stock Físico y Apartado Virtual**:
   - En la creación de la orden (`POST`), el stock físico nunca se decrementa. Solo se aparta en `reservedStock` si la orden nace pagada; de lo contrario, permanece disponible hasta el cobro en caja (`claim_cashier`).
   - El stock físico (`stock`) se descuenta **únicamente** cuando la mercancía sale físicamente de la sucursal/almacén con comprobante validado (`DELIVERED` / PoD con firma y foto).
2. **Inmutabilidad de Ventas Cerradas**:
   - Toda orden entregada y cobrada (`DELIVERED`/`COMPLETED`) es inmutable contra cancelaciones directas para proteger la veracidad del inventario en piso.
3. **Deconstrucción Recursiva Idempotente**:
   - Las órdenes en preparación que son canceladas antes de la entrega liberan su reserva (`reservedStock`) y quedan con marca `CANCELADO_PENDIENTE_REACOMODO`.
   - La acción `return_to_shelf` valida permisos (`inventory`, `carga_descarga`, `admin`), restituye stock físico exactamente una vez y previene duplicaciones ante reintentos de red.
4. **Protección contra Números Negativos**:
   - Las liberaciones de `reservedStock` utilizan salvaguardas `Math.max(0, ...)` para evitar subdesbordamientos.
5. **Erradicación de Productos Fantasma**:
   - Productos nuevos no encontrados se registran con `stock: 0`, requiriendo resurtido formal documentado.

## 3. Verificación y Resultados
- Suite unitaria `src/__tests__/stock_lifecycle_n3.test.ts` implementada con 5 pruebas exhaustivas.
- Suite global completa: 13 archivos de prueba, 111 pruebas superadas al 100% (cero fallos, cero regresiones).
