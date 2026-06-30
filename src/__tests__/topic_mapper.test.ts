import { describe, it, expect } from 'vitest';
import { resolveSemanticIntent } from '../lib/ai/topicMapper';

describe('Topic Mapper Semantic Intent Resolution', () => {
    it('should resolve import intent for words like trasladar or subir excel', () => {
        const r1 = resolveSemanticIntent('quiero trasladar productos desde excel');
        expect(r1.intent).toBe('import');
        expect(r1.confidence).toBeGreaterThanOrEqual(0.6);

        const r2 = resolveSemanticIntent('subir un archivo csv de inventario');
        expect(r2.intent).toBe('import');
        expect(r2.confidence).toBeGreaterThanOrEqual(0.6);
    });

    it('should resolve billing intent for invoice or SAT related queries', () => {
        const r = resolveSemanticIntent('necesito facturar una venta con el rfc del cliente');
        expect(r.intent).toBe('billing');
        expect(r.confidence).toBeGreaterThanOrEqual(0.6);
    });

    it('should resolve delivery intent for logistics and drivers queries', () => {
        const r = resolveSemanticIntent('enviar pedido a domicilio con el chofer');
        expect(r.intent).toBe('delivery');
        expect(r.confidence).toBeGreaterThanOrEqual(0.6);
    });

    it('should resolve sales intent for cash register and payment queries', () => {
        const r = resolveSemanticIntent('cobrar en la caja de la tienda pos');
        expect(r.intent).toBe('sales');
        expect(r.confidence).toBeGreaterThanOrEqual(0.6);
    });

    it('should resolve tests intent for stress or load simulations', () => {
        const r = resolveSemanticIntent('quiero hacer pruebas de estres de carga local');
        expect(r.intent).toBe('tests');
        expect(r.confidence).toBeGreaterThanOrEqual(0.6);
    });

    it('should return unknown for completely unrelated queries', () => {
        const r = resolveSemanticIntent('xyz abc wtf random query');
        expect(r.intent).toBe('unknown');
    });
});
