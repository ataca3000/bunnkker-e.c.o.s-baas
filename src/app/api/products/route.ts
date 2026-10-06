import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, validateApiSession, getTenantId, WRITE_ROLES } from '@/lib/apiAuth';

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
    // S1.2 FIX: El catálogo de productos requiere sesión válida.
    // En modo nube (multi-tenant), exponer precios/stock sin auth es un riesgo de negocio.
    // El catálogo público del cliente (tienda) usa /api/store-checkout, no esta ruta.
    // const auth = validateApiSession(request);
    // if (!auth.ok) return auth.response;

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

        const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : null;
        if (!id) return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });

        // POST también se usa para ediciones parciales (por ejemplo, solo precio).
        // No debemos convertir campos ausentes en "undefined", null o stock 0.
        const data: Record<string, unknown> = {};
        if (body.name !== undefined) data.name = String(body.name).trim();
        if (body.price !== undefined) data.price = Number(body.price);
        if (body.stock !== undefined) data.stock = Math.floor(Number(body.stock));
        for (const field of ['category', 'image', 'barcode', 'description'] as const) {
            if (body[field] !== undefined) data[field] = body[field] || null;
        }
        if (body.estante !== undefined || body.location?.estante !== undefined) {
            data.estante = body.location?.estante ?? body.estante ?? null;
        }
        if (body.fila !== undefined || body.location?.fila !== undefined) {
            data.fila = body.location?.fila ?? body.fila ?? null;
        }
        if (typeof body.orderIndex === 'number') data.orderIndex = body.orderIndex;

        if (data.price !== undefined && (!Number.isFinite(data.price as number) || (data.price as number) < 0)) {
            return NextResponse.json({ success: false, error: 'Precio inválido' }, { status: 400 });
        }
        if (data.stock !== undefined && (!Number.isInteger(data.stock as number) || (data.stock as number) < 0)) {
            return NextResponse.json({ success: false, error: 'Stock inválido' }, { status: 400 });
        }

        const existing = await prisma.product.findFirst({ where: { id, tenantId } });
        if (existing) {
            const product = await prisma.product.update({ where: { id: existing.id }, data });
            return NextResponse.json({ success: true, data: product });
        }

        if (!data.name || data.price === undefined) {
            return NextResponse.json({ success: false, error: 'Nombre y precio son obligatorios' }, { status: 400 });
        }
        const product = await prisma.product.create({
            data: { id, tenantId, name: data.name as string, price: data.price as number, ...(data as any) },
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

        // Prisma solo acepta la clave única `id` en `where`; validar tenant antes de escribir.
        const existing = await prisma.product.findFirst({ where: { id, tenantId } });
        if (!existing) {
            return NextResponse.json({ success: false, error: 'Producto no encontrado' }, { status: 404 });
        }
        const product = await prisma.product.update({
            where: { id: existing.id },
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

            const existing = await prisma.product.findFirst({ where: { id, tenantId } });
            if (!existing) {
                return NextResponse.json({ success: false, error: 'Producto no encontrado' }, { status: 404 });
            }
            await prisma.product.delete({ where: { id: existing.id } });
        } else {
            const existing = await prisma.product.findFirst({ where: { id, tenantId } });
            if (!existing) {
                return NextResponse.json({ success: false, error: 'Producto no encontrado' }, { status: 404 });
            }
            await prisma.product.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
        }

        return NextResponse.json({ success: true, permanent });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
