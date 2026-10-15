# Mapa de Arquitectura Operativa — BUNKKER E.C.O.S.

Basado en la arquitectura original del sistema (Open Shop Virtual & ERP Local-First).

```mermaid
graph TD
    subgraph INGRESS["1. Frontend & SPA Público (Localhost / Despliegue Online)"]
        A[Acceso por URL o QR] --> B[Catálogo Virtual]
        B --> C[Carrito de Compras]
        C --> D[Cotización & Info]
        
        A --> E[Registro de Clientes]
        E --> F[Perfil de Usuario]
        F --> G[Config Cuenta / Datos Personales]
        G --> H[Información RFC & Factura]
        H --> I[Historial de Compras, Facturas & Tickets]
    end

    subgraph OPERATIONAL_LAN["2. Pizarras Dinámicas Operativas (LAN / P2P)"]
        C -.->|"A Elección del Cliente (Pedidos)"| ROLES
        
        subgraph ROLES["Pizarras Públicas por Rol"]
            R1[Almacén: Inventario, Preparación]
            R2[Caja: Panel de Cobro]
            R3[Repartidor: Entrega & Rutas]
            R4[Carga y Descarga: Patio & Camión]
        end

        ROLES --> AUDIT_OPERACIONAL[Historial de Acciones, Firmas & Delegación de Responsabilidad]
    end

    subgraph ADMIN["3. Panel Maestro Administrativo (SuperAdmin / Dueño)"]
        ADMIN_VIEW[Vista Total de la Operación]
        ADMIN_VIEW --> METRICS[Métricas & Auditoría de Flujo]
        ADMIN_VIEW --> ROLES_USERS[Gestión de Roles & Usuarios]
        ADMIN_VIEW --> STOCK[Stock / Ventas / Resurtido]
        ADMIN_VIEW --> BACKUP[Backup Global & SQLite WAL]
    end

    subgraph MARKETING["4. Personalización Frontend & Marketing"]
        CANVAS[Canvas Visual de Sucursal]
        CANVAS --> BANNERS[Banners & Medios]
        CANVAS --> STORE_INFO[Datos de Sucursal & Ubicación]
    end

    AUDIT_OPERACIONAL ==> VENTA[🏁 VENTA CONSOLIDADA]
    R2 ==> VENTA
```

### Invariantes Clave del Diagrama:
1. **Convergencia en la VENTA:** Todo el flujo del cliente, carrito, preparación de almacén, cobro de caja y entrega converge en la **VENTA**.
2. **Cero Módulos Dev en Producción:** Las herramientas de ingeniería o testing (`/dashboard/tests`) no forman parte de este flujo operativo y viven exclusivamente en la suite CLI/CI.
