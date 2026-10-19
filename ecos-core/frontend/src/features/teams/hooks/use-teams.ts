import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { teamsService } from '@/features/teams/services/teams-service';
import type { TeamPayload, TeamsQuery } from '@/features/teams/types/team';
import { useOrganizationContext } from '@/features/organization/context/organization-context';

const TEAMS_KEY = 'teams';

export function useTeamsQuery(params: TeamsQuery, options?: { enabled?: boolean }) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, TEAMS_KEY, params],
    queryFn: () => teamsService.list(params),
    placeholderData: keepPreviousData,
    enabled: options?.enabled ?? true,
  });
}

export function useTeamQuery(id: string) {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  return useQuery({
    queryKey: ['company', companyId, TEAMS_KEY, id],
    queryFn: () => teamsService.get(id),
    enabled: !!id,
  });
}

export function useCreateTeam() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TeamPayload) => teamsService.create(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, TEAMS_KEY] }),
  });
}

export function useUpdateTeam() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Omit<TeamPayload, 'company_id'> }) =>
      teamsService.update(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, TEAMS_KEY] }),
  });
}

export function useDeleteTeam() {
  const { activeCompanyId } = useOrganizationContext();
  const companyId = activeCompanyId ?? 'global';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => teamsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', companyId, TEAMS_KEY] }),
  });
}
