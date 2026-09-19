import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { classifyProduct } from '@/lib/ai/engine';

// 🐝 COLMENA B2B: Agente Proxy entre Sucursales
// Una sucursal emite la pregunta -> Este agente consulta la base de datos de inventario local (SQLite)
// -> Si no hay coincidencia exacta, usa el motor de IA por Tópicos para buscar en la categoría equivalente -> Responde stock y precio.

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { query, requesterId, topic } = body;

        if (!query || typeof query !== 'string') {
            return NextResponse.json({ found: false, error: 'Consulta inválida' }, { status: 400 });
        }

        console.log(`🐝 [Colmena B2B Agent] Consulta recibida de [${requesterId || 'Sucursal Externa'}]: "${query}"`);

        const cleanQuery = query.toLowerCase().trim();

        // 1️⃣ Búsqueda exacta / directa en SQLite local
        const directMatches = await prisma.product.findMany({
            where: {
                OR: [
                    { name: { contains: cleanQuery } },
                    { barcode: { equals: cleanQuery } },
                    { category: { contains: cleanQuery } }
                ]
            },
            take: 5
        });

        if (directMatches.length > 0) {
            const best = directMatches[0];
            console.log(`🐝 [Colmena B2B Agent] ✅ Coincidencia directa local: ${best.name} (Stock: ${best.stock})`);
            return NextResponse.json({
                found: true,
                matchType: 'direct',
                message: `¡Producto disponible en sucursal!`,
                data: {
                    id: best.id,
                    name: best.name,
                    stock: best.stock,
                    price: best.price,
                    category: best.category || 'General',
                    estante: (best as any).estante || 'A-1'
                },
                matches: directMatches.map(m => ({
                    name: m.name,
                    stock: m.stock,
                    price: m.price
                }))
            });
        }

        // 2️⃣ Búsqueda Semántica vía IA por Tópicos (si no hay match directo)
        const classification = classifyProduct(query);
        if (classification.category && classification.category !== 'General') {
            const categoryMatches = await prisma.product.findMany({
                where: {
                    category: { contains: classification.category }
                },
                take: 5
            });

            if (categoryMatches.length > 0) {
                console.log(`🐝 [Colmena B2B Agent] 💡 Coincidencia semántica (${classification.category}): ${categoryMatches[0].name}`);
                return NextResponse.json({
                    found: true,
                    matchType: 'semantic_topic',
                    topicCategory: classification.category,
                    message: `Encontramos productos equivalentes en la categoría ${classification.category}`,
                    data: {
                        id: categoryMatches[0].id,
                        name: categoryMatches[0].name,
                        stock: categoryMatches[0].stock,
                        price: categoryMatches[0].price,
                        category: categoryMatches[0].category
                    },
                    matches: categoryMatches.map(m => ({
                        name: m.name,
                        stock: m.stock,
                        price: m.price
                    }))
                });
            }
        }

        // 3️⃣ Sin existencias
        console.log(`🐝 [Colmena B2B Agent] ❌ Sin stock local para "${query}"`);
        return NextResponse.json({
            found: false,
            message: 'Sin existencias en esta sucursal',
            data: null
        });

    } catch (error) {
        console.error('🐝 [Colmena B2B Agent] Error procesando consulta proxy:', error);
        return NextResponse.json({ error: 'Fallo en la comunicación del Agente B2B Colmena' }, { status: 500 });
    }
}
