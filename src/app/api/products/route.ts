import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, WRITE_ROLES } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';


export async function GET() {
    try {
        const products = await prisma.product.findMany();
        return NextResponse.json({ success: true, data: products });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = requireRole(request, WRITE_ROLES);
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json();
        
        // Limpiar payload para Prisma (evitar 'Unknown arg' errors y floats en Int)
        const prismaData = {
            id: body.id,
            name: String(body.name),
            price: Number(body.price),
            stock: Math.floor(Number(body.stock)), // SQLite schema exige Int
            category: body.category || null,
            image: body.image || null,
            barcode: body.barcode || null,
            description: body.description || null,
            estante: body.location?.estante || body.estante || null,
            fila: body.location?.fila || body.fila || null
        };

        const product = await prisma.product.upsert({
            where: { id: prismaData.id },
            update: prismaData,
            create: prismaData,
        });
        return NextResponse.json({ success: true, data: product });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    const auth = requireRole(request, WRITE_ROLES);
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json();
        const { id, stockIncrement, estante, fila } = body;
        
        if (!id) {
            throw new Error('id is required');
        }

        const dataToUpdate: any = {};
        if (typeof stockIncrement === 'number') {
            dataToUpdate.stock = { increment: stockIncrement };
        }
        if (estante !== undefined) dataToUpdate.estante = estante;
        if (fila !== undefined) dataToUpdate.fila = fila;
        // BUG-SYNC-1 FIX: Aceptar orderIndex para persistir el orden del drag & drop
        if (typeof body.orderIndex === 'number') dataToUpdate.orderIndex = body.orderIndex;

        const product = await prisma.product.update({
            where: { id },
            data: dataToUpdate
        });
        return NextResponse.json({ success: true, data: product });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const auth = requireRole(request, ['superadmin', 'inventory']);
    if (!auth.ok) return auth.response;

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        
        if (!id) throw new Error('Product ID is required');

        await prisma.product.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
