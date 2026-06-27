import { NextResponse } from 'next/server';
import { adminDb } from '@bunkker/core';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const installationId = searchParams.get('installation_id');

        if (!installationId) {
            return NextResponse.json({ error: 'installation_id es requerido' }, { status: 400 });
        }

        if (!adminDb) {
            return NextResponse.json({ error: 'Error de base de datos' }, { status: 500 });
        }

        // Buscar el registro guardado por nuestro Webhook
        const docRef = adminDb.collection('github_installations').doc(String(installationId));
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            // Devolver 404 permite al frontend hacer polling (reintentar) ya que el webhook puede tardar unos ms en procesar
            return NextResponse.json({ error: 'Instalación no encontrada. Verifica en unos segundos.' }, { status: 404 });
        }

        const data = docSnap.data();
        if (data?.status !== 'active') {
            return NextResponse.json({ error: 'La instalación no está activa' }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            tenantId: data.tenantId,
            domain: data.domain,
            login: data.login
        });

    } catch (error: any) {
        console.error('[Verify API Error]', error);
        return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
    }
}
