import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/ds/use-toast';

import { supplierReturnsService } from '@/features/supplier-returns/services/supplier-returns-service';
import type {
  CreateSupplierReturnPayload,
  SupplierReturnsQuery,
} from '@/features/supplier-returns/types/supplier-return';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

function useKeys() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return {
    all:   ['company', companyId, 'supplier-returns'] as const,
    list:  (q: SupplierReturnsQuery) => ['company', companyId, 'supplier-returns', 'list', q] as const,
    detail:(id: string) => ['company', companyId, 'supplier-returns', id] as const,
    stats: ['company', companyId, 'supplier-returns', 'stats'] as const,
  };
}

export function useSupplierReturnsQuery(params: SupplierReturnsQuery) {
  const KEYS = useKeys();
  return useQuery({
    queryKey: KEYS.list(params),
    queryFn:  () => supplierReturnsService.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useSupplierReturn(id: string | null) {
  const KEYS = useKeys();
  return useQuery({
    queryKey: KEYS.detail(id ?? ''),
    queryFn:  () => supplierReturnsService.get(id!),
    enabled:  id !== null,
  });
}

export function useSupplierReturnStats() {
  const KEYS = useKeys();
  return useQuery({
    queryKey: KEYS.stats,
    queryFn:  () => supplierReturnsService.stats(),
  });
}

export function useCreateSupplierReturn() {
  const KEYS = useKeys();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateSupplierReturnPayload) => supplierReturnsService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      toast.success('Supplier return created');
    },
    onError: () => toast.error('Failed to create supplier return'),
  });
}

export function useUpdateSupplierReturn(id: string) {
  const KEYS = useKeys();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateSupplierReturnPayload) => supplierReturnsService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      toast.success('Return updated');
    },
    onError: () => toast.error('Failed to update return'),
  });
}

export function useDeleteSupplierReturn() {
  const KEYS = useKeys();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => supplierReturnsService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      toast.success('Return deleted');
    },
    onError: () => toast.error('Failed to delete return'),
  });
}

export function useSubmitSupplierReturn() {
  const KEYS = useKeys();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => supplierReturnsService.submit(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      toast.success('Return submitted for approval');
    },
    onError: () => toast.error('Failed to submit return'),
  });
}

export function useApproveSupplierReturn() {
  const KEYS = useKeys();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => supplierReturnsService.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      toast.success('Return approved');
    },
    onError: () => toast.error('Failed to approve return'),
  });
}

export function useCancelSupplierReturn() {
  const KEYS = useKeys();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => supplierReturnsService.cancel(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.all });
      toast.success('Return cancelled');
    },
    onError: () => toast.error('Failed to cancel return'),
  });
}
