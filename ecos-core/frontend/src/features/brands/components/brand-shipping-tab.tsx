import { useFormatter } from '@/hooks/use-formatter';
import { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Globe,
  MapPin,
  Truck,
} from 'lucide-react';

import { Badge }   from '@/components/ui/badge';
import { Button }  from '@/components/ui/button';
import { Input }   from '@/components/ui/input';
import { Label }   from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ds/use-toast';
import type {
  BrandGovernorateSettings,
  BrandShippingSettingsPayload,
  UnsupportedAreaAction,
} from '@/features/brands/types/brand';
import {
  useBrandShippingCities,
  useBrandShippingGovernorates,
  useBrandShippingSettings,
  useUpdateBrandCitySetting,
  useUpdateBrandGovernorateSettings,
  useUpdateBrandShippingSettings,
} from '@/features/brands/hooks/use-brand-shipping';

// ── Action selector ───────────────────────────────────────────────────────────

const ACTION_OPTIONS: { value: UnsupportedAreaAction; label: string; description: string }[] = [
  { value: 'allow',          label: 'Allow',          description: 'Continue — create the order normally.' },
  { value: 'pending_review', label: 'Pending Review',  description: 'Order enters Pending status for manual review.' },
  { value: 'reject',         label: 'Reject',          description: 'Block the order and log the reason.' },
];

function ActionBadge({ action }: { action: UnsupportedAreaAction }) {
  const map: Record<UnsupportedAreaAction, { variant: 'default' | 'secondary' | 'destructive'; label: string }> = {
    allow:          { variant: 'default',     label: 'Allow' },
    pending_review: { variant: 'secondary',   label: 'Pending Review' },
    reject:         { variant: 'destructive', label: 'Reject' },
  };
  const cfg = map[action];
  return <Badge variant={cfg.variant} className="text-xs">{cfg.label}</Badge>;
}

// ── General Settings section ──────────────────────────────────────────────────

function GeneralSettings({ brandId }: { brandId: string }) {
  const { toast } = useToast();
  const { currency } = useFormatter();
  const { data: settings, isLoading } = useBrandShippingSettings(brandId);
  const update = useUpdateBrandShippingSettings(brandId);

  const [dirty, setDirty] = useState(false);
  const [form, setForm] = useState<BrandShippingSettingsPayload>({});

  const effective = { ...settings, ...form };

  const patch = (key: keyof BrandShippingSettingsPayload, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    try {
      await update.mutateAsync(form);
      toast({ title: 'Shipping settings saved' });
      setForm({});
      setDirty(false);
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Unsupported Governorate Action */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Unsupported Governorate Action</Label>
        <Select
          value={(effective?.unsupported_governorate_action as string | undefined) ?? 'allow'}
          onValueChange={(v) => patch('unsupported_governorate_action', v as UnsupportedAreaAction)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                <span className="font-medium">{o.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{o.description}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Unsupported City Action */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Unsupported City Action</Label>
        <Select
          value={(effective?.unsupported_city_action as string | undefined) ?? 'allow'}
          onValueChange={(v) => patch('unsupported_city_action', v as UnsupportedAreaAction)}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTION_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                <span className="font-medium">{o.label}</span>
                <span className="ml-2 text-xs text-muted-foreground">{o.description}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Default COD */}
      <div className="flex items-center justify-between rounded-md border px-3 py-2">
        <div>
          <p className="text-sm font-medium">Cash on Delivery (COD)</p>
          <p className="text-xs text-muted-foreground">Default COD availability for all cities</p>
        </div>
        <Switch
          checked={effective?.default_cod_enabled ?? true}
          onCheckedChange={(v) => patch('default_cod_enabled', v)}
        />
      </div>

      {/* Free Shipping Threshold */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium">Free Shipping Threshold ({currency})</Label>
        <Input
          type="number"
          min={0}
          step={1}
          placeholder="Leave blank — no free shipping"
          className="h-8 text-sm"
          value={effective?.default_free_shipping_threshold ?? ''}
          onChange={(e) =>
            patch('default_free_shipping_threshold', e.target.value === '' ? null : parseFloat(e.target.value))
          }
        />
      </div>

      {dirty && (
        <Button size="sm" onClick={handleSave} disabled={update.isPending} className="w-full">
          {update.isPending ? 'Saving…' : 'Save Settings'}
        </Button>
      )}
    </div>
  );
}

// ── City overrides panel ──────────────────────────────────────────────────────

function CitiesPanel({
  brandId,
  gov,
  onClose,
}: {
  brandId: string;
  gov: BrandGovernorateSettings;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { money } = useFormatter();
  const govId = gov.governorate_id;
  const { data: cities = [], isLoading } = useBrandShippingCities(brandId, govId);
  const updateCity = useUpdateBrandCitySetting(brandId);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <ChevronRight className="h-4 w-4 rotate-180" />
        </button>
        <span className="text-sm font-medium">
          {gov.governorate?.name_en} — City Overrides
        </span>
        <span className="text-xs text-muted-foreground">({cities.length} cities)</span>
      </div>

      {isLoading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : cities.length === 0 ? (
        <div className="py-8 text-center">
          <MapPin className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No cities in this governorate.</p>
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {cities.map((citySetting) => {
            const city = citySetting.city;
            if (!city) return null;

            const effectiveEnabled = citySetting.is_enabled ?? true;
            const govShippingPrice = gov.shipping_price ?? gov.governorate?.default_shipping_price ?? 0;
            const effectivePrice   = citySetting.shipping_price ?? govShippingPrice;

            return (
              <div key={city.id} className="px-3 py-2.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{city.name_en}</span>
                    <span className="text-xs text-muted-foreground" dir="rtl">{city.name_ar}</span>
                    {city.is_remote_area && (
                      <Badge variant="outline" className="text-xs">Remote</Badge>
                    )}
                    {!city.is_active && (
                      <Badge variant="secondary" className="text-xs">Sys Inactive</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span className="tabular-nums">{money(effectivePrice)}</span>
                    {citySetting.shipping_price !== null && (
                      <span className="text-blue-600">custom</span>
                    )}
                    {citySetting.supports_cod === false && (
                      <span className="text-amber-600">No COD</span>
                    )}
                  </div>
                </div>

                {/* Enabled toggle */}
                <Switch
                  checked={effectiveEnabled}
                  onCheckedChange={async (v) => {
                    try {
                      await updateCity.mutateAsync({ cityId: city.id, payload: { is_enabled: v } });
                    } catch {
                      toast({ title: 'Failed', variant: 'destructive' });
                    }
                  }}
                  className="shrink-0"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Governorates grid ─────────────────────────────────────────────────────────

function GovernoratesGrid({ brandId }: { brandId: string }) {
  const { toast }    = useToast();
  const { money }    = useFormatter();
  const { data: govSettings = [], isLoading } = useBrandShippingGovernorates(brandId);
  const updateGov    = useUpdateBrandGovernorateSettings(brandId);
  const { data: settings } = useBrandShippingSettings(brandId);

  const [selectedGov, setSelectedGov] = useState<BrandGovernorateSettings | null>(null);
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [priceInput, setPriceInput] = useState('');

  if (selectedGov !== null) {
    // Refresh from latest data when re-entering
    const latest = govSettings.find((g) => g.governorate_id === selectedGov.governorate_id) ?? selectedGov;
    return (
      <CitiesPanel
        brandId={brandId}
        gov={latest}
        onClose={() => setSelectedGov(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-1.5">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
      </div>
    );
  }

  const enabledCount  = govSettings.filter((g) => g.is_enabled).length;
  const disabledCount = govSettings.length - enabledCount;

  return (
    <div className="space-y-3">
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-md border bg-muted/30 p-2.5 text-center">
          <p className="text-lg font-bold tabular-nums">{govSettings.length}</p>
          <p className="text-[10px] text-muted-foreground">Total</p>
        </div>
        <div className="rounded-md border bg-emerald-50 dark:bg-emerald-950/30 p-2.5 text-center">
          <p className="text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{enabledCount}</p>
          <p className="text-[10px] text-muted-foreground">Enabled</p>
        </div>
        <div className="rounded-md border bg-red-50 dark:bg-red-950/30 p-2.5 text-center">
          <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">{disabledCount}</p>
          <p className="text-[10px] text-muted-foreground">Disabled</p>
        </div>
      </div>

      {/* Policy reminder */}
      {settings && (
        <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <span>Unsupported gov →</span>
          <ActionBadge action={settings.unsupported_governorate_action} />
          <span className="ml-2">City →</span>
          <ActionBadge action={settings.unsupported_city_action} />
        </div>
      )}

      {/* Governorate rows */}
      <div className="border rounded-lg divide-y">
        {govSettings.map((govSetting) => {
          const gov = govSetting.governorate;
          if (!gov) return null;

          const isEditingPrice = editingPriceId === gov.id;
          const effectivePrice = govSetting.shipping_price ?? gov.default_shipping_price;

          return (
            <div
              key={gov.id}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors group"
            >
              {/* Enabled switch */}
              <Switch
                checked={govSetting.is_enabled}
                onCheckedChange={async (v) => {
                  try {
                    await updateGov.mutateAsync({
                      governorateId: gov.id,
                      payload: { is_enabled: v },
                    });
                    toast({
                      title: v ? `${gov.name_en} enabled` : `${gov.name_en} disabled`,
                    });
                  } catch {
                    toast({ title: 'Failed', variant: 'destructive' });
                  }
                }}
                className="shrink-0"
              />

              {/* Name */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${!govSetting.is_enabled ? 'text-muted-foreground line-through' : ''}`}>
                    {gov.name_en}
                  </span>
                  <span className="text-xs text-muted-foreground" dir="rtl">{gov.name_ar}</span>
                  {govSetting.same_day_supported && (
                    <Badge variant="secondary" className="text-[10px]">Same Day</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  <span className="tabular-nums">{gov.cities_count} cities</span>
                  {govSetting.estimated_delivery_days && (
                    <span>{govSetting.estimated_delivery_days}d delivery</span>
                  )}
                </div>
              </div>

              {/* Shipping price inline edit */}
              <div className="shrink-0">
                {isEditingPrice ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      value={priceInput}
                      onChange={(e) => setPriceInput(e.target.value)}
                      className="h-7 w-20 text-xs"
                      autoFocus
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                          try {
                            await updateGov.mutateAsync({
                              governorateId: gov.id,
                              payload: { shipping_price: priceInput === '' ? null : parseFloat(priceInput) },
                            });
                            toast({ title: 'Price updated' });
                          } catch {
                            toast({ title: 'Failed', variant: 'destructive' });
                          }
                          setEditingPriceId(null);
                        }
                        if (e.key === 'Escape') setEditingPriceId(null);
                      }}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      onClick={() => setEditingPriceId(null)}
                    >
                      ✕
                    </Button>
                  </div>
                ) : (
                  <button
                    className="text-xs tabular-nums text-end hover:text-primary transition-colors"
                    onClick={() => {
                      setEditingPriceId(gov.id);
                      setPriceInput(govSetting.shipping_price !== null ? String(govSetting.shipping_price) : '');
                    }}
                  >
                    <span className={govSetting.shipping_price !== null ? 'text-blue-600 font-medium' : 'text-muted-foreground'}>
                      {money(effectivePrice)}
                    </span>
                    {govSetting.shipping_price === null && (
                      <span className="ml-1 text-muted-foreground/60">(default)</span>
                    )}
                  </button>
                )}
              </div>

              {/* Open cities panel */}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                onClick={() => setSelectedGov(govSetting)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Click a price to edit inline. Click <ChevronDown className="inline h-3 w-3" /> to manage city overrides.
      </p>
    </div>
  );
}

// ── Main Shipping Tab ─────────────────────────────────────────────────────────

type Props = { brandId: string };

type Section = 'settings' | 'governorates';

export function BrandShippingTab({ brandId }: Props) {
  const [section, setSection] = useState<Section>('governorates');

  return (
    <div className="space-y-4">
      {/* Section switcher */}
      <div className="flex gap-1 rounded-md border p-0.5 bg-muted/30">
        <button
          onClick={() => setSection('governorates')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded text-xs py-1.5 font-medium transition-colors ${
            section === 'governorates'
              ? 'bg-background shadow text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Globe className="h-3.5 w-3.5" />
          Governorates
        </button>
        <button
          onClick={() => setSection('settings')}
          className={`flex-1 flex items-center justify-center gap-1.5 rounded text-xs py-1.5 font-medium transition-colors ${
            section === 'settings'
              ? 'bg-background shadow text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Truck className="h-3.5 w-3.5" />
          Policy
        </button>
      </div>

      {section === 'governorates' ? (
        <GovernoratesGrid brandId={brandId} />
      ) : (
        <GeneralSettings brandId={brandId} />
      )}
    </div>
  );
}
