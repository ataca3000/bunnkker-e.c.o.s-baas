import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCreateSegment, useUpdateSegment } from '../hooks/use-audience-segments';
import type { AudienceSegment, SegmentType } from '../types/automation';

interface Props {
  open: boolean;
  onClose: () => void;
  segment?: AudienceSegment;
}

interface FormValues {
  name: string;
  description: string;
  segment_type: SegmentType;
  entity_type: string;
  is_dynamic: boolean;
}

const SEGMENT_TYPES: SegmentType[] = [
  'demographic',
  'geographic',
  'behavioral',
  'transactional',
  'marketing',
  'business',
  'operational',
  'custom',
];

export function SegmentDrawer({ open, onClose, segment }: Props) {
  const { t }     = useTranslation('marketing');
  const isEditing = !!segment;
  const create    = useCreateSegment();
  const update    = useUpdateSegment(segment?.id ?? '');

  const { register, handleSubmit, reset, setValue, watch, formState: { isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      name:         '',
      description:  '',
      segment_type: 'behavioral',
      entity_type:  'customer',
      is_dynamic:   true,
    },
  });

  const segmentType = watch('segment_type');

  useEffect(() => {
    if (segment) {
      reset({
        name:         segment.name,
        description:  segment.description ?? '',
        segment_type: segment.segment_type,
        entity_type:  segment.entity_type,
        is_dynamic:   segment.is_dynamic,
      });
    } else {
      reset({ name: '', description: '', segment_type: 'behavioral', entity_type: 'customer', is_dynamic: true });
    }
  }, [segment, reset]);

  async function onSubmit(values: FormValues) {
    if (isEditing) {
      await update.mutateAsync({ name: values.name, description: values.description || undefined });
    } else {
      await create.mutateAsync({
        name:         values.name,
        description:  values.description || undefined,
        segment_type: values.segment_type,
        entity_type:  values.entity_type,
        is_dynamic:   values.is_dynamic,
        rules:        { conditions: [] },
      });
    }
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-[420px]">
        <SheetHeader>
          <SheetTitle>{isEditing ? t($ => $.audiences.drawer.editTitle) : t($ => $.audiences.drawer.newTitle)}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-6">
          <div className="space-y-1.5">
            <Label>{t($ => $.audiences.drawer.nameLabel)}</Label>
            <Input {...register('name', { required: true })} placeholder={t($ => $.audiences.drawer.namePlaceholder)} />
          </div>

          <div className="space-y-1.5">
            <Label>{t($ => $.common.description)}</Label>
            <Textarea {...register('description')} placeholder={t($ => $.audiences.drawer.descriptionPlaceholder)} rows={2} />
          </div>

          {!isEditing && (
            <>
              <div className="space-y-1.5">
                <Label>{t($ => $.audiences.drawer.segmentTypeLabel)}</Label>
                <Select
                  value={segmentType}
                  onValueChange={v => setValue('segment_type', v as SegmentType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENT_TYPES.map(st => (
                      <SelectItem key={st} value={st}>{t($ => $.audiences.segmentType[st])}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>{t($ => $.audiences.drawer.entityTypeLabel)}</Label>
                <Select
                  value={watch('entity_type')}
                  onValueChange={v => setValue('entity_type', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customer">{t($ => $.audiences.entityType.customer)}</SelectItem>
                    <SelectItem value="lead">{t($ => $.audiences.entityType.lead)}</SelectItem>
                    <SelectItem value="order">{t($ => $.audiences.entityType.order)}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_dynamic"
                  {...register('is_dynamic')}
                  className="h-4 w-4"
                />
                <Label htmlFor="is_dynamic">{t($ => $.audiences.drawer.isDynamicLabel)}</Label>
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? t($ => $.common.saving) : isEditing ? t($ => $.common.saveChanges) : t($ => $.audiences.drawer.create)}
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

