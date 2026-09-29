# 📖 Historia y Resumen Técnico del Proyecto BUNKKER E.C.O.S.

## 1. Génesis y Visión del Proyecto

**BUNKKER E.C.O.S.** (Ecosistema Comercial Offline Sincronizado) nace de una necesidad operativa crítica en el tejido comercial de América Latina: las recurrentes caídas de internet, cortes de energía y la inestabilidad de la infraestructura de telecomunicaciones que paralizan cajas de cobro, provocan pérdida de clientes y desalinean los inventarios.

Frente al modelo convencional SaaS centralizado en la nube (que cobra rentas elevadas en dólares y deja a los negocios varados ante una falla de conexión), BUNKKER E.C.O.S. fue diseñado desde sus primeros principios bajo el paradigma **Local-First**. Cada máquina física instalada en la tienda o almacén opera como un nodo autónomo soberano con capacidad de cómputo en el borde (Edge Computing).

---

## 2. Pilares de Arquitectura Técnica

### 2.1. Persistencia Híbrida Multi-Vault
- **Motor Transaccional Primario:** SQLite embebido de alta velocidad (<50ms de latencia) mediante Prisma ORM con modo WAL (*Write-Ahead Logging*) activado.
- **Respaldo en la Nube:** Sincronización idempotente hacia PostgreSQL / Supabase para reportes consolidados y multi-sucursal.
- **Cadena de Validación Criptográfica:** Registro de operaciones encadenado con SHA-256 para prevenir fraudes, colisiones o doble gasto:
  $$H_n = \text{SHA256}\left(\text{id}_n \times \text{monto}_n \times \text{timestamp}_n \times \text{usuario}_n \times H_{n-1}\right)$$

### 2.2. Red Nodal P2P y Comunicación LAN
- Descubrimiento automático de terminales dentro del mismo Wi-Fi vía mDNS.
- Canal de audio Walkie-Talkie en tiempo real para el personal operativo (puerto 3002) a cero costo de ancho de banda WAN.
- Protocolo "Heredero al Trono" para conmutación inmediata (*hot standby*) en caso de daño en la terminal maestra.

### 2.3. Control de Stock Flotante y Conciliación Cero-Fuga
- Durante la venta o apartado en mostrador, las unidades se reservan en `reservedStock`.
- El descuento contable e inventario físico real ocurre **únicamente** cuando el equipo de patio o chofer valida la entrega con fotografía y firma digital.
- Si una orden se cancela, se des-crea inmediatamente retornando el stock sin discrepancias.

---

## 3. Propiedad Intelectual y Registros

- **Titular de los Derechos:** Luis Felipe Durán Salinas (Philip Durán) / Brecha Soluciones S.A. de C.V.
- **Registro de Obra de Software:** Memoria técnica descriptiva depositada ante el Instituto Nacional del Derecho de Autor (INDAUTOR) — México.
- **Reivindicaciones de Patente Nodal:** Protocolos de operación de mini data center privado terrestre y conmutación de energía in situ.
- **Licencia de Código:** Business Source License 1.1 (BSL 1.1), protegiendo la explotación comercial de la tecnología.
