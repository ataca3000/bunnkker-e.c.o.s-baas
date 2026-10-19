import { useMemo, useState } from 'react';
import { Activity, CircleDot, Clock, ListOrdered } from 'lucide-react';

import { WorkspaceHeader } from '@/components/workspace/header/workspace-header';
import { WorkspacePage } from '@/components/page/layout/workspace-page';
import { SmartToolbar } from '@/components/data-grid/smart-toolbar';
import { useToast } from '@/components/ds/use-toast';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useAssignmentHistory } from '@/features/logistics/operations/hooks/use-operations-analytics';

import {
  useBoardTimeline,
  useCloseSession,
  useDispatchBoards,
  useDispatchKpis,
  useOpenSession,
  useQueueStatistics,
  useSessions,
} from '../hooks/use-dispatch-ops';
import type { QueueItem } from '../types/dispatch-ops';
import { DispatchQueuePanel } from '../components/dispatch-queue-panel';
import { QueueItemDrawer } from '../components/queue-item-drawer';
import { SessionStatusBadge } from '../components/dispatch-status-badges';

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {children}
    </div>
  );
}

/**
 * The live assignments right now — reserved or confirmed allocations, read from
 * Dispatch's own records (never recomputed).
 */
function AssignmentMonitor() {
  const { data, isLoading } = useAssignmentHistory({ status: 'confirmed' });
  const rows = (data?.data ?? []).slice(0, 20);

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <Panel title={`Active assignments (${rows.length})`}>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nothing is out right now.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-1.5 font-normal">Vehicle</th>
                <th className="py-1.5 font-normal">Driver</th>
                <th className="py-1.5 font-normal">Fleet verdict</th>
                <th className="py-1.5 font-normal">Mode</th>
                <th className="py-1.5 font-normal">Confirmed</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="py-2 tabular-nums">{row.vehicle_id ?? '—'}</td>
                  <td className="py-2 tabular-nums">{row.driver_id ?? '—'}</td>
                  {/* Fleet's snapshot verdict, quoted — Fleet stays the authority. */}
                  <td className="py-2 text-muted-foreground">{row.fleet_verdict ?? '—'}</td>
                  <td className="py-2 capitalize text-muted-foreground">{row.mode}</td>
                  <td className="py-2 text-muted-foreground">
                    {row.confirmed_at ? new Date(row.confirmed_at).toLocaleTimeString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

/** Assignment progress: how much of what was attempted has been confirmed. */
function AssignmentProgress() {
  const { data } = useDispatchKpis();

  const attempted = (data?.allocations_attempted as number) ?? 0;
  const confirmed = (data?.allocations_confirmed as number) ?? 0;
  const ratio = attempted > 0 ? confirmed / attempted : null;

  return (
    <Panel title="Assignment progress (today)">
      {ratio === null ? (
        <p className="text-sm text-muted-foreground">Nothing attempted yet.</p>
      ) : (
        <>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {confirmed} of {attempted} confirmed
            </span>
            <span className="tabular-nums">{Math.round(ratio * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-emerald-600" style={{ width: `${ratio * 100}%` }} />
          </div>
        </>
      )}
    </Panel>
  );
}

function ResourceTimeline({ boardId }: { boardId: string | null }) {
  const { data, isLoading } = useBoardTimeline(boardId);

  if (boardId === null) {
    return (
      <Panel title="Resource timeline">
        <p className="py-8 text-center text-sm text-muted-foreground">
          Pick a board to see its timeline.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Resource timeline">
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : !data || data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Nothing recorded yet.</p>
      ) : (
        <ol className="relative space-y-3 border-l pl-5">
          {data.map((event) => (
            <li key={event.id} className="relative">
              <span className="absolute -left-[25px] top-1 rounded-full bg-background">
                <CircleDot className="size-3 text-muted-foreground" />
              </span>
              <p className="text-sm font-medium">{event.title}</p>
              {event.description && (
                <p className="text-xs text-muted-foreground">{event.description}</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                {event.occurred_at ? new Date(event.occurred_at).toLocaleString() : '—'}
                {event.actor_name ? ` · ${event.actor_name}` : ''}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/**
 * Dispatch Execution Workspace.
 *
 * The live execution surface: session control, the execution queue, the active
 * assignment monitor and the board timeline. Every action reuses Phase 3's
 * dispatch/ops endpoints — this workspace adds no new writer, it drives the ones
 * Dispatch already owns.
 */
export function DispatchExecutionPage() {
  const { toast } = useToast();
  const [boardId, setBoardId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: boards } = useDispatchBoards();
  const { data: sessionPage } = useSessions();
  const { data: queueStats } = useQueueStatistics();
  const { data: kpis, refetch, isFetching } = useDispatchKpis();

  const openSession = useOpenSession();
  const closeSession = useCloseSession();

  const effectiveBoardId = boardId ?? boards?.find((b) => b.is_open)?.id ?? null;

  const activeSession = useMemo(
    () =>
      (sessionPage?.data ?? []).find(
        (s) => s.is_active && (effectiveBoardId === null || s.board?.id === effectiveBoardId),
      ) ?? null,
    [sessionPage, effectiveBoardId],
  );

  const metrics = [
    { id: 'sessions', icon: Activity, label: 'Active Sessions', value: kpis?.sessions_active ?? 0, isLoading: !kpis, colorClass: 'text-emerald-600' },
    { id: 'queue', icon: ListOrdered, label: 'Queue Depth', value: queueStats?.depth ?? 0, isLoading: !queueStats },
    { id: 'confirmed', icon: CircleDot, label: 'Confirmed Today', value: kpis?.allocations_confirmed ?? 0, isLoading: !kpis },
    { id: 'wait', icon: Clock, label: 'Avg Wait (min)', value: queueStats?.avg_wait_minutes ?? 0, isLoading: !queueStats },
  ];

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Logistics OS' }, { label: 'Dispatch' }]}
        title="Dispatch Execution"
        description="Session control, execution queue, active assignments and the board timeline"
        metrics={metrics}
      />

      <WorkspacePage
        toolbar={
          <div className="px-4 sm:px-6">
            <SmartToolbar onRefresh={() => refetch()} isFetching={isFetching} />
          </div>
        }
        quickFilters={
          <div className="flex flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
            <Select value={effectiveBoardId ?? ''} onValueChange={(v) => setBoardId(v)}>
              <SelectTrigger className="h-8 w-72 text-xs">
                <SelectValue placeholder="Select a dispatch board" />
              </SelectTrigger>
              <SelectContent>
                {(boards ?? []).map((board) => (
                  <SelectItem key={board.id} value={board.id} className="text-xs">
                    {board.board_date ?? 'Undated'} · {board.dispatch_region?.name ?? 'All regions'}{' '}
                    ({board.status_label})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {activeSession ? (
              <div className="flex items-center gap-2">
                <SessionStatusBadge status={activeSession.status} />
                <span className="text-xs text-muted-foreground">
                  {activeSession.operator_name ?? 'you'} · {activeSession.assigned_count} assigned
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs"
                  disabled={closeSession.isPending}
                  onClick={() =>
                    closeSession.mutate(
                      { id: activeSession.id },
                      {
                        onSuccess: () => toast({ title: 'Session closed.' }),
                        onError: () =>
                          toast({ title: 'The session could not be closed.', variant: 'destructive' }),
                      },
                    )
                  }
                >
                  Close session
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                className="h-8 text-xs"
                disabled={effectiveBoardId === null || openSession.isPending}
                onClick={() =>
                  effectiveBoardId &&
                  openSession.mutate(
                    { boardId: effectiveBoardId, mode: 'manual' },
                    {
                      onSuccess: () => toast({ title: 'Session open.' }),
                      onError: () =>
                        toast({ title: 'The session could not be opened.', variant: 'destructive' }),
                    },
                  )
                }
              >
                Open session
              </Button>
            )}
          </div>
        }
      >
        <div className="px-4 pb-6 sm:px-6">
          <Tabs defaultValue="queue" className="w-full">
            <TabsList>
              <TabsTrigger value="queue">Execution Queue</TabsTrigger>
              <TabsTrigger value="assignments">Assignments</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="queue" className="pt-4">
              <DispatchQueuePanel
                boardId={effectiveBoardId}
                sessionId={activeSession?.id ?? null}
                onSelectItem={(item) => {
                  setSelectedItem(item);
                  setDrawerOpen(true);
                }}
              />
            </TabsContent>

            <TabsContent value="assignments" className="space-y-4 pt-4">
              <AssignmentProgress />
              <AssignmentMonitor />
            </TabsContent>

            <TabsContent value="timeline" className="pt-4">
              <ResourceTimeline boardId={effectiveBoardId} />
            </TabsContent>
          </Tabs>
        </div>
      </WorkspacePage>

      <QueueItemDrawer item={selectedItem} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
