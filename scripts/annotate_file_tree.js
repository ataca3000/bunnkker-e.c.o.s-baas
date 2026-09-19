const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, '../ESTRUCTURA_PROYECTO.md');
const content = fs.readFileSync(targetFile, 'utf8');

const oldTreeStart = '## 🛠️ ESTRUCTURA DE ARCHIVOS A GENERAR';
const oldTreeEnd = '```\n\nConstruye este sistema';

const annotatedTree = `## 🛠️ ESTRUCTURA DE ARCHIVOS A GENERAR (CON PROPOSITO EXPLICITO)

\`\`\`
src/
├── app/
│   ├── layout.tsx                     # Root Layout + HOC StoreBootstrap + Registro SW PWA
│   ├── middleware.ts                 # Paso 0: Edge Store Guard (?s= vs cookie) + RBAC 404 Rewrite
│   ├── tienda-incorrecta/page.tsx     # Pantalla 404 neutra cuando storeId de la URL no coincide
│   └── api/
│       ├── orders/route.ts            # API Orders ACID + Local Sync + Event Trigger
│       ├── products/route.ts          # API Productos CRUD + Metering Product Save
│       ├── health/route.ts            # Liveness & Health check
│       └── seed/route.ts              # Semilla inicial de demostración (Opcional)
├── components/
│   ├── paywall/
│   │   ├── PaywallScreen.tsx          # Modal global de suscripción al llegar a 200 ops ($300/mes)
│   │   └── PaywallScreen.module.css   # Estilos dark/glassmorphism para Paywall
│   ├── store-setup/
│   │   ├── StoreBootstrap.tsx         # SW Register + Orquestador de primer uso & Paywall
│   │   ├── FirstRunWizard.tsx         # Wizard 3 pasos para crear nueva tienda maestro
│   │   └── StoreQrAccess.tsx          # Selector de QR Doble (Cliente mode=catalog vs Staff mode=staff)
│   └── pos/
│       ├── Cart.tsx                   # Carrito interactivo + Mutex Multicaja a 0ms
│       ├── ProductGrid.tsx            # Grilla de productos reactiva desde IndexedDB
│       └── Checkout.tsx               # Cierre de venta + Impresión de Ticket + Trigger Meter
├── lib/
│   ├── access-mode.ts                 # Detección de modos de acceso (catalog | staff | owner)
│   ├── store-guard.ts                 # Validación Edge-compatible de storeId (?s= vs cookie)
│   ├── store-identity.ts              # UUID por tienda, IP local LAN (WebRTC) y URL de QR
│   ├── usage-meter.ts                 # Contador silencioso de 200 ops con Checksum XOR anti-tampering
│   ├── sw-register.ts                 # Registro y actualización de Service Worker PWA
│   └── idb/
│       ├── schema.ts                  # Esquema IndexedDB (products, orders, customers, finance, syncQueue)
│       └── idb-service.ts             # API CRUD unificada namespaciada por storeId
└── store/
    ├── idb-storage-adapter.ts         # Adapter Zustand StateStorage para IndexedDB
    ├── useERPStore.ts                 # Store global Zustand reactivo con persistencia local
    └── slices/
        ├── cartSlice.ts               # Lógica de carrito, reservas a 30min y BroadcastChannel
        ├── otherSlices.ts             # Products, Orders, Config, Finance slices + Op triggers
        └── types.ts                   # Interfaces TypeScript unificadas del ERP/POS
\`\`\`

Construye este sistema`;

let updatedContent = content;
if (content.includes(oldTreeStart)) {
    const startIndex = content.indexOf(oldTreeStart);
    const endIndex = content.indexOf('Construye este sistema', startIndex);
    if (endIndex !== -1) {
        updatedContent = content.slice(0, startIndex) + annotatedTree + content.slice(endIndex + 'Construye este sistema'.length);
    }
}

fs.writeFileSync(targetFile, updatedContent, 'utf8');
console.log('✅ Estructura con comentarios anotados actualizada con exito en ESTRUCTURA_PROYECTO.md');
