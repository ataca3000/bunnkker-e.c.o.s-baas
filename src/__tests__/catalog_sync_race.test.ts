import { describe, expect, it } from 'vitest';
import { shouldApplyCatalogSnapshot } from '@/lib/catalogSync';

describe('catalog snapshot synchronization', () => {
    it('accepts a response when no local catalog changes happened during the request', () => {
        const snapshot = [{ id: 'P1', stock: 8 }];

        expect(shouldApplyCatalogSnapshot(snapshot, snapshot, 0)).toBe(true);
    });

    it('rejects a response after a local catalog update', () => {
        const snapshot = [{ id: 'P1', stock: 3 }];
        const updatedProducts = [{ id: 'P1', stock: 9 }];

        expect(shouldApplyCatalogSnapshot(snapshot, updatedProducts, 0)).toBe(false);
    });

    it('rejects a response while a product mutation is still in flight', () => {
        const snapshot = [{ id: 'P1', stock: 3 }];

        expect(shouldApplyCatalogSnapshot(snapshot, snapshot, 1)).toBe(false);
    });
});
