<div align="center">

# ☀️ BUNKKER E.C.O.S ERP — Red Terrestre P2P de Nodos Solares

**Ecosistema Comercial de Operaciones Simplificadas, POS y Red Nodal Terrestre (Cero Satélites)**

[![License](https://img.shields.io/badge/License-Source--Available-blue.svg)](./LICENSE.md)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black.svg)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Patent](https://img.shields.io/badge/Patent-PAT--BUNKKER--2026-green.svg)](./docs/PATENTE_NODOS_BANDERA.md)

---

</div>

## 📌 Visión General

**BUNKKER E.C.O.S ERP** es una arquitectura de software de alto rendimiento diseñada para operar **100% en redes terrestres locales mediante nodos solares instalados en postes de las cuadras**, eliminando completamente la dependencia de satélites en el espacio, redes globales o servidores centrales en la nube.

---

## ☀️ Arquitectura de Nodos Solares en Postes (Cero Satélites)

El sistema utiliza la invención registrada de **Nodos Terrestres Solares**:

```mermaid
graph TD
    POSTE_1["☀️ Nodo Solar Poste Cuadra 1"] <-->|Wi-Fi / NFC Terrestre 0ms| POSTE_2["☀️ Nodo Solar Poste Cuadra 2"]
    POSTE_2 <-->|Wi-Fi / NFC Terrestre 0ms| MAESTRO["👑 NODO MAESTRO (Servidor Local)"]
    
    MAESTRO <-->|Write-Ahead Logging| DB_LOCAL[("💾 SQLite WAL / IndexedDB")]
    MAESTRO <-->|Notitas GPS| REPARTIDOR["🚚 Repartidor Terrestre"]
```

### ⚡ Innovaciones Clave Patentadas:
1. **Cero Dependencia Satelital:** Operación autónoma en tierra sin señales orbitales ni espacio.
2. **Nodos Solares en Postes de Cuadra:** Alimentación solar diurna para interconexión Wi-Fi/NFC entre calles.
3. **Capa Terrestre Aislada:** Protocolo de baja latencia firmado con criptografía HMAC SHA-256.
4. **Resguardo Cíclico en Núcleo:** Re-ofuscación periódica en memoria RAM (cada 5s) e historial de auditoría inalterable.

---

## 📑 Documentación Técnica & Patentes

- 📜 [PATENTE_NODOS_BANDERA.md](./docs/PATENTE_NODOS_BANDERA.md) — Registro de Patente (Nodos Solares Terrestres & Cero Satélites).
- 🏗️ [ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Especificación Arquitectónica del Sistema.
- 👥 [ROLES_MAP.md](./docs/ROLES_MAP.md) — Matriz de Roles (RBAC) y Seguridad.
- 📜 [PULL_REQUEST_TEMPLATE.md](./.github/PULL_REQUEST_TEMPLATE.md) — Plantilla Estándar de PRs.

---

## 🛠️ Instalación y Uso Local

```bash
# 1. Clonar el repositorio
git clone https://github.com/ataca3000/bunnkker-e.c.o.s-baas.git

# 2. Instalar dependencias
npm install

# 3. Iniciar entorno de desarrollo local
npm run dev
```

---

## 💳 Licenciamiento y Derechos Reservados

© 2026 **Brecha Soluciones DS / Luis Felipe Durán Salinas**. Todos los derechos reservados.  
Uso sujeto a términos y condiciones descritos en [LICENSE.md](./LICENSE.md).
