/**
 * Financial operations and calculations utility library.
 * Implements bank-grade zero-drift monetary arithmetic using integer cents.
 */

export const ALLOWED_CLOSE_STATUSES = ['READY_TO_SHIP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'];

/**
 * Converts a floating point currency amount to integer cents.
 * Avoids IEEE-754 precision drift by using epsilon rounding.
 */
export function toCents(amount: number): number {
  if (typeof amount !== 'number' || Number.isNaN(amount)) return 0;
  return Math.round((amount + Number.EPSILON) * 100);
}

/**
 * Converts integer cents back to a 2-decimal currency float.
 */
export function fromCents(cents: number): number {
  if (typeof cents !== 'number' || Number.isNaN(cents)) return 0;
  return Math.round(cents) / 100;
}

/**
 * Rounds any monetary number strictly to 2 decimal places with zero drift.
 */
export function roundMoney(amount: number): number {
  return fromCents(toCents(amount));
}

/**
 * Safely adds two monetary amounts avoiding float precision errors (e.g. 0.1 + 0.2).
 */
export function safeAddMoney(a: number, b: number): number {
  return fromCents(toCents(a) + toCents(b));
}

/**
 * Safely subtracts two monetary amounts avoiding float precision errors.
 */
export function safeSubMoney(a: number, b: number): number {
  return fromCents(toCents(a) - toCents(b));
}

/**
 * Safely multiplies a unit monetary amount by a quantity.
 */
export function safeMulMoney(amount: number, qty: number): number {
  const cents = toCents(amount);
  return fromCents(Math.round(cents * qty));
}

/**
 * Calculates the expected cash amount from a list of orders.
 * Filters orders by status and payment method, computing sum in integer cents.
 */
export function calculateExpectedAmount(orders: { total: number; paymentMethod: string; status: string }[]): number {
  const totalCents = orders
    .filter(order => 
      ['cash', 'CASH', 'efectivo', 'EFECTIVO'].includes(order.paymentMethod) && 
      ALLOWED_CLOSE_STATUSES.includes(order.status)
    )
    .reduce((sumCents, order) => sumCents + toCents(order.total || 0), 0);

  return fromCents(totalCents);
}

/**
 * Calculates discrepancy between declared and expected cash.
 * A negative discrepancy indicates a cash deficit.
 * Guaranteed to return 0 if declared matches expected (no 0.00000000000001 drift).
 */
export function calculateDiscrepancy(declaredAmount: number, expectedAmount: number): number {
  return safeSubMoney(declaredAmount || 0, expectedAmount || 0);
}

