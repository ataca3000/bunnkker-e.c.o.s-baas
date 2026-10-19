import { useState } from 'react';
import { useFormatter } from '@/hooks/use-formatter';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';

import { Badge }  from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Label }  from '@/components/ui/label';
import { PageDrawer } from '@/components/page/drawer/page-drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/components/ds/use-toast';
import type { City } from '@/features/logistics/geography/types/geography';
import {
  useCityAliases,
  useCreateAlias,
  useDeleteAlias,
  useUpdateCity,
} from '@/features/logistics/geography/hooks/use-geography';

const PROVIDERS = ['bosta', 'mylerz', 'smsa', 'aramex'];

type Props = {
  city: City | null;
  governorateId: number;
  defaultShippingPrice: number;
  onClose: () => void;
};

export function CityDrawer({ city, governorateId, defaultShippingPrice, onClose }: Props) {
  const { money } = useFormatter();
  const { t } = useTranslation('settings');
  const { toast } = useToast();

  const [nameEn,   setNameEn]   = useState(city?.name_en ?? '');
  const [nameAr,   setNameAr]   = useState(city?.name_ar ?? '');
  const [price,    setPrice]    = useState(city?.shipping_price != null ? String(city.shipping_price) : '');
  const [dirty,    setDirty]    = useState(false);

  // Reset state when city changes
  if (city && city.name_en !== nameEn && !dirty) {
    setNameEn(city.name_en);
    setNameAr(city.name_ar);
    setPrice(city.shipping_price != null ? String(city.shipping_price) : '');
  }

  const [newAlias,    setNewAlias]    = useState('');
  const [newProvider, setNewProvider] = useState('');
  const [newCode,     setNewCode]     = useState('');
  const [aliasError,  setAliasError]  = useState<string | null>(null);

  const update      = useUpdateCity();
  const { data: aliases = [], isFetching } = useCityAliases(city?.id ?? null);
  const createAlias = useCreateAlias();
  const deleteAlias = useDeleteAlias();

  const handleSave = async () => {
    if (!city) return;
    try {
      await update.mutateAsync({
        governorateId,
        cityId: city.id,
        payload: {
          name_en: nameEn.trim(),
          name_ar: nameAr.trim(),
          shipping_price: price !== '' ? parseFloat(price) : null,
        },
      });
      toast({ title: t($ => $.cityDrawer.toast.saved) });
      setDirty(false);
    } catch {
      toast({ title: t($ => $.cityDrawer.toast.saveFail), variant: 'destructive' });
    }
  };

  const handleAddAlias = async () => {
    if (!city || !newAlias.trim()) return;
    setAliasError(null);
    try {
      await createAlias.mutateAsync({
        cityId: city.id,
        payload: {
          alias:    newAlias.trim(),
          provider: newProvider || null,
          code:     newCode.trim() || null,
        },
      });
      toast({ title: t($ => $.cityDrawer.toast.aliasAdded) });
      setNewAlias('');
      setNewProvider('');
      setNewCode('');
    } catch (err: unknown) {
      type LaravelError = { response?: { data?: { errors?: Record<string, string[]>; message?: string } } };
      const apiErr = err as LaravelError;
      const firstField = apiErr?.response?.data?.errors;
      const msg = firstField?.alias?.[0]
        ?? apiErr?.response?.data?.message
        ?? 'Failed to add alias';
      setAliasError(msg);
    }
  };

  const handleDeleteAlias = async (aliasId: number) => {
    if (!city) return;
    try {
      await deleteAlias.mutateAsync({ cityId: city.id, aliasId });
      toast({ title: t($ => $.cityDrawer.toast.aliasRemoved) });
    } catch {
      toast({ title: t($ => $.cityDrawer.toast.aliasFail), variant: 'destructive' });
    }
  };

  const effectivePrice = price !== '' ? parseFloat(price) : defaultShippingPrice;

  return (
    <PageDrawer
      open={Boolean(city)}
      onOpenChange={(o) => !o && onClose()}
      title={city ? `${city.name_en} — ${city.name_ar}` : ''}
      description={t($ => $.cityDrawer.description)}
      size="lg"
    >
      {city && (
        <div className="space-y-6">
          {/* Status */}
          <div className="flex items-center gap-2">
            <Badge variant={city.is_active ? 'default' : 'secondary'}>
              {city.is_active ? t($ => $.cityDrawer.statusBadge.active) : t($ => $.cityDrawer.statusBadge.inactive)}
            </Badge>
            {city.is_system && (
              <Badge variant="outline" className="text-xs">{t($ => $.cityDrawer.statusBadge.system)}</Badge>
            )}
            {city.uses_governorate_price && (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {t($ => $.cityDrawer.statusBadge.govPrice)}
              </Badge>
            )}
          </div>

          {/* Core fields */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t($ => $.cityDrawer.form.nameEn)}</Label>
              <Input
                value={nameEn}
                onChange={(e) => { setNameEn(e.target.value); setDirty(true); }}
                disabled={city.is_system}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t($ => $.cityDrawer.form.nameAr)}</Label>
              <Input
                value={nameAr}
                onChange={(e) => { setNameAr(e.target.value); setDirty(true); }}
                dir="rtl"
                disabled={city.is_system}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t($ => $.cityDrawer.form.customShipping)}</Label>
              <Input
                type="number"
                min={0}
                step={0.5}
                placeholder={t($ => $.cityDrawer.form.hint, { price: money(defaultShippingPrice) })}
                value={price}
                onChange={(e) => { setPrice(e.target.value); setDirty(true); }}
              />
              <p className="text-xs text-muted-foreground">
                {t($ => $.cityDrawer.form.effectivePrice, { price: money(effectivePrice) })}
              </p>
            </div>

            {dirty && (
              <Button onClick={handleSave} disabled={update.isPending} className="w-full">
                {update.isPending ? t($ => $.cityDrawer.saving) : t($ => $.cityDrawer.save)}
              </Button>
            )}
          </div>

          {/* Aliases */}
          <div className="space-y-3">
            <p className="text-sm font-medium">{t($ => $.cityDrawer.aliases.title)}</p>
            <p className="text-xs text-muted-foreground">
              {t($ => $.cityDrawer.aliases.desc)}
            </p>

            {/* Add alias form */}
            <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
              <div className="flex gap-2">
                <Select
                  value={newProvider}
                  onValueChange={(v) => { setNewProvider(v); setAliasError(null); }}
                >
                  <SelectTrigger className="h-8 w-28 text-xs">
                    <SelectValue placeholder={t($ => $.cityDrawer.aliases.form.provider)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t($ => $.cityDrawer.aliases.form.anyProvider)}</SelectItem>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder={t($ => $.cityDrawer.aliases.form.alias)}
                  value={newAlias}
                  onChange={(e) => { setNewAlias(e.target.value); setAliasError(null); }}
                  className={`h-8 text-sm flex-1 ${aliasError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                />
                <Input
                  placeholder={t($ => $.cityDrawer.aliases.form.code)}
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  className="h-8 text-sm w-20"
                />
                <Button
                  size="sm"
                  onClick={handleAddAlias}
                  disabled={createAlias.isPending || !newAlias.trim()}
                >
                  <Plus className="h-4 w-4" />
                  {t($ => $.cityDrawer.aliases.add)}
                </Button>
              </div>
              {aliasError && (
                <p className="text-xs text-destructive">{aliasError}</p>
              )}
            </div>

            {/* Alias list */}
            {isFetching && aliases.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t($ => $.cityDrawer.aliases.loading)}</p>
            ) : aliases.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t($ => $.cityDrawer.aliases.empty)}</p>
            ) : (
              <div className="border rounded-lg divide-y">
                {aliases.map((alias) => (
                  <div key={alias.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {alias.provider && (
                          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded capitalize shrink-0">
                            {alias.provider}
                          </span>
                        )}
                        <span className="text-sm truncate">{alias.alias}</span>
                        {alias.code && (
                          <span className="text-xs font-mono text-muted-foreground shrink-0">
                            ({alias.code})
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-red-500 hover:text-red-600 shrink-0"
                      onClick={() => handleDeleteAlias(alias.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </PageDrawer>
  );
}
