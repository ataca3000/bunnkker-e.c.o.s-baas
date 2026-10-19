import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { EntityDrawer, EntityForm } from '@/components/crud';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChannelFormFields } from '@/features/channels/components/channel-form';
import {
  channelSchema,
  toFormValues,
  toPayload,
  type ChannelFormValues,
} from '@/features/channels/components/channel-form-schema';
import { useCreateChannel, useUpdateChannel } from '@/features/channels/hooks/use-channels';
import type { Channel } from '@/features/channels/types/channel';

const FORM_ID = 'channel-form';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel?: Channel | null;
};

function extractMessage(error: unknown): string {
  return axios.isAxiosError(error) && typeof error.response?.data?.message === 'string'
    ? error.response.data.message
    : 'Something went wrong. Please try again.';
}

export function ChannelFormDrawer({ open, onOpenChange, channel }: Props) {
  const { t } = useTranslation('channels');
  const { t: tCommon } = useTranslation('common');
  const isEdit = Boolean(channel);
  const createChannel = useCreateChannel();
  const updateChannel = useUpdateChannel();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<ChannelFormValues>({
    resolver: zodResolver(channelSchema),
    defaultValues: toFormValues(channel),
  });

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(channel));
    }
  }, [open, channel, form]);

  const isPending = createChannel.isPending || updateChannel.isPending;

  // Ctrl+S — submit form while drawer is open
  const openRef = useRef(open);
  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        document.getElementById(FORM_ID)?.dispatchEvent(
          new Event('submit', { bubbles: true, cancelable: true }),
        );
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    if (!next) setServerError(null);
    onOpenChange(next);
  };

  const handleSubmit = (values: ChannelFormValues) => {
    setServerError(null);
    const payload = toPayload(values);
    const handlers = {
      onSuccess: () => handleOpenChange(false),
      onError: (error: unknown) => setServerError(extractMessage(error)),
    };

    if (isEdit && channel) {
      updateChannel.mutate({ id: channel.id, payload }, handlers);
    } else {
      createChannel.mutate(payload, handlers);
    }
  };

  return (
    <EntityDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title={isEdit ? t($ => $.drawer.editTitle) : t($ => $.drawer.createTitle)}
      description={isEdit ? t($ => $.drawer.editSubtitle) : t($ => $.drawer.createSubtitle)}
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {tCommon($ => $.common.cancel)}
          </Button>
          <Button type="submit" form={FORM_ID} disabled={isPending}>
            {isPending ? t($ => $.drawer.saving) : isEdit ? t($ => $.drawer.submitEdit) : t($ => $.drawer.submitCreate)}
          </Button>
        </>
      }
    >
      {serverError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>{t($ => $.drawer.errorTitle)}</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      ) : null}

      <EntityForm form={form} id={FORM_ID} onSubmit={handleSubmit}>
        <ChannelFormFields />
      </EntityForm>
    </EntityDrawer>
  );
}
