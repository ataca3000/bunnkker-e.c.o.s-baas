import { auth } from '@/lib/firebase';

/**
 * CLIENT-SIDE BILLING WRAPPER
 * No tiene llaves de API. Todo se envía al servidor seguro /api/billing
 * Incluye token de autenticación para verificación en el servidor.
 */
export async function createSATInvoice(data: Record<string, unknown>) {
    try {
        const currentUser = auth.currentUser;
        const idToken = currentUser ? await currentUser.getIdToken() : '';

        const response = await fetch('/api/billing', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify(data),
        });

        return await response.json();
    } catch {
        return { success: false, error: 'Error de conexión con el nodo de facturación.' };
    }
}

export async function downloadInvoiceFiles(invoiceId: string) {
    try {
        const currentUser = auth.currentUser;
        const idToken = currentUser ? await currentUser.getIdToken() : '';

        const response = await fetch(`/api/billing/download?id=${invoiceId}&type=pdf`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
        });

        if (!response.ok) throw new Error('Error al descargar');

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `factura_${invoiceId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
    } catch {
        // Fallback: abrir en nueva pestaña
        window.open(`/api/billing/download?id=${invoiceId}&type=pdf`, '_blank');
    }
}
