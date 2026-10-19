import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';

import type {
  Account,
  AccountCreateInput,
  AccountListParams,
  AccountOptions,
  Journal,
  JournalCreateInput,
  JournalListParams,
  TrialBalance,
} from '../types/finance-gl';

/**
 * General Ledger API client (TASK-FIN-UI-002). Read/write against the certified endpoints
 * only — no backend changes. Unwraps the `{ data }` envelope (except /accounts/options,
 * which is returned unwrapped by the backend).
 */
export const financeGlService = {
  accounts: {
    async list(params: AccountListParams = {}): Promise<Account[]> {
      const { data } = await api.get<ApiResponse<Account[]>>('/finance/accounts', { params });
      return data.data;
    },
    async get(uuid: string): Promise<Account> {
      const { data } = await api.get<ApiResponse<Account>>(`/finance/accounts/${uuid}`);
      return data.data;
    },
    /** NOTE: this endpoint is NOT wrapped in `{ data }`. */
    async options(): Promise<AccountOptions> {
      const { data } = await api.get<AccountOptions>('/finance/accounts/options');
      return data;
    },
    async create(input: AccountCreateInput): Promise<Account> {
      const { data } = await api.post<ApiResponse<Account>>('/finance/accounts', input);
      return data.data;
    },
    async setActive(uuid: string, isActive: boolean): Promise<Account> {
      const { data } = await api.patch<ApiResponse<Account>>(`/finance/accounts/${uuid}/active`, {
        is_active: isActive,
      });
      return data.data;
    },
  },

  journals: {
    async list(params: JournalListParams = {}): Promise<Journal[]> {
      const { data } = await api.get<ApiResponse<Journal[]>>('/finance/journals', { params });
      return data.data;
    },
    async get(uuid: string): Promise<Journal> {
      const { data } = await api.get<ApiResponse<Journal>>(`/finance/journals/${uuid}`);
      return data.data;
    },
    async create(input: JournalCreateInput): Promise<Journal> {
      const { data } = await api.post<ApiResponse<Journal>>('/finance/journals', input);
      return data.data;
    },
    /** Approve + post (checker ≠ maker; requires an open period). Draft → Posted. */
    async approve(uuid: string): Promise<Journal> {
      const { data } = await api.patch<ApiResponse<Journal>>(`/finance/journals/${uuid}/approve`);
      return data.data;
    },
    /** Hard-deletes a draft (the only non-post disposition the backend offers). */
    async discard(uuid: string): Promise<void> {
      await api.delete(`/finance/journals/${uuid}`);
    },
    async reverse(uuid: string, reason: string): Promise<Journal> {
      const { data } = await api.post<ApiResponse<Journal>>(`/finance/journals/${uuid}/reverse`, {
        reason,
      });
      return data.data;
    },
  },

  /** Trial Balance — aggregate per account for an optional fiscal period. */
  async trialBalance(periodId?: string): Promise<TrialBalance> {
    const { data } = await api.get<ApiResponse<TrialBalance>>('/finance/trial-balance', {
      params: periodId ? { period_id: periodId } : {},
    });
    return data.data;
  },
};
