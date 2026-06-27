import { NextRequest, NextResponse } from 'next/server';
import { validateApiSession } from '@/lib/apiAuth';
import Facturapi from 'facturapi';
import { auth } from '@/lib/firebase-admin';

import { db } from '@/lib/firebase-admin';

async function getFacturapiKey() {
    const secretSnap = await db.collection('secrets').doc('billing').get();
    if (secretSnap.exists) {
        return secretSnap.data()?.facturapi_key;
    }
    return null;
}

export async function GET(req: NextRequest) {
    const sessionAuth = validateApiSession(req);
    if (!sessionAuth.ok) return sessionAuth.response;
    try {
        // 1. Verificación de identidad
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        const idToken = authHeader.split('Bearer ')[1];
        await auth.verifyIdToken(idToken);

        // 2. Obtener parámetros
        const { searchParams } = new URL(req.url);
        const invoiceId = searchParams.get('id');
        const fileType = searchParams.get('type') || 'pdf';

        if (!invoiceId) {
            return NextResponse.json({ error: 'ID de factura requerido' }, { status: 400 });
        }

        // 3. Obtener archivo de Facturapi
        const apiKey = await getFacturapiKey();
        if (!apiKey) {
            return NextResponse.json({ error: 'Facturapi no configurado' }, { status: 503 });
        }

        const facturapi = new Facturapi(apiKey);

        let fileStream;
        let contentType: string;
        let fileName: string;

        if (fileType === 'xml') {
            fileStream = await facturapi.invoices.downloadXml(invoiceId);
            contentType = 'application/xml';
            fileName = `factura_${invoiceId}.xml`;
        } else {
            fileStream = await facturapi.invoices.downloadPdf(invoiceId);
            contentType = 'application/pdf';
            fileName = `factura_${invoiceId}.pdf`;
        }

        // 4. Convertir stream a buffer
        const chunks: Uint8Array[] = [];
        for await (const chunk of fileStream as any) {
            chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk);
        }
        const buffer = Buffer.concat(chunks);

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${fileName}"`,
            },
        });
    } catch (error: any) {
        console.error('Error descargando factura:', error);
        return NextResponse.json(
            { error: error.message || 'Error al descargar factura' },
            { status: 500 }
        );
    }
}
