import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { shippingCompanyService } from '../services/shipping-company-service';
import type {
  ShippingCompaniesQuery,
  ShippingCompanyPayload,
  ShippingCompanyStatus,
  ShippingContractPayload,
} from '../types/shipping-company';

const KEY = 'logistics-shipping-companies';

// ── Queries ──────────────────────────────────────────────────────────────────

export function useShippingCompanyStats() {
  return useQuery({
    queryKey: [KEY, 'stats'],
    queryFn: () => shippingCompanyService.stats(),
    staleTime: 30_000,
  });
}

export function useNextShippingCompanyCode(enabled: boolean) {
  return useQuery({
    queryKey: [KEY, 'next-code'],
    queryFn: () => shippingCompanyService.nextCode(),
    enabled,
    staleTime: 0,
  });
}

export function useShippingCompanies(params?: ShippingCompaniesQuery) {
  return useQuery({
    queryKey: [KEY, 'list', params],
    queryFn: () => shippingCompanyService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useShippingCompany(id: number | null) {
  return useQuery({
    queryKey: [KEY, 'detail', id],
    queryFn: () => shippingCompanyService.get(id!),
    enabled: id !== null,
  });
}

// ── Company Mutations ────────────────────────────────────────────────────────

export function useCreateShippingCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ShippingCompanyPayload) => shippingCompanyService.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateShippingCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Partial<ShippingCompanyPayload> }) =>
      shippingCompanyService.update(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useSetShippingCompanyStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: ShippingCompanyStatus }) =>
      shippingCompanyService.setStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

// ── Contract Mutations ───────────────────────────────────────────────────────

export function useCreateShippingContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, payload }: { companyId: number; payload: ShippingContractPayload }) =>
      shippingCompanyService.createContract(companyId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useUpdateShippingContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      companyId,
      contractId,
      payload,
    }: {
      companyId: number;
      contractId: number;
      payload: Partial<ShippingContractPayload>;
    }) => shippingCompanyService.updateContract(companyId, contractId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteShippingContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, contractId }: { companyId: number; contractId: number }) =>
      shippingCompanyService.deleteContract(companyId, contractId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useActivateShippingContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, contractId }: { companyId: number; contractId: number }) =>
      shippingCompanyService.activateContract(companyId, contractId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

// ── Mapping Mutations ────────────────────────────────────────────────────────

export function useCreateShippingMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, ecosCompanyId }: { companyId: number; ecosCompanyId: string }) =>
      shippingCompanyService.createMapping(companyId, ecosCompanyId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}

export function useDeleteShippingMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companyId, mappingId }: { companyId: number; mappingId: number }) =>
      shippingCompanyService.deleteMapping(companyId, mappingId),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  });
}
