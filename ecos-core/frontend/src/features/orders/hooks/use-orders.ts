import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';

import { ordersService } from '@/features/orders/services/orders-service';
import type {
  BrandOrderPolicy,
  CustomerLookupResult,
  ManualOrderPayload,
  OrderActivity,
  OrderPayload,
  OrderStatus,
  OrderStatusCounts,
  OrdersQuery,
  ShippingCalcResult,
  ShippingPricingRule,
  ShippingQuotePayload,
  ShippingQuoteResult,
} from '@/features/orders/types/order';
import { STATUS_TAB_ORDER } from '@/features/orders/types/order';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

export type CustomerOrderStats = {
  total: number;
  completed: number;
  cancelled: number;
  totalSpend: number;
  lastOrderDate: string | null;
  firstOrderDate: string | null;
  aov: number | null;
  preferredGovernorate: string | null;
};

export const ORDERS_KEY = 'orders';

export function useOrdersQuery(params: OrdersQuery) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, ORDERS_KEY, params],
    queryFn: () => ordersService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useOrderQuery(id: string) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, ORDERS_KEY, id],
    queryFn: () => ordersService.get(id),
    enabled: Boolean(id),
  });
}

/** Per-status order counts for Status Tabs. Runs parallel queries (1 per tab). */
export function useOrderStatusCounts(): OrderStatusCounts {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const tabs = STATUS_TAB_ORDER;

  const results = useQueries({
    queries: tabs.map((tab) => ({
      queryKey: ['company', companyId, ORDERS_KEY, 'count', tab],
      queryFn: () =>
        ordersService.list({
          ...(tab !== 'all' ? { status: tab as OrderStatus } : {}),
          per_page: 1,
          page: 1,
        }),
      staleTime: 30_000,
    })),
  });

  const counts: OrderStatusCounts = {};
  tabs.forEach((tab, i) => {
    counts[tab as OrderStatus | 'all'] = results[i]?.data?.meta.total ?? 0;
  });

  return counts;
}

/** Per-status KPI metrics — count + total_amount. Used by KPI cards above the grid. */
export type StatusKpiEntry = { count: number; totalAmount: number };
export type OrderStatusKpis = Partial<Record<OrderStatus | 'all', StatusKpiEntry>>;

/**
 * Runs one query per status tab and returns count + total_amount.
 * Pass `baseParams` to scope KPIs to the current active filters (brand, channel, date range, etc.).
 * When no baseParams are provided the KPIs reflect global company totals.
 */
export function useOrderStatusKpis(
  baseParams?: Omit<OrdersQuery, 'status' | 'page' | 'per_page' | 'sort_by' | 'sort_dir'>,
): OrderStatusKpis {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const tabs = STATUS_TAB_ORDER;

  const results = useQueries({
    queries: tabs.map((tab) => ({
      queryKey: ['company', companyId, ORDERS_KEY, 'kpi', tab, baseParams ?? null],
      queryFn: () =>
        ordersService.list({
          ...baseParams,
          ...(tab !== 'all' ? { status: tab as OrderStatus } : {}),
          per_page: 1,
          page: 1,
        }),
      staleTime: 60_000,
    })),
  });

  const kpis: OrderStatusKpis = {};
  tabs.forEach((tab, i) => {
    const meta = results[i]?.data?.meta;
    kpis[tab as OrderStatus | 'all'] = {
      count: meta?.total ?? 0,
      totalAmount: meta?.total_amount ?? 0,
    };
  });

  return kpis;
}

export function useCreateOrder() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: OrderPayload) => ordersService.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, ORDERS_KEY] }),
  });
}

export function useUpdateOrder() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: OrderPayload }) =>
      ordersService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, ORDERS_KEY] }),
  });
}

export function useUpdateManualOrder() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ManualOrderPayload }) =>
      ordersService.updateManual(id, payload),
    onSuccess: (order) => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId, ORDERS_KEY] });
      queryClient.setQueryData(['company', companyId, ORDERS_KEY, order.id], order);
    },
  });
}

export function useCreateManualOrder() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: ManualOrderPayload) => ordersService.createManual(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, ORDERS_KEY] }),
  });
}

export function useCustomerByPhone(phone: string) {
  return useQuery<CustomerLookupResult>({
    queryKey: ['customer-by-phone', phone],
    queryFn: () => ordersService.searchByPhone(phone),
    enabled: phone.length >= 8,
    staleTime: 30_000,
  });
}

export function usePatchOrder() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      ordersService.patchOrder(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, ORDERS_KEY] }),
  });
}

export function useAllShippingRules() {
  return useQuery<ShippingPricingRule[]>({
    queryKey: ['shipping-rules-all'],
    queryFn: () => ordersService.listShippingRules(),
    staleTime: 5 * 60_000,
  });
}

export function useCalculateShipping(params: { governorate: string; city?: string; area?: string }) {
  return useQuery<ShippingCalcResult>({
    queryKey: ['shipping-calc', params.governorate, params.city ?? '', params.area ?? ''],
    queryFn: () => ordersService.calculateShipping(params),
    enabled: Boolean(params.governorate),
    staleTime: 60_000,
  });
}

export function useDeleteOrder() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ordersService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, ORDERS_KEY] }),
  });
}

// ── Enterprise Workflow Hooks (TASK-ORDER-LIFECYCLE-001) ─────────────────────

function useWorkflowMutation<TArg>(mutationFn: (arg: TArg) => Promise<unknown>) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, ORDERS_KEY] }),
  });
}

export function useOrderWorkflowConfirm() {
  return useWorkflowMutation((id: string) => ordersService.workflowConfirm(id));
}

export function useOrderWorkflowMoveToPreparation() {
  return useWorkflowMutation((id: string) => ordersService.workflowMoveToPreparation(id));
}

export function useOrderWorkflowCompleteDelivery() {
  return useWorkflowMutation((id: string) => ordersService.workflowCompleteDelivery(id));
}

export function useOrderWorkflowComplete() {
  return useWorkflowMutation((id: string) => ordersService.workflowComplete(id));
}

export function useOrderWorkflowMarkAwaitingStock() {
  return useWorkflowMutation(({ id, reason }: { id: string; reason?: string }) =>
    ordersService.workflowMarkAwaitingStock(id, reason));
}

export function useOrderWorkflowCancel() {
  return useWorkflowMutation(({ id, reason }: { id: string; reason?: string }) =>
    ordersService.workflowCancel(id, reason));
}

export function useOrderWorkflowReturn() {
  return useWorkflowMutation(({ id, reason }: { id: string; reason?: string }) =>
    ordersService.workflowReturn(id, reason));
}

export function useOrderWorkflowVerifyPayment() {
  return useWorkflowMutation(({ id, proofPath }: { id: string; proofPath: string }) =>
    ordersService.workflowVerifyPayment(id, proofPath));
}

export function useOrderWorkflowReschedule() {
  return useWorkflowMutation(({ id, nextDeliveryDate, reason }: { id: string; nextDeliveryDate: string; reason?: string }) =>
    ordersService.workflowReschedule(id, nextDeliveryDate, reason));
}

export function useOrderWorkflowResume() {
  return useWorkflowMutation((id: string) => ordersService.workflowResume(id));
}

export function useOrderWorkflowMoveToReview() {
  return useWorkflowMutation(({ id, reason }: { id: string; reason?: string }) =>
    ordersService.workflowMoveToReview(id, reason));
}

export function useOrderWorkflowDispatch() {
  return useWorkflowMutation((id: string) => ordersService.workflowDispatch(id));
}

export function useOrderWorkflowResumeToConfirmed() {
  return useWorkflowMutation((id: string) => ordersService.workflowResumeToConfirmed(id));
}

export function useOrderWorkflowReturnToConfirmed() {
  return useWorkflowMutation((id: string) => ordersService.workflowReturnToConfirmed(id));
}

export function useOrderWorkflowReturnToPending() {
  return useWorkflowMutation((id: string) => ordersService.workflowReturnToPending(id));
}

export function useOrderWorkflowRevertToConfirmed() {
  return useWorkflowMutation((id: string) => ordersService.workflowRevertToConfirmed(id));
}

export function useOrderWorkflowReturnToProcessing() {
  return useWorkflowMutation((id: string) => ordersService.workflowReturnToProcessing(id));
}

// Generic business-state transition hook.
// SmartStatusSelector uses this exclusively — no individual workflow hooks needed.
export function useOrderWorkflowTransition() {
  return useWorkflowMutation(
    ({ id, targetStatus, reason }: { id: string; targetStatus: string; reason?: string }) =>
      ordersService.workflowTransition(id, targetStatus, reason),
  );
}

export function useConfirmCustomer() {
  return useWorkflowMutation(
    (payload: { id: string; communication_method: string; result: string; notes?: string }) =>
      ordersService.confirmCustomer(payload.id, {
        communication_method: payload.communication_method,
        result: payload.result,
        notes: payload.notes,
      }),
  );
}

// ── Bulk Workflow Hooks ───────────────────────────────────────────────────────

export function useBulkConfirm() {
  return useWorkflowMutation((ids: string[]) => ordersService.bulkConfirm(ids));
}

export function useBulkCancel() {
  return useWorkflowMutation(({ ids, reason }: { ids: string[]; reason?: string }) =>
    ordersService.bulkCancel(ids, reason));
}

export function useBulkMoveToPreparation() {
  return useWorkflowMutation((ids: string[]) => ordersService.bulkMoveToPreparation(ids));
}

export function useBulkCompleteDelivery() {
  return useWorkflowMutation((ids: string[]) => ordersService.bulkCompleteDelivery(ids));
}

export function useBulkComplete() {
  return useWorkflowMutation((ids: string[]) => ordersService.bulkComplete(ids));
}

export function useBulkDispatch() {
  return useWorkflowMutation((ids: string[]) => ordersService.bulkDispatch(ids));
}

export function useBulkMarkAwaitingStock() {
  return useWorkflowMutation(({ ids, reason }: { ids: string[]; reason?: string }) =>
    ordersService.bulkMarkAwaitingStock(ids, reason));
}

export function useBulkResume() {
  return useWorkflowMutation((ids: string[]) => ordersService.bulkResume(ids));
}

export function useBulkMoveToReview() {
  return useWorkflowMutation(({ ids, reason }: { ids: string[]; reason?: string }) =>
    ordersService.bulkMoveToReview(ids, reason));
}

export function useBulkReschedule() {
  return useWorkflowMutation(({ ids, date }: { ids: string[]; date: string }) =>
    ordersService.bulkReschedule(ids, date));
}

export function useBulkReturn() {
  return useWorkflowMutation(({ ids, reason }: { ids: string[]; reason?: string }) =>
    ordersService.bulkReturn(ids, reason));
}

export function useBulkReturnToConfirmed() {
  return useWorkflowMutation((ids: string[]) => ordersService.bulkReturnToConfirmed(ids));
}

export function useBulkResumeToConfirmed() {
  return useWorkflowMutation((ids: string[]) => ordersService.bulkResumeToConfirmed(ids));
}

export function useUpdateZone() {
  return useWorkflowMutation(
    ({ id, zone, zoneId }: { id: string; zone: string; zoneId?: string | null }) =>
      ordersService.updateZone(id, zone, zoneId),
  );
}

// ── Filter options ────────────────────────────────────────────────────────────

export function usePaymentMethods() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery<string[]>({
    queryKey: ['company', companyId, 'orders-payment-methods'],
    queryFn: () => ordersService.listPaymentMethods(),
    staleTime: 5 * 60_000,
  });
}

export function useShippingCompanies() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery<string[]>({
    queryKey: ['company', companyId, 'orders-shipping-companies'],
    queryFn: () => ordersService.listShippingCompanies(),
    staleTime: 5 * 60_000,
  });
}

export function useBrandOrderPolicy(brandId: string | null) {
  return useQuery<BrandOrderPolicy>({
    queryKey: ['brand-order-policy', brandId ?? ''],
    queryFn: () => ordersService.getBrandOrderPolicy(brandId!),
    enabled: Boolean(brandId),
    staleTime: 5 * 60_000,
  });
}

export function useShippingQuote(params: ShippingQuotePayload | null) {
  return useQuery<ShippingQuoteResult>({
    queryKey: ['shipping-quote', params?.brand_id ?? '', params?.governorate_id ?? 0, params?.city_id ?? null],
    queryFn: () => ordersService.getShippingQuote(params!),
    enabled: Boolean(params?.brand_id && params?.governorate_id),
    staleTime: 60_000,
  });
}

// ── Activity timeline ─────────────────────────────────────────────────────────

export function useOrderActivities(orderId: string | null) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery<OrderActivity[]>({
    queryKey: ['company', companyId, ORDERS_KEY, orderId, 'activities'],
    queryFn: () => ordersService.getActivities(orderId!),
    enabled: Boolean(orderId),
    staleTime: 30_000,
  });
}

export function useAddOrderNote() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content, type }: { id: string; content: string; type?: string }) =>
      ordersService.addNote(id, content, type),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId, ORDERS_KEY, id, 'activities'] });
      queryClient.invalidateQueries({ queryKey: ['company', companyId, ORDERS_KEY, id] });
    },
  });
}

export function useUpdateOrderNote() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, noteId, content }: { orderId: string; noteId: string; content: string }) =>
      ordersService.updateNote(orderId, noteId, content),
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId, ORDERS_KEY, orderId] });
      queryClient.invalidateQueries({ queryKey: ['company', companyId, ORDERS_KEY, orderId, 'activities'] });
    },
  });
}

export function useDeleteOrderNote() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, noteId }: { orderId: string; noteId: string }) =>
      ordersService.deleteNote(orderId, noteId),
    onSuccess: (_data, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId, ORDERS_KEY, orderId] });
      queryClient.invalidateQueries({ queryKey: ['company', companyId, ORDERS_KEY, orderId, 'activities'] });
    },
  });
}

/** Fetch order history for a single customer to power the customer badge popup. */
export function useCustomerOrderStats(customerId: string | null) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery<CustomerOrderStats | null>({
    queryKey: ['company', companyId, ORDERS_KEY, 'customer-stats', customerId],
    queryFn: async () => {
      if (!customerId) return null;
      const result = await ordersService.list({ customer_id: customerId, per_page: 200 });
      const items = result.items;
      const totalSpend = items.reduce((sum, o) => sum + o.total, 0);
      // Preferred governorate = the one appearing most often
      const govCounts: Record<string, number> = {};
      for (const o of items) {
        if (o.governorate) govCounts[o.governorate] = (govCounts[o.governorate] ?? 0) + 1;
      }
      const preferredGovernorate = Object.entries(govCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return {
        total: result.meta.total,
        completed: items.filter((o) => o.status === 'delivered').length,
        cancelled: items.filter((o) => o.status === 'cancelled').length,
        totalSpend,
        lastOrderDate: items[0]?.order_date ?? null,
        firstOrderDate: items[items.length - 1]?.order_date ?? null,
        aov: items.length > 0 ? totalSpend / items.length : null,
        preferredGovernorate,
      };
    },
    enabled: Boolean(customerId),
    staleTime: 30_000,
  });
}
