# Transcripción Completa y Especificación Técnica: Camaleón / Bunkker ERP (Arquitectura Organismo Único)

> **Propósito:** Contexto integral, reglas de negocio, máquina de estados físicos, seguridad SHA-256, diseño de base de datos SQLite WAL y código base (Next.js / Electron / PWA / Service Workers) inyectado en el núcleo de memoria de AntiGravity.

---

## 1. Filosofía Central: El ERP como Organismo Único

Un ERP que opera como un "solo organismo" se basa en la **interconectividad absoluta** y **centralización de datos en tiempo real**. No son módulos aislados; es un sistema nervioso central:

1. **La Base de Datos Única (El ADN):**
   - **Verdad única:** Si ventas cambia la dirección de un cliente, impacta de inmediato a logística, facturación y soporte.
   - **Consistencia:** Elimina silos y asincronías; todos los departamentos leen el mismo "código genético".
2. **Automatización Transversal (Los Reflejos):**
   - **Estímulo:** Compra en mostrador o catálogo.
   - **Reacción en cadena:** Descuento atómico de stock, notificación a pizarras operativas, registro contable y cola de empaque/carga.
3. **Trazabilidad de Extremo a Extremo (El Sistema Circulatorio):**
   - Flujo continuo rastreable desde proveedor/lote/operario hasta cliente y vendedor.
4. **Visión Global en Tiempo Real (El Cerebro):**
   - KPIs vivos al milisegundo (rotación vs. margen puro, cuellos de botella).

---

## 2. Framework de IA: "Estímulo — Órgano — Reacción"

| Componente | Definición |
| :--- | :--- |
| **El Disparador (Estímulo)** | Qué evento físico/digital inicia la acción. |
| **El Impacto Inmediato (Órganos)** | Qué tablas, pizarras o módulos deben actualizarse en el mismo milisegundo. |
| **La Restricción (Homeostasis)** | Qué regla biológica/criptográfica detiene el proceso si algo se desvía. |

### Matriz de Contraste: Bunkker Organismo vs. Software Tradicional

| Principio Orgánico | El Ideal (Bunkker Organismo) | Software Tradicional | Brecha Resuelta (Zero-Gap) |
| :--- | :--- | :--- | :--- |
| **ADN Único** | SQLite WAL local en servidor PC/NUC maestro. Cero silos. | Sistemas separados sincronizados por lotes nocturnos. | Cero fantasmas: almacén y caja leen las mismas existencias al milisegundo. |
| **Reflejo Inmediato** | Pedidos por Wi-Fi LAN; pizarras de caja y patio actualizadas al segundo. | Avisos manuales por WhatsApp o papel. | Flujo orgánico nativo: la orden digital y el producto físico viajan paralelos. |
| **Sistema Inmune** | Bitácora inmutable SHA-256, anti-inyección de precios y anti-skip de estados. | Permite ventas en negativo o brincar validaciones. | Seguridad robusta y fail-closed sin internet. |

---

## 3. Canales de Entrega y Máquina de Estados Físicos (Anti-Skip)

### Canales Identificados:
1. **Mostrador Pickup:** Escaneo de QR de salida.
2. **Patio Carga:** Escaneo QR de Carga + Foto comprimida de batea a código puro.
3. **Chofer Repartidor:** GPS + Firma comprimida a código puro.

### Máquina de Estados Físicos Indexada:
```
[Cliente / Caja] ──► Crea Orden (Estado: PENDIENTE)
       │
       ▼
[Bodeguero] ────────► Asigna Estiba/Fila (Estado: EN_ALMACEN)
       │
       ├─► [Mostrador Pickup] ──► Escaneo QR ───────────┐
       ├─► [Patio Carga] ───────► Escaneo QR + Foto ────┼─► [Superadmin]
       │                          (Batea Comprimida)    │   Auditoría SHA-256
       └─► [Chofer] ────────────► GPS + Firma ──────────┘   (Compra Cerrada)
                                  (Firma Comprimida)
```

---

## 4. El Sistema Inmune: Detección de Anomalías en Tiempo Real

1. **Ruptura de Cadena Criptográfica:** Si un registro en la bitácora es alterado manualmente en la base de datos, el hash SHA-256 encadenado se rompe y bloquea la terminal.
2. **Anomalías de Tiempo/Espacio (Velocidad de Flujo):** El Service Worker registra marcas de tiempo. Si un producto pasa de "En Almacén" a "Entregado" en menos de 2 segundos, se levanta alerta por **Proceso Fantasma** (salto de validación física).
3. **Anomalía Multimedia:** Se supervisa la entropía y longitud del string comprimido de fotos y firmas vectorizadas para no saturar SQLite.
4. **Control de Roles Fantasma:**
   - Un cliente se registra libremente desde la PWA.
   - Un rol operativo (Cajero, Bodeguero, Chofer, Carga, Pickup) **solo puede nacer en el Dashboard Central de la NUC física**.
   - Cada rol operativo genera un hash SHA-256 cruzado: `ID_Usuario + Rol + Timestamp + ID_Hardware_NUC`.
   - Petición de un rol sin hash válido = `ABORT_AND_LOCK_NODE`.
5. **Inmunidad a la Inyección de Precios:**
   - El cliente/PWA envía únicamente `ID_Producto` y `Cantidad`.
   - La NUC calcula el total multiplicando por el precio fijo en SQLite local (**Server-Side Only**).
6. **Cobro Exclusivo en Caja Física:**
   - Ninguna PWA de cliente ni tablet de patio puede cambiar el estado a `PAGADO`.
   - Privilegio exclusivo de la Caja Física. Prohibido saltar recolección y cobro.

---

## 5. La Mente del Organismo: 4 Personalidades por Rol

1. **Superadmin / Dueño ("El Asesor Estratégico / Analista Inmune"):** Tono serio, predictivo, reporta desviaciones de tiempos de carga, cuellos de botella e integridad SHA-256.
2. **Bodeguero / Almacenista ("El Capataz Cuadrado / Guardián del Stock"):** Tono directo, imperativo, enfocado en orden espacial y validación de estibas.
3. **Cajero / Terminal Counter ("El Auditor Veloz / Centinela de Caja"):** Tono ágil, numérico, alerta sobre historial de pagos de clientes antes de emitir tickets.
4. **Chofer / Repartidor ("El Copiloto Pragmático"):** Tono conciso, opera en offline vía Service Worker guardando firmas en código puro y sincronizando (Background Sync) al reconectar con el Wi-Fi del negocio.

---

## 6. Flujo de Pedidos en Tienda y Deconstrucción en Espejo Rojo

### Flujo Positivo en Tienda:
```
[Navegación / Carrito] ──► [Levantar Pedido / Login] ──► [Destino: Domicilio / Caja / Patio]
       │
       ▼
[Estado: PENDIENTE] ────► Roles pelean pedido en la LAN (Bloqueo atómico SQLite WAL)
       │
       ▼
[Proceso: RECOLECCIÓN] ─► Operador ganador valida inciso por inciso en nota de preparado
       │
       ▼
[LISTO PARA ENTREGA] ───► Notificación local al cliente y traslado a punto de encuentro
       │
       ▼
[COBRO EN CAJA FÍSICA] ─► Único punto de cobro autorizado ──► Genera Ticket Físico Impreso
       │
       ▼
[VALIDACIÓN DE SALIDA] ─► Escaneo QR + Firma o Foto Comprimida
       │
       ▼
[VENTA OK] ─────────────► Ticket digital al cliente + Cierre de bitácora en texto plano
```

### Reglas de Chofer / Reparto:
- **Regla de Oro:** El chofer solo transporta pedidos **ya cobrados previamente en Caja Física**. Cero cobros en la calle.
- **Desenlace A (Entregado):** Captura firma/foto comprimida. Sincroniza en Wi-Fi -> `VENTA_OK`.
- **Desenlace B (No hubo quien reciba / Cancelado):**
  - Retorno obligatorio a la tienda.
  - **Deconstrucción por Incisos:** El operador debe devolver físicamente cada producto a su lugar en almacén y marcar inciso por inciso como devuelto.
  - El stock se reintegra automáticamente como **stock nuevo disponible** (sin devoluciones post-venta viciadas).
  - El registro se archiva en el **Historial en Rojo** (visible para Superadmin y perfil del cliente).

### Estructura Estricta de Bitácora de Auditoría en Texto Puro:
```text
-- Ejemplo Venta Exitosa:
PEDIDO=00415 | CLIENTE=CLI-8932 | H_RESERVA=2026-10-25 09:15:00 | TOMADO_POR=CHOFER_04 | ENTREGADO_EN=DOMICILIO | COBRADO_POR=CAJA_FISICA_01 | RECIBIDO_CLIENTE=SI | TICKET=TK-99215 | H_ENTREGA=2026-10-25 10:45:22 | ESTADO=VENTA_OK

-- Ejemplo Deconstrucción (Historial en Rojo):
PEDIDO=00416 | CLIENTE=CLI-1142 | H_RESERVA=2026-10-25 09:20:00 | TOMADO_POR=CHOFER_02 | ENTREGADO_EN=DOMICILIO_FALLIDO | COBRADO_POR=CAJA_FISICA_01 | RECIBIDO_CLIENTE=NO_HUBO_QUIEN_RECIBA | TICKET=TK-99216 | H_RETORNO=2026-10-25 11:10:00 | ESTADO=DECONSTRUIDO_ROJO | INCISOS_DEVUELTOS=[INC_01:OK, INC_02:OK]
```

---

## 7. Catálogo Público vs. Reserva VIP (Gobernanza)

- **Cliente Regular (`es_vip = 0`):** Service Worker oculta botones de pedido web. Solo lectura de catálogo (obliga a comprar en tienda física).
- **Cliente VIP (`es_vip = 1`):** Habilitado manualmente por el Superadmin. Puede reservar desde la web quedando en estado `RESERVA_VIP_PENDIENTE` para liquidar en fin de semana en Caja Física.
- **Trigger SQL Inmune en SQLite WAL:**
```sql
CREATE TRIGGER IF NOT EXISTS validar_pedido_vip
BEFORE INSERT ON pedidos
WHEN NEW.origen = 'WEB'
BEGIN
  SELECT CASE 
    WHEN (SELECT es_vip FROM clientes WHERE id_cliente = NEW.id_cliente) = 0
    THEN RAISE(ABORT, 'ANOMALÍA: Intento de inyección web. Cliente no autorizado fuera de tienda física.')
  END;
END;
```

---

## 8. Arquitectura de Dashboards: El Espejo Independiente (16+ Operadores)

El Dashboard maestro (`/dashboard`) filtra vistas y colas de trabajo dinámicamente según la sesión del operador:

- **Superadmin:** Vista maestra global, Efecto Balanza (Rotación vs. Margen Puro), alertas de reabastecimiento, respaldos, creación de usuarios operativos con código de seguridad.
- **16+ Operadores en Batalla (4 Almacén, 4 Caja, 4 Carga, 4 Pickup):**
  - **Fosa Común:** Todos ven los pedidos entrantes en estado `PENDIENTE` y compiten por tomarlos.
  - **Motor Atómico de Competencia:** Transacción `BEGIN IMMEDIATE;` en SQLite WAL para asegurar que solo uno gana el pedido y evitar condiciones de carrera.
  - **Gobernanza de ALMACÉN:** Único rol con permisos de escritura para dar de alta inventario y precios base.
  - **Gobernanza de CAJA:** Cola colaborativa compartida de cobro físico (`LISTO_PARA_COBRAR`). Si el cajero recolecta un pedido para Carga, cualquier otro cajero libre puede cobrarlo en su terminal.
  - **Gobernanza de CARGA / PICKUP:** NUNCA cobran. Solo recolectan mercancía y validan la entrega escaneando el ticket físico emitido por caja y capturando foto/firma.
