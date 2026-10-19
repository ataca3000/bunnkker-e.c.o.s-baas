import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Eraser } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePermission } from '@/features/authorization';
import type enLogistics from '@/i18n/locales/en/logistics.json';

import {
  useCommitCapacity,
  useReleaseCapacity,
  useReserveCapacity,
  useSweepExpiredCapacity,
} from '../hooks/use-network';
import type { CapacityCommitment } from '../types/network';

type LogisticsLabel = ($: typeof enLogistics) => string;

/**
 * Network capacity commitments.
 *
 * This is the primitive layer, and the panel says so. The operator-facing
 * workflow is the capacity reservation in Operations, which owns one of these
 * (ops_capacity_reservations has a commitment relation to
 * network_capacity_commitments). Presenting this as the main way to hold
 * capacity would invite commitments that no reservation tracks.
 *
 * Slots are identified by id because there is no slot list endpoint. Rather
 * than invent a picker over an endpoint that does not exist, the field is
 * explicit and the screen explains why.
 */
export function CapacityCommitmentsPanel() {
  const { t, i18n } = useTranslation('logistics');
  const { can } = usePermission();

  const reserve = useReserveCapacity();
  const commit = useCommitCapacity();
  const release = useReleaseCapacity();
  const sweep = useSweepExpiredCapacity();

  const [slotId, setSlotId] = useState('');
  const [orders, setOrders] = useState('');
  const [ttl, setTtl] = useState('');
  const [commitmentId, setCommitmentId] = useState('');
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<CapacityCommitment | null>(null);
  const [swept, setSwept] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canCommit = can('network.capacity.commit');
  const canManage = can('network.capacity.manage');

  if (!canCommit && !canManage) return null;

  const dateTime = (value: string | null) =>
    value ? new Date(value).toLocaleString(i18n.language) : '—';

  async function run(action: () => Promise<unknown>, failure: LogisticsLabel) {
    setError(null);
    setSwept(null);
    try {
      const value = await action();
      if (value && typeof value === 'object' && 'status' in value) {
        setResult(value as CapacityCommitment);
      }
    } catch {
      setError(t(failure));
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium">{t(($) => $.network.commitments.title)}</h3>
        <p className="text-[11px] text-muted-foreground">
          {t(($) => $.network.commitments.note)}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 p-2 text-xs">
          <Badge variant="secondary">{result.status_label}</Badge>
          <span className="font-mono">{result.id}</span>
          {result.holds_capacity && (
            <Badge variant="outline" className="text-[10px]">
              {t(($) => $.network.commitments.holdsCapacity)}
            </Badge>
          )}
          <span className="text-muted-foreground">
            {t(($) => $.network.commitments.expiresAt)}: {dateTime(result.expires_at)}
          </span>
        </div>
      )}

      {swept !== null && (
        <p className="text-xs text-muted-foreground">
          {t(($) => $.network.commitments.swept, { count: swept })}
        </p>
      )}

      {canCommit && (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="capacity-slot">{t(($) => $.network.commitments.slotId)}</Label>
            <Input
              id="capacity-slot"
              value={slotId}
              maxLength={36}
              placeholder={t(($) => $.network.commitments.slotIdPlaceholder)}
              onChange={(e) => setSlotId(e.target.value)}
              className="h-8 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              {t(($) => $.network.commitments.slotIdNote)}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              type="number"
              min={0}
              value={orders}
              placeholder={t(($) => $.network.commitments.orders)}
              onChange={(e) => setOrders(e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              type="number"
              min={1}
              max={1440}
              value={ttl}
              placeholder={t(($) => $.network.commitments.ttlMinutes)}
              onChange={(e) => setTtl(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          <Button
            size="sm"
            className="self-start"
            disabled={!slotId.trim() || reserve.isPending}
            onClick={() =>
              void run(
                () =>
                  reserve.mutateAsync({
                    slot_id: slotId.trim(),
                    orders: orders ? Number(orders) : undefined,
                    ttl_minutes: ttl ? Number(ttl) : null,
                  }),
                ($) => $.network.commitments.reserveFailed,
              )
            }
          >
            {t(($) => $.network.commitments.reserve)}
          </Button>

          <div className="flex flex-col gap-1.5 border-t pt-3">
            <Label htmlFor="commitment-id">
              {t(($) => $.network.commitments.commitmentId)}
            </Label>
            <Input
              id="commitment-id"
              value={commitmentId}
              onChange={(e) => setCommitmentId(e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              value={reason}
              maxLength={1000}
              placeholder={t(($) => $.network.commitments.releaseReason)}
              onChange={(e) => setReason(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={!commitmentId.trim() || commit.isPending}
                onClick={() =>
                  void run(
                    () => commit.mutateAsync(commitmentId.trim()),
                    ($) => $.network.commitments.commitFailed,
                  )
                }
              >
                {t(($) => $.network.commitments.commit)}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!commitmentId.trim() || release.isPending}
                onClick={() =>
                  void run(
                    () =>
                      release.mutateAsync({
                        id: commitmentId.trim(),
                        reason: reason.trim() || undefined,
                      }),
                    ($) => $.network.commitments.releaseFailed,
                  )
                }
              >
                {t(($) => $.network.commitments.release)}
              </Button>
            </div>
          </div>
        </>
      )}

      {canManage && (
        <div className="flex flex-col gap-1 border-t pt-3">
          <Button
            size="sm"
            variant="ghost"
            className="self-start"
            disabled={sweep.isPending}
            onClick={async () => {
              setError(null);
              try {
                const count = await sweep.mutateAsync(undefined);
                setSwept(typeof count === 'number' ? count : 0);
              } catch {
                setError(t(($) => $.network.commitments.sweepFailed));
              }
            }}
          >
            <Eraser className="me-1 h-3.5 w-3.5" />
            {t(($) => $.network.commitments.sweep)}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            {t(($) => $.network.commitments.sweepNote)}
          </p>
        </div>
      )}
    </section>
  );
}
