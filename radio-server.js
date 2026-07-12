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

const port = 3001;
const io = new Server(port, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 1e7 // 10MB para buffers de audio grandes
});

// ─── LÓGICA DE INVENTARIO FLOATING ───
// reservationId -> { items: { productId: qty }, expiresAt: timestamp }
const reservations = {};

// Calcula el total de stock flotante para un producto
function getFloatingStock(productId) {
    let total = 0;
    for (const resId in reservations) {
        if (reservations[resId].items[productId]) {
            total += reservations[resId].items[productId];
        }
    }
    return total;
}

// Bucle de limpieza cada minuto
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
    // Solo necesitamos enviar el mapa consolidado de totales
    const consolidated = {};
    for (const resId in reservations) {
        for (const prodId in reservations[resId].items) {
            consolidated[prodId] = (consolidated[prodId] || 0) + reservations[resId].items[prodId];
        }
    }
    io.emit('floating_stock_update', consolidated);
}
// ─────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`📡 [Radio/Sync] Dispositivo conectado: ${socket.id}`);
  
  // Enviar el estado inicial del stock flotante al conectarse
  broadcastFloatingStock();

  socket.on('join_radio', (data) => {
      // Ignorar clientes externos si intentan unirse
      if (data?.role === 'cliente') {
          console.log(`🚫 [Radio] Cliente bloqueado: ${socket.id}`);
          return;
      }
      
      socket.join('staff_radio');
      console.log(`📡 [Radio] Staff unido al canal: ${data?.name || socket.id}`);
  });

  // ─── INVENTARIO FLOATING EVENTS ───
  
  // Intentar reservar stock (Validando)
  socket.on('reserve_stock', async (data, callback) => {
      // data: { reservationId, items: [{id: "1", qty: 2}] }
      console.log(`🔒 [Inventario] Validando reserva ${data.reservationId}...`);
      
      let canReserve = true;
      const failedItems = [];

      for (const item of data.items) {
          const currentFloating = getFloatingStock(item.id);
          
          // Consultar el stock REAL directamente en la base de datos (una fila a la vez)
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
              console.error(`❌ Error al consultar Prisma para el producto ${item.id}`, error);
              canReserve = false;
              failedItems.push(item.id);
          }
      }

      if (canReserve) {
          const itemsMap = {};
          data.items.forEach(i => itemsMap[i.id] = i.qty);
          
          reservations[data.reservationId] = {
              items: itemsMap,
              expiresAt: Date.now() + (2 * 60 * 60 * 1000) // 2 horas de caducidad
          };
          
          console.log(`✅ [Inventario] Reserva EXITOSA: ${data.reservationId}`);
          broadcastFloatingStock();
          if (callback) callback({ success: true });
      } else {
          console.log(`❌ [Inventario] Reserva RECHAZADA por falta de stock. IDs: ${failedItems.join(',')}`);
          if (callback) callback({ success: false, failedItems });
      }
  });

  // Liberar reserva explícitamente (ej. cliente cancela carrito)
  socket.on('release_stock', (reservationId) => {
      if (reservations[reservationId]) {
          console.log(`🔓 [Inventario] Reserva liberada (cancelación): ${reservationId}`);
          delete reservations[reservationId];
          broadcastFloatingStock();
      }
  });

  // Limpiar todas las reservas flotantes (usado en tests E2E)
  socket.on('clear_all_reservations', () => {
      console.log('🧹 [Inventario] Limpiando todas las reservas flotantes en memoria.');
      for (const resId in reservations) {
          delete reservations[resId];
      }
      broadcastFloatingStock();
  });

  // Consumar venta (ej. orden pagada, el stock se resta de la DB real)
  socket.on('commit_stock', (reservationId) => {
      if (reservations[reservationId]) {
          console.log(`💰 [Inventario] Reserva concretada (Venta): ${reservationId}. Borrando floating.`);
          delete reservations[reservationId];
          broadcastFloatingStock();
      }
  });
  // ──────────────────────────────────
  // Sincronización Genérica de Base de Datos Local
  socket.on('sync_db_event', (payload) => {
      // Rebotar a todos los clientes excepto al emisor
      socket.broadcast.emit('sync_db_event', payload);
  });
  // ──────────────────────────────────

  // Recibir transmisión de audio y reenviar
  socket.on('radio_tx', (data) => {
      // Retransmitir a todos en la sala 'staff_radio' excepto al que lo envió
      socket.to('staff_radio').emit('radio_rx', {
          senderId: socket.id,
          senderName: data.name || 'Almacén',
          audio: data.audio
      });
  });

  socket.on('disconnect', () => {
      console.log(`📡 [Radio/Sync] Dispositivo desconectado: ${socket.id}`);
  });
});

console.log(`📻 Servidor de Radio y Sincronización iniciado en el puerto ${port}`);
