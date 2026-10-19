import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useBrandShippingCities,
  useBrandShippingGovernorates,
} from '@/features/brands/hooks/use-brand-shipping';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { usePatchOrder, useUpdateZone } from '@/features/orders/hooks/use-orders';
import type { Order } from '../types/order';

type Props = { order: Order };

export function OrderZoneEditor({ order }: Props) {
  const { t } = useTranslation('orders');
  const brandId = order.channel?.brand_id ?? null;

  const [open, setOpen]                   = useState(false);
  const [selectedGovId, setSelectedGovId] = useState<number | null>(null);
  const [selectedCityId, setSelectedCityId] = useState<number | null>(null);

  // Prevents auto city pre-select from firing after a user-triggered governorate change
  const didUserChangeGov = useRef(false);

  const patch      = usePatchOrder();
  const updateZone = useUpdateZone();

  // Brand shipping data — queries are disabled when brandId / govId are null
  const { data: govsData   } = useBrandShippingGovernorates(brandId);
  const { data: citiesData } = useBrandShippingCities(brandId, selectedGovId);

  // is_enabled === false means explicitly disabled; null inherits governorate default (= enabled)
  const enabledGovs   = (govsData   ?? []).filter(g => g.is_enabled);
  const enabledCities = (citiesData ?? []).filter(c => c.is_enabled !== false);

  // ── Auto-select city once cities load (initial open only, not after cascade) ─
  useEffect(() => {
    if (!open || !citiesData || didUserChangeGov.current) return;
    if (selectedCityId !== null) return;

    const target = (order.delivery_zone ?? order.area ?? order.city ?? '').toLowerCase().trim();
    if (!target) return;

    const match = citiesData.find(
      c =>
        (c.city?.name_en ?? '').toLowerCase() === target ||
        (c.city?.name_ar ?? '') === (order.delivery_zone ?? order.area ?? order.city ?? ''),
    );
    if (match) setSelectedCityId(match.city_id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [citiesData]);

  function handleOpenChange(isOpen: boolean) {
    if (isOpen) {
      didUserChangeGov.current = false;

      // Pre-select governorate from the order's current governorate string
      const govName = (order.governorate ?? '').toLowerCase();
      const matchedGov = govsData?.find(
        g =>
          (g.governorate?.name_en ?? '').toLowerCase() === govName ||
          (g.governorate?.name_ar ?? '') === order.governorate,
      );
      setSelectedGovId(matchedGov?.governorate_id ?? null);
      setSelectedCityId(null); // city pre-selected by effect once citiesData arrives
    } else {
      setSelectedGovId(null);
      setSelectedCityId(null);
    }
    setOpen(isOpen);
  }

  function handleGovChange(govIdStr: string) {
    didUserChangeGov.current = true;
    setSelectedGovId(Number(govIdStr));
    setSelectedCityId(null);
  }

  const selectedGov  = enabledGovs.find(g => g.governorate_id === selectedGovId);
  const selectedCity = enabledCities.find(c => c.city_id === selectedCityId);

  const isPending = patch.isPending || updateZone.isPending;

  function handleSave() {
    const govName  = selectedGov?.governorate?.name_en ?? '';
    const cityName = selectedCity?.city?.name_en ?? selectedCity?.city?.name_ar ?? '';

    patch.mutate(
      { id: order.id, data: { governorate: govName || null, area: cityName || null, city: cityName || null } },
      {
        onSuccess: () => {
          if (cityName) {
            updateZone.mutate(
              { id: order.id, zone: cityName },
              { onSettled: () => setOpen(false) },
            );
          } else {
            setOpen(false);
          }
        },
        onError: () => setOpen(false),
      },
    );
  }

  // ── Idle display ─────────────────────────────────────────────────────────────
  const displayZone = order.delivery_zone ?? order.area ?? order.city ?? null;
  const displayGov  = order.governorate ?? null;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="group flex flex-col rounded-sm px-1 py-0.5 text-start hover:bg-muted"
          title={t($ => $.columns.editZone)}
        >
          {displayZone ? (
            <span className="text-sm font-semibold text-primary leading-snug">
              {displayZone}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground group-hover:text-foreground">
              + {t($ => $.columns.addZone)}
            </span>
          )}
          {displayGov ? (
            <span className="text-xs text-muted-foreground leading-snug">
              {t($ => $.columns.governorateWithName, { name: displayGov })}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-60 p-3"
        align="start"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-3">

          {!brandId ? (
            <p className="text-[11px] text-amber-500">
              {t($ => $.zoneEditor.noBrandChannel)}
            </p>
          ) : null}

          {/* Governorate ── from brand shipping config */}
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t($ => $.workspace.fields.governorate)}
            </Label>
            <Select
              value={selectedGovId?.toString() ?? ''}
              onValueChange={handleGovChange}
              disabled={!brandId}
            >
              <SelectTrigger size="sm" className="h-7 text-xs">
                <SelectValue placeholder={t($ => $.workspace.selectGovernorate)} />
              </SelectTrigger>
              <SelectContent>
                {enabledGovs.map(g => (
                  <SelectItem
                    key={g.governorate_id}
                    value={g.governorate_id.toString()}
                    className="text-xs"
                  >
                    {g.governorate?.name_en ?? g.governorate?.name_ar ?? `Gov ${g.governorate_id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Zone / City ── filtered by selected governorate */}
          <div className="flex flex-col gap-1">
            <Label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {t($ => $.zoneEditor.zoneCity)}
            </Label>
            <Select
              value={selectedCityId?.toString() ?? ''}
              onValueChange={v => setSelectedCityId(Number(v))}
              disabled={!selectedGovId}
            >
              <SelectTrigger size="sm" className="h-7 text-xs">
                <SelectValue
                  placeholder={selectedGovId ? t($ => $.workspace.selectZone) : t($ => $.workspace.selectGovFirst)}
                />
              </SelectTrigger>
              <SelectContent>
                {enabledCities.length > 0 ? (
                  enabledCities.map(c => (
                    <SelectItem
                      key={c.city_id}
                      value={c.city_id.toString()}
                      className="text-xs"
                    >
                      {c.city?.name_en ?? c.city?.name_ar}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="__none" disabled className="text-xs text-muted-foreground">
                    {selectedGovId ? t($ => $.zoneEditor.noZonesFound) : t($ => $.workspace.selectGovFirst)}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleSave}
            disabled={isPending || !brandId}
          >
            {isPending ? t($ => $.zoneEditor.saving) : t($ => $.zoneEditor.save)}
          </Button>

        </div>
      </PopoverContent>
    </Popover>
  );
}
