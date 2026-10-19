import { api } from '@/lib/axios';
import type {
  Bottleneck,
  CapacityForecast,
  CapacityWarning,
  DecisionPriority,
  DecisionSummary,
  DispatchForecast,
  OperationalInsight,
  OptimizationKind,
  OptimizationResult,
  Recommendation,
  SmartSuggestion,
  WorkloadForecast,
} from '../types/intelligence';

const BASE = '/logistics/intelligence';

/** Read-only throughout. The company comes from the token, never a parameter. */
export const intelligenceService = {
  // ── Decisions ──────────────────────────────────────────────────────────────

  async decide(): Promise<DecisionSummary> {
    const { data } = await api.get<{ data: DecisionSummary }>(`${BASE}/decisions`);
    return data.data;
  },

  async recommendations(): Promise<Recommendation[]> {
    const { data } = await api.get<{ data: Recommendation[] }>(`${BASE}/decisions/recommendations`);
    return data.data;
  },

  async priorities(): Promise<DecisionPriority[]> {
    const { data } = await api.get<{ data: DecisionPriority[] }>(`${BASE}/decisions/priorities`);
    return data.data;
  },

  async conflicts(): Promise<Recommendation[]> {
    const { data } = await api.get<{ data: Recommendation[] }>(`${BASE}/decisions/conflicts`);
    return data.data;
  },

  // ── Insights ───────────────────────────────────────────────────────────────

  async suggestions(limit = 5): Promise<SmartSuggestion[]> {
    const { data } = await api.get<{ data: SmartSuggestion[] }>(`${BASE}/insights/suggestions`, {
      params: { limit },
    });
    return data.data;
  },

  async bottlenecks(): Promise<Bottleneck[]> {
    const { data } = await api.get<{ data: Bottleneck[] }>(`${BASE}/insights/bottlenecks`);
    return data.data;
  },

  async warnings(): Promise<CapacityWarning[]> {
    const { data } = await api.get<{ data: CapacityWarning[] }>(`${BASE}/insights/warnings`);
    return data.data;
  },

  async insights(): Promise<OperationalInsight[]> {
    const { data } = await api.get<{ data: OperationalInsight[] }>(`${BASE}/insights`);
    return data.data;
  },

  // ── Forecasts ──────────────────────────────────────────────────────────────

  async capacityForecast(): Promise<CapacityForecast> {
    const { data } = await api.get<{ data: CapacityForecast }>(`${BASE}/forecast/capacity`);
    return data.data;
  },

  async dispatchForecast(): Promise<DispatchForecast> {
    const { data } = await api.get<{ data: DispatchForecast }>(`${BASE}/forecast/dispatch`);
    return data.data;
  },

  async workloadForecast(): Promise<WorkloadForecast> {
    const { data } = await api.get<{ data: WorkloadForecast }>(`${BASE}/forecast/workload`);
    return data.data;
  },

  // ── Optimisation ───────────────────────────────────────────────────────────

  async optimization(kind: OptimizationKind): Promise<OptimizationResult> {
    const { data } = await api.get<{ data: OptimizationResult }>(`${BASE}/optimization/${kind}`);
    return data.data;
  },
};
