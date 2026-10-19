import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  inventoryCountService,
  wasteInvestigationService,
  warehouseLiabilityService,
} from '../services/inventory-count-service';
import type { CountReportData } from '../types/inventory-count';
import type {
  CountSessionsQuery,
  CreateCountSessionPayload,
  UpdateCountSessionPayload,
  WasteInvestigationsQuery,
  ResolveWasteInvestigationPayload,
  WarehouseLiabilitiesQuery,
} from '../types/inventory-count';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

function useCompanyScope() {
  const { activeCompanyId } = useOrganizationContext();
  return activeCompanyId ?? 'global';
}

const KEYS = {
  list: (companyId: string, params: CountSessionsQuery) => ['company', companyId, 'inventory-counts', params] as const,
  detail: (companyId: string, id: string) => ['company', companyId, 'inventory-counts', id] as const,
};

export function useCountSessionsQuery(params: CountSessionsQuery = {}) {
  const companyId = useCompanyScope();
  return useQuery({
    queryKey: KEYS.list(companyId, params),
    queryFn: () => inventoryCountService.list(params),
  });
}

export function useCountSessionQuery(id: string) {
  const companyId = useCompanyScope();
  return useQuery({
    queryKey: KEYS.detail(companyId, id),
    queryFn: () => inventoryCountService.get(id),
    enabled: !!id,
  });
}

export function useCreateCountSession() {
  const companyId = useCompanyScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateCountSessionPayload) => inventoryCountService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', companyId, 'inventory-counts'] }),
  });
}

export function useUpdateCountSession(id: string) {
  const companyId = useCompanyScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateCountSessionPayload) => inventoryCountService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.detail(companyId, id) });
      qc.invalidateQueries({ queryKey: ['company', companyId, 'inventory-counts'] });
    },
  });
}

export function useDeleteCountSession() {
  const companyId = useCompanyScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inventoryCountService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', companyId, 'inventory-counts'] }),
  });
}

function useSessionAction(action: (id: string) => Promise<unknown>) {
  const companyId = useCompanyScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => action(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(companyId, id) });
      qc.invalidateQueries({ queryKey: ['company', companyId, 'inventory-counts'] });
    },
  });
}

export function useStartCountSession() {
  return useSessionAction((id) => inventoryCountService.start(id));
}

export function useCompleteCountSession() {
  return useSessionAction((id) => inventoryCountService.complete(id));
}

export function useApproveCountSession() {
  const companyId = useCompanyScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approvedBy }: { id: string; approvedBy?: string }) =>
      inventoryCountService.approve(id, approvedBy),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(companyId, id) });
      qc.invalidateQueries({ queryKey: ['company', companyId, 'inventory-counts'] });
    },
  });
}

export function useCancelCountSession() {
  return useSessionAction((id) => inventoryCountService.cancel(id));
}

export function useCountReportQuery(id: string) {
  const companyId = useCompanyScope();
  return useQuery<CountReportData>({
    queryKey: ['company', companyId, 'inventory-counts', id, 'report'] as const,
    queryFn:  () => inventoryCountService.report(id),
    enabled:  !!id,
  });
}

export function useUploadCountLineAttachment(sessionId: string) {
  const companyId = useCompanyScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, file, description }: { lineId: string; file: File; description?: string }) =>
      inventoryCountService.uploadLineAttachment(sessionId, lineId, file, description),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', companyId, 'inventory-counts', sessionId] }),
  });
}

export function useDeleteCountLineAttachment(sessionId: string) {
  const companyId = useCompanyScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lineId, attachmentId }: { lineId: string; attachmentId: string }) =>
      inventoryCountService.deleteLineAttachment(sessionId, lineId, attachmentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', companyId, 'inventory-counts', sessionId] }),
  });
}

// ─── Waste Investigations ────────────────────────────────────────────────────

const WASTE_KEYS = {
  list: (companyId: string, params: WasteInvestigationsQuery) => ['company', companyId, 'waste-investigations', params] as const,
  detail: (companyId: string, id: string) => ['company', companyId, 'waste-investigations', id] as const,
};

export function useWasteInvestigationsQuery(params: WasteInvestigationsQuery = {}) {
  const companyId = useCompanyScope();
  return useQuery({
    queryKey: WASTE_KEYS.list(companyId, params),
    queryFn: () => wasteInvestigationService.list(params),
  });
}

export function useWasteInvestigationQuery(id: string) {
  const companyId = useCompanyScope();
  return useQuery({
    queryKey: WASTE_KEYS.detail(companyId, id),
    queryFn: () => wasteInvestigationService.get(id),
    enabled: !!id,
  });
}

export function useResolveWasteInvestigation() {
  const companyId = useCompanyScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ResolveWasteInvestigationPayload }) =>
      wasteInvestigationService.resolve(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: WASTE_KEYS.detail(companyId, id) });
      qc.invalidateQueries({ queryKey: ['company', companyId, 'waste-investigations'] });
      qc.invalidateQueries({ queryKey: ['company', companyId, 'warehouse-liabilities'] });
    },
  });
}

// ─── Warehouse Liabilities ───────────────────────────────────────────────────

const LIABILITY_KEYS = {
  list: (companyId: string, params: WarehouseLiabilitiesQuery) => ['company', companyId, 'warehouse-liabilities', params] as const,
  detail: (companyId: string, id: string) => ['company', companyId, 'warehouse-liabilities', id] as const,
};

export function useWarehouseLiabilitiesQuery(params: WarehouseLiabilitiesQuery = {}) {
  const companyId = useCompanyScope();
  return useQuery({
    queryKey: LIABILITY_KEYS.list(companyId, params),
    queryFn: () => warehouseLiabilityService.list(params),
  });
}

export function useApproveWarehouseLiability() {
  const companyId = useCompanyScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; approved_by: string; notes?: string | null }) =>
      warehouseLiabilityService.approve(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: LIABILITY_KEYS.detail(companyId, id) });
      qc.invalidateQueries({ queryKey: ['company', companyId, 'warehouse-liabilities'] });
    },
  });
}

// ─── Waste Investigation Attachments ─────────────────────────────────────────

export function useUploadWasteAttachment(investigationId: string) {
  const companyId = useCompanyScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      file,
      description,
      uploadedBy,
    }: {
      file: File;
      description?: string;
      uploadedBy?: string;
    }) => wasteInvestigationService.uploadAttachment(investigationId, file, description, uploadedBy),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WASTE_KEYS.detail(companyId, investigationId) });
    },
  });
}

export function useDeleteWasteAttachment(investigationId: string) {
  const companyId = useCompanyScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      wasteInvestigationService.deleteAttachment(investigationId, attachmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: WASTE_KEYS.detail(companyId, investigationId) });
    },
  });
}

export function useRejectWarehouseLiability() {
  const companyId = useCompanyScope();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: string; rejected_by: string; reason?: string | null }) =>
      warehouseLiabilityService.reject(id, payload),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: LIABILITY_KEYS.detail(companyId, id) });
      qc.invalidateQueries({ queryKey: ['company', companyId, 'warehouse-liabilities'] });
    },
  });
}
