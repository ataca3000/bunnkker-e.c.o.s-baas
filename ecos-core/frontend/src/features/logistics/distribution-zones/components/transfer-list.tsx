import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CityArea, GovernorateGroup } from '../types/distribution-zone';

type TransferListProps = {
  groups: GovernorateGroup[];
  assignedIds: number[];
  onChange: (ids: number[]) => void;
  disabled?: boolean;
};

type PanelProps = {
  title: string;
  items: CityArea[];
  groups: GovernorateGroup[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  searchQuery: string;
  onSearch: (q: string) => void;
  count: number;
  disabled?: boolean;
};

function Panel({
  title,
  items,
  groups,
  selected,
  onToggle,
  onSelectAll,
  onClearAll,
  searchQuery,
  onSearch,
  count,
  disabled,
}: PanelProps) {
  const itemSet = useMemo(() => new Set(items.map((i) => i.id)), [items]);

  // Build display list filtered by search, grouped by governorate
  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        cities: g.cities.filter(
          (c) =>
            itemSet.has(c.id) &&
            (!q ||
              c.name_ar.toLowerCase().includes(q) ||
              (c.name_en ?? '').toLowerCase().includes(q) ||
              (g.governorate_name_ar ?? '').toLowerCase().includes(q) ||
              (g.governorate_name_en ?? '').toLowerCase().includes(q)),
        ),
      }))
      .filter((g) => g.cities.length > 0);
  }, [groups, itemSet, searchQuery]);

  const visibleIds = useMemo(
    () => filteredGroups.flatMap((g) => g.cities.map((c) => c.id)),
    [filteredGroups],
  );
  const allVisible = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));

  return (
    <div className="flex flex-col rounded-md border bg-background" style={{ minHeight: 400 }}>
      <div className="border-b px-3 py-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">{title}</span>
          <Badge variant="secondary" className="text-xs">
            {count}
          </Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search areas…"
            value={searchQuery}
            onChange={(e) => onSearch(e.target.value)}
            className="h-7 pl-7 text-xs"
            disabled={disabled}
          />
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <button
            type="button"
            onClick={allVisible ? onClearAll : onSelectAll}
            className="text-xs text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            disabled={disabled || visibleIds.length === 0}
          >
            {allVisible ? 'Deselect all' : 'Select all'}
          </button>
          {selected.size > 0 && (
            <span className="text-xs text-muted-foreground">
              · {selected.size} selected
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filteredGroups.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4 text-xs text-muted-foreground">
            {searchQuery ? 'No areas match your search.' : 'No areas.'}
          </div>
        ) : (
          filteredGroups.map((group) => (
            <div key={group.governorate_id}>
              <div className="sticky top-0 z-10 border-b bg-muted/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.governorate_name_ar ?? group.governorate_name_en ?? '—'}
              </div>
              {group.cities.map((city) => (
                <label
                  key={city.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 border-b px-3 py-1.5 text-sm transition-colors hover:bg-accent',
                    selected.has(city.id) && 'bg-accent/50',
                    disabled && 'pointer-events-none opacity-60',
                  )}
                >
                  <Checkbox
                    checked={selected.has(city.id)}
                    onCheckedChange={() => onToggle(city.id)}
                    disabled={disabled}
                    className="size-3.5 shrink-0"
                  />
                  <span className="flex-1 truncate">{city.name_ar}</span>
                  {city.name_en && (
                    <span className="shrink-0 text-xs text-muted-foreground">{city.name_en}</span>
                  )}
                </label>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function TransferList({ groups, assignedIds, onChange, disabled }: TransferListProps) {
  const [leftSearch, setLeftSearch]   = useState('');
  const [rightSearch, setRightSearch] = useState('');
  const [leftSel, setLeftSel]   = useState<Set<number>>(new Set());
  const [rightSel, setRightSel] = useState<Set<number>>(new Set());

  const assignedSet = useMemo(() => new Set(assignedIds), [assignedIds]);

  // Flatten all cities
  const allCities = useMemo(
    () => groups.flatMap((g) => g.cities),
    [groups],
  );

  const availableItems = useMemo(
    () => allCities.filter((c) => !assignedSet.has(c.id)),
    [allCities, assignedSet],
  );

  const assignedItems = useMemo(
    () => allCities.filter((c) => assignedSet.has(c.id)),
    [allCities, assignedSet],
  );

  // Move selected from Available → Assigned
  function moveRight() {
    if (leftSel.size === 0) return;
    onChange([...assignedIds, ...Array.from(leftSel)]);
    setLeftSel(new Set());
  }

  // Move all available → Assigned
  function moveAllRight() {
    onChange([...new Set([...assignedIds, ...availableItems.map((c) => c.id)])]);
    setLeftSel(new Set());
  }

  // Remove selected from Assigned → Available
  function moveLeft() {
    if (rightSel.size === 0) return;
    onChange(assignedIds.filter((id) => !rightSel.has(id)));
    setRightSel(new Set());
  }

  // Remove all from Assigned → Available
  function moveAllLeft() {
    onChange([]);
    setRightSel(new Set());
  }

  function toggleLeft(id: number) {
    setLeftSel((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleRight(id: number) {
    setRightSel((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const visibleAvailable = useMemo(() => {
    const q = leftSearch.toLowerCase();
    if (!q) return availableItems.map((c) => c.id);
    return availableItems
      .filter(
        (c) =>
          c.name_ar.toLowerCase().includes(q) ||
          (c.name_en ?? '').toLowerCase().includes(q) ||
          (c.governorate_name_ar ?? '').toLowerCase().includes(q),
      )
      .map((c) => c.id);
  }, [availableItems, leftSearch]);

  const visibleAssigned = useMemo(() => {
    const q = rightSearch.toLowerCase();
    if (!q) return assignedItems.map((c) => c.id);
    return assignedItems
      .filter(
        (c) =>
          c.name_ar.toLowerCase().includes(q) ||
          (c.name_en ?? '').toLowerCase().includes(q) ||
          (c.governorate_name_ar ?? '').toLowerCase().includes(q),
      )
      .map((c) => c.id);
  }, [assignedItems, rightSearch]);

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] gap-2">
      <Panel
        title="Available Areas"
        items={availableItems}
        groups={groups}
        selected={leftSel}
        onToggle={toggleLeft}
        onSelectAll={() => setLeftSel(new Set(visibleAvailable))}
        onClearAll={() => setLeftSel(new Set())}
        searchQuery={leftSearch}
        onSearch={setLeftSearch}
        count={availableItems.length}
        disabled={disabled}
      />

      {/* Controls */}
      <div className="flex flex-col items-center justify-center gap-1.5 py-4">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-7"
          onClick={moveAllRight}
          disabled={disabled || availableItems.length === 0}
          title="Move all to Assigned"
        >
          <ChevronsRight className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-7"
          onClick={moveRight}
          disabled={disabled || leftSel.size === 0}
          title="Move selected to Assigned"
        >
          <ChevronRight className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-7"
          onClick={moveLeft}
          disabled={disabled || rightSel.size === 0}
          title="Remove selected from Assigned"
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-7"
          onClick={moveAllLeft}
          disabled={disabled || assignedItems.length === 0}
          title="Remove all from Assigned"
        >
          <ChevronsLeft className="size-3.5" />
        </Button>
      </div>

      <Panel
        title="Assigned Areas"
        items={assignedItems}
        groups={groups}
        selected={rightSel}
        onToggle={toggleRight}
        onSelectAll={() => setRightSel(new Set(visibleAssigned))}
        onClearAll={() => setRightSel(new Set())}
        searchQuery={rightSearch}
        onSearch={setRightSearch}
        count={assignedItems.length}
        disabled={disabled}
      />
    </div>
  );
}
