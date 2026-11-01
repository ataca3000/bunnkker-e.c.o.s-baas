import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';

const FACTURAPI_PROVIDER = 'facturapi';
const ENCRYPTION_VERSION = 'v1';

export async function findFacturapiConfig(tenantId: string) {
    return prisma.integrationConfig.findUnique({
        where: {
            tenantId_provider: {
                tenantId,
                provider: FACTURAPI_PROVIDER,
            },
        },
    });
}

export type StoredFacturapiConfig = NonNullable<Awaited<ReturnType<typeof findFacturapiConfig>>>;

function getEncryptionKey(tenantId: string): Buffer {
    const secret = process.env.INTERNAL_API_SECRET;
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
        throw new Error('INTERNAL_API_SECRET must contain at least 32 bytes to encrypt integration credentials.');
    }

    return createHash('sha256')
        .update(`bunkker:integration:${FACTURAPI_PROVIDER}:${tenantId}:`)
        .update(secret, 'utf8')
        .digest();
}

function getAssociatedData(tenantId: string): Buffer {
    return Buffer.from(`bunkker:integration:${FACTURAPI_PROVIDER}:${tenantId}:${ENCRYPTION_VERSION}`, 'utf8');
}

export function encryptFacturapiSecret(secret: string, tenantId: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(tenantId), iv);
    cipher.setAAD(getAssociatedData(tenantId));

    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [
        ENCRYPTION_VERSION,
        iv.toString('base64url'),
        authTag.toString('base64url'),
        encrypted.toString('base64url'),
    ].join(':');
}

export function decryptFacturapiSecret(encryptedSecret: string, tenantId: string): string {
    const [version, ivValue, authTagValue, ciphertextValue] = encryptedSecret.split(':');
    if (version !== ENCRYPTION_VERSION || !ivValue || !authTagValue || !ciphertextValue) {
        throw new Error('Unsupported or malformed Facturapi credential ciphertext.');
    }

    const decipher = createDecipheriv(
        'aes-256-gcm',
        getEncryptionKey(tenantId),
        Buffer.from(ivValue, 'base64url'),
    );
    decipher.setAAD(getAssociatedData(tenantId));
    decipher.setAuthTag(Buffer.from(authTagValue, 'base64url'));

    return Buffer.concat([
        decipher.update(Buffer.from(ciphertextValue, 'base64url')),
        decipher.final(),
    ]).toString('utf8');
}

export function getFacturapiEnvironmentKey(): string | null {
    const key = process.env.FACTURAPI_SECRET_KEY || process.env.FACTURAPI_KEY;
    return typeof key === 'string' && key.trim() ? key.trim() : null;
}

export async function getFacturapiApiKey(
    tenantId: string,
    storedConfig?: StoredFacturapiConfig | null,
): Promise<string | null> {
    const config = storedConfig === undefined ? await findFacturapiConfig(tenantId) : storedConfig;
    if (config?.encryptedSecret) {
        return decryptFacturapiSecret(config.encryptedSecret, tenantId);
    }

    return getFacturapiEnvironmentKey();
}

function parseSettings(value: string | null | undefined): { rfc?: string; legalName?: string } {
    if (!value) return {};
    try {
        const parsed = JSON.parse(value);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        return {
            rfc: typeof parsed.rfc === 'string' ? parsed.rfc : '',
            legalName: typeof parsed.legalName === 'string' ? parsed.legalName : '',
        };
    } catch {
        return {};
    }
}

function toIsoString(value: Date | null | undefined): string | null {
    return value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : null;
}

export function toPublicFacturapiConfig(config: StoredFacturapiConfig | null) {
    const settings = parseSettings(config?.settings);
    const environmentKey = getFacturapiEnvironmentKey();
    const hasStoredKey = Boolean(config?.encryptedSecret);

    return {
        configured: hasStoredKey || Boolean(environmentKey),
        source: hasStoredKey ? 'managed' : environmentKey ? 'environment' : 'none',
        keyLastFour: hasStoredKey ? config?.keyLastFour ?? null : environmentKey?.slice(-4) ?? null,
        status: config?.status ?? (environmentKey ? 'configured' : 'disconnected'),
        rfc: settings.rfc ?? '',
        legalName: settings.legalName ?? '',
        lastCheckedAt: toIsoString(config?.lastCheckedAt),
        updatedAt: toIsoString(config?.updatedAt),
    };
}
