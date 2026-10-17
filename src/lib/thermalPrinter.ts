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

export type PrintResult =
    | { ok: true; method: 'serial' | 'browser' }
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

        await port.open({ baudRate: 9600 }); // Impresoras térmicas comunes usan 9600 o 115200
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

/**
 * Orquestador: intenta serial y, si falla de forma recuperable, cae al diálogo del navegador.
 * Si el usuario canceló el selector, respeta su decisión y no abre nada más.
 */
export const printReceipt = async (data: PrintData): Promise<PrintResult> => {
    const serial = await printReceiptWithWebSerial(data);
    if (serial.ok || !serial.canFallback) return serial;

    const browser = await printReceiptViaBrowser(data);
    if (browser.ok) return browser;
    return serial; // Reporta el fallo original, que es el más informativo
};
