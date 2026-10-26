# ADR 012: Blindaje Anti-Suplantación de Clientes y Reparación de Fontanería LAN Multi-Dispositivo

## Contexto y Síntomas
1. **Fallo Crítico de Seguridad (Suplantación):** En `/api/auth/register-client`, si un usuario ingresaba el correo o teléfono de una cuenta existente con PIN, el endpoint no validaba si la contraseña coincidía y emitía un JWT/sesión de inmediato.
2. **Fuga de Sesión en Logout:** `DELETE /api/auth/session` omitía eliminar la cookie de cliente web `admincom_session`.
3. **Discrepancia de Roles:** El JWT usaba `customer` mientras las cookies usaban `client`.
4. **Desconexión en Fontanería de Sincronización:** `syncNotifier.ts` emitía `inventory_updated` en vez del canal canónico `sync_db_event`, y `useSyncListener` no escuchaba sockets LAN ni protegía contra re-renders destructivos.
5. **Divergencia Git:** Conflicto en `README.md` con placeholder roto en `origin/main`.

## Decisiones Aplicadas
1. **Compuerta Anti-Suplantación y Multi-Tenant:**
   - En [`src/app/api/auth/register-client/route.ts`](file:///c:/Users/codem/bunnkker-e.c.o.s-baas/src/app/api/auth/register-client/route.ts), se incorporó `getTenantId(req)` y la validación obligatoria: si el cliente ya existe y tiene PIN, se exige coincidencia estricta; de lo contrario, se rechaza con `401 Unauthorized`.
   - Generación determinista de identificadores telefónicos sintéticos para registros solo con email (`00` + hash hex), evitando colisiones concurrentes.
2. **Saneamiento de Sesión en Logout:**
   - En [`src/app/api/auth/session/route.ts`](file:///c:/Users/codem/bunnkker-e.c.o.s-baas/src/app/api/auth/session/route.ts), `DELETE` ahora elimina explícitamente `admincom_session` tanto en `cookieStore` como en los headers Set-Cookie de la respuesta.
3. **Tolerancia Bivalente de Roles (`customer` / `client`):**
   - En [`src/app/api/customer/me/route.ts`](file:///c:/Users/codem/bunnkker-e.c.o.s-baas/src/app/api/customer/me/route.ts) y [`src/app/api/orders/route.ts`](file:///c:/Users/codem/bunnkker-e.c.o.s-baas/src/app/api/orders/route.ts), se permite tanto `payload.role === 'customer'` como `payload.role === 'client'`, garantizando interoperabilidad.
4. **Fontanería de Sincronización LAN Completa:**
   - En [`src/lib/syncNotifier.ts`](file:///c:/Users/codem/bunnkker-e.c.o.s-baas/src/lib/syncNotifier.ts), `broadcastSync` emite concurrentemente en `sync_db_event`, `inventory_updated`, `bunkker_tab_sync` y DOM `CustomEvent`.
   - `useSyncListener` utiliza `useRef` para estabilidad en render y se suscribe activamente a sockets de red LAN, garantizando actualización instantánea entre diferentes terminales físicas.
5. **Resolución de Conflicto Git:**
   - Merge limpio de `origin/main` integrando el hero asset en [`README.md`](file:///c:/Users/codem/bunnkker-e.c.o.s-baas/README.md) y retirando el placeholder roto.

## Verificación
- 14 suites de prueba, 120 pruebas en verde (100% passing).
- Type check: `npx tsc --noEmit` exit code 0.
