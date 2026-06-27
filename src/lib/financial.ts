/**
 * Financial operations and calculations utility library.
 */

export const ALLOWED_CLOSE_STATUSES = ['READY_TO_SHIP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'];

/**
 * Calculates the expected cash amount from a list of orders.
 * Filters orders by status and payment method.
 */
export function calculateExpectedAmount(orders: { total: number; paymentMethod: string; status: string }[]): number {
  return orders
    .filter(order => 
      order.paymentMethod === 'cash' && 
      ALLOWED_CLOSE_STATUSES.includes(order.status)
    )
    .reduce((sum, order) => sum + order.total, 0);
}

/**
 * Calculates discrepancy between declared and expected cash.
 * A negative discrepancy indicates a cash deficit.
 */
export function calculateDiscrepancy(declaredAmount: number, expectedAmount: number): number {
  return declaredAmount - expectedAmount;
}
