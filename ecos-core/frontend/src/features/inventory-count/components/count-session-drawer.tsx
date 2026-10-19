import { useRef, useState } from 'react';
import {
  Camera, Check, CheckCircle, CheckCircle2,
  FileText, Loader2, PackageSearch, PlayCircle, RotateCcw,
  X, XCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState } from '@/components/crud';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { getMediaUrl } from '@/lib/media';
import { formatMoney } from '@/lib/format';
import { toast } from '@/components/ds/use-toast';
import { useCompany } from '@/features/organization/context/company-context';

import {
  useApproveCountSession,
  useCancelCountSession,
  useCompleteCountSession,
  useCountReportQuery,
  useCountSessionQuery,
  useDeleteCountLineAttachment,
  useStartCountSession,
  useUpdateCountSession,
  useUploadCountLineAttachment,
} from '../hooks/use-inventory-count';
import type { CountLine, CountLineAttachment, CountReportData, CountSession } from '../types/inventory-count';
import { CountStatusBadge } from './count-status-badge';

// ─── Constants ───────────────────────────────────────────────────────────────

const DAMAGE_REASONS = [
  'Expired',
  'Broken',
  'Packaging Damage',
  'Manufacturing Loss',
  'Handling Damage',
  'Unknown',
  'Other',
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n == null) return '—';
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDateTime(d: string | null | undefined): string {
  if (!d) return '—';
  const dt = new Date(d);
  return (
    new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(dt) +
    ' ' +
    new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(dt)
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function VariancePill({ qty }: { qty: number | null }) {
  const { t } = useTranslation('inventory-count');
  if (qty == null) return <span className="text-muted-foreground text-xs">—</span>;
  if (qty === 0) return <span className="text-xs text-emerald-600 font-medium">{t($ => $.drawer.variance.match)}</span>;
  return (
    <span className={`text-xs font-mono font-medium ${qty < 0 ? 'text-destructive' : 'text-amber-600'}`}>
      {qty > 0 ? '+' : ''}{qty.toFixed(2)}
    </span>
  );
}

function AttachmentThumbnail({
  attachment,
  onDelete,
  canDelete,
}: {
  attachment: CountLineAttachment;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const { t } = useTranslation('inventory-count');
  const isImage = attachment.mime_type?.startsWith('image/') ?? false;
  return (
    <div className="relative group w-14 h-14 rounded border bg-muted overflow-hidden flex items-center justify-center shrink-0">
      {isImage ? (
        <img
          src={`/api/storage/${attachment.file_name}`}
          alt={attachment.file_name}
          className="w-full h-full object-cover"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
        />
      ) : (
        <div className="flex flex-col items-center gap-0.5">
          <FileText className="size-5 text-muted-foreground" />
          <span className="text-[9px] text-muted-foreground truncate max-w-[52px] px-1">
            {attachment.file_name.split('.').pop()?.toUpperCase()}
          </span>
        </div>
      )}
      {canDelete && (
        <button
          onClick={onDelete}
          className="absolute inset-0 bg-destructive/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
          title={t($ => $.drawer.lines.removeAttachment)}
        >
          <X className="size-4 text-white" />
        </button>
      )}
    </div>
  );
}

// ─── CountLineRow ─────────────────────────────────────────────────────────────

type LineUpdate = {
  counted_qty?: number | null;
  damaged_qty?: number;
  damage_reason?: string | null;
  damage_notes?: string | null;
};

function CountLineRow({
  line,
  sessionId,
  editable,
  showSystemQty,
  onChange,
}: {
  line: CountLine;
  sessionId: string;
  editable: boolean;
  showSystemQty: boolean;
  onChange?: (id: string, update: LineUpdate) => void;
}) {
  const { t } = useTranslation('inventory-count');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;

  const [localQty, setLocalQty]         = useState<string>(line.counted_qty != null ? String(line.counted_qty) : '');
  const [localDamaged, setLocalDamaged] = useState<string>(line.damaged_qty > 0 ? String(line.damaged_qty) : '');
  const [localReason, setLocalReason]   = useState<string>(line.damage_reason ?? '');
  const [localNotes, setLocalNotes]     = useState<string>(line.notes ?? '');
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadCountLineAttachment(sessionId);
  const deleteMutation = useDeleteCountLineAttachment(sessionId);

  const damagedVal = parseFloat(localDamaged) || 0;
  const reasonRequired = damagedVal > 0 && !localReason;
  const showOtherNotes = localReason === 'Other';

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate(
      { lineId: line.id, file },
      {
        onSuccess: () => toast.success(t($ => $.drawer.lines.attachAdded)),
        onError:   () => toast.error(t($ => $.drawer.lines.attachFailed)),
      },
    );
    e.target.value = '';
  }

  return (
    <tr className="border-b last:border-0 align-top">
      {/* Product */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          {line.product?.image_url ? (
            <img
              src={getMediaUrl(line.product.image_url) ?? undefined}
              alt={line.product.name ?? ''}
              className="size-7 rounded object-cover border shrink-0"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="size-7 rounded bg-muted flex items-center justify-center text-[10px] text-muted-foreground border shrink-0">—</div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight truncate max-w-36">{line.product?.name ?? '—'}</p>
            <p className="text-[10px] text-muted-foreground font-mono">{line.product?.sku}</p>
          </div>
        </div>
      </td>

      {/* System Qty — only visible after approval */}
      {showSystemQty && (
        <td className="px-3 py-3 text-end font-mono text-sm tabular-nums">
          {line.system_qty != null ? fmt(line.system_qty) : <span className="text-muted-foreground text-xs">—</span>}
        </td>
      )}

      {/* Counted Qty */}
      <td className="px-3 py-3">
        {editable ? (
          <input
            type="number"
            min="0"
            step="0.01"
            value={localQty}
            placeholder="0"
            onChange={(e) => {
              setLocalQty(e.target.value);
              const n = e.target.value === '' ? null : parseFloat(e.target.value);
              if (n === null || !isNaN(n)) onChange?.(line.id, { counted_qty: n });
            }}
            className="h-7 w-20 rounded border border-input bg-background px-2 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
          />
        ) : (
          <span className="font-mono text-sm tabular-nums">
            {line.counted_qty != null ? fmt(line.counted_qty) : <span className="text-muted-foreground text-xs">—</span>}
          </span>
        )}
      </td>

      {/* Damaged Qty */}
      <td className="px-3 py-3">
        {editable ? (
          <input
            type="number"
            min="0"
            step="0.01"
            value={localDamaged}
            placeholder="0"
            onChange={(e) => {
              setLocalDamaged(e.target.value);
              const n = e.target.value === '' ? 0 : parseFloat(e.target.value);
              if (!isNaN(n)) onChange?.(line.id, { damaged_qty: n });
            }}
            className="h-7 w-20 rounded border border-input bg-background px-2 text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-ring"
          />
        ) : (
          <span className={`font-mono text-sm tabular-nums ${line.damaged_qty > 0 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
            {line.damaged_qty > 0 ? fmt(line.damaged_qty) : '—'}
          </span>
        )}
      </td>

      {/* Damage Reason */}
      <td className="px-3 py-3">
        {editable ? (
          <div className="flex flex-col gap-1">
            <select
              value={localReason}
              onChange={(e) => {
                setLocalReason(e.target.value);
                onChange?.(line.id, { damage_reason: e.target.value || null });
              }}
              className={`h-7 rounded border ${reasonRequired ? 'border-destructive' : 'border-input'} bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring`}
            >
              <option value="">{damagedVal > 0 ? t($ => $.drawer.lines.reasonRequired) : '—'}</option>
              {DAMAGE_REASONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {reasonRequired && (
              <p className="text-[10px] text-destructive">{t($ => $.drawer.lines.reasonHint)}</p>
            )}
            {showOtherNotes && (
              <textarea
                rows={2}
                value={localNotes}
                placeholder={tAny('drawer.lines.damageNotesPlaceholder')}
                onChange={(e) => {
                  setLocalNotes(e.target.value);
                  onChange?.(line.id, { damage_notes: e.target.value || null });
                }}
                className="w-full rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-muted-foreground">{line.damage_reason ?? '—'}</span>
            {line.notes && <span className="text-[10px] text-muted-foreground italic">{line.notes}</span>}
          </div>
        )}
      </td>

      {/* Shortage (post-approval only) */}
      {showSystemQty && (
        <td className="px-3 py-3 text-end">
          {line.shortage_qty != null && line.shortage_qty > 0 ? (
            <span className="text-xs font-mono font-medium text-destructive">-{fmt(line.shortage_qty)}</span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </td>
      )}

      {/* Variance (post-approval only) */}
      {showSystemQty && (
        <td className="px-3 py-3 text-end">
          <VariancePill qty={line.variance_qty} />
        </td>
      )}

      {/* Attachments */}
      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1 items-start">
          {line.attachments.map((a) => (
            <AttachmentThumbnail
              key={a.id}
              attachment={a}
              canDelete={editable}
              onDelete={() => deleteMutation.mutate(
                { lineId: line.id, attachmentId: a.id },
                {
                  onSuccess: () => toast.success(t($ => $.drawer.lines.attachRemoved)),
                  onError:   () => toast.error(t($ => $.drawer.lines.attachRemoveFailed)),
                },
              )}
            />
          ))}
          {editable && (
            <>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploadMutation.isPending}
                title={t($ => $.drawer.lines.attachTitle)}
                className="w-14 h-14 rounded border border-dashed border-input flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-colors disabled:opacity-50"
              >
                {uploadMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf,video/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

function Timeline({ session }: { session: CountSession }) {
  const { t } = useTranslation('inventory-count');

  const steps: { label: string; ts: string | null; done: boolean }[] = [
    { label: t($ => $.drawer.timeline.sessionCreated), ts: session.created_at,   done: true },
    { label: t($ => $.drawer.timeline.countStarted),   ts: session.started_at,   done: !!session.started_at },
    { label: t($ => $.drawer.timeline.countCompleted), ts: session.completed_at, done: !!session.completed_at },
    { label: t($ => $.drawer.timeline.approvedPosted), ts: session.approved_by ? session.updated_at : null, done: session.status === 'approved' },
  ];

  return (
    <div className="px-6 py-4 border-t">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t($ => $.drawer.timeline.title)}</p>
      <ol className="relative border-l border-border ml-2 space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="pl-4 relative">
            <div
              className={`absolute -left-1.5 mt-0.5 size-3 rounded-full border-2 ${
                step.done
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'bg-background border-muted-foreground/40'
              }`}
            />
            <p className={`text-xs font-medium ${step.done ? 'text-foreground' : 'text-muted-foreground'}`}>
              {step.label}
            </p>
            {step.ts && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDateTime(step.ts)}</p>
            )}
            {!step.done && !step.ts && (
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">{t($ => $.drawer.timeline.pending)}</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─── Final Count Report ───────────────────────────────────────────────────────

function DecisionBadge({ decision }: { decision: CountReportData['product_details'][0]['decision'] }) {
  const { t } = useTranslation('inventory-count');

  const map: Record<string, { label: string; cls: string }> = {
    match:              { label: t($ => $.drawer.report.decisions.match),            cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    overstock:          { label: t($ => $.drawer.report.decisions.overstock),        cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    shortage:           { label: t($ => $.drawer.report.decisions.shortage),         cls: 'bg-red-100 text-red-700 border-red-200' },
    waste:              { label: t($ => $.drawer.report.decisions.waste),            cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    shortage_and_waste: { label: t($ => $.drawer.report.decisions.shortageAndWaste), cls: 'bg-orange-100 text-orange-700 border-orange-200' },
  };
  const cfg = map[decision] ?? { label: decision, cls: '' };
  return <Badge variant="outline" className={`text-[10px] ${cfg.cls}`}>{cfg.label}</Badge>;
}

function CountReport({ sessionId, currency, locale }: { sessionId: string; currency: string; locale: string }) {
  const { t } = useTranslation('inventory-count');
  const { data: report, isLoading, isError } = useCountReportQuery(sessionId);

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><LoadingState /></div>;
  if (isError || !report) return <div className="flex-1 flex items-center justify-center"><ErrorState /></div>;

  const fmtMoney = (v: number) => formatMoney(v, currency, locale);

  const inventoryKpis = [
    { key: 'systemQty',   label: t($ => $.drawer.report.kpis.systemQty),   value: fmt(report.inventory_summary.system_qty, 0) },
    { key: 'countedQty',  label: t($ => $.drawer.report.kpis.countedQty),  value: fmt(report.inventory_summary.counted_qty, 0) },
    { key: 'damagedQty',  label: t($ => $.drawer.report.kpis.damagedQty),  value: fmt(report.inventory_summary.damaged_qty, 0) },
    { key: 'shortageQty', label: t($ => $.drawer.report.kpis.shortageQty), value: fmt(report.inventory_summary.shortage_qty, 0) },
    { key: 'lines',       label: t($ => $.drawer.report.kpis.lines),        value: `${report.inventory_summary.counted_lines}/${report.inventory_summary.total_lines}` },
    {
      key: 'accuracy',
      label: t($ => $.drawer.report.kpis.accuracy),
      value: report.inventory_summary.inventory_accuracy != null
        ? `${report.inventory_summary.inventory_accuracy.toFixed(1)}%`
        : '—',
    },
  ];

  return (
    <div className="flex-1 overflow-auto p-6 space-y-6">
      {/* Header */}
      <div className="rounded-lg border bg-card p-4">
        <p className="text-sm font-semibold mb-2">{t($ => $.drawer.report.title)}</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          <div className="text-muted-foreground">{t($ => $.drawer.report.sessionNo)}</div><div className="font-mono">{report.session.count_number}</div>
          <div className="text-muted-foreground">{t($ => $.drawer.report.warehouse)}</div><div>{report.session.warehouse?.name ?? '—'}</div>
          <div className="text-muted-foreground">{t($ => $.drawer.report.started)}</div><div>{fmtDateTime(report.session.started_at)}</div>
          <div className="text-muted-foreground">{t($ => $.drawer.report.completed)}</div><div>{fmtDateTime(report.session.completed_at)}</div>
          <div className="text-muted-foreground">{t($ => $.drawer.report.approvedBy)}</div><div>{report.session.approved_by ?? '—'}</div>
          <div className="text-muted-foreground">{t($ => $.drawer.report.approvalDate)}</div><div>{fmtDateTime(report.session.approved_at)}</div>
        </div>
      </div>

      {/* Inventory Summary */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t($ => $.drawer.report.inventorySummary)}</p>
        <div className="grid grid-cols-3 gap-3">
          {inventoryKpis.map((kpi) => (
            <div key={kpi.key} className="rounded-md border bg-card p-2.5">
              <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
              <p className="text-sm font-semibold tabular-nums mt-0.5">{kpi.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Financial Summary */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t($ => $.drawer.report.financialSummary)}</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-md border bg-card p-2.5">
            <p className="text-[10px] text-muted-foreground">{t($ => $.drawer.report.kpis.shortageValue)}</p>
            <p className="text-sm font-semibold text-destructive tabular-nums mt-0.5">{fmtMoney(report.financial_summary.shortage_value)}</p>
          </div>
          <div className="rounded-md border bg-card p-2.5">
            <p className="text-[10px] text-muted-foreground">{t($ => $.drawer.report.kpis.wasteValue)}</p>
            <p className="text-sm font-semibold text-amber-600 tabular-nums mt-0.5">{fmtMoney(report.financial_summary.waste_value)}</p>
          </div>
          <div className="rounded-md border bg-card p-2.5">
            <p className="text-[10px] text-muted-foreground">{t($ => $.drawer.report.kpis.totalAdjustment)}</p>
            <p className="text-sm font-semibold tabular-nums mt-0.5">{fmtMoney(report.financial_summary.total_adjustment)}</p>
          </div>
        </div>
      </div>

      {/* Investigation & Liability Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t($ => $.drawer.report.investigationSummary)}</p>
          <div className="rounded-md border bg-card p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">{t($ => $.drawer.report.investigationKpis.pending)}</span><span className="font-medium">{report.investigation_summary.pending}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t($ => $.drawer.report.investigationKpis.resolved)}</span><span className="font-medium">{report.investigation_summary.resolved}</span></div>
            <div className="flex justify-between border-t pt-1 mt-1"><span className="text-muted-foreground">{t($ => $.drawer.report.investigationKpis.pendingValue)}</span><span className="font-medium text-amber-600">{fmtMoney(report.investigation_summary.pending_value)}</span></div>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t($ => $.drawer.report.liabilitySummary)}</p>
          <div className="rounded-md border bg-card p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">{t($ => $.drawer.report.liabilityKpis.pending)}</span><span className="font-medium">{report.liability_summary.pending}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t($ => $.drawer.report.liabilityKpis.approved)}</span><span className="font-medium">{report.liability_summary.approved}</span></div>
            <div className="flex justify-between border-t pt-1 mt-1"><span className="text-muted-foreground">{t($ => $.drawer.report.liabilityKpis.pendingValue)}</span><span className="font-medium text-destructive">{fmtMoney(report.liability_summary.pending_value)}</span></div>
          </div>
        </div>
      </div>

      {/* Product Details */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t($ => $.drawer.report.productDetails)}</p>
        <div className="rounded-md border overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-3 py-2 text-start font-medium text-muted-foreground">{t($ => $.drawer.report.cols.product)}</th>
                <th className="px-3 py-2 text-end font-medium text-muted-foreground">{t($ => $.drawer.report.cols.system)}</th>
                <th className="px-3 py-2 text-end font-medium text-muted-foreground">{t($ => $.drawer.report.cols.counted)}</th>
                <th className="px-3 py-2 text-end font-medium text-muted-foreground">{t($ => $.drawer.report.cols.damaged)}</th>
                <th className="px-3 py-2 text-end font-medium text-muted-foreground">{t($ => $.drawer.report.cols.shortage)}</th>
                <th className="px-3 py-2 text-end font-medium text-muted-foreground">{t($ => $.drawer.report.cols.unitCost)}</th>
                <th className="px-3 py-2 text-end font-medium text-muted-foreground">{t($ => $.drawer.report.cols.totalValue)}</th>
                <th className="px-3 py-2 text-start font-medium text-muted-foreground">{t($ => $.drawer.report.cols.reason)}</th>
                <th className="px-3 py-2 text-start font-medium text-muted-foreground">{t($ => $.drawer.report.cols.decision)}</th>
              </tr>
            </thead>
            <tbody>
              {report.product_details.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <p className="font-medium truncate max-w-36">{row.product?.name ?? '—'}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{row.product?.sku}</p>
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums">{fmt(row.system_qty, 0)}</td>
                  <td className="px-3 py-2 text-end tabular-nums">{fmt(row.counted_qty, 0)}</td>
                  <td className={`px-3 py-2 text-end tabular-nums ${row.damaged_qty > 0 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                    {row.damaged_qty > 0 ? fmt(row.damaged_qty, 0) : '—'}
                  </td>
                  <td className={`px-3 py-2 text-end tabular-nums ${(row.shortage_qty ?? 0) > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                    {(row.shortage_qty ?? 0) > 0 ? `-${fmt(row.shortage_qty, 0)}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums text-muted-foreground">
                    {row.unit_cost_snapshot != null ? fmt(row.unit_cost_snapshot) : '—'}
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums">
                    {row.total_value != null ? fmtMoney(row.total_value) : '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.damage_reason ?? '—'}</td>
                  <td className="px-3 py-2"><DecisionBadge decision={row.decision} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Drawer props ─────────────────────────────────────────────────────────────

type Props = {
  sessionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CountSessionDrawer({ sessionId, open, onOpenChange }: Props) {
  const { t } = useTranslation('inventory-count');
  const { data: session, isLoading, isError } = useCountSessionQuery(sessionId ?? '');

  const startMutation    = useStartCountSession();
  const completeMutation = useCompleteCountSession();
  const approveMutation  = useApproveCountSession();
  const cancelMutation   = useCancelCountSession();
  const updateMutation   = useUpdateCountSession(sessionId ?? '');

  const [pendingLineUpdates, setPendingLineUpdates] = useState<Record<string, LineUpdate>>({});
  const [saving, setSaving]     = useState(false);
  const [view, setView]         = useState<'count' | 'report'>('count');

  const isEditable = session?.status === 'draft' || session?.status === 'in_progress';
  const isBusy =
    startMutation.isPending ||
    completeMutation.isPending ||
    approveMutation.isPending ||
    cancelMutation.isPending ||
    saving;

  function handleLineChange(id: string, update: LineUpdate) {
    setPendingLineUpdates((prev) => ({ ...prev, [id]: { ...prev[id], ...update } }));
  }

  async function handleSaveLines() {
    if (!session || Object.keys(pendingLineUpdates).length === 0) return;
    setSaving(true);
    try {
      await updateMutation.mutateAsync({
        lines: Object.entries(pendingLineUpdates).map(([id, upd]) => ({ id, ...upd })),
      });
      setPendingLineUpdates({});
      toast.success(t($ => $.drawer.toast.saved));
    } catch {
      toast.error(t($ => $.drawer.toast.saveFailed));
    } finally {
      setSaving(false);
    }
  }

  async function handleAction(action: () => Promise<unknown>, successMsg: string, errorMsg: string) {
    try {
      await action();
      toast.success(successMsg);
    } catch {
      toast.error(errorMsg);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col p-0 gap-0 overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center"><LoadingState /></div>
        ) : isError || !session ? (
          <div className="flex-1 flex items-center justify-center"><ErrorState /></div>
        ) : (
          <SessionContent
            session={session}
            sessionId={sessionId ?? ''}
            isEditable={isEditable}
            isBusy={isBusy}
            pendingLineUpdates={pendingLineUpdates}
            view={view}
            onViewChange={setView}
            onLineChange={handleLineChange}
            onSaveLines={handleSaveLines}
            onStart={() => handleAction(() => startMutation.mutateAsync(session.id), t($ => $.drawer.toast.started), t($ => $.drawer.toast.startFailed))}
            onComplete={() => handleAction(() => completeMutation.mutateAsync(session.id), t($ => $.drawer.toast.completed), t($ => $.drawer.toast.completeFailed))}
            onApprove={() => handleAction(() => approveMutation.mutateAsync({ id: session.id }), t($ => $.drawer.toast.approved), t($ => $.drawer.toast.approveFailed))}
            onCancel={() => handleAction(() => cancelMutation.mutateAsync(session.id), t($ => $.drawer.toast.cancelled), t($ => $.drawer.toast.cancelFailed))}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── SessionContent ───────────────────────────────────────────────────────────

function SessionContent({
  session,
  sessionId,
  isEditable,
  isBusy,
  pendingLineUpdates,
  view,
  onViewChange,
  onLineChange,
  onSaveLines,
  onStart,
  onComplete,
  onApprove,
  onCancel,
}: {
  session: CountSession;
  sessionId: string;
  isEditable: boolean;
  isBusy: boolean;
  pendingLineUpdates: Record<string, LineUpdate>;
  view: 'count' | 'report';
  onViewChange: (v: 'count' | 'report') => void;
  onLineChange: (id: string, update: LineUpdate) => void;
  onSaveLines: () => void;
  onStart: () => void;
  onComplete: () => void;
  onApprove: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation('inventory-count');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;
  const { currency, locale } = useCompany();
  const hasPending = Object.keys(pendingLineUpdates).length > 0;
  const lines = session.lines ?? [];

  // ── Blind count enforcement: system quantities hidden until approved ──────
  const showSystemQty = session.status === 'approved';

  const totalDamagedLines  = lines.filter((l) => l.damaged_qty > 0).length;
  const totalShortageLines = lines.filter((l) => (l.shortage_qty ?? 0) > 0).length;
  const vs = session.variance_summary;

  return (
    <>
      {/* Header */}
      <SheetHeader className="px-6 py-4 border-b shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <SheetTitle className="text-base font-semibold">{session.count_number}</SheetTitle>
            <SheetDescription className="flex items-center gap-2 mt-1 flex-wrap">
              <CountStatusBadge status={session.status} />
              <span className="text-xs text-muted-foreground">{session.warehouse?.name ?? '—'}</span>
            </SheetDescription>
          </div>

          {/* Report / Count toggle (approved sessions only) */}
          {session.status === 'approved' && (
            <div className="flex rounded-md border overflow-hidden shrink-0">
              <button
                onClick={() => onViewChange('count')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'count' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'}`}
              >
                <PackageSearch className="size-3.5 inline mr-1" />{t($ => $.drawer.viewCount)}
              </button>
              <button
                onClick={() => onViewChange('report')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${view === 'report' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent'}`}
              >
                <FileText className="size-3.5 inline mr-1" />{t($ => $.drawer.viewReport)}
              </button>
            </div>
          )}
        </div>
      </SheetHeader>

      {/* Blind count notice */}
      {(session.status === 'in_progress' || session.status === 'completed') && (
        <Alert className="mx-6 mt-3 shrink-0 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
            <strong>{t($ => $.drawer.blindCountActive)}</strong> — {t($ => $.drawer.blindCountDesc)}
          </AlertDescription>
        </Alert>
      )}

      {/* Report view */}
      {view === 'report' && session.status === 'approved' ? (
        <CountReport sessionId={sessionId} currency={currency} locale={locale} />
      ) : (
        <>
          {/* Meta strip */}
          <div className="px-6 py-3 border-b shrink-0 grid grid-cols-4 gap-4 text-xs">
            <div>
              <p className="text-muted-foreground">{t($ => $.drawer.meta.started)}</p>
              <p className="font-medium mt-0.5">{session.started_at ? fmtDateTime(session.started_at) : '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t($ => $.drawer.meta.completed)}</p>
              <p className="font-medium mt-0.5">{session.completed_at ? fmtDateTime(session.completed_at) : '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t($ => $.drawer.meta.lines)}</p>
              <p className="font-medium mt-0.5">{lines.length}</p>
            </div>
            {session.status === 'approved' && session.approved_by && (
              <div>
                <p className="text-muted-foreground">{t($ => $.drawer.meta.approvedBy)}</p>
                <p className="font-medium mt-0.5">{session.approved_by}</p>
              </div>
            )}
          </div>

          {/* Variance / shortage summary (post-approval only) */}
          {vs && showSystemQty && (
            <div className="px-6 py-3 border-b shrink-0 grid grid-cols-4 gap-3 text-xs">
              <div className="rounded-md border bg-card p-2.5">
                <p className="text-muted-foreground">{t($ => $.drawer.summary.accuracy)}</p>
                <p className="text-base font-semibold mt-0.5 text-emerald-600">
                  {vs.inventory_accuracy_pct != null ? `${vs.inventory_accuracy_pct.toFixed(1)}%` : '—'}
                </p>
              </div>
              <div className="rounded-md border bg-card p-2.5">
                <p className="text-muted-foreground">{t($ => $.drawer.summary.shortageLines)}</p>
                <p className="text-base font-semibold mt-0.5 text-destructive">{totalShortageLines}</p>
              </div>
              <div className="rounded-md border bg-card p-2.5">
                <p className="text-muted-foreground">{t($ => $.drawer.summary.shortageValue)}</p>
                <p className="text-sm font-semibold mt-0.5 text-destructive tabular-nums">
                  {session.shortage_value != null ? formatMoney(session.shortage_value, currency, locale) : '—'}
                </p>
              </div>
              <div className="rounded-md border bg-card p-2.5">
                <p className="text-muted-foreground">{t($ => $.drawer.summary.wasteValue)}</p>
                <p className="text-sm font-semibold mt-0.5 text-amber-600 tabular-nums">
                  {session.waste_value != null ? formatMoney(session.waste_value, currency, locale) : '—'}
                </p>
              </div>
            </div>
          )}

          {/* Approved notice */}
          {session.status === 'approved' && (totalShortageLines > 0 || totalDamagedLines > 0) && (
            <Alert className="mx-6 my-3 shrink-0">
              <AlertDescription className="text-xs">
                {totalShortageLines > 0 && tAny('drawer.alerts.liabilities', { count: totalShortageLines })}
                {totalShortageLines > 0 && totalDamagedLines > 0 && ' '}
                {totalDamagedLines > 0 && tAny('drawer.alerts.wasteLines', { count: totalDamagedLines })}
              </AlertDescription>
            </Alert>
          )}

          {/* Notes */}
          {session.notes && (
            <Alert className="mx-6 my-2 shrink-0">
              <AlertDescription className="text-xs">{session.notes}</AlertDescription>
            </Alert>
          )}

          {/* Lines table */}
          <div className="flex-1 overflow-auto">
            {lines.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-12">{t($ => $.drawer.lines.empty)}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-background z-10 shadow-sm">
                  <tr className="border-b">
                    <th className="px-3 py-2 text-start text-xs font-medium text-muted-foreground">{t($ => $.drawer.lines.product)}</th>
                    {showSystemQty && (
                      <th className="px-3 py-2 text-end text-xs font-medium text-muted-foreground">{t($ => $.drawer.lines.systemQty)}</th>
                    )}
                    <th className="px-3 py-2 text-start text-xs font-medium text-muted-foreground">{t($ => $.drawer.lines.countedQty)}</th>
                    <th className="px-3 py-2 text-start text-xs font-medium text-muted-foreground">{t($ => $.drawer.lines.damagedQty)}</th>
                    <th className="px-3 py-2 text-start text-xs font-medium text-muted-foreground">{t($ => $.drawer.lines.damageReason)}</th>
                    {showSystemQty && (
                      <th className="px-3 py-2 text-end text-xs font-medium text-muted-foreground">{t($ => $.drawer.lines.shortage)}</th>
                    )}
                    {showSystemQty && (
                      <th className="px-3 py-2 text-end text-xs font-medium text-muted-foreground">{t($ => $.drawer.lines.variance)}</th>
                    )}
                    <th className="px-3 py-2 text-start text-xs font-medium text-muted-foreground">{t($ => $.drawer.lines.attachments)}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <CountLineRow
                      key={line.id}
                      line={line}
                      sessionId={sessionId}
                      editable={isEditable}
                      showSystemQty={showSystemQty}
                      onChange={onLineChange}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Timeline */}
          <Timeline session={session} />

          {/* Action footer */}
          <div className="px-6 py-4 border-t shrink-0 flex items-center gap-2 flex-wrap bg-background">
            {isEditable && hasPending && (
              <Button size="sm" onClick={onSaveLines} disabled={isBusy} className="gap-1.5">
                {isBusy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {t($ => $.drawer.actions.saveCount)}
              </Button>
            )}

            {session.status === 'draft' && (
              <Button size="sm" variant="default" onClick={onStart} disabled={isBusy} className="gap-1.5">
                <PlayCircle className="size-3.5" />
                {t($ => $.drawer.actions.startCount)}
              </Button>
            )}
            {session.status === 'in_progress' && (
              <Button size="sm" variant="default" onClick={onComplete} disabled={isBusy} className="gap-1.5">
                <CheckCircle className="size-3.5" />
                {t($ => $.drawer.actions.completeCount)}
              </Button>
            )}
            {session.status === 'completed' && (
              <Button size="sm" variant="default" onClick={onApprove} disabled={isBusy} className="gap-1.5">
                <CheckCircle2 className="size-3.5" />
                {t($ => $.drawer.actions.approvePost)}
              </Button>
            )}
            {(session.status === 'draft' || session.status === 'in_progress' || session.status === 'completed') && (
              <Button
                size="sm"
                variant="outline"
                onClick={onCancel}
                disabled={isBusy}
                className="gap-1.5 text-destructive hover:text-destructive ms-auto"
              >
                <XCircle className="size-3.5" />
                {t($ => $.drawer.actions.cancel)}
              </Button>
            )}
            {session.status === 'approved' && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium ms-auto">
                <Check className="size-3.5" />
                {t($ => $.drawer.actions.approved)}
              </div>
            )}
            {session.status === 'cancelled' && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground ms-auto">
                <RotateCcw className="size-3.5" />
                {t($ => $.drawer.actions.cancelled)}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
