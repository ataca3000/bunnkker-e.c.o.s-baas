import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Ban,
  CheckCircle,
  Clock,
  FileCheck2,
  Loader2,
  MapPin,
  RotateCcw,
  ShieldCheck,
  Undo2,
  Wallet,
  XCircle,
} from 'lucide-react';

import { PageDrawer } from '@/components/page/drawer/page-drawer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/ecos-select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ds/use-toast';

import {
  useCancelDelivery,
  useDelivery,
  useDeliveryOptions,
  useDeliveryTimeline,
  useFailAttempt,
  useMarkAddressCorrected,
  useRetryDelivery,
  useValidatePod,
} from '../hooks/use-deliveries';
import { usePermission } from '@/features/authorization';

import { useFlagReturnDiscrepancy, useWriteOffCod } from '../hooks/use-deliveries';
import type { DeliveryAttempt, DeliveryReturn, ProofOfDelivery } from '../types/delivery';
import { DeliveryStatusBadge } from './delivery-status-badge';

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────

function Overview({ deliveryId }: { deliveryId: string }) {
  const { t } = useTranslation('logistics');
  const { data: delivery } = useDelivery(deliveryId);
  const retry = useRetryDelivery();
  const addressCorrected = useMarkAddressCorrected();
  const cancel = useCancelDelivery();
  const { toast } = useToast();
  const [cancelReason, setCancelReason] = useState('');

  if (!delivery) return <Skeleton className="h-64 w-full" />;

  const cod = delivery.cod_record;

  async function run(fn: () => Promise<unknown>, success: string) {
    try {
      await fn();
      toast({ title: success });
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
        t($ => $.delivery.errors.actionFailed);
      toast({
        title: t($ => $.delivery.errors.actionRefused),
        description: message,
        variant: 'destructive',
      });
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label={t($ => $.common.status)}>
          <DeliveryStatusBadge status={delivery.status} />
        </Field>
        <Field label={t($ => $.delivery.field.order)}>
          <span className="font-mono text-xs">{delivery.order_id}</span>
        </Field>
        <Field label={t($ => $.delivery.field.attempts)}>
          {t($ => $.delivery.overview.attemptsOf, {
            used: delivery.attempt_count,
            max: delivery.max_attempts,
          })}
          <span className="ms-1 text-xs text-muted-foreground">
            {t($ => $.delivery.overview.attemptsLeft, { remaining: delivery.remaining_attempts })}
          </span>
        </Field>
        <Field label={t($ => $.delivery.field.promised)}>{formatDateTime(delivery.promised_at)}</Field>
        <Field label={t($ => $.delivery.status.delivered)}>{formatDateTime(delivery.delivered_at)}</Field>
        <Field label={t($ => $.delivery.field.escalationLevel)}>{delivery.escalation_level}</Field>
      </div>

      {delivery.sla_breached && (
        <Alert variant="destructive">
          <Clock className="size-4" />
          <AlertDescription>
            {delivery.minutes_late !== null
              ? t($ => $.delivery.alert.slaBreachedBy, { minutes: delivery.minutes_late })
              : t($ => $.delivery.alert.slaBreached)}
          </AlertDescription>
        </Alert>
      )}

      {delivery.requires_manual_review && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertDescription>{t($ => $.delivery.alert.manualReview)}</AlertDescription>
        </Alert>
      )}

      {/* COD is a completion report. Settlement lives in Distribution. */}
      {cod && (
        <div className="rounded-lg border p-3">
          <div className="mb-2 flex items-center gap-2">
            <Wallet className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">{t($ => $.delivery.cod.title)}</span>
            <Badge variant="outline" className="text-xs">
              {cod.status_label}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t($ => $.delivery.cod.due)}>
              {cod.amount_due.toLocaleString()} {cod.currency}
            </Field>
            <Field label={t($ => $.delivery.cod.collected)}>
              {cod.amount_collected.toLocaleString()} {cod.currency}
            </Field>
            <Field label={t($ => $.delivery.cod.shortfall)}>
              {cod.shortfall > 0 ? (
                <span className="text-destructive">
                  {cod.shortfall.toLocaleString()} {cod.currency}
                </span>
              ) : (
                '—'
              )}
            </Field>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{t($ => $.delivery.cod.note)}</p>
          <CodWriteOff deliveryId={delivery.id} shortfall={cod.shortfall} />
        </div>
      )}

      <Separator />

      <div className="space-y-2">
        <p className="text-sm font-medium">{t($ => $.delivery.retry.title)}</p>
        {delivery.can_retry ? (
          <p className="text-xs text-muted-foreground">{t($ => $.delivery.retry.eligible)}</p>
        ) : (
          <ul className="space-y-1">
            {delivery.retry_blockers.map((blocker) => (
              <li key={blocker} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <XCircle className="mt-0.5 size-3 shrink-0 text-destructive" />
                {blocker}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            size="sm"
            className="gap-1.5"
            disabled={!delivery.can_retry || retry.isPending}
            onClick={() =>
              run(() => retry.mutateAsync(delivery.id), t($ => $.delivery.toast.retryScheduled))
            }
          >
            {retry.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
            {t($ => $.delivery.retry.schedule)}
          </Button>

          {delivery.requires_address_correction && !delivery.address_corrected_at && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={addressCorrected.isPending}
              onClick={() =>
                run(
                  () => addressCorrected.mutateAsync(delivery.id),
                  t($ => $.delivery.toast.addressCorrected),
                )
              }
            >
              <MapPin className="size-3.5" />
              {t($ => $.delivery.action.markAddressCorrected)}
            </Button>
          )}
        </div>
      </div>

      {!delivery.is_terminal && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="cancel-reason" className="text-sm font-medium">
              {t($ => $.delivery.cancel.title)}
            </Label>
            <Textarea
              id="cancel-reason"
              rows={2}
              placeholder={t($ => $.delivery.cancel.reasonPlaceholder)}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5"
              disabled={cancel.isPending}
              onClick={() =>
                run(
                  () => cancel.mutateAsync({ id: delivery.id, reason: cancelReason || undefined }),
                  t($ => $.delivery.toast.cancelled),
                )
              }
            >
              <Ban className="size-3.5" />
              {t($ => $.delivery.cancel.title)}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Attempts ─────────────────────────────────────────────────────────────────

function PodSummary({
  deliveryId,
  attempt,
  pod,
}: {
  deliveryId: string;
  attempt: DeliveryAttempt;
  pod: ProofOfDelivery;
}) {
  const { t } = useTranslation('logistics');
  const validate = useValidatePod();
  const { toast } = useToast();
  const missing = pod.missing_artifacts ?? [];

  return (
    <div className="mt-2 rounded-md border bg-muted/30 p-2">
      <div className="flex items-center gap-2">
        <FileCheck2 className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">{t($ => $.delivery.pod.title)}</span>
        <Badge variant="outline" className="text-[10px]">
          {pod.status_label}
        </Badge>
      </div>

      <div className="mt-1.5 flex flex-wrap gap-1">
        {(pod.artifacts ?? []).map((artifact) => (
          <Badge key={artifact.id} variant="secondary" className="text-[10px]">
            {artifact.kind_label}
          </Badge>
        ))}
      </div>

      {missing.length > 0 && (
        <p className="mt-1.5 text-[11px] text-destructive">
          {t($ => $.delivery.pod.missing, { list: missing.join(', ') })}
        </p>
      )}

      {!pod.is_validated && (
        <Button
          size="sm"
          variant="outline"
          className="mt-2 h-7 gap-1.5 text-xs"
          disabled={missing.length > 0 || validate.isPending}
          onClick={async () => {
            try {
              await validate.mutateAsync({ id: deliveryId, attemptId: attempt.id });
              toast({ title: t($ => $.delivery.toast.podValidated) });
            } catch (error) {
              const message =
                (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
                t($ => $.delivery.errors.podValidationFailed);
              toast({
                title: t($ => $.delivery.errors.validationRefused),
                description: message,
                variant: 'destructive',
              });
            }
          }}
        >
          <ShieldCheck className="size-3.5" />
          {t($ => $.delivery.pod.validate)}
        </Button>
      )}
    </div>
  );
}

function Attempts({ deliveryId }: { deliveryId: string }) {
  const { t } = useTranslation('logistics');
  const { data: delivery } = useDelivery(deliveryId);
  const { data: options } = useDeliveryOptions();
  const fail = useFailAttempt();
  const { toast } = useToast();
  const [reasonCode, setReasonCode] = useState('');

  if (!delivery) return <Skeleton className="h-64 w-full" />;

  const attempts = delivery.attempts ?? [];
  const openAttempt = attempts.find((a) => a.is_open);

  return (
    <div className="space-y-4">
      {attempts.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t($ => $.delivery.attempts.empty)}
        </p>
      )}

      {attempts.map((attempt) => (
        <div key={attempt.id} className="rounded-lg border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {t($ => $.delivery.attempts.attemptNo, { no: attempt.attempt_no })}
              </span>
              <Badge variant={attempt.is_open ? 'default' : 'secondary'} className="text-[10px]">
                {attempt.status_label}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              {formatDateTime(attempt.closed_at ?? attempt.started_at ?? attempt.created_at)}
            </span>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-3">
            <Field label={t($ => $.delivery.field.arrived)}>{formatDateTime(attempt.arrived_at)}</Field>
            <Field label={t($ => $.delivery.field.dwell)}>
              {attempt.dwell_minutes !== null
                ? t($ => $.delivery.attempts.dwellMinutes, { minutes: attempt.dwell_minutes })
                : '—'}
            </Field>
            <Field label={t($ => $.delivery.field.stop)}>{attempt.stop_id ?? '—'}</Field>
          </div>

          {attempt.failure && (
            <Alert variant="destructive" className="mt-2 py-2">
              <XCircle className="size-4" />
              <AlertDescription className="text-xs">
                <span className="font-medium">{attempt.failure.reason_label}</span>
                {' · '}
                {attempt.failure.category_label}
                {' · '}
                {attempt.failure.is_retryable
                  ? t($ => $.delivery.failure.retryable)
                  : t($ => $.delivery.failure.notRetryable)}
                {attempt.failure.description && <span className="block">{attempt.failure.description}</span>}
              </AlertDescription>
            </Alert>
          )}

          {attempt.pod && <PodSummary deliveryId={deliveryId} attempt={attempt} pod={attempt.pod} />}
        </div>
      ))}

      {openAttempt && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t($ => $.delivery.failure.recordTitle)}</Label>
            <p className="text-xs text-muted-foreground">{t($ => $.delivery.failure.recordHint)}</p>
            <Select value={reasonCode} onValueChange={setReasonCode}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder={t($ => $.delivery.failure.selectReason)} />
              </SelectTrigger>
              <SelectContent>
                {(options?.failure_reasons ?? []).map((reason) => (
                  <SelectItem key={reason.value} value={reason.value}>
                    {reason.label} ·{' '}
                    {reason.is_retryable
                      ? t($ => $.delivery.failure.retryable)
                      : t($ => $.delivery.failure.final)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="destructive"
              className="gap-1.5"
              disabled={!reasonCode || fail.isPending}
              onClick={async () => {
                try {
                  await fail.mutateAsync({
                    id: deliveryId,
                    attemptId: openAttempt.id,
                    payload: { reason_code: reasonCode },
                  });
                  setReasonCode('');
                  toast({ title: t($ => $.delivery.toast.failureRecorded) });
                } catch (error) {
                  const message =
                    (error as { response?: { data?: { message?: string } } }).response?.data?.message ??
                    t($ => $.delivery.errors.failureRecordFailed);
                  toast({
                    title: t($ => $.delivery.errors.actionRefused),
                    description: message,
                    variant: 'destructive',
                  });
                }
              }}
            >
              <XCircle className="size-3.5" />
              {t($ => $.delivery.failure.recordButton)}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Returns ──────────────────────────────────────────────────────────────────


/**
 * Writing off uncollected COD.
 *
 * Offered only when there is a shortfall — writing off nothing is not a
 * decision anyone needs to record. The reason is required by the API and is
 * required here too: it is the audit trail for money the business has chosen
 * not to pursue.
 */
function CodWriteOff({ deliveryId, shortfall }: { deliveryId: string; shortfall: number }) {
  const { t } = useTranslation('logistics');
  const { can } = usePermission();
  const writeOff = useWriteOffCod();

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (shortfall <= 0 || !can('delivery.cod.verify')) return null;

  async function submit() {
    if (!reason.trim()) {
      setError(t($ => $.delivery.completion.reasonRequired));
      return;
    }
    setError(null);
    try {
      await writeOff.mutateAsync({ id: deliveryId, reason: reason.trim() });
      setReason('');
      setOpen(false);
    } catch {
      setError(t($ => $.delivery.completion.writeOffFailed));
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {!open ? (
        <Button size="sm" variant="outline" className="self-start" onClick={() => setOpen(true)}>
          {t($ => $.delivery.completion.writeOff)}
        </Button>
      ) : (
        <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-2">
          <p className="text-xs text-muted-foreground">
            {t($ => $.delivery.completion.writeOffDescription)}
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Input
            value={reason}
            maxLength={1000}
            placeholder={t($ => $.delivery.completion.writeOffReason)}
            onChange={(e) => setReason(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={writeOff.isPending}
              onClick={() => void submit()}
            >
              {t($ => $.delivery.completion.writeOff)}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)}>
              {t($ => $.delivery.completion.cancel)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Flagging a discrepancy on a return.
 *
 * Hidden once the domain already records one: re-flagging an acknowledged
 * discrepancy adds nothing and would suggest the first flag had not taken.
 */
function ReturnDiscrepancyControl({
  deliveryId,
  returnId,
  hasDiscrepancy,
}: {
  deliveryId: string;
  returnId: string;
  hasDiscrepancy: boolean;
}) {
  const { t } = useTranslation('logistics');
  const { can } = usePermission();
  const flag = useFlagReturnDiscrepancy();

  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (hasDiscrepancy || !can('delivery.return.manage')) return null;

  async function submit() {
    setError(null);
    try {
      await flag.mutateAsync({ id: deliveryId, returnId, notes: notes.trim() || undefined });
      setNotes('');
      setOpen(false);
    } catch {
      setError(t($ => $.delivery.completion.flagFailed));
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {!open ? (
        <Button size="sm" variant="ghost" className="h-7 self-start text-xs" onClick={() => setOpen(true)}>
          {t($ => $.delivery.completion.flagDiscrepancy)}
        </Button>
      ) : (
        <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-2">
          <p className="text-xs text-muted-foreground">
            {t($ => $.delivery.completion.flagDiscrepancyDescription)}
          </p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Input
            value={notes}
            maxLength={2000}
            placeholder={t($ => $.delivery.completion.discrepancyNotes)}
            onChange={(e) => setNotes(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={flag.isPending}
              onClick={() => void submit()}
            >
              {t($ => $.delivery.completion.flagDiscrepancy)}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)}>
              {t($ => $.delivery.completion.cancel)}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReturnCard({
  deliveryReturn,
  deliveryId,
}: {
  deliveryReturn: DeliveryReturn;
  deliveryId: string;
}) {
  const { t } = useTranslation('logistics');

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Undo2 className="size-3.5 text-muted-foreground" />
          <span className="text-sm font-medium">{deliveryReturn.status_label}</span>
          {deliveryReturn.has_discrepancy && (
            <Badge variant="destructive" className="text-[10px]">
              {t($ => $.delivery.returns.discrepancy)}
            </Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDateTime(deliveryReturn.initiated_at)}
        </span>
      </div>

      {deliveryReturn.reason && (
        <p className="mt-1 text-xs text-muted-foreground">{deliveryReturn.reason}</p>
      )}

      <table className="mt-2 w-full text-xs">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="py-1 text-start font-normal">{t($ => $.delivery.returns.colProduct)}</th>
            <th className="py-1 text-end font-normal">{t($ => $.delivery.returns.colReturned)}</th>
            <th className="py-1 text-end font-normal">{t($ => $.delivery.returns.colCounted)}</th>
            <th className="py-1 text-end font-normal">{t($ => $.delivery.returns.colDifference)}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {(deliveryReturn.lines ?? []).map((line) => (
            <tr key={line.id}>
              <td className="py-1">{line.product_name ?? '—'}</td>
              <td className="py-1 text-end tabular-nums">{line.returned_qty}</td>
              <td className="py-1 text-end tabular-nums">
                {line.warehouse_confirmed_qty ?? '—'}
              </td>
              <td
                className={`py-1 text-end tabular-nums ${
                  line.has_discrepancy ? 'text-destructive' : ''
                }`}
              >
                {line.discrepancy_qty ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ReturnDiscrepancyControl
        deliveryId={deliveryId}
        returnId={deliveryReturn.id}
        hasDiscrepancy={deliveryReturn.has_discrepancy}
      />
    </div>
  );
}

function Returns({ deliveryId }: { deliveryId: string }) {
  const { t } = useTranslation('logistics');
  const { data: delivery } = useDelivery(deliveryId);

  if (!delivery) return <Skeleton className="h-48 w-full" />;

  const returns = delivery.returns ?? [];

  if (returns.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t($ => $.delivery.returns.empty)}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {returns.map((item) => (
        <ReturnCard key={item.id} deliveryReturn={item} deliveryId={delivery.id} />
      ))}
    </div>
  );
}

// ── Timeline ─────────────────────────────────────────────────────────────────

function Timeline({ deliveryId }: { deliveryId: string }) {
  const { t } = useTranslation('logistics');
  const { data: events, isLoading } = useDeliveryTimeline(deliveryId);

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (!events || events.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {t($ => $.delivery.timeline.empty)}
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li key={event.id} className="flex gap-3">
          <div className="mt-1 flex flex-col items-center">
            <CheckCircle className="size-3.5 text-muted-foreground" />
            <span className="mt-1 w-px flex-1 bg-border" />
          </div>
          <div className="flex-1 pb-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{event.title}</span>
              {event.customer_visible && (
                <Badge variant="outline" className="text-[10px]">
                  {t($ => $.delivery.timeline.customerVisible)}
                </Badge>
              )}
            </div>
            {event.description && (
              <p className="text-xs text-muted-foreground">{event.description}</p>
            )}
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {formatDateTime(event.occurred_at)}
              {event.actor_name && ` · ${event.actor_name}`}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

// ── Drawer ───────────────────────────────────────────────────────────────────

export function DeliveryDrawer({
  deliveryId,
  open,
  onOpenChange,
}: {
  deliveryId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('logistics');
  const { data: delivery } = useDelivery(open ? deliveryId : null);

  return (
    <PageDrawer
      open={open}
      onOpenChange={onOpenChange}
      size="2xl"
      title={
        delivery
          ? t($ => $.delivery.drawer.titleWithOrder, { order: delivery.order_id })
          : t($ => $.delivery.entity)
      }
      description={
        delivery
          ? t($ => $.delivery.drawer.attemptsUsed, {
              used: delivery.attempt_count,
              max: delivery.max_attempts,
            })
          : undefined
      }
    >
      {!deliveryId ? null : (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">{t($ => $.common.overview)}</TabsTrigger>
            <TabsTrigger value="attempts">
              {t($ => $.delivery.field.attempts)}
              {delivery?.attempts_count ? ` (${delivery.attempts_count})` : ''}
            </TabsTrigger>
            <TabsTrigger value="returns">
              {t($ => $.delivery.returns.title)}
              {delivery?.returns_count ? ` (${delivery.returns_count})` : ''}
            </TabsTrigger>
            <TabsTrigger value="timeline">{t($ => $.common.timeline)}</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="pt-4">
            <Overview deliveryId={deliveryId} />
          </TabsContent>
          <TabsContent value="attempts" className="pt-4">
            <Attempts deliveryId={deliveryId} />
          </TabsContent>
          <TabsContent value="returns" className="pt-4">
            <Returns deliveryId={deliveryId} />
          </TabsContent>
          <TabsContent value="timeline" className="pt-4">
            <Timeline deliveryId={deliveryId} />
          </TabsContent>
        </Tabs>
      )}
    </PageDrawer>
  );
}
