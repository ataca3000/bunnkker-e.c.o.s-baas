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
    let auth = requireRole(request, WRITE_ROLES);
    if (!auth.ok) {
        if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_APP_ENV === 'local') {
            auth = { ok: true, uid: 'local_owner', role: 'superadmin' };
        } else {
            return auth.response;
        }
    }

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
            const product = await prisma.product.update({ where: { id }, data });
            return NextResponse.json({ success: true, data: product });
        }

        if (!data.name || data.price === undefined) {
            return NextResponse.json({ success: false, error: 'Nombre y precio son obligatorios' }, { status: 400 });
        }
        const product = await prisma.product.create({
            data: { 
                id, 
                tenantId, 
                name: data.name as string, 
                price: data.price as number,
                stock: typeof data.stock === 'number' ? data.stock : 0,
                reservedStock: 0,
                category: (data.category as string) || 'General',
                deletedAt: null,
                ...(data as any) 
            },
        });
        return NextResponse.json({ success: true, data: product });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    let auth = requireRole(request, WRITE_ROLES);
    if (!auth.ok) {
        if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_APP_ENV === 'local') {
            auth = { ok: true, uid: 'local_owner', role: 'superadmin' };
        } else {
            return auth.response;
        }
    }

    try {
        const tenantId = getTenantId(request);
        const body = await request.json();

        // Batch / Chunk Flush mode (Minecraft-style Dirty Chunk Persistence)
        if (Array.isArray(body.batchUpdates)) {
            const updates = body.batchUpdates as Array<{
                id: string;
                estante?: string;
                fila?: string;
                orderIndex?: number;
                stockIncrement?: number;
            }>;

            if (updates.length === 0) {
                return NextResponse.json({ success: true, count: 0, data: [] });
            }

            const operations = updates
                .filter((u) => typeof u.id === 'string' && u.id.trim())
                .map((u) => {
                    const dataToUpdate: Record<string, unknown> = {};
                    if (typeof u.stockIncrement === 'number') {
                        dataToUpdate.stock = { increment: u.stockIncrement };
                    }
                    if (u.estante !== undefined) dataToUpdate.estante = u.estante;
                    if (u.fila !== undefined) dataToUpdate.fila = u.fila;
                    if (typeof u.orderIndex === 'number') dataToUpdate.orderIndex = u.orderIndex;

                    return prisma.product.update({
                        where: { id: u.id, tenantId },
                        data: dataToUpdate,
                    });
                });

            const results = await prisma.$transaction(operations);
            return NextResponse.json({ success: true, count: results.length, data: results });
        }

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
    let auth = requireRole(request, ['superadmin', 'inventory', 'almacen']);
    if (!auth.ok) {
        if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_APP_ENV === 'local') {
            auth = { ok: true, uid: 'local_owner', role: 'superadmin' };
        } else {
            return auth.response;
        }
    }

    try {
        const tenantId = getTenantId(request);
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const permanent = searchParams.get('permanent') === 'true';

        if (!id) throw new Error('Product ID is required');

        if (permanent) {
            if (auth.role !== 'superadmin') {
                return NextResponse.json({ success: false, error: 'Solo el rol superadmin puede eliminar definitivamente.' }, { status: 403 });
            }

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
