export const HARDWARE_CONFIG_STORAGE_KEY = '_bunkker_hardware_config';
export const HARDWARE_CONFIG_UPDATED_EVENT = 'bunkker_hardware_config_updated';

export type PrinterMode = 'digital' | 'serial' | 'bluetooth' | 'network';
export type ScannerMode = 'camera' | 'hid';
export type NfcMode = 'web_nfc' | 'usb_hid';
export type NfcAutoAction = 'auto' | 'lookup_product' | 'lookup_order';
export type ScaleMode = 'bluetooth' | 'serial' | 'simulated';
export type ScaleUnit = 'kg' | 'g' | 'lb';

export interface HardwareConfig {
    printerMode: PrinterMode;
    printerIp?: string;
    printerPort?: number;
    lanServerUrl?: string;
    baudRate?: number;
    scannerMode: ScannerMode;
    scannerBeep: boolean;
    qrContinuousMode: boolean;
    qrPreferBackCamera: boolean;
    scannerMinChars: number;
    scannerMaxBurstMs: number;
    nfcEnabled: boolean;
    nfcMode: NfcMode;
    nfcAutoAction: NfcAutoAction;
    scaleMode: ScaleMode;
    scaleUnit: ScaleUnit;
}

export const DEFAULT_HARDWARE_CONFIG: HardwareConfig = {
    printerMode: 'digital',
    printerIp: '',
    printerPort: 9100,
    lanServerUrl: '',
    baudRate: 9600,
    scannerMode: 'camera',
    scannerBeep: true,
    qrContinuousMode: true,
    qrPreferBackCamera: true,
    scannerMinChars: 3,
    scannerMaxBurstMs: 60,
    nfcEnabled: false,
    nfcMode: 'web_nfc',
    nfcAutoAction: 'auto',
    scaleMode: 'bluetooth',
    scaleUnit: 'kg',
};

export function normalizeHardwareConfig(raw: Partial<HardwareConfig> | null | undefined): HardwareConfig {
    if (!raw || typeof raw !== 'object') {
        return { ...DEFAULT_HARDWARE_CONFIG };
    }

    const printerMode: PrinterMode =
        raw.printerMode === 'serial' || raw.printerMode === 'bluetooth' || raw.printerMode === 'network' || raw.printerMode === 'digital'
            ? raw.printerMode
            : (raw as any).printerMode === 'usb'
                ? 'serial'
                : DEFAULT_HARDWARE_CONFIG.printerMode;

    const scannerMode: ScannerMode =
        raw.scannerMode === 'hid' || raw.scannerMode === 'camera'
            ? raw.scannerMode
            : (raw as any).scannerMode === 'laser'
                ? 'hid'
                : DEFAULT_HARDWARE_CONFIG.scannerMode;

    const nfcMode: NfcMode =
        raw.nfcMode === 'usb_hid' || raw.nfcMode === 'web_nfc'
            ? raw.nfcMode
            : DEFAULT_HARDWARE_CONFIG.nfcMode;

    const nfcAutoAction: NfcAutoAction =
        raw.nfcAutoAction === 'lookup_product' || raw.nfcAutoAction === 'lookup_order' || raw.nfcAutoAction === 'auto'
            ? raw.nfcAutoAction
            : DEFAULT_HARDWARE_CONFIG.nfcAutoAction;

    const scaleMode: ScaleMode =
        raw.scaleMode === 'bluetooth' || raw.scaleMode === 'serial' || raw.scaleMode === 'simulated'
            ? raw.scaleMode
            : DEFAULT_HARDWARE_CONFIG.scaleMode;

    const scaleUnit: ScaleUnit =
        raw.scaleUnit === 'kg' || raw.scaleUnit === 'g' || raw.scaleUnit === 'lb'
            ? raw.scaleUnit
            : DEFAULT_HARDWARE_CONFIG.scaleUnit;

    return {
        ...DEFAULT_HARDWARE_CONFIG,
        ...raw,
        printerMode,
        printerPort: Number(raw.printerPort) > 0 ? Number(raw.printerPort) : DEFAULT_HARDWARE_CONFIG.printerPort,
        baudRate: Number(raw.baudRate) > 0 ? Number(raw.baudRate) : DEFAULT_HARDWARE_CONFIG.baudRate,
        scannerMode,
        scannerBeep: raw.scannerBeep !== undefined ? Boolean(raw.scannerBeep) : DEFAULT_HARDWARE_CONFIG.scannerBeep,
        qrContinuousMode: raw.qrContinuousMode !== undefined ? Boolean(raw.qrContinuousMode) : DEFAULT_HARDWARE_CONFIG.qrContinuousMode,
        qrPreferBackCamera: raw.qrPreferBackCamera !== undefined ? Boolean(raw.qrPreferBackCamera) : DEFAULT_HARDWARE_CONFIG.qrPreferBackCamera,
        scannerMinChars: Math.max(2, Math.min(20, Number(raw.scannerMinChars) || DEFAULT_HARDWARE_CONFIG.scannerMinChars)),
        scannerMaxBurstMs: Math.max(25, Math.min(200, Number(raw.scannerMaxBurstMs) || DEFAULT_HARDWARE_CONFIG.scannerMaxBurstMs)),
        nfcEnabled: Boolean(raw.nfcEnabled),
        nfcMode,
        nfcAutoAction,
        scaleMode,
        scaleUnit,
    };
}

export function loadHardwareConfig(): HardwareConfig {
    if (typeof window === 'undefined') return { ...DEFAULT_HARDWARE_CONFIG };
    try {
        const raw = localStorage.getItem(HARDWARE_CONFIG_STORAGE_KEY);
        if (!raw) return { ...DEFAULT_HARDWARE_CONFIG };
        return normalizeHardwareConfig(JSON.parse(raw));
    } catch {
        return { ...DEFAULT_HARDWARE_CONFIG };
    }
}

export function saveHardwareConfig(config: Partial<HardwareConfig>): HardwareConfig {
    const normalized = normalizeHardwareConfig(config);
    if (typeof window !== 'undefined') {
        try {
            localStorage.setItem(HARDWARE_CONFIG_STORAGE_KEY, JSON.stringify(normalized));
            window.dispatchEvent(new CustomEvent(HARDWARE_CONFIG_UPDATED_EVENT, { detail: normalized }));
        } catch {
            // ignore storage errors
        }
    }
    return normalized;
}

export function isWebNfcSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return 'NDEFReader' in window;
}

export interface ParsedNfcTag {
    code: string;
    kind: 'product' | 'order' | 'serial' | 'unknown';
    raw: string;
}

/**
 * Extrae un código limpio de un tag NFC (NDEF texto, URL o JSON, o serialNumber del chip).
 */
export function parseNfcPayload(recordsText: string[], serialNumber?: string): ParsedNfcTag {
    const cleanedRecords = recordsText.map((r) => r.trim()).filter(Boolean);

    for (const entry of cleanedRecords) {
        if (entry.startsWith('{') && entry.endsWith('}')) {
            try {
                const parsed = JSON.parse(entry);
                const orderCode = parsed.orderId || parsed.order || parsed.ticketId;
                if (typeof orderCode === 'string' && orderCode.trim()) {
                    return { code: orderCode.trim(), kind: 'order', raw: entry };
                }
                const prodCode = parsed.barcode || parsed.sku || parsed.productId || parsed.id;
                if (typeof prodCode === 'string' && prodCode.trim()) {
                    return { code: prodCode.trim(), kind: 'product', raw: entry };
                }
            } catch {
                // fallback to plain string check
            }
        }

        const upper = entry.toUpperCase();
        if (upper.startsWith('ORD-') || upper.startsWith('PED-') || upper.startsWith('TK-')) {
            return { code: entry, kind: 'order', raw: entry };
        }

        if (entry.includes('orderId=')) {
            try {
                const url = new URL(entry, 'https://bunkker.local');
                const orderId = url.searchParams.get('orderId');
                if (orderId) return { code: orderId.trim(), kind: 'order', raw: entry };
            } catch {
                // ignore
            }
        }

        if (entry.includes('sku=') || entry.includes('barcode=')) {
            try {
                const url = new URL(entry, 'https://bunkker.local');
                const sku = url.searchParams.get('barcode') || url.searchParams.get('sku');
                if (sku) return { code: sku.trim(), kind: 'product', raw: entry };
            } catch {
                // ignore
            }
        }

        return { code: entry, kind: 'product', raw: entry };
    }

    const uid = (serialNumber || '').trim();
    if (uid) {
        return { code: uid, kind: 'serial', raw: uid };
    }

    return { code: '', kind: 'unknown', raw: '' };
}
