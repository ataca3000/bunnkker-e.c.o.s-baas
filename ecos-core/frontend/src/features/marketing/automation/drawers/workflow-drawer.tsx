import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateWorkflow, useUpdateWorkflow } from '../hooks/use-automation-workflows';
import type { AutomationWorkflow, WorkflowTriggerType } from '../types/automation';

interface Props {
  open: boolean;
  onClose: () => void;
  workflow?: AutomationWorkflow;
}

interface FormValues {
  name: string;
  description: string;
  trigger_type: WorkflowTriggerType;
  event_type: string;
  tags: string;
}

const TRIGGER_TYPES: WorkflowTriggerType[] = [
  'business_event',
  'schedule',
  'date_based',
  'webhook',
  'api',
  'manual',
];

export function WorkflowDrawer({ open, onClose, workflow }: Props) {
  const { t }     = useTranslation('marketing');
  const isEditing = !!workflow;
  const create    = useCreateWorkflow();
  const update    = useUpdateWorkflow(workflow?.id ?? '');

  const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      name:         '',
      description:  '',
      trigger_type: 'business_event',
      event_type:   '',
      tags:         '',
    },
  });

  const triggerType = watch('trigger_type');

  useEffect(() => {
    if (workflow) {
      reset({
        name:         workflow.name,
        description:  workflow.description ?? '',
        trigger_type: workflow.trigger_type,
        event_type:   (workflow.event_subscriptions?.[0]?.event_type) ?? '',
        tags:         (workflow.tags ?? []).join(', '),
      });
    } else {
      reset({ name: '', description: '', trigger_type: 'business_event', event_type: '', tags: '' });
    }
  }, [workflow, reset]);

  async function onSubmit(values: FormValues) {
    const tags = values.tags ? values.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined;

    if (isEditing) {
      await update.mutateAsync({ name: values.name, description: values.description || undefined, tags });
    } else {
      await create.mutateAsync({
        name:         values.name,
        description:  values.description || undefined,
        trigger_type: values.trigger_type,
        event_type:   values.event_type || undefined,
        tags,
      });
    }
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-[420px]">
        <SheetHeader>
          <SheetTitle>{isEditing ? t($ => $.automation.workflows.drawer.editTitle) : t($ => $.automation.workflows.drawer.newTitle)}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-6">
          <div className="space-y-1.5">
            <Label>{t($ => $.automation.workflows.drawer.nameLabel)}</Label>
            <Input {...register('name', { required: true })} placeholder={t($ => $.automation.workflows.drawer.namePlaceholder)} />
          </div>

          <div className="space-y-1.5">
            <Label>{t($ => $.common.description)}</Label>
            <Textarea {...register('description')} placeholder={t($ => $.automation.workflows.drawer.descriptionPlaceholder)} rows={2} />
          </div>

          {!isEditing && (
            <>
              <div className="space-y-1.5">
                <Label>{t($ => $.automation.workflows.drawer.triggerTypeLabel)}</Label>
                <Select
                  value={triggerType}
                  onValueChange={v => setValue('trigger_type', v as WorkflowTriggerType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map(tt => (
                      <SelectItem key={tt} value={tt}>{t($ => $.automation.triggerType[tt])}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {triggerType === 'business_event' && (
                <div className="space-y-1.5">
                  <Label>{t($ => $.automation.workflows.drawer.eventTypeLabel)}</Label>
                  <Input {...register('event_type')} placeholder={t($ => $.automation.workflows.drawer.eventTypePlaceholder)} />
                  <p className="text-xs text-muted-foreground">
                    {t($ => $.automation.workflows.drawer.eventTypeHint)}
                  </p>
                </div>
              )}
            </>
          )}

          <div className="space-y-1.5">
            <Label>{t($ => $.common.tags)}</Label>
            <Input {...register('tags')} placeholder={t($ => $.automation.workflows.drawer.tagsPlaceholder)} />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? t($ => $.common.saving) : isEditing ? t($ => $.common.saveChanges) : t($ => $.automation.workflows.drawer.create)}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              {t($ => $.common.cancel)}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

