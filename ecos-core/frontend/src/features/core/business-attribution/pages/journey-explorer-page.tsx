import { useState } from 'react';
import { useJourneySearch } from '../hooks/use-bae';
import { BusinessDnaDrawer } from '../drawers/business-dna-drawer';
import { ReplayDrawerPlaceholder } from '../drawers/replay-drawer-placeholder';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { History } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  DNA_ENTITY_LABELS,
  JOURNEY_STAGE_LABELS,
  type DnaEntityType,
  type JourneyStage,
} from '../types/bae';

const ENTITY_TYPES: DnaEntityType[] = [
  'lead', 'conversation', 'customer', 'order', 'invoice',
  'payment', 'shipment', 'return', 'manufacturing_order',
  'preparation_batch', 'packing_batch',
];

const STAGES: JourneyStage[] = [
  'ad_impression', 'ad_click', 'landing', 'conversation', 'lead',
  'lead_assignment', 'quote', 'order', 'payment', 'inventory_reservation',
  'manufacturing', 'preparation', 'packing', 'shipment', 'delivery',
  'customer_review', 'repeat_purchase', 'vip_customer',
];

function fmtDuration(s: number | null): string {
  if (s == null) return '—';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

export function JourneyExplorerPage() {
  const [entityType,  setEntityType]  = useState('');
  const [hasStage,    setHasStage]    = useState('');
  const [search,      setSearch]      = useState('');
  const [page,        setPage]        = useState(1);
  const [selectedDnaId, setSelectedDnaId] = useState<string | null>(null);
  const [replayTarget, setReplayTarget]   = useState<{ type: string; id: string } | null>(null);

  const { data, isLoading } = useJourneySearch({
    entity_type: entityType || undefined,
    has_stage:   hasStage || undefined,
    per_page:    25,
    page,
  });

  const journeys = data?.data ?? [];
  const meta     = data?.meta;

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold">Journey Explorer</h1>
        <p className="text-sm text-muted-foreground">
          {meta?.total ?? 0} business journeys · Single source of truth for every business entity
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search entity ID…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-52"
        />
        <Select
          value={entityType || 'all'}
          onValueChange={(v) => { setEntityType(v === 'all' ? '' : v); setPage(1); }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All entity types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All entity types</SelectItem>
            {ENTITY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{DNA_ENTITY_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={hasStage || 'all'}
          onValueChange={(v) => { setHasStage(v === 'all' ? '' : v); setPage(1); }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Reached stage…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {STAGES.map((s) => (
              <SelectItem key={s} value={s}>{JOURNEY_STAGE_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
            <tr>
              <th className="text-start px-3 py-2 font-medium">Entity</th>
              <th className="text-start px-3 py-2 font-medium">Type</th>
              <th className="text-start px-3 py-2 font-medium">Attribution</th>
              <th className="text-start px-3 py-2 font-medium">Stages</th>
              <th className="text-end px-3 py-2 font-medium">Journey Time</th>
              <th className="text-start px-3 py-2 font-medium">Acquired</th>
              <th className="text-start px-3 py-2 font-medium">Converted</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-3 py-2"><div className="h-4 bg-muted rounded w-full" /></td>
                  ))}
                </tr>
              ))
            ) : journeys.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-12 text-center text-muted-foreground">
                  No journeys recorded yet. Business DNA is automatically created when entities are registered through the BAE.
                </td>
              </tr>
            ) : (
              journeys.map((dna) => (
                <tr
                  key={dna.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setSelectedDnaId(dna.id)}
                >
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {dna.entity_id.slice(0, 8)}…
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary" className="text-xs">
                      {dna.entity_type_label}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {dna.lead_source ?? dna.origin_provider ?? dna.conversation_source ?? '—'}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 flex-wrap">
                      {(dna.journey_steps ?? []).slice(0, 4).map((step) => (
                        <span
                          key={step.id}
                          className="inline-block px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs"
                          title={step.journey_stage_label}
                        >
                          {step.journey_stage_label.slice(0, 3)}
                        </span>
                      ))}
                      {(dna.journey_steps?.length ?? 0) > 4 && (
                        <span className="text-xs text-muted-foreground">+{(dna.journey_steps?.length ?? 0) - 4}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-end text-xs tabular-nums">
                    {fmtDuration(dna.metrics?.total_journey_time_s ?? null)}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {dna.acquisition_timestamp
                      ? new Date(dna.acquisition_timestamp).toLocaleDateString()
                      : '—'}
                  </td>
                  <td className="px-3 py-2">
                    {dna.is_converted
                      ? <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">Converted</Badge>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs gap-1 text-muted-foreground"
                      onClick={() => setReplayTarget({ type: dna.entity_type, id: dna.entity_id })}
                      title="Replay entity history"
                    >
                      <History className="h-3 w-3" />
                      Replay
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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

      <BusinessDnaDrawer
        dnaId={selectedDnaId}
        open={!!selectedDnaId}
        onClose={() => setSelectedDnaId(null)}
      />

      <ReplayDrawerPlaceholder
        open={!!replayTarget}
        onClose={() => setReplayTarget(null)}
        entityType={replayTarget?.type}
        entityId={replayTarget?.id}
      />
    </div>
  );
}
