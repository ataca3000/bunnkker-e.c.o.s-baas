# 🗂️ ESTRUCTURA DEL PROYECTO — ADMIN.COM ERP

> Mapa de la estructura física del código del ERP.
> Última actualización: 2026-06-12

---

```
admin.com/
│
├── 📄 .env.example
├── 📄 .firebaserc
├── 📄 .gitignore
├── 📄 .markdownlint.json
├── 📄 .markdownlintignore
├── 📄 Dockerfile
├── 📄 docker-compose.yml
│
├── 📄 AI_CLASSIFICATION_FINAL_CHECKLIST.md
├── 📄 AI_CLASSIFICATION_IMPLEMENTATION_SUMMARY.md
├── 📄 AI_PRODUCT_CLASSIFICATION_PLAN.md
├── 📄 ARCHITECTURE.md
├── 📄 CONTRIBUTING.md
├── 📄 FILE_MANIFEST.md
├── 📄 FUNCTIONALITY_MAP.md
├── 📄 POLICIES.md
├── 📄 PROJECT_TREE.md                    ← Este archivo
├── 📄 QUICK_START_AI_CLASSIFICATION.md
├── 📄 README.md
├── 📄 ROLES_MAP.md
│
├── 📁 docs/
│   ├── 📄 ARCHITECTURE.md
│   └── 📄 PROJECT_STRUCTURE.md
│
├── 📄 electron-main.js
├── 📄 package.json
├── 📄 tsconfig.json
├── 📄 start-server.bat
│
├── 📁 scripts/
│   └── 📄 test-logic.js                  ← Suite de pruebas automáticas en terminal (CLI)
│
├── 📁 public/
│   ├── 🖼️ icon.svg
│   └── 📄 robots.txt
│
└── 📁 src/
    ├── 📄 middleware.ts                  ← Interceptor de seguridad por cookies de rol/licencia
    ├── 📄 proxy.ts                       ← Redirección local
    │
    ├── 📁 app/                           ← Next.js App Router
    │   ├── 📄 globals.css
    │   ├── 📄 layout.tsx                 ← Envoltura de PWA (Providers, Tour, Asistente)
    │   ├── 📄 manifest.ts                ← Metadatos de PWA para móviles
    │   ├── 📄 page.tsx                   ← Landing corporativa principal
    │   │
    │   ├── 📁 [branchId]/                ← Vista pública por sucursal
    │   │   └── 📄 page.tsx
    │   │
    │   ├── 📁 api/                       ← API Endpoints (Backend Serverless)
    │   │   ├── 📁 ai/
    │   │   │   └── 📁 classify-product/
    │   │   │       └── 📄 route.ts       ← Clasificación de producto (Local + OpenAI/Firestore)
    │   │   ├── 📁 billing/               ← Procesador de Facturación (SAT 4.0 Facturapi)
    │   │   ├── 📁 checkout/              ← Checkout y pasarela de pago (Stripe)
    │   │   ├── 📁 licenses/              ← Validación remota de Licencias PRO
    │   │   └── 📁 notify/                ← Webhooks y alertas por WhatsApp
    │   │
    │   ├── 📁 catalogo/                  ← Marketplace Público: E-commerce autoadministrado
    │   │   ├── 📄 page.tsx
    │   │   └── 📁 [category]/            ← Rutas dinámicas por categoría
    │   │       └── 📄 page.tsx
    │   │
    │   ├── 📁 carrito/                   ← Carrito de compras del cliente
    │   │   └── 📁 checkout/
    │   │       └── 📄 page.tsx           ← Checkout con solicitud de factura y pago en tienda
    │   │
    │   ├── 📁 onboarding/                ← Setup Wizard dinámico de primer uso
    │   │   └── 📄 page.tsx
    │   │
    │   ├── 📁 register-tenant/           ← Registro inicial del Super Admin único
    │   │   └── 📄 page.tsx
    │   │
    │   ├── 📁 login/                     ← Login unificado camuflado (Redirección por rol)
    │   │   └── 📄 page.tsx
    │   │
    │   ├── 📁 dashboard/                 ← Backoffice / Consola Privada del ERP
    │   │   ├── 📄 page.tsx               ← Dashboard General (KPIs, cajas y saldos)
    │   │   │
    │   │   ├── 📁 admin/                 ← Administración del sistema
    │   │   │   ├── 📁 sales/             ← Monitor de Ventas global
    │   │   │   └── 📁 users/             ← Editor de personal y roles
    │   │   │
    │   │   ├── 📁 sales/                 ← POS de Ventas para Cajero (Escáner y Caja Ciega)
    │   │   │   └── 📄 page.tsx
    │   │   │
    │   │   ├── 📁 audit/                 ← Radar de Auditoría inmutable
    │   │   │   └── 📄 page.tsx
    │   │   │
    │   │   ├── 📁 billing/               ← Panel de Facturación SAT
    │   │   │   └── 📄 page.tsx
    │   │   │
    │   │   ├── 📁 design/                ← Constructor Visual Canvas (Edición en Vivo)
    │   │   │   └── 📄 page.tsx
    │   │   │
    │   │   ├── 📁 inventory/             ← Gestión de Almacén con clasificador IA
    │   │   │   └── 📄 page.tsx
    │   │   │
    │   │   ├── 📁 marketing/             ← Cupones, SEO y códigos QR de la tienda
    │   │   │   └── 📄 page.tsx
    │   │   │
    │   │   ├── 📁 delivery/              ← Logística de repartos y mapa del repartidor
    │   │   │   └── 📄 page.tsx
    │   │   │
    │   │   ├── 📁 patio/                 ← Operación de Carga/Descarga en Patio
    │   │   │   └── 📄 page.tsx
    │   │   │
    │   │   ├── 📁 node-view/             ← Monitor de estado de Nodos locales conectados
    │   │   │   └── 📄 page.tsx
    │   │   │
    │   │   ├── 📁 setup/                 ← Wizard secundario para llaves API
    │   │   │   └── 📄 page.tsx
    │   │   │
    │   │   ├── 📁 suscripcion/           ← Activación de Licencia PRO y tabla comparativa
    │   │   │   └── 📄 page.tsx
    │   │   │
    │   │   ├── 📁 verificador/           ← Escáner y verificador de precios (Cámara / Láser)
    │   │   │   └── 📄 page.tsx
    │   │   │
    │   │   ├── 📁 simulator/             ← Simulador de ventas para pruebas de cálculo e IVA
    │   │   │   └── 📄 page.tsx
    │   │   │
    │   │   └── 📁 tests/                 ← Consola de QA y Robustez (Visual Test Runner)
    │   │       └── 📄 page.tsx
    │   │
    │   └── 📁 sys-admin/                 ← Acceso técnico del integrador
    │       └── 📄 page.tsx
    │
    ├── 📁 components/                    ← Componentes UI Reutilizables
    │   ├── 📄 BarcodeScanner.tsx         ← Capturador oculto de pistola láser (<70ms)
    │   ├── 📄 GuidedTourWidget.tsx       ← Widget del Tour Onboarding dinámico para el dueño
    │   ├── 📄 LicenseGuard.tsx           ← Validador visual de estado de licencia
    │   ├── 📄 MarketCatalog.tsx          ← Grid de productos del e-commerce público
    │   ├── 📄 TicketEntrega.tsx          ← Generador de tickets de venta
    │   ├── 📄 VirtualizedAuditList.tsx   ← Tabla virtualizada para logs inmutables
    │   │
    │   ├── 📁 admin/
    │   │   ├── 📄 AdminLayout.tsx        ← Sidebar retráctil colapsable con caché local
    │   │   └── 📄 APIKeyManager.tsx      ← Gestor de credenciales de Facturapi
    │   │
    │   ├── 📁 marketing/
    │   │   └── 📄 StoreBuilderCanvas.tsx ← Rejilla magnética e Inspector lateral (IA Studio)
    │   │
    │   └── 📁 sales/
    │       └── 📄 CorteCajaCiego.tsx     ← Modal para declaración de efectivo a ciegas
    │
    ├── 📁 context/                       ← React Context API (Estado Semipersistente)
    │   ├── 📄 AuthContext.tsx            ← Gestión de sesión local/remota y redirección invisible
    │   └── 📄 CartContext.tsx            ← Manejo del carrito e IVA
    │
    ├── 📁 lib/                           ← Lógica de Negocio y Utilidades de Red
    │   ├── 📄 audit.ts                   ← Guardado de commits forenses inmutables
    │   ├── 📄 license.ts                 ← Encriptación de seriales con Machine ID físico y GitHub Sync
    │   ├── 📄 localSync.ts               ← Encolador y sincronizador offline-online
    │   ├── 📄 sqlite-service.ts          ← Base de datos local-first SQLite
    │   └── 📁 ai/
    │       ├── 📄 productClassifier.ts   ← Motor de IA local y fallback GPT-4o-mini
    │       └── 📄 classifyProduct.ts     ← Conector cliente para API de clasificación
    │
    └── 📁 store/                         ← Zustand Stores (Persistente)
        ├── 📄 useERPStore.ts             ← Configuración del Marketplace y estado de Tour
        └── 📄 useAuthStore.ts            ← Sesión activa ultrarrápida
```

---

## 📊 Resumen Estadístico de Estructura

| Tipo de Componente | Cantidad Aproximada | Propósito Principal |
| :--- | :---: | :--- |
| **Páginas de Ruta (app/)** | ~28 | Interfaces operativas de usuario y e-commerce. |
| **API Routes** | 6 | Controladores del lado del servidor para integraciones de pago, IA y SAT. |
| **Componentes de UI (components/)** | 22 | Elementos visuales reutilizables, modales y escáneres. |
| **Librerías de Utilidad (lib/)** | 12 | Algoritmos de encriptación de licencias, auditoría y local sync. |
| **Stores Zustand (store/)** | 3 | Estado persistente del diseño de la tienda y caché de sesión. |
