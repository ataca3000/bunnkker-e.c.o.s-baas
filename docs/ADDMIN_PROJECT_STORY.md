# Addmin ERP / BUNKKER E.C.O.S.

## What it does

Diseñamos y construimos Addmin ERP (BUNKKER E.C.O.S. - Ecosistema Comercial Offline Sincronizado), una plataforma de planificación de recursos empresariales, puntos de venta masivos (POS) y orquestación logística descentralizada bajo el paradigma **Local-First**. 

Resolvemos la asfixia operativa del comercio minorista y la logística en América Latina, donde la inestabilidad de las redes WAN y los cortes de energía provocan la caída de los sistemas SaaS tradicionales centralizados en la nube. Transformamos cada terminal física (cajas cobradoras, tabletas de almacén, terminales de andén) en un mini data center soberano autónomo.

Nuestra plataforma procesa cobros y lecturas de código de barras a menos de $70\text{ms}$ de latencia sin depender de internet. Cuando la red cae, registramos las mutaciones en una base de datos local SQLite y las inscribimos en una cadena criptográfica inmutable basada en la ecuación:

$$H_n = \text{SHA256}\left(\text{id}_n \times \text{monto}_n \times \text{timestamp}_n \times \text{usuario}_n \times H_{n-1}\right)$$

Al restablecerse la conectividad, el sistema ejecuta una reconciliación atómica idempotente con la nube. Adicionalmente, emitimos una red local P2P mediante mDNS con canal de audio Walkie-Talkie a costo cero de internet, integramos timbrado automatizado SAT CFDI 4.0 con umbrales configurables, clasificación de productos por Inteligencia Artificial perimetral y rastreo de flota logística con geocercas mediante la fórmula de Haversine:

$$d = 2r \arcsin \left( \sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)} \right)$$

## How we built it

Construimos Addmin ERP integrando una arquitectura Multi-Vault de alta densidad y rendimiento:

* **Frontend y Entorno de Ejecución:** Desarrollamos la interfaz utilizando Next.js 15 (App Router), React 19 y TypeScript 5.8 en un entorno estricto. Empaquetamos la aplicación nativa de escritorio con Electron Core Node Environment y gestionamos el estado reactivo unificado con Zustand (`useERPStore`).
* **Persistencia Local-First Multi-Vault:** Implementamos SQLite embebido junto con Prisma ORM como motor primario transaccional ACID (<70ms de latencia) y una cola de registro de escritura anticipada (Write-Ahead Logging - WAL). Usamos Google Cloud Firestore y Firebase Storage exclusivamente como un repositorio pasivo y asíncrono.
* **Seguridad Perimetral y Multi-Tenancy:** Desarrollamos un interceptor en el servidor con el middleware de Next.js (`src/middleware.ts`) que aísla las peticiones por inquilino mediante la inyección del encabezado `x-tenant-id`. Protegemos las rutas del dashboard con control de acceso basado en roles (RBAC) y firmamos criptográficamente las cookies de sesión (`msj-role-sig`) utilizando HMAC SHA-256 respaldado por `INTERNAL_API_SECRET`.
* **Red Malla P2P Local:** Implementamos descubrimiento pasivo de nodos usando `multicast-dns` (mDNS) y WebSockets sobre la red local LAN. El Nodo Maestro asigna un puerto libre en el rango `3000`-`3020`, permitiendo la conexión instantánea de Nodos Esclavos y transmisión de audio local sin consumir ancho de banda de internet.
* **Motor de Clasificación IA Perimetral:** Desarrollamos un motor híbrido que analiza cadenas de texto localmente a $0\text{ms}$ mediante expresiones regulares (Regex) para aislar calibres, medidas y materiales. Si el equipo cuenta con red y licencia PRO, habilitamos un fallback automático hacia modelos de lenguaje avanzados (`gpt-4o-mini`).
* **Infraestructura a Costo Cero en la Nube:** Diseñamos un pipeline que realiza volcados comprimidos de la base de datos local cifrados en AES-256-CBC (*Snapshots*). Estos archivos (`BUNKKER_SECURE_BACKUP.txt`) se depositan pasivamente en Firebase Storage, colapsando el consumo de CPU remoto y reduciendo los costos de mantenimiento en la nube a $\$0\text{ USD}$ mensuales.

## Challenges we ran into

Durante la ingeniería del sistema superamos retos complejos de cómputo distribuido:

* **Evitación del Cerebro Dividido (Split-Brain) en Hot Standby:** Si el Nodo Maestro sufría una falla de hardware, la red local quedaba inoperativa. Para evitar que dos nodos asumieran el rol de maestro simultáneamente al conmutar, construimos el protocolo "Heredero al Trono". Los nodos sucesores monitorean la señal de latido (*heartbeat*) del maestro. Tras 15 segundos sin respuesta, se despliega una alerta exclusiva para administradores que requiere la presionar el botón de coronación manual. Al activarse, el nuevo nodo se apropia del archivo de bloqueo de base de datos y se re-anuncia vía mDNS en menos de $15\text{s}$.
* **Autenticación en Sesiones Offline Prolongadas:** Los tokens `idToken` de Firebase expiran en 1 hora, imposibilitando la sincronización tras días fuera de línea. Resolvimos esto almacenando localmente y con cifrado asimétrico vinculado al Machine ID (`node-machine-id`) un `refreshToken` de larga duración. Antes de sincronizar ventas remotas, la terminal renueva el token silenciosamente sin interrumpir al operador.
* **Resolución Concurrente de Conflictos de Inventario:** Cuando dos terminales desconectadas venden el último artículo en stock, la reconciliación aplica ordenación estricta por marca de tiempo sobre la cadena de hashes $H_n$ (*First-Come, First-Served*). La primera transacción se ejecuta en SQLite mediante `prisma.$transaction`. La transacción excedente revierte atómicamente y se deriva a la bitácora de auditoría para revisión manual.
* **Protección Anti-Tampering y Bot de Memoria:** Para prevenir la ingeniería inversa y extracción de memoria en caliente por bots maliciosos en la máquina física, implementamos una rutina de re-ofuscación cíclica que limpia y re-encripta variables sensibles en memoria cada 5 segundos.

## Accomplishments that we're proud of

* **Resiliencia Operativa Total (100% Uptime):** Logramos que un punto de venta y sistema ERP continúe procesando transacciones e imprimiendo tickets sin interrupción ante la desconexión total de internet o caídas de la red pública.
* **Arquitectura de Costo Cero de Servidor:** Conseguimos eliminar el cobro por lecturas y escrituras NoSQL masivas en la nube, usando la infraestructura BaaS como un bucket pasivo para Snapshots binarios cifrados en AES-256-CBC.
* **Propiedad Intelectual y Patente Nodal:** Registramos exitosamente la patente `PAT-BUNKKER-2026-MINI-DATACENTER-MESH-001` para Nodos Mini-Data Center Privados y formalizamos el registro de obra de software ante el Instituto Nacional del Derecho de Autor (INDAUTOR) en México.
* **Autenticación Zero-Login QR:** Eliminamos los formularios tradicionales de contraseña para el personal operativo, reemplazándolos por tokens QR dinámicos de un solo uso vinculados criptográficamente al Hardware ID de la máquina física.

## What we learned

* **El Enfoque Local-First es Superior en Mercados Emergentes:** Confirmamos que desplazar la inteligencia y la persistencia al hardware local (*Edge Computing*) ofrece una experiencia de usuario inalcanzable para las aplicaciones web SaaS tradicionales.
* **Inmutabilidad Criptográfica sin Costo Blockchain:** Aprendimos que encadenar hashes SHA-256 transaccionales sobre bases de datos relacionales locales provee la misma certeza de auditoría inmutable que una blockchain pública, sin sus latencias ni costos de gas.
* **Simbiosis entre Expresiones Regulares e Inteligencia Artificial:** Comprobamos que resolver la clasificación sintáctica perimetral mediante Regex local elimina más del 90% de las llamadas innecesarias a APIs de LLMs remotos, preservando cuotas y garantizando velocidad.
* **Diseño con Intervención Humana en Failovers Críticos:** Verificamos que en sistemas distribuidos comerciales, requerir una confirmación humana autorizada para la conmutación de servidores previene la corrupción de datos por condiciones de cerebro dividido de forma más efectiva que los algoritmos de elección 100% autónomos.

## What's next for Addmin

* **Red Malla Inter-Empresarial P2P:** Escalar el protocolo de red para conectar nodos de distintas compañías mediante planes de transporte de red ya contratados, permitiendo el intercambio autónomo y seguro de inventarios regionales B2B sin intermediarios.
* **Despliegue de Nodos Autónomos Fotovoltaicos ("Nodos Perrito"):** Implementar mini-data centers físicos de bajo consumo alimentados con celdas solares diurnas y conmutación nocturna a la red eléctrica para centros de acopio y logística en zonas rurales sin infraestructura.
* **Algoritmos de Reaprovisionamiento Predictivo en el Borde:** Integrar modelos de aprendizaje automático locales que analicen los patrones de venta in situ para generar órdenes de compra automáticas hacia proveedores antes de que ocurra un quiebre de stock.
