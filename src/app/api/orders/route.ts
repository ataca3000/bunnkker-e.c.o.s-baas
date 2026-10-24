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

function parseCoordinates(raw: unknown): { lat: number | null; lng: number | null } {
    if (!raw) return { lat: null, lng: null };
    if (typeof raw === 'object' && raw !== null) {
        const obj = raw as Record<string, unknown>;
        const lat = Number(obj.lat ?? obj.latitude);
        const lng = Number(obj.lng ?? obj.longitude);
        return {
            lat: Number.isFinite(lat) ? lat : null,
            lng: Number.isFinite(lng) ? lng : null,
        };
    }
    if (typeof raw === 'string') {
        const parts = raw.split(',').map(p => Number(p.trim()));
        if (parts.length === 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
            return { lat: parts[0], lng: parts[1] };
        }
    }
    return { lat: null, lng: null };
}

export const dynamic = 'force-dynamic';


export async function GET(request: NextRequest) {
    try {
        await ensureDbColumns();
        const tenantId = request.headers.get('x-tenant-id') || 'default';
        const staffSession = validateApiSession(request);
        
        // Si no es staff con sesión activa, verificar si es un cliente autenticado
        let customerId: string | null = null;
        if (!staffSession.ok) {
            const customerToken = request.cookies.get('customer_token')?.value || 
                                request.cookies.get('admincom_session')?.value || 
                                request.headers.get('authorization')?.replace('Bearer ', '');
            if (customerToken) {
                try {
                    const { payload } = await jwtVerify(customerToken, CUSTOMER_JWT_SECRET);
                    customerId = (payload.customerId || payload.uid || payload.id || payload.sub) as string;
                } catch {}
            }
        }

        // AISLAMIENTO POR EMPRESA Y PROTECCIÓN DE DATOS PERSONALES:
        // - Staff autorizado consulta únicamente las órdenes de su tenantId.
        // - Clientes autenticados solo ven sus propios pedidos (evita exponer direcciones y teléfonos ajenos).
        // - Peticiones anónimas sin sesión son bloqueadas en producción.
        const whereClause: any = { tenantId };
        if (!staffSession.ok) {
            if (customerId) {
                whereClause.customerId = customerId;
            } else if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') {
                return NextResponse.json({ success: false, error: 'Acceso no autorizado. Inicie sesión para consultar pedidos.' }, { status: 401 });
            }
        }

        const orders = await prisma.order.findMany({
            where: whereClause,
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

// Sincronización delegada a scripts/prepare-db.js durante build/startup
async function ensureDbColumns() {
    return;
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
                : ['pickup', 'PICKUP', 'tienda', 'piso', 'PISO'].includes(deliveryMethod)
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
                    if ((payload.role === 'customer' || payload.role === 'client') && typeof payload.uid === 'string') {
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
                if (sessionVal && (roleVal === 'client' || roleVal === 'customer') && sigVal && verifyRoleSignature(roleVal, sessionVal, sigVal)) {
                    authenticatedCustomerId = sessionVal;
                }
            }

            // Si no hay cuenta autenticada de cliente ni sesión de empleado:
            if (!authenticatedCustomerId) {
                const isGuestRequest = Boolean(body.asRequest || paymentMethod === 'pago_caja' || body.status === 'pending_payment');

                if (!isGuestRequest) {
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
        const rawCoords = body.gpsCoords || clientData.gpsCoords || body.coords || clientData.coords;
        const parsedCoords = parseCoordinates(rawCoords);
        const deliveryLat = body.deliveryLat ?? body.lat ?? clientData.lat ?? parsedCoords.lat ?? null;
        const deliveryLng = body.deliveryLng ?? body.lng ?? clientData.lng ?? parsedCoords.lng ?? null;

        const numTotal = roundMoney(Number(total));
        if (!orderId || Number.isNaN(numTotal) || numTotal < 0 || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ success: false, error: 'Order ID, total numérico válido (no negativo) y productos son obligatorios.' }, { status: 400 });
        }

        for (const item of items) {
            const qty = Number(item.cantidad ?? item.quantity);
            const price = Number(item.precio ?? item.price);
            if (!item.productId && !item.id) {
                return NextResponse.json({ success: false, error: 'Cada producto debe tener un ID válido.' }, { status: 400 });
            }
            if (!Number.isInteger(qty) || qty <= 0) {
                return NextResponse.json({ success: false, error: 'La cantidad de cada producto debe ser un entero positivo mayor a cero.' }, { status: 400 });
            }
            if (Number.isNaN(price) || price < 0) {
                return NextResponse.json({ success: false, error: 'El precio de cada producto no puede ser negativo.' }, { status: 400 });
            }
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
            const resolvedOrderItems: Array<{ productId: string; cantidad: number; precio: number; initialReservedStock?: number }> = [];

            for (const item of items) {
                const prodId = item.productId || item.id;
                if (!prodId) {
                    throw new Error('Identificador de producto inválido en el pedido.');
                }
                const qty = Math.max(1, Math.round(Number(item.quantity ?? item.cantidad ?? 1)));

                // Paso A: Verificar existencia de producto en la base de datos y extraer precio oficial
                let current = await tx.product.findUnique({
                    where: { id: prodId },
                    select: { stock: true, reservedStock: true, id: true, name: true, price: true }
                });

                // Si no existe por ID, buscar por nombre
                if (!current && item.name) {
                    current = await tx.product.findFirst({
                        where: { name: item.name },
                        select: { stock: true, reservedStock: true, id: true, name: true, price: true }
                    });
                }

                // Si aún no existe en BD, crearlo con stock 0 (sin inventario fantasma)
                if (!current) {
                    const createdProd = await tx.product.create({
                        data: {
                            id: prodId,
                            tenantId,
                            name: item.name || `Producto ${prodId}`,
                            price: Number(item.price ?? item.precio ?? 0),
                            stock: 0,
                            reservedStock: 0,
                            category: item.category || 'General'
                        }
                    });
                    current = {
                        id: createdProd.id,
                        stock: createdProd.stock,
                        reservedStock: createdProd.reservedStock,
                        name: createdProd.name,
                        price: createdProd.price
                    };
                }

                const availableStock = current.stock - current.reservedStock;
                if (availableStock < qty) {
                    throw new Error(`INSUFFICIENT_STOCK: Inventario insuficiente para el producto "${current.name || prodId}". Disponible: ${availableStock}, solicitado: ${qty}.`);
                }

                // SEGURIDAD DE PRECIOS EN EL SERVIDOR (ANTI-TAMPERING):
                // Para órdenes de mostrador/catálogo de cliente, se impone el precio oficial de la base de datos.
                // Solo personal con rol de ventas/caja/admin puede aplicar descuentos o precios acordados.
                const isStaffWithDiscountPermission = staffSession.ok && ['superadmin', 'admin', 'sales', 'caja'].includes(staffSession.role);
                const officialPrice = roundMoney(Number(current.price ?? 0));
                const resolvedPrice = (isStaffWithDiscountPermission && (item.price !== undefined || item.precio !== undefined))
                    ? roundMoney(Number(item.price ?? item.precio ?? officialPrice))
                    : officialPrice;

                // El stock físico NO se descuenta aquí en la creación.
                // Se apartará en reservedStock al confirmar pago, y se descontará físicamente al validar entrega (PoD).
                resolvedOrderItems.push({
                    productId: current.id,
                    cantidad: qty,
                    precio: resolvedPrice,
                    initialReservedStock: current.reservedStock || 0
                });
            }

            const isClientOrder = Boolean(authenticatedCustomerId || body.asRequest || !staffSession.ok || paymentMethod === 'pago_caja');
            const initialStatus = isClientOrder
                ? 'pending_payment'
                : (body.status || 'paid');

            // RECALCULO DE TOTAL OBLIGATORIO EN EL SERVIDOR:
            const calculatedItemsTotal = resolvedOrderItems.reduce((acc, it) => acc + roundMoney(it.cantidad * it.precio), 0);
            const shippingCost = roundMoney(Number(body.shippingCost || body.costoEnvio || 0));
            const expectedTotal = roundMoney(calculatedItemsTotal + shippingCost);

            // Si es pedido de cliente o mostrador, se impone el total recalculado por el servidor
            const isStaffWithDiscountPermission = staffSession.ok && ['superadmin', 'admin', 'sales', 'caja'].includes(staffSession.role);
            let finalTotal = expectedTotal;
            if (!isClientOrder && isStaffWithDiscountPermission && !Number.isNaN(numTotal) && numTotal > 0) {
                finalTotal = numTotal;
            }

            // Si la orden nace pagada de inmediato, apartar en reservedStock con Control de Concurrencia Optimista (OCC):
            // Garantiza que si dos cajas compiten por la última pieza al mismo milisegundo, solo una gana la reserva.
            if (initialStatus === 'paid') {
                for (const roi of resolvedOrderItems) {
                    const occ = await tx.product.updateMany({
                        where: { 
                            id: roi.productId,
                            reservedStock: roi.initialReservedStock
                        },
                        data: { reservedStock: { increment: roi.cantidad } }
                    });
                    if (occ.count !== 1) {
                        throw new Error(`INSUFFICIENT_STOCK: El inventario de uno de los productos fue apartado concurrentemente por otra caja.`);
                    }
                }
            }

                    const isPending = ['pending_payment', 'pending_confirmation'].includes(initialStatus);

                    // 3. Creación de la Orden en el Pipeline Logístico
                    const order = await tx.order.create({
                        data: {
                            id: orderId,
                            tenantId,
                            total: finalTotal,
                            deliveryType: deliveryType || (deliveryMethod === 'repartidor' ? 'DELIVERY' : (['pickup', 'piso', 'tienda'].includes(deliveryMethod) ? 'PICKUP' : 'LOCAL')),
                            paymentMethod: isCashierRequest ? 'pago_caja' : paymentMethod || 'CASH',
                            status: initialStatus,
                            vendedorId: isCashierRequest ? null : body.vendedorId || null,
                            vendedorName: isCashierRequest ? null : body.vendedorName || null,
                            confirmedAt: isCashierRequest ? null : body.confirmedAt ? new Date(body.confirmedAt) : new Date(),
                            expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
                    deliveryPin: body.deliveryPin || null,
                    deliveryLat: typeof deliveryLat === 'number' ? deliveryLat : null,
                    deliveryLng: typeof deliveryLng === 'number' ? deliveryLng : null,
                    deliveryAddress: clientData?.address || null,
                    customerId: customerId,
                    items: {
                        create: resolvedOrderItems.map(roi => ({
                            productId: roi.productId,
                            cantidad: roi.cantidad,
                            precio: roi.precio
                        }))
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
                    details: JSON.stringify({ deliveryType, itemCount: items.length, total: finalTotal })
                }
            });
            return order;
        });

        // Registrar venta de forma monotónica e irreversible en disco (Anti-Tampering)
        // SOLO cuando la orden nace efectivamente cobrada (evita que carritos en espera consuman el límite de 120 ventas)
        const isPaidOnCreate = orderResult.status === 'paid' || orderResult.status === 'COMPLETED' || Boolean(orderResult.confirmedAt);
        const counterInfo = isPaidOnCreate ? recordPersistentSale(tenantId) : trialStatus;

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
                const appConfig = await prisma.appConfig.findUnique({ where: { id: 'global' } }).catch(() => null);
                const sovereignTenantId = appConfig?.tenantId || 'default';
                const isSubscribed = Boolean(appConfig && (appConfig as any).subscriptionStatus === 'active');
                const trialStatus = getSalesTrialStatus(sovereignTenantId, isSubscribed);
                if (trialStatus.isLocked) {
                    return NextResponse.json({
                        success: false,
                        error: 'Has completado tus 100 ventas de prueba + 20 ventas de cortesía (120 ventas). Activa tu suscripción mensual para continuar cobrando.',
                        code: 'SUBSCRIPTION_REQUIRED',
                        trialStatus
                    }, { status: 402 });
                }

                const order = await prisma.$transaction(async (tx) => {
                    const current = await tx.order.findUnique({ where: { id }, include: { items: true } });
                    if (!current || !cashierReadyStatuses.includes(current.status) || current.confirmedAt) {
                        throw new Error('ORDER_CONFLICT:El pedido no está listo o ya fue pagado.');
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

                    const isPickup = ['PICKUP', 'PATIO'].includes(current.deliveryType);
                    const isDelivery = current.deliveryType === 'DELIVERY';
                    const nextStatus = effectiveIsLoaded
                        ? isDelivery ? 'OUT_FOR_DELIVERY' : isPickup ? 'READY_FOR_PICKUP_PAID' : 'COMPLETED'
                        : 'paid';

                    // FLOTACIÓN ESTRICTA VS CIERRE INMEDIATO LOCAL:
                    // - Si nextStatus === 'COMPLETED' (venta directa LOCAL entregada en este mismo acto en mostrador),
                    //   se descuenta directamente el stock físico para no dejar reservedStock bloqueado en un estado terminal.
                    // - En todos los demás casos ('paid', 'READY_FOR_PICKUP_PAID', 'OUT_FOR_DELIVERY'), se aparta en reservedStock
                    //   con OCC y el stock físico se descuenta al validar la entrega con comprobante/firma (PoD).
                    for (const item of current.items) {
                        const product = await tx.product.findUnique({ where: { id: item.productId }, select: { stock: true, reservedStock: true } });
                        const initialReserved = product?.reservedStock || 0;
                        if (!product || (product.stock - initialReserved) < item.cantidad) {
                            throw new Error(`ORDER_CONFLICT:Inventario insuficiente para ${item.productId}.`);
                        }
                        if (nextStatus === 'COMPLETED') {
                            const occ = await tx.product.updateMany({
                                where: { id: item.productId, stock: product.stock, reservedStock: initialReserved },
                                data: { stock: { decrement: item.cantidad } }
                            });
                            if (occ.count !== 1) {
                                throw new Error(`ORDER_CONFLICT:Inventario modificado concurrentemente para ${item.productId}.`);
                            }
                        } else {
                            const occ = await tx.product.updateMany({
                                where: { id: item.productId, reservedStock: initialReserved },
                                data: { reservedStock: { increment: item.cantidad } }
                            });
                            if (occ.count !== 1) {
                                throw new Error(`ORDER_CONFLICT:Inventario apartado concurrentemente para ${item.productId}.`);
                            }
                        }
                    }

                    const updated = await tx.order.updateMany({
                        where: {
                            id,
                            status: current.status,
                            confirmedAt: null
                        },
                        data: {
                            status: nextStatus,
                            paymentMethod: updates.paymentMethod || 'cash',
                            confirmedAt: new Date(),
                            vendedorId: current.vendedorId || auth.uid,
                            vendedorName: current.vendedorName || actorName,
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

                const counterInfo = recordPersistentSale(sovereignTenantId);
                return NextResponse.json({ success: true, data: order, trialStatus: counterInfo });
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
            const current = await prisma.order.findUnique({ where: { id } });
            if (!current) return NextResponse.json({ success: false, error: 'Pedido no encontrado' }, { status: 404 });

            if (['DELIVERED', 'COMPLETED'].includes(current.status)) {
                return NextResponse.json({ success: false, error: 'No se puede desasignar un pedido que ya fue entregado.' }, { status: 409 });
            }

            if (current.loadedByUid && current.loadedByUid !== auth.uid && !['superadmin', 'admin', 'sales'].includes(actorRole)) {
                return NextResponse.json({ success: false, error: 'Solo el operador que tomó el pedido o un administrador pueden liberarlo.' }, { status: 403 });
            }

            const targetRole = body.targetRole || body.targetLocation || 'caja';
            await prisma.$transaction(async (tx) => {
                await tx.order.update({
                    where: { id },
                    data: {
                        vendedorId: targetRole === 'caja' ? null : current.vendedorId,
                        loadedByUid: null,
                        loadedBy: null
                    }
                });

                await writeOrderEvent(tx, {
                    orderId: id,
                    eventType: 'ORDER_DELEGATED',
                    fromStatus: current.status,
                    toStatus: current.status,
                    actorId: auth.uid,
                    actorName,
                    actorRole,
                    details: { delegatedTo: targetRole, reason: body.reason || 'Operador ocupado / Delegación rápida' }
                });
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
            const allowedRestockRoles = ['inventory', 'carga_descarga', 'admin', 'superadmin'];
            if (!allowedRestockRoles.includes(actorRole)) {
                return NextResponse.json({ success: false, error: 'Rol sin permiso para reincorporar productos a anaquel.' }, { status: 403 });
            }

            const updated = await prisma.$transaction(async (tx) => {
                const current = await tx.order.findUnique({ where: { id }, include: { items: true } });
                if (!current) throw new Error('ORDER_NOT_FOUND:Pedido no encontrado');

                // Idempotencia atómica dentro de la transacción:
                if (current.rejectionReason === 'CANCELADA_STOCK_RESTITUIDO') {
                    return current;
                }

                // Ventas cerradas y entregadas son inmutables sin previa devolución
                if (['DELIVERED', 'COMPLETED'].includes(current.status)) {
                    throw new Error('VENTA_CERRADA: El pedido ya fue entregado al cliente. No procede restitución a anaquel sin movimiento de recepción nuevo.');
                }

                // EXCLUSIÓN MUTUA ATÓMICA:
                // Previene condiciones de carrera si llegan dos peticiones de restitución simultáneas.
                // IMPORTANTE: En SQL, NULL <> 'CANCELADA_STOCK_RESTITUIDO' evalúa a falso/UNKNOWN.
                // Por ende, contemplamos explícitamente tanto rejectionReason: null como cualquier valor distinto.
                const lockUpdate = await tx.order.updateMany({
                    where: {
                        id,
                        OR: [
                            { rejectionReason: null },
                            { rejectionReason: { not: 'CANCELADA_STOCK_RESTITUIDO' } }
                        ],
                        status: { notIn: ['DELIVERED', 'COMPLETED'] }
                    },
                    data: {
                        isLoaded: false,
                        status: 'cancelled',
                        rejectionReason: 'CANCELADA_STOCK_RESTITUIDO'
                    }
                });
                if (lockUpdate.count !== 1) {
                    return current;
                }

                // PREVENCIÓN DE INFLACIÓN Y PROTECCIÓN DE RESERVAS:
                // 1. Si la orden fue devuelta de una entrega real (status === 'refunded'), se restituye físicamente a 'stock'.
                // 2. Si la orden ya estaba cancelada (status === 'cancelled'), la cancelación YA liberó su 'reservedStock'.
                //    NO se debe volver a restar de reservedStock para no liberar reservas de OTROS pedidos activos.
                // 3. Si la orden aún NO estaba cancelada (ej. paid o READY_FOR_PICKUP_PAID), se libera su reserva legítima una sola vez.
                const wasPhysicalStockDeducted = current.status === 'refunded';
                const wasAlreadyCancelled = current.status === 'cancelled';

                for (const item of current.items) {
                    if (wasPhysicalStockDeducted) {
                        await tx.product.update({
                            where: { id: item.productId },
                            data: { stock: { increment: item.cantidad } }
                        });
                    } else if (!wasAlreadyCancelled && (current.status === 'paid' || current.status === 'READY_FOR_PICKUP_PAID')) {
                        const prod = await tx.product.findUnique({
                            where: { id: item.productId },
                            select: { reservedStock: true }
                        });
                        if (prod && prod.reservedStock > 0) {
                            await tx.product.update({
                                where: { id: item.productId },
                                data: { reservedStock: { decrement: Math.min(prod.reservedStock, item.cantidad) } }
                            });
                        }
                    }
                }

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
                        returnedItemsCount: current.items.length,
                        wasPhysicalStockRestored: wasPhysicalStockDeducted
                    }
                });

                return tx.order.findUnique({ where: { id }, include: { items: true, customer: true } });
            });

            return NextResponse.json({ success: true, data: updated, message: 'Artículos reincorporados al anaquel exitosamente. Inventario protegido contra duplicidad e inflación.' });
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

                // RECHAZO EXPLÍCITO: Si el pedido ya fue entregado o está cancelado
                if (['DELIVERED', 'COMPLETED'].includes(current.status)) {
                    throw new Error('ORDER_CONFLICT:El pedido ya fue entregado al cliente.');
                }
                if (current.status === 'cancelled') {
                    throw new Error('ORDER_CONFLICT:El pedido está cancelado.');
                }
                if (!current.confirmedAt && current.status !== 'paid' && current.status !== 'READY_FOR_PICKUP_PAID') {
                    throw new Error('ORDER_CONFLICT:El cliente debe pagar primero en Caja antes de recibir la mercancía.');
                }
                if (!current.isLoaded) {
                    throw new Error('ORDER_CONFLICT:El pedido aún está siendo preparado en almacén.');
                }

                const signatureData = updates.signatureData || body.signatureData || null;
                const photoData = updates.photoData || body.photoData || null;

                // TRANSICIÓN CONDICIONAL ATÓMICA ANTES DE DEDUCIR STOCK:
                // Si otra petición concurrente ya entregó el pedido, updated.count será 0 y la transacción abortará.
                const updated = await tx.order.updateMany({
                    where: { 
                        id, 
                        status: { notIn: ['DELIVERED', 'COMPLETED', 'cancelled'] }
                    },
                    data: { 
                        status: 'DELIVERED', 
                        completedAt: new Date(),
                        confirmedAt: current.confirmedAt || new Date(),
                        ...(signatureData ? { signatureData } : {}),
                        ...(photoData ? { photoData } : {})
                    }
                });
                if (updated.count !== 1) {
                    throw new Error('ORDER_CONFLICT:El pedido ya fue cerrado o entregado por otro operador.');
                }

                // DEDUCCIÓN FINAL AL VALIDAR ENTREGA EN TIENDA / PATIO:
                // Se descuenta físicamente de 'stock' y se limpia la reserva 'reservedStock'.
                for (const item of current.items) {
                    const prod = await tx.product.findUnique({ where: { id: item.productId }, select: { reservedStock: true } });
                    const newReserved = Math.max(0, (prod?.reservedStock || 0) - item.cantidad);
                    await tx.product.update({
                        where: { id: item.productId },
                        data: {
                            stock: { decrement: item.cantidad },
                            reservedStock: newReserved
                        }
                    });
                }

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

        // SEGURIDAD RBAC CONTRA MASS-ASSIGNMENT:
        // Ningún rol sin permisos de caja puede marcar pagado ni alterar importes por el fallback genérico.
        if (updates.status === 'paid' && !cashierRoles.includes(actorRole)) {
            return NextResponse.json({ success: false, error: 'Rol sin permiso para marcar pedidos como pagados.' }, { status: 403 });
        }
        if (updates.total !== undefined && !['superadmin', 'admin'].includes(actorRole)) {
            return NextResponse.json({ success: false, error: 'Solo un administrador puede modificar el importe total de una orden.' }, { status: 403 });
        }

        const baseAllowedFields = [
            'status', 'deliveryType', 'offline', 'synced', 'ventanilla', 'cajon',
            'deliveryPin', 'deliveryLat', 'deliveryLng', 'deliveryAddress',
            'loadedBy', 'loadedByUid', 'loadingStartedAt', 'loadingFinishedAt',
            'isLoaded', 'assignedDriverId', 'signatureData', 'photoData',
            'completedAt', 'rejectionReason', 'expiresAt'
        ];
        const allowedFields = [
            ...baseAllowedFields,
            ...(cashierRoles.includes(actorRole) ? ['paymentMethod', 'vendedorId', 'vendedorName', 'confirmedAt', 'customerId'] : []),
            ...(['superadmin', 'admin'].includes(actorRole) ? ['total', 'date'] : [])
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
            // Regla inquebrantable de inventario real: Las ventas finalizadas y entregadas son inmutables
            if (['DELIVERED', 'COMPLETED'].includes(current.status)) {
                return NextResponse.json({ 
                    success: false, 
                    error: 'VENTA_CERRADA_INMUTABLE: El pedido ya fue entregado y la venta está cerrada. No se puede cancelar para evitar recuentos de stock fantasma.' 
                }, { status: 409 });
            }

            if (!prismaUpdates.rejectionReason) {
                prismaUpdates.rejectionReason = current.isLoaded ? 'CANCELADO_PENDIENTE_REACOMODO' : 'CANCELADA_POR_USUARIO';
            }
            order = await prisma.$transaction(async (tx) => {
                const changed = await tx.order.updateMany({
                    where: { id, status: current.status },
                    data: prismaUpdates
                });
                if (changed.count !== 1) throw new Error('ORDER_CONFLICT:El pedido cambió mientras se cancelaba.');

                // CANCELACIÓN EN VIVO:
                // Si la orden tenía stock apartado en 'reservedStock' (pedido pagado/confirmado),
                // se libera la reserva limpiando el apartado sin tocar stock físico.
                const hadReservedStock = Boolean(
                    current.confirmedAt ||
                    ['paid', 'READY_FOR_PICKUP_PAID', 'READY_TO_SHIP', 'OUT_FOR_DELIVERY'].includes(current.status)
                );
                if (hadReservedStock) {
                    for (const item of current.items) {
                        const prod = await tx.product.findUnique({ where: { id: item.productId }, select: { reservedStock: true } });
                        const newReserved = Math.max(0, (prod?.reservedStock || 0) - item.cantidad);
                        await tx.product.update({ 
                            where: { id: item.productId }, 
                            data: { reservedStock: newReserved } 
                        });
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
                    details: { 
                        stockReservedReleased: hadReservedStock,
                        pendingReacomodo: Boolean(current.isLoaded)
                    }
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
                        const prod = await tx.product.findUnique({ where: { id: item.productId }, select: { reservedStock: true } });
                        const newReserved = Math.max(0, (prod?.reservedStock || 0) - item.cantidad);
                        await tx.product.update({
                            where: { id: item.productId },
                            data: {
                                stock: { decrement: item.cantidad },
                                reservedStock: newReserved
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
        if (String(error.message).startsWith('ORDER_NOT_FOUND:')) {
            return NextResponse.json({ success: false, error: String(error.message).replace('ORDER_NOT_FOUND:', '') }, { status: 404 });
        }
        if (String(error.message).startsWith('VENTA_CERRADA:')) {
            return NextResponse.json({ success: false, error: error.message }, { status: 409 });
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

        await prisma.$transaction(async (tx) => {
            // Si tenía stock descontado o apartado y no estaba cancelado ni reembolsado, restaurar atómicamente:
            if ((current.confirmedAt || current.status === 'paid') && !['cancelled', 'refunded'].includes(current.status)) {
                const wasPhysicalStockDeducted = current.status === 'DELIVERED' || current.status === 'COMPLETED';
                for (const item of current.items) {
                    if (wasPhysicalStockDeducted) {
                        await tx.product.update({
                            where: { id: item.productId },
                            data: { stock: { increment: item.cantidad } }
                        });
                    } else {
                        const prod = await tx.product.findUnique({
                            where: { id: item.productId },
                            select: { reservedStock: true }
                        });
                        if (prod && prod.reservedStock > 0) {
                            await tx.product.update({
                                where: { id: item.productId },
                                data: { reservedStock: Math.max(0, prod.reservedStock - item.cantidad) }
                            });
                        }
                    }
                }
            }

            await tx.order.delete({
                where: { id }
            });
        });

        return NextResponse.json({ success: true, message: 'Pedido eliminado correctamente.' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

