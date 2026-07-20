import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/apiAuth';
import fs from 'fs';
import path from 'path';

export async function GET(request: NextRequest) {
    const auth = requireRole(request, ['superadmin', 'admin']);
    if (!auth.ok) return auth.response;

    try {
        // Fetch all tables
        const products = await prisma.product.findMany();
        const orders = await prisma.order.findMany({ include: { items: true } });
        const customers = await prisma.customer.findMany();
        const users = await prisma.user.findMany();
        const shrinkage = await prisma.shrinkageLog.findMany();

        const backupData = {
            timestamp: new Date().toISOString(),
            version: '1.0',
            data: {
                products,
                orders,
                customers,
                users,
                shrinkage
            }
        };

        return new NextResponse(JSON.stringify(backupData, null, 2), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="camaleon_backup_${Date.now()}.json"`
            }
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = requireRole(request, ['superadmin', 'admin']);
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json();
        if (!body || !body.data || body.version !== '1.0') {
            throw new Error('Archivo de respaldo inválido o incompatible.');
        }

        const { 
            products = [], 
            orders = [], 
            customers = [], 
            users = [], 
            shrinkage = [] 
        } = body.data || {};

        // Perform restore inside a massive transaction
        await prisma.$transaction(async (tx) => {
            // Clear existing
            await tx.orderItem.deleteMany();
            await tx.order.deleteMany();
            await tx.product.deleteMany();
            await tx.customer.deleteMany();
            // Optional: Don't delete users to avoid locking out the admin who is restoring
            // Or maybe upsert users? Let's just upsert everything to be safe.
            
            // 1. Restore Products
            for (const p of products) {
                await tx.product.upsert({ where: { id: p.id }, update: p, create: p });
            }
            
            // 2. Restore Customers
            for (const c of customers) {
                await tx.customer.upsert({ where: { id: c.id }, update: c, create: c });
            }
            
            // 3. Restore Orders (and items)
            for (const o of orders) {
                const { items, ...orderData } = o;
                await tx.order.upsert({
                    where: { id: o.id },
                    update: orderData,
                    create: orderData
                });
                
                for (const item of items) {
                    await tx.orderItem.upsert({
                        where: { id: item.id },
                        update: item,
                        create: item
                    });
                }
            }

            // 4. Restore Shrinkage Logs
            for (const s of shrinkage) {
                await tx.shrinkageLog.upsert({ where: { id: s.id }, update: s, create: s });
            }
            
            // 5. Restore Users (Avoid overwriting current superadmin PIN unless forced)
            for (const u of users) {
                await tx.user.upsert({ where: { id: u.id }, update: u, create: u });
            }
        });

        return NextResponse.json({ success: true, message: 'Respaldo restaurado exitosamente' });
    } catch (error: any) {
        console.error('Error during restore:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
