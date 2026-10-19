import { api } from '@/lib/axios';
import type {
  BrandOrderPolicy,
  CustomerLookupResult,
  ManualOrderPayload,
  Order,
  OrderActivity,
  OrderFinancialSnapshot,
  OrderPayload,
  OrdersQuery,
  OrdersResult,
  ProductPricingResult,
  ShippingCalcResult,
  ShippingPricingRule,
  ShippingQuotePayload,
  ShippingQuoteResult,
} from '@/features/orders/types/order';
import type { ApiResponse } from '@/types';

export const ordersService = {
  async list(params: OrdersQuery): Promise<OrdersResult> {
    const { data } = await api.get<ApiResponse<OrdersResult>>('/orders', { params });
    return data.data;
  },

  async get(id: string): Promise<Order> {
    const { data } = await api.get<ApiResponse<Order>>(`/orders/${id}`);
    return data.data;
  },

  async create(payload: OrderPayload): Promise<Order> {
    const { data } = await api.post<ApiResponse<Order>>('/orders', payload);
    return data.data;
  },

  async createManual(payload: ManualOrderPayload): Promise<Order> {
    const { data } = await api.post<ApiResponse<Order>>('/orders/manual', payload);
    return data.data;
  },

  async update(id: string, payload: OrderPayload): Promise<Order> {
    const { data } = await api.put<ApiResponse<Order>>(`/orders/${id}`, payload);
    return data.data;
  },

  async updateManual(id: string, payload: ManualOrderPayload): Promise<Order> {
    const { data } = await api.put<ApiResponse<Order>>(`/orders/${id}`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/orders/${id}`);
  },

  async searchByPhone(phone: string): Promise<CustomerLookupResult> {
    const { data } = await api.get<ApiResponse<CustomerLookupResult>>('/customers/search-by-phone', {
      params: { phone },
    });
    return data.data;
  },

  async patchOrder(id: string, payload: Record<string, unknown>): Promise<Order> {
    const { data } = await api.patch<ApiResponse<Order>>(`/orders/${id}/quick-update`, payload);
    return data.data;
  },

  async productPricing(productId: string): Promise<ProductPricingResult> {
    const { data } = await api.get<ApiResponse<ProductPricingResult>>(`/orders/pricing/product/${productId}`);
    return data.data;
  },

  async snapshot(orderId: string): Promise<OrderFinancialSnapshot | null> {
    const { data } = await api.get<ApiResponse<OrderFinancialSnapshot | null>>(`/orders/${orderId}/snapshot`);
    return data.data;
  },

  async listShippingRules(): Promise<ShippingPricingRule[]> {
    const { data } = await api.get<ApiResponse<ShippingPricingRule[]>>('/shipping-pricing');
    return data.data;
  },

  async calculateShipping(
    params: { governorate: string; city?: string; area?: string },
  ): Promise<ShippingCalcResult> {
    const { data } = await api.get<ApiResponse<ShippingCalcResult>>('/shipping-pricing/calculate', { params });
    return data.data;
  },

  async getBrandOrderPolicy(brandId: string): Promise<BrandOrderPolicy> {
    const { data } = await api.get<ApiResponse<{ settings: BrandOrderPolicy }>>(`/configuration/brands/${brandId}/policies/order`);
    return data.data.settings;
  },

  async getShippingQuote(payload: ShippingQuotePayload): Promise<ShippingQuoteResult> {
     
    if (import.meta.env.DEV) console.log('[Shipping][STEP 1] POST /shipping/quote →', payload);
    const { data } = await api.post<ApiResponse<ShippingQuoteResult>>('/shipping/quote', payload);
     
    if (import.meta.env.DEV) console.log('[Shipping][STEP 2] raw API response data.data →', JSON.stringify(data.data));
    return data.data;
  },

  // ── Enterprise Workflow Transitions (TASK-ORDER-LIFECYCLE-001) ───────────────

  async workflowConfirm(id: string): Promise<Order> {
    const { data } = await api.post<{ status: string; order_id: string }>(`/fulfillment/orders/${id}/confirm`);
    return data as unknown as Order;
  },

  async workflowMoveToPreparation(id: string): Promise<Order> {
    const { data } = await api.post<{ status: string; order_id: string }>(`/fulfillment/orders/${id}/move-to-preparation`);
    return data as unknown as Order;
  },

  async workflowCompleteDelivery(id: string): Promise<Order> {
    const { data } = await api.post<{ status: string; order_id: string }>(`/fulfillment/orders/${id}/complete-delivery`);
    return data as unknown as Order;
  },

  async workflowComplete(id: string): Promise<Order> {
    const { data } = await api.post<{ status: string; order_id: string }>(`/fulfillment/orders/${id}/complete`);
    return data as unknown as Order;
  },

  async workflowMarkAwaitingStock(id: string, reason?: string): Promise<Order> {
    const { data } = await api.post<{ status: string; order_id: string }>(`/fulfillment/orders/${id}/awaiting-stock`, { reason });
    return data as unknown as Order;
  },

  async workflowCancel(id: string, reason?: string): Promise<Order> {
    const { data } = await api.post<{ status: string; order_id: string }>(`/fulfillment/orders/${id}/cancel`, { reason });
    return data as unknown as Order;
  },

  async workflowReturn(id: string, reason?: string): Promise<Order> {
    const { data } = await api.post<{ status: string; order_id: string }>(`/fulfillment/orders/${id}/return`, {
      return_reason: reason ?? 'Customer return',
      lines: [],
    });
    return data as unknown as Order;
  },

  async workflowVerifyPayment(id: string, proofPath: string): Promise<Order> {
    const { data } = await api.post<ApiResponse<Order>>(`/orders/${id}/verify-payment`, { payment_proof_path: proofPath });
    return data.data;
  },

  async workflowReschedule(id: string, nextDeliveryDate: string, reason?: string): Promise<Order> {
    const { data } = await api.post<{ status: string; order_id: string }>(`/fulfillment/orders/${id}/reschedule`, {
      next_delivery_date: nextDeliveryDate,
      reschedule_reason: reason,
    });
    return data as unknown as Order;
  },

  async workflowResume(id: string): Promise<Order> {
    const { data } = await api.post<{ status: string; order_id: string }>(`/fulfillment/orders/${id}/resume`);
    return data as unknown as Order;
  },

  async workflowMoveToReview(id: string, reason?: string): Promise<Order> {
    const { data } = await api.post<{ status: string; order_id: string }>(`/fulfillment/orders/${id}/review`, { reason });
    return data as unknown as Order;
  },

  async workflowDispatch(id: string): Promise<Order> {
    const { data } = await api.post<{ status: string; order_id: string }>(`/fulfillment/orders/${id}/dispatch`);
    return data as unknown as Order;
  },

  async workflowReturnToPending(id: string): Promise<Order> {
    const { data } = await api.post<{ status: string; order_id: string }>(`/fulfillment/orders/${id}/return-to-pending`);
    return data as unknown as Order;
  },

  async workflowRevertToConfirmed(id: string): Promise<Order> {
    const { data } = await api.post<{ status: string; order_id: string }>(`/fulfillment/orders/${id}/revert-to-confirmed`);
    return data as unknown as Order;
  },

  async workflowReturnToProcessing(id: string): Promise<Order> {
    const { data } = await api.post<{ status: string; order_id: string }>(`/fulfillment/orders/${id}/return-to-processing`);
    return data as unknown as Order;
  },

  // Generic business-state transition — sends target_status; backend resolves the workflow.
  // The frontend must never know which internal workflow handles a given target_status.
  async workflowTransition(id: string, targetStatus: string, reason?: string): Promise<Order> {
    const { data } = await api.post<{ status: string; order_id: string }>(
      `/fulfillment/orders/${id}/transition`,
      { target_status: targetStatus, ...(reason ? { reason } : {}) },
    );
    return data as unknown as Order;
  },

  // ── Bulk Workflow Transitions ─────────────────────────────────────────────

  async bulkConfirm(ids: string[]): Promise<unknown> {
    const { data } = await api.post('/fulfillment/bulk/confirm', { order_ids: ids });
    return data;
  },

  async bulkCancel(ids: string[], reason?: string): Promise<unknown> {
    const { data } = await api.post('/fulfillment/bulk/cancel', { order_ids: ids, reason });
    return data;
  },

  async bulkMoveToPreparation(ids: string[]): Promise<unknown> {
    const { data } = await api.post('/fulfillment/bulk/move-to-preparation', { order_ids: ids });
    return data;
  },

  async bulkCompleteDelivery(ids: string[]): Promise<unknown> {
    const { data } = await api.post('/fulfillment/bulk/complete-delivery', { order_ids: ids });
    return data;
  },

  async bulkComplete(ids: string[]): Promise<unknown> {
    const { data } = await api.post('/fulfillment/bulk/complete', { order_ids: ids });
    return data;
  },

  async bulkDispatch(ids: string[]): Promise<unknown> {
    const { data } = await api.post('/fulfillment/bulk/dispatch', { order_ids: ids });
    return data;
  },

  async bulkMarkAwaitingStock(ids: string[], reason?: string): Promise<unknown> {
    const { data } = await api.post('/fulfillment/bulk/awaiting-stock', { order_ids: ids, reason });
    return data;
  },

  async bulkResume(ids: string[]): Promise<unknown> {
    const { data } = await api.post('/fulfillment/bulk/resume', { order_ids: ids });
    return data;
  },

  async bulkMoveToReview(ids: string[], reason?: string): Promise<unknown> {
    const { data } = await api.post('/fulfillment/bulk/review', { order_ids: ids, reason });
    return data;
  },

  async bulkReschedule(ids: string[], nextDeliveryDate: string): Promise<unknown> {
    const { data } = await api.post('/fulfillment/bulk/reschedule', {
      order_ids: ids,
      next_delivery_date: nextDeliveryDate,
    });
    return data;
  },

  async bulkReturn(ids: string[], reason?: string): Promise<unknown> {
    const { data } = await api.post('/fulfillment/bulk/return', {
      order_ids: ids,
      return_reason: reason ?? 'Bulk return',
    });
    return data;
  },

  async updateZone(id: string, zone: string, zoneId?: string | null): Promise<Order> {
    const { data } = await api.patch<ApiResponse<Order>>(`/orders/${id}/zone`, {
      delivery_zone: zone,
      delivery_zone_id: zoneId ?? null,
    });
    return data.data;
  },

  async bulkReturnToConfirmed(ids: string[]): Promise<unknown> {
    const { data } = await api.post('/fulfillment/bulk/return-to-confirmed', { order_ids: ids });
    return data;
  },

  async bulkResumeToConfirmed(ids: string[]): Promise<unknown> {
    const { data } = await api.post('/fulfillment/bulk/resume-to-confirmed', { order_ids: ids });
    return data;
  },

  async resolveMapsUrl(url: string): Promise<{ resolved_url: string }> {
    const { data } = await api.post<ApiResponse<{ resolved_url: string }>>('/orders/maps/resolve-url', { url });
    return data.data;
  },

  async workflowResumeToConfirmed(id: string): Promise<unknown> {
    const { data } = await api.post('/fulfillment/bulk/resume-to-confirmed', { order_ids: [id] });
    return data;
  },

  async workflowReturnToConfirmed(id: string): Promise<unknown> {
    const { data } = await api.post('/fulfillment/bulk/return-to-confirmed', { order_ids: [id] });
    return data;
  },

  async confirmCustomer(
    id: string,
    payload: { communication_method: string; result: string; notes?: string },
  ): Promise<Order> {
    const { data } = await api.post<ApiResponse<Order>>(`/orders/${id}/confirm-customer`, payload);
    return data.data;
  },

  // ── Activity timeline ─────────────────────────────────────────────────────

  async getActivities(
    orderId: string,
    params?: { action_type?: string; module?: string; search?: string },
  ): Promise<OrderActivity[]> {
    const { data } = await api.get<ApiResponse<OrderActivity[]>>(
      `/orders/${orderId}/activities`,
      { params },
    );
    return data.data;
  },

  async addNote(orderId: string, content: string, type?: string): Promise<Order> {
    const { data } = await api.post<ApiResponse<Order>>(`/orders/${orderId}/notes`, { content, type });
    return data.data;
  },

  async updateNote(orderId: string, noteId: string, content: string): Promise<void> {
    await api.patch(`/orders/${orderId}/notes/${noteId}`, { content });
  },

  async deleteNote(orderId: string, noteId: string): Promise<void> {
    await api.delete(`/orders/${orderId}/notes/${noteId}`);
  },

  // ── Filter helpers ────────────────────────────────────────────────────────

  async listPaymentMethods(): Promise<string[]> {
    const { data } = await api.get<ApiResponse<string[]>>('/orders/filter/payment-methods');
    return data.data;
  },

  async listShippingCompanies(): Promise<string[]> {
    const { data } = await api.get<ApiResponse<string[]>>('/orders/filter/shipping-companies');
    return data.data;
  },

  // ── ADR-DIST-008: Order SSOT & Distribution Sync ─────────────────────────

  async getDistributionStage(orderId: string): Promise<import('@/features/operations/distribution-board/types/distribution-board').OrderDistributionStage | null> {
    const { data } = await api.get<ApiResponse<import('@/features/operations/distribution-board/types/distribution-board').OrderDistributionStage | null>>(
      `/orders/${orderId}/distribution-stage`,
    );
    return data.data;
  },

  async getDistributionSyncHistory(orderId: string): Promise<import('@/features/operations/distribution-board/types/distribution-board').OrderSyncEvent[]> {
    const { data } = await api.get<ApiResponse<import('@/features/operations/distribution-board/types/distribution-board').OrderSyncEvent[]>>(
      `/orders/${orderId}/distribution-sync-history`,
    );
    return data.data;
  },

  async regenerateManifest(tripId: string, orderId: string | number): Promise<{ manifest_id: number; total_products: number; status: string; items_count: number }> {
    const { data } = await api.post<ApiResponse<{ manifest_id: number; total_products: number; status: string; items_count: number }>>(
      `/distribution/trips/${tripId}/regenerate-manifest`,
      { order_id: orderId },
    );
    return data.data;
  },
};
