import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { pricingReviewService } from '@/features/cost-management/services/pricing-review-service';
import type {
  ApprovePayload,
  AssignPayload,
  BulkApprovePayload,
  BulkPolicyPayload,
  InlineUpdatePayload,
  PricingReviewsQuery,
  SnoozePayload,
} from '@/features/cost-management/types/pricing-review';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

export const BADGE_KEY = 'price-review-badge';

const KEY = 'pricing-reviews';

export function usePricingReviews(params: PricingReviewsQuery) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, KEY, params],
    queryFn: () => pricingReviewService.list(params),
    placeholderData: keepPreviousData,
  });
}

export function useProductCostDetail(id: string | null) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, KEY, 'detail', id],
    queryFn: () => pricingReviewService.getDetail(id!),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function useApproveReview() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: ApprovePayload }) =>
      pricingReviewService.approve(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', companyId, KEY] }),
  });
}

export function useSnoozeReview() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SnoozePayload }) =>
      pricingReviewService.snooze(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', companyId, KEY] }),
  });
}

export function useAssignReview() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AssignPayload }) =>
      pricingReviewService.assign(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', companyId, KEY] }),
  });
}

export function useBulkApprove() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BulkApprovePayload) =>
      pricingReviewService.bulkApprove(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', companyId, KEY] }),
  });
}

export function useInlineUpdateReview() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: InlineUpdatePayload }) =>
      pricingReviewService.inlineUpdate(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', companyId, KEY] }),
  });
}

export function useBulkPolicyUpdate() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BulkPolicyPayload) =>
      pricingReviewService.bulkPolicy(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', companyId, KEY] }),
  });
}

export function usePublishReview() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pricingReviewService.publish(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company', companyId, KEY] }),
  });
}

export function usePriceReviewBadge(companyId?: string) {
  const { activeCompanyId } = useOrganizationContext();
  const scopeId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', scopeId, BADGE_KEY, companyId],
    queryFn: () => pricingReviewService.getBadge(companyId),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}
