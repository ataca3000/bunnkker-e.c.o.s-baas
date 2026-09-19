# Bridge local Windows y radio LAN

La app desplegada en Vercel no puede mantener sockets persistentes hacia una LAN privada. El PC servidor debe ejecutar `radio-server.js`; ese proceso expone:

- Radio de personal: `http://IP_DEL_PC:3002`
- Health check: `http://IP_DEL_PC:3002/health`
- Sincronización de inventario: puerto `3001`

## Inicio en el PC servidor

```powershell
cd C:\ruta\bunkkker-e.c.o.s-baas
$env:DATABASE_URL="file:C:/ruta/bunkkker-e.c.o.s-baas/prisma/dev.db"
node radio-server.js
```

Para que los roles desde la app cloud encuentren el bridge, configura en Vercel la variable pública:

```text
NEXT_PUBLIC_RADIO_URL=http://192.168.1.50:3002
NEXT_PUBLIC_RADIO_PORT=3002
```

Usa la IP fija o reservada del PC servidor. No uses `localhost` desde Vercel ni desde otro equipo: `localhost` siempre significa el equipo del navegador.

## Firewall de Windows

Permite conexiones entrantes TCP únicamente desde la subred Wi‑Fi de confianza al puerto `3002` y, si se usa sincronización de inventario, al `3001`. No publiques esos puertos en el router ni los abras a Internet.

## Flujo operativo

1. El PC inicia `radio-server.js`.
2. Admin y roles cargan la app de Vercel.
3. `LocalRadio` abre Socket.IO hacia `NEXT_PUBLIC_RADIO_URL`.
4. El servidor valida que el rol no sea cliente/guest y une al usuario al canal staff.
5. La radio reconecta automáticamente si el Wi‑Fi se interrumpe.
6. Vercel mantiene autenticación, datos cloud y configuración; el PC mantiene la radio y la continuidad LAN.

## Diagnóstico

```powershell
Test-NetConnection 192.168.1.50 -Port 3002
Invoke-WebRequest http://192.168.1.50:3002/health
```

Si aparece “error al conectar tienda local”, inicia el proceso en el PC, confirma la IP configurada y verifica que el navegador esté en la misma Wi‑Fi. Cambios de variables públicas requieren un nuevo despliegue.

Nunca uses PINs demo ni secretos internos en el bridge de producción.
