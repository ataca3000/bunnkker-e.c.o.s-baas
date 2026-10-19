import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';

import { validateApiSession, validateActiveDbUser, verifyRoleSignature } from '@/lib/apiAuth';
import { roundMoney } from '@/lib/financial';
import { getSalesTrialStatus, recordPersistentSale } from '@/lib/salesCounter';
const CUSTOMER_JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super_secret_local_key');

async function writeOrderEvent(tx: any, event: {
    orderId: string;
    eventType: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    actorId: string;
    actorName: string;
    actorRole: string;
    details?: Record<string, unknown>;
}) {
    return tx.orderEvent.create({
        data: {
            ...event,
            details: event.details ? JSON.stringify(event.details) : null
        }
    });
}

export const dynamic = 'force-dynamic';


export async function GET() {
    try {
        await ensureDbColumns();
        const now = new Date();
        const expiredOrders = await prisma.order.findMany({
            where: {
                expiresAt: { lte: now },
                confirmedAt: null,
                status: { in: ['pending_payment', 'pending_confirmation', 'NIGHT_QUEUE', 'PENDIENTE_LLEGADA', 'PREPARANDO', 'READY_TO_SHIP', 'READY_FOR_PICKUP'] }
            },
            select: { id: true, status: true }
        });
        for (const expired of expiredOrders) {
            const cancelled = await prisma.order.updateMany({
                where: { id: expired.id, status: expired.status, confirmedAt: null },
                data: { status: 'cancelled', completedAt: now, rejectionReason: 'Reserva de pago vencida' }
            });
            if (cancelled.count === 1) {
                await prisma.orderEvent.create({
                    data: {
                        orderId: expired.id,
                        eventType: 'ORDER_EXPIRED',
                        fromStatus: expired.status,
                        toStatus: 'cancelled',
                        actorId: 'SYSTEM',
                        actorName: 'Sistema',
                        actorRole: 'system',
                        details: JSON.stringify({ reason: 'La reserva de stock venció a las dos horas.' })
                    }
                });
            }
        }

        const orders = await prisma.order.findMany({
            include: { 
                items: { include: { product: true } }, 
                customer: true, 
                events: { orderBy: { createdAt: 'asc' } } 
            },
            orderBy: { date: 'desc' }
        });
        const data = orders.map((order) => ({
            ...order,
            items: order.items.map((it: any) => ({
                ...it,
                quantity: it.cantidad,
                price: it.precio,
                name: it.product?.name || 'Producto'
            })),
            deliveryMethod: order.deliveryType === 'DELIVERY'
                ? 'repartidor'
                : order.deliveryType === 'PATIO'
                    ? 'patio'
                    : order.deliveryType === 'PICKUP'
                        ? 'pickup'
                        : 'tienda',
            address: order.deliveryAddress || order.customer?.address || '',
            lat: order.deliveryLat,
            lng: order.deliveryLng
        }));
        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

let isDbSchemaSynced = false;
async function ensureDbColumns() {
    if (isDbSchemaSynced) return;
    const tables = ['Order', 'OrderItem', 'OrderEvent', 'Customer', 'Product'];
    for (const tbl of tables) {
        // 1. Probar sintaxis estándar PostgreSQL ("ADD COLUMN IF NOT EXISTS")
        try {
            await prisma.$executeRawUnsafe(`ALTER TABLE "${tbl}" ADD COLUMN IF NOT EXISTS "tenantId" TEXT DEFAULT 'default'`);
        } catch {
            // 2. Si falla (en SQLite "IF NOT EXISTS" no es válido), intentar sintaxis SQLite ("ADD COLUMN")
            try {
                await prisma.$executeRawUnsafe(`ALTER TABLE "${tbl}" ADD COLUMN "tenantId" TEXT DEFAULT 'default'`);
            } catch {
                // Columna ya existe o dialecto/tabla no aplicable
            }
        }
    }
    isDbSchemaSynced = true;
}

export async function POST(request: NextRequest) {
    let body: any = {};
    let orderId: string | undefined = undefined;
    try {
        await ensureDbColumns();
        body = await request.json().catch(() => ({}));
        orderId = body.orderId || body.id;
        const total = body.total;
        const clientData = body.clientData || body.customer || {};
        const items = body.items || [];
        const deliveryMethod = body.deliveryMethod || clientData.deliveryMethod;
        const deliveryType = body.deliveryType || (deliveryMethod === 'repartidor'
            ? 'DELIVERY'
            : deliveryMethod === 'patio' || deliveryMethod === 'PATIO'
                ? 'PATIO'
                : ['pickup', 'PICKUP', 'tienda'].includes(deliveryMethod)
                    ? 'PICKUP'
                    : 'LOCAL');
        const paymentMethod = body.paymentMethod;

        // SEGURIDAD FAIL-CLOSED: Validar sesión activa directamente en SQLite (no solo la firma HMAC)
        const staffSession = await validateActiveDbUser(request);
        let authenticatedCustomerId: string | null = null;
        let staffUser: { name: string } | null = null;

        if (staffSession.ok) {
            if (!['superadmin', 'admin', 'sales', 'billing', 'inventory'].includes(staffSession.role)) {
                return NextResponse.json({ success: false, error: 'No tienes permiso para crear pedidos.' }, { status: 403 });
            }
            staffUser = await prisma.user.findUnique({
                where: { id: staffSession.uid },
                select: { name: true }
            });
        } else {
            const authHeader = request.headers.get('authorization');
            const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
            const headerSession = request.headers.get('x-msj-session');
            const headerRole = request.headers.get('x-msj-role');
            const headerSig = request.headers.get('x-msj-role-sig');

            const jwtCandidates = [
                request.cookies.get('admincom_session')?.value,
                bearerToken,
                request.cookies.get('msj-session')?.value,
                headerSession
            ];
            for (const cand of jwtCandidates) {
                if (!cand) continue;
                try {
                    const { payload } = await jwtVerify(cand, CUSTOMER_JWT_SECRET);
                    if (payload.role === 'customer' && typeof payload.uid === 'string') {
                        authenticatedCustomerId = payload.uid;
                        break;
                    }
                } catch {
                    // Token inválido o no es JWT
                }
            }

            if (!authenticatedCustomerId) {
                const sessionVal = request.cookies.get('msj-session')?.value || headerSession;
                const roleVal = request.cookies.get('msj-role')?.value || headerRole;
                const sigVal = request.cookies.get('msj-role-sig')?.value || headerSig;
                if (sessionVal && roleVal === 'client' && sigVal && verifyRoleSignature(roleVal, sessionVal, sigVal)) {
                    authenticatedCustomerId = sessionVal;
                }
            }

            // Si no hay cuenta autenticada de cliente ni sesión de empleado:
            if (!authenticatedCustomerId) {
                const isGuestRequest = Boolean(body.asRequest || paymentMethod === 'pago_caja' || body.status === 'pending_payment');
                const hasContact = Boolean(clientData?.phone || clientData?.name || body.customerEmail);

                if (!isGuestRequest || !hasContact) {
                    return staffSession.response || NextResponse.json({ success: false, error: 'Debes iniciar sesión para realizar ventas directas.' }, { status: 401 });
                }
            }
        }

        // AISLAMIENTO DE TENANT: Se deriva de la configuración soberana en base de datos, no de headers arbitrarios
        const appConfig = await prisma.appConfig.findUnique({ where: { id: 'global' } }).catch(() => null);
        const tenantId = appConfig?.tenantId || 'default';
        const isSubscribed = Boolean(appConfig && (appConfig as any).subscriptionStatus === 'active');

        // REGLA 100 + 20 VENTAS (Anti-Tampering): Verificar límite de prueba antes de procesar
        const trialStatus = getSalesTrialStatus(tenantId, isSubscribed);
        if (trialStatus.isLocked) {
            return NextResponse.json({
                success: false,
                error: 'Has completado tus 100 ventas de prueba + 20 ventas de cortesía (120 ventas). Activa tu suscripción mensual para continuar cobrando.',
                code: 'SUBSCRIPTION_REQUIRED',
                trialStatus
            }, { status: 402 });
        }

        const isCashierRequest = Boolean(authenticatedCustomerId || body.asRequest || !staffSession.ok);
        const location = clientData.gpsCoords || body.gpsCoords || {};
        const deliveryLat = body.deliveryLat ?? body.lat ?? clientData.lat ?? location.lat;
        const deliveryLng = body.deliveryLng ?? body.lng ?? clientData.lng ?? location.lng;

        const numTotal = roundMoney(Number(total));
        if (!orderId || Number.isNaN(numTotal) || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ success: false, error: 'Order ID, total numérico válido y productos son obligatorios.' }, { status: 400 });
        }

        // IDEMPOTENCIA EN BASE DE DATOS: Si la orden ya existe en SQLite (por reintento de red o reinicio del nodo),
        // responder inmediatamente con la orden existente para evitar descontar inventario doble.
        const existingOrder = await prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true, customer: true }
        });
        if (existingOrder) {
            console.log(`[IDEMPOTENCIA DB] Orden ${orderId} ya procesada previamente en SQLite. Evitando duplicación.`);
            return NextResponse.json({ success: true, data: existingOrder, duplicated: true });
        }

        // staffUser ya fue cargado previamente para derivar tenantId
        const actorId = authenticatedCustomerId || (staffSession.ok ? staffSession.uid : 'SYSTEM');
        const actorName = authenticatedCustomerId ? (clientData.name || 'Cliente') : (staffUser?.name || 'Personal');
        const actorRole = authenticatedCustomerId ? 'customer' : (staffSession.ok ? staffSession.role : 'system');

        // Pending orders reserve availability; payment confirmation performs the stock deduction.
        const orderResult = await prisma.$transaction(async (tx) => {
            
            // 1. Resolver o Crear Cliente por Teléfono o Sesión de forma resiliente
            let customerId: string | null = authenticatedCustomerId;
            if (authenticatedCustomerId) {
                let registeredCustomer = await tx.customer.findUnique({ where: { id: authenticatedCustomerId } });
                if (!registeredCustomer && clientData?.phone) {
                    registeredCustomer = await tx.customer.findFirst({ where: { phone: clientData.phone } });
                }

                if (!registeredCustomer) {
                    try {
                        registeredCustomer = await tx.customer.create({
                            data: {
                                id: authenticatedCustomerId,
                                tenantId,
                                name: clientData?.name || 'Cliente',
                                phone: clientData?.phone || '0000000000',
                                address: clientData?.address || null,
                                references: clientData?.references || null,
                                gpsCoords: deliveryLat != null && deliveryLng != null ? `${deliveryLat},${deliveryLng}` : null
                            }
                        });
                    } catch {
                        registeredCustomer = await tx.customer.findFirst({
                            where: { OR: [{ id: authenticatedCustomerId }, { phone: clientData?.phone || '0000000000' }] }
                        });
                    }
                } else if (deliveryType === 'DELIVERY' && clientData?.address) {
                    await tx.customer.update({
                        where: { id: registeredCustomer.id },
                        data: {
                            address: clientData.address,
                            references: clientData.references || undefined,
                            gpsCoords: deliveryLat != null && deliveryLng != null ? `${deliveryLat},${deliveryLng}` : undefined
                        }
                    });
                }
                customerId = registeredCustomer?.id || authenticatedCustomerId;
            } else if (clientData && (clientData.phone || clientData.name)) {
                const phone = clientData.phone || '0000000000';
                let customer = await tx.customer.findFirst({
                    where: { phone }
                });

                if (!customer) {
                    customer = await tx.customer.create({
                        data: {
                            tenantId,
                            name: clientData.name || 'Cliente Mostrador',
                            phone,
                            address: clientData.address || null,
                            references: clientData.references || null,
                            gpsCoords: deliveryLat != null && deliveryLng != null
                                ? `${deliveryLat},${deliveryLng}`
                                : null
                        }
                    });
                } else if (deliveryType === 'DELIVERY' && clientData.address) {
                    // Actualizar datos de entrega si regresó con nueva dirección
                    customer = await tx.customer.update({
                        where: { id: customer.id },
                        data: {
                            address: clientData.address,
                            references: clientData.references,
                            gpsCoords: deliveryLat != null && deliveryLng != null
                                ? `${deliveryLat},${deliveryLng}`
                                : undefined
                        }
                    });
                }
                customerId = customer.id;
            }

            // 2. Validación de Productos e Inventario (con auto-resolución resiliente)
            const resolvedOrderItems: Array<{ productId: string; cantidad: number; precio: number }> = [];

            for (const item of items) {
                const prodId = item.productId || item.id;
                if (!prodId) {
                    throw new Error('Identificador de producto inválido en el pedido.');
                }
                const qty = Math.max(1, Math.round(Number(item.quantity ?? item.cantidad ?? 1)));

                // Paso A: Verificar existencia de producto en la base de datos
                let current = await tx.product.findUnique({
                    where: { id: prodId },
                    select: { stock: true, reservedStock: true, id: true, name: true }
                });

                // Si no existe por ID, buscar por nombre
                if (!current && item.name) {
                    current = await tx.product.findFirst({
                        where: { name: item.name },
                        select: { stock: true, reservedStock: true, id: true, name: true }
                    });
                }

                // Si aún no existe en BD (p.ej. producto del catálogo en frío o mock local), auto-crearlo para no romper la venta
                if (!current) {
                    const createdProd = await tx.product.create({
                        data: {
                            id: prodId,
                            tenantId,
                            name: item.name || `Producto ${prodId}`,
                            price: Number(item.price ?? item.precio ?? 0),
                            stock: 100,
                            reservedStock: 0,
                            category: item.category || 'General'
                        }
                    });
                    current = {
                        id: createdProd.id,
                        stock: createdProd.stock,
                        reservedStock: createdProd.reservedStock,
                        name: createdProd.name
                    };
                }

                const availableStock = current.stock - current.reservedStock;
                if (availableStock < qty) {
                    throw new Error(`INSUFFICIENT_STOCK: Inventario insuficiente para el producto "${current.name || prodId}". Disponible: ${availableStock}, solicitado: ${qty}.`);
                }
                if (!isCashierRequest) {
                    await tx.product.update({
                        where: { id: current.id },
                        data: { stock: { decrement: qty } }
                    });
                }

                resolvedOrderItems.push({
                    productId: current.id,
                    cantidad: qty,
                    precio: roundMoney(Number(item.price ?? item.precio ?? 0))
                });
            }

            const isClientOrder = Boolean(authenticatedCustomerId || body.asRequest || !staffSession.ok || paymentMethod === 'pago_caja');
            const initialStatus = isClientOrder
                ? 'pending_payment'
                : (body.status || 'paid');

                    const isPending = ['pending_payment', 'pending_confirmation'].includes(initialStatus);

                    // 3. Creación de la Orden en el Pipeline Logístico
                    const order = await tx.order.create({
                        data: {
                            id: orderId,
                            tenantId,
                            total: numTotal,
                            deliveryType: deliveryType || (deliveryMethod === 'repartidor' ? 'DELIVERY' : (deliveryMethod === 'pickup' ? 'PICKUP' : 'LOCAL')),
                            paymentMethod: isCashierRequest ? 'pago_caja' : paymentMethod || 'CASH',
                            status: initialStatus,
                            vendedorId: isCashierRequest ? null : body.vendedorId || null,
                            vendedorName: isCashierRequest ? null : body.vendedorName || null,
                            confirmedAt: isCashierRequest ? null : body.confirmedAt ? new Date(body.confirmedAt) : new Date(),
                            expiresAt: body.expiresAt ? new Date(body.expiresAt) : isPending ? new Date(Date.now() + 30 * 60 * 1000) : null,
                    deliveryPin: body.deliveryPin || null,
                    deliveryLat: typeof deliveryLat === 'number' ? deliveryLat : null,
                    deliveryLng: typeof deliveryLng === 'number' ? deliveryLng : null,
                    deliveryAddress: clientData?.address || null,
                    customerId: customerId,
                    items: {
                        create: resolvedOrderItems
                    }
                },
                include: { customer: true, items: true }
            });

            await tx.orderEvent.create({
                data: {
                    orderId: order.id,
                    eventType: 'ORDER_CREATED',
                    toStatus: order.status,
                    actorId,
                    actorName,
                    actorRole,
                    details: JSON.stringify({ deliveryType, itemCount: items.length, total: numTotal })
                }
            });
            return order;
        });

        // Registrar venta de forma monotónica e irreversible en disco (Anti-Tampering)
        const counterInfo = recordPersistentSale(tenantId);

        return NextResponse.json({ success: true, data: orderResult, trialStatus: counterInfo });

    } catch (error: any) {
        const collisionId = orderId || body?.orderId || body?.id;

        // 1. COLISIÓN DE PRIMARY KEY (P2002 / Unique constraint):
        // Verificar estrictamente si la colisión ocurrió sobre el identificador de la orden (Order.id).
        const isOrderPkCollision = error.code === 'P2002' || (
            typeof error.message === 'string' &&
            error.message.includes('Unique constraint failed') &&
            (!error.meta?.target || (Array.isArray(error.meta.target) && error.meta.target.includes('id')))
        );

        if (isOrderPkCollision && collisionId) {
            try {
                const existing = await prisma.order.findUnique({
                    where: { id: collisionId },
                    include: { items: true, customer: true }
                });
                if (existing) {
                    console.log(`[IDEMPOTENCIA P2002] Orden ${collisionId} ya existía en BD. Retornando 200 idempotente.`);
                    return NextResponse.json({ success: true, data: existing, duplicated: true });
                }
            } catch (pkLookupError) {
                console.error('[IDEMPOTENCY] Error al buscar orden tras colisión P2002:', pkLookupError);
            }
        }

        // 2. CONFLICTO DE SERIALIZACIÓN / BLOQUEO TRANSITORIO (P2034 / SQLITE_BUSY):
        const isBusyOrLockConflict = error.code === 'P2034' || 
            (typeof error.message === 'string' && (
                error.message.includes('SQLITE_BUSY') || 
                error.message.includes('database is locked') ||
                error.message.includes('Transaction failed due to a write conflict')
            ));

        if (isBusyOrLockConflict) {
            if (collisionId) {
                // Verificar si otra transacción paralela que ganó el lock ya completó la orden
                const existing = await prisma.order.findUnique({
                    where: { id: collisionId },
                    include: { items: true, customer: true }
                }).catch(() => null);

                if (existing) {
                    console.log(`[CONCURRENCY RACE HANDLED] Orden ${collisionId} fue completada por transacción paralela. Retornando 200 idempotente.`);
                    return NextResponse.json({ success: true, data: existing, duplicated: true });
                }
            }

            // Si la orden NO existe, fue una contención real de concurrencia: retornar 409 reintentable
            console.warn(`[CONCURRENCY CONTENTION] Bloqueo transitorio en SQLite (P2034/SQLITE_BUSY). Orden ${collisionId} no creada.`);
            return NextResponse.json({
                success: false,
                error: 'Conflicto de concurrencia en base de datos. Por favor reintente la operación.',
                retryable: true
            }, { status: 409 });
        }

        if (typeof error.message === 'string' && error.message.startsWith('INSUFFICIENT_STOCK:')) {
            const cleanMsg = error.message.replace('INSUFFICIENT_STOCK:', '').trim();
            return NextResponse.json({ success: false, error: cleanMsg }, { status: 400 });
        }

        console.error(`[ACID Transaction Error]: ${error.message}`);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}


export async function PATCH(request: NextRequest) {
    const auth = await validateActiveDbUser(request);
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json();
        const { id, action, ...updates } = body;
        if (!id) throw new Error('Order ID is required');

        const actorUser = await prisma.user.findUnique({ where: { id: auth.uid }, select: { name: true } });
        const actorName = actorUser?.name || auth.uid;
        const actorRole = auth.role;
        const cashierRoles = ['sales', 'billing', 'admin', 'superadmin'];
        const loadingRoles = ['carga_descarga', 'inventory', 'admin', 'superadmin', 'sales', 'billing', 'pickup'];
        const deliveryRoles = ['driver', 'carga_descarga', 'admin', 'superadmin'];
        const cashierReadyStatuses = ['READY_TO_SHIP', 'READY_FOR_PICKUP', 'pending_payment', 'pending_confirmation', 'pending', 'NIGHT_QUEUE'];

        if (action === 'claim_cashier') {
            if (!cashierRoles.includes(actorRole)) return NextResponse.json({ success: false, error: 'Rol sin permiso para tomar cobros.' }, { status: 403 });
            const result = await prisma.$transaction(async (tx) => {
                const current = await tx.order.findUnique({ where: { id } });
                if (!current || !cashierReadyStatuses.includes(current.status)) return { conflict: true };
                if (current.vendedorId === auth.uid) return { order: current, alreadyClaimed: true };
                if (current.vendedorId) return { conflict: true, claimedBy: current.vendedorName };

                const claimed = await tx.order.updateMany({
                    where: { id, status: current.status, vendedorId: null },
                    data: { vendedorId: auth.uid, vendedorName: actorName }
                });
                if (claimed.count !== 1) return { conflict: true };

                const order = await tx.order.findUnique({ where: { id } });
                await writeOrderEvent(tx, { orderId: id, eventType: 'CASHIER_CLAIMED', fromStatus: current.status, toStatus: current.status, actorId: auth.uid, actorName, actorRole });
                return { order };
            });
            if (result.conflict) return NextResponse.json({ success: false, error: result.claimedBy ? `Pedido tomado por ${result.claimedBy}.` : 'Otro cajero tomó este pedido o ya cambió de etapa.' }, { status: 409 });
            return NextResponse.json({ success: true, data: result.order });
        }

        if (action === 'cashier_payment') {
            if (!cashierRoles.includes(actorRole)) return NextResponse.json({ success: false, error: 'Rol sin permiso para confirmar cobros.' }, { status: 403 });
            try {
                const order = await prisma.$transaction(async (tx) => {
                    const current = await tx.order.findUnique({ where: { id }, include: { items: true } });
                    if (!current || !cashierReadyStatuses.includes(current.status) || current.confirmedAt || (current.vendedorId && current.vendedorId !== auth.uid) || (current.expiresAt && current.expiresAt.getTime() <= Date.now())) {
                        throw new Error('ORDER_CONFLICT:El pedido no está listo, ya fue pagado o pertenece a otro cajero.');
                    }

                    // REGLA ESTRICTA DE PREPARACIÓN EN CAJA:
                    // Solo se marca isLoaded=true al cobrar si es una venta LOCAL directa de mostrador,
                    // o si el cajero explícitamente tiene asignado el pedido (selfPreparation / loadedByUid === auth.uid).
                    // Para pedidos de almacén o patio, el cobro NO brinca la recolección física.
                    const isSelfPreparation = Boolean(
                        updates.selfPreparation || 
                        body.selfPreparation || 
                        current.deliveryType === 'LOCAL' || 
                        (current.loadedByUid === auth.uid)
                    );
                    let effectiveIsLoaded = current.isLoaded;

                    if (!effectiveIsLoaded && isSelfPreparation) {
                        effectiveIsLoaded = true;
                    }

                    // FLOTACIÓN ESTRICTA: En caja se asegura la existencia y se aparta en reservedStock.
                    // El 'stock' físico en anaquel NO se decrementa definitivamente hasta que se valida la entrega con comprobante/firma.
                    for (const item of current.items) {
                        const product = await tx.product.findUnique({ where: { id: item.productId }, select: { stock: true, reservedStock: true } });
                        if (!product || (product.stock - product.reservedStock) < item.cantidad) {
                            throw new Error(`ORDER_CONFLICT:Inventario insuficiente para ${item.productId}.`);
                        }
                        await tx.product.update({ 
                            where: { id: item.productId }, 
                            data: { reservedStock: { increment: item.cantidad } } 
                        });
                    }

                    const isPickup = ['PICKUP', 'PATIO'].includes(current.deliveryType);
                    const isDelivery = current.deliveryType === 'DELIVERY';
                    const nextStatus = effectiveIsLoaded
                        ? isDelivery ? 'OUT_FOR_DELIVERY' : isPickup ? 'READY_FOR_PICKUP_PAID' : 'COMPLETED'
                        : 'paid';
                    const updated = await tx.order.updateMany({
                        where: {
                            id,
                            status: current.status,
                            confirmedAt: null,
                            OR: [
                                { vendedorId: auth.uid },
                                { vendedorId: null }
                            ]
                        },
                        data: {
                            status: nextStatus,
                            paymentMethod: updates.paymentMethod || 'cash',
                            confirmedAt: new Date(),
                            vendedorId: auth.uid,
                            vendedorName: actorName,
                            ...(effectiveIsLoaded && !current.isLoaded ? {
                                isLoaded: true,
                                loadedBy: actorName,
                                loadedByUid: auth.uid,
                                loadingFinishedAt: new Date()
                            } : {}),
                            ...(updates.ventanilla ? { ventanilla: updates.ventanilla } : {}),
                            ...(updates.cajon ? { cajon: updates.cajon } : {})
                        }
                    });
                    if (updated.count !== 1) throw new Error('ORDER_CONFLICT:Otro cajero confirmó este pago.');

                    await writeOrderEvent(tx, {
                        orderId: id,
                        eventType: 'PAYMENT_CONFIRMED',
                        fromStatus: current.status,
                        toStatus: nextStatus,
                        actorId: auth.uid,
                        actorName,
                        actorRole,
                        details: { paymentMethod: updates.paymentMethod || 'cash', total: current.total, isLoaded: effectiveIsLoaded }
                    });
                    return tx.order.findUnique({ where: { id }, include: { customer: true, items: true } });
                });
                return NextResponse.json({ success: true, data: order });
            } catch (error: any) {
                if (String(error.message).startsWith('ORDER_CONFLICT:')) {
                    return NextResponse.json({ success: false, error: String(error.message).replace('ORDER_CONFLICT:', '') }, { status: 409 });
                }
                throw error;
            }
        }

        if (action === 'claim_loading' || action === 'claim_order') {
            if (!loadingRoles.includes(actorRole)) return NextResponse.json({ success: false, error: 'Rol sin permiso para preparar pedidos.' }, { status: 403 });
            const current = await prisma.order.findUnique({ where: { id } });
            if (!current) return NextResponse.json({ success: false, error: 'Pedido no encontrado.' }, { status: 404 });
            
            // REGLA AISLAMIENTO DELIVERY:
            if (current.deliveryType === 'DELIVERY' && actorRole !== 'driver' && !['admin', 'superadmin'].includes(actorRole)) {
                return NextResponse.json({ success: false, error: 'Los pedidos a domicilio son exclusivos para repartidores.' }, { status: 403 });
            }

            const loadingStatuses = ['pending', 'pending_payment', 'pending_confirmation', 'paid', 'PREPARANDO', 'NIGHT_QUEUE', 'PENDIENTE_LLEGADA'];
            if (!loadingStatuses.includes(current.status) || current.isLoaded) {
                return NextResponse.json({ success: false, error: 'El pedido ya no está disponible para preparación.' }, { status: 409 });
            }
            if (current.loadedByUid && current.loadedByUid !== auth.uid) {
                return NextResponse.json({ success: false, error: `Este pedido ya fue tomado por ${current.loadedBy || 'otro operador'}.` }, { status: 409 });
            }
            if (current.loadedByUid === auth.uid) {
                return NextResponse.json({ success: true, data: current, alreadyClaimed: true });
            }
            const claimed = await prisma.order.updateMany({
                where: { id, status: current.status, isLoaded: false, loadedByUid: null },
                data: { 
                    loadedBy: actorName, 
                    loadedByUid: auth.uid, 
                    loadingStartedAt: new Date(),
                    status: current.status === 'paid' ? 'paid' : 'PREPARANDO'
                }
            });
            if (claimed.count !== 1) return NextResponse.json({ success: false, error: 'Otro operador tomó este pedido.' }, { status: 409 });
            await prisma.orderEvent.create({ data: { orderId: id, eventType: 'LOADING_CLAIMED', fromStatus: current.status, toStatus: current.status === 'paid' ? 'paid' : 'PREPARANDO', actorId: auth.uid, actorName, actorRole } });
            const order = await prisma.order.findUnique({ where: { id } });
            return NextResponse.json({ success: true, data: order });
        }

        if (action === 'complete_loading') {
            if (!loadingRoles.includes(actorRole)) return NextResponse.json({ success: false, error: 'Rol sin permiso para finalizar la preparación.' }, { status: 403 });
            const current = await prisma.order.findUnique({ where: { id } });
            if (!current || current.isLoaded || (current.loadedByUid && current.loadedByUid !== auth.uid && !['superadmin', 'admin', 'sales'].includes(actorRole))) {
                return NextResponse.json({ success: false, error: 'El pedido no está asignado a este operador.' }, { status: 409 });
            }
            
            // Si el operador especifica dónde queda listo: 'caja' (PICKUP/MOSTRADOR) o 'carga' (PATIO/BAHÍA DE CARGA)
            let targetLocation = body.targetLocation || updates.targetLocation;
            if (actorRole === 'inventory' && !targetLocation) {
                targetLocation = current.deliveryType === 'PATIO' ? 'carga' : 'caja';
            }

            let effectiveDeliveryType = current.deliveryType;
            if (targetLocation === 'caja') {
                effectiveDeliveryType = 'PICKUP';
            } else if (targetLocation === 'carga') {
                effectiveDeliveryType = 'PATIO';
            }

            const isPickup = ['PICKUP', 'PATIO'].includes(effectiveDeliveryType);
            const isDelivery = effectiveDeliveryType === 'DELIVERY';
            const isPaid = Boolean(current.confirmedAt) || current.status === 'paid';
            const nextStatus = isPickup
                ? isPaid ? 'READY_FOR_PICKUP_PAID' : 'READY_FOR_PICKUP'
                : isDelivery
                    ? isPaid ? 'OUT_FOR_DELIVERY' : 'READY_TO_SHIP'
                    : 'COMPLETED';
            const updated = await prisma.order.updateMany({
                where: { id, status: current.status, isLoaded: false },
                data: { 
                    isLoaded: true, 
                    loadedBy: current.loadedBy || actorName,
                    loadedByUid: current.loadedByUid || auth.uid,
                    loadingFinishedAt: new Date(), 
                    status: nextStatus,
                    deliveryType: effectiveDeliveryType
                }
            });
            if (updated.count !== 1) return NextResponse.json({ success: false, error: 'El pedido cambió de estado; actualiza la lista.' }, { status: 409 });
            await prisma.orderEvent.create({ 
                data: { 
                    orderId: id, 
                    eventType: 'LOADING_COMPLETED', 
                    fromStatus: current.status, 
                    toStatus: nextStatus, 
                    actorId: auth.uid, 
                    actorName, 
                    actorRole,
                    details: JSON.stringify({
                        targetLocation: targetLocation || (effectiveDeliveryType === 'PATIO' ? 'carga' : 'caja'),
                        deliveryType: effectiveDeliveryType,
                        role: actorRole
                    })
                } 
            });
            return NextResponse.json({ success: true, data: await prisma.order.findUnique({ where: { id } }) });
        }

        if (action === 'delegate_order') {
            if (actorRole === 'driver') {
                return NextResponse.json({ success: false, error: 'El repartidor no puede delegar pedidos de tienda.' }, { status: 403 });
            }
            const targetRole = body.targetRole || body.targetLocation || 'caja';
            const current = await prisma.order.findUnique({ where: { id } });
            if (!current) return NextResponse.json({ success: false, error: 'Pedido no encontrado' }, { status: 404 });

            await prisma.order.update({
                where: { id },
                data: {
                    vendedorId: targetRole === 'caja' ? null : current.vendedorId,
                    loadedByUid: null,
                    loadedBy: null
                }
            });

            await writeOrderEvent(prisma as any, {
                orderId: id,
                eventType: 'ORDER_DELEGATED',
                fromStatus: current.status,
                toStatus: current.status,
                actorId: auth.uid,
                actorName,
                actorRole,
                details: { delegatedTo: targetRole, reason: body.reason || 'Operador ocupado / Delegación rápida' }
            });

            return NextResponse.json({ success: true, message: `Pedido delegado a ${targetRole}` });
        }

        if (action === 'admin_refund_order') {
            if (!['admin', 'superadmin'].includes(actorRole)) {
                return NextResponse.json({ success: false, error: 'Solo administradores pueden autorizar devoluciones de ventas cerradas.' }, { status: 403 });
            }
            const current = await prisma.order.findUnique({ where: { id }, include: { items: true } });
            if (!current) return NextResponse.json({ success: false, error: 'Pedido no encontrado' }, { status: 404 });

            const updated = await prisma.$transaction(async (tx) => {
                await tx.order.update({
                    where: { id },
                    data: {
                        status: 'refunded',
                        rejectionReason: body.reason || 'Devolución autorizada por Administrador'
                    }
                });

                // Si se solicita reincorporación inmediata
                if (body.immediateRestock) {
                    for (const item of current.items) {
                        await tx.product.update({
                            where: { id: item.productId },
                            data: { stock: { increment: item.cantidad } }
                        });
                    }
                }

                await writeOrderEvent(tx, {
                    orderId: id,
                    eventType: 'ORDER_REFUNDED_BY_ADMIN',
                    fromStatus: current.status,
                    toStatus: 'refunded',
                    actorId: auth.uid,
                    actorName,
                    actorRole,
                    details: {
                        reason: body.reason || 'Devolución de venta cerrada',
                        immediateRestock: Boolean(body.immediateRestock),
                        totalRefunded: current.total
                    }
                });

                return tx.order.findUnique({ where: { id }, include: { items: true, customer: true } });
            });

            return NextResponse.json({ success: true, data: updated, message: 'Devolución autorizada. Artículos listos para reincorporación al anaquel.' });
        }

        if (action === 'return_to_shelf') {
            const current = await prisma.order.findUnique({ where: { id }, include: { items: true } });
            if (!current) return NextResponse.json({ success: false, error: 'Pedido no encontrado' }, { status: 404 });

            const updated = await prisma.$transaction(async (tx) => {
                for (const item of current.items) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { increment: item.cantidad } }
                    });
                }

                await tx.order.update({
                    where: { id },
                    data: {
                        isLoaded: false,
                        status: 'cancelled',
                        rejectionReason: 'CANCELADA_STOCK_RESTITUIDO'
                    }
                });

                await writeOrderEvent(tx, {
                    orderId: id,
                    eventType: 'RESTOCK_COMPLETED',
                    fromStatus: current.status,
                    toStatus: 'cancelled',
                    actorId: auth.uid,
                    actorName,
                    actorRole,
                    details: {
                        verifiedBy: actorName,
                        reacomodoStatus: 'CANCELADA_STOCK_RESTITUIDO',
                        returnedItemsCount: current.items.length
                    }
                });

                return tx.order.findUnique({ where: { id }, include: { items: true, customer: true } });
            });

            return NextResponse.json({ success: true, data: updated, message: 'Artículos reincorporados al anaquel exitosamente. Stock restituido.' });
        }

        if (action === 'admin_return_as_new_intake') {
            if (!['admin', 'superadmin'].includes(actorRole)) {
                return NextResponse.json({ success: false, error: 'Solo el dueño o administrador puede registrar esta devolución administrativa.' }, { status: 403 });
            }
            const current = await prisma.order.findUnique({ where: { id }, include: { items: true } });
            if (!current) return NextResponse.json({ success: false, error: 'Pedido no encontrado' }, { status: 404 });

            // Ingreso nuevo a stock en almacén sin modificar contabilidad pasada
            const updated = await prisma.$transaction(async (tx) => {
                for (const item of current.items) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { stock: { increment: item.cantidad } }
                    });
                }

                await tx.order.update({
                    where: { id },
                    data: {
                        rejectionReason: `Devuelto (Dato Dueño): Stock ingresado a almacén por ${actorName}`
                    }
                });

                await writeOrderEvent(tx, {
                    orderId: id,
                    eventType: 'ADMIN_RETURN_INTAKE',
                    fromStatus: current.status,
                    toStatus: current.status,
                    actorId: auth.uid,
                    actorName,
                    actorRole,
                    details: {
                        note: 'Devolución meramente como dato administrativo del dueño; stock entra como ingreso nuevo',
                        itemsRestocked: current.items.length
                    }
                });

                return tx.order.findUnique({ where: { id }, include: { items: true, customer: true } });
            });

            return NextResponse.json({ success: true, data: updated, message: 'Devolución registrada como dato del dueño. Artículos agregados a inventario como nuevo ingreso.' });
        }

        if (action === 'claim_delivery') {
            if (!deliveryRoles.includes(actorRole)) return NextResponse.json({ success: false, error: 'Rol sin permiso para tomar rutas.' }, { status: 403 });
            const claimed = await prisma.order.updateMany({
                where: { id, status: 'OUT_FOR_DELIVERY', assignedDriverId: null },
                data: { status: 'claimed', assignedDriverId: auth.uid }
            });
            if (claimed.count !== 1) return NextResponse.json({ success: false, error: 'Otro repartidor tomó este pedido o aún no está liberado a ruta.' }, { status: 409 });
            await prisma.orderEvent.create({ data: { orderId: id, eventType: 'DRIVER_CLAIMED', fromStatus: 'OUT_FOR_DELIVERY', toStatus: 'claimed', actorId: auth.uid, actorName, actorRole } });
            return NextResponse.json({ success: true, data: await prisma.order.findUnique({ where: { id } }) });
        }

        if (action === 'confirm_pickup_receipt') {
            if (actorRole === 'inventory') {
                return NextResponse.json({ success: false, error: 'El personal de almacén no realiza entregas al cliente. La entrega corresponde a Caja o Patio de Carga.' }, { status: 403 });
            }
            if (!['pickup', 'carga_descarga', 'driver', 'sales', 'billing', 'admin', 'superadmin'].includes(actorRole)) {
                return NextResponse.json({ success: false, error: 'Rol sin permiso para entregar pedidos pickup.' }, { status: 403 });
            }
            const order = await prisma.$transaction(async (tx) => {
                const current = await tx.order.findUnique({ where: { id }, include: { items: true } });
                if (!current) throw new Error('ORDER_CONFLICT:Pedido no encontrado.');
                if (!current.confirmedAt && current.status !== 'paid' && current.status !== 'READY_FOR_PICKUP_PAID') {
                    throw new Error('ORDER_CONFLICT:El cliente debe pagar primero en Caja antes de recibir la mercancía.');
                }
                if (!current.isLoaded) {
                    throw new Error('ORDER_CONFLICT:El pedido aún está siendo preparado en almacén.');
                }

                const signatureData = updates.signatureData || body.signatureData || null;
                const photoData = updates.photoData || body.photoData || null;

                // DEDUCCIÓN FINAL AL VALIDAR ENTREGA EN TIENDA / PATIO:
                // Se descuenta físicamente de 'stock' y se limpia la reserva 'reservedStock'.
                for (const item of current.items) {
                    await tx.product.update({
                        where: { id: item.productId },
                        data: {
                            stock: { decrement: item.cantidad },
                            reservedStock: { decrement: item.cantidad }
                        }
                    });
                }

                const updated = await tx.order.updateMany({
                    where: { id, status: current.status, confirmedAt: { not: null } },
                    data: { 
                        status: 'DELIVERED', 
                        completedAt: new Date(),
                        ...(signatureData ? { signatureData } : {}),
                        ...(photoData ? { photoData } : {})
                    }
                });
                if (updated.count !== 1) throw new Error('ORDER_CONFLICT:El pedido ya fue cerrado por otro operador.');

                await writeOrderEvent(tx, { 
                    orderId: id, 
                    eventType: 'ORDER_DELIVERED_POD', 
                    fromStatus: current.status, 
                    toStatus: 'DELIVERED', 
                    actorId: auth.uid, 
                    actorName, 
                    actorRole,
                    details: {
                        photoAttached: Boolean(photoData),
                        signatureAttached: Boolean(signatureData),
                        vendedorName: current.vendedorName,
                        loadedBy: current.loadedBy
                    }
                });

                // Registrar en la bitácora administrativa de auditoría
                try {
                    await tx.auditLog.create({
                        data: {
                            action: 'ORDER_DELIVERED',
                            details: `Entrega validada (PoD) para orden ${id} por ${actorName} (${actorRole}). Foto: ${photoData ? 'SÍ' : 'NO'}, Firma: ${signatureData ? 'SÍ' : 'NO'}.`,
                            userId: auth.uid
                        }
                    });
                } catch {
                    // Resiliente si la tabla auditLog no tiene todas las columnas
                }

                return tx.order.findUnique({ where: { id }, include: { customer: true, items: true } });
            });

            return NextResponse.json({ success: true, data: order });
        }

        if (updates.driverId !== undefined) {
            updates.assignedDriverId = updates.driverId;
        }

        const allowedFields = [
            'tenantId', 'total', 'paymentMethod', 'status', 'deliveryType', 
            'date', 'offline', 'synced', 'ventanilla', 'cajon', 
            'vendedorId', 'vendedorName', 'confirmedAt', 'customerId',
            'deliveryPin', 'deliveryLat', 'deliveryLng', 'deliveryAddress',
            'loadedBy', 'loadedByUid', 'loadingStartedAt', 'loadingFinishedAt',
            'isLoaded', 'assignedDriverId', 'signatureData', 'photoData',
            'completedAt', 'rejectionReason', 'expiresAt'
        ];
        const prismaUpdates: any = {};
        for (const key of allowedFields) {
            if (updates[key] !== undefined) {
                prismaUpdates[key] = ['date', 'confirmedAt', 'loadingStartedAt', 'loadingFinishedAt', 'completedAt', 'expiresAt'].includes(key)
                    && typeof updates[key] === 'string'
                    ? new Date(updates[key])
                    : updates[key];
            }
        }
        
        const current = await prisma.order.findUnique({ where: { id }, include: { items: true } });
        if (!current) return NextResponse.json({ success: false, error: 'Pedido no encontrado.' }, { status: 404 });

        if (['DELIVERED', 'rejected', 'no_answer'].includes(updates.status)) {
            if (actorRole !== 'superadmin' && current.assignedDriverId !== auth.uid && !['carga_descarga', 'inventory'].includes(actorRole)) {
                return NextResponse.json({ success: false, error: 'Este pedido pertenece a otro repartidor u operador.' }, { status: 403 });
            }
            if (updates.status === 'DELIVERED' && (!updates.signatureData || !updates.photoData)) {
                return NextResponse.json({ success: false, error: 'Se requiere foto y firma para cerrar la entrega.' }, { status: 400 });
            }
        }

        let order;
        if (updates.status === 'cancelled') {
            if (!prismaUpdates.rejectionReason) {
                prismaUpdates.rejectionReason = 'CANCELADO_PENDIENTE_REACOMODO';
            }
            order = await prisma.$transaction(async (tx) => {
                const changed = await tx.order.updateMany({
                    where: { id, status: current.status },
                    data: prismaUpdates
                });
                if (changed.count !== 1) throw new Error('ORDER_CONFLICT:El pedido cambió mientras se cancelaba.');

                // CANCELACIÓN INTELIGENTE:
                // Si la venta ya había descontado el stock físico directamente (venta local COMPLETED / delivery DELIVERED):
                // -> Incrementamos 'stock' físico para regresarlo a anaquel.
                // Si la orden estaba en proceso (preventa / picking / ruta) y tenía el stock en 'reservedStock':
                // -> Decrementamos 'reservedStock' para liberar el apartado sin tocar stock físico.
                if (current.confirmedAt) {
                    const wasPhysicalStockDeducted = current.status === 'DELIVERED' || current.status === 'COMPLETED' || current.deliveryType === 'LOCAL';
                    for (const item of current.items) {
                        if (wasPhysicalStockDeducted) {
                            await tx.product.update({
                                where: { id: item.productId },
                                data: { stock: { increment: item.cantidad } }
                            });
                        } else {
                            await tx.product.update({ 
                                where: { id: item.productId }, 
                                data: { reservedStock: { decrement: item.cantidad } } 
                            });
                        }
                    }
                }

                const updated = await tx.order.findUnique({ where: { id } });
                await writeOrderEvent(tx, {
                    orderId: id,
                    eventType: 'ORDER_CANCELLED',
                    fromStatus: current.status,
                    toStatus: 'cancelled',
                    actorId: auth.uid,
                    actorName,
                    actorRole,
                    details: { stockRestored: Boolean(current.confirmedAt) }
                });
                return updated;
            });
        } else {
            order = await prisma.$transaction(async (tx) => {
                const changed = await tx.order.updateMany({
                    where: { id, status: current.status },
                    data: prismaUpdates
                });
                if (changed.count !== 1) throw new Error('ORDER_CONFLICT:El pedido cambió mientras se actualizaba.');

                // DEDUCCIÓN FINAL AL VALIDAR ENTREGA CON COMPROBANTE/FIRMA (DELIVERED):
                if (updates.status === 'DELIVERED' && current.status !== 'DELIVERED') {
                    for (const item of current.items) {
                        await tx.product.update({
                            where: { id: item.productId },
                            data: {
                                stock: { decrement: item.cantidad },
                                reservedStock: { decrement: item.cantidad }
                            }
                        });
                    }
                }

                const updated = await tx.order.findUnique({ where: { id } });
                if (updates.status !== undefined || updates.signatureData || updates.photoData || updates.rejectionReason) {
                    await writeOrderEvent(tx, {
                        orderId: id,
                        eventType: updates.status === 'DELIVERED' ? 'DELIVERY_RECEIVED' : updates.status ? `STATUS_${String(updates.status).toUpperCase()}` : 'ORDER_EVIDENCE_ADDED',
                        fromStatus: current.status,
                        toStatus: updates.status || current.status,
                        actorId: auth.uid,
                        actorName,
                        actorRole,
                        details: {
                            photoAttached: Boolean(updates.photoData),
                            signatureAttached: Boolean(updates.signatureData),
                            rejectionReason: updates.rejectionReason || null
                        }
                    });
                }
                return updated;
            });
        }

        return NextResponse.json({ success: true, data: order });
    } catch (error: any) {
        if (String(error.message).startsWith('ORDER_CONFLICT:')) {
            return NextResponse.json({ success: false, error: String(error.message).replace('ORDER_CONFLICT:', '') }, { status: 409 });
        }
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    const auth = await validateActiveDbUser(request);
    if (!auth.ok) return auth.response;

    try {
        const { searchParams } = new URL(request.url);
        let id = searchParams.get('id');
        if (!id) {
            const body = await request.json().catch(() => ({}));
            id = body.id;
        }

        if (!id) {
            return NextResponse.json({ success: false, error: 'ID de orden requerido.' }, { status: 400 });
        }

        const cashierRoles = ['sales', 'billing', 'admin', 'superadmin'];
        if (!cashierRoles.includes(auth.role)) {
            return NextResponse.json({ success: false, error: 'Rol sin permiso para eliminar pedidos.' }, { status: 403 });
        }

        const current = await prisma.order.findUnique({
            where: { id },
            include: { items: true }
        });

        if (!current) {
            return NextResponse.json({ success: false, error: 'Pedido no encontrado.' }, { status: 404 });
        }

        // Si tenía stock descontado o apartado y no estaba cancelado, restaurar:
        if (current.confirmedAt && current.status !== 'cancelled') {
            const wasPhysicalStockDeducted = current.status === 'DELIVERED' || current.status === 'COMPLETED' || current.deliveryType === 'LOCAL';
            for (const item of current.items) {
                if (wasPhysicalStockDeducted) {
                    await prisma.product.update({
                        where: { id: item.productId },
                        data: { stock: { increment: item.cantidad } }
                    }).catch(() => {});
                } else {
                    await prisma.product.update({
                        where: { id: item.productId },
                        data: { reservedStock: { decrement: item.cantidad } }
                    }).catch(() => {});
                }
            }
        }

        await prisma.order.delete({
            where: { id }
        });

        return NextResponse.json({ success: true, message: 'Pedido eliminado correctamente.' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

