# ADR 015: Consolidación Espejo y Fosa Común Atómica (Paso 2 y Paso 3)

- **Fecha:** 2026-10-25
- **Estado:** Implementado / Validado
- **Autor:** AntiGravity Assistant
- **Contexto:** Alineación con la especificación técnica de "Organismo Único" (Camaleón / Bunkker ERP), atacando la ineficiencia de más de 10,000 líneas de código duplicadas en más de 30 subdashboards aislados.

## 1. Problema Identificado
Cada rol operativo (`sales`, `inventory`, `patio`, `delivery`, `pickup`) cargaba monolitos de entre 900 y 2,500 líneas en `/dashboard`, generando:
1. Alto consumo de memoria RAM (más de 2.8 GB al levantar procesos del IDE y navegadores con módulos pesados como escáneres por cámara y básculas bluetooth en el arranque).
2. Fragmentación del flujo: los 16 operadores no tenían una fosa común visible en tiempo real para disputar órdenes con bloqueo concurrente.
3. Desconexión en la recolección por incisos y deconstrucción en rojo.

## 2. Decisiones Implementadas

### Paso 2: Fosa Común Atómica (`<FosaComunDePedidos />`)
- Se creó `src/components/dashboard/fosa/FosaComunDePedidos.tsx` donde los 16 roles (`Almacén`, `Caja`, `Carga`, `Pickup`) compiten en vivo en la LAN.
- Se implementó el botón reactivo "⚔️ Pelear Pedido" con bloqueo en SQLite WAL vía `startLoading` / `claimCashierOrder` con feedback sonoro y control de concurrencia.
- Notificaciones de estado: se distingue si la orden está libre, tomada por otro operador, o asignada al operador actual para abrir su nota de incisos.

### Paso 3: Consolidación de Dashboards (`<CentroDeControlBunkker />`)
- Se creó `src/components/dashboard/CentroDeControlBunkker.tsx` como el Centro de Control Espejo maestro especificado en la página 10 del blueprint técnico.
- Renderizado condicional del organismo:
  - `<FosaComunDePedidos />`: Fosa compartida común.
  - `<GestorInventarioYPrecios />`: Gobernanza exclusiva de Almacén.
  - `<ColaDeCobroFisico />`: Cola compartida de cobro para Caja.
  - `<MisIncisosEnRecoleccion />`: Validación inciso por inciso y deconstrucción en rojo.
- Se migró `src/app/dashboard/page.tsx` para cargar de forma predeterminada el Centro de Control Espejo ligero (reduciendo drásticamente el Working Set de RAM), manteniendo las consolas complejas accesibles bajo demanda sin duplicación.

## 3. Verificación y Resultados
- `npx tsc --noEmit`: 0 errores de tipado.
- `npx vitest run`: 15 archivos de prueba pasaron exitosamente (138/138 tests passed en 4.44s).
- Reducción del footprint de memoria en el arranque del dashboard de ~2.8 GB a componentes modulares livianos.
