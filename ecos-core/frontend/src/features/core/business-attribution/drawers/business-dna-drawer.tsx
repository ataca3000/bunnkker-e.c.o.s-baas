import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import {
  useBusinessDna,
  useBaeEventsForDna,
  useJourney,
  useAttributionResult,
  useDnaMetrics,
} from '../hooks/use-bae';
import {
  JOURNEY_STAGE_LABELS,
  JOURNEY_STAGE_ORDINALS,
  ATTRIBUTION_MODEL_LABELS,
  EVENT_CATEGORY_LABELS,
  type AttributionModelType,
  type JourneyStage,
  type EventCategory,
} from '../types/bae';

const TABS = ['Overview', 'Journey', 'Events', 'Attribution', 'Metrics', 'Graph'] as const;
type Tab = (typeof TABS)[number];

function fmtDuration(s: number | null): string {
  if (s == null) return '—';
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

function KpiRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1.5 border-b last:border-0 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

// ─── Journey Visualization ────────────────────────────────────────────────────

function JourneyVisualization({ dnaId }: { dnaId: string }) {
  const { data: journey, isLoading } = useJourney(dnaId);

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="size-4 animate-spin" /></div>;
  if (!journey || journey.total_steps === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No journey steps recorded yet.</p>;
  }

  const sortedSteps = [...journey.steps].sort((a, b) =>
    (JOURNEY_STAGE_ORDINALS[a.journey_stage as JourneyStage] ?? 99) -
    (JOURNEY_STAGE_ORDINALS[b.journey_stage as JourneyStage] ?? 99),
  );

  return (
    <div className="space-y-3 pt-2">
      <div className="text-xs text-muted-foreground flex justify-between">
        <span>{journey.total_steps} steps</span>
        <span>Total: {fmtDuration(null)}</span>
      </div>

      {/* Timeline */}
      <div className="relative pl-6">
        <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border" />
        <div className="space-y-4">
          {sortedSteps.map((step, idx) => (
            <div key={step.id} className="relative">
              <div className="absolute -left-6 top-1 size-3 rounded-full bg-primary border-2 border-background" />
              <div className="rounded-md border bg-card p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {JOURNEY_STAGE_LABELS[step.journey_stage as JourneyStage] ?? step.journey_stage}
                  </span>
                  <time className="text-xs text-muted-foreground tabular-nums">
                    {new Date(step.occurred_at).toLocaleString()}
                  </time>
                </div>
                {step.duration_seconds != null && idx > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    +{fmtDuration(step.duration_seconds)} from previous
                  </p>
                )}
                {step.actor_id && (
                  <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                    Actor: {step.actor_id.slice(0, 8)}…
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Attribution Tab ──────────────────────────────────────────────────────────

function AttributionTab({ dnaId }: { dnaId: string }) {
  const [model, setModel] = useState<AttributionModelType>('last_touch');
  const { data: result, isLoading } = useAttributionResult(dnaId, model);

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Attribution Model</span>
        <Select value={model} onValueChange={(v) => setModel(v as AttributionModelType)}>
          <SelectTrigger className="w-40 h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.entries(ATTRIBUTION_MODEL_LABELS) as [AttributionModelType, string][]).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="size-4 animate-spin" /></div>
      ) : !result || result.total_touchpoints === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No touchpoints recorded.</p>
      ) : (
        <div className="space-y-2">
          {result.touchpoints.map((tp) => (
            <div key={tp.event_id} className="rounded-md border p-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium truncate max-w-[240px]">{tp.event_name}</span>
                <span className="tabular-nums font-semibold text-primary ml-2">
                  {(tp.credit * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${tp.credit * 100}%` }}
                  />
                </div>
                <time className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {new Date(tp.occurred_at).toLocaleDateString()}
                </time>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Metrics Tab ──────────────────────────────────────────────────────────────

function MetricsTab({ dnaId }: { dnaId: string }) {
  const { data: metric, isLoading } = useDnaMetrics(dnaId);

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="size-4 animate-spin" /></div>;

  return (
    <div className="pt-2 space-y-4">
      <div className="rounded-md border divide-y text-sm">
        <KpiRow label="Time to First Contact"  value={fmtDuration(metric?.time_to_first_contact_s ?? null)} />
        <KpiRow label="Lead → Quote"           value={fmtDuration(metric?.lead_to_quote_s ?? null)} />
        <KpiRow label="Quote → Order"          value={fmtDuration(metric?.quote_to_order_s ?? null)} />
        <KpiRow label="Order → Payment"        value={fmtDuration(metric?.order_to_payment_s ?? null)} />
        <KpiRow label="Payment → Preparation"  value={fmtDuration(metric?.payment_to_preparation_s ?? null)} />
        <KpiRow label="Preparation → Packing"  value={fmtDuration(metric?.preparation_to_packing_s ?? null)} />
        <KpiRow label="Packing → Shipment"     value={fmtDuration(metric?.packing_to_shipment_s ?? null)} />
        <KpiRow label="Shipment → Delivery"    value={fmtDuration(metric?.shipment_to_delivery_s ?? null)} />
        <KpiRow label="Delivery → Repeat"      value={fmtDuration(metric?.delivery_to_repeat_s ?? null)} />
        <KpiRow label="Customer Lifetime"      value={fmtDuration(metric?.customer_lifetime_duration_s ?? null)} />
        <KpiRow label="Total Journey Time"     value={fmtDuration(metric?.total_journey_time_s ?? null)} />
      </div>
      {metric?.calculated_at && (
        <p className="text-xs text-muted-foreground text-end">
          Calculated {new Date(metric.calculated_at).toLocaleString()}
        </p>
      )}
    </div>
  );
}

// ─── Events Tab ───────────────────────────────────────────────────────────────

function EventsTab({ dnaId }: { dnaId: string }) {
  const { data, isLoading } = useBaeEventsForDna(dnaId, 20);
  const events = (data as { data?: unknown[] })?.data ?? [];

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="size-4 animate-spin" /></div>;

  return (
    <div className="pt-2 space-y-1.5">
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No events yet.</p>
      ) : (
        (events as Array<{ id: string; event_name: string; category: string; producer_module: string; occurred_at: string }>).map((ev) => (
          <div key={ev.id} className="rounded-md border px-3 py-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{ev.event_name}</span>
              <Badge variant="secondary" className="text-xs">
                {EVENT_CATEGORY_LABELS[ev.category as EventCategory] ?? ev.category}
              </Badge>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-xs text-muted-foreground font-mono">{ev.producer_module}</span>
              <time className="text-xs text-muted-foreground tabular-nums">
                {new Date(ev.occurred_at).toLocaleString()}
              </time>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────

interface BusinessDnaDrawerProps {
  dnaId: string | null;
  open: boolean;
  onClose: () => void;
}

export function BusinessDnaDrawer({ dnaId, open, onClose }: BusinessDnaDrawerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Overview');

  const { data: dna, isLoading } = useBusinessDna(dnaId ?? undefined);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-[540px] sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            Business DNA
            {dna && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {dna.entity_type_label} · {dna.entity_id.slice(0, 8)}…
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {isLoading || !dna ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Status badges */}
            <div className="flex gap-2 mt-3 flex-wrap">
              <Badge variant="secondary" className="text-xs">{dna.entity_type_label}</Badge>
              {dna.is_converted && <Badge variant="secondary" className="text-xs bg-green-100 text-green-800">Converted</Badge>}
              {dna.has_repeat_purchase && <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">Repeat Buyer</Badge>}
              {dna.origin_provider && <Badge variant="secondary" className="text-xs">{dna.origin_provider}</Badge>}
            </div>

            {/* Tabs */}
            <div className="flex gap-0.5 border-b mt-4 mb-1 overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab
                      ? 'border-b-2 border-primary text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="pb-8">
              {activeTab === 'Overview' && (
                <div className="pt-2 space-y-4">
                  <div className="rounded-md border divide-y text-sm">
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground">Entity ID</span>
                      <span className="font-mono text-xs">{dna.entity_id}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground">Origin Provider</span>
                      <span>{dna.origin_provider ?? '—'}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground">Lead Source</span>
                      <span>{dna.lead_source ?? '—'}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground">Conversation Source</span>
                      <span>{dna.conversation_source ?? '—'}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground">Campaign</span>
                      <span className="font-mono text-xs">{dna.campaign_id ? `${dna.campaign_id.slice(0, 8)}…` : '—'}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground">Initiative</span>
                      <span className="font-mono text-xs">{dna.initiative_id ? `${dna.initiative_id.slice(0, 8)}…` : '—'}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground">Acquired At</span>
                      <span>{dna.acquisition_timestamp ? new Date(dna.acquisition_timestamp).toLocaleString() : '—'}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground">Converted At</span>
                      <span>{dna.conversion_timestamp ? new Date(dna.conversion_timestamp).toLocaleString() : '—'}</span>
                    </div>
                    <div className="flex justify-between px-3 py-2">
                      <span className="text-muted-foreground">Lifetime Stage</span>
                      <span>{dna.customer_lifetime_stage ?? '—'}</span>
                    </div>
                  </div>

                  {dna.first_touch && (
                    <div className="rounded-md border bg-muted/20 p-3 text-xs">
                      <div className="font-medium mb-1">First Touch</div>
                      <pre className="whitespace-pre-wrap text-muted-foreground">{JSON.stringify(dna.first_touch, null, 2)}</pre>
                    </div>
                  )}
                  {dna.last_touch && (
                    <div className="rounded-md border bg-muted/20 p-3 text-xs">
                      <div className="font-medium mb-1">Last Touch</div>
                      <pre className="whitespace-pre-wrap text-muted-foreground">{JSON.stringify(dna.last_touch, null, 2)}</pre>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'Journey'     && <JourneyVisualization dnaId={dna.id} />}
              {activeTab === 'Events'      && <EventsTab dnaId={dna.id} />}
              {activeTab === 'Attribution' && <AttributionTab dnaId={dna.id} />}
              {activeTab === 'Metrics'     && <MetricsTab dnaId={dna.id} />}
              {activeTab === 'Graph'       && (
                <div className="pt-4 text-center space-y-2">
                  <div className="text-2xl">🕸</div>
                  <p className="text-sm font-medium">Business Graph</p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Graph visualization (D3.js / Force-directed) — architecture is ready, visual canvas is a Phase 2 UI task.
                    The graph API is fully functional: nodes, edges, subgraph queries all work.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
