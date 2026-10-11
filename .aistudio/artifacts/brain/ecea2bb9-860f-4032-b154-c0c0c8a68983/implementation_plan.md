# Arquitectura de Chunks Espaciales 3D (X, Y, Z), Mocks en Memoria y Render Distance para Fluidez de Inventario

Este plan revisado reemplaza el enfoque de "cubos individuales" por lo que realmente hace que **Minecraft cargue mundos gigantescos y fluya a 60 FPS sin trabarse**: **Particionamiento Espacial por Chunks 3D (Estante `X`, Fila `Y`, Posición `Z`)**, **Carga Perezosa por Distancia de Visión (*Render Distance / Frustum Culling*)**, **Mocks / Snapshots Ligeros en RAM** para navegación instantánea y **Tick Loop con Dirty Chunks** para que la base de datos nunca frene la interfaz.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> **Cambio de Enfoque Confirmado — Arquitectura de Fluidez y Chunks (No Cubos Visuales)**:
> 1. **Coordenadas Espaciales 3D (`Chunk X`, `Nivel Y`, `Slot Z`)**: La bodega física se divide lógicamente como el motor de un juego: cada **Estante** es un `Chunk` independiente, cada **Fila/Nivel** es una capa vertical (`Y`), y cada **Posición** es un slot (`Z`).
> 2. **Render Distance (Virtualización de Estantes Activos)**: En lugar de montar en el DOM cientos de tarjetas, imágenes y sensores Drag & Drop de todos los estantes al mismo tiempo (lo que alenta el navegador), el cliente solo hidrata los **Chunks dentro del campo de visión (Viewport)** o el Chunk enfocado en el buscador. Los estantes lejanos se mantienen como **Mocks ligeros (Skeletons de bajo costo)** hasta que el usuario se acerca haciendo scroll o los filtra.
> 3. **Mocks en Memoria (Zero-Wait State & Optimistic Tick)**: El usuario opera siempre contra un **Mock / Snapshot en RAM** ultra-rápido (hidratado desde IndexedDB / Memoria del Servidor). Los movimientos, reservas con expiración automática (TTL) y cambios de stock ocurren en `0ms` en memoria y se vuelcan por lote (*Chunk Flush*) en segundo plano.

- **Decisión Confirmada 1 (Arquitectura de Chunks para Fluidez de Carga)**: Cargar y renderizar únicamente los Chunks (Estantes) visibles o enfocados, manteniendo el resto descargado del DOM pesado (*Unloaded Chunks*) con su resumen ligero en memoria.
- **Decisión Confirmada 2 (Concurrencia y Bloqueos con Expiración en el Chunk Mock)**: Las reservas de vendedores operan sobre el Mock en memoria del Chunk activo con expiración automática (TTL), evitando lecturas/escrituras repetitivas a SQLite mientras se arma el pedido.
- **Decisión Confirmada 3 (Reutilización del Sistema Actual)**: Se construye directamente sobre tu estructura actual (`ShelfColumn`, `dirtyChunksMap` en Inventario, `memoryOptimizer.ts`, `indexedDBCart.ts` y `radio-server.js`), sin duplicar pantallas ni rehacer lo que ya funciona.

---

## 1. ¿Cómo funciona la Arquitectura de Chunks & Mocks estilo Minecraft en tu ERP?

En Minecraft, el mundo tiene millones de bloques, pero el juego no carga todo el planeta en la tarjeta gráfica ni guarda cada bloque en disco uno por uno:
1. **Divide el mundo en Chunks de 16×16**: En **BUNKKER**, cada **Estante (`A1`, `A2`, `B1`, `GENERAL`)** es un **Chunk**.
2. **Render Distance (Distancia de Renderizado)**: Si estás parado frente al Estante `A1`, el motor carga en alta fidelidad (3D/DOM interactivo, fotos, Drag & Drop) el Chunk `A1` y sus vecinos inmediatos (`A2`, `A3`). El Estante `Z9` está fuera de tu vista: existe en el **Mock de Memoria** para búsquedas instantáneas (`0ms`), pero **no consume nodos del DOM ni memoria gráfica** hasta que te desplazas hacia él.
3. **Chunk Caching & Mocks**: Cuando cambias de pestaña o abres el inventario con conexión inestable, el sistema muestra instantáneamente el **Mock en caché de los Chunks** y sólo sincroniza los deltas (*chunks que cambiaron*), logrando que la app se sienta instantánea como un motor nativo.
4. **Server Tick & Dirty Chunks**: Todas las modificaciones dentro de un estante (mover productos, apartar stock con TTL, ajustar cantidades) marcan el Chunk como `Dirty` en RAM y se escriben en SQLite en un solo paquete comprimido cada cierto *Tick* (o al salir).

---

## 2. Mapa Visual de Arquitectura: El Camino del Producto a través de los Chunks

```
╔══════════════════════════════════════════════════════════════════════════════════════════════╗
║        ARQUITECTURA DE CHUNKS ESPACIALES (X, Y, Z), MOCKS EN RAM Y RENDER DISTANCE           ║
╚══════════════════════════════════════════════════════════════════════════════════════════════╝

  [ CAPA 1: COORDENADAS ESPACIALES 3D EN MEMORIA (WORLD CHUNK INDEX) ]
  ┌──────────────────────────────────────────────────────────────────────────────────────────┐
  │ 🗺️ Mapa Espacial en RAM (Índice O(1) por Coordenada: Chunk[Estante] -> Layer[Fila] -> Z) │
  │                                                                                          │
  │   CHUNK [X: ESTANTE A1]        CHUNK [X: ESTANTE A2]        CHUNK [X: ESTANTE B1..N]     │
  │   ├─ Layer Y1 (Fila 1)         ├─ Layer Y1 (Fila 1)         ├─ [ESTADO: DORMIDO / MOCK]  │
  │   │  ├─ Slot Z0: Prod #101     │  ├─ Slot Z0: Prod #204     │  • 0 Nodos pesados en DOM  │
  │   │  └─ Slot Z1: Prod #102     │  └─ Slot Z1: Prod #205     │  • Metadata lista en RAM   │
  │   └─ Layer Y2 (Fila 2)         └─ Layer Y2 (Fila 2)         └─ Se hidrata en <16ms       │
  │      └─ [ACTIVO EN VIEWPORT]      └─ [VECINO PRE-CARGADO]      al entrar al Viewport     │
  └──────────────────────┬───────────────────────────────────────────────────┬───────────────┘
                         │                                                   │
     1. Usuario busca o  │ Render Distance (IntersectionObserver)            │ Fuera de vista
        enfoca "A1"      ▼ Hidrata solo los Chunks en pantalla (60 FPS)      ▼ (Ahorra 80% RAM)
  [ CAPA 2: MOTOR DE FLUIDEZ VISUAL (VIEWPORT FRUSTUM & MOCK PLACEHOLDERS) ]
  ┌──────────────────────────────────────────────────────────────────────────────────────────┐
  │ 🖥️ Vista de Estantes / Mapa Espacial 3D-Grid (`ShelfColumn` + Filtro por Estante)        │
  │                                                                                          │
  │  🟢 CHUNK CARGADO (En Foco: A1)         ⚪ CHUNKS LEJANOS (Atenuados / Mock Ligero)      │
  │  • Sensores Drag & Drop activos         • Sin sensores pesados ni imágenes decodificadas │
  │  • Imágenes WebP y acciones listas      • Si se filtra "A1", el resto pasa a modo        │
  │  • Transición suave sin tirones (Jank)    Low-Power Dimmed e ilumina la coordenada (X,Y) │
  └──────────────────────┬───────────────────────────────────────────────────────────────────┘
                         │
     2. Vendedor toma    │ Operación sobre el Chunk Mock en RAM (0ms)
        stock o mueve    ▼ Con bloqueo temporal (TTL Lease) y exclusión mutua
  [ CAPA 3: CHUNK STATE MOCK & CONCURRENCIA EN SERVIDOR (SERVER TICK) ]
  ┌──────────────────────────────────────────────────────────────────────────────────────────┐
  │ ⚡ Estado en Vivo del Chunk en RAM (`ChunkStateMock`)                                    │
  │                                                                                          │
  │  • Stock Físico en Chunk (A1/Y1/Z0) : 20 pzas                                            │
  │  • Lease Temporal en Carrito (TTL)  : -10 pzas (Caja 1 posee 10 pzas por X seg/min)      │
  │  • Disponible Real para Caja 2      : = 10 pzas (Imposible tomar 11; validación en 0ms)  │
  │                                                                                          │
  │  🔄 Si vence el TTL -> El Mock libera las 10 pzas en RAM sin haber tocado SQLite.        │
  │  📦 Si se mueve de estante -> Marca `DirtyChunk[A1]` y `DirtyChunk[A2]` en memoria.      │
  └──────────────────────┬───────────────────────────────────────────────────────────────────┘
                         │
     3. Tick de Volcado  │ Batch Flush asíncrono (1 sola transacción SQLite)
        o Venta Firme    ▼ Cero bloqueos `SQLITE_BUSY` durante la operación
  [ CAPA 4: PERSISTENCIA POR LOTES (SQLITE + INDEXEDDB + PATIO/PICKUP) ]
  ┌──────────────────────────────────────────────────────────────────────────────────────────┐
  │ 💾 Almacenamiento Persistente (Sólo escribe Chunks modificados o Ventas confirmadas)     │
  │                                                                                          │
  │  • Movimiento en Almacén : `PATCH /api/products` vuelca todos los Slots sucios de golpe  │
  │  • Preventa / Caja       : Pasa a `reservedStock` indicando al Almacenista el Chunk (X,Y)│
  │  • Entrega en Patio / QR : Descuenta el `stock` definitivo del Chunk físico              │
  └──────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Experiencia de Usuario y Mejoras de Fluidez Visual

1. **Carga por Chunks (*Render Distance*) en `ShelfColumn`**:
   - Cuando tienes decenas de estantes y cientos de productos, el navegador ya no renderizará todos los componentes pesados de `dnd-kit` e imágenes al mismo tiempo.
   - Cada columna de estante (`ShelfColumn`) detecta si está dentro del **rango de visión del usuario (Render Distance)** o si es el estante buscado:
     - **Chunk Activo (Loaded Chunk)**: Muestra todos sus niveles (`Y`) y tarjetas interactivas (`Z`) a 60 FPS.
     - **Chunk en Distancia Media / Atenuado**: Cuando usas el buscador de estante físico (`Search/Filter by Shelf`), el estante elegido se ilumina en primer plano y los demás estantes bajan su carga visual (modo *Dimmed / Low-LOD*), guiando la vista del almacenista directo a la coordenada física.
     - **Chunk Fuera de Rango (Mocked Chunk)**: Si hay muchos pasillos hacia la derecha, los que están fuera de pantalla mantienen su estructura espacial exacta con un *Mock ligero* en memoria y se hidratan instantáneamente al hacer scroll.

2. **Mapa Visual 3D-Isométrico / Espacial de la Arquitectura de Chunks**:
   - Dentro del módulo de Inventario (sin duplicar páginas, integrado con tu vista de Estantes y `node-view`), podrás alternar una **Vista de Mapa de Chunks (Arquitectura en Vivo)** que muestra:
     - Qué **Chunks (Estantes X, Niveles Y)** están cargados en RAM, cuáles tienen cambios pendientes (*Dirty Chunks*) y cuántos bloques de memoria están ahorrando.
     - El **recorrido en tiempo real de los productos** a través de las 4 capas de la arquitectura: `Chunk de Estante (X,Y,Z)` $\rightarrow$ `Mock de Reserva en Carrito (TTL)` $\rightarrow$ `Apartado en Patio/Pickup` $\rightarrow$ `Salida Final`.

3. **Mocks Instantáneos para Cero Latencia (Offline & Red Local)**:
   - Si el servidor tarda o la conexión parpadea, el inventario y el POS leen directamente del **Chunk Mock en memoria / IndexedDB**, evitando pantallas en blanco, recargas bruscas o parpadeos de la barra lateral.

---

## 4. Plan Técnico de Implementación (Sobre tu Código Existente)

### Fase 1: Motor de Chunks Espaciales (X, Y, Z) y Render Distance en `ShelfColumn`
- **Indexación Espacial O(1)**: Estructurar el mapa de estantes en memoria por coordenadas `(Chunk X = Estante, Layer Y = Fila, Slot Z = orderIndex)` para que filtrar, localizar un estante o mover un producto no requiera recorrer arreglos completos en cada render.
- **Frustum Culling / Lazy Chunk Hydration**: Incorporar detección de viewport (`IntersectionObserver` con margen de pre-carga de 1 chunk vecino) en `ShelfColumn.tsx` para que los estantes fuera de pantalla usen un **Mock Ligero (Low-LOD)** y solo monten los sensores pesados de Drag & Drop e imágenes cuando entran al rango de visión.

### Fase 2: Estado Mock en Memoria y Concurrencia con TTL por Chunk
- **Sincronización Atómica en el Servidor/Cliente**: Consolidar en el almacén en memoria (`memoryOptimizer.ts` / `redis.ts` + `radio-server.js`) el estado vivo de cada Chunk (`stock físico`, `reservas activas en carritos con TTL` y `apartados en Patio`), garantizando que dos vendedores nunca puedan tomar más existencias de las que quedan libres en ese Chunk.
- **Persistencia por Tick (Dirty Chunk Flush)**: Mantener y optimizar el volcado diferido por lotes (`dirtyChunksMap` $\rightarrow$ `batchUpdates`) para que cualquier ajuste de ubicación o reacomodo físico se procese en memoria y haga una sola escritura consolidada a la base de datos.

### Fase 3: Visualizador de Arquitectura de Chunks y Recorrido de Stock
- **Panel de Mapa de Chunks en `/dashboard/inventory`**: Añadir un conmutador visual en la vista de Estantes que permita ver el **Mapa Arquitectónico de Chunks (Vista 3D/Espacial de Pasillos + Pipeline de Estado)** mostrando en vivo el flujo `Chunk Físico (X,Y,Z)` $\rightarrow$ `Posesión en RAM (TTL)` $\rightarrow$ `Patio (Reserved)` $\rightarrow$ `Entregado`, junto con las métricas de rendimiento (Chunks activos vs. dormidos en Mock y escrituras ahorradas en BD).
