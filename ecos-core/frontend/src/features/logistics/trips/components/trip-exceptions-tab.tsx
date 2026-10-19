import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Plus } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/features/authorization';

import {
  useRaiseException,
  useResolveException,
  useTripExceptions,
} from '../hooks/use-trip-execution';

/**
 * Exceptions raised during the run.
 *
 * `exception_type` is a free string on the backend — there is no enum to offer
 * as a list, so the field is free text with examples rather than a select that
 * would imply a closed set the domain does not have.
 */
export function TripExceptionsTab({ tripId }: { tripId: string }) {
  const { t, i18n } = useTranslation('logistics');
  const { can } = usePermission();
  const canWrite = can('logistics.distribution.update');

  const { data: exceptions, isLoading } = useTripExceptions(tripId);
  const raise = useRaiseException(tripId);
  const resolve = useResolveException(tripId);

  const [showRaise, setShowRaise] = useState(false);
  const [type, setType] = useState('');
  const [description, setDescription] = useState('');
  const [resolving, setResolving] = useState<number | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const dateTime = (value: string | null) =>
    value ? new Date(value).toLocaleString(i18n.language) : t(($) => $.trips.execution.common.none);

  async function submitRaise() {
    if (!type.trim() || !description.trim()) return;
    setError(null);
    try {
      await raise.mutateAsync({ exception_type: type.trim(), description: description.trim() });
      setType('');
      setDescription('');
      setShowRaise(false);
    } catch {
      setError(t(($) => $.trips.execution.exceptions.raiseFailed));
    }
  }

  async function submitResolve(exceptionId: number) {
    setError(null);
    try {
      await resolve.mutateAsync({ exceptionId, notes: resolutionNotes.trim() || undefined });
      setResolving(null);
      setResolutionNotes('');
    } catch {
      setError(t(($) => $.trips.execution.exceptions.resolveFailed));
    }
  }

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  const list = exceptions ?? [];

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t(($) => $.trips.execution.exceptions.title)}</h3>
        {canWrite && (
          <Button size="sm" variant="secondary" onClick={() => setShowRaise((v) => !v)}>
            <Plus className="me-1 h-3.5 w-3.5" />
            {t(($) => $.trips.execution.exceptions.raise)}
          </Button>
        )}
      </div>

      {showRaise && canWrite && (
        <div className="flex flex-col gap-3 rounded-md border p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exception-type">
              {t(($) => $.trips.execution.exceptions.type)}
            </Label>
            <Input
              id="exception-type"
              value={type}
              maxLength={50}
              placeholder={t(($) => $.trips.execution.exceptions.typePlaceholder)}
              onChange={(e) => setType(e.target.value)}
            />
          </div>

          <Textarea
            rows={3}
            value={description}
            maxLength={5000}
            placeholder={t(($) => $.trips.execution.exceptions.descriptionPlaceholder)}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!type.trim() || !description.trim() || raise.isPending}
              onClick={() => void submitRaise()}
            >
              {raise.isPending
                ? t(($) => $.trips.execution.common.saving)
                : t(($) => $.trips.execution.common.save)}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowRaise(false)}>
              {t(($) => $.trips.execution.common.cancel)}
            </Button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          {t(($) => $.trips.execution.exceptions.empty)}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((exception) => (
            <li key={exception.id} className="flex flex-col gap-2 rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle
                    className={
                      exception.is_resolved
                        ? 'h-3.5 w-3.5 text-muted-foreground'
                        : 'h-3.5 w-3.5 text-amber-600 dark:text-amber-400'
                    }
                  />
                  {exception.exception_type}
                </span>
                <Badge variant={exception.is_resolved ? 'outline' : 'secondary'}>
                  {exception.is_resolved
                    ? t(($) => $.trips.execution.exceptions.resolved)
                    : t(($) => $.trips.execution.exceptions.open)}
                </Badge>
              </div>

              <p className="text-sm">{exception.description}</p>

              <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
                <span>
                  {t(($) => $.trips.execution.exceptions.raisedAt)}: {dateTime(exception.created_at)}
                </span>
                {exception.synced_to_cs && (
                  <span>{t(($) => $.trips.execution.exceptions.syncedToCs)}</span>
                )}
              </div>

              {exception.resolution_notes && (
                <p className="rounded-md border bg-muted/30 p-2 text-xs">
                  {exception.resolution_notes}
                </p>
              )}

              {!exception.is_resolved && canWrite && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 self-start text-xs"
                    onClick={() =>
                      setResolving(resolving === exception.id ? null : exception.id)
                    }
                  >
                    {t(($) => $.trips.execution.exceptions.resolve)}
                  </Button>

                  {resolving === exception.id && (
                    <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-2">
                      <Textarea
                        rows={2}
                        value={resolutionNotes}
                        maxLength={2000}
                        placeholder={t(($) => $.trips.execution.exceptions.resolutionNotes)}
                        onChange={(e) => setResolutionNotes(e.target.value)}
                      />
                      <Button
                        size="sm"
                        className="h-7 self-start text-xs"
                        disabled={resolve.isPending}
                        onClick={() => void submitResolve(exception.id)}
                      >
                        {t(($) => $.trips.execution.exceptions.resolve)}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
