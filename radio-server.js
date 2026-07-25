const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const dbPath = path.resolve(__dirname, 'prisma/dev.db');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || `file:${dbPath}`
    }
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// 1. PUERTO 3001: SINCRONIZACIÓN DE DATOS E INVENTARIO FLOATING (PUBLIC / POS)
// ═════════════════════════════════════════════════════════════════════════════
const SYNC_PORT = 3001;
const syncIo = new Server(SYNC_PORT, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 1e6
});

const reservations = {};

function getFloatingStock(productId) {
    let total = 0;
    for (const resId in reservations) {
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
          const currentFloating = getFloatingStock(item.id);
          try {
              const product = await prisma.product.findUnique({
                  where: { id: item.id },
                  select: { stock: true }
              });
              const dbStock = product ? product.stock : 0;
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
              expiresAt: Date.now() + (2 * 60 * 60 * 1000)
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

  socket.on('sync_db_event', (payload) => {
      socket.broadcast.emit('sync_db_event', payload);
  });
});

console.log(`🟢 Servidor de Sincronización de Datos en ejecución en Puerto ${SYNC_PORT}`);


// ═════════════════════════════════════════════════════════════════════════════
// 2. PUERTO 3002: SERVIDOR EXCLUSIVO DE RADIO DE PERSONAL (ISOLATED STAFF ONLY)
// ═════════════════════════════════════════════════════════════════════════════
const RADIO_PORT = 3002;
const radioIo = new Server(RADIO_PORT, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 1e7 // 10MB buffer para audio HD
});

radioIo.on('connection', (socket) => {
  console.log(`🔒 [Radio Server - Port 3002] Conexión entrante: ${socket.id}`);

  socket.on('join_radio', (data) => {
      const role = data?.role;

      // RECHAZO ABSOLUTO A CLIENTES Y VISITANTES WEB DE LA TIENDA
      if (!role || role === 'client' || role === 'cliente' || role === 'guest') {
          console.warn(`🚫 [RADIO SEGURA] Intento de acceso rechazado desde cliente/visitante web: ${socket.id}`);
          socket.emit('radio_error', { error: 'Acceso Denegado. Canal reservado exclusivamente para trabajadores.' });
          socket.disconnect(true);
          return;
      }

      socket.join('staff_radio');
      console.log(`📻 [RADIO INTERNA] Empleado autorizado conectado al canal: ${data?.name || socket.id} (${role})`);
  });

  socket.on('radio_tx', (data) => {
      // Verificar pertenencia al canal antes de retransmitir
      if (!socket.rooms.has('staff_radio')) {
          console.warn(`🔒 [Radio Segura] Intento de transmisión sin autorización desde: ${socket.id}`);
          return;
      }

      socket.to('staff_radio').emit('radio_rx', {
          senderId: socket.id,
          senderName: data.name || 'Personal Interno',
          audio: data.audio
      });
  });

  socket.on('disconnect', () => {
      console.log(`📻 [Radio Server] Empleado desconectado: ${socket.id}`);
  });
});

console.log(`📻 Servidor Exclusivo de Radio Interna iniciado en Puerto ${RADIO_PORT} (Canal Aislado Staff)`);
