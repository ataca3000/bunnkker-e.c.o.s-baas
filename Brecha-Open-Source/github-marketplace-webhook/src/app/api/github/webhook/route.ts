import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'secret';

async function verifySignature(req: NextRequest, rawBody: string) {
    const signatureHeader = req.headers.get('x-hub-signature-256');
    if (!signatureHeader) return false;

    const signature = crypto.createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
    const expectedSignature = `sha256=${signature}`;
    
    try {
        return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedSignature));
    } catch {
        return false; 
    }
}

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const isValid = await verifySignature(request, rawBody);

        if (!isValid) {
            return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
        }

        const payload = JSON.parse(rawBody);
        const event = request.headers.get('x-github-event');

        // Todo: Connect your database here (e.g. Firebase or Postgres)
        console.log(`[GitHub Webhook] Received Event: ${event}`);

        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: 'Webhook Error' }, { status: 500 });
    }
}
