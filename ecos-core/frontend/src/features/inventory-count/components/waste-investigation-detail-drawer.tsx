import { useRef, useState } from 'react';
import { useFormatter } from '@/hooks/use-formatter';
import {
  CheckCircle,
  Clock,
  FileText,
  Loader2,
  Paperclip,
  Trash2,
  Upload,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type enInventoryCount from '@/i18n/locales/en/inventory-count.json';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ds/use-toast';

import {
  useWasteInvestigationQuery,
  useUploadWasteAttachment,
  useDeleteWasteAttachment,
} from '../hooks/use-inventory-count';
import type {
  WasteInvestigation,
  WasteInvestigationAttachment,
  WasteInvestigationEvent,
} from '../types/inventory-count';

const fmt = (n: number | null | undefined, decimals = 2) =>
  n == null ? '—' : n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/**
 * Timeline event types.
 *
 * The API types `event_type` as an open string, while the locale carries a
 * closed set. The union is derived from the locale so the two cannot drift, and
 * the runtime list is checked against it by `satisfies` — adding an event to one
 * without the other is a compile error. Unknown values still fall back to the
 * raw type, which is what the previous `defaultValue` did.
 */
type TimelineEventKey =
  keyof (typeof enInventoryCount)['waste']['detail']['timeline']['events'];

const TIMELINE_EVENT_KEYS = [
  'created',
  'resolved',
  'attachment_added',
  'attachment_removed',
  'notes_edited',
  'damage_reason_changed',
  'outcome_decided',
  'liability_created',
  'value_changed',
] as const satisfies readonly TimelineEventKey[];

function isTimelineEventKey(value: string): value is TimelineEventKey {
  return (TIMELINE_EVENT_KEYS as readonly string[]).includes(value);
}

const EVENT_COLORS: Record<string, string> = {
  created:          'text-sky-600',
  resolved:         'text-emerald-600',
  attachment_added: 'text-violet-600',
  liability_created:'text-amber-600',
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Summary tab ─────────────────────────────────────────────────────────────

function SummaryTab({ inv }: { inv: WasteInvestigation }) {
  const { t } = useTranslation('inventory-count');
  const { currency } = useFormatter();
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;

  return (
    <div className="space-y-5 py-4">
      {/* Product */}
      <div className="rounded-lg border bg-muted/30 px-4 py-3">
        <p className="text-xs text-muted-foreground mb-1">{t($ => $.waste.detail.summary.product)}</p>
        <p className="font-semibold">{inv.product?.name ?? '—'}</p>
        <p className="text-xs text-muted-foreground">{inv.product?.sku}</p>
      </div>

      {/* Quantities */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">{t($ => $.waste.detail.summary.quantity)}</p>
          <p className="text-lg font-semibold mt-0.5 tabular-nums">{fmt(inv.quantity, 2)}</p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">{t($ => $.waste.detail.summary.unitCost)}</p>
          <p className="text-lg font-semibold mt-0.5 tabular-nums">
            {inv.cost_snapshot_unit_cost != null ? fmt(inv.cost_snapshot_unit_cost, 4) : fmt(inv.unit_cost, 4)}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-3 text-center">
          <p className="text-xs text-muted-foreground">{t($ => $.waste.detail.summary.totalValue)}</p>
          <p className="text-lg font-semibold mt-0.5 tabular-nums">
            {inv.cost_snapshot_total_value != null ? fmt(inv.cost_snapshot_total_value) : fmt(inv.total_cost)}
          </p>
        </div>
      </div>

      {/* Cost snapshot badge */}
      {inv.cost_snapshot_at && (
        <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 rounded-md border border-emerald-200 dark:border-emerald-800 px-3 py-2">
          <CheckCircle className="size-3.5 shrink-0" />
          <span>
            {tAny('waste.detail.summary.fifoSnapshotFull', {
              date: new Date(inv.cost_snapshot_at).toLocaleString(),
              method: inv.cost_method ?? 'FIFO',
              currency: inv.currency ?? currency,
            })}
          </span>
        </div>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">{t($ => $.waste.detail.summary.damageReason)}</p>
          <p className="mt-0.5 font-medium">{inv.damage_reason ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t($ => $.waste.detail.summary.warehouse)}</p>
          <p className="mt-0.5 font-medium">{(inv.warehouse as { name: string } | null)?.name ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t($ => $.waste.detail.summary.status)}</p>
          <p className="mt-0.5">
            {inv.status === 'resolved'
              ? <span className="text-emerald-600 font-medium">{t($ => $.waste.detail.summary.statusResolved)}</span>
              : <span className="text-amber-600 font-medium">{t($ => $.waste.detail.summary.statusPending)}</span>}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t($ => $.waste.detail.summary.outcome)}</p>
          <p className="mt-0.5 font-medium">
            {inv.outcome ? t($ => $.waste.detail.outcomes[inv.outcome!], { defaultValue: inv.outcome }) : '—'}
          </p>
        </div>
        {inv.resolved_by && (
          <div>
            <p className="text-xs text-muted-foreground">{t($ => $.waste.detail.summary.resolvedBy)}</p>
            <p className="mt-0.5 font-medium">{inv.resolved_by}</p>
          </div>
        )}
        {inv.resolved_at && (
          <div>
            <p className="text-xs text-muted-foreground">{t($ => $.waste.detail.summary.resolutionDate)}</p>
            <p className="mt-0.5 font-medium">{new Date(inv.resolved_at).toLocaleDateString()}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground">{t($ => $.waste.detail.summary.month)}</p>
          <p className="mt-0.5 font-medium">{inv.month}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t($ => $.waste.detail.summary.daysOpen)}</p>
          <p className="mt-0.5 font-medium">{inv.days_pending ?? '—'}</p>
        </div>
      </div>

      {inv.investigator_notes && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">{t($ => $.waste.detail.summary.investigatorNotes)}</p>
          <p className="text-sm rounded-md border bg-muted/30 px-3 py-2">{inv.investigator_notes}</p>
        </div>
      )}

      {/* Future integration readiness */}
      {inv.metadata && Object.keys(inv.metadata).length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">{t($ => $.waste.detail.summary.integrationRefs)}</p>
          <div className="text-xs font-mono bg-muted/50 rounded px-3 py-2 space-y-0.5">
            {Object.entries(inv.metadata).map(([k, v]) => (
              <div key={k}><span className="text-muted-foreground">{k}:</span> {String(v)}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Timeline tab ─────────────────────────────────────────────────────────────

function TimelineTab({ events }: { events: WasteInvestigationEvent[] }) {
  const { t } = useTranslation('inventory-count');

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <Clock className="size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t($ => $.waste.detail.timeline.noEvents)}</p>
      </div>
    );
  }

  return (
    <div className="py-4">
      <ol className="relative border-l border-border ml-3 space-y-5">
        {events.map((ev) => {
          const color = EVENT_COLORS[ev.event_type] ?? 'text-muted-foreground';
          return (
            <li key={ev.id} className="ml-5">
              <span className={`absolute -left-2 flex size-4 items-center justify-center rounded-full border bg-background ${color}`}>
                <span className="size-1.5 rounded-full bg-current" />
              </span>
              <div className="text-sm">
                <p className={`font-medium ${color}`}>
                  {isTimelineEventKey(ev.event_type)
                    ? t($ => $.waste.detail.timeline.events[ev.event_type as TimelineEventKey])
                    : ev.event_type}
                </p>
                {ev.description && (
                  <p className="text-muted-foreground text-xs mt-0.5">{ev.description}</p>
                )}
                <p className="text-[11px] text-muted-foreground mt-1">
                  {ev.performed_by ? `${ev.performed_by} · ` : ''}
                  {new Date(ev.occurred_at).toLocaleString()}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── Attachments tab ──────────────────────────────────────────────────────────

function AttachmentsTab({
  investigationId,
  attachments,
  isResolved,
}: {
  investigationId: string;
  attachments: WasteInvestigationAttachment[];
  isResolved: boolean;
}) {
  const { t } = useTranslation('inventory-count');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [description, setDescription] = useState('');

  const uploadMutation  = useUploadWasteAttachment(investigationId);
  const deleteMutation  = useDeleteWasteAttachment(investigationId);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadMutation.mutateAsync({ file, description: description || undefined });
      setDescription('');
      toast.success(t($ => $.waste.detail.attachments.toast.uploaded));
    } catch {
      toast.error(t($ => $.waste.detail.attachments.toast.uploadFailed));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete(attachmentId: string, fileName: string) {
    try {
      await deleteMutation.mutateAsync(attachmentId);
      toast.success(tAny('waste.detail.attachments.toast.removed', { fileName }));
    } catch {
      toast.error(t($ => $.waste.detail.attachments.toast.removeFailed));
    }
  }

  return (
    <div className="py-4 space-y-4">
      {/* Upload area */}
      {!isResolved && (
        <div className="rounded-lg border border-dashed bg-muted/20 p-4 space-y-2">
          <input
            type="text"
            placeholder={tAny('waste.detail.attachments.descriptionPlaceholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="h-8 w-full rounded border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.mp4,.mov,.avi"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading
                ? <Loader2 className="size-3.5 animate-spin" />
                : <Upload className="size-3.5" />}
              {uploading ? t($ => $.waste.detail.attachments.uploading) : t($ => $.waste.detail.attachments.upload)}
            </Button>
            <p className="text-xs text-muted-foreground">{t($ => $.waste.detail.attachments.fileTypes)}</p>
          </div>
        </div>
      )}

      {/* Attachment list */}
      {attachments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Paperclip className="size-7 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t($ => $.waste.detail.attachments.empty)}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{att.file_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {att.description || att.mime_type || ''}{att.file_size ? ` · ${formatBytes(att.file_size)}` : ''}
                    {att.uploaded_by ? ` · ${att.uploaded_by}` : ''}
                  </p>
                </div>
              </div>
              {!isResolved && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => handleDelete(att.id, att.file_name)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Drawer shell ─────────────────────────────────────────────────────────────

type Props = {
  investigationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function WasteInvestigationDetailDrawer({ investigationId, open, onOpenChange }: Props) {
  const { data, isLoading } = useWasteInvestigationQuery(investigationId ?? '');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col p-0 gap-0 overflow-hidden">
        {isLoading || !data ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <DrawerContent inv={data} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DrawerContent({ inv }: { inv: WasteInvestigation }) {
  const { t } = useTranslation('inventory-count');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;

  const isResolved = inv.status === 'resolved';
  const events = inv.events ?? [];
  const attachments = inv.attachments ?? [];

  const overdueClass = inv.is_overdue_7
    ? 'text-destructive'
    : inv.is_overdue_3
    ? 'text-amber-600'
    : 'text-muted-foreground';

  return (
    <>
      <SheetHeader className="px-6 py-4 border-b shrink-0">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <SheetTitle className="text-base font-semibold truncate">
              {inv.product?.name ?? t($ => $.waste.detail.header.fallbackTitle)}
            </SheetTitle>
            <SheetDescription className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge
                variant="outline"
                className={isResolved
                  ? 'text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 text-xs'
                  : 'text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20 text-xs'
                }
              >
                {isResolved ? t($ => $.waste.detail.header.resolved) : t($ => $.waste.detail.header.pending)}
              </Badge>
              <span className={`text-xs font-medium ${overdueClass}`}>
                {inv.days_pending != null ? tAny('waste.detail.header.daysOpen', { days: inv.days_pending }) : ''}
              </span>
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <Tabs defaultValue="summary" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="mx-6 mt-3 mb-0 shrink-0 w-fit">
          <TabsTrigger value="summary">{t($ => $.waste.detail.tabs.summary)}</TabsTrigger>
          <TabsTrigger value="timeline">
            {t($ => $.waste.detail.tabs.timeline)}
            {events.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px] font-medium tabular-nums">
                {events.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="attachments">
            {t($ => $.waste.detail.tabs.attachments)}
            {attachments.length > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 text-[10px] font-medium tabular-nums">
                {attachments.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto px-6">
          <TabsContent value="summary">
            <SummaryTab inv={inv} />
          </TabsContent>
          <TabsContent value="timeline">
            <TimelineTab events={events} />
          </TabsContent>
          <TabsContent value="attachments">
            <AttachmentsTab
              investigationId={inv.id}
              attachments={attachments}
              isResolved={isResolved}
            />
          </TabsContent>
        </div>
      </Tabs>
    </>
  );
}
