const { Server } = require('socket.io');
const { createServer } = require('http');
const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bunkkerConfig = require('./bunkker.config.json');

// ─── Supresor de errores TCP transitorios ─────────────────────────────────────
// Errores como wsarecv / stream reading error / ECONNRESET son normales en
// conexiones WebSocket de larga duración (Windows corta streams inactivos).
// Socket.IO maneja la reconexión automáticamente — no necesitamos crashear.
const TCP_ERROR_PATTERNS = [
  'stream reading error', 'wsarecv', 'ECONNRESET',
  'WebChannelConnection', 'transport errored', 'ETIMEDOUT',
];
process.on('uncaughtException', (err) => {
  const msg = err?.message ?? String(err);
  if (TCP_ERROR_PATTERNS.some(p => msg.includes(p))) {
    // Error de red transitorio — ignorar silenciosamente
    return;
  }
  // Cualquier otro error sí debe interrumpir el proceso
  console.error('💥 [radio-server] Error no manejado:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  const msg = String(reason?.message ?? reason ?? '');
  if (TCP_ERROR_PATTERNS.some(p => msg.includes(p))) return;
  console.error('💥 [radio-server] Promesa rechazada sin manejar:', reason);
});

// Resolver ruta unificada de SQLite: comparte la misma base que Electron y Next.js
let defaultSqlitePath;
if (process.env.APPDATA) {
  const electronDb = path.join(process.env.APPDATA, 'bunnkker-ecos', 'database.sqlite');
  const electronDbAlt = path.join(process.env.APPDATA, 'bunnkker-e.c.o.s-baas', 'database.sqlite');
  if (fs.existsSync(electronDb)) defaultSqlitePath = electronDb;
  else if (fs.existsSync(electronDbAlt)) defaultSqlitePath = electronDbAlt;
}
if (!defaultSqlitePath) {
  defaultSqlitePath = path.resolve(__dirname, 'prisma/dev.db');
}
const effectiveDbUrl = process.env.DATABASE_URL || `file:${defaultSqlitePath.replace(/\\/g, '/')}`;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: effectiveDbUrl
    }
  }
});

const COOKIE_SECRET = process.env.INTERNAL_API_SECRET || 'bunkker-ecos-default-local-dev-secret-key-2026';
function verifyRoleSignature(role, uid, signature) {
  if (!role || !uid || !signature) return false;
  const expected = crypto.createHmac('sha256', COOKIE_SECRET).update(`${role}:${uid}`).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return expected === signature;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. PUERTO 3001: SINCRONIZACIÓN DE DATOS E INVENTARIO FLOATING (PUBLIC / POS)
// ═════════════════════════════════════════════════════════════════════════════
const SYNC_PORT = Number(process.env.SYNC_PORT || 3001);
const syncHttp = createServer((req, res) => {
  if (req.url === '/health' || req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: true, service: 'bunkker-sync-bridge', syncPort: SYNC_PORT, timestamp: new Date().toISOString() }));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});

const syncIo = new Server(syncHttp, {
  cors: {
    origin: (origin, callback) => {
      // Permitir cualquier conexión local o LAN (192.168.x.x, 10.x.x.x, etc.)
      callback(null, true);
    },
    methods: ["GET", "POST"],
    credentials: true
  },
  maxHttpBufferSize: 1e6
});

// S2.4 FIX: Idempotencia del WAL — evita procesar la misma transacción dos veces
// en caso de reconexión del cliente (el mensaje se re-encola y se reenvía).
// El Set vive en memoria (reinicia con el servidor), que es suficiente para el caso de uso.
// Para persistencia entre reinicios, migrar a Redis con TTL de 24h.
const processedTxIds = new Set();
const MAX_PROCESSED_TX_IDS = 10_000; // límite para evitar memory leak en sesiones largas


const reservations = {};

function getFloatingStock(productId, excludingReservationId) {
    let total = 0;
    for (const resId in reservations) {
        if (resId === excludingReservationId) continue;
        if (reservations[resId].items[productId]) {
            total += reservations[resId].items[productId];
        }
    }
    return total;
}

setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const resId in reservations) {
        if (reservations[resId].expiresAt < now) {
            console.log(`⏰ [Inventario] Reserva expirada eliminada: ${resId}`);
            delete reservations[resId];
            changed = true;
        }
    }
    if (changed) broadcastFloatingStock();
}, 60000);

function broadcastFloatingStock() {
    const consolidated = {};
    for (const resId in reservations) {
        for (const prodId in reservations[resId].items) {
            consolidated[prodId] = (consolidated[prodId] || 0) + reservations[resId].items[prodId];
        }
    }
    syncIo.emit('floating_stock_update', consolidated);
}

syncIo.on('connection', (socket) => {
  console.log(`📡 [Data Sync - Port 3001] Conexión activa: ${socket.id}`);
  broadcastFloatingStock();

  socket.on('reserve_stock', async (data, callback) => {
      console.log(`🔒 [Inventario] Validando reserva ${data.reservationId}...`);
      let canReserve = true;
      const failedItems = [];

      for (const item of data.items) {
          const currentFloating = getFloatingStock(item.id, data.reservationId);
          try {
              const product = await prisma.product.findUnique({
                  where: { id: item.id },
                  select: { stock: true, reservedStock: true }
              });
              const dbStock = product ? product.stock - product.reservedStock : 0;
              if (dbStock - currentFloating < item.qty) {
                  canReserve = false;
                  failedItems.push(item.id);
              }
          } catch (error) {
              console.error(`❌ Error consultando stock en DB para ${item.id}`, error);
              canReserve = false;
              failedItems.push(item.id);
          }
      }

      if (canReserve) {
          const itemsMap = {};
          data.items.forEach(i => itemsMap[i.id] = i.qty);
          reservations[data.reservationId] = {
              items: itemsMap,
              expiresAt: Date.now() + bunkkerConfig.reservation.timeoutMs
          };
          broadcastFloatingStock();
          if (callback) callback({ success: true });
      } else {
          if (callback) callback({ success: false, failedItems });
      }
  });

  socket.on('release_stock', (reservationId) => {
      if (reservations[reservationId]) {
          delete reservations[reservationId];
          broadcastFloatingStock();
      }
  });

  socket.on('clear_all_reservations', () => {
      for (const resId in reservations) {
          delete reservations[resId];
      }
      broadcastFloatingStock();
  });

  socket.on('commit_stock', (reservationId) => {
      if (reservations[reservationId]) {
          delete reservations[reservationId];
          broadcastFloatingStock();
      }
  });

  // ─── LOCK-CLAIM WORK QUEUE & DELEGATION ────────────────────────────────────
  socket.on('claim_order', (data, callback) => {
      console.log(`🔒 [Pizarrón Público] Reclamo de orden ${data.orderId} por ${data.userName} (${data.role})`);
      syncIo.emit('order_claimed', {
          orderId: data.orderId,
          claimedBy: data.userName,
          claimedRole: data.role,
          claimedAt: new Date().toISOString()
      });
      if (callback) callback({ success: true });
  });

  socket.on('release_order', (data, callback) => {
      console.log(`↩️ [Pizarrón Público] Delegación/Devolución de orden ${data.orderId} por ${data.userName} (${data.reason || 'Sin razón'})`);
      syncIo.emit('order_released', {
          orderId: data.orderId,
          releasedBy: data.userName,
          role: data.role,
          reason: data.reason,
          releasedAt: new Date().toISOString()
      });
      if (callback) callback({ success: true });
  });

  socket.on('sync_db_event', (payload) => {
      // S2.4 FIX: Idempotencia del WAL — ignorar transacciones ya procesadas.
      if (payload?.txId) {
          if (processedTxIds.has(payload.txId)) {
              console.log(`[WAL] txId duplicado ignorado: ${payload.txId}`);
              return; // no retransmitir, el cliente ya recibió ACK en el primer envío
          }
          // Registrar como procesado. Rotar si supera el límite.
          if (processedTxIds.size >= MAX_PROCESSED_TX_IDS) {
              const firstKey = processedTxIds.values().next().value;
              processedTxIds.delete(firstKey);
          }
          processedTxIds.add(payload.txId);
      }
      socket.broadcast.emit('sync_db_event', payload);
  });
});

syncHttp.listen(SYNC_PORT, '0.0.0.0', () => {
  console.log(`🟢 Servidor de Sincronización de Datos en ejecución en Puerto ${SYNC_PORT} (0.0.0.0 LAN abierta)`);
  console.log(`🩺 Health check disponible en http://<IP_DEL_PC>:${SYNC_PORT}/health`);
});


// ═════════════════════════════════════════════════════════════════════════════
// 2. PUERTO 3002: SERVIDOR EXCLUSIVO DE RADIO DE PERSONAL (ISOLATED STAFF ONLY)
// ═════════════════════════════════════════════════════════════════════════════
const RADIO_PORT = Number(process.env.RADIO_PORT || 3002);
const radioHttp = createServer((req, res) => {
  if (req.url === '/health' || req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: true, service: 'bunkker-local-bridge', radioPort: RADIO_PORT, syncPort: SYNC_PORT, timestamp: new Date().toISOString() }));
    return;
  }
  res.writeHead(404);
  res.end('Not found');
});
const radioIo = new Server(radioHttp, {
  cors: { origin: process.env.RADIO_ALLOWED_ORIGIN || '*', methods: ["GET", "POST"] },
  maxHttpBufferSize: 1e7 // 10MB buffer para audio HD
});

radioIo.on('connection', (socket) => {
  console.log(`🔒 [Radio Server - Port 3002] Conexión entrante: ${socket.id}`);

  socket.on('join_radio', async (data) => {
      const { role, uid, signature, name } = data || {};

      // 1. RECHAZO INMEDIATO SI NO PRESENTA CREDENCIALES
      if (!role || !uid || !signature) {
          console.warn(`🚫 [RADIO SEGURA] Intento de acceso sin firma criptográfica desde: ${socket.id}`);
          socket.emit('radio_error', { error: 'No autorizado. Se requiere firma criptográfica de sesión.' });
          socket.disconnect(true);
          return;
      }

      // 2. RECHAZO A CLIENTES Y VISITANTES
      const forbiddenRoles = ['client', 'cliente', 'guest'];
      if (forbiddenRoles.includes(role)) {
          console.warn(`🚫 [RADIO SEGURA] Intento de acceso rechazado desde cliente/visitante: ${socket.id} (uid: ${uid})`);
          socket.emit('radio_error', { error: 'Acceso Denegado. Canal reservado exclusivamente para trabajadores.' });
          socket.disconnect(true);
          return;
      }

      // 3. VERIFICACIÓN CRIPTOGRÁFICA DE LA FIRMA HMAC
      const isSigValid = verifyRoleSignature(role, uid, signature);
      if (!isSigValid) {
          console.warn(`🚫 [RADIO SEGURA] Firma de rol inválida desde ${socket.id} (uid: ${uid}, role: ${role})`);
          socket.emit('radio_error', { error: 'Firma de autenticación rechazada.' });
          socket.disconnect(true);
          return;
      }

      // 4. VERIFICACIÓN DE ESTADO DEL USUARIO EN LA BASE DE DATOS DEL NODO
      let verifiedName = name || 'Personal Interno';
      let verifiedRole = role;
      try {
          const dbUser = await prisma.user.findUnique({
              where: { id: uid },
              select: { id: true, name: true, role: true, active: true }
          });

          if (dbUser) {
              if (!dbUser.active) {
                  console.warn(`🚫 [RADIO SEGURA] Usuario inactivo en BD intentó conectar: ${uid}`);
                  socket.emit('radio_error', { error: 'Cuenta de usuario inactiva.' });
                  socket.disconnect(true);
                  return;
              }
              if (forbiddenRoles.includes(dbUser.role)) {
                  console.warn(`🚫 [RADIO SEGURA] Rol en BD denegado para radio: ${dbUser.role} (uid: ${uid})`);
                  socket.emit('radio_error', { error: 'Acceso Denegado. Rol no autorizado para canal de radio.' });
                  socket.disconnect(true);
                  return;
              }
              verifiedName = dbUser.name || verifiedName;
              verifiedRole = dbUser.role || verifiedRole;
          }
      } catch (err) {
          console.warn(`⚠️ [RADIO SEGURA] Advertencia consultando BD para radio (modo offline/resiliente): ${err.message}`);
      }

      socket.data = {
          uid,
          role: verifiedRole,
          name: verifiedName
      };

      socket.join('staff_radio');
      console.log(`📻 [RADIO INTERNA] Empleado verificado conectado al canal: ${verifiedName} (${verifiedRole}) [uid: ${uid}]`);
  });

  socket.on('radio_tx', (data) => {
      // Verificar pertenencia al canal antes de retransmitir
      if (!socket.rooms.has('staff_radio')) {
          console.warn(`🔒 [Radio Segura] Intento de transmisión sin autorización desde: ${socket.id}`);
          return;
      }

      socket.to('staff_radio').emit('radio_rx', {
          senderId: socket.id,
          senderName: socket.data?.name || data?.name || 'Personal Interno',
          audio: data.audio
      });
  });

  socket.on('disconnect', () => {
      console.log(`📻 [Radio Server] Empleado desconectado: ${socket.data?.name || socket.id}`);
  });
});

radioHttp.listen(RADIO_PORT, '0.0.0.0', () => {
  console.log(`📻 Servidor Exclusivo de Radio Interna iniciado en Puerto ${RADIO_PORT} (Canal Aislado Staff)`);
  console.log(`🩺 Health check disponible en http://<IP_DEL_PC>:${RADIO_PORT}/health`);
});
