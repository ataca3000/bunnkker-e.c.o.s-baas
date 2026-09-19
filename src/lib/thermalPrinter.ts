// src/lib/thermalPrinter.ts
export interface PrintData {
    businessName: string;
    orderId: string;
    items: { name: string; quantity: number; price: number }[];
    total: number;
    date: Date;
    customerName?: string;
}

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

const encodeText = (text: string) => {
    return new TextEncoder().encode(text + '\n');
};

export const printReceiptWithWebSerial = async (data: PrintData) => {
    if (!('serial' in navigator)) {
        throw new Error('La API Web Serial no está soportada en tu navegador actual. Usa Chrome, Edge, o Opera en PC/Android.');
    }

    try {
        // Pedir al usuario seleccionar el puerto USB/Serial de la impresora
        // @ts-ignore - Web Serial API navigator.serial is not in standard DOM typings
        const port = await navigator.serial.requestPort();
        await port.open({ baudRate: 9600 }); // Impresoras térmicas comunes usan 9600 o 115200

        const writer = port.writable.getWriter();

        // Inicializar
        await writer.write(CMD.INIT);
        
        // Cabecera (Centrado)
        await writer.write(CMD.ALIGN_CENTER);
        await writer.write(CMD.BOLD_ON);
        await writer.write(encodeText(data.businessName || 'MI TIENDA'));
        await writer.write(CMD.BOLD_OFF);
        await writer.write(encodeText('--------------------------------'));
        await writer.write(encodeText(`TICKET: ${data.orderId}`));
        await writer.write(encodeText(`FECHA: ${data.date.toLocaleDateString()} ${data.date.toLocaleTimeString()}`));
        if (data.customerName) {
            await writer.write(encodeText(`CLIENTE: ${data.customerName}`));
        }
        await writer.write(encodeText('--------------------------------'));
        
        // Cuerpo de Ticket (Izquierda)
        await writer.write(CMD.ALIGN_LEFT);
        await writer.write(encodeText('CANT  DESCRIPCION      TOTAL'));
        
        for (const item of data.items) {
            // Formatear línea (simple padding de espacios)
            const qtyStr = String(item.quantity).padEnd(4, ' ');
            const nameStr = item.name.substring(0, 14).padEnd(15, ' ');
            const totalStr = formatCurrency(item.quantity * item.price).padStart(8, ' ');
            
            await writer.write(encodeText(`${qtyStr} ${nameStr} ${totalStr}`));
        }
        
        await writer.write(CMD.ALIGN_CENTER);
        await writer.write(encodeText('--------------------------------'));
        await writer.write(CMD.BOLD_ON);
        await writer.write(encodeText(`TOTAL VENTA: ${formatCurrency(data.total)}`));
        await writer.write(CMD.BOLD_OFF);
        await writer.write(encodeText('--------------------------------'));
        
        await writer.write(encodeText('Gracias por su preferencia.'));
        await writer.write(CMD.FEED);
        await writer.write(CMD.FEED);
        await writer.write(CMD.FEED);
        await writer.write(CMD.CUT); // Cortar papel
        
        await writer.releaseLock();
        await port.close();

        return true;
    } catch (err: any) {
        console.error('Error al imprimir por Web Serial:', err);
        throw err;
    }
};
