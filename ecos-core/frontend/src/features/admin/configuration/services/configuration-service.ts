import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';
import type {
  BrandPolicyDetail,
  BrandPolicySummary,
  BrandPolicyPayload,
  BrandShippingRule,
  BrandShippingRulePayload,
  CloneConfigOptions,
  CloneConfigResult,
  CompanySettings,
  ConfigAuditEntry,
  ConfigHealthScore,
  CoverageGovernorate,
  CoverageStats,
  DeliveryGeography,
  DeliveryGeographyPayload,
  DeliveryZone,
  DeliveryZonePayload,
  MasterGov,
  MasterGovPayload,
  MasterZoneDetail,
  MasterZonePayload,
  PolicyGroup,
  PreparationPolicy,
  PreparationPolicyPayload,
} from '../types/configuration';

const BASE = '/configuration';

export const configurationService = {
  // ── Company Settings ────────────────────────────────────────────────────────

  async getCompanySettings(): Promise<CompanySettings> {
    const { data } = await api.get<ApiResponse<CompanySettings>>(`${BASE}/company`);
    return data.data;
  },

  async getCompanySettingsGroup(group: string): Promise<Record<string, unknown>> {
    const { data } = await api.get<ApiResponse<{ group: string; settings: Record<string, unknown> }>>(
      `${BASE}/company/${group}`,
    );
    return data.data.settings;
  },

  async updateCompanySettingsGroup(group: string, payload: { settings: Record<string, unknown>; reason?: string }): Promise<Record<string, unknown>> {
    const { data } = await api.put<ApiResponse<Record<string, unknown>>>(`${BASE}/company/${group}`, payload);
    return data.data;
  },

  async getCompanyAudit(limit = 50): Promise<ConfigAuditEntry[]> {
    const { data } = await api.get<ApiResponse<ConfigAuditEntry[]>>(`${BASE}/company/audit`, { params: { limit } });
    return data.data;
  },

  // ── Brand Policies ──────────────────────────────────────────────────────────

  async getBrandPoliciesSummary(brandId: string): Promise<BrandPolicySummary[]> {
    const { data } = await api.get<ApiResponse<BrandPolicySummary[]>>(`${BASE}/brands/${brandId}/policies`);
    return data.data;
  },

  async getBrandPolicy(brandId: string, group: PolicyGroup): Promise<BrandPolicyDetail> {
    const { data } = await api.get<ApiResponse<BrandPolicyDetail>>(`${BASE}/brands/${brandId}/policies/${group}`);
    return data.data;
  },

  async updateBrandPolicy(brandId: string, group: PolicyGroup, payload: BrandPolicyPayload): Promise<BrandPolicyDetail> {
    const { data } = await api.put<ApiResponse<BrandPolicyDetail>>(
      `${BASE}/brands/${brandId}/policies/${group}`,
      payload,
    );
    return data.data;
  },

  async getBrandAudit(brandId: string, limit = 50): Promise<ConfigAuditEntry[]> {
    const { data } = await api.get<ApiResponse<ConfigAuditEntry[]>>(`${BASE}/brands/${brandId}/audit`, {
      params: { limit },
    });
    return data.data;
  },

  // ── Delivery Geography ──────────────────────────────────────────────────────

  async listGeographies(brandId: string): Promise<DeliveryGeography[]> {
    const { data } = await api.get<ApiResponse<DeliveryGeography[]>>(`${BASE}/brands/${brandId}/geographies`);
    return data.data;
  },

  async createGeography(brandId: string, payload: DeliveryGeographyPayload): Promise<DeliveryGeography> {
    const { data } = await api.post<ApiResponse<DeliveryGeography>>(
      `${BASE}/brands/${brandId}/geographies`,
      payload,
    );
    return data.data;
  },

  async updateGeography(brandId: string, id: string, payload: Partial<DeliveryGeographyPayload>): Promise<DeliveryGeography> {
    const { data } = await api.put<ApiResponse<DeliveryGeography>>(
      `${BASE}/brands/${brandId}/geographies/${id}`,
      payload,
    );
    return data.data;
  },

  async deleteGeography(brandId: string, id: string): Promise<void> {
    await api.delete(`${BASE}/brands/${brandId}/geographies/${id}`);
  },

  // ── Delivery Zones ──────────────────────────────────────────────────────────

  async listZones(brandId: string, geoId: string): Promise<DeliveryZone[]> {
    const { data } = await api.get<ApiResponse<DeliveryZone[]>>(
      `${BASE}/brands/${brandId}/geographies/${geoId}/zones`,
    );
    return data.data;
  },

  async createZone(brandId: string, geoId: string, payload: DeliveryZonePayload): Promise<DeliveryZone> {
    const { data } = await api.post<ApiResponse<DeliveryZone>>(
      `${BASE}/brands/${brandId}/geographies/${geoId}/zones`,
      payload,
    );
    return data.data;
  },

  async updateZone(brandId: string, geoId: string, id: string, payload: Partial<DeliveryZonePayload>): Promise<DeliveryZone> {
    const { data } = await api.put<ApiResponse<DeliveryZone>>(
      `${BASE}/brands/${brandId}/geographies/${geoId}/zones/${id}`,
      payload,
    );
    return data.data;
  },

  async deleteZone(brandId: string, geoId: string, id: string): Promise<void> {
    await api.delete(`${BASE}/brands/${brandId}/geographies/${geoId}/zones/${id}`);
  },

  // ── Shipping Rules ──────────────────────────────────────────────────────────

  async listShippingRules(brandId: string): Promise<BrandShippingRule[]> {
    const { data } = await api.get<ApiResponse<BrandShippingRule[]>>(`${BASE}/brands/${brandId}/shipping-rules`);
    return data.data;
  },

  async createShippingRule(brandId: string, payload: BrandShippingRulePayload): Promise<BrandShippingRule> {
    const { data } = await api.post<ApiResponse<BrandShippingRule>>(
      `${BASE}/brands/${brandId}/shipping-rules`,
      payload,
    );
    return data.data;
  },

  async updateShippingRule(brandId: string, id: string, payload: Partial<BrandShippingRulePayload>): Promise<BrandShippingRule> {
    const { data } = await api.put<ApiResponse<BrandShippingRule>>(
      `${BASE}/brands/${brandId}/shipping-rules/${id}`,
      payload,
    );
    return data.data;
  },

  async deleteShippingRule(brandId: string, id: string): Promise<void> {
    await api.delete(`${BASE}/brands/${brandId}/shipping-rules/${id}`);
  },

  // ── Preparation Policies ────────────────────────────────────────────────────

  async listPreparationPolicies(brandId: string): Promise<PreparationPolicy[]> {
    const { data } = await api.get<ApiResponse<PreparationPolicy[]>>(
      `${BASE}/brands/${brandId}/preparation-policies`,
    );
    return data.data;
  },

  async createPreparationPolicy(brandId: string, payload: PreparationPolicyPayload): Promise<PreparationPolicy> {
    const { data } = await api.post<ApiResponse<PreparationPolicy>>(
      `${BASE}/brands/${brandId}/preparation-policies`,
      payload,
    );
    return data.data;
  },

  async updatePreparationPolicy(brandId: string, id: string, payload: Partial<PreparationPolicyPayload>): Promise<PreparationPolicy> {
    const { data } = await api.put<ApiResponse<PreparationPolicy>>(
      `${BASE}/brands/${brandId}/preparation-policies/${id}`,
      payload,
    );
    return data.data;
  },

  // ── Coverage ────────────────────────────────────────────────────────────────

  async getBrandCoverage(brandId: string): Promise<CoverageGovernorate[]> {
    const { data } = await api.get<ApiResponse<CoverageGovernorate[]>>(
      `${BASE}/brands/${brandId}/coverage`,
    );
    return data.data;
  },

  async getCoverageStats(brandId: string): Promise<CoverageStats> {
    const { data } = await api.get<ApiResponse<CoverageStats>>(
      `${BASE}/brands/${brandId}/coverage-stats`,
    );
    return data.data;
  },

  async getHealthScore(brandId: string): Promise<ConfigHealthScore> {
    const { data } = await api.get<ApiResponse<ConfigHealthScore>>(
      `${BASE}/brands/${brandId}/health-score`,
    );
    return data.data;
  },

  async cloneConfig(brandId: string, sourceBrandId: string, options?: CloneConfigOptions): Promise<CloneConfigResult> {
    const { data } = await api.post<ApiResponse<CloneConfigResult>>(
      `${BASE}/brands/${brandId}/clone-from/${sourceBrandId}`,
      options ?? {},
    );
    return data.data;
  },

  // ── Master Geography ────────────────────────────────────────────────────────

  async listMasterGovs(): Promise<MasterGov[]> {
    const { data } = await api.get<ApiResponse<MasterGov[]>>(`${BASE}/master-geography`);
    return data.data;
  },

  async getMasterGov(id: string): Promise<MasterGov> {
    const { data } = await api.get<ApiResponse<MasterGov>>(`${BASE}/master-geography/${id}`);
    return data.data;
  },

  async createMasterGov(payload: MasterGovPayload): Promise<MasterGov> {
    const { data } = await api.post<ApiResponse<MasterGov>>(`${BASE}/master-geography`, payload);
    return data.data;
  },

  async updateMasterGov(id: string, payload: Partial<MasterGovPayload>): Promise<MasterGov> {
    const { data } = await api.put<ApiResponse<MasterGov>>(`${BASE}/master-geography/${id}`, payload);
    return data.data;
  },

  async archiveMasterGov(id: string): Promise<MasterGov> {
    const { data } = await api.post<ApiResponse<MasterGov>>(`${BASE}/master-geography/${id}/archive`);
    return data.data;
  },

  async deleteMasterGov(id: string): Promise<void> {
    await api.delete(`${BASE}/master-geography/${id}`);
  },

  async listMasterZones(govId: string): Promise<MasterZoneDetail[]> {
    const { data } = await api.get<ApiResponse<MasterZoneDetail[]>>(
      `${BASE}/master-geography/${govId}/zones`,
    );
    return data.data;
  },

  async createMasterZone(govId: string, payload: MasterZonePayload): Promise<MasterZoneDetail> {
    const { data } = await api.post<ApiResponse<MasterZoneDetail>>(
      `${BASE}/master-geography/${govId}/zones`,
      payload,
    );
    return data.data;
  },

  async updateMasterZone(govId: string, id: string, payload: Partial<MasterZonePayload>): Promise<MasterZoneDetail> {
    const { data } = await api.put<ApiResponse<MasterZoneDetail>>(
      `${BASE}/master-geography/${govId}/zones/${id}`,
      payload,
    );
    return data.data;
  },

  async archiveMasterZone(govId: string, id: string): Promise<MasterZoneDetail> {
    const { data } = await api.post<ApiResponse<MasterZoneDetail>>(
      `${BASE}/master-geography/${govId}/zones/${id}/archive`,
    );
    return data.data;
  },

  async deleteMasterZone(govId: string, id: string): Promise<void> {
    await api.delete(`${BASE}/master-geography/${govId}/zones/${id}`);
  },
};
