# 🔒 BUNKKER E.C.O.S (Camaleón Topics ERP) — Ecosistema Comercial Local-First

**BUNKKER E.C.O.S ERP** es una plataforma de software comercial privada y propietaria desarrollada por **Brecha Soluciones DS / Luis Felipe Durán Salinas**. Diseñada para empresas, comercios y negocios que requieren un ERP/POS profesional de alto rendimiento que funcione 100% sin internet en redes locales Wi-Fi/LAN.

---

## ⚡ Características Principales

✅ **Punto de Venta (POS) Profesional** - Lectura de códigos de barras, carrito, tickets e impresión.  
✅ **Inventario & Clasificación IA** - Control de stock en tiempo real, estantería virtual y categorización por NLP.  
✅ **Sincronización P2P Multi-Navegador** - Operación en red local 0ms sin dependencia de servidores en la nube.  
✅ **Radio Staff Interna (Puerto 3002)** - Walkie-talkie dedicado para voz de personal en canal aislado.  
✅ **Logística & Delivery GPS** - Algoritmo de ruteo óptimo TSP para choferes y despacho.  
✅ **Facturación SAT CFDI 4.0** - Integración con Facturapi para emisión de comprobantes fiscales.  
✅ **Modo Local-First Inmune a Caídas** - Funciona sin internet, sincroniza en segundo plano.  
✅ **Auditoría Inmutable & Respaldos** - Descarga de base de datos SQLite en JSON e historial de operaciones.  
✅ **DEV MINIMAP v2.0** - HUD de localización de código en tiempo real (Vista Árbol IDE + Diagrama de Nodos).

---

## 📱 Plataformas Soportadas

- 🖥️ **Windows** - Aplicación de escritorio (Electron)
- 💻 **Web Local / LAN** - Acceso desde cualquier navegador en red local (Next.js)
- 🍎 **macOS / Linux** - Compatible (Electron / Node)

---

## 💳 Licenciamiento y Suscripción Comercial

Este software está sujeto a una **Licencia Comercial Propietaria Restringida** (ver [LICENSE.md](./LICENSE.md)). **NO es de código abierto ni de uso gratuito.**

### **Planes de Licencia:**

- **Plan Independiente / Pyme:** $500 MXN / mes por máquina/instalación.
- **Plan Empresarial / Multi-Sucursal:** $1,000 MXN / mes por máquina/instalación.

Para activación de licencias, llaves `ADMIN-XXXX-XXXX-XXXX` o PINs offline de 6 dígitos:
- **Contacto Soporte & Ventas:** `luishalo69@gmail.com`
- **Titular de Propiedad:** Luis Felipe Durán Salinas / Brecha Soluciones DS

---

## 🔧 Stack Tecnológico

```
Frontend & UI:
├── React 19
├── Next.js 15 (App Router)
├── TypeScript & Tailwind CSS
└── BroadcastChannel (Sync 0ms en RAM)

Backend & Motores Locales:
├── Next.js API Routes (HMAC SHA-256 Auth)
├── Prisma ORM & SQLite (WAL Mode)
└── Socket.IO (Data Sync 3001 & Radio 3002)

Desktop Executable:
├── Electron 42
└── node-machine-id (Huella de Hardware Físico)
```

---

## 📝 Derechos Reservados y Propiedad Intelectual

Queda estrictamente prohibida la clonación, descompilación, redistribución o comercialización no autorizada del motor central, topología de red P2P o interfaz de este sistema sin contar con una licencia comercial activa otorgada por **Brecha Soluciones DS**.

*Derechos Reservados © 2026 Brecha Soluciones DS / Luis Felipe Durán Salinas. Todos los derechos reservados.*
