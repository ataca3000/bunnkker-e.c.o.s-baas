# ADR 006: Production-Ready Readiness Audit & Operational Convergence

## Estatus
Aprobado y Verificado (Ready for Production Deployment).

## Contexto
El sistema BUNKKER E.C.O.S. ha completado las fases de estabilización de arquitectura comercial y operativa:
1. Máquina de estados de pedidos (7 estados sin duplicación de ítems ni colisión de inventario).
2. Convivencia multi-usuario y roles RBAC (Superadmin, Admin, Ventas/Cajero, Almacén, Patio/Carga, Chofer/Delivery, Marketing, Cliente).
3. Precisión monetaria de grado bancario (Aritmética en centavos enteros sin deriva IEEE-754).
4. Radio LAN Walkie-Talkie Push-to-Talk (Streaming efímero de audio en RAM con HMAC, cero persistencia en disco, aislamiento total de clientes).
5. Ergonomía táctil para dispositivos móviles (Carrusel lateral SuperAdmin Bottom Nav y separación visual de widgets).
6. Motor i18n multilenguaje (Español 🇲🇽, Inglés 🇺🇸, Francés 🇫🇷, Chino 🇨🇳).
7. Motor de tickets digitales con serial único, corte X/Z y bitácora inmutable.

## Decisiones de Arquitectura
1. **Tickets e Historiales Inmutables:**
   - Cada cobro genera un `DigitalTicket` con ID correlativo (`TCK-CAJA_X-00001`), sellado con `roundMoney` de precisión centesimal.
   - Almacenamiento local persistente (`_bunkker_tickets_caja_X`) manteniendo los últimos 300 tickets por terminal para operación 100% offline.
   - Sincronización asíncrona hacia Firestore y base de datos relacional para auditoría centralizada.
2. **Concurrencia en Mostrador:**
   - Descuento de stock en transacción atómica (`updateProductStock`) al momento de pagar (`status: 'paid'`), evitando doble descuento si la orden pasa por patio o reparto.
3. **Ergonomía de Producción:**
   - La radio y el asistente IA operan en cuadrantes opuestos (izquierdo y derecho) previniendo cualquier obstrucción visual.
   - El carrusel inferior móvil facilita la operación con una sola mano en terminales de mano Android / PWA.

## Consecuencias
- Cero deriva en arqueos de caja (`discrepancy: 0.00`).
- Soporte multilingüe inmediato sin dependencias pesadas de terceros.
- Sistema blindado para despliegue en producción.
