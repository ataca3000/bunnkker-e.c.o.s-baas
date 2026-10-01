# Mapeo de Roles, Seguridad y Licencias — BUNKKER E.C.O.S & LION

Este documento establece la matriz de accesos y responsabilidades lógicas, el comportamiento del portal de acceso discreto, la sincronía de roles en la preparación de órdenes y las políticas de monetización del sistema.

---

## 🔑 Matriz de Roles y Responsabilidades

| Rol | Dashboard Asignado | Capacidad Operativa |
| :--- | :--- | :--- |
| **superadmin** | `/dashboard/guia` (Maestro) | **Dueño del Negocio.** Control absoluto, altas de personal, configuración fiscal y revisión de auditoría. Solo puede existir un Super Admin. |
| **admin** | `/dashboard/inventory` | **Gerente de Sucursal.** Gestión del catálogo, control de stock alto, y visualización de reportes locales. |
| **sales** | `/dashboard/sales` | **Cajero/Vendedor.** Apertura y cobro en Punto de Venta, escáner, cola de pedidos mostrador (`📦 PISO / CAJA`) y corte ciego de caja. |
| **inventory** | `/dashboard/inventory` | **Almacenista.** Altas de producto, control de existencias físicas, apoyo opcional en recolección y optimización del almacén. |
| **billing** | `/dashboard/billing` | **Contabilidad.** Timbrado y auditoría fiscal de facturas SAT. |
| **driver** | `/dashboard/delivery` | **Repartidor.** Despachos en ruta (`🛵 REPARTIDOR / OBRA`), itinerario de rutas GPS, firma digital y foto de evidencia. |
| **carga_descarga** | `/dashboard/patio` | **Operador de Patio.** Carga, descarga y control de cola de entregas pesadas (`🏗️ CARGA / PATIO`), bahías de patio. |
| **client** | `/catalogo` o `/cuenta` | **Cliente Final.** Compra en línea o en tienda por autoservicio, selección de método de entrega, QR de orden e historial de pedidos. |

---

## 🔄 Sincronía Autónoma en Preparación de Órdenes (AXIOM_15)

Cuando un cliente genera una orden desde el carrito (mostrador o web):
1. **Publicación en Pizarra:** El pedido se expone en la pizarra pública correspondiente a su método de entrega (`/dashboard/sales` para Piso, `/dashboard/patio` para Patio, `/dashboard/delivery` para Ruta).
2. **Reclamo Exclusivo (Lock-Claim):** Cualquier miembro del rol asignado (o el almacenista de soporte) puede tomar la orden. Al dar clic en "Tomar Pedido", la orden queda bloqueada para los demás evitando duplicidades.
3. **Validación de Entrega y Cierre:**
   - Para Patio o Reparto: Se valida con foto de la carga o entrega y firma digital del cliente.
   - Para Piso/Caja: Se valida el pase de entrega escaneando el QR o confirmando el cobro en mostrador.
4. **Registro Forense Inmutable (`OrderEvent`):** Cada pase de estado (creada, reclamada, cargada, entregada) graba el ID del usuario, su nombre, su rol y su timestamp en SQLite sin posibilidad de alteración.

---

## 🚦 Mecánica de Acceso Discreto (Login Camuflado)

Para resguardar la seguridad del backoffice de la tienda frente a curiosos o intrusiones de personal:
1. **Acceso Unificado:** Clientes, cajeros y administradores inician sesión en la misma pantalla `/login`. Visualmente no hay indicios de botones administrativos.
2. **Opción de Recuperación:** Se habilita el botón "Olvidé mi contraseña" para enviar un correo de reinicio o un código de validación SMS al celular registrado del usuario.
3. **Bypass y Redirección en Servidor:** Al autenticar las credenciales, el sistema lee el rol del usuario:
   - Rol `client` $\rightarrow$ Redirige a `/catalogo` o `/cuenta`.
   - Roles de personal $\rightarrow$ Redirige en caliente a su respectiva ruta `/dashboard/*`.
   - Si no hay internet y se detecta el Nodo Maestro, el Super Admin puede entrar ingresando las credenciales de bypass local configuradas en el archivo de inicio.

---

## 🛡️ Perros Guardianes de Integridad
- **Super Admin Único:** Las validaciones de la base de datos local y Firebase impiden registrar más de un Super Administrador por número de serie del equipo para evitar usurpaciones de propiedad.
- **Evitar Duplicados:** Las validaciones a nivel de persistencia rechazan nombres de usuario o correos idénticos al crear personal.
- **Logs de Auditoría Inmutables:** Cada acción operativa genera un registro en formato de texto con fecha, hora y operador. Los logs son de solo lectura y se pueden exportar a PDF o Word con firmas digitales, pero no se pueden editar ni borrar bajo ninguna circunstancia.

---

## 💰 Niveles de Licenciamiento (Estándar vs PRO)

### 🆓 Versión Estándar (Gratis / Ganchar Clientes)
- **POS Completo y Almacén local:** Lectura de códigos y control de existencias.
- **Marketplace Público Básico:** Tienda responsiva para consulta de clientes.
- **Roles locales:** Operación en red local (sales, inventory, carga_descarga).
- **Exportación básica:** Guardado de reportes en Excel/Word.
- **Canvas Básico:** Editor simplificado de cabecera y catálogo.

### 💎 Versión PRO (Pago Único $1,500 MXN o Suscripción)
- **Validación Cloud (BaaS):** Las llaves seriales se verifican de forma remota mediante una **Google Cloud Function** conectada a Firestore y vinculada a la huella digital del equipo (Machine ID) para evitar duplicidades o piratería.
- **Aislamiento Multi-Tenant:** Aislamiento absoluto de bases de datos por sucursal bajo reglas del servidor.
- **Firebase Sync Nube:** Monitoreo remoto en tiempo real de múltiples sucursales.
- **Auditoría Inmutable:** Registro forense inalterable con horas y firmas del personal.
- **Logística & Delivery:** Asignación de entregas con mapa interactivo en app y notificaciones de WhatsApp.
- **Facturación Automática CFDI 4.0:** Timbrado inteligente de facturas usando la API Key del Super Admin. El dueño tiene acceso a un **selector de monto mínimo configurable** en su panel para decidir a partir de qué cantidad timbrar facturas, deslindando al sistema de reclamos de los clientes por montos de bajo valor.
- **IA Pro Avanzada:** Clasificador asistido por LLMs comerciales y procesamiento de listas Excel de inventario previas para cargas masivas instantáneas.
- **Canvas Editor Pro:** Acceso a plantillas y bloques de diseño premium.