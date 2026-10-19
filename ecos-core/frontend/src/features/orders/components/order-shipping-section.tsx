import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Loader2, Lock, Unlock } from 'lucide-react';

import { FormField } from '@/components/crud';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCalculateShipping } from '@/features/orders/hooks/use-orders';
import type { ManualOrderFormValues } from '@/features/orders/components/order-form-schema';

export function OrderShippingSection() {
  const { t } = useTranslation('orders');
  const { register, setValue, watch } = useFormContext<ManualOrderFormValues>();
  const [overrideUnlocked, setOverrideUnlocked] = useState(false);

  const governorate = watch('governorate') ?? '';
  const city = watch('city') ?? '';
  const area = watch('area') ?? '';
  const shippingCostSource = watch('shipping_cost_source');

  const { data: calc, isFetching } = useCalculateShipping({
    governorate,
    city: city || undefined,
    area: area || undefined,
  });

  // Auto-populate shipping cost when a rule is found and not overridden
  useEffect(() => {
    if (calc?.found && !overrideUnlocked) {
      setValue('shipping_cost', String(calc.standard_cost ?? ''));
      setValue('shipping_cost_source', 'auto');
    }
  }, [calc, overrideUnlocked, setValue]);

  const handleOverrideToggle = () => {
    const next = !overrideUnlocked;
    setOverrideUnlocked(next);
    if (!next && calc?.found) {
      setValue('shipping_cost', String(calc.standard_cost ?? ''));
      setValue('shipping_cost_source', 'auto');
    } else if (next) {
      setValue('shipping_cost_source', 'override');
    }
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField name="governorate" label={t($ => $.workspace.fields.governorate)} required>
        <Input placeholder={t($ => $.workspace.governoratePlaceholder)} {...register('governorate')} />
      </FormField>

      <FormField name="city" label={t($ => $.workspace.fields.city)}>
        <Input placeholder={t($ => $.workspace.cityPlaceholder)} {...register('city')} />
      </FormField>

      <FormField name="area" label={t($ => $.workspace.fields.area)}>
        <Input placeholder={t($ => $.workspace.areaPlaceholder)} {...register('area')} />
      </FormField>

      <FormField name="shipping_address" label={t($ => $.workspace.fields.shippingAddress)}>
        <Input placeholder={t($ => $.workspace.shippingAddressPlaceholder)} {...register('shipping_address')} />
      </FormField>

      <div className="sm:col-span-2">
        <FormField name="shipping_cost" label={t($ => $.workspace.fields.shippingCost)}>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                {...register('shipping_cost')}
                disabled={!overrideUnlocked && calc?.found}
                className={!overrideUnlocked && calc?.found ? 'bg-muted' : ''}
              />
              {isFetching && (
                <Loader2 className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleOverrideToggle}
              title={overrideUnlocked ? t($ => $.workspace.lockToAutoRate) : t($ => $.workspace.overrideShippingCost)}
            >
              {overrideUnlocked ? <Lock className="size-4" /> : <Unlock className="size-4" />}
            </Button>
          </div>
          {calc?.found && !overrideUnlocked && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t($ => $.workspace.autoCalculated, { level: calc.matched_level })}
            </p>
          )}
          {shippingCostSource === 'override' && (
            <p className="mt-1 text-xs text-amber-600">{t($ => $.workspace.manualOverrideActive)}</p>
          )}
        </FormField>
      </div>
    </div>
  );
}
