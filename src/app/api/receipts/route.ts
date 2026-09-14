import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole, WRITE_ROLES } from '@/lib/apiAuth';

export async function POST(request: NextRequest) {
  const auth = requireRole(request, WRITE_ROLES);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { orderId, paymentMethod = 'DIGITAL', cashierId, cashierName } = body;
    if (!orderId || !cashierId || !cashierName) {
      return NextResponse.json({ success: false, error: 'Faltan datos del cobro.' }, { status: 400 });
    }

    const tenantId = request.headers.get('x-tenant-id') || 'default-local';
    const result = await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({ where: { id: orderId, tenantId }, include: { customer: true } });
      if (!order) throw new Error('Pedido no encontrado.');
      if (order.status === 'cancelled') throw new Error('No se puede cobrar un pedido cancelado.');

      const existing = await tx.digitalReceipt.findFirst({ where: { orderId } });
      if (existing) return existing;

      const receipt = await tx.digitalReceipt.create({
        data: {
          tenantId, orderId, cashierId, cashierName,
          customerId: order.customerId,
          total: order.total,
          paymentMethod,
          receiptNumber: `T-${Date.now()}-${orderId.slice(-6).toUpperCase()}`
        }
      });
      await tx.order.update({ where: { id: orderId }, data: { status: 'PAID', paidAt: new Date(), vendedorId: cashierId, vendedorName: cashierName } });
      return receipt;
    });

    return NextResponse.json({ success: true, receipt: result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, WRITE_ROLES);
  if (!auth.ok) return auth.response;
  const tenantId = request.headers.get('x-tenant-id') || 'default-local';
  const receipts = await prisma.digitalReceipt.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 200 });
  return NextResponse.json({ success: true, receipts });
}
