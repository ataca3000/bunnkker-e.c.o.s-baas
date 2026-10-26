# 📘 MANUAL DE USUARIO Y GUÍA DE OPERACIÓN
## BUNKKER E.C.O.S. ERP — Sistema Local-First Industrial

---

## 📌 1. INTRODUCCIÓN Y ARRANQUE RÁPIDO

BUNKKER E.C.O.S. es un sistema ERP y Punto de Venta (POS) diseñado para operar **de forma 100% autónoma en tu red local**. Si se corta el internet o falla el enlace con la nube, el sistema continúa cobrando, registrando pedidos e imprimiendo tickets en la tienda física a velocidad instantánea (0 ms).

### 🚀 Cómo encender el sistema
1. En la computadora principal (Servidor local), abre la aplicación **BUNKKER ERP** (o ejecuta `npm run start` / `npm run dev`).
2. Verifica los servicios activos en tu consola:
   * **Servidor Web:** `http://localhost:3000` (o la IP local de tu PC, ej. `http://192.168.1.100:3000`).
   * **Servidor de Sincronización LAN:** Puerto `3001` activo.
   * **Servidor de Radio Interna:** Puerto `3002` activo.
3. Las tablets, celulares y computadoras secundarias de la tienda acceden abriendo el navegador web e ingresando: `http://<IP_DE_TU_PC>:3000`.

---

## 🔑 2. PANTALLA DE ACCESO Y ROLES DE TRABAJO

El sistema cuenta con candados de seguridad por PIN numérico para que cada trabajador entre únicamente al área que le corresponde:

| Rol | Nombre de Puesto | Acceso Permitido |
| :--- | :--- | :--- |
| **Superadmin** | Dueño / Propietario | Control total, configuración de tienda, finanzas, usuarios y borrado |
| **Admin** | Gerente de Sucursal | Reportes, inventario, ventas, auditoría y administración de personal |
| **Sales** | Cajero / Mostrador | Terminal Punto de Venta (POS), cobros, arqueos y emisión de tickets |
| **Inventory** | Bodeguero / Almacén | Altas de producto, recepción de proveedores y registro de mermas |
| **Carga/Descarga**| Patio de Maniobras | Despacho de material pesado, bultos y validación de carga |
| **Driver** | Chofer / Repartidor | Ruta de entregas, geolocalización y comprobante de entrega (PoD) |
| **Client** | Cliente / Visitante | Catálogo público, carrito de compras y seguimiento de pedidos |

---

## 🛒 3. MÓDULO DE CAJA Y PUNTO DE VENTA (POS)

Ruta: `/dashboard/sales`

### Operaciones habituales en Caja:
1. **Cobro Directo:**
   - Escribe el nombre del producto o escanea su código de barras con el lector láser.
   - Ajusta las cantidades en pantalla táctil o teclado.
   - Presiona el botón verde **COBRAR** (o tecla rápida **F10**).
   - Selecciona la forma de pago (Efectivo, Tarjeta, Transferencia).
   - Si es efectivo, escribe el monto recibido; el sistema calcula el cambio exacto automáticamente.
   - Presiona **"Confirmar e Imprimir"** para emitir el ticket físico y abrir el cajón de dinero.
2. **Corte y Arqueo de Turno (`/dashboard/sales/close-register`):**
   - Al terminar el turno, el cajero entra al menú de corte.
   - Captura el desglose de billetes y monedas contados físicamente en el cajón.
   - El sistema compara contra el total registrado en el sistema y emite el comprobante de cierre indicando si la caja cuadró, sobró o faltó dinero.

---

## 📦 4. MÓDULO DE INVENTARIO Y ALMACÉN

Ruta: `/dashboard/inventory`

* **Alta de Mercancía:** Registra nuevos productos indicando Nombre, Categoría, Precio de Venta, Costo y Existencias iniciales.
* **Reserva Flotante (Anti-Sobreventa):** Cuando una caja empieza a cobrar un artículo o un cliente lo aparta, el inventario pasa temporalmente a estado `reservedStock`. Ninguna otra terminal puede vender esa misma pieza al mismo tiempo.
* **Registro de Mermas:**
  - Si un producto se rompe, caduca o se deteriora, se da de baja registrando el motivo (Roto, Caducado, Ajuste de Conteo) y el empleado responsable para auditoría interna.

---

## 🏗️ 5. PATIO DE MANIOBRAS Y DESPACHO

Ruta: `/dashboard/patio`

Diseñado para tablets en bodegas o patios de materiales:
1. Las órdenes pagadas en caja caen en tiempo real en la pantalla de Patio.
2. El personal de patio presiona **"Tomar Carga"** (la orden queda marcada para que dos estibadores no surtan el mismo pedido dos veces).
3. Conforme montan los bultos o mercancía en el camión del cliente o del chofer, marcan cada producto como verificado.
4. Presionan **"Completar Carga"** para liberar el pedido.

---

## 🚚 6. REPARTO Y ENTREGAS (DELIVERY)

Ruta: `/dashboard/delivery`

* **Asignación de Ruta:** Los pedidos con entrega a domicilio aparecen con su dirección, referencias y mapa interactivo.
* **PIN de Entrega Seguro:** Cada ticket de reparto contiene un código de validación de 4 dígitos.
* **Prueba de Entrega (PoD):**
  - Al llegar al domicilio, el chofer solicita el PIN al cliente o captura la firma digital en la pantalla del celular.
  - Al confirmar, el pedido pasa a estado `DELIVERED` y se descuenta el stock final.

---

## 🌐 7. CATÁLOGO DIGITAL PARA CLIENTES

Ruta: `/catalogo`

Los clientes en la tienda o desde su celular pueden escanear el código QR colocado en mostradores:
1. **Navegación:** Consultan precios, fotos y existencias reales.
2. **Creación de Pedido:** Agregan artículos al carrito y seleccionan **"Pagar en Caja"** o pago en línea con MercadoPago.
3. El pedido llega al pizarrón de caja como solicitud pendiente; el cajero lo cobra y el pedido se procesa de inmediato.

---

## 🖨️ 8. IMPRESORAS TÉRMICAS Y TICKETS

* **Impresión en Red (Wi-Fi / Ethernet):**
  - El sistema se conecta directo por socket TCP al puerto `9100` de cualquier impresora térmica estándar (58mm u 80mm ESC/POS como Epson, Xprinter, POS-58, etc.).
  - No requiere drivers complicados de Windows.
* **Tickets Digitales:**
  - Cada ticket incluye un código QR que el cliente puede escanear con su propio teléfono para llevarse su comprobante en PDF sin gastar papel.

---

## 🛡️ 9. SEGURIDAD Y RESPALDOS

1. **Respaldos Automáticos:**
   - La base de datos SQLite genera copias atómicas en disco.
   - En el menú de Administrador puedes descargar en cualquier momento el archivo de respaldo completo en formato JSON con firma SHA-256 (`/api/backup`).
2. **Cierre de Sesión:**
   - Siempre cierra tu turno antes de dejar la terminal desatendida.
   - Las sesiones de trabajadores expiran en 24 horas y están protegidas con firma criptográfica local.
