# 📚 Manual de Usuario & Operación — BUNKKER E.C.O.S. ERP / BaaS

Bienvenido al manual oficial de operación del ecosistema **BUNKKER E.C.O.S. ERP / BaaS**. Este documento proporciona las instrucciones completas para el uso de la plataforma, operación del Punto de Venta (POS), control de inventario, diseñador canvas y solución de problemas técnicos.

---

## 📑 Tabla de Contenidos
1. [Inicio Rápido & Arquitectura](#1-inicio-rápido--arquitectura)
2. [Punto de Venta (POS) & Cobros](#2-punto-de-venta-pos--cobros)
3. [Inventario, Patio & Almacén](#3-inventario-patio--almacén)
4. [Diseñador Canvas Magnético](#4-diseñador-canvas-magnético)
5. [Clasificador de Productos por IA](#5-clasificador-de-productos-por-ia)
6. [Control de Roles & Seguridad (RBAC)](#6-control-de-roles--seguridad-rbac)
7. [Solución de Problemas (Troubleshooting)](#7-solución-de-problemas-troubleshooting)

---

## 1. Inicio Rápido & Arquitectura

BUNKKER E.C.O.S. es un ERP diseñado bajo la arquitectura **Local-First**, lo que significa que el sistema puede operar al 100% sin conexión a internet y sincronizar automáticamente con la nube cuando el enlace se restablece.

### Arranque del Servidor Local
Para iniciar el servidor en tu equipo local:

```bash
# Iniciar servidor de desarrollo en el puerto 3005
npm run dev
```

Accede desde tu navegador en:
`http://localhost:3005`

### Proteccion Hardware Lock
La licencia del nodo maestro está vinculada a la huella digital del hardware (MAC / UUID). Esta firma garantiza la seguridad del sistema y permite conectar sucursales y dispositivos de cobro móvil autenticados.

---

## 2. Punto de Venta (POS) & Cobros

El módulo POS permite realizar cobros a alta velocidad (respuesta < 70ms) y cuenta con soporte para lectores de código de barras.

### Funcionalidades Clave:
- **Lectura Automática:** Escanea cualquier código de barras sin necesidad de hacer clic en la pantalla.
- **Cobro Multicanal:** Acepta efectivo, tarjetas bancarias (Stripe/MercadoPago) y transferencias.
- **Impresión de Tickets:** Generación de comprobante digital y ticket térmico.
- **Sincronización Offline (`SalesQueue`):** Si internet falla, las ventas se almacenan localmente y se transmiten a la nube automáticamente al reconectarse.
- **Corte de Caja Ciego:** Permite al cajero ingresar el efectivo contado sin ver el total esperado, garantizando auditorías transparentes.

---

## 3. Inventario, Patio & Almacén

Gestión física y digital de existencias por pasillos, estanterías y niveles.

- **Reubicación Drag & Drop:** Mueve artículos entre niveles y estantes. Cada movimiento queda registrado en el historial de auditoría (`REUBICACION`).
- **Alertas de Reabastecimiento (`RestockAlert`):** Notificaciones automáticas cuando el stock llega al límite mínimo.

---

## 4. Diseñador Canvas Magnético

Accede desde la sección **Diseñador** en el Dashboard para modificar la presentación visual de la tienda web y catálogo público.

- Personaliza colores corporativos y tipografía.
- Organiza bloques de productos, banners publicitarios y carruseles mediante arrastrar y soltar.
- Revisa la vista previa móvil y de escritorio en tiempo real.

---

## 5. Clasificador de Productos por IA

Integración con modelos de Inteligencia Artificial para la catalogación rápida de productos.

- Sube la fotografía o escribe el nombre del producto.
- La IA clasifica automáticamente la categoría, sugiere tags de búsqueda y redacta la descripción comercial.

---

## 6. Control de Roles & Seguridad (RBAC)

Matriz de acceso basada en roles:

| Rol | Punto de Venta | Inventario | Arqueos de Caja | Configuración |
| :--- | :---: | :---: | :---: | :---: |
| **SuperAdmin** | Total | Total | Total | Total |
| **Admin** | Total | Total | Total | Restringido |
| **Cajero** | Vender / Cobrar | Lectura | Realizar Corte | Sin Acceso |
| **Repartidor** | Sin Acceso | Sin Acceso | Sin Acceso | Ver Rutas |

---

## 7. Solución de Problemas (Troubleshooting)

### Error `listen EADDRINUSE: address already in use :::3005`

Este error indica que el puerto 3005 está siendo utilizado por un proceso anterior.

#### Solución 1 (Usando `npx kill-port`):
```bash
npx kill-port 3005
```

#### Solución 2 (PowerShell en Windows):
```powershell
Get-NetTCPConnection -LocalPort 3005 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

Una vez liberado el puerto, ejecuta nuevamente `npm run dev`.
