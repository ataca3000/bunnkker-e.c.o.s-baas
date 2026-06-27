import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb } from '@bunkker/core';

// Reemplaza con tu Webhook Secret real desde la configuración de tu GitHub App
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'secret_de_prueba_local';

/**
 * Verifica la firma criptográfica de GitHub para asegurar que el request sea legítimo
 */
async function verifySignature(req: NextRequest, rawBody: string) {
    const signatureHeader = req.headers.get('x-hub-signature-256');
    if (!signatureHeader) return false;

    const signature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');
    
    const expectedSignature = `sha256=${signature}`;
    
    try {
        return crypto.timingSafeEqual(
            Buffer.from(signatureHeader),
            Buffer.from(expectedSignature)
        );
    } catch (e) {
        return false; // Por si las longitudes no coinciden
    }
}

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const isValid = await verifySignature(request, rawBody);

        if (!isValid) {
            console.error('[GitHub Webhook] Firma inválida. Rechazando request.');
            return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
        }

        const payload = JSON.parse(rawBody);
        const event = request.headers.get('x-github-event');

        console.log(`[GitHub Webhook] Evento recibido: ${event}`);

        // Manejar instalación de la aplicación
        if (event === 'installation' && payload.action === 'created') {
            const installationId = payload.installation.id;
            const account = payload.installation.account;
            
            console.log(`[GitHub App] Nueva instalación (ID: ${installationId}) por ${account.login}`);
            
            // Generar un Tenant ID único
            const clientName = account.login;
            const tenantId = clientName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Math.floor(Math.random() * 10000);
            const domain = `${tenantId}.admin.com`;
            
            // Guardar en la base de datos de Firebase
            if (adminDb) {
                // 1. Aprovisionar Tenant en la base de datos maestra
                await adminDb.collection('tenants_registry').doc(tenantId).set({
                    clientName,
                    adminEmail: '', // El usuario lo llenará luego en el Setup
                    domain,
                    status: 'ACTIVE',
                    dbNamespace: `tenants/${tenantId}`,
                    createdAt: new Date().toISOString(),
                    source: 'github_app',
                    installationId: String(installationId),
                    isPremium: false // Empieza como Freemium
                });

                // 2. Guardar el registro de instalación de GitHub ligado al Tenant
                await adminDb.collection('github_installations').doc(String(installationId)).set({
                    accountId: account.id,
                    login: account.login,
                    type: account.type, // User o Organization
                    tenantId,
                    domain,
                    installedAt: new Date().toISOString(),
                    status: 'active'
                });
            }
        }

        // Manejar eliminación de la aplicación
        if (event === 'installation' && payload.action === 'deleted') {
            const installationId = payload.installation.id;
            console.log(`[GitHub App] Instalación eliminada (ID: ${installationId})`);
            
            if (adminDb) {
                await adminDb.collection('github_installations').doc(String(installationId)).update({
                    status: 'deleted',
                    deletedAt: new Date().toISOString()
                });
            }
        }

        // Manejar compras en el Marketplace (Suscripciones)
        if (event === 'marketplace_purchase') {
            const action = payload.action; // 'purchased', 'cancelled', 'changed', 'pending_change'
            const purchase = payload.marketplace_purchase;
            
            console.log(`[Marketplace] Acción: ${action}. Plan: ${purchase.plan.name}`);

            if (adminDb) {
                // Registrar el evento de compra para el Audit Trail
                await adminDb.collection('github_purchases').add({
                    action,
                    accountId: purchase.account.id,
                    login: purchase.account.login,
                    planId: purchase.plan.id,
                    planName: purchase.plan.name,
                    timestamp: new Date().toISOString()
                });

                // Actualizar la instancia (Tenant) para habilitar módulos Premium
                if (action === 'purchased' || action === 'changed') {
                    // Buscar la instalación de este usuario para obtener su tenantId
                    const installQuery = await adminDb.collection('github_installations')
                        .where('accountId', '==', purchase.account.id)
                        .limit(1)
                        .get();
                    
                    if (!installQuery.empty) {
                        const tenantId = installQuery.docs[0].data().tenantId;
                        if (tenantId) {
                            await adminDb.collection('tenants_registry').doc(tenantId).update({
                                isPremium: true,
                                planName: purchase.plan.name,
                                updatedAt: new Date().toISOString()
                            });
                            console.log(`[Marketplace] Tenant ${tenantId} actualizado a plan Premium (${purchase.plan.name}).`);
                        }
                    }
                }
            }
        }

        return NextResponse.json({ success: true }, { status: 200 });

    } catch (error: any) {
        console.error('[GitHub Webhook Error]', error);
        return NextResponse.json({ error: 'Error interno procesando webhook' }, { status: 500 });
    }
}
