import { NextResponse } from 'next/server';
import { prisma } from '@bunkker/core';

export async function GET() {
    try {
        const products = await prisma.product.findMany();
        return NextResponse.json({ success: true, data: products });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        
        const product = await prisma.product.upsert({
            where: { id: body.id },
            update: body,
            create: body,
        });

        await prisma.syncQueue.create({
            data: {
                collection: 'products',
                documentId: product.id,
                action: 'UPSERT',
                payload: JSON.stringify(product)
            }
        });

        return NextResponse.json({ success: true, data: product });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, stockIncrement } = body;
        
        if (!id || typeof stockIncrement !== 'number') {
            throw new Error('id and stockIncrement are required');
        }

        const product = await prisma.product.update({
            where: { id },
            data: {
                stock: { increment: stockIncrement }
            }
        });

        await prisma.syncQueue.create({
            data: {
                collection: 'products',
                documentId: product.id,
                action: 'UPSERT',
                payload: JSON.stringify(product)
            }
        });

        return NextResponse.json({ success: true, data: product });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        
        if (!id) throw new Error('Product ID is required');

        await prisma.product.delete({
            where: { id }
        });

        await prisma.syncQueue.create({
            data: {
                collection: 'products',
                documentId: id,
                action: 'DELETE',
                payload: JSON.stringify({ id })
            }
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
