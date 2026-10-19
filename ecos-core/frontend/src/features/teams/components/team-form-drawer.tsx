import { useEffect, useState } from 'react';
import axios from 'axios';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

import { EntityDrawer, EntityForm } from '@/components/crud';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useCreateTeam, useUpdateTeam } from '@/features/teams/hooks/use-teams';
import type { Team } from '@/features/teams/types/team';
import { TeamFormFields } from './team-form';
import {
  teamCreateSchema,
  teamUpdateSchema,
  toCreateFormValues,
  toUpdateFormValues,
  toCreatePayload,
  toUpdatePayload,
  type TeamCreateFormValues,
  type TeamUpdateFormValues,
} from './team-form-schema';

const FORM_ID = 'team-form';

type TeamFormDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: Team | null;
};

function extractMessage(error: unknown): string {
  return axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : 'Something went wrong. Please try again.';
}

export function TeamFormDrawer({ open, onOpenChange, team }: TeamFormDrawerProps) {
  const isEdit = Boolean(team);
  const createTeam = useCreateTeam();
  const updateTeam = useUpdateTeam();
  const [serverError, setServerError] = useState<string | null>(null);

  const createForm = useForm<TeamCreateFormValues>({
    resolver: zodResolver(teamCreateSchema),
    defaultValues: toCreateFormValues(),
  });

  const updateForm = useForm<TeamUpdateFormValues>({
    resolver: zodResolver(teamUpdateSchema),
    defaultValues: team ? toUpdateFormValues(team) : { name: '', is_active: true },
  });

  const isPending = createTeam.isPending || updateTeam.isPending;

  // `reset` is a stable reference in react-hook-form, so the effect depends on
  // the two reset functions rather than on the whole form objects — whose
  // identity changes each render and would re-reset the form continuously.
  const { reset: resetCreate } = createForm;
  const { reset: resetUpdate } = updateForm;

  useEffect(() => {
    if (open) {
      setServerError(null);
      if (isEdit && team) {
        resetUpdate(toUpdateFormValues(team));
      } else {
        resetCreate(toCreateFormValues());
      }
    }
  }, [open, team, isEdit, resetCreate, resetUpdate]);

  const handleOpenChange = (next: boolean) => {
    if (!next) setServerError(null);
    onOpenChange(next);
  };

  const handlers = {
    onSuccess: () => handleOpenChange(false),
    onError: (error: unknown) => setServerError(extractMessage(error)),
  };

  const header = serverError ? (
    <Alert variant="destructive" className="mb-4">
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{serverError}</AlertDescription>
    </Alert>
  ) : null;

  const footer = (
    <>
      <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
        Cancel
      </Button>
      <Button type="submit" form={FORM_ID} disabled={isPending}>
        {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Team'}
      </Button>
    </>
  );

  return (
    <EntityDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title={isEdit ? 'Edit Team' : 'New Team'}
      description={isEdit ? 'Update team details.' : 'Create a new team for your organization.'}
      footer={footer}
    >
      {header}
      {isEdit ? (
        <EntityForm
          form={updateForm}
          id={FORM_ID}
          onSubmit={(values) => {
            setServerError(null);
            if (team) updateTeam.mutate({ id: team.id, payload: toUpdatePayload(values) }, handlers);
          }}
        >
          <TeamFormFields mode="edit" />
        </EntityForm>
      ) : (
        <EntityForm
          form={createForm}
          id={FORM_ID}
          onSubmit={(values) => {
            setServerError(null);
            createTeam.mutate(toCreatePayload(values), handlers);
          }}
        >
          <TeamFormFields mode="create" />
        </EntityForm>
      )}
    </EntityDrawer>
  );
}
