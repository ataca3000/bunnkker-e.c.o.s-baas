import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';

import type {
  CfoWorkspace,
  ExecutiveSummaryReport,
  ExecutiveWorkspace,
  JournalSummary,
} from '../types/finance';

/** Optional reporting window; the API defaults to a trailing 12 months when omitted. */
export type FinancePeriodParams = { from?: string; to?: string };

/**
 * Finance API client (EPIC-FINANCE-UI-001). Read-only against the certified endpoints;
 * unwraps the `{ data }` envelope. No backend modifications.
 */
export const financeService = {
  async executiveWorkspace(params: FinancePeriodParams = {}): Promise<ExecutiveWorkspace> {
    const { data } = await api.get<ApiResponse<ExecutiveWorkspace>>(
      '/finance/intelligence/executive-workspace',
      { params },
    );
    return data.data;
  },

  async cfoWorkspace(): Promise<CfoWorkspace> {
    const { data } = await api.get<ApiResponse<CfoWorkspace>>(
      '/finance/intelligence/cfo-workspace',
    );
    return data.data;
  },

  /** Balance Sheet + Income Statement are produced by the report generator. */
  async executiveSummary(params: FinancePeriodParams = {}): Promise<ExecutiveSummaryReport> {
    const { data } = await api.post<ApiResponse<ExecutiveSummaryReport>>(
      '/finance/intelligence/reports/generate',
      { type: 'executive_summary', ...params },
    );
    return data.data;
  },

  async recentJournals(): Promise<JournalSummary[]> {
    const { data } = await api.get<ApiResponse<JournalSummary[]>>('/finance/journals');
    return data.data;
  },
};
