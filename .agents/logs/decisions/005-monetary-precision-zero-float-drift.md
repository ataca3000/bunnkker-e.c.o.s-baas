# ADR 005: Precisión Monetaria de Grado Bancario y Eliminación de Float Drift (P5)

## Estado
Aceptado / Implementado

## Contexto
En sistemas comerciales y ERPs locales como BUNKKER E.C.O.S., las operaciones de caja, ventas acumuladas, cobros y cierres de turno manejaban montos representados como números de punto flotante IEEE-754 (`Float` en Prisma, `number` en JavaScript/TypeScript).
Esto conllevaba riesgos de deriva acumulativa:
1. `0.1 + 0.2 = 0.30000000000000004`
2. `calculateDiscrepancy(declaredAmount, expectedAmount)` en arqueos de caja (`CashRegisterLog`) producía discrepancias residuales ínfimas pero no nulas (ej. `0.00000000000001` o `-0.00000000000001`), disparando alertas de auditoría falsas por "descuadres" inexistentes.
3. Al persistir pedidos en `Order.total`, `OrderItem.precio` o `Purchase.amount`, los valores no saneados podían escribir decimales no representativos en SQLite.

## Decisiones de Diseño

1. **Biblioteca de Aritmética Monetaria en Centavos Enteros (`src/lib/financial.ts`):**
   - Se crearon utilidades deterministas basadas en números enteros de centavos:
     - `toCents(amount)`: Conversión a centavos enteros con redondeo por épsilon (`Math.round((amount + Number.EPSILON) * 100)`).
     - `fromCents(cents)`: Conversión de centavos enteros de vuelta a float de 2 decimales limpios.
     - `roundMoney(amount)`: Redondeo estricto a 2 decimales sin pérdida de precisión.
     - `safeAddMoney(a, b)`: Suma determinista vía centavos.
     - `safeSubMoney(a, b)`: Resta determinista vía centavos.
     - `safeMulMoney(amount, qty)`: Multiplicación de precio unitario por cantidad redondeada a centavos.

2. **Cálculo de Cierre de Caja (`calculateExpectedAmount` y `calculateDiscrepancy`):**
   - `calculateExpectedAmount` suma todas las órdenes en centavos enteros (`reduce((sumCents, order) => sumCents + toCents(order.total), 0)`), evitando drift acumulativo.
   - `calculateDiscrepancy` utiliza `safeSubMoney`: si el dinero declarado es igual al esperado, el descuadre es exactamente `0.00`.

3. **Saneamiento en Creación de Órdenes y Compras:**
   - En `src/app/api/orders/route.ts` y `src/core/actions.ts`: `total` y `precio` de cada producto se pasan por `roundMoney` antes de persistir en SQLite.
   - En `src/app/api/purchases/route.ts`: `amount` de compras a proveedores se sanea con `roundMoney`.
   - En `src/app/api/sales/close-register/route.ts`: `declaredAmount` se procesa con `roundMoney` y `getTenantId`.

4. **Roadmap de Esquema:**
   - Para no romper bases de datos locales ya desplegadas en producción, el tipo `Float` en SQLite/PostgreSQL se mantiene a nivel de esquema, pero todos los puntos de entrada y salida garantizan valores normalizados a 2 decimales exactos.

## Consecuencias
- Cero alertas falsas de descuadre en corte de caja de los cajeros.
- Idempotencia y exactitud financiera en tickets, cortes de turno e informes contables.
