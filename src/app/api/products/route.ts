import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, validateApiSession, getTenantId, WRITE_ROLES } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
    // S1.2 FIX: El catálogo de productos requiere sesión válida.
    // En modo nube (multi-tenant), exponer precios/stock sin auth es un riesgo de negocio.
    // El catálogo público del cliente (tienda) usa /api/store-checkout, no esta ruta.
    const auth = validateApiSession(request);
    if (!auth.ok) return auth.response;

    try {
        // S2.2 FIX: Filtrar siempre por tenantId para aislar datos entre clientes.
        const tenantId = getTenantId(request);
        const includeDeleted = new URL(request.url).searchParams.get('includeDeleted') === 'true';
        const products = await prisma.product.findMany({
            where: includeDeleted
                ? { tenantId, deletedAt: { not: null } }
                : { tenantId, deletedAt: null }
        });
        return NextResponse.json({ success: true, data: products });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = requireRole(request, WRITE_ROLES);
    if (!auth.ok) return auth.response;

    try {
        const tenantId = getTenantId(request);
        const body = await request.json();

        // Limpiar payload para Prisma (evitar 'Unknown arg' errors y floats en Int)
        const prismaData = {
            id: body.id,
            tenantId,
            name: String(body.name),
            price: Number(body.price),
            stock: Math.floor(Number(body.stock)), // SQLite schema exige Int
            category: body.category || null,
            image: body.image || null,
            barcode: body.barcode || null,
            description: body.description || null,
            estante: body.location?.estante || body.estante || null,
            fila: body.location?.fila || body.fila || null,
            orderIndex: typeof body.orderIndex === 'number' ? body.orderIndex : 0
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
        const tenantId = getTenantId(request);
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
        if (body.restore === true) dataToUpdate.deletedAt = null;

        // S2.2 FIX: Solo actualizar si el producto pertenece a este tenant
        const product = await prisma.product.update({
            where: { id, tenantId },
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
        const tenantId = getTenantId(request);
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const permanent = searchParams.get('permanent') === 'true';

        if (!id) throw new Error('Product ID is required');

        if (permanent) {
            const adminAuth = requireRole(request, ['superadmin']);
            if (!adminAuth.ok) return adminAuth.response;

            const historicalItems = await prisma.orderItem.count({ where: { productId: id } });
            if (historicalItems > 0) {
                return NextResponse.json({
                    success: false,
                    error: 'Este producto tiene ventas históricas. Puedes mantenerlo en la papelera, pero no borrarlo definitivamente.'
                }, { status: 409 });
            }

            // S2.2 FIX: Solo borrar si pertenece a este tenant
            await prisma.product.delete({ where: { id, tenantId } });
        } else {
            await prisma.product.update({ where: { id, tenantId }, data: { deletedAt: new Date() } });
        }

        return NextResponse.json({ success: true, permanent });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
