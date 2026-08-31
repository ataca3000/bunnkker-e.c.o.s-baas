# 📡 Referencia de API Endpoints

Catálogo completo de API Routes expuestas en BUNKKER E.C.O.S. (BaaS y Local Edge).

## 🛒 Productos e Inventario

### `GET /api/products`
Obtiene la lista de productos del catálogo local o en la nube.
- **Query Params**: `tenantId`, `category`, `search`
- **Response**: `200 OK` Array de `Product`

### `POST /api/products`
Crea un nuevo producto en el catálogo.
- **Body**: `{ name, price, stock, category, barcode, estante, fila }`
- **Response**: `201 Created` Objeto `Product`

### `PUT /api/products/[id]`
Actualiza los datos o stock de un producto existente.

---

## 🧾 Ventas y Órdenes POS

### `POST /api/orders`
Registra una venta local u online.
- **Body**: `{ items: [{ productId, cantidad, precio }], paymentMethod, deliveryType, customerId, total }`
- **Response**: `200 OK` Objeto `Order` con ticket digital generado.

### `GET /api/orders`
Obtiene el historial de órdenes filtrado por rango de fechas o estado (`paid`, `OUT_FOR_DELIVERY`, etc.).

---

## 🔄 Sincronización Local ↔ Nube

### `POST /api/sync/apply`
Aplica cambios locales a la nube o resuelve diferencias de versión.
- **Headers**: `X-Sync-ID`, `X-Device-ID`
- **Body**: `{ action, payload, collection }`

### `GET /api/sync/status`
Retorna el estado de la cola de sincronización (`SyncQueue`).

---

## 🐝 Enjambre P2P (Reservas y Red)

### `POST /api/ai-swarm/query`
Consulta existencias de inventario en nodos vecinos mediante mDNS / Red Local.

### `POST /api/ai-swarm/reserve`
Reserva temporales de stock entre nodos de la red comercial local con cálculo de comisión por intermediación.
