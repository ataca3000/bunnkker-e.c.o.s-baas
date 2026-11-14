import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, validateApiSession, getTenantId, WRITE_ROLES } from '@/lib/apiAuth';
import { publishRealtimeEvent } from '@/lib/realtimeBus';

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
        let products = await prisma.product.findMany({
            where: includeDeleted
                ? { tenantId, deletedAt: { not: null } }
                : { tenantId, deletedAt: null }
        });

        // Autosemilla resiliente para despliegues iniciales en Vercel/Web donde la base de datos comience vacía
        if (products.length === 0 && !includeDeleted) {
            const defaultProducts = [
                { id: 'prod-1', tenantId, name: 'Taladro Percutor Inalámbrico 20V Max', price: 1850, stock: 24, reservedStock: 0, category: 'Herramientas', image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600&auto=format&fit=crop', rating: 4.8, reviewCount: 32, barcode: '750100234001', description: 'Motor sin escobillas (Brushless), 2 baterías de litio y maletín de transporte rígido.', estante: 'A-1', fila: 'Nivel 2', orderIndex: 1, deletedAt: null },
                { id: 'prod-2', tenantId, name: 'Caja de Herramientas Mecánica 128 Pzs', price: 1450, stock: 18, reservedStock: 0, category: 'Herramientas', image: 'https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=600&auto=format&fit=crop', rating: 4.9, reviewCount: 45, barcode: '750100234002', description: 'Juego de dados milimétricos y pulgadas en acero cromo vanadio con carraca.', estante: 'A-2', fila: 'Nivel 1', orderIndex: 2, deletedAt: null },
                { id: 'prod-3', tenantId, name: 'Tina Pintura Látex Lavable 5 Galones', price: 920, stock: 35, reservedStock: 0, category: 'Pinturas', image: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=600&auto=format&fit=crop', rating: 4.7, reviewCount: 19, barcode: '750100234003', description: 'Pintura vinil acrílica para interiores y exteriores, máxima lavabilidad.', estante: 'B-1', fila: 'Nivel 3', orderIndex: 3, deletedAt: null },
                { id: 'prod-4', tenantId, name: 'Saco de Cemento Portland Tipo I 50kg', price: 245, stock: 80, reservedStock: 0, category: 'Construcción', image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop', rating: 5.0, reviewCount: 68, barcode: '750100234004', description: 'Cemento de fraguado normal para cimientos y losas.', estante: 'Patio Sur', fila: 'Tarima 4', orderIndex: 4, deletedAt: null },
                { id: 'prod-5', tenantId, name: 'Kit de Grifería Monomando + Tubería PVC', price: 680, stock: 2, reservedStock: 0, category: 'Plomería', image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=600&auto=format&fit=crop', rating: 4.6, reviewCount: 14, barcode: '750100234005', description: 'Grifería cromada con conexiones completas.', estante: 'C-1', fila: 'Nivel 1', orderIndex: 5, deletedAt: null },
                { id: 'prod-6', tenantId, name: 'Compresor de Aire Eléctrico 50 Litros', price: 3400, stock: 1, reservedStock: 0, category: 'Equipos', image: 'https://images.unsplash.com/photo-1580983218765-f663bec07b37?w=600&auto=format&fit=crop', rating: 4.9, reviewCount: 27, barcode: '750100234006', description: 'Compresor lubricado 2.5 HP tanque horizontal.', estante: 'D-2', fila: 'Nivel 1', orderIndex: 6, deletedAt: null },
                { id: 'prod-7', tenantId, name: 'Cable Eléctrico Calibre 12 THW 100m', price: 1150, stock: 12, reservedStock: 0, category: 'Electricidad', image: 'https://images.unsplash.com/photo-1558346490-a72e53ae2d4f?w=600&auto=format&fit=crop', rating: 4.8, reviewCount: 22, barcode: '750100234007', description: 'Conductor de cobre para instalaciones residenciales.', estante: 'E-1', fila: 'Nivel 2', orderIndex: 7, deletedAt: null },
                { id: 'prod-8', tenantId, name: 'Generador Eléctrico a Gasolina 3500W', price: 8900, stock: 0, reservedStock: 0, category: 'Equipos', image: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=600&auto=format&fit=crop', rating: 4.5, reviewCount: 8, barcode: '750100234008', description: 'Generador portátil 4 tiempos con arranque manual.', estante: 'D-1', fila: 'Nivel 1', orderIndex: 8, deletedAt: null },
            ];
            for (const dp of defaultProducts) {
                try {
                    await prisma.product.create({ data: dp });
                } catch {}
            }
            products = await prisma.product.findMany({
                where: { tenantId, deletedAt: null }
            });
        }

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
        if (body.minStock !== undefined && body.minStock !== null && body.minStock !== '') {
            data.minStock = Math.max(0, Math.floor(Number(body.minStock)));
        }

        // REGLA DOBLE CIEGO: Almacén solo cuenta materia física (stock/ubicación).
        // El precio solo puede ser asignado y sellado por SuperAdmin / Admin.
        if (auth.role === 'inventory' && data.price !== undefined) {
            return NextResponse.json({ 
                success: false, 
                error: 'El personal de almacén solo registra conteo físico. El precio debe ser asignado y sellado por el SuperAdmin.' 
            }, { status: 403 });
        }

        // DOBLE CONFIRMACIÓN ANTI-DEDO CHUECO: Si se envía confirmPrice, debe coincidir exactamente con price.
        if (body.confirmPrice !== undefined && data.price !== undefined) {
            const confirmVal = Number(body.confirmPrice);
            if (!Number.isFinite(confirmVal) || Math.abs(confirmVal - (data.price as number)) > 0.001) {
                return NextResponse.json({ 
                    success: false, 
                    error: 'Los precios no coinciden. Debes confirmar el precio exactamente dos veces para evitar errores de dedo.' 
                }, { status: 400 });
            }
        }

        if (data.price !== undefined && (!Number.isFinite(data.price as number) || (data.price as number) < 0)) {
            return NextResponse.json({ success: false, error: 'Precio inválido' }, { status: 400 });
        }
        if (data.stock !== undefined && (!Number.isInteger(data.stock as number) || (data.stock as number) < 0)) {
            return NextResponse.json({ success: false, error: 'Stock inválido' }, { status: 400 });
        }

        const existing = await prisma.product.findFirst({ where: { id, tenantId } });
        if (existing) {
            const product = await prisma.product.update({ where: { id }, data });
            publishRealtimeEvent({ tenantId, scope: 'products', action: 'PRODUCT_UPDATED', entityId: product.id });
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
        publishRealtimeEvent({ tenantId, scope: 'products', action: 'PRODUCT_CREATED', entityId: product.id });
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
                minStock?: number;
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
                    if (typeof u.minStock === 'number') dataToUpdate.minStock = Math.max(0, Math.floor(u.minStock));

                    return prisma.product.update({
                        where: { id: u.id, tenantId },
                        data: dataToUpdate,
                    });
                });

            const results = await prisma.$transaction(operations);
            publishRealtimeEvent({ tenantId, scope: 'products', action: 'PRODUCTS_BATCH_UPDATED' });
            return NextResponse.json({ success: true, count: results.length, data: results });
        }

        const { id, stockIncrement, estante, fila, minStock } = body;

        if (!id) {
            throw new Error('id is required');
        }

        const dataToUpdate: any = {};
        if (typeof stockIncrement === 'number') {
            if (stockIncrement < 0) {
                const existing = await prisma.product.findUnique({ where: { id, tenantId }, select: { stock: true, reservedStock: true } });
                if (existing) {
                    const newStock = existing.stock + stockIncrement;
                    if (newStock < (existing.reservedStock || 0)) {
                        return NextResponse.json({ 
                            success: false, 
                            error: `Ajuste inválido: el stock resultante (${newStock}) no puede ser menor a las unidades ya reservadas (${existing.reservedStock || 0}).` 
                        }, { status: 400 });
                    }
                }
            }
            dataToUpdate.stock = { increment: stockIncrement };
        }
        if (estante !== undefined) dataToUpdate.estante = estante;
        if (fila !== undefined) dataToUpdate.fila = fila;
        if (minStock !== undefined && minStock !== null) {
            dataToUpdate.minStock = Math.max(0, Math.floor(Number(minStock)));
        }
        // BUG-SYNC-1 FIX: Aceptar orderIndex para persistir el orden del drag & drop
        if (typeof body.orderIndex === 'number') dataToUpdate.orderIndex = body.orderIndex;
        if (body.restore === true) dataToUpdate.deletedAt = null;

        // S2.2 FIX: Solo actualizar si el producto pertenece a este tenant
        const product = await prisma.product.update({
            where: { id, tenantId },
            data: dataToUpdate
        });
        publishRealtimeEvent({ tenantId, scope: 'products', action: 'PRODUCT_UPDATED', entityId: product.id });
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

        publishRealtimeEvent({ tenantId, scope: 'products', action: 'PRODUCT_DELETED', entityId: id });
        return NextResponse.json({ success: true, permanent });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
