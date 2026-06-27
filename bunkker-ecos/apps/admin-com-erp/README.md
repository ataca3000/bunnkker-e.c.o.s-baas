# GESTOR DE EMPRESAS LOGÍSTICAS & ERP PREMIUM — ADMIN.COM

**Admin.com** es un ecosistema tecnológico de vanguardia diseñado para la gestión integral de recursos empresariales (ERP) y presencia digital autoadministrable (Marketplace) para comercios físicos y de logística.

Este proyecto combina una operación local ultrarrápida a prueba de fallas de internet (**Local-First**) con sincronización bidireccional en tiempo real hacia la nube (**Firebase BaaS**), empaquetado bajo un único instalable multiplataforma (Electron/Docker).

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

### 5. Suite de QA & Pruebas de Robustez
Garantizamos la integridad financiera del ERP mediante dos herramientas de diagnóstico automático:
1. **Consola QA en Navegador (`/dashboard/tests`):** Ejecuta en caliente simulaciones de adición de productos, límites de stock, split de comisiones (80/20) y control de accesos.
2. **Terminal CLI (`scripts/test-logic.js`):** Script de Node.js de alta velocidad (`npm run test:logic`) para integración continua y validación de cambios lógicos rápidos.

---

## 📊 Estado de Funcionamiento del Sistema (98% Completado)

El sistema cuenta con el **98% de sus funciones activas e integradas**. El 2% restante corresponde a la colocación de credenciales definitivas del SAT (Facturapi) y pasarelas de pago (Stripe), las cuales operan actualmente en modo de simulación Sandbox para pruebas seguras del negocio.

| Módulo | Nivel de Operación | Descripción |
| :--- | :---: | :--- |
| **Punto de Venta (POS)** | `100%` | Lector láser de barra (<70ms), carrito, corte ciego de caja y tickets. |
| **Diseñador Canvas & Marca** | `100%` | Edición en vivo del e-commerce, paleta de colores e Inspector lateral. |
| **Clasificación por IA (SanJoseAI)** | `100%` | Categorización inteligente de productos local + fallback a API en la nube. |
| **Tour Onboarding del Dueño** | `100%` | Widget flotante reactivo a las rutas que acompaña al usuario paso a paso. |
| **Consola de QA & Testing** | `100%` | Consola visual y terminal para pruebas de robustez matemática. |
| **Autenticación & RBAC** | `100%` | Restricción estricta por roles y bypass local de rescate offline para Super Admin. |
| **Verificador de Precios** | `100%` | Buscador de catálogo y lector por cámara del celular del cliente o lector de piso. |
| **Licenciamiento y Suscripción** | `100%` | Validación de claves seriales asociadas a la huella digital física del equipo. |
| **Logística de Repartos** | `95%` | Asignación de rutas y carga/descarga en colas físicas (patio). |
| **Facturación y Pagos SAT** | `85%` | Interfaces CFDI preparadas y pasarelas listas. Falta conectar llaves reales. |

---

## 🔑 Niveles de Licenciamiento (Estándar vs PRO)

### 🆓 Versión Estándar (Gratis / Ganchar Clientes)
- **POS Completo y Almacén local:** Lectura de códigos y control de existencias.
- **Marketplace Público Básico:** Tienda responsiva para consulta de clientes.
- **Roles locales:** Operación en red local (sales, inventory, carga_descarga).
- **Exportación básica:** Guardado de reportes en Excel/Word.
- **Canvas Básico:** Editor simplificado de cabecera y catálogo.

### 💎 Versión PRO (Pago Único $1,500 MXN o Suscripción)
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

## Apoyo
Si algún día este código te genera valor y gustas apoyar, cualquier donación es bien recibida:

**Solana Wallet:** `8AXcynfJ1ijr4Y6XcXaSGcqUgUzwsykHwg1vwDQQnoh1`

---
*Documentación oficial generada para la versión de producción v2.0*
