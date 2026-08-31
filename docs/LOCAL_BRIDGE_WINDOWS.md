# Bridge local Windows y radio LAN

## Arquitectura

Vercel aloja la interfaz y la API. El PC servidor Windows ejecuta `radio-server.js`, que expone Socket.IO en el puerto `3002` para el personal conectado al mismo Wi‑Fi. La app web apunta al PC mediante `NEXT_PUBLIC_RADIO_URL`; no intenta conectar el puerto 3002 de Vercel.

```text
Navegador staff -> Vercel / dashboard
Navegador staff -> http://IP_DEL_PC:3002 -> radio-server.js
PC servidor -> SQLite/local services (si aplica)
Vercel API <-> Neon/PostgreSQL
```

## Puesta en marcha en el PC servidor

1. Instalar Node.js LTS y abrir PowerShell en la carpeta del proyecto.
2. Ejecutar `npm install`.
3. Iniciar el bridge con `node radio-server.js` o `npm run dev` si también se desea iniciar Next local.
4. Confirmar que Windows Firewall permita conexiones entrantes TCP en el puerto `3002` solo desde la red privada.
5. Obtener la IP LAN del PC con `ipconfig`.
6. Configurar en Vercel `NEXT_PUBLIC_RADIO_URL` con `http://IP_DEL_PC:3002` y redeployar.

## Sincronización de roles

Los usuarios autenticados llegan al dashboard y el componente de radio envía su rol en `join_radio`. El bridge acepta únicamente roles internos y retransmite audio dentro de `staff_radio`; visitantes y clientes son rechazados. Si el bridge no está iniciado, el dashboard sigue funcionando y muestra `Radio local offline`.

## Seguridad

No abrir el puerto 3002 a Internet. Reservar una IP DHCP para el PC servidor, usar una red Wi‑Fi privada y cambiar los PINs demo antes de producción. Para acceso remoto futuro se debe usar un relay WebSocket autenticado; no basta con publicar el puerto del PC.

## Diagnóstico

- `Radio local offline`: revisar que `radio-server.js` esté iniciado, la IP sea correcta y el firewall permita TCP 3002.
- Conecta pero no transmite: verificar permisos de micrófono y que el usuario tenga un rol interno.
- La URL de Vercel funciona pero la radio no: es esperado si el PC servidor está apagado o fuera de la LAN.
