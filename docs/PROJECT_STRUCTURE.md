# ADMIN.COM — Mapa Topográfico de Estructura de Archivos

A continuación, se detalla la distribución de archivos físicos del código fuente del ERP y Marketplace, mapeando sus componentes lógicos.

---

## Estructura de Directorios

```text
admin.com/
│
├── scripts/
│   └── test-logic.js          <- Suite de pruebas automáticas en terminal (CLI)
│
├── src/
│   ├── middleware.ts          <- Interceptor de seguridad por roles y cookies de licencia
│   ├── proxy.ts               <- Resolvedor de red local y redirección
│   │
│   ├── app/                   <- Rutas del Next.js App Router
│   │   ├── favicon.ico
│   │   ├── globals.css        <- Estilos CSS globales y utilidades Tailwind
│   │   ├── layout.tsx         <- Envoltura general de PWA (renderiza providers y widgets globales)
│   │   ├── manifest.ts        <- Archivo de manifiesto PWA para instalación en celulares
│   │   ├── page.tsx           <- Landing page principal
│   │   │
│   │   ├── [branchId]/        <- Vista pública para sucursales
│   │   │
│   │   ├── api/               <- Rutas de Backend Serverless (Servicios en Servidor)
│   │   │   ├── ai/
│   │   │   │   └── classify-product/
│   │   │   │       └── route.ts <- API para clasificador de productos (Firestore + LLM)
│   │   │   ├── billing/       <- Lógica de facturación SAT (PAC / Facturapi)
│   │   │   ├── checkout/      <- Checkout de pagos con tarjeta (Stripe)
│   │   │   ├── licenses/      <- Activación y syncing remoto de licencias
│   │   │   └── notify/        <- Webhooks y alertas por WhatsApp
│   │   │
│   │   ├── catalogo/          <- Marketplace Público (E-commerce)
│   │   │   ├── page.tsx
│   │   │   └── [category]/    <- Grid de productos dinámico por categoría
│   │   │
│   │   ├── carrito/           <- Carrito de compras y Checkout público
│   │   │   └── checkout/
│   │   │       └── page.tsx   <- Solicitud de factura (PRO) y pago local/tarjeta
│   │   │
│   │   ├── onboarding/        <- Wizard dinámico interactivo de primer uso
│   │   │
│   │   ├── register-tenant/   <- Creación única y obligatoria del Super Admin
│   │   │
│   │   ├── login/             <- Portal único camuflado con redirección secreta
│   │   │
│   │   ├── dashboard/         <- Backoffice Operativo (Consola Privada)
│   │   │   ├── page.tsx       <- Dashboard General (KPIs y Cajas)
│   │   │   ├── admin/
│   │   │   │   ├── sales/     <- Monitor de ventas corporativo
│   │   │   │   └── users/     <- ABM de personal con bloqueo de duplicados
│   │   │   ├── sales/         <- Punto de Venta (POS) del Cajero y Corte Ciego
│   │   │   ├── audit/         <- Radar de auditoría virtualizado inmutable
│   │   │   ├── billing/       <- Facturación SAT
│   │   │   ├── design/        <- Canvas de Marca (Edición en Vivo del E-commerce)
│   │   │   ├── inventory/     <- Almacén y Stock con asistente clasificador IA
│   │   │   ├── delivery/      <- Gestión de despacho y ruta del repartidor con mapa
│   │   │   ├── patio/         <- Control físico de carga/descarga
│   │   │   ├── node-view/     <- Monitor de Nodos locales conectados
│   │   │   ├── setup/         <- Wizard secundario para llaves API
│   │   │   ├── suscripcion/   <- Pantalla de Licencias PRO (Formulario y planes)
│   │   │   ├── verificador/   <- Verificador de Precios por cámara/lector en tienda
│   │   │   ├── simulator/     <- Simulador de ventas e IVA
│   │   │   └── tests/         <- Consola QA Visual para pruebas en caliente
│   │   │
│   │   └── sys-admin/         <- Panel de soporte del integrador técnico
│   │
│   ├── components/            <- Componentes de Interfaz de Usuario
│   │   ├── BarcodeScanner.tsx <- Buffer de captura para pistola lectora láser (<70ms)
│   │   ├── GuidedTourWidget.tsx <- Widget del Tour Demo interactivo del dueño (Paso 1-6)
│   │   ├── LicenseGuard.tsx   <- Restrictor visual por licenciamiento vencido
│   │   ├── MarketCatalog.tsx  <- Catálogo público reactivo a los cambios del Canvas
│   │   ├── TicketEntrega.tsx  <- Formato de impresión de ticket térmico
│   │   │
│   │   ├── admin/
│   │   │   ├── AdminLayout.tsx   <- Sidebar colapsable con memoria en localStorage
│   │   │   └── APIKeyManager.tsx <- Cargador de llaves SAT de facturación
│   │   │
│   │   ├── marketing/
│   │   │   └── StoreBuilderCanvas.tsx <- Canvas magnético con panel Inspector lateral (IA Studio)
│   │   │
│   │   └── sales/
│   │       └── CorteCajaCiego.tsx <- Modal declaración de efectivo para el cajero
│   │
│   ├── context/               <- React Contexts (Sesión y Carrito)
│   │   ├── AuthContext.tsx    <- Lógica de sesión, bypass offline y enrutador RBAC
│   │   └── CartContext.tsx    <- Carrito, cálculo de subtotales, IVA y comisiones 80/20
│   │
│   ├── lib/                   <- Núcleo Lógico del Negocio
│   │   ├── audit.ts           <- Registrador forense inmutable de logs
│   │   ├── license.ts         <- Validación de seriales por huella Machine ID y GitHub Sync
│   │   ├── localSync.ts       <- Sincronizador en segundo plano offline-cloud
│   │   ├── sqlite-service.ts  <- Conector de base de datos local SQLite
│   │   └── ai/
│   │       ├── productClassifier.ts <- Motor IA local por palabras clave y regex
│   │       └── classifyProduct.ts   <- Conector cliente API de clasificación
│   │
│   └── store/                 <- Zustand Global Stores
│       ├── useERPStore.ts     <- Estado de configuración del market y control de Tour
│       └── useAuthStore.ts    <- Control de sesión
```

---

## Flujos Técnicos Integrados

### 1. El Portal de Login Unificado
El acceso camuflado intercepta a todos los usuarios en `/login`.
- Si el rol devuelto por `AuthContext` es `client` $\rightarrow$ Redirige al Marketplace público en `/catalogo`.
- Si el rol es `sales` $\rightarrow$ Redirige de inmediato al POS en `/dashboard/sales` sin exponer menús corporativos.
- Si el rol es `superadmin` $\rightarrow$ Habilita el Sidebar completo y redirige al panel maestro en `/dashboard/guia`.

### 2. El Proceso de Venta y Timbrado SAT (PRO)
Al finalizar una compra en `/carrito/checkout`:
1. El sistema calcula el subtotal, 16% de IVA y el split de reservas 80/20.
2. Si la licencia es **PRO**, se ofrece la casilla "Solicitar Factura".
3. El cliente ingresa sus datos (RFC, Nombre) sin conocer la API Key de Facturapi del dueño.
4. El sistema evalúa el umbral mínimo (ej. compras > $50 MXN). Si lo supera, realiza la petición segura a la API de Facturapi para timbrado del CFDI.
5. El ticket final se emite localmente (`TicketEntrega.tsx`) y el PDF se envía por correo o WhatsApp.
