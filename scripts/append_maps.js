const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../ESTRUCTURA_PROYECTO.md');
const currentContent = fs.readFileSync(targetFile, 'utf8');

const visualMap = `

---

# 🗺️ MAPA DE OPERACIONES VISUALES POR ROL (FLUJO SIMBIÓTICO EN TIEMPO REAL)

## 🛒 1. Flujo del Cliente (Catálogo Virtual)
\`\`\`mermaid
flowchart TD
    A[📱 Escanea QR Cliente] -->|?s=UUID&mode=catalog| B[Navega Catálogo / Nosotros / Contacto]
    B --> C[Agrega productos al Carrito]
    C --> D[Registro Rápido de Datos: Nombre + Teléfono/Dirección]
    D --> E[Confirmar Pedido & Generar Ticket Digital]
    E --> F[📱 Recibe Ticket Digital con Folio de Pedido]
\`\`\`

---

## 📦 2. Flujo de Almacén / Patio (Preparación y Surtido)
\`\`\`mermaid
flowchart TD
    A1[⚡ Orden de Cliente llega a 0ms] --> B1[Visualiza Pedido en Pantalla de Almacén/Patio]
    B1 --> C1[Empaca y Prepara Productos]
    C1 --> D1[Valida Ítems contra Inventario Local]
    D1 --> E1[Transfiere Paquete Preparado a Área de Entrega / Mostrador]
\`\`\`

---

## 💰 3. Flujo de Caja / POS (Cobro y Liquidación)
\`\`\`mermaid
flowchart TD
    A2[🔔 Recibe Notificación de Pedido Activo] --> B2[Selecciona Método de Pago: Efectivo / Tarjeta / Transferencia]
    B2 --> C2[Recibe Pago del Cliente]
    C2 --> D2[Marca Pedido como PAGADO (State: PAID)]
    D2 --> E2[Emite Ticket de Caja & Notifica a Carga/Descarga]
\`\`\`

---

## 🚚 4. Flujo de Carga & Descarga / Delivery (Validación y Cierre de Operación)

### 🏬 Opción A: Entrega en Tienda / Pickup / Ventanilla
\`\`\`mermaid
flowchart TD
    A3[📦 Paquete listo en Área de Entrega] --> B3[Verifica Ticket Digital con el Cliente en Ventanilla]
    B3 --> C3[Entrega Mercancía Físicamente]
    C3 --> D3[Cierra Operación (Estado: RECEIVED / DELIVERED)]
\`\`\`

### 🏍️ Opción B: Repartidor a Domicilio (Delivery)
\`\`\`mermaid
flowchart TD
    A4[🏍️ Repartidor toma Pedido 'Claim' en App] --> B4[Recoge Paquete en Almacén]
    B4 --> C4[Navega a Domicilio del Cliente]
    C4 --> D4[Entrega Mercancía + Foto/Firma de Confirmación]
    D4 --> E4[Cierra Operación en App (Estado: DELIVERED)]
\`\`\`
`;

fs.writeFileSync(targetFile, currentContent + visualMap, 'utf8');
console.log('✅ Mapa de Operaciones agregado exitosamente a ESTRUCTURA_PROYECTO.md');
