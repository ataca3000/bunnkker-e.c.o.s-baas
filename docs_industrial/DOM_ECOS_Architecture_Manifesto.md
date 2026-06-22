# MANIFIESTO DE ARQUITECTURA: D.O.M. & E.C.O.S.
**Documento Técnico de Diseño Industrial y Patente Estructural**

Este documento detalla la fundamentación técnica, el código genético (ADN) y el soporte estructural de la plataforma descentralizada de comercio y punto de venta.

---

## 1. NOMENCLATURA Y DEFINICIÓN DEL SISTEMA

El sistema abandona el estándar obsoleto de ERP (Enterprise Resource Planning) para evolucionar hacia dos componentes interconectados que definen su superioridad técnica:

### 1.1 D.O.M. (Decentralized Operational Matrix)
**Definición:** Matriz Operacional Descentralizada.
**Respaldo Técnico:** A diferencia de la arquitectura Cliente-Servidor tradicional, el D.O.M. convierte cada dispositivo físico (caja, tablet, kiosko) en un nodo autónomo. Cuando se corta la conectividad de red local (LAN) o de área amplia (WAN), el nodo no se congela. Las operaciones se inscriben localmente en el motor WAL (Write-Ahead Logging) y se inyectan a la matriz P2P en el momento exacto en que la topología de red se reestablece. Ningún nodo único (single point of failure) tiene el poder de colapsar la operación del establecimiento.

### 1.2 E.C.O.S. (Ecosistema Comercial Offline Sincronizado)
**Definición:** Ecosistema multicapa que integra a los 3 vectores críticos del comercio sin requerir puentes en la nube.
**Respaldo Técnico:** E.C.O.S. encapsula el "Triángulo de Soporte Sólido" o "Tridilosa":
1. **Administrador/Propietario:** Control maestro, inmutable a nivel de hardware.
2. **Sistema Operativo Interno (Empleados):** Gestión de inventario, cajas y picking sin cuellos de botella de red.
3. **Módulo de Mercado (Clientes):** Interfaz pública que corre bajo la misma red fantasma (LAN) aislada, permitiendo al cliente conectarse, explorar y pedir sin que la integridad del inventario maestro corra peligro.

---

## 2. EL ADN DE LA ESTRUCTURA "TRIDILOSA" Y RED FANTASMA

La arquitectura Tridilosa distribuye el peso de las transacciones (solicitudes HTTP y mutaciones de estado) a través de tres pilares que garantizan tolerancia a fallos.

### 2.1 El Algoritmo "Caballo de Troya" (Inyección Silenciosa)
Para prevenir regresiones y vulnerabilidades comunes en sistemas monolíticos, la mutación del inventario utiliza el enfoque "Caballo de Troya". 
En lugar de refactorizar y destruir firmas de funciones pre-existentes (Ej. UUIDs en `addToCart`), el motor atómico inyecta el seguimiento `txId` (Transaction ID) de forma subterránea. El contenedor externo mantiene su estructura inofensiva, pero en su interior ejecuta sincronización atómica idempotente.

### 2.2 Sincronización P2P "Atomic Engine" (Motor Atómico)
La columna vertebral del D.O.M. está implementada en `src/lib/localSync.ts`.
- **Idempotencia Transaccional:** Cada orden de venta genera una firma única. Si dos cajas (nodos) envían la solicitud de compra por el mismo milisegundo o por rebotes de red, el nodo principal detecta el `txId` y rechaza la ejecución duplicada.
- **Estrés en Red Degradada:** La prueba de caos ISO demuestra que frente a peticiones simultáneas sobre el mismo artículo con stock `N`, el Motor Atómico garantiza el descuento exacto de `N`, derivando excedentes a estado "Rechazado/Stock Insuficiente" sin corromper la base de datos.

---

## 3. PROTOCOLOS DE SEGURIDAD FÍSICA Y AUTENTICACIÓN

El sistema E.C.O.S. es impermeable a ciberataques externos porque su validación más crítica ocurre en la capa de hardware y proximidad física.

### 3.1 Llave Maestra Encriptada (Master Serial Key)
El acceso omnipotente (Super Admin) carece de pantallas de Login tradicionales que puedan sufrir ataques de fuerza bruta. La inicialización del Nodo Maestro (`activateMaster`) requiere la llave serial incrustada físicamente en la credencial del dueño (Ej. `EVO-MASTER-2026-X79`). Sin esta llave, el ejecutable `.exe` jamás desencriptará la base de datos subyacente.

### 3.2 Despliegue de Credenciales Biométricas/QR
La escalabilidad de nodos esclavos (trabajadores y clientes) depende de tokens QR de un solo uso.
- **Zero-Login para Empleados:** El administrador genera un QR desde el Nodo Maestro que autoriza permisos R/W (Read/Write) específicos (Caja, Almacén). Al escanearlo, el dispositivo del empleado se convierte en un nodo D.O.M. oficial asociado a su hardware ID.
- **Capa Cliente:** Un código QR de solo lectura (`/dashboard/link` o `qr/page.tsx`) conecta el smartphone del cliente a la red fantasma LAN, brindándole acceso al catálogo, pero operando en un ambiente estricto ("Sandbox") que no tiene privilegios de mutación directos sobre el motor D.O.M.

---
*Propiedad Intelectual Protegida. Diseñado para distribución industrial masiva y despliegues sin dependencia en la nube.*
