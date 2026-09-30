import { NextResponse } from 'next/server';
import { networkInterfaces } from 'os';

export async function GET() {
    try {
        const nets = networkInterfaces();
        let localIp = '';

        // Prioridad 1: Buscar adaptadores LAN típicos (192.168.x.x, 10.x.x.x)
        for (const name of Object.keys(nets)) {
            for (const net of nets[name] || []) {
                if (net.family === 'IPv4' && !net.internal) {
                    if (net.address.startsWith('192.168.') || net.address.startsWith('10.')) {
                        localIp = net.address;
                        break;
                    }
                }
            }
            if (localIp) break;
        }

        // Prioridad 2: Cualquier otra IPv4 no interna
        if (!localIp) {
            for (const name of Object.keys(nets)) {
                for (const net of nets[name] || []) {
                    if (net.family === 'IPv4' && !net.internal) {
                        localIp = net.address;
                        break;
                    }
                }
                if (localIp) break;
            }
        }

        return NextResponse.json({ 
            ip: localIp || '127.0.0.1',
            publicUrl: process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_URL || null
        });
    } catch (err: any) {
        return NextResponse.json({ ip: '127.0.0.1', error: err.message }, { status: 500 });
    }
}
