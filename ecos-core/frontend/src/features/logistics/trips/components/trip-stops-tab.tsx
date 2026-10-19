import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, ListPlus, Play } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/features/authorization';
import type enLogistics from '@/i18n/locales/en/logistics.json';

import {
  stopProgress,
  useCaptureProof,
  useCompleteStop,
  useGenerateStops,
  useRecordStopAction,
  useStartStop,
  useTripStops,
} from '../hooks/use-trip-execution';
import {
  STOP_OUTCOMES,
  type DeliveryStop,
  type StopOutcome,
  type StopStatus,
} from '../types/trip-execution';

type LogisticsLabel = ($: typeof enLogistics) => string;

const STOP_STATUS_LABEL: Record<StopStatus, LogisticsLabel> = {
  pending: ($) => $.trips.execution.status.pending,
  in_progress: ($) => $.trips.execution.status.in_progress,
  delivered: ($) => $.trips.execution.status.delivered,
  partial: ($) => $.trips.execution.status.partial,
  failed: ($) => $.trips.execution.status.failed,
  returned: ($) => $.trips.execution.status.returned,
  skipped: ($) => $.trips.execution.status.skipped,
};

const STOP_STATUS_CLASS: Record<StopStatus, string> = {
  pending: 'bg-muted text-muted-foreground',
  in_progress: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  delivered: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  partial: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  failed: 'bg-destructive/10 text-destructive',
  returned: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  skipped: 'bg-muted text-muted-foreground',
};

// ── Live execution summary ───────────────────────────────────────────────────

function ExecutionProgress({ stops }: { stops: DeliveryStop[] | undefined }) {
  const { t } = useTranslation('logistics');
  const progress = stopProgress(stops);

  if (progress.total === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t(($) => $.trips.execution.progress.none)}</p>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{t(($) => $.trips.execution.progress.title)}</h3>
        <span className="text-xs text-muted-foreground">
          {t(($) => $.trips.execution.progress.percent, { percent: progress.percent })}
        </span>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full bg-primary" style={{ width: `${progress.percent}%` }} />
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span>
          {t(($) => $.trips.execution.progress.stops)}: {progress.total}
        </span>
        <span>
          {t(($) => $.trips.execution.progress.completed)}: {progress.completed}
        </span>
        <span>
          {t(($) => $.trips.execution.progress.inProgress)}: {progress.inProgress}
        </span>
        <span>
          {t(($) => $.trips.execution.progress.pending)}: {progress.pending}
        </span>
        {progress.failed > 0 && (
          <span className="text-destructive">
            {t(($) => $.trips.execution.progress.failed)}: {progress.failed}
          </span>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        {t(($) => $.trips.execution.progress.derivedNote)}
      </p>
    </div>
  );
}

// ── Completion form ──────────────────────────────────────────────────────────

function CompleteStopForm({
  tripId,
  stop,
  onDone,
}: {
  tripId: string;
  stop: DeliveryStop;
  onDone: () => void;
}) {
  const { t } = useTranslation('logistics');
  const complete = useCompleteStop(tripId);

  const [outcome, setOutcome] = useState<StopOutcome>('delivered');
  const [deliveryType, setDeliveryType] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    try {
      await complete.mutateAsync({
        stopId: stop.id,
        payload: {
          status: outcome,
          delivery_type: deliveryType.trim() || null,
          // Money is only sent when the stop is one that takes payment; sending
          // an amount on a stop that does not would be a silent lie.
          collected_amount: stop.accepts_payment && amount ? Number(amount) : null,
          payment_method: stop.accepts_payment && method.trim() ? method.trim() : null,
          notes: notes.trim() || null,
        },
      });
      onDone();
    } catch {
      setError(t(($) => $.trips.execution.stops.completeFailed));
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">
        {t(($) => $.trips.execution.stops.completeDescription)}
      </p>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`outcome-${stop.id}`}>{t(($) => $.trips.execution.stops.outcome)}</Label>
        <select
          id={`outcome-${stop.id}`}
          value={outcome}
          onChange={(e) => setOutcome(e.target.value as StopOutcome)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          {STOP_OUTCOMES.map((value) => (
            <option key={value} value={value}>
              {t(STOP_STATUS_LABEL[value])}
            </option>
          ))}
        </select>
      </div>

      <Input
        value={deliveryType}
        maxLength={40}
        placeholder={t(($) => $.trips.execution.stops.deliveryType)}
        onChange={(e) => setDeliveryType(e.target.value)}
      />

      {stop.accepts_payment && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            placeholder={t(($) => $.trips.execution.stops.collectedAmount)}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input
            value={method}
            maxLength={30}
            placeholder={t(($) => $.trips.execution.stops.paymentMethod)}
            onChange={(e) => setMethod(e.target.value)}
          />
        </div>
      )}

      <Textarea
        rows={2}
        value={notes}
        maxLength={2000}
        placeholder={t(($) => $.trips.execution.stops.notes)}
        onChange={(e) => setNotes(e.target.value)}
      />

      <div className="flex gap-2">
        <Button size="sm" disabled={complete.isPending} onClick={() => void submit()}>
          {complete.isPending
            ? t(($) => $.trips.execution.common.saving)
            : t(($) => $.trips.execution.stops.complete)}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone}>
          {t(($) => $.trips.execution.common.cancel)}
        </Button>
      </div>
    </div>
  );
}

// ── Driver workflow: action + proof ──────────────────────────────────────────

function StopWorkflowForms({
  tripId,
  stop,
  onDone,
}: {
  tripId: string;
  stop: DeliveryStop;
  onDone: () => void;
}) {
  const { t } = useTranslation('logistics');
  const recordAction = useRecordStopAction(tripId);
  const captureProof = useCaptureProof(tripId);

  const [actionType, setActionType] = useState('');
  const [reason, setReason] = useState('');
  const [newDate, setNewDate] = useState('');
  const [signature, setSignature] = useState('');
  const [photos, setPhotos] = useState('');

  async function submitAction() {
    if (!actionType.trim()) return;
    await recordAction.mutateAsync({
      stopId: stop.id,
      payload: {
        action_type: actionType.trim(),
        reason: reason.trim() || null,
        new_delivery_date: newDate || null,
      },
    });
    setActionType('');
    setReason('');
    setNewDate('');
    onDone();
  }

  async function submitProof() {
    await captureProof.mutateAsync({
      stopId: stop.id,
      payload: {
        signature_path: signature.trim() || null,
        // One reference per line: the endpoint stores references to files that
        // were uploaded elsewhere, it does not accept uploads itself.
        photos: photos
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean),
      },
    });
    setSignature('');
    setPhotos('');
    onDone();
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`action-${stop.id}`}>{t(($) => $.trips.execution.stops.actionType)}</Label>
        <Input
          id={`action-${stop.id}`}
          value={actionType}
          maxLength={40}
          placeholder={t(($) => $.trips.execution.stops.actionTypePlaceholder)}
          onChange={(e) => setActionType(e.target.value)}
        />
        <Input
          value={reason}
          maxLength={255}
          placeholder={t(($) => $.trips.execution.stops.reason)}
          onChange={(e) => setReason(e.target.value)}
        />
        <Input
          type="date"
          value={newDate}
          aria-label={t(($) => $.trips.execution.stops.newDeliveryDate)}
          onChange={(e) => setNewDate(e.target.value)}
        />
        <Button
          size="sm"
          className="self-start"
          disabled={!actionType.trim() || recordAction.isPending}
          onClick={() => void submitAction()}
        >
          {t(($) => $.trips.execution.stops.recordAction)}
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-t pt-3">
        <Label htmlFor={`sig-${stop.id}`}>{t(($) => $.trips.execution.stops.signaturePath)}</Label>
        <Input
          id={`sig-${stop.id}`}
          value={signature}
          maxLength={500}
          placeholder={t(($) => $.trips.execution.stops.signaturePathPlaceholder)}
          onChange={(e) => setSignature(e.target.value)}
        />
        <Textarea
          rows={2}
          value={photos}
          placeholder={t(($) => $.trips.execution.stops.photosPlaceholder)}
          onChange={(e) => setPhotos(e.target.value)}
        />
        <p className="text-[11px] text-muted-foreground">
          {t(($) => $.trips.execution.stops.uploadNote)}
        </p>
        <Button
          size="sm"
          variant="secondary"
          className="self-start"
          disabled={captureProof.isPending}
          onClick={() => void submitProof()}
        >
          <Camera className="me-1 h-3.5 w-3.5" />
          {t(($) => $.trips.execution.stops.captureProof)}
        </Button>
      </div>
    </div>
  );
}

// ── Tab ──────────────────────────────────────────────────────────────────────

export function TripStopsTab({ tripId }: { tripId: string }) {
  const { t, i18n } = useTranslation('logistics');
  const { can } = usePermission();
  const canWrite = can('logistics.distribution.update');

  const { data: stops, isLoading } = useTripStops(tripId);
  const generate = useGenerateStops(tripId);
  const startStop = useStartStop(tripId);

  const [completing, setCompleting] = useState<number | null>(null);
  const [workflow, setWorkflow] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dateTime = (value: string | null) =>
    value ? new Date(value).toLocaleString(i18n.language) : t(($) => $.trips.execution.common.none);
  const money = (value: number | string | null) =>
    value === null ? t(($) => $.trips.execution.common.none)
      : new Intl.NumberFormat(i18n.language).format(Number(value));

  async function start(stopId: number) {
    setError(null);
    try {
      await startStop.mutateAsync(stopId);
    } catch {
      setError(t(($) => $.trips.execution.stops.startFailed));
    }
  }

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  const list = stops ?? [];

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <ExecutionProgress stops={stops} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t(($) => $.trips.execution.stops.title)}</h3>
        {canWrite && (
          <Button
            size="sm"
            variant="secondary"
            disabled={generate.isPending}
            onClick={() => void generate.mutateAsync()}
          >
            <ListPlus className="me-1 h-3.5 w-3.5" />
            {t(($) => $.trips.execution.stops.generate)}
          </Button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col gap-1 py-4">
          <p className="text-sm text-muted-foreground">{t(($) => $.trips.execution.stops.empty)}</p>
          <p className="text-[11px] text-muted-foreground">
            {t(($) => $.trips.execution.stops.generateNote)}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((stop) => (
            <li key={stop.id} className="flex flex-col gap-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {stop.sequence}
                  </span>
                  <span className="font-mono text-xs">{stop.order_id}</span>
                </div>
                <Badge variant="secondary" className={STOP_STATUS_CLASS[stop.status]}>
                  {t(STOP_STATUS_LABEL[stop.status])}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <span>
                  {t(($) => $.trips.execution.stops.completedAt)}: {dateTime(stop.completed_at)}
                </span>
                {stop.accepts_payment && (
                  <span>
                    {t(($) => $.trips.execution.stops.collected)}: {money(stop.collected_amount)}
                  </span>
                )}
                {stop.is_settled && (
                  <Badge variant="outline" className="text-[10px]">
                    {t(($) => $.trips.execution.stops.settled)}
                  </Badge>
                )}
              </div>

              {stop.proof && (
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
                  {stop.proof.has_signature && (
                    <span>{t(($) => $.trips.execution.stops.proofSignature)}</span>
                  )}
                  <span>
                    {t(($) => $.trips.execution.stops.proofPhotos)}: {stop.proof.photo_count}
                  </span>
                  <span>
                    {t(($) => $.trips.execution.stops.proofCapturedAt)}:{' '}
                    {dateTime(stop.proof.captured_at)}
                  </span>
                </div>
              )}

              {(stop.actions?.length ?? 0) > 0 && (
                <ul className="flex flex-col gap-1">
                  {stop.actions?.map((action) => (
                    <li key={action.id} className="text-[11px] text-muted-foreground">
                      {action.action_type}
                      {action.reason ? ` — ${action.reason}` : ''}
                    </li>
                  ))}
                </ul>
              )}

              {canWrite && (
                <div className="flex flex-wrap gap-2">
                  {stop.status === 'pending' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      disabled={startStop.isPending}
                      onClick={() => void start(stop.id)}
                    >
                      <Play className="me-1 h-3 w-3" />
                      {t(($) => $.trips.execution.stops.start)}
                    </Button>
                  )}
                  {stop.status === 'in_progress' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs"
                      onClick={() => setCompleting(completing === stop.id ? null : stop.id)}
                    >
                      {t(($) => $.trips.execution.stops.complete)}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setWorkflow(workflow === stop.id ? null : stop.id)}
                  >
                    {t(($) => $.trips.execution.stops.actions)}
                  </Button>
                </div>
              )}

              {completing === stop.id && canWrite && (
                <CompleteStopForm
                  tripId={tripId}
                  stop={stop}
                  onDone={() => setCompleting(null)}
                />
              )}

              {workflow === stop.id && canWrite && (
                <StopWorkflowForms tripId={tripId} stop={stop} onDone={() => setWorkflow(null)} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
