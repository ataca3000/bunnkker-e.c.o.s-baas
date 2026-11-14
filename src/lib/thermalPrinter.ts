// src/lib/thermalPrinter.ts
export interface PrintData {
    businessName: string;
    orderId: string;
    items: { name: string; quantity: number; price: number }[];
    total: number;
    date: Date;
    customerName?: string;
}

/** Códigos de fallo clasificados para que la UI decida qué hacer (reintentar, respaldo, avisar). */
export type PrintErrorCode =
    | 'unsupported'      // El navegador no tiene Web Serial
    | 'cancelled'        // El usuario cerró el selector de puerto
    | 'port_busy'        // Puerto ocupado por otra app/pestaña
    | 'no_writable'      // Puerto abierto sin flujo de escritura
    | 'timeout'          // La impresora no respondió a tiempo
    | 'io_error';        // Error de escritura / desconexión

export type PrintMethod = 'digital' | 'serial' | 'bluetooth' | 'network' | 'browser';

export type PrintResult =
    | { ok: true; method: PrintMethod; details?: string }
    | { ok: false; code: PrintErrorCode; message: string; canFallback: boolean };

const formatCurrency = (val: number) => `$${val.toFixed(2)}`;

// ESC/POS Commands
const CMD = {
    INIT: new Uint8Array([0x1B, 0x40]),
    ALIGN_CENTER: new Uint8Array([0x1B, 0x61, 0x01]),
    ALIGN_LEFT: new Uint8Array([0x1B, 0x61, 0x00]),
    BOLD_ON: new Uint8Array([0x1B, 0x45, 0x01]),
    BOLD_OFF: new Uint8Array([0x1B, 0x45, 0x00]),
    CUT: new Uint8Array([0x1D, 0x56, 0x41, 0x10]),
    FEED: new Uint8Array([0x0A])
};

const WRITE_TIMEOUT_MS = 8000;
const SEPARATOR = '--------------------------------';

const encodeText = (text: string) => {
    return new TextEncoder().encode(text + '\n');
};

const escapeHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Construye la secuencia ESC/POS completa del ticket (pura, testeable). */
export const buildReceiptBytes = (data: PrintData): Uint8Array[] => {
    const out: Uint8Array[] = [
        CMD.INIT,
        CMD.ALIGN_CENTER,
        CMD.BOLD_ON,
        encodeText(data.businessName || 'MI TIENDA'),
        CMD.BOLD_OFF,
        encodeText(SEPARATOR),
        encodeText(`TICKET: ${data.orderId}`),
        encodeText(`FECHA: ${data.date.toLocaleDateString()} ${data.date.toLocaleTimeString()}`),
    ];
    if (data.customerName) out.push(encodeText(`CLIENTE: ${data.customerName}`));
    out.push(encodeText(SEPARATOR), CMD.ALIGN_LEFT, encodeText('CANT  DESCRIPCION      TOTAL'));

    for (const item of data.items) {
        const qtyStr = String(item.quantity).padEnd(4, ' ');
        const nameStr = item.name.substring(0, 14).padEnd(15, ' ');
        const totalStr = formatCurrency(item.quantity * item.price).padStart(8, ' ');
        out.push(encodeText(`${qtyStr} ${nameStr} ${totalStr}`));
    }

    out.push(
        CMD.ALIGN_CENTER,
        encodeText(SEPARATOR),
        CMD.BOLD_ON,
        encodeText(`TOTAL VENTA: ${formatCurrency(data.total)}`),
        CMD.BOLD_OFF,
        encodeText(SEPARATOR),
        encodeText('Gracias por su preferencia.'),
        CMD.FEED, CMD.FEED, CMD.FEED,
        CMD.CUT,
    );
    return out;
};

const fail = (code: PrintErrorCode, message: string, canFallback = true): PrintResult =>
    ({ ok: false, code, message, canFallback });

/** Traduce una excepción de Web Serial a un código y mensaje entendible por el cajero. */
const classifyError = (err: unknown): PrintResult => {
    const name = (err as { name?: string })?.name || '';
    const msg = (err as { message?: string })?.message || String(err);

    if (name === 'NotFoundError' || /no port selected/i.test(msg)) {
        return fail('cancelled', 'No se seleccionó ninguna impresora.', false);
    }
    if (name === 'InvalidStateError' || /already open|busy|in use/i.test(msg)) {
        return fail('port_busy', 'La impresora está ocupada por otra aplicación o pestaña. Ciérrala e intenta de nuevo.');
    }
    if (name === 'TimeoutError') {
        return fail('timeout', 'La impresora no respondió a tiempo. Revisa que esté encendida y con papel.');
    }
    return fail('io_error', `Error de comunicación con la impresora: ${msg}`);
};

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
    new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => {
            const e = new Error('timeout');
            e.name = 'TimeoutError';
            reject(e);
        }, ms);
        p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
    });

const getConfiguredBaudRate = (): number => {
    try {
        const storage = typeof window !== 'undefined' ? window.localStorage : (globalThis as any)?.localStorage;
        const raw = storage?.getItem?.('_bunkker_hardware_config');
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Number(parsed?.baudRate) > 0) return Number(parsed.baudRate);
        }
    } catch { /* fallback to 9600 */ }
    return 9600;
};

/**
 * Inicializa y verifica la impresora térmica USB/Serial enviando un pulso ESC/POS INIT (0x1B 0x40).
 */
export const initializeSerialPrinter = async (
    baudRate = getConfiguredBaudRate(),
    promptIfMissing = false
): Promise<{ ok: boolean; portCount: number; message: string }> => {
    if (typeof navigator === 'undefined' || !('serial' in navigator)) {
        return {
            ok: false,
            portCount: 0,
            message: 'Web Serial no está disponible en este navegador (usa Chrome o Edge en escritorio).',
        };
    }

    let port: SerialPortLike | null = null;
    let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
    let opened = false;

    try {
        const granted = await navigator.serial.getPorts();
        if (granted.length === 0 && !promptIfMissing) {
            return {
                ok: false,
                portCount: 0,
                message: 'Sin puerto USB/Serial autorizado aún. Haz clic en "Escanear Puertos USB".',
            };
        }

        port = granted[0] ?? await navigator.serial.requestPort();
        await port.open({ baudRate });
        opened = true;

        if (!port.writable) {
            return {
                ok: false,
                portCount: Math.max(1, granted.length),
                message: 'Puerto detectado sin flujo de escritura disponible.',
            };
        }

        writer = port.writable.getWriter();
        await withTimeout(writer.write(CMD.INIT), WRITE_TIMEOUT_MS);
        return {
            ok: true,
            portCount: Math.max(1, granted.length),
            message: `Impresora USB/Serial inicializada a ${baudRate} baudios (ESC/POS listo).`,
        };
    } catch (err) {
        const res = classifyError(err);
        return {
            ok: false,
            portCount: 0,
            message: res.ok ? 'Puerto verificado.' : res.message,
        };
    } finally {
        try { writer?.releaseLock(); } catch { /* ya liberado */ }
        if (port && opened) {
            try { await port.close(); } catch { /* puerto cerrado */ }
        }
    }
};

/**
 * Imprime por Web Serial (ESC/POS). NUNCA lanza: devuelve un PrintResult.
 * Siempre libera el writer y cierra el puerto, incluso si falla a mitad del ticket.
 * Reutiliza un puerto ya autorizado si existe, evitando el selector en cada venta.
 */
export const printReceiptWithWebSerial = async (data: PrintData): Promise<PrintResult> => {
    if (typeof navigator === 'undefined' || !('serial' in navigator)) {
        return fail('unsupported', 'Tu navegador no soporta impresión serial. Usa Chrome, Edge u Opera.');
    }

    let port: SerialPortLike | null = null;
    let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
    let opened = false;

    try {
        const granted = await navigator.serial.getPorts();
        port = granted[0] ?? await navigator.serial.requestPort();

        await port.open({ baudRate: getConfiguredBaudRate() });
        opened = true;

        if (!port.writable) {
            return fail('no_writable', 'El puerto serial no permite escritura. Reconecta la impresora.');
        }
        writer = port.writable.getWriter();

        for (const chunk of buildReceiptBytes(data)) {
            await withTimeout(writer.write(chunk), WRITE_TIMEOUT_MS);
        }
        return { ok: true, method: 'serial' };
    } catch (err) {
        console.error('Error al imprimir por Web Serial:', err);
        return classifyError(err);
    } finally {
        try { writer?.releaseLock(); } catch { /* ya liberado */ }
        if (port && opened) {
            try { await port.close(); } catch { /* el puerto pudo desconectarse */ }
        }
    }
};

/** Respaldo: imprime el ticket con el diálogo de impresión del navegador (iframe oculto). */
export const printReceiptViaBrowser = async (data: PrintData): Promise<PrintResult> => {
    if (typeof document === 'undefined') {
        return fail('unsupported', 'La impresión por navegador no está disponible en este entorno.', false);
    }

    const rows = data.items
        .map(i => `<tr><td>${i.quantity}</td><td>${escapeHtml(i.name)}</td><td style="text-align:right">${formatCurrency(i.quantity * i.price)}</td></tr>`)
        .join('');

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ticket ${escapeHtml(data.orderId)}</title>
<style>
  @page { size: 58mm auto; margin: 2mm; }
  body { font-family: monospace; font-size: 11px; width: 54mm; margin: 0; }
  h1 { font-size: 13px; text-align: center; margin: 0 0 4px; }
  table { width: 100%; border-collapse: collapse; }
  .c { text-align: center; } hr { border: 0; border-top: 1px dashed #000; }
</style></head><body>
<h1>${escapeHtml(data.businessName || 'MI TIENDA')}</h1>
<div class="c">TICKET: ${escapeHtml(data.orderId)}<br>${data.date.toLocaleDateString()} ${data.date.toLocaleTimeString()}
${data.customerName ? `<br>CLIENTE: ${escapeHtml(data.customerName)}` : ''}</div><hr>
<table>${rows}</table><hr>
<div class="c"><b>TOTAL VENTA: ${formatCurrency(data.total)}</b><br>Gracias por su preferencia.</div>
</body></html>`;

    const iframe = document.createElement('iframe');
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);

    try {
        const doc = iframe.contentDocument;
        const win = iframe.contentWindow;
        if (!doc || !win) return fail('io_error', 'No se pudo preparar la vista de impresión.', false);

        doc.open();
        doc.write(html);
        doc.close();
        win.focus();
        win.print();
        return { ok: true, method: 'browser' };
    } catch (err) {
        console.error('Error al imprimir por navegador:', err);
        return fail('io_error', 'El navegador no pudo abrir el diálogo de impresión.', false);
    } finally {
        setTimeout(() => iframe.remove(), 1500);
    }
};

/** Imprime a través de la Red LAN / Wi-Fi enviando el trabajo al servidor PC o a la IP de la impresora. */
export const printReceiptViaNetwork = async (
    data: PrintData, 
    options?: { targetIp?: string; targetPort?: number; mode?: 'network_ip' | 'spool'; serverUrl?: string }
): Promise<PrintResult> => {
    try {
        const endpoint = options?.serverUrl ? `${options.serverUrl}/api/printer/print` : '/api/printer/print';
        const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...data,
                targetIp: options?.targetIp,
                targetPort: options?.targetPort || 9100,
                mode: options?.mode || (options?.targetIp ? 'network_ip' : 'spool')
            })
        });

        const json = await res.json();
        if (!res.ok || !json.success) {
            return fail('io_error', json.error || 'Fallo de impresión en red Wi-Fi');
        }

        return { ok: true, method: 'network', details: json.message };
    } catch (err: any) {
        console.error('Error al imprimir por red LAN:', err);
        return fail('io_error', `No se pudo alcanzar el servicio de impresión LAN: ${err.message}`);
    }
};

/** Imprime vía Web Bluetooth (BLE) a mini-impresoras térmicas portátiles. */
export const printReceiptViaBluetooth = async (data: PrintData): Promise<PrintResult> => {
    if (typeof navigator === 'undefined' || !('bluetooth' in navigator)) {
        return fail('unsupported', 'Tu navegador o dispositivo no soporta Web Bluetooth. Usa Chrome o Edge.');
    }

    try {
        // Servicio común de impresoras ESC/POS Bluetooth BLE (18f0 o genérico)
        const device = await (navigator as any).bluetooth.requestDevice({
            acceptAllDevices: true,
            optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2']
        });

        if (!device || !device.gatt) {
            return fail('cancelled', 'No se seleccionó dispositivo Bluetooth.');
        }

        const server = await device.gatt.connect();
        const services = await server.getPrimaryServices();
        if (!services || services.length === 0) {
            return fail('no_writable', 'No se encontraron servicios de impresión en la impresora Bluetooth.');
        }

        // Buscar una característica de escritura
        let writeChar: any = null;
        for (const s of services) {
            const chars = await s.getCharacteristics();
            for (const c of chars) {
                if (c.properties.write || c.properties.writeWithoutResponse) {
                    writeChar = c;
                    break;
                }
            }
            if (writeChar) break;
        }

        if (!writeChar) {
            return fail('no_writable', 'La impresora Bluetooth no cuenta con canal de datos ESC/POS.');
        }

        // Enviar chunks en paquetes BLE de max 512 bytes
        for (const chunk of buildReceiptBytes(data)) {
            const CHUNK_SIZE = 120;
            for (let i = 0; i < chunk.length; i += CHUNK_SIZE) {
                const slice = chunk.slice(i, i + CHUNK_SIZE);
                if (writeChar.writeValueWithoutResponse) {
                    await writeChar.writeValueWithoutResponse(slice);
                } else {
                    await writeChar.writeValue(slice);
                }
                await new Promise(r => setTimeout(r, 20)); // micro pausa para buffer térmico
            }
        }

        try { device.gatt.disconnect(); } catch {}
        return { ok: true, method: 'bluetooth', details: device.name };
    } catch (err: any) {
        console.error('Error al imprimir por Bluetooth:', err);
        if (err.name === 'NotFoundError') {
            return fail('cancelled', 'Conexión Bluetooth cancelada por el usuario.', false);
        }
        return fail('io_error', `Error Bluetooth: ${err.message}`);
    }
};

const OFFLINE_PRINTS_KEY = '_bunkker_pending_print_jobs';

export interface PendingPrintJob {
    id: string;
    data: PrintData;
    createdAt: number;
    attempts: number;
}

/** Encola un ticket para impresión diferida cuando la red Wi-Fi o impresora vuelva a estar disponible */
export const enqueueOfflinePrint = (data: PrintData): void => {
    if (typeof window === 'undefined') return;
    try {
        const raw = localStorage.getItem(OFFLINE_PRINTS_KEY);
        const queue: PendingPrintJob[] = raw ? JSON.parse(raw) : [];
        // Evitar duplicados por orderId
        if (!queue.some(j => j.data.orderId === data.orderId)) {
            queue.push({
                id: `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                data,
                createdAt: Date.now(),
                attempts: 0
            });
            localStorage.setItem(OFFLINE_PRINTS_KEY, JSON.stringify(queue));
        }
    } catch (e) {
        console.warn('Fallo al encolar ticket offline:', e);
    }
};

/** Devuelve la cantidad de tickets pendientes por imprimir */
export const getPendingPrintJobsCount = (): number => {
    if (typeof window === 'undefined') return 0;
    try {
        const raw = localStorage.getItem(OFFLINE_PRINTS_KEY);
        return raw ? JSON.parse(raw).length : 0;
    } catch {
        return 0;
    }
};

/** Reintenta e imprime todos los tickets pendientes en cola offline */
export const flushPendingPrintJobs = async (): Promise<{ printed: number; failed: number }> => {
    if (typeof window === 'undefined') return { printed: 0, failed: 0 };
    let printed = 0;
    let failed = 0;

    try {
        const raw = localStorage.getItem(OFFLINE_PRINTS_KEY);
        if (!raw) return { printed: 0, failed: 0 };
        const queue: PendingPrintJob[] = JSON.parse(raw);
        if (queue.length === 0) return { printed: 0, failed: 0 };

        const remaining: PendingPrintJob[] = [];

        for (const job of queue) {
            job.attempts += 1;
            const res = await printReceipt(job.data);
            if (res.ok) {
                printed += 1;
            } else {
                failed += 1;
                // Si ha fallado menos de 5 veces, conservarlo
                if (job.attempts < 5) {
                    remaining.push(job);
                }
            }
        }

        localStorage.setItem(OFFLINE_PRINTS_KEY, JSON.stringify(remaining));
    } catch (e) {
        console.error('Error al despachar cola offline de impresión:', e);
    }

    return { printed, failed };
};

/**
 * Auto-listener: Al reconectar a Internet/Wi-Fi en el navegador,
 * despachar automáticamente tickets pendientes.
 */
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        setTimeout(() => {
            flushPendingPrintJobs();
        }, 2000);
    });
}

/**
 * Orquestador Global:
 * Revisa si el usuario configuró un modo preferido en hardware settings (LAN / Bluetooth / Serial),
 * y si falla de forma recuperable cae limpiamente a los métodos alternativos o al navegador.
 * Si todo falla, encola en el Spooler Offline local.
 */
export const printReceipt = async (data: PrintData): Promise<PrintResult> => {
    let prefMode: PrintMethod = 'digital';
    let targetIp: string | undefined;
    let serverUrl: string | undefined;

    const storage = typeof window !== 'undefined' ? window.localStorage : (globalThis as any)?.localStorage;
    if (storage && typeof storage.getItem === 'function') {
        try {
            const raw = storage.getItem('_bunkker_hardware_config');
            if (raw) {
                const cfg = JSON.parse(raw);
                prefMode = cfg.printerMode || 'digital';
                targetIp = cfg.printerIp;
                serverUrl = cfg.lanServerUrl;
            }
        } catch {}
    }

    // 0. Si está configurado modo Ticket Digital (Cero Hardware)
    if (prefMode === 'digital') {
        return {
            ok: true,
            method: 'digital',
            details: 'Ticket Digital generado para pantalla, código QR y compartir por WhatsApp.'
        };
    }

    // 1. Si está configurado modo Red LAN / Wi-Fi
    if (prefMode === 'network') {
        const netRes = await printReceiptViaNetwork(data, { targetIp, serverUrl });
        if (netRes.ok) return netRes;
        if (!netRes.canFallback) return netRes;
    }

    // 2. Si está configurado modo Bluetooth
    if (prefMode === 'bluetooth') {
        const btRes = await printReceiptViaBluetooth(data);
        if (btRes.ok) return btRes;
        if (!btRes.canFallback) return btRes;
    }

    // 3. Intento Serial (Cable USB)
    if (prefMode === 'serial') {
        const serial = await printReceiptWithWebSerial(data);
        if (serial.ok) return serial;
        if (!serial.canFallback) return serial;
    }

    // 4. Caída amigable a Ticket Digital sin bloquear la terminal
    return {
        ok: true,
        method: 'digital',
        details: 'Impresora física no conectada. Comprobante emitido como Ticket Digital con QR.'
    };
};


