import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageDrawer } from '@/components/page/drawer/page-drawer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useDistributionZones } from '@/features/logistics/distribution-zones/hooks/use-distribution-zones';
import { useShippingCompanies } from '@/features/logistics/shipping-companies/hooks/use-shipping-companies';
import { useOrganizationContext } from '@/features/organization/context/organization-context';
import type enLogistics from '@/i18n/locales/en/logistics.json';

import { useCreateTrip, useNextTripNumber, useUpdateTrip } from '../hooks/use-trips';
import { TRIP_TYPES, type Trip, type TripPayload, type TripType } from '../types/trip';

type LogisticsLabel = ($: typeof enLogistics) => string;

const TYPE_LABEL: Record<TripType, LogisticsLabel> = {
  company_vehicle: ($) => $.trips.type.company_vehicle,
  personal_vehicle: ($) => $.trips.type.personal_vehicle,
  external_carrier: ($) => $.trips.type.external_carrier,
};

const NAME_MAX = 150;
const NOTES_MAX = 2000;
const CAPACITY_MIN = 1;
const CAPACITY_MAX = 9999;

type FormState = {
  name: string;
  trip_number: string;
  type: TripType;
  capacity: string;
  distribution_zone_id: string;
  shipping_company_id: string;
  notes: string;
};

const EMPTY: FormState = {
  name: '',
  trip_number: '',
  type: 'company_vehicle',
  capacity: '20',
  distribution_zone_id: '',
  shipping_company_id: '',
  notes: '',
};

function toState(trip: Trip): FormState {
  return {
    name: trip.name,
    trip_number: trip.trip_number,
    type: trip.type,
    capacity: String(trip.capacity),
    distribution_zone_id: trip.distribution_zone_id ? String(trip.distribution_zone_id) : '',
    shipping_company_id: trip.shipping_company_id ? String(trip.shipping_company_id) : '',
    notes: trip.notes ?? '',
  };
}

/**
 * Create and edit share one host because the trip write contract is the same
 * shape on both sides — `store` and `update` validate identical rules, the
 * latter with every field optional.
 *
 * Driver and vehicle are deliberately absent. They are not trip attributes:
 * they arrive through a driver-vehicle assignment, which has its own endpoint
 * and its own preconditions. Offering them here would imply a write this form
 * cannot make.
 */
export function TripFormDrawer({
  open,
  onOpenChange,
  trip,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip | null;
}) {
  const { t } = useTranslation('logistics');
  const { activeCompanyId } = useOrganizationContext();
  const isCreate = trip === null;

  // Initial state comes from the trip once, at mount. The parent remounts this
  // drawer whenever the target or the open state changes, so there is nothing
  // to synchronize afterwards and no effect is needed.
  const [form, setForm] = useState<FormState>(() => (trip ? toState(trip) : EMPTY));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const create = useCreateTrip();
  const update = useUpdateTrip();
  const nextNumber = useNextTripNumber(open && isCreate, activeCompanyId ?? undefined);
  const zones = useDistributionZones({ per_page: 100 });
  const carriers = useShippingCompanies({ per_page: 100 });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};

    if (!form.name.trim()) next.name = t(($) => $.trips.form.required);
    else if (form.name.length > NAME_MAX) next.name = t(($) => $.trips.form.nameTooLong);

    const capacity = Number(form.capacity);
    if (!Number.isInteger(capacity) || capacity < CAPACITY_MIN || capacity > CAPACITY_MAX) {
      next.capacity = t(($) => $.trips.form.capacityRange);
    }

    if (form.notes.length > NOTES_MAX) next.notes = t(($) => $.trips.form.notesTooLong);

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    setSubmitError(null);
    if (!validate()) return;

    const payload: Partial<TripPayload> = {
      name: form.name.trim(),
      type: form.type,
      capacity: Number(form.capacity),
      distribution_zone_id: form.distribution_zone_id ? Number(form.distribution_zone_id) : null,
      shipping_company_id: form.shipping_company_id ? Number(form.shipping_company_id) : null,
      notes: form.notes.trim() || null,
    };

    // An empty trip number means "assign the next one", which is the backend's
    // own default — sending a blank string would fail its max:30 string rule.
    if (form.trip_number.trim()) payload.trip_number = form.trip_number.trim();

    try {
      if (isCreate) {
        if (!activeCompanyId) {
          setSubmitError(t(($) => $.trips.form.noCompany));
          return;
        }
        await create.mutateAsync({ ...payload, company_id: activeCompanyId } as TripPayload);
      } else {
        await update.mutateAsync({ id: trip.id, payload });
      }
      onOpenChange(false);
    } catch {
      setSubmitError(t(($) => $.trips.error.title));
    }
  }

  const isSaving = create.isPending || update.isPending;

  return (
    <PageDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={isCreate ? t(($) => $.trips.form.createTitle) : t(($) => $.trips.form.editTitle)}
      description={
        isCreate ? t(($) => $.trips.form.createDescription) : t(($) => $.trips.form.editDescription)
      }
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t(($) => $.trips.form.cancel)}
          </Button>
          <Button onClick={() => void submit()} disabled={isSaving}>
            {isSaving ? t(($) => $.trips.form.saving) : t(($) => $.trips.form.save)}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {submitError && (
          <Alert variant="destructive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="trip-name">{t(($) => $.trips.form.name)}</Label>
          <Input
            id="trip-name"
            value={form.name}
            maxLength={NAME_MAX}
            placeholder={t(($) => $.trips.form.namePlaceholder)}
            onChange={(e) => set('name', e.target.value)}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="trip-number">{t(($) => $.trips.form.tripNumber)}</Label>
            <Input
              id="trip-number"
              value={form.trip_number}
              maxLength={30}
              placeholder={isCreate ? (nextNumber.data ?? '') : ''}
              onChange={(e) => set('trip_number', e.target.value)}
            />
            {isCreate && (
              <p className="text-xs text-muted-foreground">
                {t(($) => $.trips.form.tripNumberHint)}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="trip-capacity">{t(($) => $.trips.form.capacity)}</Label>
            <Input
              id="trip-capacity"
              type="number"
              min={CAPACITY_MIN}
              max={CAPACITY_MAX}
              value={form.capacity}
              onChange={(e) => set('capacity', e.target.value)}
            />
            {errors.capacity ? (
              <p className="text-xs text-destructive">{errors.capacity}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{t(($) => $.trips.form.capacityHint)}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="trip-type">{t(($) => $.trips.form.type)}</Label>
          <select
            id="trip-type"
            value={form.type}
            onChange={(e) => set('type', e.target.value as TripType)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            {TRIP_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(TYPE_LABEL[type])}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="trip-zone">{t(($) => $.trips.drawer.overview.zone)}</Label>
            <select
              id="trip-zone"
              value={form.distribution_zone_id}
              onChange={(e) => set('distribution_zone_id', e.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="">{t(($) => $.trips.drawer.resourcing.none)}</option>
              {(zones.data?.data ?? []).map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name_ar}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="trip-carrier">{t(($) => $.trips.drawer.resourcing.shippingCompany)}</Label>
            <select
              id="trip-carrier"
              value={form.shipping_company_id}
              onChange={(e) => set('shipping_company_id', e.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="">{t(($) => $.trips.drawer.resourcing.none)}</option>
              {(carriers.data?.data ?? []).map((carrier) => (
                <option key={carrier.id} value={carrier.id}>
                  {carrier.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="trip-notes">{t(($) => $.trips.form.notes)}</Label>
          <Textarea
            id="trip-notes"
            rows={3}
            value={form.notes}
            maxLength={NOTES_MAX}
            placeholder={t(($) => $.trips.form.notesPlaceholder)}
            onChange={(e) => set('notes', e.target.value)}
          />
          {errors.notes && <p className="text-xs text-destructive">{errors.notes}</p>}
        </div>
      </div>
    </PageDrawer>
  );
}
