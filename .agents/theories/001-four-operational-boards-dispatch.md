# Hipótesis Arquitectónica 001: Despacho Causal en 4 Pizarras Operativas

## Origen
Derivado del mapa de arquitectura físico dibujado a mano por el usuario (`.agents/manifesto/system-architecture-map.md`).

## Hipótesis
El sistema operativo de BUNKKER no es un simple CRUD, sino un orquestador de acciones físicas entre 4 pizarras operativas sincronizadas en tiempo real:

```mermaid
sequenceDiagram
    autonumber
    actor Cliente as 🛒 Catálogo / Carrito
    participant Core as ⚙️ Motor Causal
    participant Almacen as 📦 Pizarra Almacenista
    participant Caja as 💰 Pizarra Caja / Cobro
    participant Repartidor as 🛵 Pizarra Repartidor
    participant Carga as 🏗️ Pizarra Carga / Descarga
    participant Venta as 🏁 VENTA (Cierre & Factura)

    Cliente->>Core: Genera Pedido (a elección del cliente)
    Core->>Almacen: Fila de pedidos / Notas dinámicas (preparar stock)
    Core->>Caja: Fila de cobro (efectivo, tarjeta, QR)
    opt Si es para envío
        Core->>Repartidor: Asignación de ruta y entrega
    end
    opt Si requiere maniobra de patio
        Core->>Carga: Encargado de piso / Bahía de carga
    end
    Almacen->>Core: Confirmación de surtido
    Caja->>Core: Cobro registrado & ticket emitido
    Repartidor->>Core: Firma / Entrega completada
    Core->>Venta: Transición a VENTA finalizada (Inmutable)
```

## Validación Requerida
Cada botón en la interfaz debe estar vinculado directamente a este flujo:
1. Ninguna acción en la pizarra de almacén debe ejecutarse sin actualizar la disponibilidad para caja.
2. Ningún cobro en caja debe finalizarse sin emitir ticket y registrar auditoría del cajero.
3. El estado de la orden debe transicionar en `OrderEvent` de manera append-only (idempotente).
