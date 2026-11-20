# Contribuir a BUNKKER E.C.O.S.

¡Gracias por tu interés! Queremos que sea fácil participar aunque sea tu primera contribución. La conversación y la documentación pueden hacerse en español; los nombres de código pueden seguir las convenciones del proyecto.

## Antes de empezar

1. Lee el [README](./README.md), el [manual](./MANUAL_DE_USUARIO.md) y la [licencia](./LICENSE).
2. Revisa Issues y Discussions para comprobar si la idea ya está en conversación.
3. Para cambios grandes, de producto, arquitectura, base de datos, permisos o sincronización, abre primero una Discussion o Issue y espera confirmación del mantenedor.
4. No publiques secretos, credenciales, PIN, datos personales ni información real de clientes.

## Flujo recomendado

1. Haz fork del repositorio y crea una rama descriptiva desde `main`.
2. Instala dependencias con `npm install --legacy-peer-deps` y configura tu entorno local a partir de `.env.example`.
3. Mantén el cambio pequeño y enfocado. Evita mezclar refactors no relacionados.
4. Ejecuta las verificaciones relevantes antes de enviar el PR:

   ```bash
   npm run lint
   npm test
   ```

   Si tu cambio afecta la compilación, ejecuta también `npm run build` cuando tu entorno esté configurado.
5. Abre un Pull Request con el problema que resuelve, resumen del cambio, pruebas realizadas y capturas si modifica la interfaz. Vincula el Issue relacionado.

## Criterios importantes del proyecto

- En cambios multiempresa, conserva el aislamiento por `tenantId` en las consultas y operaciones correspondientes.
- No registres ni expongas credenciales, PIN o información sensible en logs, pruebas, documentación o capturas.
- Conserva las validaciones de servidor; no confíes en que la interfaz sea un control de seguridad.
- Para dinero, respeta las convenciones existentes del proyecto y evita introducir cálculos imprecisos con números decimales sin revisar el diseño actual.
- Incluye o actualiza pruebas cuando cambies lógica de negocio. No afirmes que una prueba pasó si no la ejecutaste.
- No agregues pantallas, botones ni datos de prueba a la experiencia de producción sin acuerdo previo.

## ¿No sabes por dónde empezar?

Consulta [Ideas y misiones](./docs/IDEAS_Y_MISIONES.md), busca una tarea en Issues o abre una conversación. Antes de tomar una misión marcada como propuesta, confirma en el Issue que sigue disponible y que el alcance acordado coincide con tu plan.

## Licencia y contribuciones

El proyecto declara la licencia **Business Source License 1.1** en `LICENSE`. Lee sus términos antes de contribuir. Al enviar un Pull Request, aceptas que tu contribución se distribuya bajo los términos aplicables al proyecto; si tienes dudas sobre derechos de autor o licencia, pregunta antes de enviar el cambio.
