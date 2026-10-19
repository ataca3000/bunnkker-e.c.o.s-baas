import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { configurationService } from '../services/configuration-service';
import type {
  BrandPolicyPayload,
  BrandShippingRulePayload,
  CloneConfigOptions,
  DeliveryGeography,
  DeliveryGeographyPayload,
  DeliveryZonePayload,
  MasterGovPayload,
  MasterZonePayload,
  PolicyGroup,
  PreparationPolicyPayload,
} from '../types/configuration';
import type { EGYPT_DEFAULT_ZONES } from '../data/egypt-zones';

// ── Cache Keys ────────────────────────────────────────────────────────────────

const COMPANY_SETTINGS_KEY    = 'config-company-settings';
const BRAND_POLICIES_KEY      = 'config-brand-policies';
const DELIVERY_GEO_KEY        = 'config-delivery-geographies';
const SHIPPING_RULES_KEY      = 'config-shipping-rules';
const PREP_POLICIES_KEY       = 'config-preparation-policies';
const CONFIG_AUDIT_KEY        = 'config-audit';
const BRAND_COVERAGE_KEY      = 'brand-coverage';
const COVERAGE_STATS_KEY_EARLY = 'config-coverage-stats';

// This key is owned by use-brand-delivery.ts (order form).
// We invalidate it whenever config changes so orders see fresh data immediately.
const ORDER_DELIVERY_GEO_KEY  = 'brand-delivery-geography';

function invalidateDeliveryData(qc: ReturnType<typeof useQueryClient>, brandId: string) {
  qc.invalidateQueries({ queryKey: [DELIVERY_GEO_KEY, brandId] });
  qc.invalidateQueries({ queryKey: [SHIPPING_RULES_KEY, brandId] });
  qc.invalidateQueries({ queryKey: [BRAND_COVERAGE_KEY, brandId] });
  qc.invalidateQueries({ queryKey: [COVERAGE_STATS_KEY_EARLY, brandId] });
  qc.invalidateQueries({ queryKey: [ORDER_DELIVERY_GEO_KEY, brandId] });
}

// ── Company Settings ──────────────────────────────────────────────────────────

export function useCompanySettings() {
  return useQuery({
    queryKey: [COMPANY_SETTINGS_KEY],
    queryFn:  () => configurationService.getCompanySettings(),
    staleTime: 300_000,
  });
}

export function useUpdateCompanySettingsGroup(group: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { settings: Record<string, unknown>; reason?: string }) =>
      configurationService.updateCompanySettingsGroup(group, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [COMPANY_SETTINGS_KEY] }),
  });
}

export function useCompanyAudit(limit = 50) {
  return useQuery({
    queryKey: [CONFIG_AUDIT_KEY, 'company', limit],
    queryFn:  () => configurationService.getCompanyAudit(limit),
    staleTime: 60_000,
  });
}

// ── Brand Policies ────────────────────────────────────────────────────────────

export function useBrandPoliciesSummary(brandId: string | null) {
  return useQuery({
    queryKey: [BRAND_POLICIES_KEY, 'summary', brandId],
    queryFn:  () => configurationService.getBrandPoliciesSummary(brandId!),
    enabled:  !!brandId,
    staleTime: 60_000,
  });
}

export function useBrandPolicy(brandId: string | null, group: PolicyGroup | null) {
  return useQuery({
    queryKey: [BRAND_POLICIES_KEY, 'detail', brandId, group],
    queryFn:  () => configurationService.getBrandPolicy(brandId!, group!),
    enabled:  !!brandId && !!group,
    staleTime: 60_000,
  });
}

export function useUpdateBrandPolicy(brandId: string, group: PolicyGroup) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BrandPolicyPayload) =>
      configurationService.updateBrandPolicy(brandId, group, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [BRAND_POLICIES_KEY, 'summary', brandId] });
      qc.invalidateQueries({ queryKey: [BRAND_POLICIES_KEY, 'detail', brandId, group] });
    },
  });
}

export function useBrandAudit(brandId: string | null, limit = 50) {
  return useQuery({
    queryKey: [CONFIG_AUDIT_KEY, 'brand', brandId, limit],
    queryFn:  () => configurationService.getBrandAudit(brandId!, limit),
    enabled:  !!brandId,
    staleTime: 60_000,
  });
}

// ── Delivery Geography ────────────────────────────────────────────────────────

export function useDeliveryGeographies(brandId: string | null) {
  return useQuery({
    queryKey: [DELIVERY_GEO_KEY, brandId],
    queryFn:  () => configurationService.listGeographies(brandId!),
    enabled:  !!brandId,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useCreateGeography(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: DeliveryGeographyPayload) =>
      configurationService.createGeography(brandId, payload),
    onSuccess: () => invalidateDeliveryData(qc, brandId),
    onError:   () => invalidateDeliveryData(qc, brandId),
  });
}

export function useUpdateGeography(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<DeliveryGeographyPayload> }) =>
      configurationService.updateGeography(brandId, id, payload),
    onSuccess: () => invalidateDeliveryData(qc, brandId),
  });
}

export function useDeleteGeography(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => configurationService.deleteGeography(brandId, id),
    onSuccess: () => invalidateDeliveryData(qc, brandId),
  });
}

// ── Delivery Zones ────────────────────────────────────────────────────────────

export function useCreateZone(brandId: string, geoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: DeliveryZonePayload) =>
      configurationService.createZone(brandId, geoId, payload),
    onSuccess: () => invalidateDeliveryData(qc, brandId),
  });
}

export function useUpdateZone(brandId: string, geoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<DeliveryZonePayload> }) =>
      configurationService.updateZone(brandId, geoId, id, payload),
    onSuccess: () => invalidateDeliveryData(qc, brandId),
  });
}

export function useDeleteZone(brandId: string, geoId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => configurationService.deleteZone(brandId, geoId, id),
    onSuccess: () => invalidateDeliveryData(qc, brandId),
  });
}

/** Zone update where geoId is provided per-call (needed by the coverage workspace). */
export function useUpdateZoneDynamic(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ geoId, id, payload }: { geoId: string; id: string; payload: Partial<DeliveryZonePayload> }) =>
      configurationService.updateZone(brandId, geoId, id, payload),
    onSuccess: () => invalidateDeliveryData(qc, brandId),
    onError:   () => invalidateDeliveryData(qc, brandId),
  });
}

// ── Shipping Rules ────────────────────────────────────────────────────────────

export function useShippingRules(brandId: string | null) {
  return useQuery({
    queryKey: [SHIPPING_RULES_KEY, brandId],
    queryFn:  () => configurationService.listShippingRules(brandId!),
    enabled:  !!brandId,
    staleTime: 30_000,
  });
}

export function useCreateShippingRule(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BrandShippingRulePayload) =>
      configurationService.createShippingRule(brandId, payload),
    onSuccess: () => invalidateDeliveryData(qc, brandId),
  });
}

export function useUpdateShippingRule(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<BrandShippingRulePayload> }) =>
      configurationService.updateShippingRule(brandId, id, payload),
    onSuccess: () => invalidateDeliveryData(qc, brandId),
  });
}

export function useDeleteShippingRule(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => configurationService.deleteShippingRule(brandId, id),
    onSuccess: () => invalidateDeliveryData(qc, brandId),
  });
}

// ── Preparation Policies ──────────────────────────────────────────────────────

export function usePreparationPolicies(brandId: string | null) {
  return useQuery({
    queryKey: [PREP_POLICIES_KEY, brandId],
    queryFn:  () => configurationService.listPreparationPolicies(brandId!),
    enabled:  !!brandId,
    staleTime: 60_000,
  });
}

export function useCreatePreparationPolicy(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PreparationPolicyPayload) =>
      configurationService.createPreparationPolicy(brandId, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [PREP_POLICIES_KEY, brandId] }),
  });
}

export function useUpdatePreparationPolicy(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<PreparationPolicyPayload> }) =>
      configurationService.updatePreparationPolicy(brandId, id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [PREP_POLICIES_KEY, brandId] }),
  });
}

// ── Composite: Zone + Shipping Rule in one operation ──────────────────────────

export type ZoneWithRulePayload = {
  /** Existing geography id — if null, a new one is created using governorateName */
  geoId:             string | null;
  governorateName:   string;
  governorateNameAr: string;
  governorateCode:   string;
  zoneName:          string;
  shippingCost:      number;
  deliveryWindowId:  string | null;
  isActive:          boolean;
  notes:             string;
};

export type EditZonePayload = {
  zone:             { id: string; geoId: string; name: string; isActive: boolean };
  rule:             { id: string | null; shippingCost: number; deliveryWindowId: string | null; notes: string; isEnabled: boolean };
};

/**
 * Creates or finds a governorate, then creates zone + shipping rule in one user action.
 * Returns a function; call it with the form payload.
 */
export function useCreateZoneWithRule(brandId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (form: ZoneWithRulePayload) => {
      // 1. Resolve or create governorate
      let geoId = form.geoId;
      if (!geoId) {
        const geo = await configurationService.createGeography(brandId, {
          name:       form.governorateName,
          name_ar:    form.governorateNameAr || null,
          code:       form.governorateCode || null,
          is_active:  true,
        });
        geoId = geo.id;
      }

      // 2. Create the zone
      const zone = await configurationService.createZone(brandId, geoId, {
        name:      form.zoneName,
        is_active: form.isActive,
      });

      // 3. Create the shipping rule
      await configurationService.createShippingRule(brandId, {
        delivery_zone_id:    zone.id,
        shipping_cost:       form.shippingCost,
        is_enabled:          form.isActive,
        notes:               form.notes || null,
        delivery_window_id:  form.deliveryWindowId,
      });

      return zone;
    },
    onSuccess: () => invalidateDeliveryData(qc, brandId),
  });
}

/**
 * Updates zone name/active AND shipping rule cost/window in parallel.
 */
export function useEditZoneWithRule(brandId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (form: EditZonePayload) => {
      const ops: Promise<unknown>[] = [];

      // Update zone
      ops.push(
        configurationService.updateZone(brandId, form.zone.geoId, form.zone.id, {
          name:      form.zone.name,
          is_active: form.zone.isActive,
        }),
      );

      // Update or create shipping rule
      if (form.rule.id) {
        ops.push(
          configurationService.updateShippingRule(brandId, form.rule.id, {
            shipping_cost:      form.rule.shippingCost,
            delivery_window_id: form.rule.deliveryWindowId,
            notes:              form.rule.notes || null,
            is_enabled:         form.rule.isEnabled,
          }),
        );
      } else {
        ops.push(
          configurationService.createShippingRule(brandId, {
            delivery_zone_id:   form.zone.id,
            shipping_cost:      form.rule.shippingCost,
            is_enabled:         form.rule.isEnabled,
            notes:              form.rule.notes || null,
            delivery_window_id: form.rule.deliveryWindowId,
          }),
        );
      }

      await Promise.all(ops);
    },
    onSuccess: () => invalidateDeliveryData(qc, brandId),
  });
}

// ── Coverage ──────────────────────────────────────────────────────────────────

const COVERAGE_STATS_KEY = 'config-coverage-stats';
const HEALTH_SCORE_KEY   = 'config-health-score';

export function useBrandCoverage(brandId: string | null) {
  return useQuery({
    queryKey: [BRAND_COVERAGE_KEY, brandId],
    queryFn:  () => configurationService.getBrandCoverage(brandId!),
    enabled:  !!brandId,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useCoverageStats(brandId: string | null) {
  return useQuery({
    queryKey: [COVERAGE_STATS_KEY, brandId],
    queryFn:  () => configurationService.getCoverageStats(brandId!),
    enabled:  !!brandId,
    staleTime: 30_000,
  });
}

export function useHealthScore(brandId: string | null) {
  return useQuery({
    queryKey: [HEALTH_SCORE_KEY, brandId],
    queryFn:  () => configurationService.getHealthScore(brandId!),
    enabled:  !!brandId,
    staleTime: 60_000,
  });
}

export function useCloneConfig(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceBrandId, options }: { sourceBrandId: string; options?: CloneConfigOptions }) =>
      configurationService.cloneConfig(brandId, sourceBrandId, options),
    onSuccess: () => {
      invalidateDeliveryData(qc, brandId);
      qc.invalidateQueries({ queryKey: [COVERAGE_STATS_KEY, brandId] });
      qc.invalidateQueries({ queryKey: [HEALTH_SCORE_KEY, brandId] });
    },
  });
}

// ── Master Geography ──────────────────────────────────────────────────────────

const MASTER_GOVS_KEY   = 'master-govs';
const MASTER_ZONES_KEY  = 'master-zones';

export function useMasterGovs() {
  return useQuery({
    queryKey: [MASTER_GOVS_KEY],
    queryFn:  () => configurationService.listMasterGovs(),
    staleTime: 60_000,
  });
}

export function useMasterZones(govId: string | null) {
  return useQuery({
    queryKey: [MASTER_ZONES_KEY, govId],
    queryFn:  () => configurationService.listMasterZones(govId!),
    enabled:  !!govId,
    staleTime: 30_000,
  });
}

export function useCreateMasterGov() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: MasterGovPayload) => configurationService.createMasterGov(payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [MASTER_GOVS_KEY] }),
  });
}

export function useUpdateMasterGov() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<MasterGovPayload> }) =>
      configurationService.updateMasterGov(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MASTER_GOVS_KEY] }),
  });
}

export function useArchiveMasterGov() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => configurationService.archiveMasterGov(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [MASTER_GOVS_KEY] }),
  });
}

export function useDeleteMasterGov() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => configurationService.deleteMasterGov(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [MASTER_GOVS_KEY] }),
  });
}

export function useCreateMasterZone(govId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: MasterZonePayload) => configurationService.createMasterZone(govId, payload),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: [MASTER_ZONES_KEY, govId] });
      qc.invalidateQueries({ queryKey: [MASTER_GOVS_KEY] });
    },
  });
}

export function useUpdateMasterZone(govId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<MasterZonePayload> }) =>
      configurationService.updateMasterZone(govId, id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: [MASTER_ZONES_KEY, govId] }),
  });
}

export function useArchiveMasterZone(govId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => configurationService.archiveMasterZone(govId, id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: [MASTER_ZONES_KEY, govId] }),
  });
}

export function useDeleteMasterZone(govId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => configurationService.deleteMasterZone(govId, id),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: [MASTER_ZONES_KEY, govId] });
      qc.invalidateQueries({ queryKey: [MASTER_GOVS_KEY] });
    },
  });
}

// ── Bulk Import: Egypt Default Zones ─────────────────────────────────────────

export type BulkImportProgress = {
  total:     number;
  done:      number;
  current:   string;
  errors:    string[];
};

/**
 * Imports the Egypt default zone dataset for a brand.
 * Skips governorates/zones that already exist.
 * Reports progress via onProgress callback.
 */
export function useBulkImportEgyptZones(brandId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      defaultZones,
      existingGeos,
      onProgress,
    }: {
      defaultZones: typeof EGYPT_DEFAULT_ZONES;
      existingGeos: DeliveryGeography[];
      onProgress:   (p: BulkImportProgress) => void;
    }) => {
      const total  = defaultZones.reduce((n, g) => n + g.zones.length, 0);
      let done     = 0;
      const errors: string[] = [];

      for (const govData of defaultZones) {
        onProgress({ total, done, current: govData.governorate, errors });

        // Find or create geography
        let geo = existingGeos.find(
          (g) => g.name.toLowerCase() === govData.governorate.toLowerCase(),
        ) ?? null;

        if (!geo) {
          try {
            geo = await configurationService.createGeography(brandId, {
              name:      govData.governorate,
              is_active: true,
            });
            // Add to local list so subsequent zones find it
            existingGeos.push(geo);
          } catch {
            errors.push(`Failed to create governorate: ${govData.governorate}`);
            done += govData.zones.length;
            continue;
          }
        }

        const existingZoneNames = new Set(geo.zones.map((z) => z.name.toLowerCase()));

        for (const zoneName of govData.zones) {
          done++;
          onProgress({ total, done, current: `${govData.governorate} / ${zoneName}`, errors });

          if (existingZoneNames.has(zoneName.toLowerCase())) {
            continue; // Already exists — skip
          }

          try {
            await configurationService.createZone(brandId, geo.id, {
              name:      zoneName,
              is_active: true,
            });
          } catch {
            errors.push(`Failed to create zone: ${govData.governorate} / ${zoneName}`);
          }
        }
      }

      return { total, done, errors };
    },
    onSuccess: () => invalidateDeliveryData(qc, brandId),
  });
}
