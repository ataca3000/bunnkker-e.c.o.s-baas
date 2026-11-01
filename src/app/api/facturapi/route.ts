import { NextRequest, NextResponse } from 'next/server';
import Facturapi from 'facturapi';
import { requireActiveRole } from '@/lib/apiAuth';
import { prisma } from '@/lib/prisma';
import {
    encryptFacturapiSecret,
    findFacturapiConfig,
    getFacturapiApiKey,
    getFacturapiEnvironmentKey,
    toPublicFacturapiConfig,
} from '@/lib/facturapi-config';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_ROLES = ['superadmin', 'admin', 'billing'];
const FACTURAPI_PROVIDER = 'facturapi';

function validationError(error: unknown): string {
    const candidate = error as {
        status?: number;
        statusCode?: number;
        response?: { status?: number };
    } | null;
    const status = candidate?.status ?? candidate?.statusCode ?? candidate?.response?.status;

    if (status === 401 || status === 403) {
        return 'Facturapi rechazó la llave. Revisa que sea una Secret Key activa.';
    }
    if (status === 429) {
        return 'Facturapi limitó temporalmente las solicitudes. Intenta de nuevo más tarde.';
    }
    return 'No se pudo validar la conexión con Facturapi. Verifica la red y vuelve a intentarlo.';
}

async function testFacturapiKey(apiKey: string): Promise<string | null> {
    try {
        await new Facturapi(apiKey).organizations.me();
        return null;
    } catch (error) {
        return validationError(error);
    }
}

export async function GET(request: NextRequest) {
    const auth = await requireActiveRole(request, ALLOWED_ROLES);
    if (!auth.ok) return auth.response;

    try {
        const config = await findFacturapiConfig(auth.tenantId || 'default');
        return NextResponse.json({ success: true, data: toPublicFacturapiConfig(config) });
    } catch {
        return NextResponse.json(
            { success: false, error: 'No se pudo cargar la configuración de Facturapi.' },
            { status: 503 },
        );
    }
}

export async function POST(request: NextRequest) {
    const auth = await requireActiveRole(request, ALLOWED_ROLES);
    if (!auth.ok) return auth.response;

    const tenantId = auth.tenantId || 'default';

    try {
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return NextResponse.json({ success: false, error: 'Solicitud inválida.' }, { status: 400 });
        }

        const action = body.action;
        if (action !== 'test' && action !== 'save') {
            return NextResponse.json({ success: false, error: 'Acción no válida.' }, { status: 400 });
        }

        const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
        if (apiKey && (apiKey.length > 500 || !apiKey.startsWith('sk_'))) {
            return NextResponse.json(
                { success: false, error: 'La llave debe ser una Secret Key de Facturapi válida.' },
                { status: 400 },
            );
        }

        const currentConfig = await findFacturapiConfig(tenantId);
        const effectiveApiKey = apiKey || await getFacturapiApiKey(tenantId, currentConfig);
        if (!effectiveApiKey) {
            return NextResponse.json(
                { success: false, error: 'Ingresa una Secret Key para probar o guardar la conexión.' },
                { status: 400 },
            );
        }

        if (action === 'test') {
            const error = await testFacturapiKey(effectiveApiKey);
            if (error) {
                return NextResponse.json({ success: false, error }, { status: 502 });
            }

            return NextResponse.json({
                success: true,
                message: 'Conexión verificada con Facturapi. Guarda la configuración para aplicarla.',
            });
        }

        const rfc = typeof body.rfc === 'string' ? body.rfc.trim().toUpperCase() : '';
        const legalName = typeof body.legalName === 'string' ? body.legalName.trim() : '';
        if (!/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/.test(rfc)) {
            return NextResponse.json(
                { success: false, error: 'El RFC debe tener el formato válido de persona moral o física.' },
                { status: 400 },
            );
        }
        if (!legalName || legalName.length > 160) {
            return NextResponse.json(
                { success: false, error: 'La razón social es obligatoria y debe tener máximo 160 caracteres.' },
                { status: 400 },
            );
        }

        const connectionError = await testFacturapiKey(effectiveApiKey);
        if (connectionError) {
            return NextResponse.json({ success: false, error: connectionError }, { status: 502 });
        }

        const encryptedSecret = apiKey
            ? encryptFacturapiSecret(apiKey, tenantId)
            : currentConfig?.encryptedSecret ?? null;
        const keyLastFour = apiKey
            ? apiKey.slice(-4)
            : currentConfig?.keyLastFour ?? getFacturapiEnvironmentKey()?.slice(-4) ?? null;
        const now = new Date();
        const config = await prisma.integrationConfig.upsert({
            where: {
                tenantId_provider: {
                    tenantId,
                    provider: FACTURAPI_PROVIDER,
                },
            },
            update: {
                encryptedSecret,
                keyLastFour,
                settings: JSON.stringify({ rfc, legalName }),
                status: 'connected',
                lastCheckedAt: now,
                updatedBy: auth.uid,
            },
            create: {
                tenantId,
                provider: FACTURAPI_PROVIDER,
                encryptedSecret,
                keyLastFour,
                settings: JSON.stringify({ rfc, legalName }),
                status: 'connected',
                lastCheckedAt: now,
                updatedBy: auth.uid,
            },
        });

        try {
            await prisma.auditLog.create({
                data: {
                    tenantId,
                    action: 'FACTURAPI_CONFIG_UPDATED',
                    details: 'Se actualizó la configuración de conexión Facturapi.',
                    userId: auth.uid,
                },
            });
        } catch {
            console.warn('[FACTURAPI CONFIG] No se pudo registrar la auditoría de la actualización.');
        }

        return NextResponse.json({
            success: true,
            message: 'Configuración guardada y conexión verificada.',
            data: toPublicFacturapiConfig(config),
        });
    } catch (error) {
        console.error('[FACTURAPI CONFIG] No se pudo procesar la configuración:', error);
        return NextResponse.json(
            { success: false, error: 'No se pudo guardar la configuración de Facturapi.' },
            { status: 503 },
        );
    }
}
