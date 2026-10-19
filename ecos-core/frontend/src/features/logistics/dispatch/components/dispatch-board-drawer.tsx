import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Send } from 'lucide-react';

import { EntityDrawer } from '@/components/crud';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermission } from '@/features/authorization';
import type enLogistics from '@/i18n/locales/en/logistics.json';

import {
  useAcceptProposal,
  useDispatchBoard,
  useOverrideAssignment,
  useProposeDispatch,
  useRejectProposal,
  useReleaseProposal,
  useResourcePool,
  useSetBoardStatus,
} from '../hooks/use-dispatch-board';
import type { BoardStatus, DispatchAssignment, DispatchProposal } from '../types/dispatch-board';

type LogisticsLabel = ($: typeof enLogistics) => string;

const BOARD_STATUS_LABEL: Record<BoardStatus, LogisticsLabel> = {
  open: ($) => $.dispatch.board.boardStatus.open,
  planning: ($) => $.dispatch.board.boardStatus.planning,
  proposed: ($) => $.dispatch.board.boardStatus.proposed,
  releasing: ($) => $.dispatch.board.boardStatus.releasing,
  partially_released: ($) => $.dispatch.board.boardStatus.partially_released,
  released: ($) => $.dispatch.board.boardStatus.released,
  closed: ($) => $.dispatch.board.boardStatus.closed,
  cancelled: ($) => $.dispatch.board.boardStatus.cancelled,
};

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

// ── Assignment ───────────────────────────────────────────────────────────────

/**
 * One proposed assignment, with the override the API allows.
 *
 * `score`, `fitness_level` and `blockers` are the engine's and are shown as
 * given. An override departs from that ranking, so the API requires a reason
 * and so does this form — the reason is the only thing that makes the
 * departure reviewable afterwards.
 */
function AssignmentRow({ assignment }: { assignment: DispatchAssignment }) {
  const { t } = useTranslation('logistics');
  const { can } = usePermission();
  const override = useOverrideAssignment();

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason.trim()) {
      setError(t(($) => $.dispatch.board.assignments.reasonRequired));
      return;
    }
    setError(null);
    try {
      await override.mutateAsync({
        id: assignment.id,
        payload: {
          reason: reason.trim(),
          vehicle_id: vehicleId ? Number(vehicleId) : null,
          driver_id: driverId ? Number(driverId) : null,
        },
      });
      setReason('');
      setVehicleId('');
      setDriverId('');
      setOpen(false);
    } catch {
      setError(t(($) => $.dispatch.board.assignments.overrideFailed));
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{assignment.trip_number ?? '—'}</span>
        <div className="flex items-center gap-2">
          {assignment.score !== null && (
            <Badge variant="outline" className="text-[10px]">
              {t(($) => $.dispatch.board.assignments.score)} {assignment.score}
            </Badge>
          )}
          <Badge variant={assignment.is_releasable ? 'outline' : 'secondary'}>
            {assignment.is_releasable
              ? t(($) => $.dispatch.board.assignments.releasable)
              : t(($) => $.dispatch.board.assignments.notReleasable)}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span>
          {t(($) => $.dispatch.board.assignments.vehicle)}: {assignment.vehicle_plate ?? '—'}
        </span>
        <span>
          {t(($) => $.dispatch.board.assignments.driver)}: {assignment.driver_name ?? '—'}
        </span>
        {assignment.fitness_level && (
          <span>
            {t(($) => $.dispatch.board.assignments.fitness)}: {assignment.fitness_level}
          </span>
        )}
      </div>

      {assignment.blockers.length > 0 && (
        <ul className="flex flex-col gap-1">
          {assignment.blockers.map((blocker) => (
            <li key={blocker} className="flex items-center gap-2 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3" />
              {blocker}
            </li>
          ))}
        </ul>
      )}

      {can('dispatch.propose') && (
        <>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 self-start text-xs"
            onClick={() => setOpen((v) => !v)}
          >
            {t(($) => $.dispatch.board.assignments.override)}
          </Button>

          {open && (
            <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-2">
              <p className="text-xs text-muted-foreground">
                {t(($) => $.dispatch.board.assignments.overrideDescription)}
              </p>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Input
                value={reason}
                maxLength={1000}
                placeholder={t(($) => $.dispatch.board.assignments.overrideReason)}
                onChange={(e) => setReason(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input
                  type="number"
                  value={vehicleId}
                  placeholder={t(($) => $.dispatch.board.assignments.overrideVehicle)}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className="h-8 text-sm"
                />
                <Input
                  type="number"
                  value={driverId}
                  placeholder={t(($) => $.dispatch.board.assignments.overrideDriver)}
                  onChange={(e) => setDriverId(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <Button
                size="sm"
                className="h-7 self-start text-xs"
                disabled={override.isPending}
                onClick={() => void submit()}
              >
                {t(($) => $.dispatch.board.confirm)}
              </Button>
            </div>
          )}
        </>
      )}
    </li>
  );
}

// ── Proposal ─────────────────────────────────────────────────────────────────

function ProposalCard({ proposal }: { proposal: DispatchProposal }) {
  const { t, i18n } = useTranslation('logistics');
  const { can } = usePermission();

  const accept = useAcceptProposal();
  const reject = useRejectProposal();
  const release = useReleaseProposal();

  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [released, setReleased] = useState<number | null>(null);

  const dateTime = (value: string | null) =>
    value ? new Date(value).toLocaleString(i18n.language) : '—';

  async function run(action: () => Promise<unknown>, failure: LogisticsLabel) {
    setError(null);
    try {
      await action();
    } catch {
      setError(t(failure));
    }
  }

  async function doRelease() {
    setError(null);
    try {
      const result = await release.mutateAsync(proposal.id);
      if (result && typeof result === 'object' && 'released' in result) {
        setReleased((result as { released: number }).released);
      }
    } catch {
      setError(t(($) => $.dispatch.board.proposals.releaseFailed));
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{proposal.status_label}</span>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {t(($) => $.dispatch.board.proposals.assignments)} {proposal.assignment_count}
          </Badge>
          {proposal.blocked_count > 0 && (
            <Badge variant="outline" className="text-[10px] text-destructive">
              {t(($) => $.dispatch.board.proposals.blocked)} {proposal.blocked_count}
            </Badge>
          )}
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {released !== null && (
        <p className="text-xs text-muted-foreground">
          {t(($) => $.dispatch.board.proposals.released, { count: released })}
        </p>
      )}

      {proposal.is_decided && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
          <span>
            {t(($) => $.dispatch.board.proposals.decided)}: {dateTime(proposal.decided_at)}
          </span>
          {proposal.decision_reason && (
            <span>
              {t(($) => $.dispatch.board.proposals.decisionReason)}: {proposal.decision_reason}
            </span>
          )}
        </div>
      )}

      {!proposal.is_decided && (
        <div className="flex flex-col gap-2">
          <Input
            value={reason}
            maxLength={1000}
            placeholder={t(($) => $.dispatch.board.proposals.rejectReason)}
            onChange={(e) => setReason(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            {can('dispatch.release') && (
              <Button
                size="sm"
                disabled={accept.isPending}
                onClick={() =>
                  void run(
                    () => accept.mutateAsync(proposal.id),
                    ($) => $.dispatch.board.proposals.acceptFailed,
                  )
                }
              >
                <CheckCircle2 className="me-1 h-3.5 w-3.5" />
                {t(($) => $.dispatch.board.proposals.accept)}
              </Button>
            )}
            {can('dispatch.propose') && (
              <Button
                size="sm"
                variant="outline"
                disabled={reject.isPending}
                onClick={() =>
                  void run(
                    () => reject.mutateAsync({ id: proposal.id, reason: reason.trim() || undefined }),
                    ($) => $.dispatch.board.proposals.rejectFailed,
                  )
                }
              >
                {t(($) => $.dispatch.board.proposals.reject)}
              </Button>
            )}
          </div>
        </div>
      )}

      {proposal.status === 'accepted' && can('dispatch.release') && (
        <div className="flex flex-col gap-1">
          <Button
            size="sm"
            variant="secondary"
            className="self-start"
            disabled={release.isPending}
            onClick={() => void doRelease()}
          >
            <Send className="me-1 h-3.5 w-3.5" />
            {t(($) => $.dispatch.board.proposals.release)}
          </Button>
          <p className="text-[11px] text-muted-foreground">
            {t(($) => $.dispatch.board.proposals.releaseDescription)}
          </p>
        </div>
      )}

      {(proposal.assignments?.length ?? 0) === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t(($) => $.dispatch.board.assignments.none)}
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {proposal.assignments?.map((assignment) => (
              <AssignmentRow key={assignment.id} assignment={assignment} />
            ))}
          </ul>
          <p className="text-[11px] text-muted-foreground">
            {t(($) => $.dispatch.board.assignments.scoreNote)}
          </p>
        </>
      )}
    </div>
  );
}

// ── Drawer ───────────────────────────────────────────────────────────────────

export function DispatchBoardDrawer({
  boardId,
  open,
  onOpenChange,
}: {
  boardId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation('logistics');
  const { can } = usePermission();

  const [tab, setTab] = useState('proposals');
  const { data: board, isLoading } = useDispatchBoard(open ? boardId : null);
  const pool = useResourcePool();

  const propose = useProposeDispatch(boardId ?? '');
  const setStatus = useSetBoardStatus(boardId ?? '');

  const [target, setTarget] = useState<BoardStatus | ''>('');
  const [statusReason, setStatusReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const dateTime = (value: string | null) =>
    value ? new Date(value).toLocaleString(i18n.language) : '—';

  async function doPropose() {
    setError(null);
    try {
      await propose.mutateAsync({});
    } catch {
      setError(t(($) => $.dispatch.board.proposals.proposeFailed));
    }
  }

  async function doSetStatus() {
    if (!target) return;
    setError(null);
    try {
      await setStatus.mutateAsync({ status: target, reason: statusReason.trim() || null });
      setTarget('');
      setStatusReason('');
    } catch {
      setError(t(($) => $.dispatch.board.lifecycle.failed));
    }
  }

  return (
    <EntityDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={board ? `${board.board_date} — ${board.dispatch_region?.name ?? ''}` : t(($) => $.dispatch.board.title)}
      description={board?.status_label}
    >
      {isLoading && <Skeleton className="h-40 w-full" />}

      {!isLoading && !board && (
        <p className="py-6 text-sm text-muted-foreground">{t(($) => $.dispatch.board.notFound)}</p>
      )}

      {board && (
        <div className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t(($) => $.dispatch.board.boardDate)} value={board.board_date} />
            <Field
              label={t(($) => $.dispatch.board.region)}
              value={board.dispatch_region?.name ?? '—'}
            />
            <Field label={t(($) => $.dispatch.board.plannedAt)} value={dateTime(board.planned_at)} />
            <Field
              label={t(($) => $.dispatch.board.releasedAt)}
              value={dateTime(board.released_at)}
            />
          </div>

          <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-4">
            <TabsList className="flex-wrap">
              <TabsTrigger value="proposals">
                {t(($) => $.dispatch.board.tabs.proposals)}
              </TabsTrigger>
              <TabsTrigger value="pool">{t(($) => $.dispatch.board.tabs.pool)}</TabsTrigger>
              <TabsTrigger value="lifecycle">
                {t(($) => $.dispatch.board.tabs.lifecycle)}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="proposals" className="flex flex-col gap-3">
              {can('dispatch.propose') && (
                <div className="flex flex-col gap-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="self-start"
                    disabled={propose.isPending}
                    onClick={() => void doPropose()}
                  >
                    {t(($) => $.dispatch.board.proposals.propose)}
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    {t(($) => $.dispatch.board.proposals.proposeDescription)}
                  </p>
                </div>
              )}

              {(board.proposals?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t(($) => $.dispatch.board.proposals.empty)}
                </p>
              ) : (
                board.proposals?.map((proposal) => (
                  <ProposalCard key={proposal.id} proposal={proposal} />
                ))
              )}
            </TabsContent>

            <TabsContent value="pool" className="flex flex-col gap-3">
              {pool.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : !pool.data ? (
                <p className="text-sm text-muted-foreground">
                  {t(($) => $.dispatch.board.pool.empty)}
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field
                      label={t(($) => $.dispatch.board.pool.assignableVehicles)}
                      value={pool.data.assignable_vehicle_count}
                    />
                    <Field
                      label={t(($) => $.dispatch.board.pool.availableDrivers)}
                      value={pool.data.available_driver_count}
                    />
                  </div>

                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(($) => $.dispatch.board.pool.vehicles)}
                  </h4>
                  <ul className="flex flex-col gap-1">
                    {pool.data.vehicles.map((vehicle) => (
                      <li
                        key={vehicle.vehicle_id}
                        className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs"
                      >
                        <span className="font-medium">{vehicle.plate_number}</span>
                        <span className="text-muted-foreground">{vehicle.fitness ?? '—'}</span>
                        {!vehicle.is_assignable && (
                          <Badge variant="secondary" className="text-[10px]">
                            {t(($) => $.dispatch.board.assignments.notReleasable)}
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>

                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(($) => $.dispatch.board.pool.drivers)}
                  </h4>
                  <ul className="flex flex-col gap-1">
                    {pool.data.drivers.map((driver) => (
                      <li
                        key={driver.driver_id}
                        className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-xs"
                      >
                        <span className="font-medium">{driver.full_name}</span>
                        <span className="text-muted-foreground">{driver.driver_code}</span>
                        {!driver.can_start_deliveries && (
                          <Badge variant="secondary" className="text-[10px]">
                            {t(($) => $.dispatch.board.assignments.notReleasable)}
                          </Badge>
                        )}
                      </li>
                    ))}
                  </ul>

                  <p className="text-[11px] text-muted-foreground">
                    {t(($) => $.dispatch.board.pool.note)}
                  </p>
                </>
              )}
            </TabsContent>

            <TabsContent value="lifecycle" className="flex flex-col gap-3">
              {board.allowed_transitions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t(($) => $.dispatch.board.lifecycle.none)}
                </p>
              ) : (
                can('dispatch.manage') && (
                  <div className="flex flex-col gap-3 rounded-md border p-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="board-status">
                        {t(($) => $.dispatch.board.lifecycle.change)}
                      </Label>
                      <select
                        id="board-status"
                        value={target}
                        onChange={(e) => setTarget(e.target.value as BoardStatus | '')}
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                      >
                        <option value="">—</option>
                        {board.allowed_transitions.map((transition) => (
                          <option key={transition.value} value={transition.value}>
                            {t(BOARD_STATUS_LABEL[transition.value])}
                          </option>
                        ))}
                      </select>
                    </div>

                    <Input
                      value={statusReason}
                      maxLength={1000}
                      placeholder={t(($) => $.dispatch.board.lifecycle.reasonPlaceholder)}
                      onChange={(e) => setStatusReason(e.target.value)}
                    />

                    <Button
                      size="sm"
                      className="self-start"
                      disabled={!target || setStatus.isPending}
                      onClick={() => void doSetStatus()}
                    >
                      {t(($) => $.dispatch.board.confirm)}
                    </Button>
                  </div>
                )
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
    </EntityDrawer>
  );
}
