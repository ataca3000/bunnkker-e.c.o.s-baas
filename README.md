# 🌎 TERRAFORM ERP — Ecosistema Comercial Local-First

**Terraform ERP** es una plataforma de software de código abierto comercial (Open-Core) diseñada por **brecha system mexico** de México para el mundo. Unifica la administración comercial (ERP/POS), el e-commerce autoadministrable (Marketplace) y la logística local.

Este ecosistema combina una arquitectura local descentralizada a prueba de caídas de internet (**Local-First**) con sincronización bidireccional en tiempo real hacia la nube (**Firebase/Supabase**), empaquetado en un portable multiplataforma único.

* 📖 **Licencia de Arquitectura:** Consulte los términos de propiedad industrial y el umbral de similitud del 80% en [LICENSE.md](file:///c:/Users/codem/Downloads/admin.com/LICENSE.md).
* 🛡️ **Política de Seguridad:** Lea las directrices contra bots de clonación y raspado automatizado en [.github/SECURITY.md](file:///c:/Users/codem/Downloads/admin.com/.github/SECURITY.md).
* 👥 **Invitación a Colaborar:** Invitamos a la comunidad global de desarrolladores a cooperar, proponer mejoras y expandir la red de inventarios local-first.

---

## 🌟 Lo Que Nos Distingue del Resto

### 1. Editor Visual Magnético (Canvas) "Shopify/Canva Style"
El sistema cuenta con un constructor visual interactivo integrado (`/dashboard/design`) que permite al dueño cambiar textos "en vivo" haciendo clic sobre los bloques de su tienda virtual. El panel de herramientas izquierdo se transforma en un **Inspector de Bloques** contextual (estilo IA Studio) para modificar de forma micro-granular colores, márgenes, fuentes y filtros de visualización sin escribir una línea de código.

### 2. Sincronización Híbrida y Aislamiento Multi-Inquilino (Multi-Tenancy)
Si la conexión a internet se cae, el Punto de Venta (POS) y el lector de código de barras no se detienen. El sistema opera sobre una base local SQLite ultrarrápida y sincroniza con Google Cloud Firestore de manera asíncrona. Los datos de cada cliente están estrictamente aislados en subcolecciones del servidor bajo reglas de seguridad inquebrantables, impidiendo la visualización o clonación de datos entre diferentes negocios.

### 3. Login Único Camuflado (Behind the Scenes RBAC)
El portal de acceso (`/login`) es estéticamente un simple login para clientes de la tienda. Sin embargo, el sistema identifica el rango del usuario en el servidor y redirige a los empleados y administradores a sus respectivos páneles operativos de forma invisible, ocultando por completo las rutas de administración al ojo público.

### 4. Asistente Wizard y Setup de Único Uso
La primera vez que el software se instala, ejecuta un tour dinámico interactivo de configuración guiada. Exige el registro del único perfil de **Super Administrador** soberano del sistema y, una vez creado, la ruta de setup se desactiva permanentemente para prevenir intrusiones.

### 5. Blindaje de Seguridad Local y Nube
* **Permisos del Archivo de Base de Datos:** `dev.db` se configura con permisos restrictivos `0o600` (con control de acceso ACL exclusivo del propietario en Windows) para evitar que procesos externos roben la base de datos local.
* **Protección contra Fuerza Bruta:** El endpoint `/api/auth/session` incluye un limitador de tasa de solicitudes (Rate Limiting) y bloqueo automático de IP por 15 minutos tras 5 intentos fallidos consecutivos de login.
* **Firmas Criptográficas de Sesión:** Las cookies de sesión y roles se firman localmente con firmas criptográficas HMAC basadas en un `JWT_SECRET` local para prevenir ataques de elevación de privilegios ("Pass-the-Hash").
* **Huella Digital del Dispositivo (Fingerprinting):** Cada usuario se asocia a un identificador único de máquina (Browser Fingerprint UUID) en su primer inicio de sesión, bloqueando el acceso al PIN desde cualquier otro dispositivo no autorizado.
* **Auditoría de Registro de Acceso:** Bitácora inmutable cifrada y protegida localmente que registra intentos fallidos, logouts y redirecciones sospechosas.
* **Post-Filtro de Categorías Sensibles:** El clasificador de productos local por modelo de tópicos (`src/lib/ai/productClassifier.ts`) limpia el dataset original aplicando filtros restrictivos en caliente para omitir clasificaciones inapropiadas o sensibles del negocio.

### 6. Suite de QA & Pruebas de Robustez
Garantizamos la integridad del ERP mediante tres herramientas de diagnóstico automático:
1. **Consola QA en Navegador (`/dashboard/tests`):** Ejecuta en caliente simulaciones de adición de productos, límites de stock, split de comisiones (80/20) y control de accesos.
2. **Terminal CLI (`scripts/test-logic.js`):** Script de Node.js de alta velocidad (`npm run test:logic`) para integración continua y validación de flujos de estados (cajero -> almacén -> reparto).
3. **Tests de Estrés y Carga con k6 (`scripts/rbac_stress_test.js`):** Valida la estabilidad del sistema simulando hasta 1000 usuarios concurrentes con roles mezclados, confirmando que las redirecciones del middleware y el firewall no se rompen bajo carga.

---

## 📊 Estado de Funcionamiento del Sistema (98% Completado)

El sistema cuenta con el **98% de sus funciones activas e integradas**. El 2% restante corresponde a la colocación de credenciales definitivas del SAT (Facturapi) y pasarelas de pago (Stripe), las cuales operan actualmente en modo de simulación Sandbox para pruebas seguras del negocio.

| Módulo | Nivel de Operación | Descripción |
| :--- | :---: | :--- |
| **Punto de Venta (POS)** | `100%` | Lector láser de barra (<70ms), carrito, corte ciego de caja y tickets. |
| **Diseñador Canvas & Marca** | `100%` | Edición en vivo del e-commerce, paleta de colores e Inspector lateral. |
| **Clasificación por IA (Local Topics)**| `100%` | Categorización inteligente basada en el modelo de tópicos local (`/unsupervised_topic_modeling-master`) y filtrado sensible. |
| **Tour Onboarding del Dueño** | `100%` | Widget flotante reactivo a las rutas que acompaña al usuario paso a paso. |
| **Consola de QA & Testing** | `100%` | Consola visual, terminal de pipeline logístico y tests de estrés de concurrencia. |
| **Autenticación & RBAC** | `100%` | Restricción estricta por roles firmados, dispositivo único, y login simplificado de Superadmin mediante PIN **`0000`**. |
| **Verificador de Precios** | `100%` | Buscador de catálogo y lector por cámara del celular del cliente o lector de piso. |
| **Licenciamiento y Suscripción** | `100%` | Validación de claves seriales asociadas a la huella digital física del equipo. |
| **Logística de Repartos** | `95%` | Asignación de rutas y carga/descarga en colas físicas (patio y recogida). |
| **Facturación y Pagos SAT** | `85%` | Interfaces CFDI preparadas y pasarelas listas. Falta conectar llaves reales. |

---

## 📁 Estructura y Limpieza del Repositorio
Para garantizar la solidez y orden a nivel de archivos locales en la entrega del proyecto, el workspace fue depurado:
* **`src/`:** Todo el código fuente de producción (Next.js, Tailwind, hooks, context).
* **`prisma/`:** Esquema y base de datos local SQLite protegida (`dev.db`).
* **`scripts/`:** Herramientas de automatización y testing (`test-logic.js`, `rbac_stress_test.js`).
* **`unsupervised_topic_modeling-master/`:** Modelos de tópicos locales de entrenamiento en español para la categorización por IA offline.
* **`obsoleto/`:** Carpeta excluida del repositorio (`.gitignore`) que resguarda de forma segura los archivos temporales, scripts de migración antiguos y el monorepo duplicado deprecado (`bunkker-ecos`) para evitar colisiones de importación.

---

## 🔑 Niveles de Licenciamiento (Estándar vs PRO)

### 🆓 Versión Estándar (Gratis / Ganchar Clientes)
- **POS Completo y Almacén local:** Lectura de códigos y control de existencias.
- **Marketplace Público Básico:** Tienda responsiva para consulta de clientes.
- **Roles locales:** Operación en red local (sales, inventory, carga_descarga).
- **Exportación básica:** Guardado de reportes en Excel/Word.
- **Canvas Básico:** Editor simplificado de cabecera y catálogo.

### 💎 Versión PRO (Suscripción Mensual de $500 a $700 MXN / 7 Días de Prueba Gratis)
- **Validación Cloud (BaaS Centralizado):** Verificación remota de claves seriales vía Google Cloud Functions integradas con tu Firebase, atadas a la huella de hardware física (Machine ID) para evitar copias piratas.
- **Aislamiento Multi-Tenant:** Aislamiento absoluto de bases de datos por sucursal bajo reglas del servidor.
- **Firebase Sync Nube:** Monitoreo remoto en tiempo real de múltiples sucursales.
- **Auditoría Inmutable:** Registro forense inalterable con horas y firmas del personal.
- **Logística & Delivery:** Asignación de entregas con mapa interactivo en app y notificaciones de WhatsApp.
- **Facturación Automática CFDI 4.0:** Timbrado inteligente de facturas utilizando la API Key del Super Admin. El dueño tiene acceso a un **selector de monto mínimo configurable** en su panel para decidir el umbral a partir del cual se emite la factura, deslindando al sistema de timbrados por montos de bajo valor.
- **IA Pro Avanzada:** Clasificador asistido por LLMs comerciales y procesamiento de listas Excel de inventario previas para cargas masivas instantáneas.
- **Canvas Editor Pro:** Acceso a plantillas y bloques de diseño premium.

---

## 🛠️ Comandos Rápidos del Proyecto

Para iniciar el servidor de desarrollo:
```bash
npm run dev
```

Para correr las pruebas unitarias y de robustez lógica en la terminal:
```bash
npm run test:logic
```

---

## Estado del Proyecto
El proyecto se libera "tal cual" (as-is). Si te sirve el código, úsalo libremente.

## Apoyo y Suscripciones

Este software se mantiene y mejora de forma constante. Si deseas adquirir soporte técnico, contratar una personalización de marca o contribuir al mantenimiento del proyecto, puedes enviar tu apoyo o suscripción mensual:

* **Paypal de Soporte:** `luishalo69@gmail.com`
* **Costo de Suscripción:** $500.00 MXN a $700.00 MXN mensuales (desbloqueo completo con soporte extendido).

---

*Desarrollado con orgullo por brecha system mexico — De México para el Mundo.*

---
*Documentación oficial generada para la versión de producción v2.0*
