import { describe, it, expect } from 'vitest';
import { calculateExpectedAmount, calculateDiscrepancy, ALLOWED_CLOSE_STATUSES } from '../lib/financial';

describe('Financial Cash Close Calculations', () => {
  describe('calculateExpectedAmount', () => {
    it('should sum all cash orders with allowed status', () => {
      const mockOrders = [
        { total: 100, paymentMethod: 'cash', status: 'COMPLETED' },
        { total: 250, paymentMethod: 'cash', status: 'DELIVERED' },
        { total: 150, paymentMethod: 'cash', status: 'READY_TO_SHIP' },
        { total: 300, paymentMethod: 'cash', status: 'OUT_FOR_DELIVERY' },
      ];
      
      const expected = calculateExpectedAmount(mockOrders);
      expect(expected).toBe(800);
    });

    it('should ignore orders with non-cash payment methods', () => {
      const mockOrders = [
        { total: 100, paymentMethod: 'cash', status: 'COMPLETED' },
        { total: 500, paymentMethod: 'card', status: 'COMPLETED' },
        { total: 200, paymentMethod: 'transfer', status: 'COMPLETED' },
      ];

      const expected = calculateExpectedAmount(mockOrders);
      expect(expected).toBe(100);
    });

    it('should ignore orders with disallowed statuses', () => {
      const mockOrders = [
        { total: 100, paymentMethod: 'cash', status: 'COMPLETED' },
        { total: 500, paymentMethod: 'cash', status: 'PENDING_PAYMENT' },
        { total: 200, paymentMethod: 'cash', status: 'CANCELLED' },
      ];

      const expected = calculateExpectedAmount(mockOrders);
      expect(expected).toBe(100);
    });

    it('should return 0 for an empty orders list', () => {
      const expected = calculateExpectedAmount([]);
      expect(expected).toBe(0);
    });
  });

  describe('calculateDiscrepancy', () => {
    it('should return 0 when declared amount equals expected amount', () => {
      const discrepancy = calculateDiscrepancy(1000, 1000);
      expect(discrepancy).toBe(0);
    });

    it('should return a negative value when there is a deficit', () => {
      const discrepancy = calculateDiscrepancy(850, 1000);
      expect(discrepancy).toBe(-150);
    });

    it('should return a positive value when there is a surplus', () => {
      const discrepancy = calculateDiscrepancy(1120, 1000);
      expect(discrepancy).toBe(120);
    });
  });
});
