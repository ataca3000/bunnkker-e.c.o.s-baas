import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { providerConfigService } from '../services/provider-config-service';
import type { RotateSecretPayload, SaveConfigPayload, ValidateConfigPayload } from '../types/provider-config';

function configKey(provider: string) {
  return ['marketing-provider-config', provider];
}

function healthKey(provider: string) {
  return ['marketing-provider-health', provider];
}

export function useProviderConfig(provider: string) {
  return useQuery({
    queryKey: configKey(provider),
    queryFn:  () => providerConfigService.getConfig(provider),
    staleTime: 30_000,
    retry: false,
  });
}

export function useProviderHealth(provider: string) {
  return useQuery({
    queryKey: healthKey(provider),
    queryFn:  () => providerConfigService.getHealth(provider),
    staleTime: 60_000,
    retry: false,
  });
}

export function useValidateProviderConfig(provider: string) {
  return useMutation({
    mutationFn: (payload: ValidateConfigPayload) =>
      providerConfigService.validateConfig(provider, payload),
  });
}

export function useSaveProviderConfig(provider: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveConfigPayload) =>
      providerConfigService.saveConfig(provider, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: configKey(provider) });
      qc.invalidateQueries({ queryKey: healthKey(provider) });
    },
  });
}

export function useRotateProviderSecret(provider: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RotateSecretPayload) =>
      providerConfigService.rotateSecret(provider, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: configKey(provider) });
      qc.invalidateQueries({ queryKey: healthKey(provider) });
    },
  });
}

export function useDeleteProviderConfig(provider: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => providerConfigService.deleteConfig(provider),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: configKey(provider) });
      qc.invalidateQueries({ queryKey: healthKey(provider) });
    },
  });
}
