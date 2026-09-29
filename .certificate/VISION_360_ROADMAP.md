# 🌐 BUNKKER E.C.O.S. — Visión 360° y Hoja de Ruta

## 1. 🎯 Objetivo Central
Construir y afianzar la plataforma comercial **BUNKKER E.C.O.S.** como un sistema POS/ERP **ultra-confiable para el cliente final**:
- **100% Autónomo en Local**: La terminal de venta (Electron + SQLite) nunca se congela, no depende de internet ni de la nube para cobrar, emitir tickets, descontar inventario o comunicarse en red local.
- **Autoridad Local (Local-Master)**: Los movimientos físicos en mostrador tienen prioridad absoluta. La nube en Vercel obedece y consolida los datos del local cuando hay sincronización.
- **Sincronización Bidireccional Confiable**: Transacciones con colas de salida persistentes (*Outbox*), claves de idempotencia y resolución de conflictos sin pérdidas de información.

---

## 2. 🗺️ Mapa de Pasillos y Arquitectura

```
                        [ ☁️ VERCEL CLOUD ]
                   (https://bunnkker-e-c-o-s-baas.vercel.app/)
                   PostgreSQL / Prisma API / Central SaaS
                                    ▲
                                    │ Sincronización Bidireccional
                                    │ (Outbox Queue / Local Master)
                                    ▼
                 [ 🖥️ TERMINAL LOCAL ELECTRON (MAESTRO) ]
                 Next.js Standalone (:3000) + SQLite (WAL)
                 Radio-Server (:3001 Data Sync / :3002 Voice)
                                    │
                                    ├─── [ 📱 NODO 1 (Caja 2 LAN) ]
                                    ├─── [ 📦 NODO 2 (Almacén / Patio) ]
                                    └─── [ 🔒 AUDITORÍA CIFRADA (AES-256) ]
```

---

## 3. 🏁 Hitos para la Ejecución Rápida y Confiable

| Fase | Hito Técnico | Entregables Clave |
| :--- | :--- | :--- |
| **Fase 1** | **Persistencia & Outbox Local** | Tabla `sync_outbox` en SQLite, transacciones ACID en cobros de mostrador, eliminación de riesgo de colisión. |
| **Fase 2** | **Sincronización Vercel ↔ Local** | Endpoints `/api/sync/push` (nube obedece local) y `/api/sync/pull` (catálogo y pedidos web hacia local). |
| **Fase 3** | **Calidad y Pipeline Git** | Husky + Lint-staged, suite de pruebas automatizadas sobre inventario y ventas. |
| **Fase 4** | **Empaquetado y Distribución** | Generación y validación del instalador `.exe` (NSIS) de producción. |
