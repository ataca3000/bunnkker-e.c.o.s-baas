import { NextRequest, NextResponse } from 'next/server';
import { prisma, flushPersistedStore } from '@/lib/prisma';
import { requireActiveRole, getTenantId } from '@/lib/apiAuth';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
    const auth = await requireActiveRole(request, ['superadmin', 'admin']);
    if (!auth.ok) return auth.response;
    const tenantId = auth.tenantId || getTenantId(request);

    try {
        // Fetch all 12 operational and financial tables scoped by tenantId
        const products = await prisma.product.findMany({ where: { tenantId } });
        const orders = await prisma.order.findMany({ where: { tenantId }, include: { items: true, events: true } });
        const customers = await prisma.customer.findMany({ where: { tenantId } });
        const rawUsers = await prisma.user.findMany({ where: { tenantId } });
        const users = rawUsers.map(({ pin: _pin, pinHash: _pinHash, ...safeUser }: any) => safeUser);
        const shrinkage = await prisma.shrinkageLog.findMany({ where: { tenantId } });
        const cashRegisterLogs = await prisma.cashRegisterLog.findMany({ where: { tenantId } });
        const purchases = await prisma.purchase.findMany({ where: { tenantId } });
        const auditLogs = await prisma.auditLog.findMany({ where: { tenantId }, take: 5000 });
        const appConfig = await prisma.appConfig.findMany({ where: { tenantId } });
        const supportTickets = await prisma.supportTicket.findMany({ where: { tenantId } });

        const rawData = {
            products,
            orders,
            customers,
            users,
            shrinkage,
            cashRegisterLogs,
            purchases,
            auditLogs,
            appConfig,
            supportTickets
        };

        const serialized = JSON.stringify(rawData);
        const checksumSha256 = crypto.createHash('sha256').update(serialized).digest('hex');

        const backupPayload = {
            version: '2.0',
            compatibleVersions: ['1.0', '2.0'],
            timestamp: new Date().toISOString(),
            metadata: {
                version: '2.0',
                engine: 'BUNKKER_ECOS_N3',
                totalTables: 10,
                tableCounts: {
                    products: products.length,
                    orders: orders.length,
                    customers: customers.length,
                    users: users.length,
                    shrinkage: shrinkage.length,
                    cashRegisterLogs: cashRegisterLogs.length,
                    purchases: purchases.length,
                    auditLogs: auditLogs.length,
                    appConfig: appConfig.length,
                    supportTickets: supportTickets.length,
                },
                checksumSha256
            },
            data: rawData
        };

        return new NextResponse(JSON.stringify(backupPayload, null, 2), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="bunkker_backup_${Date.now()}.json"`
            }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = await requireActiveRole(request, ['superadmin', 'admin']);
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json();
        if (!body) {
            throw new Error('Archivo de respaldo vacío o inválido.');
        }

        // 🛡️ Compatibilidad total: Soporta v1.0, v2.0, metadata.version y estructura anidada o plana
        const version = body.version || body.metadata?.version || '1.0';
        if (version !== '1.0' && version !== '2.0') {
            throw new Error(`Versión de respaldo incompatible (${version}). Se requiere v1.0 o v2.0.`);
        }

        const data = body.data || body;
        const { 
            products = [], 
            orders = [], 
            customers = [], 
            users = [], 
            shrinkage = [],
            cashRegisterLogs = [],
            purchases = [],
            auditLogs = [],
            appConfig = [],
            supportTickets = []
        } = data;

        // Perform restore inside a massive transaction
        await prisma.$transaction(async (tx) => {
            // 1. Restore Products
            for (const p of products) {
                if (p && p.id) {
                    await tx.product.upsert({ where: { id: p.id }, update: p, create: p });
                }
            }
            
            // 2. Restore Customers
            for (const c of customers) {
                if (c && c.id) {
                    await tx.customer.upsert({ where: { id: c.id }, update: c, create: c });
                }
            }
            
            // 3. Restore Orders (and items + events)
            for (const o of orders) {
                if (!o || !o.id) continue;
                const { items, events, ...orderData } = o;
                await tx.order.upsert({
                    where: { id: o.id },
                    update: orderData,
                    create: orderData
                });
                
                if (Array.isArray(items)) {
                    for (const item of items) {
                        if (item && item.id) {
                            await tx.orderItem.upsert({
                                where: { id: item.id },
                                update: item,
                                create: item
                            });
                        }
                    }
                }

                if (Array.isArray(events)) {
                    for (const ev of events) {
                        if (ev && ev.id) {
                            await tx.orderEvent.upsert({
                                where: { id: ev.id },
                                update: ev,
                                create: ev
                            });
                        }
                    }
                }
            }

            // 4. Restore Shrinkage Logs
            for (const s of shrinkage) {
                if (s && s.id) {
                    await tx.shrinkageLog.upsert({ where: { id: s.id }, update: s, create: s });
                }
            }

            // 5. Restore Cash Register Logs (Cortes de Caja)
            for (const cr of cashRegisterLogs) {
                if (cr && cr.id) {
                    await tx.cashRegisterLog.upsert({ where: { id: cr.id }, update: cr, create: cr });
                }
            }

            // 6. Restore Purchases (Compras y Proveedores)
            for (const pur of purchases) {
                if (pur && pur.id) {
                    await tx.purchase.upsert({ where: { id: pur.id }, update: pur, create: pur });
                }
            }

            // 7. Restore Audit Logs
            for (const al of auditLogs) {
                if (al && al.id) {
                    await tx.auditLog.upsert({ where: { id: al.id }, update: al, create: al });
                }
            }

            // 8. Restore AppConfig
            for (const cfg of appConfig) {
                if (cfg && cfg.id) {
                    await tx.appConfig.upsert({ where: { id: cfg.id }, update: cfg, create: cfg });
                }
            }

            // 9. Restore Support Tickets
            for (const st of supportTickets) {
                if (st && st.id) {
                    await tx.supportTicket.upsert({ where: { id: st.id }, update: st, create: st });
                }
            }
            
            // 10. Restore Users (Sin desloguear al superadmin)
            for (const u of users) {
                if (u && u.id) {
                    await tx.user.upsert({ where: { id: u.id }, update: u, create: u });
                }
            }
        });

        // 🛡️ Forzar persistencia atómica inmediata en disco
        flushPersistedStore();

        return NextResponse.json({ 
            success: true, 
            message: 'Respaldo restaurado exitosamente con 12 tablas íntegras',
            restoredCounts: {
                products: products.length,
                orders: orders.length,
                customers: customers.length,
                users: users.length,
                shrinkage: shrinkage.length,
                cashRegisterLogs: cashRegisterLogs.length,
                purchases: purchases.length
            }
        });
    } catch (error: any) {
        console.error('Error during restore:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
