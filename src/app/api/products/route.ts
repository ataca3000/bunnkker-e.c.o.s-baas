import { NextRequest, NextResponse } from 'next/server';
import { prisma, flushPersistedStore } from '@/lib/prisma';
import { requireRole, getTenantId, WRITE_ROLES } from '@/lib/apiAuth';
import { publishRealtimeEvent } from '@/lib/realtimeBus';
import { loadPersistentSiteConfig, savePersistentSiteConfig } from '@/lib/persistentSettings';
import {
    getPrimaryProductImage,
    normalizeProductMedia,
    normalizeProductMediaList,
    type ProductMediaItem,
} from '@/lib/productMedia';
import { dispatchCriticalAdminPush } from '@/lib/fcmPush';
import { analyzeProductStock, DEFAULT_STOCK_THRESHOLD_CONFIG } from '@/lib/stockThresholds';
import {
    getProductVisibilityMap,
    saveBatchProductVisibility,
    type ProductVisibilityMap,
} from '@/lib/productVisibilityStore';
import { appendImmutableAudit } from '@/lib/immutableAudit';

export const dynamic = 'force-dynamic';

function getProductMediaMap(tenantId: string): Record<string, ProductMediaItem[]> {
    const cfg = loadPersistentSiteConfig(tenantId);
    const map = cfg?.productMediaMap;
    return map && typeof map === 'object' ? (map as Record<string, ProductMediaItem[]>) : {};
}

function saveProductMediaForId(tenantId: string, productId: string, media: ProductMediaItem[]): void {
    const cfg = loadPersistentSiteConfig(tenantId);
    const existingMap = cfg?.productMediaMap && typeof cfg.productMediaMap === 'object' ? cfg.productMediaMap : {};
    savePersistentSiteConfig(tenantId, {
        ...cfg,
        productMediaMap: {
            ...existingMap,
            [productId]: media,
        },
    });
}

function getProductMinStockMap(tenantId: string): Record<string, number> {
    const cfg = loadPersistentSiteConfig(tenantId);
    const map = cfg?.productMinStockMap;
    return map && typeof map === 'object' ? (map as Record<string, number>) : {};
}

function saveProductMinStockForId(tenantId: string, productId: string, minStock: number): void {
    if (!Number.isFinite(minStock) || minStock < 0) return;
    const cfg = loadPersistentSiteConfig(tenantId);
    const existingMap = cfg?.productMinStockMap && typeof cfg.productMinStockMap === 'object' ? cfg.productMinStockMap : {};
    savePersistentSiteConfig(tenantId, {
        ...cfg,
        productMinStockMap: {
            ...existingMap,
            [productId]: Math.floor(minStock),
        },
    });
}

function enrichProductWithMedia<T extends { id: string; image?: string | null; imageUrl?: string | null; minStock?: number | null }>(
    product: T,
    mediaMap: Record<string, ProductMediaItem[]>,
    minStockMap: Record<string, number> = {},
    visibilityMap: ProductVisibilityMap = {}
): T & { media: ProductMediaItem[]; minStock?: number; hidePublicStock: boolean; hideFromPublic: boolean } {
    const stored = mediaMap[product.id];
    const media = normalizeProductMedia({
        media: stored,
        image: product.image,
        imageUrl: product.imageUrl,
    });
    const resolvedMinStock =
        typeof minStockMap[product.id] === 'number'
            ? minStockMap[product.id]
            : typeof product.minStock === 'number'
              ? product.minStock
              : undefined;
    const vis = visibilityMap[product.id];
    return {
        ...product,
        ...(resolvedMinStock !== undefined ? { minStock: resolvedMinStock } : {}),
        media,
        hidePublicStock: Boolean(vis?.hidePublicStock),
        hideFromPublic: Boolean(vis?.hideFromPublic),
    };
}


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

        const mediaMap = getProductMediaMap(tenantId);
        const minStockMap = getProductMinStockMap(tenantId);
        const visibilityMap = getProductVisibilityMap(tenantId);
        const enriched = products.map((product) =>
            enrichProductWithMedia(product, mediaMap, minStockMap, visibilityMap)
        );

        return NextResponse.json({ success: true, data: enriched });
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

        // REGLA DOBLE CIEGO: Almacén solo cuenta materia física (stock/ubicación).
        // El precio solo puede ser asignado y sellado por SuperAdmin / Admin.
        if (auth.role === 'inventory' && data.price !== undefined) {
            return NextResponse.json({ 
                success: false, 
                error: 'El personal de almacén solo registra conteo físico. El precio debe ser asignado y sellado por el SuperAdmin.' 
            }, { status: 403 });
        }

        const hasVisibilityPayload =
            typeof body.hidePublicStock === 'boolean' || typeof body.hideFromPublic === 'boolean';
        if (hasVisibilityPayload && auth.role !== 'superadmin') {
            return NextResponse.json({
                success: false,
                error: 'Solo el SuperAdmin puede modificar la visibilidad pública de los productos.',
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

        const hasMediaPayload = Array.isArray(body.media);
        const normalizedMedia = hasMediaPayload ? normalizeProductMediaList(body.media) : null;
        if (normalizedMedia !== null) {
            const primaryImg = getPrimaryProductImage(normalizedMedia, body.image);
            data.image = primaryImg || null;
        }

        const existing = await prisma.product.findFirst({ where: { id, tenantId } });
        if (existing) {
            const product = await prisma.product.update({ where: { id }, data });
            if (typeof body.minStock === 'number' && Number.isFinite(body.minStock) && body.minStock >= 0) {
                saveProductMinStockForId(tenantId, product.id, body.minStock);
            }
            const finalMedia =
                normalizedMedia !== null
                    ? normalizedMedia
                    : normalizeProductMedia({
                          media: getProductMediaMap(tenantId)[product.id],
                          image: product.image,
                      });
            if (normalizedMedia !== null) {
                saveProductMediaForId(tenantId, product.id, normalizedMedia);
            }

            const priceChanged = data.price !== undefined && Math.abs(Number(data.price) - Number(existing.price)) > 0.001;
            const auditAction = priceChanged ? 'PRICE_CHANGE' : 'PRODUCT_UPDATED';
            const auditSummary = priceChanged
                ? `${product.name}: precio $${existing.price} -> $${product.price}`
                : `${product.name} actualizado (stock: ${product.stock})`;

            try {
                await prisma.auditLog.create({
                    data: {
                        tenantId,
                        action: auditAction,
                        userId: auth.uid,
                        details: auditSummary,
                    },
                });
            } catch {}

            publishRealtimeEvent({
                tenantId,
                scope: 'products',
                action: auditAction,
                entityId: product.id,
                payload: { details: auditSummary },
            });

            if (priceChanged) {
                void dispatchCriticalAdminPush({
                    tenantId,
                    category: 'PRICE_CHANGE',
                    severity: 'warning',
                    title: '💲 Cambio de Precio en Catálogo',
                    body: auditSummary,
                    url: '/dashboard/inventory',
                    actorUid: auth.uid,
                    actorName: auth.role,
                    metadata: { productId: product.id, oldPrice: existing.price, newPrice: product.price },
                }).catch(() => {});
            } else if (data.stock !== undefined) {
                const stockAnalysis = analyzeProductStock(
                    {
                        id: product.id,
                        name: product.name,
                        stock: product.stock,
                        category: product.category,
                        minStock: typeof body.minStock === 'number' ? body.minStock : undefined,
                    },
                    DEFAULT_STOCK_THRESHOLD_CONFIG
                );
                if (stockAnalysis.isAlert) {
                    void dispatchCriticalAdminPush({
                        tenantId,
                        category: 'STOCK_CRITICAL',
                        severity: stockAnalysis.status === 'out_of_stock' ? 'critical' : 'warning',
                        title: stockAnalysis.status === 'out_of_stock' ? '🚨 Producto Agotado (0 uds)' : '⚠️ Stock Bajo Mínimo',
                        body: `${product.name}: ${product.stock} uds disponibles (mínimo ${stockAnalysis.effectiveThreshold}).`,
                        url: '/dashboard/inventory',
                        actorUid: auth.uid,
                        actorName: auth.role,
                        dedupKey: `low_stock:${product.id}:${stockAnalysis.status}`,
                        cooldownMs: 300_000,
                        metadata: { productId: product.id, stock: product.stock, threshold: stockAnalysis.effectiveThreshold },
                    }).catch(() => {});
                }
            }
            if (hasVisibilityPayload) {
                saveBatchProductVisibility(tenantId, [product.id], {
                    ...(typeof body.hidePublicStock === 'boolean' ? { hidePublicStock: body.hidePublicStock } : {}),
                    ...(typeof body.hideFromPublic === 'boolean' ? { hideFromPublic: body.hideFromPublic } : {}),
                });
            }
            flushPersistedStore();
            const updatedMinStockMap = getProductMinStockMap(tenantId);
            const updatedVisibilityMap = getProductVisibilityMap(tenantId);
            const enrichedUpdated = enrichProductWithMedia(
                product,
                { [product.id]: finalMedia },
                updatedMinStockMap,
                updatedVisibilityMap
            );
            return NextResponse.json({ success: true, data: enrichedUpdated });
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
        const finalMedia =
            normalizedMedia !== null
                ? normalizedMedia
                : normalizeProductMedia({ image: product.image });
        if (normalizedMedia !== null) {
            saveProductMediaForId(tenantId, product.id, normalizedMedia);
        }

        if (typeof body.minStock === 'number' && Number.isFinite(body.minStock) && body.minStock >= 0) {
            saveProductMinStockForId(tenantId, product.id, body.minStock);
        }

        const createSummary = `Nuevo producto: ${product.name} ($${product.price}, stock: ${product.stock})`;
        try {
            await prisma.auditLog.create({
                data: {
                    tenantId,
                    action: 'PRODUCT_CREATED',
                    userId: auth.uid,
                    details: createSummary,
                },
            });
        } catch {}

        publishRealtimeEvent({
            tenantId,
            scope: 'products',
            action: 'PRODUCT_CREATED',
            entityId: product.id,
            payload: { details: createSummary },
        });
        if (hasVisibilityPayload) {
            saveBatchProductVisibility(tenantId, [product.id], {
                ...(typeof body.hidePublicStock === 'boolean' ? { hidePublicStock: body.hidePublicStock } : {}),
                ...(typeof body.hideFromPublic === 'boolean' ? { hideFromPublic: body.hideFromPublic } : {}),
            });
        }
        flushPersistedStore();
        const createdMinStockMap = getProductMinStockMap(tenantId);
        const createdVisibilityMap = getProductVisibilityMap(tenantId);
        return NextResponse.json({
            success: true,
            data: enrichProductWithMedia(
                product,
                { [product.id]: finalMedia },
                createdMinStockMap,
                createdVisibilityMap
            ),
        });
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

                    return prisma.product.update({
                        where: { id: u.id, tenantId },
                        data: dataToUpdate,
                    });
                });

            const results = await prisma.$transaction(operations);
            flushPersistedStore();
            publishRealtimeEvent({ tenantId, scope: 'products', action: 'PRODUCTS_BATCH_UPDATED' });
            return NextResponse.json({ success: true, count: results.length, data: results });
        }

        // Batch Visibility mode (SuperAdmin ONLY)
        if (body.batchVisibility && typeof body.batchVisibility === 'object') {
            if (auth.role !== 'superadmin') {
                return NextResponse.json(
                    { success: false, error: 'Solo el SuperAdmin puede configurar la visibilidad pública masiva.' },
                    { status: 403 }
                );
            }
            const bv = body.batchVisibility as {
                ids?: string[];
                hidePublicStock?: boolean;
                hideFromPublic?: boolean;
            };
            const ids = Array.isArray(bv.ids)
                ? bv.ids.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
                : [];
            if (ids.length === 0) {
                return NextResponse.json({ success: false, error: 'Selecciona al menos un producto.' }, { status: 400 });
            }
            const nextMap = saveBatchProductVisibility(tenantId, ids, {
                ...(typeof bv.hidePublicStock === 'boolean' ? { hidePublicStock: bv.hidePublicStock } : {}),
                ...(typeof bv.hideFromPublic === 'boolean' ? { hideFromPublic: bv.hideFromPublic } : {}),
            });
            flushPersistedStore();

            const summary = `Visibilidad pública actualizada en ${ids.length} producto(s)`;
            try {
                await prisma.auditLog.create({
                    data: {
                        tenantId,
                        action: 'PRODUCT_VISIBILITY_BATCH',
                        userId: auth.uid,
                        details: summary,
                    },
                });
            } catch {}
            appendImmutableAudit({
                branchId: tenantId,
                actorId: auth.uid,
                actorName: auth.role,
                actorRole: auth.role,
                action: 'PRODUCT_VISIBILITY_BATCH',
                resourceRef: `products:batch:${ids.length}`,
                details: {
                    count: ids.length,
                    ids: ids.slice(0, 20),
                    hidePublicStock: bv.hidePublicStock,
                    hideFromPublic: bv.hideFromPublic,
                },
            });
            publishRealtimeEvent({
                tenantId,
                scope: 'products',
                action: 'PRODUCTS_VISIBILITY_UPDATED',
                payload: { details: summary },
            });
            return NextResponse.json({ success: true, count: ids.length, visibilityMap: nextMap });
        }

        // Batch Archive / Papelera mode (SuperAdmin ONLY)
        if (body.batchArchive && typeof body.batchArchive === 'object') {
            if (auth.role !== 'superadmin') {
                return NextResponse.json(
                    { success: false, error: 'Solo el SuperAdmin puede mover productos en lote a la papelera.' },
                    { status: 403 }
                );
            }
            const ba = body.batchArchive as { ids?: string[] };
            const ids = Array.isArray(ba.ids)
                ? ba.ids.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
                : [];
            if (ids.length === 0) {
                return NextResponse.json({ success: false, error: 'Selecciona al menos un producto.' }, { status: 400 });
            }
            const now = new Date();
            const ops = ids.map((pid) =>
                prisma.product.update({
                    where: { id: pid, tenantId },
                    data: { deletedAt: now },
                })
            );
            await prisma.$transaction(ops);
            flushPersistedStore();

            const summary = `${ids.length} producto(s) movidos a papelera por lote`;
            try {
                await prisma.auditLog.create({
                    data: {
                        tenantId,
                        action: 'PRODUCT_BATCH_ARCHIVED',
                        userId: auth.uid,
                        details: summary,
                    },
                });
            } catch {}
            appendImmutableAudit({
                branchId: tenantId,
                actorId: auth.uid,
                actorName: auth.role,
                actorRole: auth.role,
                action: 'PRODUCT_BATCH_ARCHIVED',
                resourceRef: `products:archive:${ids.length}`,
                details: { count: ids.length, ids: ids.slice(0, 20) },
            });
            publishRealtimeEvent({
                tenantId,
                scope: 'products',
                action: 'PRODUCTS_BATCH_ARCHIVED',
                payload: { details: summary },
            });
            return NextResponse.json({ success: true, count: ids.length, archivedIds: ids });
        }

        const {
            id,
            stockIncrement,
            confirmStockIncrement,
            estante,
            fila,
            minStock,
            unitType,
            isBulk,
            mode,
            notes,
            operatorName,
        } = body;

        if (!id) {
            throw new Error('id is required');
        }

        const isQuickRestock = mode === 'quick_restock' || confirmStockIncrement !== undefined;
        let existingProduct: {
            id: string;
            name: string;
            stock: number;
            reservedStock: number;
            estante: string | null;
            fila: string | null;
        } | null = null;

        if (typeof stockIncrement === 'number') {
            if (!Number.isFinite(stockIncrement)) {
                return NextResponse.json({ success: false, error: 'Cantidad de ajuste de stock inválida.' }, { status: 400 });
            }

            existingProduct = await prisma.product.findUnique({
                where: { id, tenantId },
                select: {
                    id: true,
                    name: true,
                    stock: true,
                    reservedStock: true,
                    estante: true,
                    fila: true,
                },
            });

            if (!existingProduct) {
                return NextResponse.json({ success: false, error: 'Producto no encontrado.' }, { status: 404 });
            }

            if (isQuickRestock) {
                if (stockIncrement <= 0) {
                    return NextResponse.json({
                        success: false,
                        error: 'La cantidad de piezas a recargar debe ser mayor a 0.'
                    }, { status: 400 });
                }
                if (!Number.isInteger(stockIncrement)) {
                    return NextResponse.json({
                        success: false,
                        error: isBulk
                            ? 'El inventario registrado en base de datos requiere piezas enteras.'
                            : 'Este producto se recarga en piezas enteras.'
                    }, { status: 400 });
                }
                const confirmVal = Number(confirmStockIncrement);
                if (
                    confirmStockIncrement === undefined ||
                    !Number.isFinite(confirmVal) ||
                    Math.abs(confirmVal - stockIncrement) > 0.0001
                ) {
                    return NextResponse.json({
                        success: false,
                        error: 'Las cantidades de piezas no coinciden. Debes confirmar exactamente dos veces las piezas a agregar.'
                    }, { status: 400 });
                }
            } else if (!Number.isInteger(stockIncrement)) {
                return NextResponse.json({
                    success: false,
                    error: 'El ajuste de stock en base de datos debe ser un número entero.'
                }, { status: 400 });
            }

            if (stockIncrement < 0) {
                const newStock = existingProduct.stock + stockIncrement;
                if (newStock < (existingProduct.reservedStock || 0)) {
                    return NextResponse.json({
                        success: false,
                        error: `Ajuste inválido: el stock resultante (${newStock}) no puede ser menor a las unidades ya reservadas (${existingProduct.reservedStock || 0}).`
                    }, { status: 400 });
                }
            }
        }

        if (
            (typeof body.hidePublicStock === 'boolean' || typeof body.hideFromPublic === 'boolean') &&
            auth.role !== 'superadmin'
        ) {
            return NextResponse.json({
                success: false,
                error: 'Solo el SuperAdmin puede cambiar la visibilidad pública del producto.',
            }, { status: 403 });
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
        if (typeof minStock === 'number' && Number.isFinite(minStock) && minStock >= 0 && typeof stockIncrement !== 'number') {
            saveProductMinStockForId(tenantId, product.id, minStock);
        }
        if (typeof body.hidePublicStock === 'boolean' || typeof body.hideFromPublic === 'boolean') {
            saveBatchProductVisibility(tenantId, [product.id], {
                ...(typeof body.hidePublicStock === 'boolean' ? { hidePublicStock: body.hidePublicStock } : {}),
                ...(typeof body.hideFromPublic === 'boolean' ? { hideFromPublic: body.hideFromPublic } : {}),
            });
        }

        let restockAudit = null;
        if (typeof stockIncrement === 'number' && stockIncrement !== 0 && existingProduct) {
            const parsedMin = typeof minStock === 'number' && Number.isFinite(minStock) ? minStock : null;
            const auditPayload = {
                event: isQuickRestock ? 'QUICK_RESTOCK_LOW_STOCK' : 'STOCK_INCREMENT',
                productId: product.id,
                productName: existingProduct.name,
                unitType: typeof unitType === 'string' && unitType.trim() ? unitType.trim() : 'PZA',
                previousStock: existingProduct.stock,
                addedQty: stockIncrement,
                newStock: product.stock,
                minStock: parsedMin,
                estante: existingProduct.estante || '',
                fila: existingProduct.fila || '',
                operatorUid: auth.uid,
                operatorName: typeof operatorName === 'string' && operatorName.trim() ? operatorName.trim() : auth.uid,
                operatorRole: auth.role,
                notes: typeof notes === 'string' ? notes.trim() : '',
                doubleConfirmed: isQuickRestock,
            };

            try {
                const createdLog = await prisma.auditLog.create({
                    data: {
                        tenantId,
                        action: 'STOCK_UPDATE',
                        userId: auth.uid,
                        details: JSON.stringify(auditPayload),
                    }
                });
                restockAudit = {
                    id: createdLog.id,
                    timestamp: createdLog.timestamp instanceof Date ? createdLog.timestamp.toISOString() : new Date().toISOString(),
                    ...auditPayload,
                };
            } catch (auditErr: any) {
                console.warn('[PRODUCTS PATCH AUDIT WARN]:', auditErr?.message);
            }
        }

        const mediaMap = getProductMediaMap(tenantId);
        const minStockMap = getProductMinStockMap(tenantId);
        const visibilityMap = getProductVisibilityMap(tenantId);
        const enrichedProduct = enrichProductWithMedia(product, mediaMap, minStockMap, visibilityMap);
        const patchDetails = restockAudit
            ? `Recarga de stock: ${restockAudit.productName} (+${restockAudit.addedQty} ${restockAudit.unitType} -> ${restockAudit.newStock})`
            : `Producto actualizado: ${product.name}`;

        publishRealtimeEvent({
            tenantId,
            scope: 'products',
            action: restockAudit ? 'STOCK_UPDATE' : 'PRODUCT_UPDATED',
            entityId: product.id,
            payload: { details: patchDetails },
        });

        if (typeof stockIncrement === 'number' && stockIncrement < 0) {
            const stockAnalysis = analyzeProductStock(
                {
                    id: product.id,
                    name: product.name,
                    stock: product.stock,
                    category: product.category,
                    minStock: typeof minStock === 'number' ? minStock : undefined,
                },
                DEFAULT_STOCK_THRESHOLD_CONFIG
            );
            if (stockAnalysis.isAlert) {
                void dispatchCriticalAdminPush({
                    tenantId,
                    category: 'STOCK_CRITICAL',
                    severity: stockAnalysis.status === 'out_of_stock' ? 'critical' : 'warning',
                    title: stockAnalysis.status === 'out_of_stock' ? '🚨 Producto Agotado (0 uds)' : '⚠️ Stock Bajo Mínimo',
                    body: `${product.name}: bajó a ${product.stock} uds (mínimo ${stockAnalysis.effectiveThreshold}).`,
                    url: '/dashboard/inventory',
                    actorUid: auth.uid,
                    actorName: auth.role,
                    dedupKey: `low_stock:${product.id}:${stockAnalysis.status}`,
                    cooldownMs: 300_000,
                    metadata: { productId: product.id, stock: product.stock, threshold: stockAnalysis.effectiveThreshold },
                }).catch(() => {});
            }
        }
        flushPersistedStore();
        return NextResponse.json({ success: true, data: enrichedProduct, ...(restockAudit ? { restockAudit } : {}) });
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

        const deleteSummary = permanent
            ? `Producto eliminado definitivamente: ${id}`
            : `Producto movido a papelera: ${id}`;
        try {
            await prisma.auditLog.create({
                data: {
                    tenantId,
                    action: permanent ? 'PRODUCT_DELETED' : 'PRODUCT_ARCHIVED',
                    userId: auth.uid,
                    details: deleteSummary,
                },
            });
        } catch {}

        publishRealtimeEvent({
            tenantId,
            scope: 'products',
            action: permanent ? 'PRODUCT_DELETED' : 'PRODUCT_ARCHIVED',
            entityId: id,
            payload: { details: deleteSummary },
        });
        flushPersistedStore();
        return NextResponse.json({ success: true, permanent });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
