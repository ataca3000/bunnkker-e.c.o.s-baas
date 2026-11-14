import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { requireRole } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import { adminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    const auth = requireRole(request, ['superadmin']);
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json();
        const clientName = typeof body?.clientName === 'string' ? body.clientName.trim() : '';
        const adminEmail = typeof body?.adminEmail === 'string' ? body.adminEmail.trim().toLowerCase() : '';
        const modules = Array.isArray(body?.modules) ? body.modules.filter((m: unknown) => typeof m === 'string') : [];
        const country = typeof body?.country === 'string' && body.country.trim() ? body.country.trim() : 'MX';
        const currency = typeof body?.currency === 'string' && body.currency.trim() ? body.currency.trim() : 'MXN';

        if (!clientName || !adminEmail) {
            return NextResponse.json(
                { error: 'Faltan datos requeridos (clientName, adminEmail)' },
                { status: 400 }
            );
        }

        const slug = clientName
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'tenant';
        const suffix = crypto.randomBytes(3).toString('hex');
        const tenantId = `${slug}-${suffix}`;

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/+$/, '') || 'http://localhost:3000';
        const domain = `${tenantId}.bunkker.local`;
        const accessUrl = `${baseUrl}/?tenant=${encodeURIComponent(tenantId)}`;
        const createdAt = new Date().toISOString();

        const tenantRecord = {
            tenantId,
            clientName,
            adminEmail,
            modules,
            country,
            currency,
            domain,
            accessUrl,
            status: 'ACTIVE',
            dbNamespace: `tenants/${tenantId}`,
            createdAt,
            createdBy: auth.uid,
        };

        // 1. Persistir registro real de tenant en base de datos local (Prisma)
        const existingConfig = await prisma.integrationConfig.findFirst({
            where: { tenantId, provider: 'tenant_registry' },
        });
        if (existingConfig) {
            await prisma.integrationConfig.update({
                where: { id: existingConfig.id },
                data: {
                    settings: JSON.stringify(tenantRecord),
                    status: 'connected',
                    updatedBy: auth.uid,
                },
            });
        } else {
            await prisma.integrationConfig.create({
                data: {
                    tenantId,
                    provider: 'tenant_registry',
                    settings: JSON.stringify(tenantRecord),
                    status: 'connected',
                    updatedBy: auth.uid,
                },
            });
        }

        await prisma.auditLog.create({
            data: {
                tenantId,
                action: 'TENANT_DEPLOYED',
                details: JSON.stringify({ tenantId, clientName, adminEmail, modules, country, currency }),
                userId: auth.uid || 'superadmin',
            },
        });

        // 2. Sincronizar en Firestore Admin si existen credenciales configuradas
        const hasAdminCreds = Boolean(
            process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
            process.env.FIREBASE_SERVICE_ACCOUNT ||
            (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)
        );
        if (hasAdminCreds) {
            await adminDb.collection('tenants_registry').doc(tenantId).set(tenantRecord).catch((err: unknown) => {
                console.warn('[DEPLOY] Aviso sincronizando tenant en Firestore Admin:', err);
            });
        }

        return NextResponse.json({
            status: 'SUCCESS',
            message: 'Instancia registrada y aprovisionada en base de datos',
            data: {
                tenantId,
                domain,
                accessUrl,
                databasePath: `tenants/${tenantId}`,
                modulesActivated: modules,
                createdAt,
            },
        });
    } catch (error: any) {
        console.error('Error en AdminDeploy:', error);
        return NextResponse.json(
            { error: 'Error aprovisionando tenant: ' + (error?.message || 'desconocido') },
            { status: 500 }
        );
    }
}
