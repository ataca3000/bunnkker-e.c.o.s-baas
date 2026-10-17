import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildReceiptBytes, printReceiptWithWebSerial, printReceipt, type PrintData } from '../lib/thermalPrinter';

const data: PrintData = {
    businessName: 'TIENDA',
    orderId: 'POS-1',
    items: [{ name: 'Producto con nombre muy largo', quantity: 2, price: 10 }],
    total: 20,
    date: new Date('2026-10-17T12:00:00Z'),
};

type FakePort = {
    open: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    writable: { getWriter: () => { write: ReturnType<typeof vi.fn>; releaseLock: ReturnType<typeof vi.fn> } } | null;
};

const makePort = (overrides: Partial<FakePort> = {}) => {
    const writer = { write: vi.fn().mockResolvedValue(undefined), releaseLock: vi.fn() };
    const port: FakePort = {
        open: vi.fn().mockResolvedValue(undefined),
        close: vi.fn().mockResolvedValue(undefined),
        writable: { getWriter: () => writer },
        ...overrides,
    };
    return { port, writer };
};

const setSerial = (serial: unknown) => {
    Object.defineProperty(globalThis, 'navigator', { value: serial === undefined ? {} : { serial }, configurable: true });
};

describe('thermalPrinter', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => { });
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('buildReceiptBytes: arranca con INIT, termina con CUT e incluye el total', () => {
        const bytes = buildReceiptBytes(data);
        expect(Array.from(bytes[0])).toEqual([0x1B, 0x40]);
        expect(Array.from(bytes[bytes.length - 1])).toEqual([0x1D, 0x56, 0x41, 0x10]);
        const text = bytes.map(b => new TextDecoder().decode(b)).join('');
        expect(text).toContain('TOTAL VENTA: $20.00');
    });

    it('camino feliz: escribe todo, libera el writer y cierra el puerto', async () => {
        const { port, writer } = makePort();
        setSerial({ getPorts: async () => [port], requestPort: vi.fn() });
        const res = await printReceiptWithWebSerial(data);
        expect(res).toEqual({ ok: true, method: 'serial' });
        expect(writer.write).toHaveBeenCalled();
        expect(writer.releaseLock).toHaveBeenCalledTimes(1);
        expect(port.close).toHaveBeenCalledTimes(1);
    });

    it('sin soporte Web Serial: devuelve unsupported (no lanza)', async () => {
        setSerial(undefined);
        const res = await printReceiptWithWebSerial(data);
        expect(res).toMatchObject({ ok: false, code: 'unsupported', canFallback: true });
    });

    it('selector cancelado: devuelve cancelled y NO permite respaldo', async () => {
        const err = Object.assign(new Error('No port selected by the user.'), { name: 'NotFoundError' });
        setSerial({ getPorts: async () => [], requestPort: vi.fn().mockRejectedValue(err) });
        const res = await printReceiptWithWebSerial(data);
        expect(res).toMatchObject({ ok: false, code: 'cancelled', canFallback: false });
    });

    it('puerto ocupado: clasifica port_busy', async () => {
        const { port } = makePort({ open: vi.fn().mockRejectedValue(Object.assign(new Error('The port is already open.'), { name: 'InvalidStateError' })) });
        setSerial({ getPorts: async () => [port], requestPort: vi.fn() });
        const res = await printReceiptWithWebSerial(data);
        expect(res).toMatchObject({ ok: false, code: 'port_busy' });
    });

    it('sin flujo de escritura: no_writable y cierra el puerto abierto', async () => {
        const { port } = makePort({ writable: null });
        setSerial({ getPorts: async () => [port], requestPort: vi.fn() });
        const res = await printReceiptWithWebSerial(data);
        expect(res).toMatchObject({ ok: false, code: 'no_writable' });
        expect(port.close).toHaveBeenCalledTimes(1);
    });

    it('fallo a mitad de escritura: io_error y aun así libera writer y cierra puerto', async () => {
        const { port, writer } = makePort();
        writer.write.mockRejectedValueOnce(new Error('device disconnected'));
        setSerial({ getPorts: async () => [port], requestPort: vi.fn() });
        const res = await printReceiptWithWebSerial(data);
        expect(res).toMatchObject({ ok: false, code: 'io_error' });
        expect(writer.releaseLock).toHaveBeenCalledTimes(1);
        expect(port.close).toHaveBeenCalledTimes(1);
    });

    it('idempotencia: dos impresiones seguidas reutilizan el puerto autorizado', async () => {
        const { port } = makePort();
        const requestPort = vi.fn();
        setSerial({ getPorts: async () => [port], requestPort });
        await printReceiptWithWebSerial(data);
        await printReceiptWithWebSerial(data);
        expect(requestPort).not.toHaveBeenCalled();
        expect(port.open).toHaveBeenCalledTimes(2);
        expect(port.close).toHaveBeenCalledTimes(2);
    });

    it('printReceipt: si el usuario cancela, respeta la decisión (sin respaldo)', async () => {
        const err = Object.assign(new Error('No port selected by the user.'), { name: 'NotFoundError' });
        setSerial({ getPorts: async () => [], requestPort: vi.fn().mockRejectedValue(err) });
        const res = await printReceipt(data);
        expect(res).toMatchObject({ ok: false, code: 'cancelled' });
    });
});
