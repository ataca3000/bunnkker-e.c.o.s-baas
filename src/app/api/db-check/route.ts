import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    const results: any = {};
    try {
        // 1. Ver columnas actuales de la tabla Order
        try {
            const columns = await prisma.$queryRawUnsafe(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'Order' OR table_name = 'order' OR table_name = 'orders';
            `);
            results.columns = columns;
        } catch (e: any) {
            results.columnsError = e.message;
        }

        // 2. Intentar ALTER TABLE en todas las tablas con tenantId
        const tablesToPatch = [
            'Order',
            'OrderItem',
            'OrderEvent',
            'Customer',
            'Product',
            'SyncQueue',
            'AuditLog',
            'SupportTicket',
            'Purchase',
            'User',
            'ShrinkageLog',
            'SwarmTransaction'
        ];
        results.patches = {};
        for (const tbl of tablesToPatch) {
            try {
                await prisma.$executeRawUnsafe(`ALTER TABLE "${tbl}" ADD COLUMN IF NOT EXISTS "tenantId" TEXT DEFAULT 'default'`);
                results.patches[tbl] = 'OK';
            } catch (e: any) {
                results.patches[tbl] = e.message;
            }
        }

        // 2b. Ver columnas de OrderItem
        try {
            results.orderItemColumns = await prisma.$queryRawUnsafe(`
                SELECT column_name FROM information_schema.columns WHERE table_name = 'OrderItem';
            `);
        } catch (e: any) {
            results.orderItemColumnsError = e.message;
        }

        // 3. Ver tablas que existen en la BD
        try {
            const tables = await prisma.$queryRawUnsafe(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public';
            `);
            results.tables = tables;
        } catch (e: any) {
            results.tablesError = e.message;
        }

        return NextResponse.json({ ok: true, results });
    } catch (globalError: any) {
        return NextResponse.json({ ok: false, error: globalError.message }, { status: 500 });
    }
}
