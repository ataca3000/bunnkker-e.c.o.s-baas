import { describe, it, expect } from 'vitest';
import { playScannerBeep, playIncrementBeep, playErrorBeep, playSuccessChime } from '../lib/scannerAudio';

describe('POS Search & Retail Audio Ergonomics', () => {
    it('should export all retail synthesized audio tones without errors', () => {
        expect(typeof playScannerBeep).toBe('function');
        expect(typeof playIncrementBeep).toBe('function');
        expect(typeof playErrorBeep).toBe('function');
        expect(typeof playSuccessChime).toBe('function');

        // Testing that calling in non-window/mock environment does not throw
        expect(() => playScannerBeep()).not.toThrow();
        expect(() => playIncrementBeep()).not.toThrow();
        expect(() => playErrorBeep()).not.toThrow();
        expect(() => playSuccessChime()).not.toThrow();
    });

    it('should isolate single exact match for barcodes or product search', () => {
        const mockProducts = [
            { id: 'prod-1', name: 'Taladro Percutor 1/2', barcode: '75010001', sku: 'SKU-TAL-01', price: 1500, stock: 10 },
            { id: 'prod-2', name: 'Martillo Tubular', barcode: '75010002', sku: 'SKU-MAR-02', price: 250, stock: 25 },
            { id: 'prod-3', name: 'Sierra Caladora', barcode: '75010003', sku: 'SKU-SIE-03', price: 950, stock: 5 },
        ];

        // Search by barcode
        const term1 = '75010002';
        const matches1 = mockProducts.filter(p => 
            p.barcode.includes(term1) || p.name.toLowerCase().includes(term1.toLowerCase()) || p.sku.toLowerCase().includes(term1.toLowerCase())
        );
        expect(matches1.length).toBe(1);
        expect(matches1[0].id).toBe('prod-2');

        // Search by SKU
        const term2 = 'SKU-SIE';
        const matches2 = mockProducts.filter(p => 
            p.barcode.includes(term2) || p.name.toLowerCase().includes(term2.toLowerCase()) || p.sku.toLowerCase().includes(term2.toLowerCase())
        );
        expect(matches2.length).toBe(1);
        expect(matches2[0].name).toBe('Sierra Caladora');

        // Generic search
        const term3 = 'o'; // Should match multiple
        const matches3 = mockProducts.filter(p => 
            p.barcode.includes(term3) || p.name.toLowerCase().includes(term3.toLowerCase())
        );
        expect(matches3.length).toBeGreaterThan(1);
    });
});
