<div align="center">

# 📜 BUNKKER E.C.O.S. (Ecosistema Comercial Offline Sincronizado)

**Memoria Técnica Descriptiva de Arquitectura, Ingeniería de Sistemas e Registro INDAUTOR**

[![License](https://img.shields.io/badge/License-Source--Available-blue.svg)](./LICENSE.md)
[![INDAUTOR](https://img.shields.io/badge/INDAUTOR-Registrado-gold.svg)](./docs/BUNKKER_ECOS_MEMORIA_TECNICA_INDAUTOR.md)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)

---

</div>

## 📌 Datos de Registro Institucional

- **Denominación de la Obra:** BUNKKER E.C.O.S. (Ecosistema Comercial Offline Sincronizado)
- **Titular de los Derechos:** Luis Felipe Durán Salinas (Philip Durán) / Brecha Soluciones S.A. de C.V.
- **Campo de Aplicación:** Planificación de Recursos Empresariales (ERP), Puntos de Venta (POS) masivos y Orquestación Logística Descentralizada Local-First.
- **Instancia Destinataria:** Instituto Nacional del Derecho de Autor (INDAUTOR) — México.
- **Entorno Tecnológico:** TypeScript, Next.js 15 (App Router), React 19, Electron Core Node Environment, SQLite Embebido, Prisma ORM, Firebase / Cloud Firestore BaaS.

---

## 🏛️ Resumen de Arquitectura e Ingeniería de Sistemas

```mermaid
graph TD
    MAESTRO["👑 NODO MAESTRO (Servidor Local 0ms)"] <-->|Sincronización P2P mDNS| ESCLAVO["📱 Nodos Esclavos (POS / Inventario)"]
    MAESTRO <-->|Write-Ahead Logging| DB_LOCAL[("💾 SQLite WAL / IndexedDB")]
    MAESTRO <-->|Hot Standby / Heredero al Trono| HOT_STANDBY["🛡️ Nodo Sucesor (Hot Standby)"]
    MAESTRO -.->|Sincronización Asíncrona| CLOUD[("☁️ Google Cloud Firestore BaaS")]
```

### ⚡ Pilares de la Invención Registrada:
1. **Matriz Operacional Descentralizada (D.O.M.):** Transacciones inmutables mediante cadena de hashes $H_n = \text{SHA256}(id_n \times monto_n \times timestamp_n \times usuario_n \times H_{n-1})$.
2. **Arquitectura Multi-Vault (SQLite + Prisma + Firestore):** Operación ultrarrápida local (<70ms) con respaldo asíncrono pasivo en la nube.
3. **Mecanismo Hot Standby ("Heredero al Trono"):** Conmutación por error en menos de 15s ante caídas del servidor maestro sin condición de cerebro dividido (split-brain).
4. **Sesiones Offline Prolongadas:** Renovación silenciosa mediante `refreshToken` encriptado localmente para reconexiones sin interrupción.

---

## 📑 Documentación Legal y Técnica Completa

- 📜 [BUNKKER_ECOS_MEMORIA_TECNICA_INDAUTOR.md](./docs/BUNKKER_ECOS_MEMORIA_TECNICA_INDAUTOR.md) — Memoria Técnica Descriptiva Completa INDAUTOR.
- 📜 [PATENTE_NODOS_BANDERA.md](./docs/PATENTE_NODOS_BANDERA.md) — Registro de Patente Nodal Terrestre.
- 🏗️ [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Especificación Arquitectónica.

---

## 💳 Licenciamiento y Derechos Reservados

© 2026 **Brecha Soluciones S.A. de C.V. / Luis Felipe Durán Salinas**. Todos los derechos reservados.  
Obra registrada ante el Instituto Nacional del Derecho de Autor (INDAUTOR).
