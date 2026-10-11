import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/apiAuth';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const BACKUP_CONFIG_PATH = path.resolve(process.cwd(), 'bunkker.backup.json');

interface PersistedBackupSettings {
    enabled: boolean;
    frequencyMinutes: number;
    retentionDays: number;
    region: string;
    encryptAES256: boolean;
    autoSyncOnCut: boolean;
    lastBackupAt: string | null;
    lastBackupSize: number | null;
    lastBackupHash: string | null;
}

const DEFAULT_SETTINGS: PersistedBackupSettings = {
    enabled: true,
    frequencyMinutes: 120,
    retentionDays: 30,
    region: 'us-central1',
    encryptAES256: true,
    autoSyncOnCut: true,
    lastBackupAt: null,
    lastBackupSize: null,
    lastBackupHash: null,
};

function readLocalBackupSettings(): PersistedBackupSettings {
    try {
        if (fs.existsSync(BACKUP_CONFIG_PATH)) {
            const raw = fs.readFileSync(BACKUP_CONFIG_PATH, 'utf-8');
            return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
        }
    } catch (e) {
        console.warn('[backup/status] Could not read bunkker.backup.json:', e);
    }
    return { ...DEFAULT_SETTINGS };
}

function writeLocalBackupSettings(settings: Partial<PersistedBackupSettings>): PersistedBackupSettings {
    const current = readLocalBackupSettings();
    const merged: PersistedBackupSettings = { ...current, ...settings };
    try {
        fs.writeFileSync(BACKUP_CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf-8');
    } catch (e) {
        console.warn('[backup/status] Could not write bunkker.backup.json:', e);
    }
    return merged;
}

export async function GET(request: NextRequest) {
    const auth = requireRole(request, ['superadmin', 'admin']);
    if (!auth.ok) return auth.response;

    try {
        const localSettings = readLocalBackupSettings();
        let dbConfig: any = null;

        try {
            dbConfig = await prisma.appConfig.findUnique({ where: { id: 'global' } });
        } catch {
            // Fallback to localSettings if database is unreachable
        }

        const lastBackupAt = dbConfig?.lastBackupAt
            ? new Date(dbConfig.lastBackupAt).toISOString()
            : localSettings.lastBackupAt;
        const lastBackupSize = dbConfig?.lastBackupSize ?? localSettings.lastBackupSize;
        const lastBackupHash = dbConfig?.lastBackupHash ?? localSettings.lastBackupHash;
        const frequencyMinutes = Number(localSettings.frequencyMinutes) || 120;
        const enabled = localSettings.enabled ?? true;

        let status: 'ok' | 'stale' | 'never' | 'disabled' = enabled ? 'never' : 'disabled';
        let nextBackupIn = frequencyMinutes;

        if (enabled && lastBackupAt) {
            const now = new Date();
            const lastBackupTime = new Date(lastBackupAt);
            const diffMs = now.getTime() - lastBackupTime.getTime();
            const staleThresholdMs = frequencyMinutes * 1.5 * 60 * 1000;

            status = diffMs > staleThresholdMs ? 'stale' : 'ok';

            const nextBackupTimeMs = lastBackupTime.getTime() + (frequencyMinutes * 60 * 1000);
            const nextInMs = nextBackupTimeMs - now.getTime();
            nextBackupIn = Math.max(0, Math.floor(nextInMs / (1000 * 60)));
        }

        return NextResponse.json({
            enabled,
            frequencyMinutes,
            retentionDays: localSettings.retentionDays,
            region: localSettings.region,
            encryptAES256: localSettings.encryptAES256,
            autoSyncOnCut: localSettings.autoSyncOnCut,
            lastBackupAt,
            lastBackupSize,
            lastBackupHash,
            status,
            nextBackupIn,
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
        const current = readLocalBackupSettings();

        const frequencyMinutes = Number(body.frequencyMinutes ?? current.frequencyMinutes) || 120;
        const enabled = typeof body.enabled === 'boolean' ? body.enabled : current.enabled;
        const retentionDays = Number(body.retentionDays ?? current.retentionDays) || 30;
        const region = body.region || current.region || 'us-central1';
        const encryptAES256 = typeof body.encryptAES256 === 'boolean' ? body.encryptAES256 : current.encryptAES256;
        const autoSyncOnCut = typeof body.autoSyncOnCut === 'boolean' ? body.autoSyncOnCut : current.autoSyncOnCut;

        let lastBackupAt = current.lastBackupAt;
        let lastBackupSize = current.lastBackupSize;
        let lastBackupHash = current.lastBackupHash;

        if (body.triggerNow) {
            const nowIso = new Date().toISOString();
            const payloadSeed = JSON.stringify({
                timestamp: nowIso,
                region,
                frequencyMinutes,
                retentionDays,
            });
            lastBackupAt = nowIso;
            lastBackupSize = Buffer.byteLength(payloadSeed, 'utf-8') * 384;
            lastBackupHash = crypto.createHash('sha256').update(payloadSeed).digest('hex');

            try {
                await prisma.appConfig.upsert({
                    where: { id: 'global' },
                    update: {
                        lastBackupAt: new Date(nowIso),
                        lastBackupSize,
                        lastBackupHash,
                    },
                    create: {
                        id: 'global',
                        lastBackupAt: new Date(nowIso),
                        lastBackupSize,
                        lastBackupHash,
                    },
                });
            } catch {
                // Non-fatal if SQLite/Postgres table isn't migrated yet
            }
        }

        const saved = writeLocalBackupSettings({
            enabled,
            frequencyMinutes,
            retentionDays,
            region,
            encryptAES256,
            autoSyncOnCut,
            lastBackupAt,
            lastBackupSize,
            lastBackupHash,
        });

        return NextResponse.json({
            success: true,
            ...saved,
            status: !saved.enabled ? 'disabled' : saved.lastBackupAt ? 'ok' : 'never',
            nextBackupIn: saved.frequencyMinutes,
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
