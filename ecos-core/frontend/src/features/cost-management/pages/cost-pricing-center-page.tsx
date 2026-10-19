import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  ExternalLink,
  Loader2,
  Minus,
  MoreHorizontal,
  Pencil,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Upload,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';

import { EntityToolbar, PageHeader } from '@/components/crud';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ProductCostDrawer } from '@/features/cost-management/components/product-cost-drawer';
import {
  useApproveReview,
  useAssignReview,
  useBulkApprove,
  useBulkPolicyUpdate,
  useInlineUpdateReview,
  usePricingReviews,
  usePublishReview,
  useSnoozeReview,
} from '@/features/cost-management/hooks/use-pricing-reviews';
import type {
  ImpactType,
  InlineUpdatePayload,
  PricingReview,
  PricingReviewsQuery,
  PricingReviewsResult,
  ReviewStatus,
} from '@/features/cost-management/types/pricing-review';
import { toast } from '@/components/ds/use-toast';
import { getMediaUrl } from '@/lib/media';
import { cn } from '@/lib/utils';
import { ROUTES } from '@/router/routes';
import type { TFunction } from 'i18next';

// ── Formatting ────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n: number | null | undefined, decimals = 1) {
  if (n == null) return '—';
  return `${n.toFixed(decimals)}%`;
}

function fmtDate(d: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(d));
}

function impactReasons(
  t: TFunction<'cost-management'>,
  impacts: ImpactType[],
): string {
  if (impacts.length === 0) return '—';
  return impacts.map((i) => {
    switch (i) {
      case 'recipe_changed':      return t($ => $.priceReview.impactReason.recipeChanged);
      case 'cost_increased':      return t($ => $.priceReview.impactReason.costIncreased);
      case 'cost_decreased':      return t($ => $.priceReview.impactReason.costDecreased);
      case 'margin_below_target': return t($ => $.priceReview.impactReason.belowMarginTarget);
      case 'packaging_changed':   return t($ => $.priceReview.impactReason.packagingChanged);
    }
  }).join(', ');
}

function addDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── KPI cards ─────────────────────────────────────────────────────────────────

type KpiCardProps = {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  accent?: 'amber' | 'red' | 'green' | 'blue' | 'purple' | 'default';
  subtext?: string;
};

function KpiCard({ label, value, icon, accent = 'default', subtext }: KpiCardProps) {
  const accentClasses = {
    amber:   'text-amber-600 dark:text-amber-400',
    red:     'text-red-600 dark:text-red-400',
    green:   'text-emerald-600 dark:text-emerald-400',
    blue:    'text-blue-600 dark:text-blue-400',
    purple:  'text-purple-600 dark:text-purple-400',
    default: 'text-foreground',
  };
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <span className={cn('opacity-70', accentClasses[accent])}>{icon}</span>
        </div>
        <p className={cn('mt-2 text-2xl font-semibold tabular-nums', accentClasses[accent])}>
          {value}
        </p>
        {subtext && <p className="mt-0.5 text-xs text-muted-foreground">{subtext}</p>}
      </CardContent>
    </Card>
  );
}

// ── Status & impact badges ─────────────────────────────────────────────────────

const STATUS_BADGE: Record<ReviewStatus, string> = {
  pending:      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  approved:     'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  kept:         'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  custom_price: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  snoozed:      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  rejected:     'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function StatusBadge({ status }: { status: ReviewStatus }) {
  const { t } = useTranslation('cost-management');

  const STATUS_LABEL: Record<ReviewStatus, string> = {
    pending:      t($ => $.priceReview.statusLabel.pending),
    approved:     t($ => $.priceReview.statusLabel.approved),
    kept:         t($ => $.priceReview.statusLabel.kept),
    custom_price: t($ => $.priceReview.statusLabel.custom),
    snoozed:      t($ => $.priceReview.statusLabel.snoozed),
    rejected:     t($ => $.priceReview.statusLabel.rejected),
  };

  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', STATUS_BADGE[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function ImpactIcons({ impacts }: { impacts: ImpactType[] }) {
  const { t } = useTranslation('cost-management');
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {impacts.includes('margin_below_target') && (
        <span title={t($ => $.priceReview.impactTitle.belowTargetMargin)}>
          <AlertTriangle className="size-3.5 text-amber-500" />
        </span>
      )}
      {impacts.includes('cost_increased') && (
        <span title={t($ => $.priceReview.impactTitle.costIncreased)}>
          <TrendingUp className="size-3.5 text-red-500" />
        </span>
      )}
      {impacts.includes('cost_decreased') && (
        <span title={t($ => $.priceReview.impactTitle.costDecreased)}>
          <TrendingDown className="size-3.5 text-emerald-500" />
        </span>
      )}
      {impacts.includes('recipe_changed') && (
        <span title={t($ => $.priceReview.impactTitle.recipeChanged)} className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded px-1 font-medium">
          {t($ => $.priceReview.impactTitle.recipeBadge)}
        </span>
      )}
    </div>
  );
}

// ── Smart policy indicator badges ─────────────────────────────────────────────

function PolicyBadge({ review }: { review: PricingReview }) {
  const { t } = useTranslation('cost-management');
  const isCustom = review.product.pricing_mode === 'custom';
  const brandMargin = review.brand?.default_target_margin;
  const belowBrand = brandMargin != null && review.current_margin < brandMargin;
  const saleMarginLow = review.sale_price != null && review.sale_price > 0
    && review.sale_price > 0
    && ((review.sale_price - review.product_cost) / review.sale_price) * 100 < 5;
  const costChanged = Math.abs(review.cost_difference ?? 0) > 0.001;

  return (
    <div className="flex flex-wrap gap-1">
      {isCustom ? (
        <Badge variant="outline" className="text-[10px] px-1 py-0 border-purple-400 text-purple-600 dark:text-purple-400">
          {t($ => $.priceReview.policy.custom)}
        </Badge>
      ) : (
        <Badge variant="outline" className="text-[10px] px-1 py-0 border-blue-400 text-blue-600 dark:text-blue-400">
          {t($ => $.priceReview.policy.brandPolicy)}
        </Badge>
      )}
      {belowBrand && (
        <Badge variant="outline" className="text-[10px] px-1 py-0 border-red-400 text-red-600 dark:text-red-400">
          {t($ => $.priceReview.policy.belowBrand)}
        </Badge>
      )}
      {saleMarginLow && (
        <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-400 text-amber-600 dark:text-amber-400">
          {t($ => $.priceReview.policy.lowSaleMargin)}
        </Badge>
      )}
      {costChanged && (
        <Badge variant="outline" className="text-[10px] px-1 py-0 border-orange-400 text-orange-600 dark:text-orange-400">
          {t($ => $.priceReview.policy.costIncreased)}
        </Badge>
      )}
    </div>
  );
}

// ── Inline price editor (popover) ─────────────────────────────────────────────

type InlinePriceEditorProps = {
  reviewId: string;
  field: keyof InlineUpdatePayload;
  currentValue: number | null | undefined;
  label: string;
  isSaving: boolean;
  onSave: (reviewId: string, payload: InlineUpdatePayload) => void;
  canEdit?: boolean;
  suffix?: string;
};

function InlinePriceEditor({
  reviewId,
  field,
  currentValue,
  label,
  isSaving,
  onSave,
  canEdit = true,
  suffix,
}: InlinePriceEditorProps) {
  const { t } = useTranslation('cost-management');
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  function handleOpen(o: boolean) {
    if (o) {
      setVal(currentValue != null ? String(+currentValue.toFixed(4)) : '');
      setTimeout(() => inputRef.current?.select(), 50);
    }
    setOpen(o);
  }

  function handleSave() {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) return;
    onSave(reviewId, { [field]: num });
    setOpen(false);
  }

  if (!canEdit) {
    return (
      <span className="tabular-nums text-sm">
        {currentValue != null ? `${fmt(currentValue)}${suffix ?? ''}` : '—'}
      </span>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="group flex items-center gap-1 tabular-nums text-sm hover:text-primary transition-colors"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Edit ${label}`}
        >
          <span>{currentValue != null ? `${+currentValue.toFixed(2)}${suffix ?? ''}` : '—'}</span>
          <Pencil className="size-3 opacity-0 group-hover:opacity-60 transition-opacity" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-3" onClick={(e) => e.stopPropagation()}>
        <p className="text-xs font-medium text-muted-foreground mb-2">{label}</p>
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            type="number"
            min="0"
            step="0.01"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="text-right tabular-nums h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') setOpen(false);
            }}
          />
          {suffix && <span className="flex items-center text-sm text-muted-foreground">{suffix}</span>}
        </div>
        <div className="flex gap-2 mt-2">
          <Button size="sm" className="h-7 flex-1" onClick={handleSave} disabled={isSaving || !val || isNaN(parseFloat(val))}>
            {isSaving ? <Loader2 className="size-3 animate-spin" /> : t($ => $.priceReview.inlineEditor.save)}
          </Button>
          <Button size="sm" variant="ghost" className="h-7" onClick={() => setOpen(false)}>
            ✕
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Pricing Strategy cell (Margin/Markup mutual exclusivity) ──────────────────

type PricingStrategyMode = 'margin' | 'markup';

function PricingStrategyCell({
  review,
  isSaving,
  onSave,
}: {
  review: PricingReview;
  isSaving: boolean;
  onSave: (reviewId: string, payload: InlineUpdatePayload) => void;
}) {
  const { t } = useTranslation('cost-management');
  const [mode, setMode] = useState<PricingStrategyMode>('margin');

  const activeField  = mode === 'margin' ? 'target_margin' : 'markup';
  const activeValue  = mode === 'margin' ? review.target_margin : review.markup;
  const activeLabel  = mode === 'margin' ? t($ => $.priceReview.pricingStrategy.targetMarginPct) : t($ => $.priceReview.pricingStrategy.markupPct);
  const derivedLabel = mode === 'margin' ? t($ => $.priceReview.pricingStrategy.markup) : t($ => $.priceReview.pricingStrategy.margin);
  const derivedValue = mode === 'margin' ? review.markup : review.target_margin;

  return (
    <div className="flex flex-col gap-0.5 min-w-[112px]">
      {/* Mode toggle — determines which field is editable */}
      <div className="flex items-center gap-0.5 mb-0.5">
        <button
          type="button"
          onClick={() => setMode('margin')}
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] transition-colors',
            mode === 'margin'
              ? 'bg-primary/15 text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t($ => $.priceReview.pricingStrategy.margin)}
        </button>
        <span className="text-muted-foreground/40 text-[10px]">|</span>
        <button
          type="button"
          onClick={() => setMode('markup')}
          className={cn(
            'rounded px-1.5 py-0.5 text-[10px] transition-colors',
            mode === 'markup'
              ? 'bg-primary/15 text-primary font-semibold'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {t($ => $.priceReview.pricingStrategy.markup)}
        </button>
      </div>
      {/* Active field — editable via pencil popover */}
      <InlinePriceEditor
        reviewId={review.id}
        field={activeField as keyof InlineUpdatePayload}
        currentValue={activeValue}
        label={activeLabel}
        isSaving={isSaving}
        onSave={onSave}
        suffix="%"
      />
      {/* Derived field — always read-only, calculated by engine */}
      <span className="text-[10px] text-muted-foreground tabular-nums">
        {derivedLabel}: {derivedValue != null ? `${(+derivedValue.toFixed(2))}%` : '—'}
      </span>
    </div>
  );
}

// ── Dialogs ───────────────────────────────────────────────────────────────────

type DialogState =
  | null
  | { type: 'custom_price';    review: PricingReview }
  | { type: 'keep_current';    review: PricingReview }
  | { type: 'reject';          review: PricingReview }
  | { type: 'snooze';          review: PricingReview }
  | { type: 'assign';          review: PricingReview }
  | { type: 'bulk_margin' }
  | { type: 'bulk_markup' }
  | { type: 'bulk_snooze' }
  | { type: 'bulk_reject' };

function CustomPriceDialog({
  review, onConfirm, onCancel, isPending,
}: {
  review: PricingReview;
  onConfirm: (price: number, reason: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const { t } = useTranslation('cost-management');
  const [price,  setPrice]  = useState(review.suggested_selling_price.toFixed(2));
  const [reason, setReason] = useState('');

  const priceNum = parseFloat(price) || 0;
  const margin   = priceNum > 0 ? ((priceNum - review.product_cost) / priceNum) * 100 : 0;
  const profit   = priceNum - review.product_cost;
  const valid    = priceNum > 0 && reason.trim().length > 0;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t($ => $.priceReview.dialog.customPrice.title)}</DialogTitle>
          <DialogDescription>{review.product.name}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div>
            <Label className="mb-1.5 block text-sm">{t($ => $.priceReview.dialog.customPrice.label)}</Label>
            <Input
              type="number" min="0" step="0.01" value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="text-right text-base tabular-nums font-semibold"
            />
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-md border p-2 text-center">
                <p className="text-muted-foreground">{t($ => $.priceReview.dialog.customPrice.margin)}</p>
                <p className={cn('font-medium', margin >= review.target_margin ? 'text-emerald-600' : 'text-red-600')}>
                  {margin.toFixed(1)}%
                </p>
              </div>
              <div className="rounded-md border p-2 text-center">
                <p className="text-muted-foreground">{t($ => $.priceReview.dialog.customPrice.profitUnit)}</p>
                <p className={cn('font-medium', profit >= 0 ? 'text-emerald-600' : 'text-red-600')}>
                  {fmt(profit)}
                </p>
              </div>
              <div className="rounded-md border p-2 text-center">
                <p className="text-muted-foreground">{t($ => $.priceReview.dialog.customPrice.target)}</p>
                <p className="font-medium">{review.target_margin.toFixed(1)}%</p>
              </div>
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">{t($ => $.priceReview.dialog.customPrice.reason)} <span className="text-destructive">*</span></Label>
            <Textarea
              value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder={t($ => $.priceReview.dialog.customPrice.reasonPlaceholder)} rows={3}
            />
          </div>
          <div className="flex gap-2 text-xs">
            {[
              { label: t($ => $.priceReview.dialog.customPrice.refCurrent),   value: review.selling_price },
              { label: t($ => $.priceReview.dialog.customPrice.refSuggested), value: review.suggested_selling_price },
            ].map((ref) => (
              <button
                key={ref.label} type="button"
                onClick={() => setPrice(ref.value.toFixed(2))}
                className="flex-1 rounded border px-2 py-1 text-center hover:bg-accent transition-colors"
              >
                <span className="text-muted-foreground">{ref.label}: </span>
                <span className="font-medium tabular-nums">{fmt(ref.value)}</span>
              </button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>{t($ => $.priceReview.dialog.cancel)}</Button>
          <Button onClick={() => onConfirm(priceNum, reason)} disabled={!valid || isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {t($ => $.priceReview.dialog.customPrice.confirm)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function KeepCurrentDialog({
  review, onConfirm, onCancel, isPending,
}: {
  review: PricingReview;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const { t } = useTranslation('cost-management');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;
  const [reason, setReason] = useState('');
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t($ => $.priceReview.dialog.keepCurrent.title)}</DialogTitle>
          <DialogDescription>{tAny('priceReview.dialog.keepCurrent.description', { name: review.product.name, price: fmt(review.selling_price) })}</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Label className="mb-1.5 block text-sm">{t($ => $.priceReview.dialog.keepCurrent.reason)} <span className="text-destructive">*</span></Label>
          <Textarea
            value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder={t($ => $.priceReview.dialog.keepCurrent.placeholder)} rows={4}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>{t($ => $.priceReview.dialog.cancel)}</Button>
          <Button onClick={() => onConfirm(reason)} disabled={!reason.trim() || isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {t($ => $.priceReview.dialog.keepCurrent.confirm)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SnoozeDialog({
  review, onConfirm, onCancel, isPending,
}: {
  review: PricingReview;
  onConfirm: (until: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const { t } = useTranslation('cost-management');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;

  const snoozePresets = [
    { label: t($ => $.priceReview.dialog.snooze.presets.tomorrow), days: 1 },
    { label: t($ => $.priceReview.dialog.snooze.presets.threeDays), days: 3 },
    { label: t($ => $.priceReview.dialog.snooze.presets.oneWeek), days: 7 },
  ];

  const [selected, setSelected] = useState<string>(addDays(3));
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t($ => $.priceReview.dialog.snooze.title)}</DialogTitle>
          <DialogDescription>{review.product.name}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="grid grid-cols-3 gap-2">
            {snoozePresets.map((p) => {
              const val = addDays(p.days);
              return (
                <button
                  key={p.label} type="button" onClick={() => setSelected(val)}
                  className={cn(
                    'rounded-md border px-3 py-2 text-sm transition-colors text-center',
                    selected === val ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-accent',
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <Separator />
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t($ => $.priceReview.dialog.snooze.custom)}</span>
            <Input
              type="date" value={selected}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => { if (e.target.value) setSelected(e.target.value); }}
              className="w-auto"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>{t($ => $.priceReview.dialog.cancel)}</Button>
          <Button onClick={() => onConfirm(selected)} disabled={!selected || isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {tAny('priceReview.dialog.snooze.confirm', { date: selected })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({
  review, onConfirm, onCancel, isPending,
}: {
  review: PricingReview;
  onConfirm: (name: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const { t } = useTranslation('cost-management');
  const [name, setName] = useState(review.reviewer?.name ?? '');
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t($ => $.priceReview.dialog.assign.title)}</DialogTitle>
          <DialogDescription>{review.product.name}</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Label className="mb-1.5 block text-sm">{t($ => $.priceReview.dialog.assign.label)} <span className="text-destructive">*</span></Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t($ => $.priceReview.dialog.assign.placeholder)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>{t($ => $.priceReview.dialog.cancel)}</Button>
          <Button onClick={() => onConfirm(name)} disabled={!name.trim() || isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {t($ => $.priceReview.dialog.assign.confirm)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkValueDialog({
  title, label, placeholder, unit,
  onConfirm, onCancel, isPending,
}: {
  title: string;
  label: string;
  placeholder: string;
  unit?: string;
  onConfirm: (value: number) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const { t } = useTranslation('cost-management');
  const [val, setVal] = useState('');
  const num = parseFloat(val);
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="py-2">
          <Label className="mb-1.5 block text-sm">{label}</Label>
          <div className="flex items-center gap-2">
            <Input
              type="number" min="0" step="0.01" value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder={placeholder}
              className="text-right tabular-nums"
            />
            {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>{t($ => $.priceReview.dialog.cancel)}</Button>
          <Button onClick={() => onConfirm(num)} disabled={isNaN(num) || num < 0 || isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {t($ => $.priceReview.dialog.applyToSelected)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkSnoozeDialog({
  onConfirm, onCancel, isPending,
}: {
  onConfirm: (until: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const { t } = useTranslation('cost-management');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;

  const snoozePresets = [
    { label: t($ => $.priceReview.dialog.snooze.presets.tomorrow), days: 1 },
    { label: t($ => $.priceReview.dialog.snooze.presets.threeDays), days: 3 },
    { label: t($ => $.priceReview.dialog.snooze.presets.oneWeek), days: 7 },
  ];

  const [selected, setSelected] = useState<string>(addDays(3));
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t($ => $.priceReview.dialog.bulkSnooze.title)}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-2">
          <div className="grid grid-cols-3 gap-2">
            {snoozePresets.map((p) => {
              const val = addDays(p.days);
              return (
                <button
                  key={p.label} type="button" onClick={() => setSelected(val)}
                  className={cn(
                    'rounded-md border px-3 py-2 text-sm transition-colors text-center',
                    selected === val ? 'border-primary bg-primary/10 font-medium' : 'hover:bg-accent',
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <Separator />
          <Input
            type="date" value={selected}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => { if (e.target.value) setSelected(e.target.value); }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>{t($ => $.priceReview.dialog.cancel)}</Button>
          <Button onClick={() => onConfirm(selected)} disabled={!selected || isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {tAny('priceReview.dialog.bulkSnooze.confirm', { date: selected })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({
  review, onConfirm, onCancel, isPending,
}: {
  review: PricingReview;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const { t } = useTranslation('cost-management');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;
  const [reason, setReason] = useState('');
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t($ => $.priceReview.dialog.reject.title)}</DialogTitle>
          <DialogDescription>{tAny('priceReview.dialog.reject.description', { name: review.product.name, price: fmt(review.selling_price) })}</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Label className="mb-1.5 block text-sm">{t($ => $.priceReview.dialog.reject.label)} <span className="text-destructive">*</span></Label>
          <Textarea
            value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder={t($ => $.priceReview.dialog.reject.placeholder)} rows={3}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {t($ => $.priceReview.dialog.reject.note)}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>{t($ => $.priceReview.dialog.cancel)}</Button>
          <Button variant="destructive" onClick={() => onConfirm(reason)} disabled={!reason.trim() || isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {t($ => $.priceReview.dialog.reject.confirm)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkRejectDialog({
  count, onConfirm, onCancel, isPending,
}: {
  count: number;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const { t } = useTranslation('cost-management');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;
  const [reason, setReason] = useState('');
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{tAny('priceReview.dialog.bulkReject.title', { count })}</DialogTitle>
          <DialogDescription>{t($ => $.priceReview.dialog.bulkReject.description)}</DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Label className="mb-1.5 block text-sm">{t($ => $.priceReview.dialog.bulkReject.reason)} <span className="text-destructive">*</span></Label>
          <Textarea
            value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder={t($ => $.priceReview.dialog.bulkReject.placeholder)} rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending}>{t($ => $.priceReview.dialog.cancel)}</Button>
          <Button variant="destructive" onClick={() => onConfirm(reason)} disabled={!reason.trim() || isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {tAny('priceReview.dialog.bulkReject.confirm', { count })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function CostPricingCenterPage() {
  const { t } = useTranslation('cost-management');
  const tAny = t as (key: string, opts?: Record<string, unknown>) => string;

  // ── Arrays that use t() must be inside the component body ─────────────────
  const STATUS_OPTIONS: { value: ReviewStatus | 'all'; label: string }[] = [
    { value: 'all',          label: t($ => $.priceReview.status.allStatuses) },
    { value: 'pending',      label: t($ => $.priceReview.status.pending) },
    { value: 'approved',     label: t($ => $.priceReview.status.approved) },
    { value: 'kept',         label: t($ => $.priceReview.status.priceKept) },
    { value: 'custom_price', label: t($ => $.priceReview.status.customPrice) },
    { value: 'snoozed',      label: t($ => $.priceReview.status.snoozed) },
    { value: 'rejected',     label: t($ => $.priceReview.status.rejected) },
  ];

  const IMPACT_OPTIONS: { value: ImpactType | 'all'; label: string }[] = [
    { value: 'all',                label: t($ => $.priceReview.impact.allImpacts) },
    { value: 'margin_below_target', label: t($ => $.priceReview.impact.belowTarget) },
    { value: 'cost_increased',     label: t($ => $.priceReview.impact.costIncreased) },
    { value: 'cost_decreased',     label: t($ => $.priceReview.impact.costDecreased) },
    { value: 'recipe_changed',     label: t($ => $.priceReview.impact.recipeChanged) },
    { value: 'packaging_changed',  label: t($ => $.priceReview.impact.packagingChanged) },
  ];

  const [query,       setQuery]       = useState<PricingReviewsQuery>({ status: 'pending', page: 1, per_page: 25 });
  const [impactFilter,setImpactFilter]= useState<ImpactType | 'all'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dialogState, setDialogState] = useState<DialogState>(null);
  const [drawerReview,setDrawerReview]= useState<PricingReview | null>(null);
  const [drawerOpen,  setDrawerOpen]  = useState(false);
  const [sortField,   setSortField]   = useState<string | null>(null);
  const [sortDir,     setSortDir]     = useState<'asc' | 'desc'>('desc');
  const [savingId,    setSavingId]    = useState<string | null>(null);

  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch, isFetching } = usePricingReviews(query);
  const approveReview  = useApproveReview();
  const snoozeReview   = useSnoozeReview();
  const publishReview  = usePublishReview();
  const assignReview   = useAssignReview();
  const bulkApprove    = useBulkApprove();
  const inlineUpdate   = useInlineUpdateReview();
  const bulkPolicy     = useBulkPolicyUpdate();

  const items   = data?.data    ?? [];
  const summary = data?.summary ?? { pending: 0, approved: 0, kept: 0, custom_price: 0, snoozed: 0, rejected: 0 };

  function removeFromCurrentList(ids: string | string[]) {
    const idSet = new Set(Array.isArray(ids) ? ids : [ids]);
    queryClient.setQueryData<PricingReviewsResult>(
      ['pricing-reviews', query],
      (old) => old ? { ...old, data: old.data.filter((r) => !idSet.has(r.id)) } : old,
    );
  }

  const belowBrandCount = items.filter((r) => {
    const brandMargin = r.brand?.default_target_margin;
    return brandMargin != null && r.current_margin < brandMargin;
  }).length;

  const allSelected  = items.length > 0 && items.every((r) => selectedIds.has(r.id));
  const someSelected = items.some((r) => selectedIds.has(r.id));

  function toggleAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map((r) => r.id)));
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleSort(field: string) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  }

  function SortIcon({ field }: { field: string }) {
    if (sortField !== field) return <ArrowUpDown className="size-3 ml-1 opacity-40" />;
    return sortDir === 'asc' ? <ChevronUp className="size-3 ml-1" /> : <ChevronDown className="size-3 ml-1" />;
  }

  function handleInlineSave(reviewId: string, payload: InlineUpdatePayload) {
    setSavingId(reviewId);
    inlineUpdate.mutate(
      { id: reviewId, payload },
      {
        onSuccess: () => toast.success(t($ => $.priceReview.toast.updated), t($ => $.priceReview.toast.updatedDesc)),
        onError:   () => toast.error(t($ => $.priceReview.toast.updateFailed)),
        onSettled: () => setSavingId(null),
      },
    );
  }

  function openDrawer(review: PricingReview) {
    setDrawerReview(review);
    setDrawerOpen(true);
  }

  function handleApprove(review: PricingReview) {
    approveReview.mutate(
      { id: review.id, payload: { action: 'approve_suggested' } },
      {
        onSuccess: () => {
          toast.success(t($ => $.priceReview.toast.approved), tAny('priceReview.toast.approvedDesc', { name: review.product.name }));
          removeFromCurrentList(review.id);
        },
      },
    );
  }

  function handleCustomPriceConfirm(review: PricingReview, price: number, reason: string) {
    approveReview.mutate(
      { id: review.id, payload: { action: 'custom_price', custom_price: price, reason } },
      {
        onSuccess: () => {
          toast.success(t($ => $.priceReview.toast.customPriceSet), `${review.product.name} → ${fmt(price)}`);
          removeFromCurrentList(review.id);
          setDialogState(null);
        },
      },
    );
  }

  function handleKeepCurrentConfirm(review: PricingReview, reason: string) {
    approveReview.mutate(
      { id: review.id, payload: { action: 'keep_current', reason } },
      {
        onSuccess: () => {
          toast.success(t($ => $.priceReview.toast.keptCurrent), review.product.name);
          removeFromCurrentList(review.id);
          setDialogState(null);
        },
      },
    );
  }

  function handleSnoozeConfirm(review: PricingReview, until: string) {
    snoozeReview.mutate(
      { id: review.id, payload: { until } },
      { onSuccess: () => { toast.success(t($ => $.priceReview.toast.snoozed), tAny('priceReview.toast.snoozedDesc', { name: review.product.name, date: until })); setDialogState(null); } },
    );
  }

  function handleAssignConfirm(review: PricingReview, name: string) {
    assignReview.mutate(
      { id: review.id, payload: { reviewer_name: name } },
      { onSuccess: () => { toast.success(t($ => $.priceReview.toast.reviewerAssigned), `${review.product.name} → ${name}`); setDialogState(null); } },
    );
  }

  function handleBulkApprove() {
    const ids = Array.from(selectedIds);
    bulkApprove.mutate(
      { ids, action: 'approve_suggested' },
      {
        onSuccess: () => {
          toast.success(t($ => $.priceReview.toast.bulkApproved), tAny('priceReview.toast.bulkApprovedDesc', { count: ids.length }));
          removeFromCurrentList(ids);
          setSelectedIds(new Set());
        },
      },
    );
  }

  function handleBulkKeep() {
    const ids = Array.from(selectedIds);
    bulkApprove.mutate(
      { ids, action: 'keep_current' },
      {
        onSuccess: () => {
          toast.success(t($ => $.priceReview.toast.keptCurrentBulk), tAny('priceReview.toast.keptCurrentBulkDesc', { count: ids.length }));
          removeFromCurrentList(ids);
          setSelectedIds(new Set());
        },
      },
    );
  }

  function handleBulkApplyBrandPolicy() {
    const ids = Array.from(selectedIds);
    bulkPolicy.mutate(
      { ids, action: 'apply_brand_policy' },
      { onSuccess: () => { toast.success(t($ => $.priceReview.toast.brandPolicyApplied), tAny('priceReview.toast.brandPolicyAppliedDesc', { count: ids.length })); setSelectedIds(new Set()); } },
    );
  }

  function handleBulkMarginConfirm(value: number) {
    const ids = Array.from(selectedIds);
    bulkPolicy.mutate(
      { ids, action: 'set_target_margin', value },
      { onSuccess: () => { toast.success(t($ => $.priceReview.toast.targetMarginSet), tAny('priceReview.toast.targetMarginSetDesc', { count: ids.length })); setSelectedIds(new Set()); setDialogState(null); } },
    );
  }

  function handleBulkMarkupConfirm(value: number) {
    const ids = Array.from(selectedIds);
    bulkPolicy.mutate(
      { ids, action: 'set_markup', value },
      { onSuccess: () => { toast.success(t($ => $.priceReview.toast.markupSet), tAny('priceReview.toast.markupSetDesc', { count: ids.length })); setSelectedIds(new Set()); setDialogState(null); } },
    );
  }

  function handleBulkSnoozeConfirm(until: string) {
    const ids = Array.from(selectedIds);
    bulkPolicy.mutate(
      { ids, action: 'snooze', snooze_until: until },
      { onSuccess: () => { toast.success(t($ => $.priceReview.toast.snoozedBulk), tAny('priceReview.toast.snoozedBulkDesc', { count: ids.length, date: until })); setSelectedIds(new Set()); setDialogState(null); } },
    );
  }

  function handleReject(review: PricingReview, reason: string) {
    approveReview.mutate(
      { id: review.id, payload: { action: 'reject', reason } },
      {
        onSuccess: () => {
          toast.success(t($ => $.priceReview.toast.reviewRejected), review.product.name);
          removeFromCurrentList(review.id);
          setDialogState(null);
        },
      },
    );
  }

  function handleBulkReject(reason: string) {
    const ids = Array.from(selectedIds);
    bulkApprove.mutate(
      { ids, action: 'reject', reason },
      {
        onSuccess: () => {
          toast.success(t($ => $.priceReview.toast.rejected), tAny('priceReview.toast.rejectedDesc', { count: ids.length }));
          removeFromCurrentList(ids);
          setSelectedIds(new Set());
          setDialogState(null);
        },
      },
    );
  }

  const filteredItems = impactFilter === 'all'
    ? items
    : items.filter((r) => r.impacts.includes(impactFilter));

  function handleExport() {
    const headers = [
      t($ => $.priceReview.exportHeaders.product),
      t($ => $.priceReview.exportHeaders.sku),
      t($ => $.priceReview.exportHeaders.brand),
      t($ => $.priceReview.exportHeaders.productCost),
      t($ => $.priceReview.exportHeaders.previousCost),
      t($ => $.priceReview.exportHeaders.changePct),
      t($ => $.priceReview.exportHeaders.targetMarginPct),
      t($ => $.priceReview.exportHeaders.markupPct),
      t($ => $.priceReview.exportHeaders.regularPrice),
      t($ => $.priceReview.exportHeaders.salePrice),
      t($ => $.priceReview.exportHeaders.suggestedRegular),
      t($ => $.priceReview.exportHeaders.suggestedSale),
      t($ => $.priceReview.exportHeaders.currentMarginPct),
      t($ => $.priceReview.exportHeaders.grossProfitPct),
      t($ => $.priceReview.exportHeaders.finalMarginPct),
      t($ => $.priceReview.exportHeaders.status),
    ];
    const rows = items.map((r) => [
      r.product.name, r.product.sku, r.brand?.name ?? '',
      r.product_cost, r.previous_product_cost,
      r.cost_change_pct != null ? r.cost_change_pct.toFixed(2) : '',
      r.target_margin.toFixed(2), r.markup.toFixed(2),
      r.selling_price, r.sale_price ?? '',
      r.suggested_selling_price, r.suggested_sale_price,
      r.current_margin.toFixed(2), r.gross_profit_pct?.toFixed(2) ?? '', r.final_margin_pct?.toFixed(2) ?? '',
      r.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `pricing-review-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Filter panel ─────────────────────────────────────────────────────────────
  const filterPanel = (
    <div className="flex flex-wrap gap-3">
      <Select
        value={query.status ?? 'all'}
        onValueChange={(v) => setQuery((q) => ({ ...q, status: v as ReviewStatus | 'all', page: 1 }))}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder={t($ => $.priceReview.status.allStatuses)} />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={impactFilter}
        onValueChange={(v) => setImpactFilter(v as ImpactType | 'all')}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder={t($ => $.priceReview.impact.allImpacts)} />
        </SelectTrigger>
        <SelectContent>
          {IMPACT_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  const colSpan = 16;

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page header */}
      <PageHeader
        title={t($ => $.priceReview.pageTitle)}
        subtitle={t($ => $.priceReview.pageSubtitle)}
        breadcrumbs={[
          { label: t($ => $.priceReview.breadcrumb.inventory), to: ROUTES.inventory },
          { label: t($ => $.priceReview.breadcrumb.pricingDecisionCenter) },
        ]}
        actions={
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-4" />
            {t($ => $.priceReview.actions.export)}
          </Button>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label={t($ => $.priceReview.kpi.pending)}
          value={summary.pending}
          icon={<AlertTriangle className="size-5" />}
          accent={summary.pending > 0 ? 'amber' : 'default'}
        />
        <KpiCard
          label={t($ => $.priceReview.kpi.approved)}
          value={summary.approved}
          icon={<CheckCircle2 className="size-5" />}
          accent={summary.approved > 0 ? 'green' : 'default'}
        />
        <KpiCard
          label={t($ => $.priceReview.kpi.priceKept)}
          value={summary.kept}
          icon={<XCircle className="size-5" />}
        />
        <KpiCard
          label={t($ => $.priceReview.kpi.customPrice)}
          value={summary.custom_price}
          icon={<TrendingUp className="size-5" />}
          accent="blue"
        />
        <KpiCard
          label={t($ => $.priceReview.kpi.snoozed)}
          value={summary.snoozed}
          icon={<TrendingDown className="size-5" />}
          accent={summary.snoozed > 0 ? 'amber' : 'default'}
        />
        <KpiCard
          label={t($ => $.priceReview.kpi.belowBrandMargin)}
          value={belowBrandCount}
          icon={<ShieldCheck className="size-5" />}
          accent={belowBrandCount > 0 ? 'red' : 'default'}
          subtext={t($ => $.priceReview.kpi.belowBrandMarginSub)}
        />
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-2 flex-wrap rounded-lg border border-primary/30 bg-primary/5 px-4 py-2">
          <span className="text-sm font-medium mr-1">{tAny('priceReview.bulk.selected', { count: selectedIds.size })}</span>
          <Separator orientation="vertical" className="h-4" />

          <Button size="sm" variant="outline" onClick={handleBulkApprove} disabled={bulkApprove.isPending}>
            {bulkApprove.isPending && <Loader2 className="size-3 animate-spin" />}
            <CheckCircle2 className="size-3.5" />
            {t($ => $.priceReview.bulk.approveSuggested)}
          </Button>
          <Button size="sm" variant="outline" onClick={handleBulkKeep} disabled={bulkApprove.isPending}>
            {t($ => $.priceReview.bulk.keepPrices)}
          </Button>
          <Button
            size="sm" variant="outline"
            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30"
            onClick={() => setDialogState({ type: 'bulk_reject' })} disabled={bulkApprove.isPending}
          >
            <X className="size-3.5" />
            {t($ => $.priceReview.bulk.reject)}
          </Button>
          <Button size="sm" variant="outline" onClick={handleBulkApplyBrandPolicy} disabled={bulkPolicy.isPending}>
            <ShieldCheck className="size-3.5" />
            {t($ => $.priceReview.bulk.applyBrandPolicy)}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDialogState({ type: 'bulk_margin' })} disabled={bulkPolicy.isPending}>
            {t($ => $.priceReview.bulk.setTargetMargin)}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDialogState({ type: 'bulk_markup' })} disabled={bulkPolicy.isPending}>
            {t($ => $.priceReview.bulk.setMarkup)}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDialogState({ type: 'bulk_snooze' })} disabled={bulkPolicy.isPending}>
            {t($ => $.priceReview.bulk.snooze)}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            {t($ => $.priceReview.bulk.clear)}
          </Button>
        </div>
      )}

      {/* Toolbar */}
      <EntityToolbar
        searchPlaceholder={t($ => $.priceReview.search)}
        onSearchChange={(s) => setQuery((q) => ({ ...q, search: s || undefined, page: 1 }))}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        filterPanel={filterPanel}
        onClearFilters={() => { setQuery({ status: 'all', page: 1, per_page: 25 }); setImpactFilter('all'); }}
      />

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1600px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox" checked={allSelected} onChange={toggleAll}
                    aria-label="Select all" className="size-4 cursor-pointer rounded accent-primary"
                  />
                </th>
                <th className="px-3 py-3">
                  <button type="button" className="flex items-center" onClick={() => handleSort('product')}>
                    {t($ => $.priceReview.columns.product)} <SortIcon field="product" />
                  </button>
                </th>
                <th className="px-3 py-3">{t($ => $.priceReview.columns.brand)}</th>
                <th className="px-3 py-3">
                  <button type="button" className="flex items-center" onClick={() => handleSort('product_cost')}>
                    {t($ => $.priceReview.columns.productCost)} <SortIcon field="product_cost" />
                  </button>
                </th>
                <th className="px-3 py-3">{t($ => $.priceReview.columns.pricingStrategy)}</th>
                <th className="px-3 py-3">{t($ => $.priceReview.columns.regularPrice)}</th>
                <th className="px-3 py-3">{t($ => $.priceReview.columns.salePrice)}</th>
                <th className="px-3 py-3">{t($ => $.priceReview.columns.suggestedRegular)}</th>
                <th className="px-3 py-3">{t($ => $.priceReview.columns.suggestedSale)}</th>
                <th className="px-3 py-3">
                  <button type="button" className="flex items-center" onClick={() => handleSort('gross_profit_pct')}>
                    {t($ => $.priceReview.columns.grossProfit)} <SortIcon field="gross_profit_pct" />
                  </button>
                </th>
                <th className="px-3 py-3">
                  <button type="button" className="flex items-center" onClick={() => handleSort('final_margin_pct')}>
                    {t($ => $.priceReview.columns.finalMargin)} <SortIcon field="final_margin_pct" />
                  </button>
                </th>
                <th className="px-3 py-3">{t($ => $.priceReview.columns.impacts)}</th>
                <th className="px-3 py-3">{t($ => $.priceReview.columns.policy)}</th>
                <th className="px-3 py-3">{t($ => $.priceReview.columns.status)}</th>
                <th className="px-3 py-3">{t($ => $.priceReview.columns.updated)}</th>
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={colSpan} className="py-16 text-center">
                    <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={colSpan} className="py-12 text-center text-muted-foreground">
                    {t($ => $.priceReview.table.failedToLoad)}
                    <Button variant="link" size="sm" onClick={() => refetch()}>{t($ => $.priceReview.table.retry)}</Button>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="py-16 text-center">
                    <CheckCircle2 className="size-8 mx-auto mb-2 text-emerald-500" />
                    <p className="text-sm text-muted-foreground">{t($ => $.priceReview.table.noReviews)}</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((review) => {
                  const belowTarget = review.current_margin < review.target_margin;
                  const isSaving    = savingId === review.id;

                  return (
                    <tr
                      key={review.id}
                      className={cn(
                        'hover:bg-muted/30 transition-colors',
                        selectedIds.has(review.id) && 'bg-primary/5',
                      )}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3">
                        <input
                          type="checkbox" checked={selectedIds.has(review.id)} onChange={() => toggleOne(review.id)}
                          aria-label={`Select ${review.product.name}`}
                          className="size-4 cursor-pointer rounded accent-primary"
                        />
                      </td>

                      {/* Product */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {getMediaUrl(review.product.image_url) && (
                            <img
                              src={getMediaUrl(review.product.image_url)!}
                              alt="" className="size-7 rounded object-cover flex-shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[140px]">{review.product.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{review.product.sku}</p>
                          </div>
                        </div>
                      </td>

                      {/* Brand */}
                      <td className="px-3 py-3">
                        {review.brand ? (
                          <div>
                            <p className="text-sm font-medium truncate max-w-[100px]">{review.brand.name}</p>
                            {review.brand.default_target_margin != null && (
                              <p className="text-[11px] text-muted-foreground">
                                {tAny('priceReview.brandInfo.margin', { value: review.brand.default_target_margin.toFixed(0) })}
                                {review.brand.default_discount_pct != null && (
                                  <span> · {tAny('priceReview.brandInfo.discount', { value: review.brand.default_discount_pct.toFixed(0) })}</span>
                                )}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>

                      {/* Product Cost */}
                      <td className="px-3 py-3 tabular-nums font-medium">
                        <div>
                          <span>{fmt(review.product_cost)}</span>
                          {review.cost_change_pct != null && review.cost_change_pct !== 0 && (
                            <span className={cn(
                              'ml-1 text-[10px]',
                              review.cost_change_pct > 0 ? 'text-red-500' : 'text-emerald-500',
                            )}>
                              {review.cost_change_pct > 0 ? '+' : ''}{review.cost_change_pct.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Pricing Strategy */}
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-0.5">
                          <PricingStrategyCell
                            review={review}
                            isSaving={isSaving}
                            onSave={handleInlineSave}
                          />
                          <span className={cn('text-[10px]', belowTarget ? 'text-red-500' : 'text-emerald-500')}>
                            {tAny('priceReview.pricingStrategy.actual', { value: fmtPct(review.current_margin) })}
                          </span>
                        </div>
                      </td>

                      {/* Regular Price */}
                      <td className="px-3 py-3">
                        <InlinePriceEditor
                          reviewId={review.id}
                          field="regular_price"
                          currentValue={review.selling_price}
                          label={t($ => $.priceReview.columns.regularPrice)}
                          isSaving={isSaving}
                          onSave={handleInlineSave}
                        />
                      </td>

                      {/* Sale Price */}
                      <td className="px-3 py-3">
                        <InlinePriceEditor
                          reviewId={review.id}
                          field="sale_price"
                          currentValue={review.sale_price}
                          label={t($ => $.priceReview.columns.salePrice)}
                          isSaving={isSaving}
                          onSave={handleInlineSave}
                        />
                      </td>

                      {/* Suggested Regular */}
                      <td className="px-3 py-3 tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                        {fmt(review.suggested_selling_price)}
                      </td>

                      {/* Suggested Sale */}
                      <td className="px-3 py-3 tabular-nums text-muted-foreground">
                        {fmt(review.suggested_sale_price)}
                      </td>

                      {/* Gross Profit % */}
                      <td className="px-3 py-3">
                        {review.gross_profit_pct != null ? (
                          <span className={cn(
                            'tabular-nums font-medium',
                            review.gross_profit_pct >= review.target_margin ? 'text-emerald-600' : 'text-red-600',
                          )}>
                            {fmtPct(review.gross_profit_pct)}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>

                      {/* Final Margin % */}
                      <td className="px-3 py-3">
                        {review.final_margin_pct != null ? (
                          <span className={cn(
                            'tabular-nums font-medium',
                            review.final_margin_pct >= review.target_margin ? 'text-emerald-600' : 'text-amber-600',
                          )}>
                            {fmtPct(review.final_margin_pct)}
                          </span>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>

                      {/* Impacts */}
                      <td className="px-3 py-3">
                        <ImpactIcons impacts={review.impacts} />
                        <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[100px] truncate">
                          {impactReasons(t, review.impacts)}
                        </p>
                      </td>

                      {/* Policy badges */}
                      <td className="px-3 py-3">
                        <PolicyBadge review={review} />
                      </td>

                      {/* Status */}
                      <td className="px-3 py-3">
                        <StatusBadge status={review.status} />
                        {review.publish_status === 'pending_publish' && (
                          <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium mt-0.5 flex items-center gap-0.5">
                            <Upload className="size-2.5" />
                            {t($ => $.priceReview.statusBadge.pendingPublish)}
                          </p>
                        )}
                        {review.snooze_until && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{tAny('priceReview.statusBadge.until', { date: review.snooze_until })}</p>
                        )}
                      </td>

                      {/* Updated */}
                      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(review.updated_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-0.5">
                          {(review.status === 'pending' || review.status === 'snoozed') && (
                            <>
                              <Button
                                size="icon" variant="ghost"
                                className="size-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                title={t($ => $.priceReview.actions.approveSuggestedTitle)}
                                onClick={() => handleApprove(review)}
                                disabled={approveReview.isPending}
                              >
                                <CheckCircle2 className="size-3.5" />
                              </Button>
                              <Button
                                size="icon" variant="ghost"
                                className="size-7 hover:bg-muted"
                                title={t($ => $.priceReview.actions.keepCurrentPriceTitle)}
                                onClick={() => setDialogState({ type: 'keep_current', review })}
                              >
                                <Minus className="size-3.5" />
                              </Button>
                              <Button
                                size="icon" variant="ghost"
                                className="size-7 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                title={t($ => $.priceReview.actions.rejectReviewTitle)}
                                onClick={() => setDialogState({ type: 'reject', review })}
                              >
                                <X className="size-3.5" />
                              </Button>
                              <Button
                                size="icon" variant="ghost"
                                className="size-7 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                title={t($ => $.priceReview.actions.snoozeReviewTitle)}
                                onClick={() => setDialogState({ type: 'snooze', review })}
                              >
                                <Clock className="size-3.5" />
                              </Button>
                            </>
                          )}
                          {review.publish_status === 'pending_publish' && (
                            <Button
                              size="icon" variant="ghost"
                              className="size-7 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                              title={t($ => $.priceReview.actions.publishPricesToCatalogTitle)}
                              onClick={() => publishReview.mutate(review.id, {
                                onSuccess: () => toast.success(t($ => $.priceReview.toast.published), tAny('priceReview.toast.publishedDesc', { name: review.product.name })),
                              })}
                              disabled={publishReview.isPending}
                            >
                              <Upload className="size-3.5" />
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7">
                                <MoreHorizontal className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openDrawer(review)}>
                                <ExternalLink className="size-4" />
                                {t($ => $.priceReview.actions.viewCostAnalysis)}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setDialogState({ type: 'custom_price', review })}>
                                {t($ => $.priceReview.actions.setCustomPrice)}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() =>
                                handleInlineSave(review.id, { pricing_mode: review.product.pricing_mode === 'custom' ? 'brand_policy' : 'custom' })
                              }>
                                <ShieldCheck className="size-4" />
                                {review.product.pricing_mode === 'custom' ? t($ => $.priceReview.actions.revertToBrandPolicy) : t($ => $.priceReview.actions.switchToCustomPolicy)}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setDialogState({ type: 'assign', review })}>
                                <UserPlus className="size-4" />
                                {t($ => $.priceReview.actions.assignReviewer)}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {data && (data.pagination?.total ?? 0) > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
            <span>
              {tAny('priceReview.pagination.summary', { total: data.pagination.total, currentPage: data.pagination.current_page, lastPage: data.pagination.last_page })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                disabled={data.pagination.current_page <= 1}
                onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) - 1 }))}
              >
                {t($ => $.priceReview.pagination.previous)}
              </Button>
              <Button
                variant="outline" size="sm"
                disabled={data.pagination.current_page >= data.pagination.last_page}
                onClick={() => setQuery((q) => ({ ...q, page: (q.page ?? 1) + 1 }))}
              >
                {t($ => $.priceReview.pagination.next)}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Single-review dialogs */}
      {dialogState?.type === 'custom_price' && (
        <CustomPriceDialog
          review={dialogState.review}
          onConfirm={(price, reason) => handleCustomPriceConfirm(dialogState.review, price, reason)}
          onCancel={() => setDialogState(null)}
          isPending={approveReview.isPending}
        />
      )}
      {dialogState?.type === 'keep_current' && (
        <KeepCurrentDialog
          review={dialogState.review}
          onConfirm={(reason) => handleKeepCurrentConfirm(dialogState.review, reason)}
          onCancel={() => setDialogState(null)}
          isPending={approveReview.isPending}
        />
      )}
      {dialogState?.type === 'reject' && (
        <RejectDialog
          review={dialogState.review}
          onConfirm={(reason) => handleReject(dialogState.review, reason)}
          onCancel={() => setDialogState(null)}
          isPending={approveReview.isPending}
        />
      )}
      {dialogState?.type === 'snooze' && (
        <SnoozeDialog
          review={dialogState.review}
          onConfirm={(until) => handleSnoozeConfirm(dialogState.review, until)}
          onCancel={() => setDialogState(null)}
          isPending={snoozeReview.isPending}
        />
      )}
      {dialogState?.type === 'assign' && (
        <AssignDialog
          review={dialogState.review}
          onConfirm={(name) => handleAssignConfirm(dialogState.review, name)}
          onCancel={() => setDialogState(null)}
          isPending={assignReview.isPending}
        />
      )}

      {/* Bulk dialogs */}
      {dialogState?.type === 'bulk_margin' && (
        <BulkValueDialog
          title={t($ => $.priceReview.dialog.bulkMargin.title)}
          label={t($ => $.priceReview.dialog.bulkMargin.label)}
          placeholder={t($ => $.priceReview.dialog.bulkMargin.placeholder)}
          unit="%"
          onConfirm={handleBulkMarginConfirm}
          onCancel={() => setDialogState(null)}
          isPending={bulkPolicy.isPending}
        />
      )}
      {dialogState?.type === 'bulk_markup' && (
        <BulkValueDialog
          title={t($ => $.priceReview.dialog.bulkMarkup.title)}
          label={t($ => $.priceReview.dialog.bulkMarkup.label)}
          placeholder={t($ => $.priceReview.dialog.bulkMarkup.placeholder)}
          unit="%"
          onConfirm={handleBulkMarkupConfirm}
          onCancel={() => setDialogState(null)}
          isPending={bulkPolicy.isPending}
        />
      )}
      {dialogState?.type === 'bulk_snooze' && (
        <BulkSnoozeDialog
          onConfirm={handleBulkSnoozeConfirm}
          onCancel={() => setDialogState(null)}
          isPending={bulkPolicy.isPending}
        />
      )}
      {dialogState?.type === 'bulk_reject' && (
        <BulkRejectDialog
          count={selectedIds.size}
          onConfirm={handleBulkReject}
          onCancel={() => setDialogState(null)}
          isPending={bulkApprove.isPending}
        />
      )}

      {/* Product cost drawer */}
      <ProductCostDrawer
        review={drawerReview}
        open={drawerOpen}
        onOpenChange={(o) => { setDrawerOpen(o); if (!o) setDrawerReview(null); }}
      />
    </div>
  );
}
