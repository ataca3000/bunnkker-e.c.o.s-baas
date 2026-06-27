import { NextResponse } from 'next/server';
import { adminDb, auth } from '@bunkker/core';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: Request) {
    try {
        // 1. Verificar Identidad
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'No autorizado: Falta Token' }, { status: 401 });
        }

        const idToken = authHeader.split('Bearer ')[1];
        let decodedToken;
        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch (e) {
            return NextResponse.json({ error: 'Token inválido o expirado' }, { status: 401 });
        }
        
        const userId = decodedToken.uid;
        
        // 2. Extraer Payload del carrito
        const { tenantId, items, customerData, requiresInvoice = false, isOnline = true } = await req.json();

        if (!tenantId || !items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: 'Faltan datos obligatorios o el carrito está vacío' }, { status: 400 });
        }

        const batch = adminDb.batch();
        let orderTotal = 0;
        const verifiedItems = [];

        // 3. Validar cada item contra Firestore (Precios Reales)
        for (const item of items) {
            if (!item.id || !item.quantity || item.quantity <= 0) {
                return NextResponse.json({ error: 'Item inválido en el carrito' }, { status: 400 });
            }

            const productRef = adminDb.collection('products').doc(item.id);
            const productSnap = await productRef.get();

            if (!productSnap.exists) {
                return NextResponse.json({ error: `El producto ${item.id} no existe` }, { status: 404 });
            }

            const productData = productSnap.data();
            
            // Seguridad Multi-Tenant
            if (productData?.tenantId !== tenantId) {
                 return NextResponse.json({ error: `El producto ${item.id} no pertenece a esta tienda` }, { status: 403 });
            }

            // Validar Stock
            if ((productData?.stock || 0) < item.quantity) {
                return NextResponse.json({ error: `Stock insuficiente para ${productData?.name}` }, { status: 400 });
            }

            // Usar el precio REAL de la DB
            const realPrice = productData?.price || 0;
            orderTotal += (realPrice * item.quantity);
            
            verifiedItems.push({
                ...item,
                price: realPrice,
                name: productData?.name || item.name,
                image: productData?.image || item.image || '',
            });

            // Descontar Stock Inmediatamente
            batch.update(productRef, {
                stock: FieldValue.increment(-item.quantity)
            });
        }

        // 4. Calcular Fees del ERP
        const developerFee = isOnline ? (requiresInvoice ? 6 : 1) : 0;
        const ownerAutomationFee = isOnline ? (requiresInvoice ? 5 : 0) : 0;
        orderTotal += (developerFee + ownerAutomationFee);

        if (isOnline) {
            const ownerConfigRef = adminDb.collection('settings').doc('owner_config');
            batch.update(ownerConfigRef, {
                maintenanceCredits: FieldValue.increment(-developerFee),
                automationProfit: FieldValue.increment(ownerAutomationFee),
            });
        }

        // 5. Crear la Orden
        const orderId = `ORD-${Date.now().toString().slice(-6)}`;
        const orderRef = adminDb.collection('orders').doc(orderId);
        
        batch.set(orderRef, {
            id: orderId,
            tenantId,
            customer: customerData || { name: decodedToken.name || 'Cliente Online', phone: '' },
            customerEmail: decodedToken.email || '',
            items: verifiedItems,
            total: orderTotal,
            developerFee,
            ownerAutomationFee,
            date: new Date().toISOString(),
            status: customerData?.deliveryMethod === 'repartidor' ? 'pending_delivery' : 'paid',
            paymentMethod: 'Online',
            requiresInvoice,
            deliveryMethod: customerData?.deliveryMethod || 'tienda',
            createdAt: FieldValue.serverTimestamp(),
            stockDeducted: true,
            userId: userId
        });

        // 6. Auditoría Inmutable
        const auditRef = adminDb.collection('audit_logs').doc();
        batch.set(auditRef, {
            type: 'ORDER_CREATE_ONLINE',
            userId: userId,
            userName: decodedToken.email || 'Cliente Online',
            userRole: 'client',
            description: `Pedido Seguro Online: ${orderId} por $${orderTotal}`,
            metadata: { orderId, total: orderTotal, stockDeducted: true },
            createdAt: FieldValue.serverTimestamp()
        });

        // Ejecutar Transacción
        await batch.commit();

        return NextResponse.json({ success: true, orderId, total: orderTotal });

    } catch (error: any) {
        console.error("Error en Store Checkout API:", error);
        return NextResponse.json(
            { error: error.message || 'Error interno procesando el pedido' },
            { status: 500 }
        );
    }
}
