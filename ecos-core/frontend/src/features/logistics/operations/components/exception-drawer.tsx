import { useState } from 'react';
import { ArrowUpCircle, Pin, Repeat2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { PageDrawer } from '@/components/page/drawer/page-drawer';
import { useToast } from '@/components/ds/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

import {
  useAcknowledgeException,
  useAddExceptionNote,
  useEscalateException,
  useEscalations,
  useException,
  useExceptionNotes,
  useResolveException,
  useSuppressException,
} from '../hooks/use-operations';
import type { ExceptionResolution, NoteType } from '../types/operations';
import { ExceptionStatusBadge, SeverityIcon, SourceBadge } from './operations-badges';

import type enLogistics from '@/i18n/locales/en/logistics.json';

/**
 * Wording held as an i18next selector rather than a key string.
 *
 * Selector mode has no type for a key chosen at runtime, so a table of key
 * strings can never type-check. Indexing this table by a runtime note type is
 * still fine — the lookup yields a selector, which is what t() expects.
 */
type LogisticsLabel = ($: typeof enLogistics) => string;

/** Wording for each note type; the stored value itself never changes. */
const NOTE_TYPE_KEYS: Record<NoteType, LogisticsLabel> = {
  note: ($) => $.operations.exceptionDrawer.notes.type.note,
  action_taken: ($) => $.operations.exceptionDrawer.notes.type.actionTaken,
  handover: ($) => $.operations.exceptionDrawer.notes.type.handover,
};

/** Wording for each resolution; the stored value itself never changes. */
const RESOLUTION_KEYS: Record<ExceptionResolution, LogisticsLabel> = {
  fixed: ($) => $.operations.exceptionDrawer.resolutions.fixed,
  handled_elsewhere: ($) => $.operations.exceptionDrawer.resolutions.handledElsewhere,
  not_a_problem: ($) => $.operations.exceptionDrawer.resolutions.notAProblem,
  accepted: ($) => $.operations.exceptionDrawer.resolutions.accepted,
};

/** The API sends the resolution as a plain string; unknown values fall back. */
function resolutionKey(value: string | null): LogisticsLabel {
  return value !== null && value in RESOLUTION_KEYS
    ? RESOLUTION_KEYS[value as ExceptionResolution]
    : ($) => $.operations.exceptionDrawer.resolutions.resolved;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function Notes({ exceptionId }: { exceptionId: string }) {
  const { t } = useTranslation('logistics');
  const { toast } = useToast();
  const { data: notes, isLoading } = useExceptionNotes(exceptionId);
  const [body, setBody] = useState('');
  const [noteType, setNoteType] = useState<NoteType>('note');
  const addNote = useAddExceptionNote();

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t($ => $.operations.exceptionDrawer.notes.placeholder)}
          rows={3}
          className="text-sm"
        />
        <div className="flex items-center gap-2">
          <Select value={noteType} onValueChange={(v) => setNoteType(v as typeof noteType)}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="note" className="text-xs">
                {t(NOTE_TYPE_KEYS.note)}
              </SelectItem>
              <SelectItem value="action_taken" className="text-xs">
                {t(NOTE_TYPE_KEYS.action_taken)}
              </SelectItem>
              <SelectItem value="handover" className="text-xs">
                {t(NOTE_TYPE_KEYS.handover)}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            className="h-8 text-xs"
            disabled={body.trim().length === 0 || addNote.isPending}
            onClick={() =>
              addNote.mutate(
                { id: exceptionId, body: body.trim(), noteType },
                {
                  onSuccess: () => {
                    toast({ title: t($ => $.operations.exceptionDrawer.notes.toast.added) });
                    setBody('');
                  },
                  onError: () =>
                    toast({
                      title: t($ => $.operations.exceptionDrawer.notes.toast.addFailed),
                      variant: 'destructive',
                    }),
                },
              )
            }
          >
            {t($ => $.operations.exceptionDrawer.notes.add)}
          </Button>
          {noteType === 'handover' && (
            // A handover is what the next shift reads first, so it pins itself.
            <span className="text-[11px] text-muted-foreground">
              {t($ => $.operations.exceptionDrawer.notes.pinsToTop)}
            </span>
          )}
        </div>
      </div>

      <Separator />

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : !notes || notes.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t($ => $.operations.exceptionDrawer.notes.empty)}
        </p>
      ) : (
        <ul className="space-y-2">
          {notes.map((note) => (
            <li key={note.id} className="rounded-md border p-2.5">
              <div className="flex items-start gap-2">
                {note.is_pinned && <Pin className="mt-0.5 size-3 shrink-0 text-amber-600" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{note.body}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {note.author_name ?? t($ => $.common.unknown)} ·{' '}
                    {note.written_at
                      ? new Date(note.written_at).toLocaleString()
                      : t($ => $.common.na)}
                    {note.note_type !== 'note' ? ` · ${t(NOTE_TYPE_KEYS[note.note_type])}` : ''}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Escalations({ exceptionId }: { exceptionId: string }) {
  const { t } = useTranslation('logistics');
  const { toast } = useToast();
  const { data: history } = useEscalations(exceptionId);
  const [reason, setReason] = useState('');
  const [role, setRole] = useState('');
  const escalate = useEscalateException();

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">{t($ => $.common.reason)}</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t($ => $.operations.exceptionDrawer.escalations.reasonPlaceholder)}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t($ => $.operations.exceptionDrawer.escalations.toRole)}</Label>
            <Input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="operations_director"
              className="h-8 text-xs"
            />
          </div>
        </div>
        <Button
          size="sm"
          className="h-8 text-xs"
          // Handing someone a problem with no context is how escalations stall.
          disabled={reason.trim().length === 0 || escalate.isPending}
          onClick={() =>
            escalate.mutate(
              { id: exceptionId, reason: reason.trim(), toRole: role.trim() || undefined },
              {
                onSuccess: () => {
                  toast({ title: t($ => $.operations.exceptionDrawer.escalations.toast.escalated) });
                  setReason('');
                },
                onError: () =>
                  toast({
                    title: t($ => $.operations.exceptionDrawer.escalations.toast.refused),
                    variant: 'destructive',
                  }),
              },
            )
          }
        >
          <ArrowUpCircle className="me-1 size-3.5" />
          {t($ => $.operations.exceptionDrawer.escalations.escalate)}
        </Button>
      </div>

      <Separator />

      {!history || history.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t($ => $.operations.exceptionDrawer.escalations.empty)}
        </p>
      ) : (
        <ol className="space-y-2">
          {history.map((step) => (
            <li key={step.id} className="rounded-md border p-2.5 text-xs">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {t($ => $.operations.exceptionDrawer.escalations.level, { level: step.level })}
                </Badge>
                {step.was_automatic && (
                  <Badge variant="outline" className="text-[10px]">
                    {t($ => $.operations.exceptionDrawer.escalations.automatic)}
                  </Badge>
                )}
                {step.escalated_to_role && (
                  <span className="text-muted-foreground">→ {step.escalated_to_role}</span>
                )}
              </div>
              <p className="mt-1">{step.reason}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {step.escalated_at
                  ? new Date(step.escalated_at).toLocaleString()
                  : t($ => $.common.na)}
                {step.escalated_by_name ? ` · ${step.escalated_by_name}` : ''}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * One exception, with everything an operator can do to it.
 *
 * The resolution options narrow when the exception belongs elsewhere: Operations
 * can record that another module dealt with it, but it cannot declare that
 * module's fact untrue.
 */
export function ExceptionDrawer({
  exceptionId,
  open,
  onOpenChange,
}: {
  exceptionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('logistics');
  const { toast } = useToast();
  const { data: exception, isLoading } = useException(exceptionId);
  const [resolution, setResolution] = useState<ExceptionResolution>('handled_elsewhere');
  const [reason, setReason] = useState('');

  const acknowledge = useAcknowledgeException();
  const resolve = useResolveException();
  const suppress = useSuppressException();

  if (exceptionId === null) return null;

  const canResolveOutright = exception?.is_self_owned === true;

  return (
    <PageDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={exception?.title ?? t($ => $.operations.exceptionDrawer.title)}
      description={exception ? `${exception.source_label} · ${exception.category_label}` : ''}
      size="2xl"
    >
      {isLoading || !exception ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityIcon severity={exception.severity} />
            <ExceptionStatusBadge status={exception.status} />
            <SourceBadge source={exception.source} label={exception.source_label} />
            {exception.is_recurring && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Repeat2 className="size-2.5" />
                {t($ => $.operations.exceptionDrawer.seenTimes, {
                  count: exception.occurrence_count,
                })}
              </Badge>
            )}
            {exception.is_overdue_for_escalation && (
              <Badge variant="destructive" className="text-[10px]">
                {t($ => $.operations.exceptionDrawer.overdue)}
              </Badge>
            )}
          </div>

          {!exception.is_self_owned && (
            <Alert>
              <AlertDescription className="text-xs">
                {t($ => $.operations.exceptionDrawer.ownedElsewhereNotice, {
                  source: exception.source_label,
                })}
              </AlertDescription>
            </Alert>
          )}

          {exception.description && (
            // The owning module's own wording, not a paraphrase.
            <p className="text-sm text-muted-foreground">{exception.description}</p>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label={t($ => $.common.type)}>{exception.exception_type}</Field>
            <Field label={t($ => $.operations.exceptionDrawer.severity)}>
              {exception.severity_label}
            </Field>
            <Field label={t($ => $.operations.exceptionDrawer.firstSeen)}>
              {exception.first_seen_at
                ? new Date(exception.first_seen_at).toLocaleString()
                : t($ => $.common.na)}
            </Field>
            <Field label={t($ => $.operations.exceptionDrawer.lastSeen)}>
              {exception.last_seen_at
                ? new Date(exception.last_seen_at).toLocaleString()
                : t($ => $.common.na)}
            </Field>
            <Field label={t($ => $.operations.exceptionDrawer.age)}>
              {t($ => $.operations.exceptionDrawer.minutes, { minutes: exception.age_minutes })}
            </Field>
            <Field label={t($ => $.operations.exceptionDrawer.unacknowledged)}>
              {exception.unacknowledged_minutes !== null
                ? t($ => $.operations.exceptionDrawer.minutes, {
                    minutes: exception.unacknowledged_minutes,
                  })
                : t($ => $.operations.exceptionDrawer.acknowledged)}
            </Field>
            <Field label={t($ => $.operations.exceptionDrawer.escalationLevel)}>
              {exception.escalation_level}
            </Field>
            <Field label={t($ => $.operations.exceptionDrawer.subject)}>
              {exception.subject_type
                ? `${exception.subject_type} ${exception.subject_id ?? ''}`
                : t($ => $.common.na)}
            </Field>
          </div>

          <Separator />

          <Tabs defaultValue="act" className="w-full">
            <TabsList>
              <TabsTrigger value="act">{t($ => $.operations.exceptionDrawer.tabs.act)}</TabsTrigger>
              <TabsTrigger value="notes">{t($ => $.common.notes)}</TabsTrigger>
              <TabsTrigger value="escalations">
                {t($ => $.operations.exceptionDrawer.tabs.escalations)}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="act" className="space-y-3 pt-4">
              {exception.is_outstanding ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                    disabled={exception.acknowledged_at !== null || acknowledge.isPending}
                    onClick={() =>
                      acknowledge.mutate(exception.id, {
                        onSuccess: () =>
                          toast({ title: t($ => $.operations.exceptionDrawer.toast.acknowledged) }),
                        onError: () =>
                          toast({
                            title: t($ => $.operations.exceptionDrawer.toast.acknowledgeFailed),
                            variant: 'destructive',
                          }),
                      })
                    }
                  >
                    {exception.acknowledged_at !== null
                      ? t($ => $.operations.exceptionDrawer.alreadyAcknowledged)
                      : t($ => $.operations.exceptionDrawer.acknowledge)}
                  </Button>

                  <Separator />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        {t($ => $.operations.exceptionDrawer.resolution)}
                      </Label>
                      <Select
                        value={resolution}
                        onValueChange={(v) => setResolution(v as ExceptionResolution)}
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="handled_elsewhere" className="text-xs">
                            {t(RESOLUTION_KEYS.handled_elsewhere)}
                          </SelectItem>
                          {/* Only Operations' own exceptions may be closed outright. */}
                          {canResolveOutright && (
                            <>
                              <SelectItem value="fixed" className="text-xs">
                                {t(RESOLUTION_KEYS.fixed)}
                              </SelectItem>
                              <SelectItem value="not_a_problem" className="text-xs">
                                {t(RESOLUTION_KEYS.not_a_problem)}
                              </SelectItem>
                              <SelectItem value="accepted" className="text-xs">
                                {t(RESOLUTION_KEYS.accepted)}
                              </SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">
                        {t($ => $.operations.exceptionDrawer.whatWasDone)}
                      </Label>
                      <Input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={t($ => $.common.required)}
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      disabled={reason.trim().length === 0 || resolve.isPending}
                      onClick={() =>
                        resolve.mutate(
                          { id: exception.id, resolution, reason: reason.trim() },
                          {
                            onSuccess: () => {
                              toast({ title: t($ => $.operations.exceptionDrawer.toast.closed) });
                              onOpenChange(false);
                            },
                            onError: () =>
                              toast({
                                title: t($ => $.operations.exceptionDrawer.toast.closeFailed),
                                variant: 'destructive',
                              }),
                          },
                        )
                      }
                    >
                      {t($ => $.operations.exceptionDrawer.closeException)}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs"
                      disabled={reason.trim().length === 0 || suppress.isPending}
                      onClick={() =>
                        suppress.mutate(
                          { id: exception.id, reason: reason.trim() },
                          {
                            onSuccess: () =>
                              toast({
                                title: t($ => $.operations.exceptionDrawer.toast.suppressed),
                              }),
                            onError: () =>
                              toast({
                                title: t($ => $.operations.exceptionDrawer.toast.suppressFailed),
                                variant: 'destructive',
                              }),
                          },
                        )
                      }
                    >
                      {t($ => $.operations.exceptionDrawer.suppress)}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-1 text-sm">
                  <p className="text-muted-foreground">
                    {exception.resolved_by_name
                      ? t($ => $.operations.exceptionDrawer.closedAsBy, {
                          resolution: t(resolutionKey(exception.resolution)),
                          name: exception.resolved_by_name,
                        })
                      : t($ => $.operations.exceptionDrawer.closedAs, {
                          resolution: t(resolutionKey(exception.resolution)),
                        })}
                  </p>
                  {exception.resolution_reason && <p>{exception.resolution_reason}</p>}
                </div>
              )}
            </TabsContent>

            <TabsContent value="notes" className="pt-4">
              <Notes exceptionId={exception.id} />
            </TabsContent>

            <TabsContent value="escalations" className="pt-4">
              <Escalations exceptionId={exception.id} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </PageDrawer>
  );
}
