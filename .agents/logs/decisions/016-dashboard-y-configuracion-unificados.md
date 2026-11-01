# ADR 016: Dashboard y configuración unificados

- **Fecha:** 2026-10-31
- **Estado:** Implementado y validado
- **Alcance:** navegación por rol, dashboard ejecutivo, Setup y persistencia de ajustes.

## A15.1 — Objetivo

1. Mapear cada rol a su vista inicial y conservar destinos internos autorizados → eliminar redirecciones genéricas o externas → cada usuario aterriza en su módulo permitido.
2. Reducir carga y duplicación visual del dashboard → cargar módulos secundarios bajo demanda → mostrar primero un resumen ejecutivo legible.
3. Unificar la configuración pública → usar el endpoint local-first existente para leer y guardar → evitar consulta y escritura pública duplicadas.
4. Corregir el reset CSS que anulaba el espaciado de Tailwind → conservar el reset base y permitir utilities responsive → restablecer padding y legibilidad.

## A13 / A03 — Flujo y evidencia

- Login → destino por rol: `src/lib/dashboardRouting.ts:113`, `src/app/login/page.tsx:94,127`, `src/middleware.ts:107`.
- Resumen, métricas y paneles diferidos: `src/components/dashboard/SuperAdminDashboard.tsx:217,279,606`, `src/lib/dashboardMetrics.ts:161`.
- Setup público → API → persistencia local y espejo cloud; secretos separados: `src/app/dashboard/setup/page.tsx:71,84,119`, `src/app/api/settings/route.ts:47-75`, `src/context/CartContext.tsx:890-910`.
- Espaciado responsive de Tailwind: `src/app/globals.css:55`.

## A08 — Autopsia

- **Síntoma:** destinos de dashboard inconsistentes, panel principal denso, Setup con lectura pública duplicada y aviso visible de Firebase, controles apretados en móvil.
- **Causa inmediata:** navegación repetida por rol; carga estática de widgets; `getDoc(settings/site_config)` desde el cliente seguido de `setDoc` público y `updateSiteConfig`; reset global no encapsulado que anulaba `padding` y `margin` de Tailwind.
- **Causa raíz:** varias rutas competían por ser autoridad de navegación/configuración y CSS global fuera de las capas de Tailwind.
- **Por qué no lo detectaban las pruebas:** se cubrían helpers y lógica de métricas, no el render responsive, la ruta interactiva de Setup ni el cascade CSS del navegador.

## A02 — Flujo anterior vs. implementado

```mermaid
sequenceDiagram
    actor Staff as Usuario
    participant Login as Login y middleware
    participant Dash as Dashboard
    participant Setup as Setup
    participant Ctx as CartContext
    participant API as /api/settings
    participant Cloud as Firestore

    alt Flujo anterior
        Staff->>Login: iniciar sesión o pedir configuración
        Login->>Dash: destino genérico o repetido por rol
        Dash->>Dash: cargar controles y widgets juntos
        Setup->>Cloud: getDoc(settings/site_config)
        Setup->>Cloud: setDoc(settings/site_config)
        Setup->>Ctx: updateSiteConfig(mismos ajustes)
        Ctx->>API: POST /api/settings
    else Flujo implementado
        Staff->>Login: iniciar sesión con redirect opcional
        Login->>Dash: getRoleLandingPath valida rol y ruta
        Dash->>Dash: resumen primero; análisis y widgets bajo demanda
        Setup->>API: GET /api/settings (local-first)
        API-->>Setup: configuración pública por tenant
        Setup->>Cloud: leer/escribir solo secrets/billing
        Setup->>Ctx: updateSiteConfig(publicConfig)
        Ctx->>API: un POST; API valida admin y persiste local + espejo async
    end
```

## A10 / A06 — Seguridad y reutilización

- Se reutilizaron `getRoleLandingPath`, `CartContext.updateSiteConfig` y la API local-first existente; no se agregó dependencia ni nueva ruta.
- `getRoleLandingPath` limita redirects a rutas internas permitidas; el POST de ajustes conserva `requireActiveRole(['superadmin', 'admin'])` y `getTenantId`.
- La lectura/escritura de `secrets/billing` permanece separada de la configuración pública. No se cambió el esquema de datos.

## A05 — Métricas

El resumen agrega órdenes/productos una vez y proyecta siete días, con costo lineal en registros procesados y un agregado fijo de siete días. Se conservan valores seguros para fechas/valores inválidos y división por cero.

## Validación

- TypeScript: `npx tsc --noEmit --pretty false` — correcto.
- Pruebas dirigidas: routing, métricas, RBAC/login redirect y organismo único — correctas.
- ESLint dirigido: 0 errores; permanecen advertencias existentes de `any`, un efecto de estado del login y archivos de tests ignorados por configuración.
- Navegador: dashboard a 980×1440 y 390×844, Setup móvil, navegación de secciones y apertura del análisis avanzado/lazy widgets.
