# DOSSIER DE CUMPLIMIENTO TÉCNICO, POLÍTICA DE SEGURIDAD Y CONTINUIDAD OPERATIVA
**BUNKKER E.C.O.S. (Ecosistema Comercial Omnipotente Sincronizado)**  
*Desarrollado por Brecha Soluciones DS — Luis Felipe Durán Salinas*  
*Documento de Referencia para Auditorías, Licitaciones y Clientes Industriales*

---

## 1. DECLARACIÓN GENERAL Y PRIVACIDAD POR DISEÑO (LOCAL-FIRST)

BUNKKER E.C.O.S. ha sido concebido desde sus primeros principios bajo la filosofía de **Soberanía Absoluta de la Información** y **Privacidad por Diseño (Privacy by Design)**:
* **Descentralización del Dato:** La base de datos operativa, los registros de clientes, los catálogos y los cortes de caja residen físicamente en el hardware del cliente (PC Maestra local).
* **Cero Fuga a Granjas Compartidas:** A diferencia de los ERPs multi-tenant en nubes públicas centralizadas, los datos transaccionales del negocio no se mezclan con los de otras empresas ni se exponen a filtraciones masivas de terceros.
* **Operación Autónoma:** La operatividad del punto de venta y despacho físico no está supeditada a enlaces de telecomunicaciones externos.

---

## 2. MARCO DE ALINEACIÓN CON ESTÁNDARES INTERNACIONALES

La cadena de suministro digital de BUNKKER E.C.O.S. se apoya en infraestructura de nivel empresarial auditada:

| Estándar Internacional | Cobertura de Infraestructura (GitHub Enterprise / Base) | Implementación Específica en BUNKKER E.C.O.S. |
|---|---|---|
| **ISO/IEC 27001:2022** *(Seguridad de la Información)* | Repositorio y control de versiones alojado bajo organización Enterprise auditada. | Segregación de roles (RBAC), hashes Bcrypt, firmas de sesión HMAC y cifrado simétrico AES-256 en auditoría. |
| **SOC 1 / SOC 2 Tipo 2** *(Controles Internos y Financieros)* | Evaluaciones periódicas de seguridad, disponibilidad e integridad de datos en el ciclo CI/CD. | Conciliación transaccional estricta en SQLite (ACID/WAL), bitácora inmutable de eventos (`OrderEvent`). |
| **ISO/IEC 42001:2023** *(Gobernanza de Sistemas de IA)* | Cumplimiento del ecosistema de desarrollo de inteligencia artificial responsable. | Motor LION embebido localmente; la IA clasifica inventario y balancea carga **sin transmitir datos a APIs de terceros**. |
| **PCI-DSS (Alineación)** | Prácticas seguras para el procesamiento de transacciones financieras. | Integraciones con pasarelas certificadas (Stripe / MercadoPago) mediante tokens cifrados, sin almacenar números de tarjeta en disco local. |

---

## 3. MATRIZ DE CONTROLES TÉCNICOS EN EL CÓDIGO FUENTE

El sistema materializa controles rigurosos verificables en el repositorio:

### A. Control de Acceso y Segregación de Funciones (ISO 27001 - A.9)
* **Principio de Mínimo Privilegio:** 7 roles operativos independientes (`superadmin`, `admin`, `sales`, `inventory`, `driver`, `carga_descarga`, `pickup`).
* **Protección Criptográfica de Credenciales:** Validación de PINs mediante funciones de dispersión unidireccional (Bcrypt). Las sesiones operan con tokens sellados mediante algoritmo criptográfico HS256 / firmas HMAC temporizadas.
* **Fusibles de Concurrencia:** Protección con timeouts automáticos (`Promise.race` a 1,500 ms) para evitar bloqueos en mostrador.

### B. Criptografía y Protección de Datos (ISO 27001 - A.10)
* **Cifrado en Tránsito:** Tráfico web y websockets empaquetados bajo TLS/HTTPS dinámico en red de área local (LAN).
* **Cifrado en Reposo:** Bitácora forense (`audit.ts`) cifrada con **AES-256-CBC**, salvaguardando los registros de auditoría contra manipulación local.

### C. Auditoría Forense y Trazabilidad (ISO 27001 - A.12.4)
* **Modelo `OrderEvent` Inmutable:** Cada cambio de estado de un pedido (creación, toma, carga en patio, ruta, entrega con firma y coordenadas GPS) se almacena como un evento inmutable con marca de tiempo, actor y rol.
* **Anti-Tampering:** La base de datos histórica no permite la alteración destructiva de folios ni la superposición de tickets cerrados.

---

## 4. PLAN DE CONTINUIDAD OPERATIVA Y RECUPERACIÓN (DRP / BCP)

Para garantizar que el negocio no se detenga ante cortes de energía, fallas de red o siniestros de hardware:

### Métricas de Continuidad
* **RPO (Recovery Point Objective):** `< 1 segundo`. El modo Write-Ahead Logging (WAL) de SQLite ejecuta commits atómicos inmediatos por transacción.
* **RTO (Recovery Time Objective):** `< 15 minutos`. En caso de destrucción física del equipo maestro, basta con instalar el ejecutable `.exe` en una nueva máquina y restaurar el archivo de base de datos `.db`.

### Protocolos de Contingencia
1. **Caída del Enlace de Internet Exterior:**
   * La operación local continúa al 100% de capacidad sobre la red Wi-Fi/LAN local del establecimiento.
2. **Corte Eléctrico / Apagón de Router Wi-Fi:**
   * La PC Maestra cuenta con capacidad de habilitar de forma autónoma una red Hotspot local directa (`netsh wlan start hostednetwork`), permitiendo a las terminales seguir operando en mostrador.
3. **Desconexión Total en Ruta (Repartidores / Choferes):**
   * El personal en ruta cuenta con la aplicación PWA instalada en memoria local mediante Service Worker (`sw.js`).
   * Las órdenes, firmas electrónicas y fotografías de entrega se almacenan de forma local en el dispositivo (`useDeliveryStore`) y se reconcilian automáticamente con la base central al regresar al predio comercial.

---

## 5. GOBERNANZA DE INTELIGENCIA ARTIFICIAL (LION & TOPICS ENGINE)

En cumplimiento de los principios de IA Responsable (ISO/IEC 42001):
* **Propósito:** Asistir al comerciante en categorización rápida de productos y detección de cuellos de botella en patio.
* **Supervisión Humana Obligatoria (Human-in-the-Loop):** Toda sugerencia algorítmica del asistente requiere validación del usuario previo a la aplicación en inventario o precios.
* **Soberanía del Algoritmo:** El motor funciona con matrices semánticas cacheadas en disco local (`topicMapper.ts`), sin enviar métricas comerciales del negocio a modelos en la nube.

---

## 6. TITULARIDAD LEGAL Y REGISTRO

* **Entidad Desarrolladora:** Brecha Soluciones DS.
* **Autor Intelectual:** Luis Felipe Durán Salinas (Philip Durán).
* **Ubicación Técnica:** Tetla, Tlaxcala, México.
* **Soporte Oficial:** `luishalo69@gmail.com`
* **Derechos de Autor:** Protegido por la Ley Federal del Derecho de Autor (México), Memoria Técnica INDAUTOR y tratados internacionales de Berna.
