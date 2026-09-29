import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SWARM_SECRET = process.env.INTERNAL_API_SECRET || 'terraform-default-secret-key-123456789';

export async function POST(req: Request) {
    try {
        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${SWARM_SECRET}`) {
            return NextResponse.json({ error: 'No autorizado. Token de Enjambre Inválido.' }, { status: 401 });
        }

        const body = await req.json();
        const { productId, qty, requestingNode } = body;

        if (!productId || !qty || !requestingNode) {
            return NextResponse.json({ error: 'Datos de reserva incompletos.' }, { status: 400 });
        }

        // Transacción Atómica en SQLite
        const result = await prisma.$transaction(async (tx) => {
            const product = await tx.product.findUnique({ where: { id: productId } });
            
            if (!product) {
                throw new Error("Producto no encontrado en el nodo aliado.");
            }

            const stockDisponible = product.stock - product.reservedStock;
            if (stockDisponible < qty) {
                throw new Error(`Stock insuficiente. Solicitado: ${qty}, Disponible: ${stockDisponible}`);
            }

            // 1. Apartar el stock
            await tx.product.update({
                where: { id: productId },
                data: { reservedStock: product.reservedStock + qty }
            });

            // 2. Registrar la Transacción del Enjambre (1% de comisión estimada basada en precio local)
            // En la vida real la ganancia se calcula al concretar la venta
            const commission = (product.price * qty) * 0.01; 
            const expiresAt = new Date(Date.now() + 15 * 60000); // +15 minutos

            const swarmTx = await tx.swarmTransaction.create({
                data: {
                    requestingNode,
                    providingNode: 'mi-nodo-local', // Esto vendrá de AppConfig
                    productId,
                    qty,
                    expiresAt,
                    status: 'RESERVED',
                    commissionEarned: commission
                }
            });

            return { swarmTx, product };
        });

        return NextResponse.json({
            success: true,
            message: 'Stock reservado exitosamente por 15 minutos en la Colmena.',
            transactionId: result.swarmTx.id,
            expiresAt: result.swarmTx.expiresAt
        });

    } catch (error: any) {
        console.error('[AI Swarm] Error al reservar stock:', error);
        return NextResponse.json({ error: error.message || 'Fallo interno en la reserva P2P.' }, { status: 500 });
    }
}
