# Resumen Técnico y Historia del Proyecto BUNKKER E.C.O.S.

## 1. Revisión y Resumen de la Documentación del Proyecto

El ecosistema documental de BUNKKER E.C.O.S. (Ecosistema Comercial Offline Sincronizado) comprende especificaciones de arquitectura, registros de derechos de autor ante el Instituto Nacional del Derecho de Autor (INDAUTOR), reivindicaciones de patente, mapas de roles, estrategias de seguridad perimetral y planes de monetización.

### Registro Institucional y Ámbito de Aplicación
Conforme a [README.md](file:///c:/Users/codem/OneDrive/Desktop/camalion-topics-erp/README.md) y [BUNKKER_ECOS_MEMORIA_TECNICA_INDAUTOR.md](file:///c:/Users/codem/OneDrive/Desktop/camalion-topics-erp/docs/BUNKKER_ECOS_MEMORIA_TECNICA_INDAUTOR.md), la obra de software está registrada a nombre de Luis Felipe Durán Salinas (Philip Durán) / Brecha Soluciones S.A. de C.V. El sistema se orienta a la planificación de recursos empresariales (ERP), puntos de venta masivos (POS) y orquestación logística descentralizada bajo el paradigma Local-First.

### Arquitectura Técnica y Multi-Vault
De acuerdo con [ARCHITECTURE.md](file:///c:/Users/codem/OneDrive/Desktop/camalion-topics-erp/docs/ARCHITECTURE.md) y [sistema.md](file:///c:/Users/codem/OneDrive/Desktop/camalion-topics-erp/docs/sistema.md), la infraestructura tecnológica se compone de:
* Frontend y Entorno de Ejecución: Next.js 15 (App Router), React 19, TypeScript 5.8 y empaquetado de escritorio nativo mediante Electron Core Node Environment.
* Persistencia Híbrida (Multi-Vault): SQLite local con Prisma ORM como motor transaccional primario ACID (<70ms de latencia) y respaldos pasivos en Google Cloud Firestore / Firebase Storage.
* Seguridad y Multi-Tenancy: Intercepción perimetral en Next.js con validación de encabezados `x-tenant-id`, control de acceso basado en roles (RBAC) y firmas criptográficas HMAC SHA-256 (`msj-role-sig`) en cookies de sesión.

### Reivindicaciones de Patente Nodal
Según [PATENTE_NODOS_BANDERA.md](file:///c:/Users/codem/OneDrive/Desktop/camalion-topics-erp/docs/PATENTE_NODOS_BANDERA.md), la patente `PAT-BUNKKER-2026-MINI-DATACENTER-MESH-001` establece los principios de los "Nodos Mini-Data Center Privados": autonomía nodal in situ, emisión de servicios P2P locales a 0ms de latencia, independencia absoluta de redes satelitales u orbitales, opción de alimentación conmutada solar/eléctrica y operación confinada al plano terrestre.

### Gobernanza de Roles y Seguridad
En [ROLES_MAP.md](file:///c:/Users/codem/OneDrive/Desktop/camalion-topics-erp/docs/ROLES_MAP.md), [SECURITY.md](file:///c:/Users/codem/OneDrive/Desktop/camalion-topics-erp/docs/SECURITY.md) y [FUNCTIONALITY_MAP.md](file:///c:/Users/codem/OneDrive/Desktop/camalion-topics-erp/docs/FUNCTIONALITY_MAP.md) se definen los accesos por rol (`superadmin`, `admin`, `sales`, `inventory`, `billing`, `driver`, `carga_descarga`, `client`), el portal de inicio camuflado en `/login`, la re-ofuscación de memoria cíclica cada 5 segundos y el blindaje inalienable de los derechos morales y patrimoniales de la arquitectura central.

### Modelo Financiero y Monetización
En [MONETIZACION.md](file:///c:/Users/codem/OneDrive/Desktop/camalion-topics-erp/docs/MONETIZACION.md) se proyecta la captura de valor mediante suscripciones SaaS recurrentes (versiones Estándar y PRO), venta de licencias perpetuas locales, retención de comisiones mediante pasarelas Stripe Connect e implementación de servicios de consultoría técnica.

## 2. Historia del Proyecto (Sobre el Proyecto)

### Inspiración
La concepción de BUNKKER E.C.O.S. responde a las fallas estructurales de conectividad WAN e intermitencia de internet en los corredores comerciales de América Latina. Los sistemas ERP y POS tradicionales basados en SaaS centralizados sufren paros operativos cuando la red falla, perdiendo ventas y corrompiendo secuencias de inventario.

Paralelamente, los costos de infraestructura en el modelo cliente-servidor convencional resultan insostenibles cuando múltiples terminales envían peticiones concurrentes a bases de datos en la nube. El proyecto se inspiró en la necesidad de descentralizar el cómputo hacia el borde (Edge Computing), dotando a cada dispositivo físico de soberanía operativa e ininterrumpida.

### Aprendizajes Obtenidos
Durante la ingeniería del proyecto se alcanzaron varias conclusiones técnicas:
* Descentralización con Enfoque Local-First: La transferencia de la carga transaccional a motores locales (SQLite) reduce las lecturas y escrituras en la nube a cero durante la operación continua, utilizando la infraestructura remota únicamente como un relevo pasivo de archivos de respaldo cifrados (Snapshots).
* Reconciliación por Cadenas Criptográficas Inmutables: La integridad transaccional offline requiere que cada operación contenga el hash criptográfico de la transacción inmediatamente anterior, garantizando el orden cronológico e impidiendo la inyección o alteración de datos.
* Prevención de Split-Brain en Redes P2P: La conmutación de servidores en entornos locales requiere un protocolo de sucesión semi-automático ("Heredero al Trono") con latidos (*heartbeat*) constante y confirmación administrativa manual antes de asumir el archivo de bloqueo de base de datos.
* Clasificación Sintáctica Perimetral: El uso de expresiones regulares locales para aislar unidades y materiales en catálogos industriales optimiza los recursos de cómputo, dejando el uso de modelos de lenguaje remotos como fallback opcional.

### Construcción del Proyecto
La arquitectura del sistema fue construida en cinco módulos clave:

#### 1. Persistencia Local y Control Transaccional
Se implementó SQLite embebido junto con Prisma ORM. La mutación de inventario y generación de pedidos se ejecuta dentro de transacciones atómicas `prisma.$transaction` en [route.ts](file:///c:/Users/codem/OneDrive/Desktop/camalion-topics-erp/src/app/api/orders/route.ts), garantizando el cumplimiento de las propiedades ACID.

#### 2. Reconciliación Off-line mediante Cadenas SHA-256
El backend de sincronización en [route.ts](file:///c:/Users/codem/OneDrive/Desktop/camalion-topics-erp/src/app/api/sales/sync/route.ts) recibe lotes de transacciones generadas en modo desconectado. Cada bloque $H_n$ se valida según la función:

$$H_n = \text{SHA256}\left(\text{id}_n \times \text{monto}_n \times \text{timestamp}_n \times \text{usuario}_n \times H_{n-1}\right)$$

Cualquier discrepancia entre el hash enviado y el calculado invalida el lote entero, bloqueando intentos de manipulación local.

#### 3. Intercepción y Seguridad Multi-Tenant
En [middleware.ts](file:///c:/Users/codem/OneDrive/Desktop/camalion-topics-erp/src/middleware.ts) se integró la extracción dinámica del encabezado `x-tenant-id` a partir del subdominio o parámetro de consulta. El acceso a rutas `/dashboard/*` se valida contra las cookies de sesión y rol, verificadas síncronamente mediante firmas HMAC SHA-256 respaldadas por la clave `INTERNAL_API_SECRET`.

#### 4. Conectividad P2P en Red Local
El Nodo Maestro expone un puerto aleatorio en el rango `3000`-`3020` y anuncia su presencia en la red local LAN mediante `multicast-dns` (mDNS). Los Nodos Esclavos detectan la dirección IP local de forma autónoma y establecen conexiones por WebSockets para mensajería interna y sincronización de datos a 0ms de latencia.

#### 5. Geocercas Logísticas y Botón de Pánico
En el módulo de reparto en [page.tsx](file:///c:/Users/codem/OneDrive/Desktop/camalion-topics-erp/src/app/dashboard/delivery/page.tsx), la telemetría se procesa a intervalos regulares de 15 segundos. La distancia ortodrómica para el cálculo de geocercas sobre la superficie terrestre aplica la ecuación de Haversine:

$$d = 2r \arcsin \left( \sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)} \right)$$

Donde $\phi$ es la latitud, $\lambda$ la longitud y $r$ el radio medio de la Tierra. El módulo integra la activación síncrona del Botón de Pánico, transmitiendo coordenadas GPS inmediatas hacia la base de monitoreo ante emergencias en ruta.

### Retos Técnicos Enfrentados

#### 1. Conmutación por Error sin Cerebro Dividido (Hot Standby)
El fallo físico del Nodo Maestro dejaba la red fuera de servicio. Para evitar que dos nodos asumieran el rol principal al mismo tiempo (split-brain), se construyó un protocolo de monitoreo por señales de latido (*heartbeat*). Tras 15 segundos sin respuesta del Maestro, la interfaz del nodo sucesor habilita la alerta exclusiva para administradores. La coronación exige presionar manualmente el botón de toma de control, ejecutando la apropiación del archivo de bloqueo de base de datos y la re-emisión mDNS en la red LAN en menos de 15 segundos.

#### 2. Gestión de Sesiones Offline Prolongadas
Dado que los tokens `idToken` expiran en 1 hora, las terminales desconectadas por días no podían re-autenticarse automáticamente al volver a tener internet. Se implementó el almacenamiento cifrado local del `refreshToken` asociado al Hardware ID del equipo (`node-machine-id`). Antes de emitir una sincronización en el endpoint remoto, la terminal ejecuta la renovación silenciosa del token sin requerir intervención del usuario.

#### 3. Resolución Concurrente de Conflictos de Inventario
Cuando dos terminales fuera de línea venden la última unidad de un producto, la reconciliación aplica un principio estricto de *First-Come, First-Served* basado en la marca de tiempo de la firma $H_n$. La transacción con la marca de tiempo más antigua se procesa en SQLite via Prisma. La transacción posterior rechazada por falta de stock se deriva a la bitácora de auditoría para su revisión administrativa manual.

#### 4. Reducción del Costo de Infraestructura Cloud
Para evitar facturas elevadas por operaciones masivas de lectura/escritura en Firestore, el sistema comprime las bases de datos locales en archivos binarios plano encriptados en AES-256-CBC (*Snapshots*). Estos archivos se envían a Firebase Storage (`BUNKKER_SECURE_BACKUP.txt`), utilizando la nube como un repositorio pasivo y reduciendo el consumo de cómputo remoto a cero.
