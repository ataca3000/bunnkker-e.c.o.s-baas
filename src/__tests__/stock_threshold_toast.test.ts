import { describe, it, expect } from 'vitest';
import {
    computeInventoryStockAlerts,
    findNewlyBreachedProducts,
    formatBreachToastMessage,
    DEFAULT_STOCK_THRESHOLD_CONFIG,
} from '@/lib/stockThresholds';

describe('stockThresholds — visual breach toast detection', () => {
    it('detects newly breached products even when total alert count stays constant or recovers first', () => {
        const cfg = {
            ...DEFAULT_STOCK_THRESHOLD_CONFIG,
            alertsEnabled: true,
            defaultThreshold: 5,
            customThresholds: { P2: 10 },
        };

        // Initial breach on P1 (stock 3 <= min 5)
        const s1 = computeInventoryStockAlerts(
            [
                { id: 'P1', name: 'Tornillo', stock: 3, category: 'General' },
                { id: 'P2', name: 'Cemento', stock: 12, category: 'General' },
            ],
            cfg
        );
        const prev1 = new Set<string>();
        const new1 = findNewlyBreachedProducts(prev1, s1);
        expect(new1.map((x) => x.productId)).toEqual(['P1']);

        // P1 recovers while P2 drops below its custom min 10 (totalAlerts stays 1!)
        const prev2 = new Set<string>(['P1']);
        const s2 = computeInventoryStockAlerts(
            [
                { id: 'P1', name: 'Tornillo', stock: 20, category: 'General' },
                { id: 'P2', name: 'Cemento', stock: 8, category: 'General' },
            ],
            cfg
        );
        const new2 = findNewlyBreachedProducts(prev2, s2);
        expect(new2.map((x) => x.productId)).toEqual(['P2']);
    });

    it('formats clear single-product and multi-product toast notifications', () => {
        const s1 = computeInventoryStockAlerts(
            [{ id: 'P1', name: 'Taladro Industrial', stock: 0, minStock: 4 }],
            DEFAULT_STOCK_THRESHOLD_CONFIG
        );
        const singleMsg = formatBreachToastMessage([...s1.criticalItems, ...s1.lowStockItems]);
        expect(singleMsg.isCritical).toBe(true);
        expect(singleMsg.title).toContain('Stock Crítico (1)');
        expect(singleMsg.message).toContain('Taladro Industrial');
        expect(singleMsg.message).toContain('mínimo: 4');

        const s2 = computeInventoryStockAlerts(
            [
                { id: 'P1', name: 'Broca 1/4', stock: 2, minStock: 5 },
                { id: 'P2', name: 'Cinta Aislante', stock: 4, minStock: 6 },
                { id: 'P3', name: 'Tubo Cobre', stock: 1, minStock: 3 },
            ],
            DEFAULT_STOCK_THRESHOLD_CONFIG
        );
        const multiMsg = formatBreachToastMessage([...s2.criticalItems, ...s2.lowStockItems]);
        expect(multiMsg.isCritical).toBe(false);
        expect(multiMsg.title).toContain('Stock Bajo Mínimo (3)');
        expect(multiMsg.message).toContain('+1 más');
    });

    it('returns no newly breached products when alertsEnabled is false', () => {
        const s = computeInventoryStockAlerts(
            [{ id: 'P1', name: 'Martillo', stock: 0, minStock: 5 }],
            { ...DEFAULT_STOCK_THRESHOLD_CONFIG, alertsEnabled: false }
        );
        expect(findNewlyBreachedProducts(new Set(), s)).toEqual([]);
    });
});
