import { z } from 'zod';

import type { Team, TeamPayload } from '@/features/teams/types/team';

export const teamCreateSchema = z.object({
  company_id: z.string().min(1, 'Company is required'),
  name: z.string().min(1, 'Name is required').max(255),
  code: z.string().max(20).optional(),
  leader_name: z.string().max(255).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  is_active: z.boolean(),
});

export const teamUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  code: z.string().max(20).optional(),
  leader_name: z.string().max(255).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  is_active: z.boolean(),
});

export type TeamCreateFormValues = z.infer<typeof teamCreateSchema>;
export type TeamUpdateFormValues = z.infer<typeof teamUpdateSchema>;

export function toCreateFormValues(defaultCompanyId?: string): TeamCreateFormValues {
  return {
    company_id: defaultCompanyId ?? '',
    name: '',
    code: '',
    leader_name: null,
    description: null,
    is_active: true,
  };
}

export function toUpdateFormValues(team: Team): TeamUpdateFormValues {
  return {
    name: team.name,
    code: team.code,
    leader_name: team.leader_name ?? null,
    description: team.description ?? null,
    is_active: team.is_active,
  };
}

export function toCreatePayload(values: TeamCreateFormValues): TeamPayload {
  return {
    company_id: values.company_id,
    name: values.name,
    code: values.code || undefined,
    leader_name: values.leader_name || null,
    description: values.description || null,
    is_active: values.is_active,
  };
}

export function toUpdatePayload(values: TeamUpdateFormValues): Omit<TeamPayload, 'company_id'> {
  return {
    name: values.name,
    code: values.code || undefined,
    leader_name: values.leader_name || null,
    description: values.description || null,
    is_active: values.is_active,
  };
}
