import 'server-only';

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { accountStore } from '@/lib/omnipulse/store';
import type { NetworkId, OmniAccountSummary } from '@/lib/omnipulse/types';

const PROVIDER_KEY = 'omnipulse_accounts';
const ENCRYPTION_VERSION = 'v1';

interface StoredOmniAccount extends OmniAccountSummary {
    encryptedToken: string;
    channelId?: string;
}

function getSecretKey(tenantId: string): Buffer {
    const baseSecret =
        process.env.INTERNAL_API_SECRET ||
        process.env.JWT_SECRET ||
        'bunkker-ecos-default-local-dev-secret-key-2026';

    return createHash('sha256')
        .update(`bunkker:omnipulse:${tenantId}:`)
        .update(baseSecret, 'utf8')
        .digest();
}

function getAAD(tenantId: string): Buffer {
    return Buffer.from(`bunkker:omnipulse:${tenantId}:${ENCRYPTION_VERSION}`, 'utf8');
}

export function encryptOmniToken(token: string, tenantId: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', getSecretKey(tenantId), iv);
    cipher.setAAD(getAAD(tenantId));
    const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [
        ENCRYPTION_VERSION,
        iv.toString('base64url'),
        authTag.toString('base64url'),
        encrypted.toString('base64url'),
    ].join(':');
}

export function decryptOmniToken(encryptedPayload: string, tenantId: string): string | null {
    try {
        const [version, ivVal, tagVal, cipherVal] = encryptedPayload.split(':');
        if (version !== ENCRYPTION_VERSION || !ivVal || !tagVal || !cipherVal) return null;
        const decipher = createDecipheriv(
            'aes-256-gcm',
            getSecretKey(tenantId),
            Buffer.from(ivVal, 'base64url')
        );
        decipher.setAAD(getAAD(tenantId));
        decipher.setAuthTag(Buffer.from(tagVal, 'base64url'));
        return Buffer.concat([
            decipher.update(Buffer.from(cipherVal, 'base64url')),
            decipher.final(),
        ]).toString('utf8');
    } catch {
        return null;
    }
}

function toPublicSummary(acc: StoredOmniAccount): OmniAccountSummary {
    return {
        id: acc.id,
        network: acc.network,
        accountName: acc.accountName,
        accountId: acc.accountId,
        channelId: acc.channelId,
        hasStoredToken: Boolean(acc.encryptedToken),
        isActive: acc.isActive,
        isTokenValid: acc.isTokenValid,
        expiresAt: acc.expiresAt,
        createdAt: acc.createdAt,
    };
}

async function readStoredAccounts(tenantId: string): Promise<StoredOmniAccount[]> {
    try {
        const row = await prisma.integrationConfig.findFirst({
            where: { tenantId, provider: PROVIDER_KEY },
        });
        if (row?.settings) {
            const parsed = JSON.parse(row.settings);
            if (Array.isArray(parsed)) {
                return parsed as StoredOmniAccount[];
            }
        }
    } catch (err) {
        console.warn('[OMNIPULSE] Error leyendo cuentas persistidas:', err);
    }
    return [];
}

async function writeStoredAccounts(tenantId: string, accounts: StoredOmniAccount[], updatedBy?: string): Promise<void> {
    accountStore.set(tenantId, accounts.map(toPublicSummary));
    const serialized = JSON.stringify(accounts);
    const existing = await prisma.integrationConfig.findFirst({
        where: { tenantId, provider: PROVIDER_KEY },
    });
    if (existing) {
        await prisma.integrationConfig.update({
            where: { id: existing.id },
            data: {
                settings: serialized,
                status: accounts.length > 0 ? 'connected' : 'disconnected',
                updatedBy: updatedBy || existing.updatedBy || 'system',
            },
        });
    } else {
        await prisma.integrationConfig.create({
            data: {
                tenantId,
                provider: PROVIDER_KEY,
                settings: serialized,
                status: accounts.length > 0 ? 'connected' : 'disconnected',
                updatedBy: updatedBy || 'system',
            },
        });
    }
}

export async function listPublicOmniAccounts(tenantId: string): Promise<OmniAccountSummary[]> {
    const stored = await readStoredAccounts(tenantId);
    const summaries = stored.map(toPublicSummary);
    accountStore.set(tenantId, summaries);
    return summaries;
}

export async function upsertOmniAccount(params: {
    tenantId: string;
    network: NetworkId;
    accountName: string;
    accountId: string;
    accessToken: string;
    channelId?: string;
    updatedBy?: string;
}): Promise<OmniAccountSummary> {
    const existing = await readStoredAccounts(params.tenantId);
    const normalizedId = params.accountId || params.channelId || params.accountName;
    const record: StoredOmniAccount = {
        id: `${params.network}_${Date.now()}`,
        network: params.network,
        accountName: params.accountName,
        accountId: normalizedId,
        channelId: params.channelId,
        hasStoredToken: true,
        isActive: true,
        isTokenValid: true,
        expiresAt: null,
        createdAt: new Date().toISOString(),
        encryptedToken: encryptOmniToken(params.accessToken, params.tenantId),
    };

    const filtered = existing.filter(
        (a) => !(a.network === params.network && a.accountId === normalizedId)
    );
    await writeStoredAccounts(params.tenantId, [...filtered, record], params.updatedBy);
    return toPublicSummary(record);
}

export async function removeOmniAccount(tenantId: string, id: string, updatedBy?: string): Promise<void> {
    const existing = await readStoredAccounts(tenantId);
    const filtered = existing.filter((a) => a.id !== id);
    await writeStoredAccounts(tenantId, filtered, updatedBy);
}

export async function getOmniAccountCredentials(
    tenantId: string,
    id: string
): Promise<{ token: string | null; channelId?: string; accountId?: string } | null> {
    const stored = await readStoredAccounts(tenantId);
    const match = stored.find((a) => a.id === id);
    if (!match) return null;
    return {
        token: decryptOmniToken(match.encryptedToken, tenantId),
        channelId: match.channelId,
        accountId: match.accountId,
    };
}
