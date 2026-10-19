import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { carrierService } from '../services/carrier-service';
import type {
  CarrierAccountsQuery,
  CreateCarrierAccountPayload,
  UpsertStatusMappingPayload,
} from '../types/carrier';

const KEY = 'logistics-carriers';

export function useCarrierOptions() {
  return useQuery({
    queryKey: [KEY, 'options'],
    queryFn: () => carrierService.options(),
    staleTime: 5 * 60_000,
  });
}

export function useCarrierAccounts(params?: CarrierAccountsQuery) {
  return useQuery({
    queryKey: [KEY, 'list', params],
    queryFn: () => carrierService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useCarrierAccount(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'detail', id],
    queryFn: () => carrierService.get(id as string),
    enabled: id !== null,
  });
}

export function useCarrierCapabilities(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'capabilities', id],
    queryFn: () => carrierService.capabilities(id as string),
    enabled: id !== null,
  });
}

export function useCarrierStatusMappings(id: string | null) {
  return useQuery({
    queryKey: [KEY, 'status-mappings', id],
    queryFn: () => carrierService.statusMappings(id as string),
    enabled: id !== null,
  });
}

function useCarrierInvalidation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: [KEY] });
}

export function useCreateCarrierAccount() {
  const invalidate = useCarrierInvalidation();

  return useMutation({
    mutationFn: (payload: CreateCarrierAccountPayload) => carrierService.create(payload),
    onSuccess: invalidate,
  });
}

export function useUpsertStatusMapping(id: string) {
  const invalidate = useCarrierInvalidation();

  return useMutation({
    mutationFn: (payload: UpsertStatusMappingPayload) =>
      carrierService.upsertStatusMapping(id, payload),
    onSuccess: invalidate,
  });
}

/**
 * Testing a connection changes nothing, so nothing is invalidated. The result
 * is held by the caller and shown as the outcome of that click.
 */
export function useTestCarrierConnection(id: string) {
  return useMutation({
    mutationFn: () => carrierService.testConnection(id),
  });
}
