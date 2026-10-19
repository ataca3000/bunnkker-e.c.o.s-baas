import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useOrganizationContext } from '@/features/organization/context/organization-context';

import { financeGlService } from '../services/finance-gl-service';
import type {
  AccountCreateInput,
  AccountListParams,
  JournalCreateInput,
  JournalListParams,
} from '../types/finance-gl';

/**
 * React-query hooks for the General Ledger workspace (TASK-FIN-UI-002). Company-scoped keys
 * (multi-tenant). Detail queries are lazy (enabled only when a drawer opens).
 */
function useCompanyId() {
  const { activeCompanyId } = useOrganizationContext();
  return activeCompanyId ?? 'global';
}

// ── Chart of Accounts ─────────────────────────────────────────────────────────
export function useAccounts(params: AccountListParams = {}) {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'accounts', params],
    queryFn: () => financeGlService.accounts.list(params),
  });
}

export function useAccountOptions() {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'account-options'],
    queryFn: () => financeGlService.accounts.options(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateAccount() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AccountCreateInput) => financeGlService.accounts.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', companyId, 'finance', 'accounts'] }),
  });
}

export function useSetAccountActive() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, isActive }: { uuid: string; isActive: boolean }) =>
      financeGlService.accounts.setActive(uuid, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', companyId, 'finance', 'accounts'] }),
  });
}

// ── Journal Entries ───────────────────────────────────────────────────────────
export function useJournals(params: JournalListParams = {}) {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'journals', params],
    queryFn: () => financeGlService.journals.list(params),
  });
}

export function useJournal(uuid: string | null) {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'journal', uuid],
    queryFn: () => financeGlService.journals.get(uuid as string),
    enabled: Boolean(uuid),
  });
}

export function useCreateJournal() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: JournalCreateInput) => financeGlService.journals.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', companyId, 'finance', 'journals'] }),
  });
}

export function useApproveJournal() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => financeGlService.journals.approve(uuid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', companyId, 'finance', 'journals'] }),
  });
}

export function useDiscardJournal() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uuid: string) => financeGlService.journals.discard(uuid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', companyId, 'finance', 'journals'] }),
  });
}

export function useReverseJournal() {
  const companyId = useCompanyId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ uuid, reason }: { uuid: string; reason: string }) =>
      financeGlService.journals.reverse(uuid, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', companyId, 'finance', 'journals'] }),
  });
}

// ── Trial Balance ─────────────────────────────────────────────────────────────
export function useTrialBalance(periodId?: string) {
  const companyId = useCompanyId();
  return useQuery({
    queryKey: ['company', companyId, 'finance', 'trial-balance', periodId ?? null],
    queryFn: () => financeGlService.trialBalance(periodId),
  });
}
