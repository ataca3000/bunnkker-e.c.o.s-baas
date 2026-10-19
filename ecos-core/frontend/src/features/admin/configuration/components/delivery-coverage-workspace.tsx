import { useFormatter } from '@/hooks/use-formatter';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Loader2,
  MapPin,
  Pencil,
  Search,
  Truck,
  X,
  XCircle,
} from 'lucide-react';

import { Badge }  from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input }  from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ds/use-toast';

import {
  useBrandCoverage,
  useCoverageStats,
  useHealthScore,
  useCreateGeography,
  useUpdateGeography,
  useUpdateZoneDynamic,
} from '../hooks/use-configuration';
import type { CoverageGovernorate, CoverageZone } from '../types/configuration';

// ── Main Component ────────────────────────────────────────────────────────────

export function DeliveryCoverageWorkspace({ brandId }: { brandId: string }) {
  const { t } = useTranslation('settings');
  const { money } = useFormatter();
  const { toast } = useToast();
  const [search,    setSearch]    = useState('');
  const [bulkPrice, setBulkPrice] = useState('');
  const [allExpanded, setAllExpanded] = useState(false);
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());

  const { data: coverage = [], isLoading } = useBrandCoverage(brandId);
  const { data: stats, isLoading: statsLoading } = useCoverageStats(brandId);
  const { data: health } = useHealthScore(brandId);

  const createGeo  = useCreateGeography(brandId);
  const updateGeo  = useUpdateGeography(brandId);
  const updateZone = useUpdateZoneDynamic(brandId);

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return coverage;
    return coverage.filter(
      (gov) =>
        gov.name.toLowerCase().includes(q) ||
        (gov.name_ar ?? '').includes(q) ||
        gov.code.toLowerCase().includes(q) ||
        gov.zones.some((z) => z.name.toLowerCase().includes(q)),
    );
  }, [coverage, search]);

  // ── Governorate toggle ─────────────────────────────────────────────────────

  async function handleToggleGov(gov: CoverageGovernorate, enable: boolean) {
    try {
      if (gov.geo_id) {
        await updateGeo.mutateAsync({ id: gov.geo_id, payload: { is_active: enable } });
      } else if (enable) {
        // First enable → create the geography; server auto-creates all master zones
        await createGeo.mutateAsync({
          master_governorate_id: gov.id,
          name:       gov.name,
          name_ar:    gov.name_ar ?? null,
          code:       gov.code,
          sort_order: gov.sort_order,
          is_active:  true,
        });
        // Auto-expand on first enable so user can see zones immediately
        setExpanded((prev) => new Set([...prev, gov.id]));
      }
    } catch {
      toast({
        title: enable
          ? t($ => $.deliveryCoverage.toast.failEnable, { name: gov.name })
          : t($ => $.deliveryCoverage.toast.failDisable, { name: gov.name }),
        type: 'error',
      });
    }
  }

  // ── Governorate default cost ───────────────────────────────────────────────

  async function handleSaveDefaultCost(gov: CoverageGovernorate, costStr: string) {
    if (!gov.geo_id) return;
    const cost = parseFloat(costStr);
    if (isNaN(cost) || cost < 0) {
      toast({ title: t($ => $.deliveryCoverage.toast.invalidCost), type: 'error' });
      return;
    }
    try {
      await updateGeo.mutateAsync({ id: gov.geo_id, payload: { default_shipping_cost: cost } });
    } catch {
      toast({ title: t($ => $.deliveryCoverage.toast.failUpdateCost), type: 'error' });
    }
  }

  // ── Zone toggle ────────────────────────────────────────────────────────────

  async function handleToggleZone(gov: CoverageGovernorate, zone: CoverageZone, enable: boolean) {
    if (!gov.geo_id || !zone.zone_id) return;
    try {
      await updateZone.mutateAsync({
        geoId:   gov.geo_id,
        id:      zone.zone_id,
        payload: { is_active: enable },
      });
    } catch {
      toast({
        title: enable
          ? t($ => $.deliveryCoverage.toast.failEnable, { name: zone.name })
          : t($ => $.deliveryCoverage.toast.failDisable, { name: zone.name }),
        type: 'error',
      });
    }
  }

  // ── Zone custom cost ───────────────────────────────────────────────────────

  async function handleUpdateZoneCost(gov: CoverageGovernorate, zone: CoverageZone, costStr: string) {
    if (!gov.geo_id || !zone.zone_id) return;
    const trimmed = costStr.trim();
    const cost = trimmed === '' ? null : parseFloat(trimmed);
    if (cost !== null && (isNaN(cost) || cost < 0)) {
      toast({ title: t($ => $.deliveryCoverage.toast.invalidZoneCost), type: 'error' });
      return;
    }
    try {
      await updateZone.mutateAsync({
        geoId:   gov.geo_id,
        id:      zone.zone_id,
        payload: { custom_shipping_cost: cost },
      });
    } catch {
      toast({ title: t($ => $.deliveryCoverage.toast.failZoneCost), type: 'error' });
    }
  }

  // ── Expand / collapse ──────────────────────────────────────────────────────

  function toggleExpand(govId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(govId)) next.delete(govId);
      else next.add(govId);
      return next;
    });
  }

  function handleToggleAll() {
    if (allExpanded) {
      setExpanded(new Set());
    } else {
      setExpanded(new Set(coverage.map((g) => g.id)));
    }
    setAllExpanded(!allExpanded);
  }

  // ── Bulk operations ────────────────────────────────────────────────────────

  const isBulkPending = createGeo.isPending || updateGeo.isPending;

  async function handleEnableAll() {
    for (const gov of coverage) {
      if (gov.is_enabled) continue;
      try {
        if (gov.geo_id) {
          await updateGeo.mutateAsync({ id: gov.geo_id, payload: { is_active: true } });
        } else {
          await createGeo.mutateAsync({
            master_governorate_id: gov.id,
            name: gov.name, name_ar: gov.name_ar, code: gov.code,
            sort_order: gov.sort_order, is_active: true,
          });
        }
      } catch { /* skip individual failures */ }
    }
    toast({ title: t($ => $.deliveryCoverage.toast.allEnabled), type: 'success' });
  }

  async function handleDisableAll() {
    for (const gov of coverage.filter((g) => g.is_enabled && g.geo_id)) {
      try {
        await updateGeo.mutateAsync({ id: gov.geo_id!, payload: { is_active: false } });
      } catch { /* skip */ }
    }
    toast({ title: t($ => $.deliveryCoverage.toast.allDisabled), type: 'success' });
  }

  async function handleApplyCost() {
    const cost = parseFloat(bulkPrice);
    if (isNaN(cost) || cost < 0) {
      toast({ title: t($ => $.deliveryCoverage.toast.invalidCost), type: 'error' });
      return;
    }
    for (const gov of coverage.filter((g) => g.is_enabled && g.geo_id)) {
      try {
        await updateGeo.mutateAsync({ id: gov.geo_id!, payload: { default_shipping_cost: cost } });
      } catch { /* skip */ }
    }
    setBulkPrice('');
    toast({ title: t($ => $.deliveryCoverage.toast.costApplied, { cost: money(cost) }), type: 'success' });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5 max-w-5xl">

      {/* KPI Dashboard */}
      <CoverageDashboard stats={stats} loading={statsLoading} />

      {/* Health Bar */}
      {health && <ConfigHealthBar health={health} />}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={t($ => $.deliveryCoverage.search)}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder={t($ => $.deliveryCoverage.defaultCost)}
            value={bulkPrice}
            onChange={(e) => setBulkPrice(e.target.value)}
            className="h-8 w-28 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleApplyCost}
            disabled={isBulkPending}
            className="text-xs h-8"
          >
            {t($ => $.deliveryCoverage.applyToAll)}
          </Button>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={handleEnableAll}
          disabled={isBulkPending}
          className="text-xs gap-1.5 h-8"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          {t($ => $.deliveryCoverage.enableAll)}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleDisableAll}
          disabled={isBulkPending}
          className="text-xs gap-1.5 h-8"
        >
          <XCircle className="h-3.5 w-3.5" />
          {t($ => $.deliveryCoverage.disableAll)}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleToggleAll}
          className="text-xs gap-1.5 h-8"
        >
          {allExpanded
            ? <ChevronUp   className="h-3.5 w-3.5" />
            : <ChevronDown className="h-3.5 w-3.5" />
          }
          {allExpanded ? t($ => $.deliveryCoverage.collapseAll) : t($ => $.deliveryCoverage.expandAll)}
        </Button>
      </div>

      {/* Governorate list */}
      {isLoading ? (
        <LoadingBlock />
      ) : (
        <div className="space-y-2">
          {filtered.map((gov) => (
            <GovernorateRow
              key={gov.id}
              gov={gov}
              isExpanded={expanded.has(gov.id)}
              search={search}
              onToggleExpand={() => toggleExpand(gov.id)}
              onToggle={(enable) => handleToggleGov(gov, enable)}
              onSaveDefaultCost={(cost) => handleSaveDefaultCost(gov, cost)}
              onToggleZone={(zone, enable) => handleToggleZone(gov, zone, enable)}
              onUpdateZoneCost={(zone, cost) => handleUpdateZoneCost(gov, zone, cost)}
            />
          ))}
          {filtered.length === 0 && (
            <EmptyBlock message={t($ => $.deliveryCoverage.emptyGovs)} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Governorate Row ───────────────────────────────────────────────────────────

function GovernorateRow({
  gov,
  isExpanded,
  search,
  onToggleExpand,
  onToggle,
  onSaveDefaultCost,
  onToggleZone,
  onUpdateZoneCost,
}: {
  gov:              CoverageGovernorate;
  isExpanded:       boolean;
  search:           string;
  onToggleExpand:   () => void;
  onToggle:         (enable: boolean) => void;
  onSaveDefaultCost:(cost: string) => void;
  onToggleZone:     (zone: CoverageZone, enable: boolean) => void;
  onUpdateZoneCost: (zone: CoverageZone, cost: string) => void;
}) {
  const { t } = useTranslation('settings');
  const { money } = useFormatter();
  const [editCost,  setEditCost]  = useState(false);
  const [costInput, setCostInput] = useState('');
  const costRef = useRef<HTMLInputElement>(null);

  const isEnabled = gov.is_enabled;

  useEffect(() => {
    if (editCost && costRef.current) {
      costRef.current.focus();
      costRef.current.select();
    }
  }, [editCost]);

  const visibleZones = search.trim()
    ? gov.zones.filter((z) => z.name.toLowerCase().includes(search.trim().toLowerCase()))
    : gov.zones;

  const enabledZoneCount = gov.zones.filter((z) => z.is_enabled).length;

  return (
    <div className={`rounded-lg border overflow-hidden transition-all ${
      isEnabled
        ? 'border-border/60 bg-card'
        : 'border-border/40 bg-muted/10 opacity-70'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button
          onClick={() => isEnabled && onToggleExpand()}
          className={`shrink-0 transition-colors ${
            isEnabled
              ? 'text-muted-foreground hover:text-foreground'
              : 'text-muted-foreground/40 cursor-default'
          }`}
        >
          {isExpanded && isEnabled
            ? <ChevronDown  className="h-4 w-4" />
            : <ChevronRight className="h-4 w-4" />
          }
        </button>

        <div className="flex-1 flex flex-wrap items-center gap-1.5 min-w-0">
          <span className={`text-sm font-medium ${!isEnabled ? 'text-muted-foreground' : ''}`}>
            {gov.name}
          </span>
          {gov.name_ar && (
            <span className="text-xs text-muted-foreground">{gov.name_ar}</span>
          )}
          <Badge variant="outline" className="text-[10px] py-0 h-4">{gov.code}</Badge>
          {isEnabled && (
            <Badge className="text-[10px] py-0 h-4 bg-muted text-muted-foreground border-0">
              {t($ => $.deliveryCoverage.zonesCount, { enabled: enabledZoneCount, total: gov.total_zones })}
            </Badge>
          )}
        </div>

        {/* Default cost (inline edit) */}
        {isEnabled && (
          <div className="flex items-center gap-1 shrink-0">
            {editCost ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onSaveDefaultCost(costInput);
                  setEditCost(false);
                }}
                className="flex items-center gap-1"
              >
                <Input
                  ref={costRef}
                  type="number"
                  min="0"
                  step="0.01"
                  value={costInput}
                  onChange={(e) => setCostInput(e.target.value)}
                  className="h-7 w-24 text-xs"
                  placeholder="0.00"
                />
                <Button type="submit" size="sm" className="h-7 px-2 text-xs">{t($ => $.deliveryCoverage.save)}</Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-1"
                  onClick={() => setEditCost(false)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </form>
            ) : (
              <button
                onClick={() => {
                  setCostInput(String(gov.default_shipping_cost ?? ''));
                  setEditCost(true);
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground rounded px-2 py-0.5 hover:bg-muted/50 transition-colors"
              >
                {gov.default_shipping_cost != null ? (
                  <span className="font-mono font-medium">{money(Number(gov.default_shipping_cost) || 0)}</span>
                ) : (
                  <span className="italic">{t($ => $.deliveryCoverage.setDefaultCost)}</span>
                )}
                <Pencil className="h-2.5 w-2.5 ml-0.5" />
              </button>
            )}
          </div>
        )}

        {/* Enable / disable toggle */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-muted-foreground">
            {isEnabled ? t($ => $.deliveryCoverage.enabled) : t($ => $.deliveryCoverage.disabled)}
          </span>
          <Switch
            checked={isEnabled}
            onCheckedChange={onToggle}
            className="scale-75"
          />
        </div>
      </div>

      {/* Zone list */}
      {isEnabled && isExpanded && (
        <div className="border-t border-border/40 bg-muted/10">
          {gov.total_zones > 0 && (
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-4 px-6 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/30">
              <span className="w-8" />
              <span>{t($ => $.deliveryCoverage.zone)}</span>
              <span className="text-end w-32">{t($ => $.deliveryCoverage.shippingCost)}</span>
              <span className="w-8" />
            </div>
          )}

          <div className="divide-y divide-border/30">
            {visibleZones.map((zone) => (
              <ZoneRow
                key={zone.id}
                zone={zone}
                govDefaultCost={gov.default_shipping_cost}
                onToggle={(enable) => onToggleZone(zone, enable)}
                onUpdateCost={(cost) => onUpdateZoneCost(zone, cost)}
              />
            ))}
            {visibleZones.length === 0 && (
              <p className="px-6 py-3 text-xs text-muted-foreground">
                {t($ => $.deliveryCoverage.emptyZones)}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Zone Row ──────────────────────────────────────────────────────────────────

function ZoneRow({
  zone,
  govDefaultCost,
  onToggle,
  onUpdateCost,
}: {
  zone:           CoverageZone;
  govDefaultCost: number | null;
  onToggle:       (enable: boolean) => void;
  onUpdateCost:   (cost: string) => void;
}) {
  const { t } = useTranslation('settings');
  const { money } = useFormatter();
  const [editCost,  setEditCost]  = useState(false);
  const [costInput, setCostInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editCost && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editCost]);

  const hasCustomCost  = zone.custom_shipping_cost != null;
  const effectiveCost  = zone.custom_shipping_cost ?? govDefaultCost;
  const canInteract    = !!zone.zone_id;

  return (
    <div className={`grid grid-cols-[auto_1fr_auto_auto] gap-x-4 items-center px-6 py-2 hover:bg-muted/20 transition-colors ${!zone.is_enabled ? 'opacity-60' : ''}`}>
      {/* Zone toggle */}
      <div className="w-8 flex items-center">
        <Switch
          checked={zone.is_enabled}
          onCheckedChange={onToggle}
          disabled={!canInteract}
          className="scale-75"
        />
      </div>

      {/* Zone name */}
      <span className="text-sm truncate">{zone.name}</span>

      {/* Cost badge / inline editor */}
      <div className="w-32 flex items-center justify-end">
        {editCost ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onUpdateCost(costInput);
              setEditCost(false);
            }}
            className="flex items-center gap-1"
          >
            <Input
              ref={inputRef}
              type="number"
              min="0"
              step="0.01"
              value={costInput}
              onChange={(e) => setCostInput(e.target.value)}
              className="h-6 w-20 text-xs"
              placeholder={t($ => $.deliveryCoverage.emptyInherit)}
            />
            <Button type="submit" size="sm" className="h-6 px-1.5 text-[10px]">✓</Button>
            <button
              type="button"
              onClick={() => setEditCost(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </form>
        ) : (
          <button
            onClick={() => {
              if (!canInteract) return;
              setCostInput(hasCustomCost ? String(zone.custom_shipping_cost) : '');
              setEditCost(true);
            }}
            disabled={!canInteract}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-muted/50 transition-colors disabled:pointer-events-none"
          >
            {hasCustomCost ? (
              <Badge className="text-[10px] py-0 h-4 bg-blue-50 text-blue-700 border-blue-200 font-mono gap-0.5 cursor-pointer">
                {money(Number(zone.custom_shipping_cost) || 0)}
                <Pencil className="h-2 w-2" />
              </Badge>
            ) : (
              <Badge className="text-[10px] py-0 h-4 bg-muted text-muted-foreground border-0 gap-0.5 cursor-pointer">
                {effectiveCost != null ? money(Number(effectiveCost)) : t($ => $.deliveryCoverage.inherited)}
                {canInteract && <Pencil className="h-2 w-2" />}
              </Badge>
            )}
          </button>
        )}
      </div>

      {/* Inactive indicator */}
      <div className="w-8 flex items-center justify-end">
        {!zone.is_enabled && (
          <Badge className="text-[10px] py-0 h-4 bg-amber-50 text-amber-700 border-0 shrink-0">
            {t($ => $.deliveryCoverage.off)}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ── Coverage Dashboard ────────────────────────────────────────────────────────

function CoverageDashboard({
  stats,
  loading,
}: {
  stats:   ReturnType<typeof useCoverageStats>['data'];
  loading: boolean;
}) {
  const { t } = useTranslation('settings');
  const { money, currency } = useFormatter();

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border border-border/60 bg-card p-3 h-16 animate-pulse bg-muted/20" />
        ))}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={<MapPin className="h-4 w-4" />}  label={t($ => $.deliveryCoverage.kpi.coveredGovs)} value="—" />
        <KpiCard icon={<Truck  className="h-4 w-4" />}  label={t($ => $.deliveryCoverage.kpi.activeZones)} value="—" />
        <KpiCard icon={<span className="text-xs font-bold">%</span>}   label={t($ => $.deliveryCoverage.kpi.coverage)}     value="—" />
        <KpiCard icon={<span className="text-xs font-bold">{currency}</span>} label={t($ => $.deliveryCoverage.kpi.avgShipping)} value="—" />
      </div>
    );
  }

  const pct = stats.coverage_percentage;
  const pctColor = pct >= 75
    ? 'text-emerald-700 dark:text-emerald-400'
    : pct >= 40 ? 'text-amber-700 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
  const barColor = pct >= 75 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          icon={<MapPin className="h-4 w-4" />}
          label={t($ => $.deliveryCoverage.kpi.coveredGovs)}
          value={`${stats.enabled_governorates} / ${stats.total_governorates}`}
        />
        <KpiCard
          icon={<Truck className="h-4 w-4" />}
          label={t($ => $.deliveryCoverage.kpi.activeZones)}
          value={stats.total_zones > 0
            ? `${stats.active_zones} / ${stats.total_zones}`
            : String(stats.active_zones)
          }
        />
        <KpiCard
          icon={<span className={`text-sm font-bold ${pctColor}`}>%</span>}
          label={t($ => $.deliveryCoverage.kpi.coverage)}
          value={`${pct}%`}
        />
        <KpiCard
          icon={<span className="text-xs font-bold">{currency}</span>}
          label={t($ => $.deliveryCoverage.kpi.avgShipping)}
          value={stats.avg_effective_shipping != null ? money(Number(stats.avg_effective_shipping)) : '—'}
        />
      </div>

      <div className="rounded-lg border border-border/60 bg-card px-4 py-3 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">{t($ => $.deliveryCoverage.coverageProgress)}</span>
          <span className={`font-semibold ${pctColor}`}>{pct}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Configuration Health Bar ──────────────────────────────────────────────────

function ConfigHealthBar({
  health,
}: {
  health: NonNullable<ReturnType<typeof useHealthScore>['data']>;
}) {
  const { t } = useTranslation('settings');
  const color = health.score >= 80 ? 'bg-emerald-500' : health.score >= 50 ? 'bg-amber-500' : 'bg-red-500';
  const textColor = health.score >= 80
    ? 'text-emerald-700 dark:text-emerald-400'
    : health.score >= 50 ? 'text-amber-700 dark:text-amber-400' : 'text-red-600 dark:text-red-400';

  const checkLabels: Record<string, string> = {
    channels:          t($ => $.deliveryCoverage.healthBar.channels),
    delivery_coverage: t($ => $.deliveryCoverage.healthBar.deliveryCoverage),
    delivery_zones:    t($ => $.deliveryCoverage.healthBar.deliveryZones),
    delivery_windows:  t($ => $.deliveryCoverage.healthBar.deliveryWindows),
    shipping_prices:   t($ => $.deliveryCoverage.healthBar.shippingPrices),
  };

  return (
    <div className="rounded-lg border border-border/60 bg-card px-4 py-3">
      <div className="flex items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {t($ => $.deliveryCoverage.healthBar.title)}
          </span>
          <span className={`text-base font-bold ${textColor}`}>{health.score}%</span>
        </div>
        <div className="flex-1 max-w-40">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${health.score}%` }} />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {Object.entries(health.checks).map(([key, ok]) => (
          <span key={key} className={`flex items-center gap-1 text-[11px] ${ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {ok
              ? <CheckCircle2 className="h-3 w-3 shrink-0" />
              : <XCircle      className="h-3 w-3 shrink-0" />
            }
            {checkLabels[key] ?? key}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Shared Primitives ─────────────────────────────────────────────────────────

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3 flex items-center gap-2.5">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <div className="min-w-0">
        <div className="text-base font-bold leading-none">{value}</div>
        <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{label}</div>
      </div>
    </div>
  );
}

function LoadingBlock() {
  const { t } = useTranslation('settings');
  return (
    <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm">{t($ => $.deliveryCoverage.loading)}</span>
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 rounded-lg border border-dashed border-border/60 gap-2">
      <MapPin className="h-8 w-8 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground text-center max-w-xs">{message}</p>
    </div>
  );
}
