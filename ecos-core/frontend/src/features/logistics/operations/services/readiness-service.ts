import { api } from '@/lib/axios';
import type {
  CapacitySummary,
  DispatchSummary,
  ExceptionsSummary,
  Checklist,
  DiagnosticsCenter,
  ExecutiveSummary,
  FleetSummary,
  HealthScore,
  ModuleValidation,
  ReadinessDashboard,
  TodaySummary,
  ValidationReport,
  ReadinessModuleSummary,
} from '../types/readiness';

const BASE = '/logistics/operations';

export const readinessService = {
  // ── A. Readiness ───────────────────────────────────────────────────────────

  async dashboard(): Promise<ReadinessDashboard> {
    const { data } = await api.get<{ data: ReadinessDashboard }>(`${BASE}/readiness`);
    return data.data;
  },

  async healthScore(): Promise<HealthScore> {
    const { data } = await api.get<{ data: HealthScore }>(`${BASE}/readiness/health-score`);
    return data.data;
  },

  async checklist(): Promise<Checklist> {
    const { data } = await api.get<{ data: Checklist }>(`${BASE}/readiness/checklist`);
    return data.data;
  },

  // ── B. Validation ──────────────────────────────────────────────────────────

  async validate(): Promise<ValidationReport> {
    const { data } = await api.get<{ data: ValidationReport }>(`${BASE}/readiness/validate`);
    return data.data;
  },

  async validateModule(module: string): Promise<ModuleValidation> {
    const { data } = await api.get<{ data: ModuleValidation }>(
      `${BASE}/readiness/validate/${module}`,
    );
    return data.data;
  },

  // ── C. Diagnostics ─────────────────────────────────────────────────────────

  async diagnostics(): Promise<DiagnosticsCenter> {
    const { data } = await api.get<{ data: DiagnosticsCenter }>(`${BASE}/diagnostics`);
    return data.data;
  },

  // ── D. Summaries ───────────────────────────────────────────────────────────

  /** The per-module readiness breakdown. */
  async modules(): Promise<ReadinessModuleSummary> {
    const { data } = await api.get<{ data: ReadinessModuleSummary }>(`${BASE}/readiness/modules`);
    return data.data;
  },

  async capacitySummary(): Promise<CapacitySummary> {
    const { data } = await api.get<{ data: CapacitySummary }>(`${BASE}/summary/capacity`);
    return data.data;
  },

  async dispatchSummary(): Promise<DispatchSummary> {
    const { data } = await api.get<{ data: DispatchSummary }>(`${BASE}/summary/dispatch`);
    return data.data;
  },

  async exceptionsSummary(): Promise<ExceptionsSummary> {
    const { data } = await api.get<{ data: ExceptionsSummary }>(`${BASE}/summary/exceptions`);
    return data.data;
  },

  async executive(): Promise<ExecutiveSummary> {
    const { data } = await api.get<{ data: ExecutiveSummary }>(`${BASE}/summary/executive`);
    return data.data;
  },

  async today(): Promise<TodaySummary> {
    const { data } = await api.get<{ data: TodaySummary }>(`${BASE}/summary/today`);
    return data.data;
  },

  async fleetSummary(): Promise<FleetSummary> {
    const { data } = await api.get<{ data: FleetSummary }>(`${BASE}/summary/fleet`);
    return data.data;
  },
};
