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

        // 2. Intentar ALTER TABLE directamente y capturar error exacto
        try {
            await prisma.$executeRawUnsafe(`ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "tenantId" TEXT DEFAULT 'default'`);
            results.alterTableOrder = 'SUCCESS';
        } catch (e: any) {
            results.alterTableOrderError = e.message;
        }

        try {
            await prisma.$executeRawUnsafe(`ALTER TABLE "OrderEvent" ADD COLUMN IF NOT EXISTS "tenantId" TEXT DEFAULT 'default'`);
            results.alterTableEvent = 'SUCCESS';
        } catch (e: any) {
            results.alterTableEventError = e.message;
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
