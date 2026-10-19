import { useQuery } from '@tanstack/react-query';

import { ordersService } from '@/features/orders/services/orders-service';
import type { ProductPricingResult } from '@/features/orders/types/order';

/**
 * Fetches the approved selling price and pending-review status for a product.
 * Only fires when a non-empty productId is supplied.
 * staleTime is 60s — prices don't change frequently during an order session.
 */
export function useProductPricing(productId: string | null | undefined): {
  data: ProductPricingResult | undefined;
  isLoading: boolean;
} {
  const query = useQuery({
    queryKey: ['order-product-pricing', productId],
    queryFn: () => ordersService.productPricing(productId!),
    enabled: Boolean(productId),
    staleTime: 60_000,
  });

  return { data: query.data, isLoading: query.isLoading };
}
