/**
 * scripts/mdns.js
 * Anuncia el servidor ERP en la red local como "camalion.local"
 * Así los dispositivos en el mismo WiFi no necesitan saber la IP.
 *
 * Uso: node scripts/mdns.js
 * O junto con el servidor: npm run dev:local
 */

const mdns = require('multicast-dns')();
const { networkInterfaces } = require('os');

// ── Configuración ────────────────────────────────────────────────────────────
const HOSTNAME = process.env.MDNS_NAME || 'camalion'; // → camalion.local
const PORT     = process.env.PORT || 3000;

// ── Obtener IP WiFi real ─────────────────────────────────────────────────────
function getLocalIp() {
  const nets = networkInterfaces();
  // Preferir interfaz Wi-Fi o Ethernet, evitar virtual/loopback
  const preferredPrefixes = ['Wi-Fi', 'Ethernet', 'en0', 'eth0', 'wlan0'];
  
  for (const preferred of preferredPrefixes) {
    const iface = nets[preferred];
    if (iface) {
      const ipv4 = iface.find(n => n.family === 'IPv4' && !n.internal);
      if (ipv4) return ipv4.address;
    }
  }
  // Fallback: primera IP no-interna
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return '127.0.0.1';
}

const localIp = getLocalIp();
const fullName = `${HOSTNAME}.local`;

// ── Responder a queries mDNS ─────────────────────────────────────────────────
mdns.on('query', (query) => {
  const match = query.questions.some(q =>
    q.name === fullName || q.name === `${fullName}.`
  );

  if (match) {
    mdns.respond({
      answers: [
        {
          name: fullName,
          type: 'A',
          ttl: 300,
          flush: true,
          data: localIp,
        },
      ],
    });
  }
});

// ── Anuncio proactivo cada 30s para que los dispositivos lo descubran ────────
function announce() {
  mdns.respond({
    answers: [
      {
        name: fullName,
        type: 'A',
        ttl: 300,
        flush: true,
        data: localIp,
      },
    ],
  });
}

announce();
const interval = setInterval(announce, 30_000);

// ── Info en consola ─────────────────────────────────────────────────────────
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  🦎 Camalion Topics ERP — Red Local (mDNS)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  📡 Nombre en red:  http://${fullName}:${PORT}`);
console.log(`  🔢 IP directa:     http://${localIp}:${PORT}`);
console.log(`  📲 Instalar PWA:   http://${localIp}:${PORT}/conectar`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  Los dispositivos en el WiFi pueden usar:');
console.log(`  → http://${fullName}:${PORT}/login`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');

// ── Cierre limpio ────────────────────────────────────────────────────────────
process.on('SIGINT', () => {
  clearInterval(interval);
  mdns.destroy();
  console.log('\n[mDNS] Servicio detenido.');
  process.exit(0);
});
