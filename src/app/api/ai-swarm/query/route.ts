import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Security token for Swarm P2P (In a real app, this would be validated against a central Hive registry)
const SWARM_SECRET = process.env.INTERNAL_API_SECRET || 'terraform-default-secret-key-123456789';

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${SWARM_SECRET}`) {
            return NextResponse.json({ error: 'No autorizado. Se requiere pase del Enjambre.' }, { status: 401 });
        }

        const body = await req.json();
        const { query, categoryFilter } = body;

        if (!query || typeof query !== 'string') {
            return NextResponse.json({ error: 'Falta el parámetro de búsqueda (query).' }, { status: 400 });
        }

        // Búsqueda difusa en el inventario local (Solo productos con stock > 0)
        let whereClause: any = {
            stock: { gt: 0 },
            OR: [
                { name: { contains: query } },
                { description: { contains: query } }
            ]
        };

        if (categoryFilter) {
            whereClause.category = { contains: categoryFilter };
        }

        const products = await prisma.product.findMany({
            where: whereClause,
            take: 5, // Límite para no exponer todo el catálogo
            select: {
                id: true,
                name: true,
                stock: true,
                category: true,
                estante: true,
                fila: true
                // CRÍTICO: NO EXPORTAMOS PRECIO, COSTO NI RATING
            }
        });

        // Respuesta limpia y estructurada ("Tópico" dinámico)
        return NextResponse.json({
            success: true,
            message: 'Búsqueda en Enjambre completada.',
            results: products
        });

    } catch (error: any) {
        console.error('[AI Swarm] Error consultando nodo:', error);
        return NextResponse.json({ error: 'Fallo interno en el nodo consultado.' }, { status: 500 });
    }
}
