import { NextResponse } from 'next/server';
import { networkInterfaces } from 'os';

export async function GET() {
    try {
        const nets = networkInterfaces();
        let localIp = '127.0.0.1';

        for (const name of Object.keys(nets)) {
            for (const net of nets[name] || []) {
                if (net.family === 'IPv4' && !net.internal) {
                    localIp = net.address;
                    break;
                }
            }
            if (localIp !== '127.0.0.1') break;
        }

        return NextResponse.json({ ip: localIp });
    } catch (err: any) {
        return NextResponse.json({ ip: '127.0.0.1', error: err.message }, { status: 500 });
    }
}
