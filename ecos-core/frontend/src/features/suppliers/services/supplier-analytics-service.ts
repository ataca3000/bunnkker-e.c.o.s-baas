import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type {
  ProcurementHealthResult,
  SupplierAnalytics,
  SupplierDocument,
  SupplierInventoryProduct,
  SupplierPriceHistoryEntry,
  SupplierSummaryStats,
  SupplierTimelineEvent,
} from '@/features/suppliers/types/supplier-analytics';

export const supplierAnalyticsService = {
  async getSummaryStats(): Promise<SupplierSummaryStats> {
    const { data } = await api.get<ApiResponse<SupplierSummaryStats>>('/suppliers/stats');
    return data.data;
  },

  async getAnalytics(supplierId: string): Promise<SupplierAnalytics> {
    const { data } = await api.get<ApiResponse<SupplierAnalytics>>(
      `/suppliers/${supplierId}/analytics`,
    );
    return data.data;
  },

  async getInventoryBreakdown(supplierId: string): Promise<SupplierInventoryProduct[]> {
    const { data } = await api.get<ApiResponse<SupplierInventoryProduct[]>>(
      `/suppliers/${supplierId}/inventory-breakdown`,
    );
    return data.data;
  },

  async getHealth(supplierId: string): Promise<ProcurementHealthResult> {
    const { data } = await api.get<ApiResponse<ProcurementHealthResult>>(
      `/suppliers/${supplierId}/health`,
    );
    return data.data;
  },

  async getPriceHistory(supplierId: string): Promise<SupplierPriceHistoryEntry[]> {
    const { data } = await api.get<ApiResponse<SupplierPriceHistoryEntry[]>>(
      `/suppliers/${supplierId}/price-history`,
    );
    return data.data;
  },

  async getTimeline(supplierId: string): Promise<SupplierTimelineEvent[]> {
    const { data } = await api.get<ApiResponse<SupplierTimelineEvent[]>>(
      `/suppliers/${supplierId}/timeline`,
    );
    return data.data;
  },

  async getDocuments(supplierId: string): Promise<SupplierDocument[]> {
    const { data } = await api.get<ApiResponse<SupplierDocument[]>>(
      `/suppliers/${supplierId}/documents`,
    );
    return data.data;
  },

  async uploadDocument(supplierId: string, formData: FormData): Promise<SupplierDocument> {
    const { data } = await api.post<ApiResponse<SupplierDocument>>(
      `/suppliers/${supplierId}/documents`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data.data;
  },

  async deleteDocument(supplierId: string, documentId: string): Promise<void> {
    await api.delete(`/suppliers/${supplierId}/documents/${documentId}`);
  },

  getDownloadUrl(supplierId: string, documentId: string): string {
    return `/api/suppliers/${supplierId}/documents/${documentId}/download`;
  },
};
