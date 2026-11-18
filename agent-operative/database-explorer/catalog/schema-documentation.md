# BUNKKER OIL — Catálogo de Esquema de Base de Datos (Fase 1 Solo Lectura)

- **Generado:** 2026-11-17T02:08:32.470Z
- **Modo de Fuente:** `prisma_sqlite_mirror`
- **Origen:** `/app/applet/prisma/schema.sqlite.prisma`
- **Protección:** `readOnly: true` / `PRAGMA query_only = ON`

## Resumen de Introspección

| Métrica | Cantidad |
| :--- | ---: |
| Tablas detectadas | 14 |
| Relaciones FK declaradas | 4 |
| Enlaces semánticos detectados | 7 |
| Índices detectados | 24 |
| Vistas detectadas | 0 |
| Triggers detectados | 0 |
| Tablas de auditoría e historial | 5 |
| Módulos funcionales mapeados | 7 |

## Catálogo de Módulos

### Ventas y Caja
- **Propósito:** Cobros, estados de venta abierta/cerrada, métodos de pago y cortes ciegos de caja.
- **Tablas:** `CashRegisterLog`, `Order`, `OrderEvent`, `OrderItem`, `SwarmTransaction`
- **Auditoría/Trazabilidad:** `CashRegisterLog`, `OrderEvent`

### Inventario y Stock
- **Propósito:** Existencias físicas, stock reservado, ubicaciones en anaquel, mermas y compras.
- **Tablas:** `Product`, `Purchase`, `ShrinkageLog`
- **Auditoría/Trazabilidad:** `ShrinkageLog`

### Clientes y Soporte
- **Propósito:** Identidad comercial/fiscal de clientes, tickets de soporte e historial vinculado.
- **Tablas:** `Customer`, `SupportTicket`

### Pedidos y Logística
- **Propósito:** Trazabilidad operativa de surtido, patio de carga, ruta y prueba de entrega (PoD).
- **Tablas:** `OrderEvent`
- **Auditoría/Trazabilidad:** `OrderEvent`

### Roles y Seguridad
- **Propósito:** Operadores del ERP, roles RBAC, PIN/credenciales y estado activo.
- **Tablas:** `User`

### Auditoría e Integridad
- **Propósito:** Bitácora inmutable de cambios de precio, stock, cancelaciones y discrepancias.
- **Tablas:** `AuditLog`, `CashRegisterLog`, `OrderEvent`, `ShrinkageLog`
- **Auditoría/Trazabilidad:** `AuditLog`, `CashRegisterLog`, `OrderEvent`, `ShrinkageLog`

### Sincronización y Configuración
- **Propósito:** Cola distribuida local-first, licenciamiento y conectores externos.
- **Tablas:** `AppConfig`, `SyncQueue`
- **Auditoría/Trazabilidad:** `SyncQueue`

## Detalle de Tablas y Columnas

### `AppConfig` (Sincronización y Configuración)
- **PK:** id · **Multi-tenant:** Sí (`tenantId`) · **Auditoría:** No

| Columna | Tipo SQLite | Nulo | PK | Default |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `TEXT` | SÍ | PK | `'global'` |
| `licenseType` | `TEXT` | NO |  | `'TRIAL'` |
| `tenantId` | `TEXT` | SÍ |  |  |
| `cloudToken` | `TEXT` | SÍ |  |  |
| `pairedAt` | `DATETIME` | SÍ |  |  |
| `lastBackupAt` | `DATETIME` | SÍ |  |  |
| `lastBackupSize` | `INTEGER` | SÍ |  |  |
| `lastBackupHash` | `TEXT` | SÍ |  |  |
| `updatedAt` | `DATETIME` | NO |  |  |

### `AuditLog` (Auditoría e Integridad)
- **PK:** id · **Multi-tenant:** Sí (`tenantId`) · **Auditoría:** Sí

| Columna | Tipo SQLite | Nulo | PK | Default |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `TEXT` | SÍ | PK |  |
| `tenantId` | `TEXT` | NO |  | `'default'` |
| `action` | `TEXT` | NO |  |  |
| `details` | `TEXT` | SÍ |  |  |
| `userId` | `TEXT` | NO |  |  |
| `timestamp` | `DATETIME` | NO |  | `CURRENT_TIMESTAMP` |
| `synced` | `INTEGER` | NO |  | `0` |

### `CashRegisterLog` (Ventas y Caja)
- **PK:** id · **Multi-tenant:** Sí (`tenantId`) · **Auditoría:** Sí

| Columna | Tipo SQLite | Nulo | PK | Default |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `TEXT` | SÍ | PK |  |
| `tenantId` | `TEXT` | NO |  |  |
| `cashierId` | `TEXT` | NO |  |  |
| `cashierName` | `TEXT` | NO |  |  |
| `declaredAmount` | `REAL` | NO |  |  |
| `expectedAmount` | `REAL` | NO |  |  |
| `discrepancy` | `REAL` | NO |  |  |
| `createdAt` | `DATETIME` | NO |  | `CURRENT_TIMESTAMP` |
| `synced` | `INTEGER` | NO |  | `0` |

### `Customer` (Clientes y Soporte)
- **PK:** id · **Multi-tenant:** Sí (`tenantId`) · **Auditoría:** No

| Columna | Tipo SQLite | Nulo | PK | Default |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `TEXT` | SÍ | PK |  |
| `tenantId` | `TEXT` | NO |  | `'default'` |
| `name` | `TEXT` | NO |  |  |
| `phone` | `TEXT` | NO |  |  |
| `email` | `TEXT` | SÍ |  |  |
| `address` | `TEXT` | SÍ |  |  |
| `references` | `TEXT` | SÍ |  |  |
| `gpsCoords` | `TEXT` | SÍ |  |  |
| `pin` | `TEXT` | SÍ |  |  |
| `rfc` | `TEXT` | SÍ |  |  |
| `razonSocial` | `TEXT` | SÍ |  |  |
| `regimenFiscal` | `TEXT` | SÍ |  |  |
| `usoCFDI` | `TEXT` | SÍ |  |  |
| `codigoPostal` | `TEXT` | SÍ |  |  |
| `createdAt` | `DATETIME` | NO |  | `CURRENT_TIMESTAMP` |

### `Order` (Ventas y Caja)
- **PK:** id · **Multi-tenant:** Sí (`tenantId`) · **Auditoría:** No
- **Relaciones salientes:** `customerId` → `Customer.id` (ON DELETE NO ACTION)

| Columna | Tipo SQLite | Nulo | PK | Default |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `TEXT` | SÍ | PK |  |
| `tenantId` | `TEXT` | NO |  | `'default'` |
| `total` | `REAL` | NO |  |  |
| `paymentMethod` | `TEXT` | NO |  |  |
| `status` | `TEXT` | NO |  | `'paid'` |
| `deliveryType` | `TEXT` | NO |  | `'LOCAL'` |
| `date` | `DATETIME` | NO |  | `CURRENT_TIMESTAMP` |
| `expiresAt` | `DATETIME` | SÍ |  |  |
| `offline` | `INTEGER` | NO |  | `1` |
| `synced` | `INTEGER` | NO |  | `0` |
| `ventanilla` | `TEXT` | SÍ |  |  |
| `cajon` | `TEXT` | SÍ |  |  |
| `vendedorId` | `TEXT` | SÍ |  |  |
| `vendedorName` | `TEXT` | SÍ |  |  |
| `confirmedAt` | `DATETIME` | SÍ |  |  |
| `deliveryPin` | `TEXT` | SÍ |  |  |
| `deliveryLat` | `REAL` | SÍ |  |  |
| `deliveryLng` | `REAL` | SÍ |  |  |
| `deliveryAddress` | `TEXT` | SÍ |  |  |
| `loadedBy` | `TEXT` | SÍ |  |  |
| `loadedByUid` | `TEXT` | SÍ |  |  |
| `loadingStartedAt` | `DATETIME` | SÍ |  |  |
| `loadingFinishedAt` | `DATETIME` | SÍ |  |  |
| `isLoaded` | `INTEGER` | NO |  | `0` |
| `assignedDriverId` | `TEXT` | SÍ |  |  |
| `signatureData` | `TEXT` | SÍ |  |  |
| `photoData` | `TEXT` | SÍ |  |  |
| `completedAt` | `DATETIME` | SÍ |  |  |
| `rejectionReason` | `TEXT` | SÍ |  |  |
| `customerId` | `TEXT` | SÍ |  |  |

### `OrderEvent` (Ventas y Caja)
- **PK:** id · **Multi-tenant:** Sí (`tenantId`) · **Auditoría:** Sí
- **Relaciones salientes:** `orderId` → `Order.id` (ON DELETE CASCADE)

| Columna | Tipo SQLite | Nulo | PK | Default |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `TEXT` | SÍ | PK |  |
| `tenantId` | `TEXT` | NO |  | `'default'` |
| `orderId` | `TEXT` | NO |  |  |
| `eventType` | `TEXT` | NO |  |  |
| `fromStatus` | `TEXT` | SÍ |  |  |
| `toStatus` | `TEXT` | SÍ |  |  |
| `actorId` | `TEXT` | NO |  |  |
| `actorName` | `TEXT` | NO |  |  |
| `actorRole` | `TEXT` | NO |  |  |
| `details` | `TEXT` | SÍ |  |  |
| `createdAt` | `DATETIME` | NO |  | `CURRENT_TIMESTAMP` |

### `OrderItem` (Ventas y Caja)
- **PK:** id · **Multi-tenant:** Sí (`tenantId`) · **Auditoría:** No
- **Relaciones salientes:** `productId` → `Product.id` (ON DELETE NO ACTION); `orderId` → `Order.id` (ON DELETE CASCADE)

| Columna | Tipo SQLite | Nulo | PK | Default |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `TEXT` | SÍ | PK |  |
| `tenantId` | `TEXT` | NO |  | `'default'` |
| `orderId` | `TEXT` | NO |  |  |
| `productId` | `TEXT` | NO |  |  |
| `cantidad` | `INTEGER` | NO |  |  |
| `precio` | `REAL` | NO |  |  |

### `Product` (Inventario y Stock)
- **PK:** id · **Multi-tenant:** Sí (`tenantId`) · **Auditoría:** No

| Columna | Tipo SQLite | Nulo | PK | Default |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `TEXT` | SÍ | PK |  |
| `tenantId` | `TEXT` | NO |  | `'default'` |
| `name` | `TEXT` | NO |  |  |
| `price` | `REAL` | NO |  |  |
| `stock` | `INTEGER` | NO |  | `0` |
| `reservedStock` | `INTEGER` | NO |  | `0` |
| `category` | `TEXT` | SÍ |  |  |
| `image` | `TEXT` | SÍ |  |  |
| `rating` | `REAL` | SÍ |  |  |
| `reviewCount` | `INTEGER` | SÍ |  |  |
| `barcode` | `TEXT` | SÍ |  |  |
| `description` | `TEXT` | SÍ |  |  |
| `estante` | `TEXT` | SÍ |  |  |
| `fila` | `TEXT` | SÍ |  |  |
| `orderIndex` | `INTEGER` | NO |  | `0` |
| `deletedAt` | `DATETIME` | SÍ |  |  |

### `Purchase` (Inventario y Stock)
- **PK:** id · **Multi-tenant:** Sí (`tenantId`) · **Auditoría:** No

| Columna | Tipo SQLite | Nulo | PK | Default |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `TEXT` | SÍ | PK |  |
| `tenantId` | `TEXT` | NO |  | `'default'` |
| `supplier` | `TEXT` | NO |  |  |
| `concept` | `TEXT` | NO |  |  |
| `amount` | `REAL` | NO |  |  |
| `status` | `TEXT` | NO |  | `'Pendiente'` |
| `createdAt` | `DATETIME` | NO |  | `CURRENT_TIMESTAMP` |
| `synced` | `INTEGER` | NO |  | `0` |

### `ShrinkageLog` (Inventario y Stock)
- **PK:** id · **Multi-tenant:** Sí (`tenantId`) · **Auditoría:** Sí

| Columna | Tipo SQLite | Nulo | PK | Default |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `TEXT` | SÍ | PK |  |
| `tenantId` | `TEXT` | NO |  | `'default'` |
| `productId` | `TEXT` | NO |  |  |
| `productName` | `TEXT` | NO |  |  |
| `productCategory` | `TEXT` | NO |  |  |
| `discrepancyType` | `TEXT` | NO |  |  |
| `qty` | `INTEGER` | NO |  |  |
| `estimatedLoss` | `REAL` | NO |  |  |
| `notes` | `TEXT` | NO |  |  |
| `reportedBy` | `TEXT` | NO |  |  |
| `createdAt` | `DATETIME` | NO |  | `CURRENT_TIMESTAMP` |

### `SupportTicket` (Clientes y Soporte)
- **PK:** id · **Multi-tenant:** Sí (`tenantId`) · **Auditoría:** No

| Columna | Tipo SQLite | Nulo | PK | Default |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `TEXT` | SÍ | PK |  |
| `folio` | `TEXT` | NO |  |  |
| `tenantId` | `TEXT` | NO |  | `'default'` |
| `customerEmail` | `TEXT` | NO |  |  |
| `customerName` | `TEXT` | NO |  |  |
| `message` | `TEXT` | NO |  |  |
| `status` | `TEXT` | NO |  | `'Pendiente'` |
| `createdAt` | `DATETIME` | NO |  | `CURRENT_TIMESTAMP` |
| `synced` | `INTEGER` | NO |  | `0` |

### `SwarmTransaction` (Ventas y Caja)
- **PK:** id · **Multi-tenant:** Sí (`tenantId`) · **Auditoría:** No

| Columna | Tipo SQLite | Nulo | PK | Default |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `TEXT` | SÍ | PK |  |
| `tenantId` | `TEXT` | NO |  | `'default'` |
| `requestingNode` | `TEXT` | NO |  |  |
| `providingNode` | `TEXT` | NO |  |  |
| `productId` | `TEXT` | NO |  |  |
| `qty` | `INTEGER` | NO |  |  |
| `reservedAt` | `DATETIME` | NO |  | `CURRENT_TIMESTAMP` |
| `expiresAt` | `DATETIME` | NO |  |  |
| `status` | `TEXT` | NO |  | `'RESERVED'` |
| `commissionEarned` | `REAL` | NO |  | `0` |

### `SyncQueue` (Sincronización y Configuración)
- **PK:** id · **Multi-tenant:** Sí (`tenantId`) · **Auditoría:** Sí

| Columna | Tipo SQLite | Nulo | PK | Default |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `TEXT` | SÍ | PK |  |
| `tenantId` | `TEXT` | NO |  | `'default'` |
| `collection` | `TEXT` | NO |  |  |
| `documentId` | `TEXT` | SÍ |  |  |
| `action` | `TEXT` | NO |  |  |
| `payload` | `TEXT` | NO |  |  |
| `createdAt` | `DATETIME` | NO |  | `CURRENT_TIMESTAMP` |
| `status` | `TEXT` | NO |  | `'PENDING'` |
| `errorMsg` | `TEXT` | SÍ |  |  |
| `retryCount` | `INTEGER` | NO |  | `0` |
| `processAfter` | `DATETIME` | SÍ |  |  |

### `User` (Roles y Seguridad)
- **PK:** id · **Multi-tenant:** Sí (`tenantId`) · **Auditoría:** No

| Columna | Tipo SQLite | Nulo | PK | Default |
| :--- | :--- | :---: | :---: | :--- |
| `id` | `TEXT` | SÍ | PK |  |
| `tenantId` | `TEXT` | NO |  | `'default'` |
| `name` | `TEXT` | NO |  |  |
| `email` | `TEXT` | SÍ |  |  |
| `pin` | `TEXT` | SÍ |  |  |
| `pinHash` | `TEXT` | SÍ |  |  |
| `deviceId` | `TEXT` | SÍ |  |  |
| `role` | `TEXT` | NO |  | `'sales'` |
| `active` | `INTEGER` | NO |  | `1` |
| `createdAt` | `DATETIME` | NO |  | `CURRENT_TIMESTAMP` |
| `synced` | `INTEGER` | NO |  | `0` |

