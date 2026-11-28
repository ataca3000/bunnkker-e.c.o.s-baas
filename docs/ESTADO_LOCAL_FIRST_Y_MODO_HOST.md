# BUNKKER E.C.O.S. — Estado Actual Local-First, Comparativo y Plan de Ataque (Modo Host Android)

> **Diagnóstico ejecutivo:** **No tienes que tirar tu arquitectura actual.** BUNKKER E.C.O.S. ya tiene **~60% de los cimientos Local-First** listos (PWA, Service Worker, cola offline en IndexedDB, bus LAN por WebSocket/mDNS para PC, esquema multi-sucursal y bitácora inmutable en Firebase). La pieza que falta para que **un celular o tablet Android sea el cerebro temporal sin PC ni Internet** es el **Módulo Nativo de Modo Host Android (`NsdManager` + Servidor LAN embebido + SQLite WAL + Reconciliación Host-Authoritative a Firebase)**.

---

## 1. Estado Actual Real en el Código

### Lo que YA tienes construido y funcionando
1. **PWA Soberana y Caché Offline (`public/sw.js`, `src/app/manifest.ts`)**
   - Pre-cachea rutas base de navegación y medios (`/api/media/*`), además de `/api/settings`.
   - Protege `/api/orders`, `/api/products`, `/api/sales` y mutaciones contra caché HTTP obsoleto para evitar vender con datos falsos.
2. **Persistencia Offline en Navegador (`src/lib/indexedDBCart.ts`, `src/lib/offlineAvailability.ts`)**
   - Base `bunkker_ecos_offline_db` en **IndexedDB** (ahora ampliada en `v3`) para carrito POS, borrador de checkout, cola transaccional de pedidos offline (`offline_orders_queue`), **snapshot de catálogo local** y **vínculo a Host LAN**.
   - Auto-vaciado automático al recuperar conexión (`flushOfflineOrderQueue`).
3. **Sincronización LAN y Multi-Pestaña (`src/lib/localSync.ts`, `radio-server.js`, `src/lib/syncNotifier.ts`)**
   - `BroadcastChannel` para 0 ms entre pestañas del mismo navegador y **SSE** (`/api/sync/events`) en orígenes HTTPS.
   - En **PC / Electron**, ya existe SQLite WAL (Prisma), `radio-server.js` (Socket.IO en `:3001`) y difusión **mDNS (`bunkker-master.local`)** mediante `multicast-dns` + cola WAL local (`bunkker_offline_queue`).
4. **Roles, Sesiones y Emparejamiento (`/pair`, `/api/pairing/claim`, `src/lib/apiAuth.ts`)**
   - Autenticación multi-rol por PIN y vinculación de terminales por QR o código corto de 6 caracteres.
5. **Firebase Cloud + IA On-Device (`firebase-blueprint.json`, `firestore.rules`, `src/lib/enterpriseFirestore.ts`, `android-app/`)**
   - Firestore ya modela `branch_nodes` (con `isolationMode: "isolated_local_first" | "cloud_mirror"`, `pendingSyncCount`, `todaySales`, `todayOrders`) e `immutable_audit_chain` (bitácora SHA-256 append-only).
   - La app Android (`com.bunkker.ecos.hybridai`) ya integra **Firebase AI Logic (`firebase-ai-ondevice` + Cloud Fallback)** y flujo de onboarding/demo/feedback.

### Lo que NO existía todavía (y por qué faltaba el "Modo Host Móvil")
- `src/lib/localSync.ts` depende de Node.js (`multicast-dns` + módulo `os`), por lo que **no puede anunciar ni descubrir Hosts desde el navegador ni desde Android**.
- En orígenes `https://...`, los navegadores bloquean conexiones directas `ws://192.168.x.x` (*Mixed Content SecurityError*).
- `android-app/` solo ejecutaba inferencia de IA y abría la URL web de producción; no tenía servidor local ni descubrimiento Wi-Fi (`NsdManager`).
- `src/lib/cloudSyncWorker.ts` drenaba la cola hacia Supabase/Postgres, pero faltaba un protocolo explícito donde el **Android Host sobrescriba a Firebase (`Host-Authoritative`)** al volver Internet.

---

## 2. Comparativo Punto por Punto: Arquitectura Actual vs. Objetivo Local-First + Modo Host

| Pilar de Arquitectura | Visión Propuesta (Modo Host tipo Minecraft) | Estado Previo en BUNKKER | Adaptación Implementada / Plan de Ataque |
| :--- | :--- | :--- | :--- |
| **Cerebro Temporal (Host)** | Cualquier tablet/celular o PC se vuelve Host temporal sin Internet. | Solo PC/Electron (`radio-server.js` + `electron-main.js`). | **Nuevo `BunkkerHostService` + `BunkkerLanHttpWsServer`** en Android nativo (`:8765`) con SQLite WAL propio. |
| **Descubrimiento en Wi-Fi** | Código de sala tipo Minecraft (`BNK-4821`) y auto-descubrimiento LAN. | `multicast-dns` (`bunkker-master.local`) exclusivo de Node/Electron. | **Nuevo `BunkkerNsdDiscoveryManager`** usando `android.net.nsd.NsdManager` (`_bunkker._tcp.`) + `MulticastLock` + atributo TXT `code=BNK-XXXX`. |
| **Clientes Empleados** | Otros celulares/tablets entran desde App o PWA conservando su sesión/rol. | `/pair` dependiente de servidor central Next.js + Internet/PC. | **Doble cliente**: (1) App Android descubre vía `NsdManager`; (2) PWA/navegadores acceden por código/QR (`/conectar-host` o portal HTTP servido directo por el Host en `:8765`). |
| **Catálogo y Cobro sin Red** | Funciona 100% sin Internet ni PC con respuesta instantánea. | IndexedDB solo guardaba carrito y cola de pedidos. | **IndexedDB v3** añade `local_products_snapshot` y `local_host_config` + **SQLite Host** atómico en Android. |
| **Resolución de Conflictos** | Sincronizar con Firebase cuando vuelva Internet. | Cola `SyncQueue` orientada a nube genérica. | **Estrategia Host-Authoritative**: al volver Internet, el Host Android sobrescribe su nodo en `branch_nodes` y sella `immutable_audit_chain` en Firestore. |

---

## 3. Cómo Evitar la Trampa de "Mixed Content" entre PWA (`https://`) y Host Android (`http://`)

Este es el detalle técnico más importante si los empleados usan **PWA en el navegador**:

1. **El problema en navegadores**: Si un empleado abre la PWA instalada desde `https://tu-app.run.app`, Chrome/Safari **prohíben** llamadas `fetch("http://192.168.1.45:8765")` o `new WebSocket("ws://192.168.1.45:8765")` por política de contenido mixto.
2. **La solución limpia (Mismo Origen HTTP Local + App Nativa)**:
   - **Opción A (PWA/Navegador de cualquier teléfono o tablet):** El **Android Host sirve su propio mini-portal operativo HTTP/WebSocket** en `http://<IP_HOST>:8765/`. Al escanear el QR o abrir esa dirección desde Chrome, el origen es `http://192.168.1.45:8765` y el WebSocket `ws://192.168.1.45:8765/ws/host` **funciona al 100% sin certificados SSL y sin Internet**.
   - **Opción B (Clientes con la App Android nativa):** La app Android cliente descubre el servicio `_bunkker._tcp.` por **`NsdManager`**, compara el código `BNK-XXXX` y se conecta directo por HTTP/WebSocket LAN (con `usesCleartextTraffic="true"` en red local).
   - **Opción C (Página `/conectar-host` en la PWA):** Detecta si estás en `https://`, valida el formato `BNK-XXXX` o IP local y te ofrece abrir directo el portal del Host o trabajar sobre el snapshot local de IndexedDB cuando la red está aislada.

---

## 4. Plan de Ataque por Fases

### Fase 1 — Módulo Nativo Android Host (Implementado en `android-app/`)
- **Permisos y servicio permanente (`AndroidManifest.xml`, `BunkkerHostService.kt`)**:
  - `ACCESS_WIFI_STATE`, `CHANGE_WIFI_MULTICAST_STATE`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_DATA_SYNC`, `POST_NOTIFICATIONS`.
  - Servicio en primer plano (`START_STICKY`) para que Android no mate el Host aunque se apague la pantalla del teléfono en mostrador.
- **Descubrimiento tipo Minecraft (`BunkkerNsdDiscoveryManager.kt`)**:
  - Registra servicio mDNS/DNS-SD `_bunkker._tcp.` en la LAN con metadatos `code=BNK-XXXX`, `branch=...`, `epoch=...`.
  - Escanea Hosts cercanos desde otros dispositivos Android y resuelve su IPv4 y puerto automáticamente.
- **Motor Local + Servidor LAN (`BunkkerHostSqliteStore.kt`, `BunkkerLanHttpWsServer.kt`)**:
  - Base SQLite en modo **WAL** (`host_products`, `host_sales_outbox`, `host_audit_log`, `host_meta`).
  - Endpoints HTTP: `GET /`, `GET /api/host/info`, `GET /api/host/snapshot`, `POST /api/host/join`, `POST /api/host/sale`, `POST /api/host/product/upsert`.
  - WebSocket RFC-6455 nativo en Kotlin sin dependencias externas para empujar `sale:created`, `stock:updated` y `client:joined` en tiempo real.

### Fase 2 — Reconciliación Host-Authoritative con Firebase (`BunkkerHostFirebaseSync.kt` y `src/lib/enterpriseFirestore.ts`)
- **Regla de Oro confirmada:** *El dispositivo Host manda sobre todo y sobrescribe la nube.*
- Al recuperar conexión a Internet (verificado por `ConnectivityManager` + sesión autenticada de Firebase):
  1. El Host empaqueta su `hostEpoch`, ventas pendientes del outbox, totales del día y snapshot de inventario.
  2. Sobrescribe el documento `branch_nodes/{branchId}` en Firestore (`isolationMode: "isolated_local_first"` -> `"cloud_mirror"`, `pendingSyncCount: 0`, `todaySales`, `todayOrders`).
  3. Registra la cadena de cierre en `immutable_audit_chain` (hash SHA-256 encadenado) y guarda respaldo completo en `host_authoritative_snapshots/{branchId}` si las reglas del proyecto lo habilitan.
  4. Marca las ventas locales como `syncedToCloud = 1` en SQLite.

### Fase 3 — Endurecimiento de Campo y Pruebas sin PC (Siguiente Paso Operativo)
1. **Compilar APK en Android Studio** con tu `google-services.json` real en `android-app/app/`.
2. **Prueba de corte real en 2 celulares en el mismo Wi-Fi (o Hotspot portátil de uno de ellos):**
   - Celular A activa **Modo Host LAN** -> genera código `BNK-XXXX` y URL `http://192.168.x.x:8765`.
   - Desconectar el router de Internet (solo Wi-Fi local).
   - Celular B (App Android o navegador Chrome) descubre o abre `http://192.168.x.x:8765`, registra una venta y verifica descuento inmediato en ambos equipos.
   - Reconectar Celular A a datos móviles / Wi-Fi con Internet y presionar **Sincronizar con Firebase (Host Manda)** para consolidar en Firestore.
