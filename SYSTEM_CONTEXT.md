# SYSTEM_CONTEXT — BUNKKER Operational Intelligence Layer (OIL)

## 1. Propósito de BUNKKER OIL

**BUNKKER Operational Intelligence Layer (OIL)** es una capa de inteligencia operativa montada sobre la arquitectura ya existente de **BUNKKER E.C.O.S.** Su función NO es reemplazar dashboards ni duplicar motores de negocio, sino **comprender, relacionar, comparar y auditar** los outputs producidos por los módulos reales del ERP.

### Principios Inviolables
1. **Cero duplicación de motores**: No existe un segundo inventario, un segundo POS, una segunda contabilidad ni reglas de permisos paralelas. Todo análisis parte de las tablas, eventos y configuraciones reales de BUNKKER.
2. **Fase 1 estrictamente de solo lectura**: El explorador de base de datos opera bajo `readOnly: true`, `PRAGMA query_only = ON` y un guardia SQL que bloquea cualquier mutación (`INSERT`, `UPDATE`, `DELETE`, `ALTER`, `DROP`, `CREATE`, etc.).
3. **Aislamiento multi-tenant (`tenantId`)**: Toda lectura operativa debe segmentarse por `tenantId` (`"default"` en instalación local única) sin cruzar datos entre negocios distintos.
4. **Respeto a jerarquía RBAC y SuperAdmin**: El acceso transversal a auditoría completa, precios y topología de esquema está restringido a `superadmin` / `admin` autenticados.

---

## 2. Mapa Semántico de Módulos y Entidades

| Dominio OIL | Tablas Principales | Qué Debe Comprender el Agente |
| :--- | :--- | :--- |
| **Ventas y Caja** | `Order`, `OrderItem`, `CashRegisterLog`, `SwarmTransaction` | Estados de cobro, importes, métodos de pago (`cash`, `card`, `transfer`, `mercado_pago`, `stripe`), órdenes abiertas vs liquidadas, cortes ciegos de caja (`declaredAmount` vs `expectedAmount` = `discrepancy`). |
| **Stock e Inventario** | `Product`, `ShrinkageLog`, `Purchase` | Existencia física (`stock`), unidades apartadas (`reservedStock`), disponibilidad neta (`stock - reservedStock`), ubicación (`estante`, `fila`), papelera lógica (`deletedAt`), código de barras (`barcode`), mermas (`ShrinkageLog`) y compras/reabasto (`Purchase`). |
| **Roles y Accesos** | `User`, RBAC (`src/lib/rbac.ts`, `src/lib/roleCapabilities.ts`) | Identidad del operador, estado activo (`active`), dispositivo (`deviceId`) y alcances por rol: `superadmin` (control total + precios + auditoría), `admin` (supervisión operativa), `sales` (POS/caja), `inventory` (conteo físico doble-ciego sin edición de precio), `billing` (CFDI), `marketing`, `driver`, `carga_descarga`, `pickup`. |
| **Clientes y Soporte** | `Customer`, `SupportTicket` | Identidad por negocio (`@@unique([tenantId, phone])`), datos fiscales CFDI 4.0 (`rfc`, `razonSocial`, `regimenFiscal`, `usoCFDI`, `codigoPostal`), coordenadas GPS e historial de pedidos asociados y tickets de soporte. |
| **Pedidos y Logística** | `Order`, `OrderItem`, `OrderEvent` | Ciclo de vida desde reserva temporal (`expiresAt`) hasta cobro (`confirmedAt`), surtido/patio (`loadedBy`, `loadingStartedAt`, `loadingFinishedAt`, `isLoaded`), reparto (`assignedDriverId`, `deliveryPin`, `deliveryLat`, `deliveryLng`) y prueba de entrega (`signatureData`, `photoData`, `completedAt`, `rejectionReason`). |
| **Auditoría y Sincronización** | `AuditLog`, `OrderEvent`, `ShrinkageLog`, `SyncQueue`, `AppConfig`, `IntegrationConfig` | Trazabilidad inmutable de mutaciones (`PRICE_CHANGE`, `STOCK_UPDATE`, `ORDER_CANCELLED`, `ORDER_ABANDONED`, `SECURITY_ALERT`, `SHRINKAGE`, `CORTE_CAJA_CIEGO`), cola de sincronización distribuida (`SyncQueue`) y estado de integraciones externas. |

---

## 3. Semántica de Estados de Venta y Pedido (`Order.status`)

- **Operaciones Abiertas / En Proceso**:
  - `pending_payment` / `reserved`: Reserva temporal con descuento en `reservedStock` y vencimiento en `expiresAt`. No debe contabilizarse como venta cobrada.
  - `preparing` / `ready` / `loaded` / `on_route`: Venta ya confirmada/en despacho logístico con seguimiento físico mediante `OrderEvent`.
- **Operaciones Cerradas (Ingreso Real)**:
  - `paid` / `delivered` / `completed`: Transacción confirmada (`confirmedAt` / `completedAt`), stock descontado definitivamente y sujeta a facturación y corte de caja.
- **Operaciones Anuladas o Expiradas**:
  - `cancelled`: Venta cancelada manualmente; requiere motivo (`rejectionReason`) y registro en `OrderEvent` / `AuditLog`.
  - `expired`: Reserva expirada cuyo `reservedStock` debe haberse liberado automáticamente.

---

## 4. Correlación Cruzada para Detección de Anomalías (Ejemplo Canónico)

Cuando OIL analiza una **venta cancelada o anómala**, debe correlacionar automáticamente 6 fuentes existentes sin modificar datos:

1. **Venta original (`Order`)**: `id`, `tenantId`, `total`, `status`, `paymentMethod`, `date`, `confirmedAt`, `rejectionReason`, `vendedorId`.
2. **Operador y Rol (`User`)**: Validar si `actorId` / `vendedorId` existe, está `active = true` y si su `role` tenía capacidad legítima para cancelar o ajustar la orden en esa etapa.
3. **Línea de tiempo del Pedido (`OrderEvent`)**: Revisar secuencia `fromStatus -> toStatus` y tiempo transcurrido (ej. cancelación posterior a `delivered` o sin evento previo de cobro).
4. **Productos involucrados (`OrderItem` -> `Product`)**: Identificar artículos, cantidades (`cantidad`) y precio aplicado (`precio`) frente al precio vigente (`Product.price`).
5. **Impacto en Inventario (`Product` + `ShrinkageLog`)**: Contrastar si la cancelación devolvió `stock`/`reservedStock` coherentemente o generó una diferencia física o merma no justificada.
6. **Registro de Auditoría (`AuditLog` y `CashRegisterLog`)**: Cruzar con eventos `ORDER_CANCELLED`, `PRICE_CHANGE`, `STOCK_UPDATE` o discrepancias negativas en el corte ciego (`CashRegisterLog.discrepancy < 0`).

Con esta correlación el agente distingue entre una **cancelación legítima** (reserva expirada o devolución autorizada con reingreso trazado) y una **operación sospechosa** (cancelación post-entrega hecha por rol no autorizado, con descuadre en caja o sin retorno de inventario).

---

## 5. Arquitectura Progresiva de BUNKKER OIL

- **Fase 1 (Actual) — Database Schema Explorer (Solo Lectura)**:
  Módulo `agent-operative/database-explorer/` que inspecciona SQLite con `sqlite_master` y `PRAGMA` (`table_info`, `table_xinfo`, `foreign_key_list`, `index_list`, `index_info`) bajo guardia estricta `query_only = ON`, generando el catálogo estructurado (`catalog/schema-catalog.json`) y su documentación (`catalog/schema-documentation.md`).
- **Fases Posteriores**:
  Motores de lectura semántica sobre outputs de Ventas, Stock, Clientes, Roles y Auditoría conectados a este catálogo verificado.
