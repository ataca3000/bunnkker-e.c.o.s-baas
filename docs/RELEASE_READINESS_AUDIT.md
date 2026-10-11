# BUNKKER E.C.O.S. — Plan de endurecimiento para una versión piloto

Fecha de revisión: 2026-10-10  
Alcance: revisión estática inicial de `README.md`, `package.json`, `prisma/schema.prisma`, `src/lib/audit.ts`, `src/lib/localSync.ts`, `.env.example` y `docs/SECURITY.md`.

> Este documento registra hallazgos de código que requieren validación. No representa una auditoría de seguridad completa ni afirma que los flujos de producción hayan sido probados.

## Bloqueadores antes de usar con un negocio real

### P0 — Credenciales y autenticación
- El README publica PINs numéricos y alfanuméricos por rol. Confirmar si son únicamente datos de demostración o si permiten iniciar sesión en la aplicación. Si son funcionales, retirarlos de cualquier entorno público y generar credenciales únicas al instalar.
- Verificar que cada endpoint de API compruebe la identidad y el permiso del usuario en el servidor. Ocultar botones o dashboards en el cliente no es control de acceso.
- Almacenar PINs exclusivamente con hash robusto y salt; nunca persistir PINs en claro. Aplicar límites de intentos y demoras ante fuerza bruta.
- No usar secretos de desarrollo ni valores de respaldo en producción. Rotar cualquier secreto que haya sido publicado accidentalmente.

### P0 — Auditoría local
- En `src/lib/audit.ts`, el bloque de cifrado captura errores y después continúa con `encryptedLine`, que inicialmente contiene el JSON original. Eso puede hacer que el registro se escriba en texto plano si el cifrado falla.
- Corregir el flujo para que un error de cifrado impida escribir el registro sin cifrar y produzca una alerta observable.
- AES-CBC cifra pero no autentica el contenido. Diseñar una migración versionada a AES-256-GCM (o cifrado autenticado equivalente), guardando IV y etiqueta de autenticación. No cambiar el formato sin localizar y actualizar los lectores de logs existentes.
- No describir el registro como “inmutable” únicamente porque la UI no permita editarlo. Un administrador del equipo o del sistema de archivos podría modificarlo. Para detectar alteraciones, evaluar encadenamiento de hashes, permisos del archivo y copia remota protegida.

### P0 — Sincronización LAN y cola offline
- En `src/lib/localSync.ts`, la conexión se abre como `ws://` y se envían mensajes JSON. Antes de producción, definir autenticación mutua o tokens de dispositivo, autorización por operación, validación de esquema y límites de tamaño.
- La cola offline descarta la transacción más antigua al alcanzar 500 elementos. Para ventas e inventario, no descartar silenciosamente operaciones: bloquear nuevas escrituras o usar almacenamiento duradero con alerta y exportación de recuperación.
- Confirmar recepción y aplicación de cada transacción; eliminarla de la cola solo tras ACK del maestro. Un envío por WebSocket no demuestra que el cambio haya sido guardado.
- Aplicar idempotencia real en el servidor usando `txId` persistido. Probar reconexión, mensajes repetidos, dos terminales modificando el mismo stock y reloj del dispositivo incorrecto.
- No considerar mDNS ni una red Wi-Fi privada como autenticación.

## P1 — Integridad de datos comerciales

### Aislamiento multi-tenant
- Los modelos incluyen `tenantId`, a menudo con valor por defecto `"default"`. Ese campo no aísla los datos por sí mismo.
- Auditar cada consulta, mutación, tarea de fondo y canal de sincronización para exigir el tenant autenticado desde el servidor; nunca confiar en un `tenantId` enviado por el cliente.
- Añadir pruebas automatizadas de acceso cruzado entre dos tiendas para productos, clientes, pedidos, auditoría, configuración y usuarios.

### Dinero y stock
- En `prisma/schema.prisma`, `Product.price`, `Order.total`, `OrderItem.precio` y varios importes usan `Float`. Evaluar `Decimal` o cantidades enteras en centavos, con una migración y reglas explícitas de redondeo.
- Validar cantidades positivas, descuentos, impuestos y totales en el servidor. No confiar en los importes calculados en el navegador.
- Reservar, descontar y devolver stock dentro de transacciones atómicas; definir estados y expiración de reservas para que dos cajas no vendan la última unidad.
- Agregar restricciones e índices para identificadores de sincronización y operaciones únicas donde corresponda.

## P1 — Configuración, instalación y despliegue
- Alinear `.env.example` con la configuración real: eliminar duplicados confusos, explicar variables obligatorias por modo (web, demo y escritorio) y nunca usar secretos reales en el archivo de ejemplo.
- Revisar que la app de escritorio no necesite permisos de administrador por defecto; en `package.json` el instalador solicita `requireAdministrator`. Usar privilegio mínimo salvo que una necesidad técnica concreta lo justifique.
- Verificar que Electron tenga aislamiento de contexto, Node integration desactivado en contenido remoto, permisos IPC mínimos y validación del emisor en `preload.js` y `electron-main.js`.
- Ejecutar instalación limpia y validar scripts de build, empaquetado Windows, migraciones y despliegue. No declarar un build correcto hasta disponer de la salida real de CI.

## Orden de trabajo recomendado

1. Confirmar y eliminar credenciales demo activas de cualquier entorno público.
2. Corregir el comportamiento de fallo seguro de auditoría y diseñar compatibilidad para los logs antiguos.
3. Autenticar y autorizar cada mensaje LAN; implementar ACK e idempotencia persistente.
4. Revisar todos los endpoints con una matriz rol × operación × tenant.
5. Corregir dinero/stock mediante migraciones y pruebas de concurrencia.
6. Añadir CI que ejecute lint, validación de esquema, pruebas unitarias, pruebas de API y build.
7. Ejecutar piloto controlado con datos ficticios y un checklist de recuperación antes de migrar un inventario real.

## Criterios mínimos para autorizar un piloto

- Un cajero no puede acceder a administración cambiando URL, cookies o payloads.
- Una tienda no puede leer ni modificar datos de otra.
- Una venta duplicada o una reconexión no duplica cobros ni movimientos de inventario.
- Una caída de red no borra operaciones pendientes y se muestra claramente el estado de sincronización.
- Un fallo de cifrado no escribe registros sensibles en claro.
- Backup y restauración se prueban en una instalación limpia.
- Se registra la versión exacta probada y se guardan resultados de pruebas reproducibles.

## Limitaciones de esta revisión

La revisión fue estática y parcial. No se ejecutaron los tests ni el build; tampoco se revisaron todos los endpoints, reglas de Firebase, migraciones, dependencias instaladas o la configuración real de Vercel. Cada hallazgo debe confirmarse con pruebas antes de considerar resuelto el riesgo.
