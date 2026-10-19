import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type {
  ProviderConfig,
  ProviderHealthCheck,
  RotateSecretPayload,
  RotateSecretResult,
  SaveConfigPayload,
  SaveConfigResult,
  ValidateConfigPayload,
  ValidationResult,
} from '../types/provider-config';

const BASE = '/marketing/providers';

export const providerConfigService = {
  async getConfig(provider: string): Promise<ProviderConfig> {
    const { data } = await api.get<ApiResponse<ProviderConfig>>(`${BASE}/${provider}/config`);
    return data.data;
  },

  async validateConfig(provider: string, payload: ValidateConfigPayload): Promise<ValidationResult> {
    const { data } = await api.post<ApiResponse<ValidationResult>>(
      `${BASE}/${provider}/config/validate`,
      payload,
    );
    return data.data;
  },

  async saveConfig(provider: string, payload: SaveConfigPayload): Promise<SaveConfigResult> {
    const { data } = await api.post<ApiResponse<SaveConfigResult>>(
      `${BASE}/${provider}/config`,
      payload,
    );
    return data.data;
  },

  async rotateSecret(provider: string, payload: RotateSecretPayload): Promise<RotateSecretResult> {
    const { data } = await api.post<ApiResponse<RotateSecretResult>>(
      `${BASE}/${provider}/config/rotate-secret`,
      payload,
    );
    return data.data;
  },

  async getHealth(provider: string): Promise<ProviderHealthCheck> {
    const { data } = await api.get<ApiResponse<ProviderHealthCheck>>(`${BASE}/${provider}/health`);
    return data.data;
  },

  async deleteConfig(provider: string): Promise<void> {
    await api.delete(`${BASE}/${provider}/config`);
  },
};
