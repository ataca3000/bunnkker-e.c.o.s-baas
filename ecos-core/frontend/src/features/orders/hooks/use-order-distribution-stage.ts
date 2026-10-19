import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ordersService } from '@/features/orders/services/orders-service';
import { useToast } from '@/components/ds/use-toast';
import type { OrderDistributionStage } from '@/features/operations/distribution-board/types/distribution-board';

const stageKey = (orderId: string) => ['order-distribution-stage', orderId] as const;
const historyKey = (orderId: string) => ['order-distribution-sync-history', orderId] as const;

/**
 * Fetches the current Distribution OS stage for an order.
 * Returns null if the order is not in any active trip.
 * Only fetches when orderId is provided and the drawer/edit page is open.
 */
export function useOrderDistributionStage(orderId: string | null | undefined, enabled = true) {
  return useQuery<OrderDistributionStage | null>({
    queryKey: stageKey(orderId ?? ''),
    queryFn: () => ordersService.getDistributionStage(orderId!),
    enabled: Boolean(orderId) && enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/**
 * Fetches the synchronization event history for an order.
 */
export function useOrderDistributionSyncHistory(orderId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: historyKey(orderId ?? ''),
    queryFn: () => ordersService.getDistributionSyncHistory(orderId!),
    enabled: Boolean(orderId) && enabled,
    staleTime: 30_000,
  });
}

/**
 * Mutation to regenerate the loading manifest for a trip.
 * Used by supervisors after an order is modified during Approved/Loading stage.
 */
export function useRegenerateManifest(tripId: string, orderId: string | number) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: () => ordersService.regenerateManifest(tripId, orderId),
    onSuccess: (result) => {
      toast({
        title: 'Manifest Regenerated',
        description: `Loading manifest updated with ${result.total_products} product(s).`,
      });
      void queryClient.invalidateQueries({ queryKey: stageKey(String(orderId)) });
      void queryClient.invalidateQueries({ queryKey: ['dispatch-gate-workspace', tripId] });
      void queryClient.invalidateQueries({ queryKey: ['loading-manifest', tripId] });
    },
    onError: () => {
      toast({ title: 'Regeneration Failed', description: 'Could not regenerate the loading manifest.', variant: 'destructive' });
    },
  });
}
