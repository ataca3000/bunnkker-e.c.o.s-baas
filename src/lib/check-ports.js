const net = require('net');

const ports = [8080, 9099, 4000, 3001]; // Firestore, Auth, UI, WebSocket

function checkPort(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(true); // El puerto está ocupado (el servidor está corriendo)
            } else {
                resolve(false);
            }
        });
        server.once('listen', () => {
            server.close();
            resolve(false); // El puerto estaba libre (el servidor NO está corriendo)
        });
        server.listen(port, '0.0.0.0');
    });
}

async function validate() {
    console.log("🔍 Validando infraestructura local...");
    for (const port of ports) {
        const isOpen = await checkPort(port);
        if (!isOpen) {
            console.error(`❌ ERROR: El puerto ${port} no responde. Asegúrate de iniciar el servidor maestro.`);
            process.exit(1);
        }
    }
    console.log("✅ Todo listo. Iniciando aplicación...");
}

validate();