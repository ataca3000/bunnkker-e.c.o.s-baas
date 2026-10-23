import { NextRequest, NextResponse } from 'next/server';
import { buildReceiptBytes } from '@/lib/thermalPrinter';
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

// Spool en memoria para terminales suscriptoras en red local
const printSpoolQueue: Array<{
    id: string;
    data: any;
    status: 'pending' | 'printed';
    timestamp: number;
}> = [];

export async function POST(req: NextRequest) {
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

        const targetIp = body.targetIp?.trim();
        const targetPort = body.targetPort || 9100;

        // 1. Envío directo TCP RAW (Puerto 9100 ESC/POS para impresoras WiFi/Ethernet)
        if (body.mode === 'network_ip' && targetIp) {
            const rawChunks = buildReceiptBytes(printData);
            const totalBytesLength = rawChunks.reduce((acc, c) => acc + c.length, 0);
            const combinedBuffer = Buffer.alloc(totalBytesLength);
            let offset = 0;
            for (const chunk of rawChunks) {
                Buffer.from(chunk).copy(combinedBuffer, offset);
                offset += chunk.length;
            }

            const sendPromise = new Promise<{ ok: boolean; message: string }>((resolve, reject) => {
                const client = new net.Socket();
                client.setTimeout(6000);

                client.connect(targetPort, targetIp, () => {
                    client.write(combinedBuffer, () => {
                        client.end();
                        resolve({ ok: true, message: `Ticket enviado con éxito a impresora en ${targetIp}:${targetPort}` });
                    });
                });

                client.on('timeout', () => {
                    client.destroy();
                    reject(new Error(`Tiempo de espera agotado al conectar a ${targetIp}:${targetPort}`));
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

        // Mantener cola limpia (máximo 50 trabajos)
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
            error: err.message || 'Error interno al procesar impresión'
        }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    // Permite a la PC central consultar trabajos pendientes si actúa como despachador
    const pending = printSpoolQueue.filter(j => j.status === 'pending');
    return NextResponse.json({
        success: true,
        pendingJobs: pending,
        totalInQueue: printSpoolQueue.length
    });
}
