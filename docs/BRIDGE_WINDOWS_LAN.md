# 📻 Bridge Local Windows y Radio LAN (Walkie-Talkie P2P)

## 1. Arquitectura y Topología de Red

El PC Servidor en la tienda física ejecuta el proceso `radio-server.js`. Este servicio corre en Node.js y expone sockets en la red local privada:

- **Canal de Radio Personal:** `http://IP_DEL_PC:3002` (WebSocket / Socket.IO)
- **Health Check & Estado:** `http://IP_DEL_PC:3002/health`
- **Frontend / Next.js Server:** `http://IP_DEL_PC:3000`

```text
[ Terminal Staff (Caja/Bodega/Patio) ] 
        │ (Audio WebRTC/Socket.IO en LAN - Puerto 3002)
        ▼
[ PC Servidor Maestro ] ◄── radio-server.js (Audio Relay a 0ms WAN)
        │ 
        └── Next.js 15 Standalone (Puerto 3000) ◄── SQLite Local (dev.db)
```

---

## 2. Puesta en Marcha en el Servidor Local

1. Abrir terminal (PowerShell o CMD) en la carpeta del proyecto.
2. Iniciar los servicios con el comando unificado:
   ```bash
   npm run dev
   ```
   *(O de forma independiente para producción: `node radio-server.js`)*.
3. Para consultar la IP local del equipo servidor:
   ```powershell
   ipconfig
   ```
4. Las demás terminales de la tienda (tablets, laptops, otras cajas) simplemente abren su navegador apuntando a:
   ```text
   http://<IP_DEL_PC>:3000
   ```

---

## 3. Funcionamiento del Walkie-Talkie

- **Aislamiento por Rol:** Al ingresar al sistema con su PIN, el personal se conecta automáticamente al canal de radio interno (`staff_radio`).
- **Seguridad en Navegador:** Los clientes y visitantes del catálogo público no tienen acceso al canal de audio ni reciben paquetes de radio.
- **Reproducción Continua:** El audio entrante se procesa vía Blob URLs con decodificación de fallback en Web Audio API para evitar que la transmisión se quede en estado congelado o en espera.

---

## 4. Reglas del Firewall de Windows

1. Permitir conexiones entrantes TCP en el puerto `3002` y `3000` únicamente para el perfil de red **Privada / Doméstica**.
2. **Importante:** Nunca abras ni reenvíes (Port Forwarding) estos puertos en el router hacia el internet público; deben operar estrictamente confinados a la red Wi-Fi o cable Ethernet local.
