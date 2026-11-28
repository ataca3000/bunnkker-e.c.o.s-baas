import { describe, expect, it } from 'vitest';
import {
    calculateInventorySummary,
    calculateProductValue,
    calculateTotalProductValue,
} from '../lib/inventoryMetrics';

describe('inventoryMetrics', () => {
    it('calculates total product value by multiplying stock quantity by price for all products', () => {
        const products = [
            { stock: 10, price: 150 },
            { stock: 4, price: 25.5 },
            { stock: 3, price: 199.99 },
        ];

        expect(calculateProductValue(products[0])).toBe(1500);
        expect(calculateProductValue(products[1])).toBe(102);
        expect(calculateProductValue(products[2])).toBe(599.97);
        expect(calculateTotalProductValue(products)).toBe(2201.97);
    });

    it('treats missing, invalid, NaN, or negative stock/price safely as zero', () => {
        const products = [
            { stock: undefined, price: 100 },
            { stock: 5, price: null },
            { stock: -3, price: 50 },
            { stock: 4, price: -20 },
            { stock: 'invalid', price: 'abc' },
            { stock: 2, price: 45 },
        ];

        expect(calculateTotalProductValue(products)).toBe(90);
    });

    it('returns full inventory summary counts alongside totalProductValue', () => {
        const summary = calculateInventorySummary([
            { stock: 12, price: 100 },
            { stock: 0, price: 350 },
            { stock: 2.5, price: 40 },
        ]);

        expect(summary).toEqual({
            totalProductValue: 1300,
            productCount: 3,
            totalUnits: 14.5,
            inStockCount: 2,
            outOfStockCount: 1,
        });
    });

    it('returns zeroed metrics for empty product collections', () => {
        expect(calculateTotalProductValue([])).toBe(0);
        expect(calculateInventorySummary([])).toEqual({
            totalProductValue: 0,
            productCount: 0,
            totalUnits: 0,
            inStockCount: 0,
            outOfStockCount: 0,
        });
    });
});
