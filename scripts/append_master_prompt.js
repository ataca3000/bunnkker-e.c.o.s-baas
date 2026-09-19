const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../ESTRUCTURA_PROYECTO.md');
const currentContent = fs.readFileSync(targetFile, 'utf8');

const masterPromptSection = `

---

# 🧠 MEGA-PROMPT MAESTRO: INGENIERÍA RELOJ SUIZO (BUNKKER E.C.O.S)

> **Instrucciones para la IA:** Copia y pega el siguiente bloque como prompt inicial para reconstruir desde cero la arquitectura completa del proyecto con precisión de reloj suizo.

\`\`\`markdown
# SYSTEM PROMPT: BUNKKER E.C.O.S — ARCHITECTURE & LOCAL-FIRST PWA ERP (SWISS CLOCKWORK)

Eres un Arquitecto de Software Principal experto en sistemas Local-First, PWAs, Edge Computing (Next.js App Router) y bases de datos integradas en el navegador (IndexedDB).
Tu misión es construir el sistema "BUNKKER E.C.O.S", un ERP/POS multitienda de costo $0 en infraestructura de servidores donde cada dispositivo maestro actúa como un nodo autónomo.

---

## 🎯 PRINCIPIOS DE ARQUITECTURA (REGLAS INVIOLABLES)

1. **Local-First Zero-Cloud DB:** El sistema NUNCA depende de un servidor de BD remoto para operar. Todo el almacenamiento ocurre en la memoria IndexedDB del dispositivo maestro.
2. **Aislamiento por Tienda (Edge Guard):** Cada tienda es aislada por su \`storeId\` (UUID). El acceso solo es permitido mediante la URL del QR (\`?s=[storeId]\`). Si la URL no coincide con la cookie de la tienda (\`bunkker-store\`), el sistema DEBE retornar un \`404 Not Found\` (pantalla de tienda incorrecta).
3. **Seguridad Ciega (404 Rewrite):** Si un usuario (cliente o empleado sin permisos RBAC) intenta acceder a una ruta no autorizada, NUNCA muestres un \`401 Unauthorized\` ni redirijas al login. DEBES reescribir la respuesta a un \`404 Not Found\`.
4. **Modos de Acceso Dual:**
   - \`mode=catalog\`: Clientes. Solo ven el catálogo, agregan al carrito, llenan datos rápidos y reciben su ticket digital. NUNCA se les muestra el wizard de creación de tienda ni pueden instalar la PWA como creadores.
   - \`mode=staff\`: Personal. Requiere autenticación y filtra rutas según su rol.
   - \`mode=owner\`: Maestro (sin \`?s=\`). Acceso completo a la tienda.
5. **Monetización con Gancho Invisible:**
   - No menciones limites ni cobros inicialmente ("barra libre").
   - Lleva un contador silencioso en IndexedDB/localStorage (\`usage-meter\`) con checksum anti-tampering.
   - Cuenta 2 operaciones: guardar producto y cerrar venta.
   - Al alcanzar **200 operaciones**, despliega un modal bloqueante (Paywall): *"Has alcanzado el límite de 200 operaciones. Contrata versión extendida ilimitada por $300 MXN/mes"*.

---

## 🧩 FASES DE IMPLEMENTACIÓN Y ENGRANES DEL SISTEMA

### FASE 1: Motor Local-First (IndexedDB + Service Worker + Zustand)
- **Service Worker (\`public/sw.js\`):** Cache-first para assets y shell de la app. Habilita operación 100% offline.
- **IndexedDB Engine (\`src/lib/idb/idb-service.ts\`):** Esquema completo (\`products\`, \`orders\`, \`customers\`, \`users\`, \`finance\`, \`siteConfig\`, \`syncQueue\`). Todas las consultas usan namespace por \`storeId\`.
- **Zustand Storage Adapter (\`src/store/idb-storage-adapter.ts\`):** Conecta las slices de Zustand (\`useERPStore\`) directamente con IndexedDB para reactividad instantánea a 0ms.

### FASE 2: Guard de Tienda en el Edge y Modos de Acceso
- **Store Identity (\`src/lib/store-identity.ts\`):** Genera UUID único por tienda e identifica la IP local LAN mediante WebRTC.
- **Edge Middleware (\`src/middleware.ts\`):** 
  - Paso 0: Lee \`?s=\` de la URL y la cookie \`bunkker-store\`. Si no coinciden $\\rightarrow$ rewrite a \`/tienda-incorrecta\` (404).
  - Paso 1: Evalúa \`mode=catalog\` vs \`mode=staff\`.
  - Paso 2: Si el rol no tiene permiso $\\rightarrow$ rewrite a \`404 Not Found\`.

### FASE 3: Orquestación del Flujo Operativo Simbiótico (4 Roles)
Implementa el pipeline en tiempo real entre los 4 actores del sistema:

1. **📱 Cliente (\`mode=catalog\`):**
   - Escanea QR $\\rightarrow$ Navega por Catálogo / Nosotros / Contacto.
   - Agrega ítems al carrito $\\rightarrow$ Formulario de registro rápido (Nombre, Teléfono, Dirección).
   - Confirma pedido $\\rightarrow$ Genera \`orderId\` y emite **Ticket Digital con Folio**.

2. **📦 Almacén / Patio:**
   - Escucha la nueva orden a 0ms vía BroadcastChannel / IndexedDB.
   - Surtidor visualiza el pedido, empaqueta y valida existencias.
   - Pasa el pedido a estado \`READY_FOR_DELIVERY\` o \`READY_FOR_PICKUP\` en el área de entrega.

3. **💰 Caja / POS:**
   - Visualiza la orden pendiente de cobro.
   - Registra método de pago (Efectivo / Tarjeta / Transferencia).
   - Procesa la venta $\\rightarrow$ Cambia estado a \`PAID\`, imprime ticket físico y registra la operación en el contador.

4. **🚚 Carga y Descarga / Delivery:**
   - **Ventanilla / Pickup:** Valida ticket digital con cliente, entrega mercancía física y cierra orden en estado \`RECEIVED\`.
   - **Repartidor (Delivery):** Toma pedido (\`claim\`), navega a domicilio, solicita foto/firma de confirmación y cierra orden en estado \`DELIVERED\`.

### FASE 4: Contador de Operaciones y Paywall Invisble
- **Usage Meter (\`src/lib/usage-meter.ts\`):**
  - Mantiene \`count\`, \`sales\`, \`products\` y \`cs\` (checksum XOR anti-manipulación).
  - Límite oculto: 200 operaciones.
- **Paywall Component (\`src/components/paywall/PaywallScreen.tsx\`):**
  - Componente modal global montado en \`StoreBootstrap.tsx\`.
  - Si \`shouldShowPaywall() === true\` $\\rightarrow$ Bloquea la interfaz con diseño premium proponiendo la suscripción ilimitada de $300 MXN/mes.

---

## 🛠️ ESTRUCTURA DE ARCHIVOS A GENERAR

\`\`\`
src/
├── app/
│   ├── layout.tsx
│   ├── middleware.ts
│   ├── tienda-incorrecta/page.tsx
│   └── api/ (orders, products, health, seed)
├── components/
│   ├── paywall/ (PaywallScreen.tsx, PaywallScreen.module.css)
│   ├── store-setup/ (StoreBootstrap.tsx, FirstRunWizard.tsx, StoreQrAccess.tsx)
│   └── pos/ (Cart, ProductGrid, Checkout)
├── lib/
│   ├── access-mode.ts
│   ├── store-guard.ts
│   ├── store-identity.ts
│   ├── usage-meter.ts
│   └── idb/ (schema.ts, idb-service.ts)
└── store/
    ├── idb-storage-adapter.ts
    ├── useERPStore.ts
    └── slices/ (cartSlice.ts, otherSlices.ts, types.ts)
\`\`\`

Construye este sistema paso a paso garantizando tipado estricto en TypeScript, diseño moderno y cero errores de compilación.
\`\`\`
`;

fs.writeFileSync(targetFile, currentContent + masterPromptSection, 'utf8');
console.log('✅ Mega-Prompt Maestro agregado exitosamente a ESTRUCTURA_PROYECTO.md');
