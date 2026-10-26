# Módulo Legacy 001: Bancos de Prueba en la Interfaz del Cliente

## Qué era
- Páginas y componentes de desarrollo expuestos en la interfaz de usuario:
  - `/dashboard/tests` ("Pruebas de Lógica")
  - Tarjeta "Laboratorio de Estrés" en el dashboard de superadmin
  - Botón de pruebas en los carruseles de navegación (`AdminLayout.tsx` y `IconCarouselNav.tsx`)

## Por qué se archivó / eliminó
El cliente final y los operadores del negocio no deben ver módulos internos de pruebas de código. La exposición de herramientas de test ensucia la experiencia del usuario, agrega módulos innecesarios de mantener y puede provocar ejecuciones accidentales que alteren datos de venta reales.

## Estado Actual
- Eliminados de la navegación visual.
- Ruta `/dashboard/tests` interceptada en `middleware.ts` para redirigir a `/dashboard`.
- Pruebas automatizadas reservadas para la terminal y suites CI (Vitest).
