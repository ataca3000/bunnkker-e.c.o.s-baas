import { describe, it, expect } from 'vitest';
import {
    validateRestockPiecesInput,
    getRestockMismatchFeedback,
    parseRestockAuditRow,
} from '@/lib/restockConfirmation';

describe('restockConfirmation — double-entry restock validation & audit parsing', () => {
    it('rejects empty, zero, negative, and non-matching confirmation inputs', () => {
        const emptyRes = validateRestockPiecesInput('', '', { currentStock: 2 });
        expect(emptyRes.valid).toBe(false);
        if (!emptyRes.valid) expect(emptyRes.reason).toBe('EMPTY');

        const zeroRes = validateRestockPiecesInput('0', '0', { currentStock: 2 });
        expect(zeroRes.valid).toBe(false);
        if (!zeroRes.valid) expect(zeroRes.reason).toBe('INVALID_NUMBER');

        const negativeRes = validateRestockPiecesInput('-5', '-5', { currentStock: 2 });
        expect(negativeRes.valid).toBe(false);
        if (!negativeRes.valid) expect(negativeRes.reason).toBe('INVALID_NUMBER');

        const missingConfirm = validateRestockPiecesInput('10', '', { currentStock: 2 });
        expect(missingConfirm.valid).toBe(false);
        if (!missingConfirm.valid) expect(missingConfirm.reason).toBe('MISMATCH');

        const mismatchRes = validateRestockPiecesInput('10', '12', { currentStock: 2 });
        expect(mismatchRes.valid).toBe(false);
        if (!mismatchRes.valid) {
            expect(mismatchRes.reason).toBe('MISMATCH');
            expect(mismatchRes.message).toContain('10 vs 12');
        }
    });

    it('rejects decimals for discrete products and allows matching decimals for bulk products', () => {
        const decimalBlocked = validateRestockPiecesInput('2.5', '2.5', {
            allowDecimal: false,
            currentStock: 1,
        });
        expect(decimalBlocked.valid).toBe(false);
        if (!decimalBlocked.valid) expect(decimalBlocked.reason).toBe('DECIMAL_NOT_ALLOWED');

        const integerOk = validateRestockPiecesInput('15', '15', {
            allowDecimal: false,
            currentStock: 3,
        });
        expect(integerOk).toEqual({
            valid: true,
            qty: 15,
            previousStock: 3,
            resultingStock: 18,
        });

        const bulkOk = validateRestockPiecesInput('2.75', '2.750', {
            allowDecimal: true,
            currentStock: 1.25,
        });
        expect(bulkOk).toEqual({
            valid: true,
            qty: 2.75,
            previousStock: 1.25,
            resultingStock: 4,
        });
    });

    it('generates progressive 1 / 2 / 3+ mismatch error messages matching price confirmation behavior', () => {
        const msg1 = getRestockMismatchFeedback(1, '8', '9');
        const msg2 = getRestockMismatchFeedback(2, '8', '9');
        const msg3 = getRestockMismatchFeedback(3, '8', '9');

        expect(msg1).toContain('Error 1');
        expect(msg1).toContain('8 vs 9');
        expect(msg2).toContain('Error 2');
        expect(msg3).toContain('Intento fallido');
    });

    it('parses structured JSON AuditLog details and safely falls back on plain-text logs', () => {
        const jsonEntry = parseRestockAuditRow({
            id: 'log-101',
            timestamp: new Date('2026-11-15T03:00:00.000Z'),
            userId: 'uid-emp-1',
            action: 'STOCK_UPDATE',
            details: JSON.stringify({
                productId: 'PROD-9',
                productName: 'Tornillo Galvanizado',
                unitType: 'PZA',
                previousStock: 2,
                addedQty: 20,
                newStock: 22,
                minStock: 10,
                estante: 'A2',
                fila: '3',
                operatorUid: 'uid-emp-1',
                operatorName: 'Carlos Almacén',
                operatorRole: 'inventory',
                notes: 'Caja completa recibida',
                doubleConfirmed: true,
            }),
        });

        expect(jsonEntry).toEqual({
            id: 'log-101',
            timestamp: '2026-11-15T03:00:00.000Z',
            productId: 'PROD-9',
            productName: 'Tornillo Galvanizado',
            unitType: 'PZA',
            previousStock: 2,
            addedQty: 20,
            newStock: 22,
            minStock: 10,
            estante: 'A2',
            fila: '3',
            operatorUid: 'uid-emp-1',
            operatorName: 'Carlos Almacén',
            operatorRole: 'inventory',
            notes: 'Caja completa recibida',
            doubleConfirmed: true,
        });

        const plainEntry = parseRestockAuditRow({
            id: 'log-102',
            timestamp: '2026-11-15T03:10:00.000Z',
            userId: 'admin-1',
            details: 'Ajuste manual legacy +5 pzas',
        });

        expect(plainEntry.id).toBe('log-102');
        expect(plainEntry.productName).toBe('Ajuste manual legacy +5 pzas');
        expect(plainEntry.notes).toBe('Ajuste manual legacy +5 pzas');
        expect(plainEntry.doubleConfirmed).toBe(false);
        expect(plainEntry.addedQty).toBeNull();
    });
});
