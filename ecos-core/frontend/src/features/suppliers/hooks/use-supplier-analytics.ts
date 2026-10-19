import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supplierAnalyticsService } from '@/features/suppliers/services/supplier-analytics-service';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

export function useSupplierSummaryStats() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, 'supplier-summary-stats'],
    queryFn: () => supplierAnalyticsService.getSummaryStats(),
    staleTime: 60_000,
  });
}

export function useSupplierAnalytics(supplierId: string) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, 'supplier-analytics', supplierId],
    queryFn: () => supplierAnalyticsService.getAnalytics(supplierId),
    enabled: Boolean(supplierId),
  });
}

export function useSupplierInventoryBreakdown(supplierId: string) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, 'supplier-inventory-breakdown', supplierId],
    queryFn: () => supplierAnalyticsService.getInventoryBreakdown(supplierId),
    enabled: Boolean(supplierId),
  });
}

export function useSupplierHealth(supplierId: string) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, 'supplier-health', supplierId],
    queryFn: () => supplierAnalyticsService.getHealth(supplierId),
    enabled: Boolean(supplierId),
    staleTime: 5 * 60_000,
  });
}

export function useSupplierPriceHistory(supplierId: string) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, 'supplier-price-history', supplierId],
    queryFn: () => supplierAnalyticsService.getPriceHistory(supplierId),
    enabled: Boolean(supplierId),
  });
}

export function useSupplierTimeline(supplierId: string) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, 'supplier-timeline', supplierId],
    queryFn: () => supplierAnalyticsService.getTimeline(supplierId),
    enabled: Boolean(supplierId),
  });
}

export function useSupplierDocuments(supplierId: string) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, 'supplier-documents', supplierId],
    queryFn: () => supplierAnalyticsService.getDocuments(supplierId),
    enabled: Boolean(supplierId),
  });
}

export function useUploadSupplierDocument(supplierId: string) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => supplierAnalyticsService.uploadDocument(supplierId, formData),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['company', companyId, 'supplier-documents', supplierId] });
    },
  });
}

export function useDeleteSupplierDocument(supplierId: string) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => supplierAnalyticsService.deleteDocument(supplierId, documentId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['company', companyId, 'supplier-documents', supplierId] });
    },
  });
}
