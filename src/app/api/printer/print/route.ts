import { NextRequest, NextResponse } from 'next/server';
import { buildReceiptBytes } from '@/lib/thermalPrinter';
import { requireRole } from '@/lib/apiAuth';
import net from 'net';

export const runtime = 'nodejs';

interface PrintJobPayload {
    businessName: string;
    orderId: string;
    items: { name: string; quantity: number; price: number }[];
    total: number;
    date?: string;
    customerName?: string;
    targetIp?: string;
    targetPort?: number;
    mode?: 'network_ip' | 'spool';
}

const ALLOWED_PRINT_ROLES = ['superadmin', 'admin', 'sales', 'caja', 'inventory', 'almacen', 'carga_descarga', 'pickup'];

// Allowlist configurable de IPs de impresoras autorizadas en red
const CONFIGURED_PRINTER_IPS = (process.env.ALLOWED_PRINTER_IPS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * Validador estricto anti-SSRF para impresoras en red local (ESC/POS).
 * Bloquea terminantemente: loopback (127.0.0.1), metadata de nube (169.254.x.x),
 * 0.0.0.0, broadcast (.255) y multicast.
 */
function getSafePrinterTarget(rawIp: unknown, rawPort: unknown): { ip: string; port: number } | null {
    if (typeof rawIp !== 'string') return null;
    const ip = rawIp.trim();
    if (!net.isIPv4(ip)) return null;

    // Bloqueo explícito de loopback, link-local (cloud metadata), broadcast y multicast
    if (
        ip === '0.0.0.0' ||
        ip.startsWith('127.') ||
        ip.startsWith('169.254.') ||
        ip.startsWith('224.') ||
        ip.startsWith('240.') ||
        ip.endsWith('.255')
    ) {
        return null;
    }

    // Si existe una lista blanca configurada por el administrador, verificarla
    if (CONFIGURED_PRINTER_IPS.length > 0 && !CONFIGURED_PRINTER_IPS.includes(ip)) {
        return null;
    }

    // Validar rangos privados RFC1918 para impresoras LAN
    const octets = ip.split('.').map(Number);
    if (octets.length !== 4 || octets.some((o) => isNaN(o) || o < 0 || o > 255)) {
        return null;
    }

    const isClassC = octets[0] === 192 && octets[1] === 168 && octets[2] >= 0 && octets[2] <= 255 && octets[3] >= 1 && octets[3] <= 254;
    const isClassA = octets[0] === 10 && octets[1] >= 0 && octets[1] <= 255 && octets[2] >= 0 && octets[2] <= 255 && octets[3] >= 1 && octets[3] <= 254;
    const isClassB = octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31 && octets[2] >= 0 && octets[2] <= 255 && octets[3] >= 1 && octets[3] <= 254;

    if (!isClassC && !isClassA && !isClassB) {
        return null;
    }

    const portNum = Number(rawPort);
    if (!Number.isInteger(portNum) || portNum < 9100 || portNum > 9109) {
        return null;
    }

    return { ip, port: portNum };
}

// Spool en memoria para terminales suscriptoras en red local
const printSpoolQueue: Array<{
    id: string;
    data: any;
    status: 'pending' | 'printed';
    timestamp: number;
}> = [];

export async function POST(req: NextRequest) {
    const auth = requireRole(req, ALLOWED_PRINT_ROLES);
    if (!auth.ok) return auth.response;

    try {
        const body: PrintJobPayload = await req.json();

        if (!body.orderId || !body.items || body.total === undefined) {
            return NextResponse.json({ success: false, error: 'Datos de ticket incompletos' }, { status: 400 });
        }

        const printData = {
            businessName: body.businessName || 'BUNKKER E.C.O.S.',
            orderId: body.orderId,
            items: body.items,
            total: body.total,
            date: body.date ? new Date(body.date) : new Date(),
            customerName: body.customerName
        };

        // 1. Envío directo TCP RAW (restringido a IPs privadas LAN validadas y puertos de impresora ESC/POS 9100-9109)
        if (body.mode === 'network_ip' && body.targetIp) {
            const target = getSafePrinterTarget(body.targetIp, body.targetPort || 9100);
            if (!target) {
                return NextResponse.json(
                    { success: false, error: 'Dirección IP o puerto de impresora no permitido (solo LAN privada puertos 9100-9109).' },
                    { status: 400 }
                );
            }

            const rawChunks = buildReceiptBytes(printData);
            const totalBytesLength = rawChunks.reduce((acc, c) => acc + c.length, 0);
            const combinedBuffer = Buffer.alloc(totalBytesLength);
            let offset = 0;
            for (const chunk of rawChunks) {
                Buffer.from(chunk).copy(combinedBuffer, offset);
                offset += chunk.length;
            }

            const safeIp = target.ip;
            const safePort = target.port;

            const sendPromise = new Promise<{ ok: boolean; message: string }>((resolve, reject) => {
                const client = new net.Socket();
                client.setTimeout(6000);

                client.connect(safePort, safeIp, () => {
                    client.write(combinedBuffer, () => {
                        client.end();
                        resolve({ ok: true, message: `Ticket enviado con éxito a impresora en ${safeIp}:${safePort}` });
                    });
                });

                client.on('timeout', () => {
                    client.destroy();
                    reject(new Error(`Tiempo de espera agotado al conectar a la impresora.`));
                });

                client.on('error', (err) => {
                    client.destroy();
                    reject(new Error(`Fallo de conexión con la impresora en red: ${err.message}`));
                });
            });

            const result = await sendPromise;
            return NextResponse.json({ success: true, ...result });
        }

        // 2. Modo Spool: Guardar para que la PC central con impresora USB/Serial lo despache
        const jobId = `print_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        printSpoolQueue.push({
            id: jobId,
            data: printData,
            status: 'pending',
            timestamp: Date.now()
        });

        if (printSpoolQueue.length > 50) {
            printSpoolQueue.shift();
        }

        return NextResponse.json({
            success: true,
            jobId,
            message: 'Ticket encolado en el Servidor PC para impresión inmediata.'
        });

    } catch (err: any) {
        console.error('Error en /api/printer/print:', err);
        return NextResponse.json({
            success: false,
            error: 'Error interno al procesar impresión'
        }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    const auth = requireRole(req, ALLOWED_PRINT_ROLES);
    if (!auth.ok) return auth.response;

    const pending = printSpoolQueue.filter(j => j.status === 'pending');
    return NextResponse.json({
        success: true,
        pendingJobs: pending,
        totalInQueue: printSpoolQueue.length
    });
}
