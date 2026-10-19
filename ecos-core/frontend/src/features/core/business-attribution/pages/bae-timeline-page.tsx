import { useState } from 'react';
import { useBaeTimeline } from '../hooks/use-bae';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  EVENT_CATEGORY_LABELS,
  type EventCategory,
} from '../types/bae';

const CATEGORIES: EventCategory[] = [
  'marketing', 'sales', 'crm', 'inventory', 'manufacturing',
  'preparation', 'packing', 'shipping', 'accounting', 'finance',
  'support', 'customer', 'automation', 'system',
];

const CATEGORY_COLORS: Record<EventCategory, string> = {
  marketing:     'bg-purple-100 text-purple-800',
  sales:         'bg-green-100 text-green-800',
  crm:           'bg-blue-100 text-blue-800',
  inventory:     'bg-orange-100 text-orange-800',
  manufacturing: 'bg-yellow-100 text-yellow-800',
  preparation:   'bg-cyan-100 text-cyan-800',
  packing:       'bg-teal-100 text-teal-800',
  shipping:      'bg-indigo-100 text-indigo-800',
  accounting:    'bg-red-100 text-red-800',
  finance:       'bg-rose-100 text-rose-800',
  support:       'bg-amber-100 text-amber-800',
  customer:      'bg-lime-100 text-lime-800',
  automation:    'bg-sky-100 text-sky-800',
  system:        'bg-gray-100 text-gray-700',
};

export function BaeTimelinePage() {
  const [category, setCategory] = useState('');
  const [module,   setModule]   = useState('');
  const [search,   setSearch]   = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [page,     setPage]     = useState(1);

  const { data, isLoading } = useBaeTimeline({
    category:        category || undefined,
    producer_module: module || undefined,
    search:          search || undefined,
    date_from:       dateFrom || undefined,
    date_to:         dateTo || undefined,
    per_page:        50,
    page,
  });

  const events = data?.data ?? [];
  const meta   = data?.meta;

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Business Timeline</h1>
        <p className="text-sm text-muted-foreground">
          Cross-module enterprise event timeline · {meta?.total ?? 0} total events
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search events…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-48"
        />
        <Select
          value={category || 'all'}
          onValueChange={(v) => { setCategory(v === 'all' ? '' : v); setPage(1); }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{EVENT_CATEGORY_LABELS[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
          className="w-36"
          placeholder="From"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
          className="w-36"
          placeholder="To"
        />
        {(category || module || search || dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setCategory(''); setModule(''); setSearch(''); setDateFrom(''); setDateTo(''); setPage(1); }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Event List */}
      <div className="space-y-0 rounded-md border overflow-hidden divide-y">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-4 py-3 animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-1" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))
        ) : events.length === 0 ? (
          <div className="px-4 py-12 text-center text-muted-foreground text-sm">
            No events yet. Modules publish events via <code className="font-mono text-xs bg-muted px-1 rounded">POST /api/bae/events</code>.
          </div>
        ) : (
          events.map((event) => (
            <div key={event.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge
                    variant="secondary"
                    className={`text-xs shrink-0 ${CATEGORY_COLORS[event.category as EventCategory] ?? ''}`}
                  >
                    {EVENT_CATEGORY_LABELS[event.category as EventCategory] ?? event.category}
                  </Badge>
                  <span className="font-medium text-sm truncate">{event.event_name}</span>
                </div>
                <time className="text-xs text-muted-foreground shrink-0 tabular-nums">
                  {new Date(event.occurred_at).toLocaleString()}
                </time>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="font-mono">{event.producer_module}</span>
                {event.entity_type && (
                  <span>{event.entity_type} · {event.entity_id?.slice(0, 8)}…</span>
                )}
                {event.correlation_id && (
                  <span className="font-mono">corr: {event.correlation_id.slice(0, 8)}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {meta && meta.last_page > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Page {meta.current_page} of {meta.last_page}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
