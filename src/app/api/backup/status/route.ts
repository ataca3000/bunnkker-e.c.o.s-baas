import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/apiAuth';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { atomicWriteFileSync } from '@/lib/atomicFs';

const BACKUP_CONFIG_PATH = path.resolve(process.cwd(), 'bunkker.backup.json');

const userHome = process.env.USERPROFILE || process.env.HOME || 'C:/Users/Usuario';

export interface PersistedBackupSettings {
    enabled: boolean;
    destination?: 'all' | 'onedrive' | 'gdrive' | 'usb';
    onedrivePath?: string;
    gdrivePath?: string;
    usbPath?: string;
    format?: 'all' | 'excel' | 'text';
    frequencyMinutes: number;
    retentionDays: number;
    encryptAES256: boolean;
    autoSyncOnCut: boolean;
    lastBackupAt: string | null;
    lastBackupSize: number | null;
    lastBackupHash: string | null;
    lastBackupFiles?: string[];
}

const DEFAULT_SETTINGS: PersistedBackupSettings = {
    enabled: true,
    destination: 'onedrive',
    onedrivePath: path.join(userHome, 'OneDrive', 'BUNKKER_RESPALDOS'),
    gdrivePath: path.join(userHome, 'Google Drive', 'BUNKKER_RESPALDOS'),
    usbPath: 'D:/BUNKKER_RESPALDOS',
    format: 'all',
    frequencyMinutes: 120,
    retentionDays: 30,
    encryptAES256: false,
    autoSyncOnCut: true,
    lastBackupAt: null,
    lastBackupSize: null,
    lastBackupHash: null,
    lastBackupFiles: [],
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
        atomicWriteFileSync(BACKUP_CONFIG_PATH, JSON.stringify(merged, null, 2));
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
            // Fallback to localSettings
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
            destination: localSettings.destination || 'onedrive',
            onedrivePath: localSettings.onedrivePath || DEFAULT_SETTINGS.onedrivePath,
            gdrivePath: localSettings.gdrivePath || DEFAULT_SETTINGS.gdrivePath,
            usbPath: localSettings.usbPath || DEFAULT_SETTINGS.usbPath,
            format: localSettings.format || 'all',
            frequencyMinutes,
            retentionDays: localSettings.retentionDays,
            encryptAES256: localSettings.encryptAES256,
            autoSyncOnCut: localSettings.autoSyncOnCut,
            lastBackupAt,
            lastBackupSize,
            lastBackupHash,
            lastBackupFiles: localSettings.lastBackupFiles || [],
            status,
            nextBackupIn,
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    const auth = requireRole(request, ['superadmin', 'admin', 'inventory']);
    if (!auth.ok) return auth.response;

    try {
        const body = await request.json();
        const current = readLocalBackupSettings();

        const frequencyMinutes = Number(body.frequencyMinutes ?? current.frequencyMinutes) || 120;
        const enabled = typeof body.enabled === 'boolean' ? body.enabled : current.enabled;
        const destination = body.destination || current.destination || 'onedrive';
        const onedrivePath = body.onedrivePath || current.onedrivePath || DEFAULT_SETTINGS.onedrivePath;
        const gdrivePath = body.gdrivePath || current.gdrivePath || DEFAULT_SETTINGS.gdrivePath;
        const usbPath = body.usbPath || current.usbPath || DEFAULT_SETTINGS.usbPath;
        const format = body.format || current.format || 'all';
        const retentionDays = Number(body.retentionDays ?? current.retentionDays) || 30;
        const encryptAES256 = typeof body.encryptAES256 === 'boolean' ? body.encryptAES256 : current.encryptAES256;
        const autoSyncOnCut = typeof body.autoSyncOnCut === 'boolean' ? body.autoSyncOnCut : current.autoSyncOnCut;

        let lastBackupAt = current.lastBackupAt;
        let lastBackupSize = current.lastBackupSize;
        let lastBackupHash = current.lastBackupHash;
        let savedFiles: string[] = [];

        if (body.triggerNow) {
            const now = new Date();
            const nowIso = now.toISOString();
            const dateStr = now.toISOString().slice(0, 10);
            const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
            const fileStamp = `${dateStr}_${timeStr}`;

            // Obtener datos reales de SQLite
            const products = await prisma.product.findMany();
            const orders = await prisma.order.findMany({ include: { items: true } });
            const customers = await prisma.customer.findMany();
            const users = await prisma.user.findMany({
                select: { id: true, email: true, name: true, role: true, createdAt: true }
            });

            // 1. Archivo de Texto / JSON Completo
            const jsonBackup = JSON.stringify({
                metadata: {
                    version: '2.0',
                    timestamp: nowIso,
                    totalProducts: products.length,
                    totalOrders: orders.length,
                    totalCustomers: customers.length,
                    generator: 'BUNKKER ERP Local-First Backup Engine'
                },
                data: { products, orders, customers, users }
            }, null, 2);

            // 2. Archivo Excel / CSV con BOM
            const csvHeaders = ['ID', 'Nombre', 'Categoria', 'Precio', 'Stock', 'Estante', 'Fila', 'CodigoBarras'];
            const csvRows = products.map(p => [
                `"${p.id}"`,
                `"${(p.name || '').replace(/"/g, '""')}"`,
                `"${(p.category || 'General').replace(/"/g, '""')}"`,
                p.price,
                p.stock,
                `"${p.estante || ''}"`,
                `"${p.fila || ''}"`,
                `"${p.barcode || ''}"`
            ].join(','));
            const csvContent = '\uFEFF' + [csvHeaders.join(','), ...csvRows].join('\r\n');

            // Determinar carpetas destino según la selección del usuario
            const targetDirs: string[] = [];
            if (destination === 'onedrive' || destination === 'all') {
                if (onedrivePath) targetDirs.push(onedrivePath);
            }
            if (destination === 'gdrive' || destination === 'all') {
                if (gdrivePath) targetDirs.push(gdrivePath);
            }
            if (destination === 'usb' || destination === 'all') {
                if (usbPath) targetDirs.push(usbPath);
            }

            // Si no hay carpetas válidas o fallan, asegurar una carpeta local de respaldo
            if (targetDirs.length === 0) {
                targetDirs.push(path.join(process.cwd(), 'backups'));
            }

            // Escribir los archivos en cada carpeta destino disponible
            for (const dir of targetDirs) {
                try {
                    if (!fs.existsSync(dir)) {
                        fs.mkdirSync(dir, { recursive: true });
                    }

                    if (format === 'all' || format === 'text') {
                        const jsonFile = path.join(dir, `bunkker_respaldo_texto_${fileStamp}.json`);
                        atomicWriteFileSync(jsonFile, jsonBackup);
                        savedFiles.push(jsonFile);
                    }

                    if (format === 'all' || format === 'excel') {
                        const excelFile = path.join(dir, `bunkker_inventario_excel_${fileStamp}.csv`);
                        atomicWriteFileSync(excelFile, csvContent);
                        savedFiles.push(excelFile);
                    }
                } catch (writeErr) {
                    console.warn(`[backup/status] No se pudo escribir en carpeta ${dir}:`, writeErr);
                }
            }

            lastBackupAt = nowIso;
            lastBackupSize = Buffer.byteLength(jsonBackup, 'utf-8') + Buffer.byteLength(csvContent, 'utf-8');
            lastBackupHash = crypto.createHash('sha256').update(jsonBackup).digest('hex');

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
                // Non-fatal
            }
        }

        const saved = writeLocalBackupSettings({
            enabled,
            destination,
            onedrivePath,
            gdrivePath,
            usbPath,
            format,
            frequencyMinutes,
            retentionDays,
            encryptAES256,
            autoSyncOnCut,
            lastBackupAt,
            lastBackupSize,
            lastBackupHash,
            lastBackupFiles: savedFiles.length > 0 ? savedFiles : current.lastBackupFiles,
        });

        return NextResponse.json({
            success: true,
            ...saved,
            status: !saved.enabled ? 'disabled' : saved.lastBackupAt ? 'ok' : 'never',
            nextBackupIn: saved.frequencyMinutes,
            savedFiles,
        });
    } catch (error: any) {
        console.error('[backup/status] Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
