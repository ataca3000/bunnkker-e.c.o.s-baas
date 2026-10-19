import { useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, MapPin, Search, X } from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge }    from '@/components/ui/badge';
import { Button }   from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input }    from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn }       from '@/lib/utils';
import type { CityArea, GovernorateGroup } from '../types/distribution-zone';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AreaSelectorProps = {
  groups:              GovernorateGroup[];
  assignedIds:         number[];
  onChange:            (ids: number[], forceMoved?: boolean) => void;
  currentZoneId?:      number | null;
  currentZoneName?:    string;
  isLoading?:          boolean;
  disabled?:           boolean;
  totalAreasCount?:    number;
  assignedAreasCount?: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function matchesSearch(city: CityArea, group: GovernorateGroup, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  return (
    city.name_ar.toLowerCase().includes(lower) ||
    (city.name_en ?? '').toLowerCase().includes(lower) ||
    (group.governorate_name_ar ?? '').toLowerCase().includes(lower) ||
    (group.governorate_name_en ?? '').toLowerCase().includes(lower)
  );
}

// ── Smart Move Dialog ─────────────────────────────────────────────────────────

type SmartMoveDialogProps = {
  city:            CityArea | null;
  targetZoneName:  string;
  onConfirm:       () => void;
  onCancel:        () => void;
};

function SmartMoveDialog({ city, targetZoneName, onConfirm, onCancel }: SmartMoveDialogProps) {
  return (
    <AlertDialog open={city !== null} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Move Area</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p>
                <span className="font-semibold text-foreground">{city?.name_ar}</span>
                {' '}is currently assigned to{' '}
                <span className="font-semibold text-foreground">
                  {city?.distribution_zone_name ?? 'another zone'}
                </span>.
              </p>
              <p>
                Do you want to move it to{' '}
                <span className="font-semibold text-foreground">
                  {targetZoneName || 'this zone'}
                </span>?
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Move Area</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ── Assign by Governorate Popover ─────────────────────────────────────────────

type AssignByGovPopoverProps = {
  groups:      GovernorateGroup[];
  assignedIds: number[];
  onAssign:    (ids: number[]) => void;
  disabled?:   boolean;
};

function AssignByGovPopover({ groups, assignedIds, onAssign, disabled }: AssignByGovPopoverProps) {
  const [open, setOpen]         = useState(false);
  const [govSearch, setGovSearch] = useState('');
  const assignedSet = useMemo(() => new Set(assignedIds), [assignedIds]);

  const filtered = useMemo(() => {
    const q = govSearch.toLowerCase();
    return groups
      .map((g) => {
        const freeCount = g.cities.filter(
          (c) => c.distribution_zone_id === null && !assignedSet.has(c.id),
        ).length;
        return { ...g, freeCount };
      })
      .filter((g) => {
        if (!q) return true;
        return (
          (g.governorate_name_ar ?? '').toLowerCase().includes(q) ||
          (g.governorate_name_en ?? '').toLowerCase().includes(q)
        );
      });
  }, [groups, govSearch, assignedSet]);

  function assignGovernorate(group: GovernorateGroup) {
    const freeIds = group.cities
      .filter((c) => c.distribution_zone_id === null && !assignedSet.has(c.id))
      .map((c) => c.id);
    if (freeIds.length === 0) return;
    onAssign([...assignedIds, ...freeIds]);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs" disabled={disabled}>
          <MapPin className="size-3" />
          Assign by Governorate
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search governorates…"
              value={govSearch}
              onChange={(e) => setGovSearch(e.target.value)}
              className="h-7 pl-7 text-xs"
            />
          </div>
        </div>
        <div className="max-h-56 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">No governorates found.</p>
          ) : (
            filtered.map((g) => (
              <button
                key={g.governorate_id}
                type="button"
                onClick={() => assignGovernorate(g)}
                disabled={g.freeCount === 0}
                className="flex w-full items-center justify-between px-3 py-2 text-start text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="font-medium">{g.governorate_name_ar}</span>
                <Badge variant="secondary" className="text-[10px]">{g.freeCount} free</Badge>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Governorate Row ───────────────────────────────────────────────────────────

type GovRowProps = {
  group:          GovernorateGroup;
  assignedSet:    Set<number>;
  currentZoneId?: number | null;
  searchQuery:    string;
  expanded:       boolean;
  onToggleExpand: () => void;
  onToggleCity:   (city: CityArea) => void;
  onToggleAll:    (group: GovernorateGroup, checked: boolean) => void;
  disabled?:      boolean;
};

function GovRow({
  group,
  assignedSet,
  currentZoneId,
  searchQuery,
  expanded,
  onToggleExpand,
  onToggleCity,
  onToggleAll,
  disabled,
}: GovRowProps) {
  const visibleCities = useMemo(
    () => group.cities.filter((c) => matchesSearch(c, group, searchQuery)),
    [group, searchQuery],
  );

  if (visibleCities.length === 0) return null;

  const assignedInGroup = visibleCities.filter((c) => assignedSet.has(c.id)).length;
  const allChecked      = assignedInGroup === visibleCities.length;
  const someChecked     = assignedInGroup > 0 && !allChecked;

  return (
    <div>
      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-1.5">
        <Checkbox
          checked={allChecked}
          data-indeterminate={someChecked}
          onCheckedChange={(checked) => onToggleAll(group, !!checked)}
          disabled={disabled}
          className="size-3.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          type="button"
          className="flex flex-1 items-center gap-1.5 text-start"
          onClick={onToggleExpand}
        >
          {expanded ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="text-xs font-semibold tracking-wide">
            {group.governorate_name_ar ?? group.governorate_name_en ?? '—'}
          </span>
          <span className="ms-auto text-[10px] text-muted-foreground tabular-nums">
            {assignedInGroup}/{visibleCities.length}
          </span>
        </button>
      </div>

      {expanded && (
        <div>
          <div className="flex items-center gap-2 bg-muted/20 px-4 py-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              Cities
            </span>
            <div className="h-px flex-1 bg-border/40" />
          </div>
          <div className="divide-y">
          {visibleCities.map((city) => {
            const isAssigned    = assignedSet.has(city.id);
            const isOtherZone   = city.distribution_zone_id !== null &&
                                  city.distribution_zone_id !== currentZoneId;
            const isCurrentZone = city.distribution_zone_id === currentZoneId && currentZoneId != null;

            return (
              <label
                key={city.id}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 px-4 py-1.5 text-sm transition-colors',
                  'hover:bg-accent/60',
                  isAssigned && 'bg-accent/30',
                  disabled && 'pointer-events-none opacity-60',
                )}
              >
                <Checkbox
                  checked={isAssigned}
                  onCheckedChange={() => onToggleCity(city)}
                  disabled={disabled}
                  className="size-3.5 shrink-0"
                />
                <span className="flex-1 truncate">{city.name_ar}</span>
                {city.name_en && (
                  <span className="shrink-0 text-xs text-muted-foreground">{city.name_en}</span>
                )}
                {isOtherZone && !isAssigned && (
                  <Badge variant="outline" className="shrink-0 text-[10px] text-amber-600 border-amber-300">
                    {city.distribution_zone_name ?? 'Another Zone'}
                  </Badge>
                )}
                {isCurrentZone && isAssigned && (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">Current</Badge>
                )}
              </label>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function AreaSelector({
  groups,
  assignedIds,
  onChange,
  currentZoneId,
  currentZoneName = 'this zone',
  isLoading,
  disabled,
  totalAreasCount,
  assignedAreasCount,
}: AreaSelectorProps) {
  const [search,        setSearch]        = useState('');
  const [expandedGovs,  setExpandedGovs]  = useState<Set<number>>(() =>
    new Set(groups.map((g) => g.governorate_id)),
  );
  const [pendingMove,   setPendingMove]   = useState<CityArea | null>(null);
  const [hasForceMoved, setHasForceMoved] = useState(false);

  const assignedSet = useMemo(() => new Set(assignedIds), [assignedIds]);

  const prevGroupCount = useRef(0);
  if (groups.length > 0 && prevGroupCount.current === 0) {
    prevGroupCount.current = groups.length;
    setExpandedGovs(new Set(groups.map((g) => g.governorate_id)));
  }

  const allCities        = useMemo(() => groups.flatMap((g) => g.cities), [groups]);
  const totalCount       = allCities.length;
  const selectedCount    = assignedIds.length;
  const selectedGovCount = useMemo(
    () => groups.filter((g) => g.cities.some((c) => assignedSet.has(c.id))).length,
    [groups, assignedSet],
  );

  const visibleGroups = useMemo(() => {
    if (!search) return groups;
    return groups
      .map((g) => ({
        ...g,
        cities: g.cities.filter((c) => matchesSearch(c, g, search)),
      }))
      .filter((g) => g.cities.length > 0);
  }, [groups, search]);

  function toggleExpand(govId: number) {
    setExpandedGovs((prev) => {
      const next = new Set(prev);
      next.has(govId) ? next.delete(govId) : next.add(govId);
      return next;
    });
  }

  function handleToggleCity(city: CityArea) {
    if (assignedSet.has(city.id)) {
      onChange(assignedIds.filter((id) => id !== city.id));
      return;
    }
    const isOtherZone = city.distribution_zone_id !== null &&
                        city.distribution_zone_id !== currentZoneId;
    if (isOtherZone) {
      setPendingMove(city);
      return;
    }
    onChange([...assignedIds, city.id]);
  }

  function handleSmartMoveConfirm() {
    if (!pendingMove) return;
    setHasForceMoved(true);
    onChange([...assignedIds, pendingMove.id], true);
    setPendingMove(null);
  }

  function handleToggleAll(group: GovernorateGroup, checked: boolean) {
    const visibleInGroup = group.cities.filter((c) => matchesSearch(c, group, search));
    if (!checked) {
      const idsToRemove = new Set(visibleInGroup.map((c) => c.id));
      onChange(assignedIds.filter((id) => !idsToRemove.has(id)));
      return;
    }
    const idsToAdd = visibleInGroup
      .filter((c) => {
        if (assignedSet.has(c.id)) return false;
        return !(c.distribution_zone_id !== null && c.distribution_zone_id !== currentZoneId);
      })
      .map((c) => c.id);
    onChange([...new Set([...assignedIds, ...idsToAdd])]);
  }

  function deselectAll() {
    onChange([]);
    setHasForceMoved(false);
  }

  if (isLoading) {
    return (
      <div className="rounded-lg border">
        <div className="border-b p-3">
          <Skeleton className="h-7 w-full" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border-b px-3 py-2">
            <Skeleton className="h-4 w-32" />
            <div className="mt-1.5 space-y-1.5 pl-6">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3.5 w-44" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    const total     = totalAreasCount ?? 0;
    const assigned  = assignedAreasCount ?? 0;
    const available = Math.max(0, total - assigned);

    return (
      <div className="flex flex-col items-center justify-center rounded-lg border py-12 text-center gap-3">
        <MapPin className="size-10 text-muted-foreground/30" />
        <div>
          <p className="text-sm font-medium text-foreground">No unassigned areas are currently available.</p>
          <p className="text-xs text-muted-foreground mt-1">
            All cities have already been assigned to existing zones.
          </p>
        </div>
        {total > 0 && (
          <div className="mt-1 rounded-md border bg-muted/40 px-5 py-3 text-sm space-y-1 text-start w-52">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Areas</span>
              <span className="font-semibold tabular-nums">{total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Assigned</span>
              <span className="font-semibold tabular-nums text-amber-600">{assigned}</span>
            </div>
            <div className="flex justify-between border-t pt-1 mt-1">
              <span className="text-muted-foreground">Available</span>
              <span className="font-semibold tabular-nums">{available}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col rounded-lg border bg-background">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b p-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search areas or governorates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 pl-7 text-xs"
              disabled={disabled}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          <AssignByGovPopover
            groups={groups}
            assignedIds={assignedIds}
            onAssign={(ids) => onChange(ids)}
            disabled={disabled}
          />

          {selectedCount > 0 && (
            <button
              type="button"
              onClick={deselectAll}
              disabled={disabled}
              className="text-xs text-muted-foreground hover:text-destructive disabled:pointer-events-none disabled:opacity-50"
            >
              Deselect all
            </button>
          )}

          <span className="ms-auto text-xs text-muted-foreground tabular-nums">
            {selectedCount} / {totalCount}
          </span>
        </div>

        {/* Groups */}
        <div className="flex-1 overflow-y-auto" style={{ maxHeight: 380 }}>
          {visibleGroups.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-xs text-muted-foreground">
              No areas match your search.
            </div>
          ) : (
            visibleGroups.map((group) => (
              <GovRow
                key={group.governorate_id}
                group={group}
                assignedSet={assignedSet}
                currentZoneId={currentZoneId}
                searchQuery={search}
                expanded={expandedGovs.has(group.governorate_id) || !!search}
                onToggleExpand={() => toggleExpand(group.governorate_id)}
                onToggleCity={handleToggleCity}
                onToggleAll={handleToggleAll}
                disabled={disabled}
              />
            ))
          )}
        </div>

        {hasForceMoved && (
          <div className="border-t bg-amber-50 px-3 py-1.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
            Some areas will be moved from their current zones when saved.
          </div>
        )}

        {selectedCount > 0 && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t bg-muted/20 px-3 py-2 text-xs">
            <span className="font-medium text-muted-foreground">Selected</span>
            <span className="tabular-nums">
              <span className="font-semibold text-foreground">{selectedGovCount}</span>
              <span className="ml-0.5 text-muted-foreground">{selectedGovCount !== 1 ? 'Govs' : 'Gov'}</span>
            </span>
            <span className="text-muted-foreground/50">·</span>
            <span className="tabular-nums">
              <span className="font-semibold text-foreground">{selectedCount}</span>
              <span className="ml-0.5 text-muted-foreground">Cities</span>
            </span>
          </div>
        )}
      </div>

      <SmartMoveDialog
        city={pendingMove}
        targetZoneName={currentZoneName}
        onConfirm={handleSmartMoveConfirm}
        onCancel={() => setPendingMove(null)}
      />
    </>
  );
}
