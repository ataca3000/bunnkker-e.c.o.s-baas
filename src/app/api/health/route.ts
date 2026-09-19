import { NextResponse } from 'next/server';
import os from 'os';

export async function GET() {
    try {
        const interfaces = os.networkInterfaces();
        let localIp = '127.0.0.1';

        for (const devName in interfaces) {
            const iface = interfaces[devName];
            if (!iface) continue;

            for (let i = 0; i < iface.length; i++) {
                const alias = iface[i];
                if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                    localIp = alias.address;
                    break;
                }
            }
        }

        return NextResponse.json({
            success: true,
            status: 'online',
            serverName: 'BUNKKER Main Server',
            serverTime: Date.now(),
            localIp,
            uptime: Math.floor(process.uptime()),
        });
    } catch (error) {
        return NextResponse.json({
            success: true,
            status: 'online',
            serverName: 'BUNKKER Main Server',
            serverTime: Date.now(),
            localIp: '127.0.0.1',
            uptime: 0,
        });
    }
}
