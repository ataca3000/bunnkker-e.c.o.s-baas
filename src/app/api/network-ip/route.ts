/**
 * @deprecated Usar /api/network/ip — esta ruta existe solo por compatibilidad.
 * La versión canónica prioriza correctamente redes LAN (192.168.x.x, 10.x.x.x).
 */
import { NextResponse } from 'next/server';
import { networkInterfaces } from 'os';

export async function GET() {
    try {
        const nets = networkInterfaces();
        let localIp = '127.0.0.1';

        // Prioridad 1: LAN típica (192.168.x.x, 10.x.x.x)
        for (const name of Object.keys(nets)) {
            for (const net of nets[name] || []) {
                if (net.family === 'IPv4' && !net.internal) {
                    if (net.address.startsWith('192.168.') || net.address.startsWith('10.')) {
                        localIp = net.address;
                        break;
                    }
                }
            }
            if (localIp !== '127.0.0.1') break;
        }

        // Prioridad 2: Cualquier IPv4 no interna
        if (localIp === '127.0.0.1') {
            for (const name of Object.keys(nets)) {
                for (const net of nets[name] || []) {
                    if (net.family === 'IPv4' && !net.internal) {
                        localIp = net.address;
                        break;
                    }
                }
                if (localIp !== '127.0.0.1') break;
            }
        }

        return NextResponse.json({
            success: true,
            ip: localIp,
            publicUrl: process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_URL || null
        });
    } catch {
        return NextResponse.json({ success: false, ip: '127.0.0.1' });
    }
}
