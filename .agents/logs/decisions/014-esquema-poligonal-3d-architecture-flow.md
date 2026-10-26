# ADR 014: Visualizador de Esquema Poligonal 3D por Capas Isométricas & Fontanería N3

## 1. Contexto & Requerimiento
El usuario solicitó un esquema poligonal libre ("esquema poligono free") basado en la tendencia de arquitectura de software en vistas por capas tipo 3D, donde se plasma el flujo circulatorio completo del sistema.

## 2. Diagnóstico & Principios de Fontanería N3
Los diagramas 2D planos tradicionales no representan fielmente la profundidad de la arquitectura local-first de BUNKKER E.C.O.S. (concurrencia de SQLite WAL, mallas de radio LAN, geocercas poligonales de entrega, máquinas de estado FSM y compuertas de seguridad fail-closed).

## 3. Solución Implementada
1. **Topología de Capas Isométricas (`src/lib/architecture-3d/schemaPoligonoTypes.ts`)**:
   - Capa 1: Raíces & Terminales (POS Caja, PWA Móvil, Tablet Patio, App Repartidor).
   - Capa 2: Arterias & Transporte (Next.js Edge/API, Socket.IO Malla Radio Local, BroadcastChannel).
   - Capa 3: Compuertas Lógicas & FSM (OrderStateMachine, StockMutex Concurrencia, Freemium Guard).
   - Capa 4: Corazón & Persistencia (SQLite WAL Local-First, Prisma ORM, Replicador Cloud).
   - Capa 5: Salidas & Órganos Vivos (Ticket ESC/POS, PoD Firma Digital, FacturAPI CFDI).
2. **Componente Visualizador 3D React (`src/components/architecture-3d/EsquemaPoligono3D.tsx`)**:
   - Órbita y rotación 3D libre con arrastre de ratón (X/Z tilt).
   - Deslizador de vista explotada (Exploded View: 20px a 180px de separación vertical).
   - Motor de simulación en vivo paso a paso para 3 flujos:
     * Venta Mostrador en Caja.
     * Pedido Móvil & Despacho con Geocerca.
     * Operación de Patio & Radio LAN Offline.
   - Inspector lateral de Fontanería Sistémica N3 (8 compuertas por nodo).
3. **Página de Consola en Dashboard (`src/app/dashboard/esquema-poligono/page.tsx`)**:
   - Ruta lista para producción y acceso directo desde `SuperAdminBottomNav`.
4. **Test Suite Senior Vitest (`src/__tests__/esquema_poligono_3d.test.ts`)**:
   - 11 tests automatizados que validan la topología jerárquica de 5 capas, integridad de nodos y tuberías, y el algoritmo matemático de Raycasting para geocercas poligonales libres.

## 4. Estado de Validación
- `npx vitest run src/__tests__/esquema_poligono_3d.test.ts`: **11 PASSED** (100%).
- `npx tsc -p tsconfig.json --noEmit`: **0 ERRORS**.
