import { NextResponse } from 'next/server';

// 🐝 COLMENA B2B: Endpoint del Túnel
// Este endpoint es expuesto por el túnel (localtunnel/cloudflared) 
// para que otras tiendas pregunten por inventario.

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { topic, query, requesterId } = body;

        console.log(`[Colmena B2B] Consulta recibida de ${requesterId} buscando: ${query}`);

        // TODO: (Simbiosis LFEDS) Aquí conectaremos con la lógica de Tópicos/Excel local.
        // Por ahora, devolvemos un mock estructurado para probar el túnel sin fallos.
        const mockResponse: { found: boolean; message: string; data: any } = {
            found: false,
            message: "Módulo de búsqueda local en construcción",
            data: null
        };

        // Simulación: Si preguntan por 'martillo', decimos que sí tenemos
        if (query && query.toLowerCase().includes('martillo')) {
            mockResponse.found = true;
            mockResponse.message = "¡Sí tenemos!";
            mockResponse.data = { stock: 5, price: 150.00 };
        }

        return NextResponse.json(mockResponse);
    } catch (error) {
        console.error('[Colmena B2B] Error procesando consulta externa:', error);
        return NextResponse.json({ error: 'Fallo en la comunicación B2B' }, { status: 500 });
    }
}
