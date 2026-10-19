import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageDrawer } from '@/components/page/drawer/page-drawer';
import { useToast } from '@/components/ds/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

import { useDeferItem, usePrioritiseItem } from '../hooks/use-dispatch-ops';
import type { QueueItem, QueuePriority } from '../types/dispatch-ops';
import { PriorityBadge, QueueStatusBadge } from './dispatch-status-badges';
import type enLogistics from '@/i18n/locales/en/logistics.json';

/**
 * A label held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of key
 * strings can never type-check. Indexing this table by a runtime value is
 * still fine — the lookup yields a selector, which is what t() expects.
 */
type LogisticsLabel = ($: typeof enLogistics) => string;

const PRIORITIES: QueuePriority[] = ['critical', 'high', 'normal', 'low'];

/** `logistics` namespace keys — resolved at render, never stored translated. */
const PRIORITY_LABEL_KEYS: Record<QueuePriority, LogisticsLabel> = {
  critical: ($) => $.common.critical,
  high: ($) => $.common.high,
  normal: ($) => $.dispatch.priority.normal,
  low: ($) => $.common.low,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

/**
 * One queue item, with the two things a dispatcher does to it without
 * allocating: move it up, or put it aside.
 *
 * Both demand a reason. Ordering that cannot be explained gets worked around.
 */
export function QueueItemDrawer({
  item,
  open,
  onOpenChange,
}: {
  item: QueueItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('logistics');
  const { toast } = useToast();
  const [priority, setPriority] = useState<QueuePriority>('normal');
  const [reason, setReason] = useState('');

  const prioritise = usePrioritiseItem();
  const defer = useDeferItem();

  if (item === null) return null;

  const canReorder = item.status === 'waiting' || item.status === 'deferred';

  return (
    <PageDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={item.trip_number ?? t($ => $.dispatch.queue.itemFallbackTitle)}
      description={t($ => $.dispatch.queue.drawerDescription)}
      size="lg"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label={t($ => $.common.status)}>
            <QueueStatusBadge status={item.status} />
          </Field>
          <Field label={t($ => $.common.priority)}>
            <PriorityBadge priority={item.priority} />
          </Field>
          <Field label={t($ => $.dispatch.queue.rank)}>{item.rank}</Field>
          <Field label={t($ => $.dispatch.queue.colWaiting)}>
            {t($ => $.dispatch.units.minutes, { value: item.waiting_minutes })}
          </Field>
          <Field label={t($ => $.dispatch.queue.colAttempts)}>{item.attempt_count}</Field>
          <Field label={t($ => $.dispatch.queue.colClaimedBy)}>{item.claimed_by ?? '—'}</Field>
          <Field label={t($ => $.dispatch.queue.tripCapacity)}>{item.trip_capacity ?? '—'}</Field>
          <Field label={t($ => $.dispatch.queue.queuedAt)}>
            {item.queued_at ? new Date(item.queued_at).toLocaleString() : '—'}
          </Field>
        </div>

        {item.priority_reason && (
          <Field label={t($ => $.dispatch.queue.whyPriority)}>{item.priority_reason}</Field>
        )}

        {item.is_stuck && (
          <Alert variant="destructive">
            <AlertDescription className="text-xs">
              {t($ => $.dispatch.queue.stuckFailed, { count: item.attempt_count })}
              {item.last_failure_reason
                ? ` ${t($ => $.dispatch.queue.stuckLastReason, { reason: item.last_failure_reason })}`
                : ''}{' '}
              {t($ => $.dispatch.queue.stuckAdvice)}
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        {!canReorder ? (
          <p className="text-xs text-muted-foreground">
            {t($ => $.dispatch.queue.notEditable, { status: item.status_label.toLowerCase() })}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t($ => $.common.priority)}</Label>
                <Select
                  value={priority}
                  onValueChange={(v) => setPriority(v as QueuePriority)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {t(PRIORITY_LABEL_KEYS[p])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t($ => $.common.reason)}</Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t($ => $.dispatch.queue.changeReasonPlaceholder)}
                  className="h-9"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={reason.trim().length === 0 || prioritise.isPending}
                onClick={() =>
                  prioritise.mutate(
                    { itemId: item.id, priority, reason: reason.trim() },
                    {
                      onSuccess: () => {
                        toast({ title: t($ => $.dispatch.toast.priorityUpdated) });
                        setReason('');
                        onOpenChange(false);
                      },
                      onError: () =>
                        toast({
                          title: t($ => $.dispatch.toast.priorityFailed),
                          variant: 'destructive',
                        }),
                    },
                  )
                }
              >
                {t($ => $.dispatch.queue.setPriority)}
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                disabled={defer.isPending}
                onClick={() =>
                  defer.mutate(
                    { itemId: item.id, reason: reason.trim() || undefined },
                    {
                      onSuccess: () => {
                        toast({ title: t($ => $.dispatch.toast.itemDeferred) });
                        onOpenChange(false);
                      },
                      onError: () =>
                        toast({ title: t($ => $.dispatch.toast.deferFailed), variant: 'destructive' }),
                    },
                  )
                }
              >
                {t($ => $.dispatch.queue.defer)}
              </Button>
            </div>
          </div>
        )}
      </div>
    </PageDrawer>
  );
}
