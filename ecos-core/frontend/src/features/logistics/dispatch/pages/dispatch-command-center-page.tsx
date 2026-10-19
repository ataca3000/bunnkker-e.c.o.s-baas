import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, ListOrdered, Lock, ShieldCheck, XCircle } from 'lucide-react';

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import {
  useAssignmentHealth,
  useDispatchBoards,
  useDispatchExceptions,
  useDispatchKpis,
  useOpenSession,
  useQueueStatistics,
  useSessions,
} from '../hooks/use-dispatch-ops';
import type { QueueItem } from '../types/dispatch-ops';
import { DispatchQueuePanel } from '../components/dispatch-queue-panel';
import { DispatchConflictsPanel } from '../components/dispatch-conflicts-panel';
import { DispatchSessionsPanel } from '../components/dispatch-sessions-panel';
import { DispatchTimelinePanel } from '../components/dispatch-timeline-panel';
import { DispatchMonitoringPanel } from '../components/dispatch-monitoring-panel';
import { QueueItemDrawer } from '../components/queue-item-drawer';

/**
 * Dispatch Command Center.
 *
 * Exception-first: the headline counts are the things that stop work, and every
 * conflict names the module that owns the fact behind it, because Dispatch
 * orchestrates but does not get to overrule Fleet, Network or Distribution.
 */
export function DispatchCommandCenterPage() {
  const { toast } = useToast();
  const [boardId, setBoardId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<QueueItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: boards } = useDispatchBoards();
  const { data: sessionPage } = useSessions();
  const { data: exceptions } = useDispatchExceptions();
  const { data: health } = useAssignmentHealth();
  const { data: queueStats } = useQueueStatistics();
  const { data: kpis, refetch, isFetching } = useDispatchKpis();

  const openSession = useOpenSession();

  const effectiveBoardId = boardId ?? boards?.find((b) => b.is_open)?.id ?? null;

  // The session that can claim work on the board currently being viewed.
  const activeSession = useMemo(
    () =>
      (sessionPage?.data ?? []).find(
        (s) => s.is_active && (effectiveBoardId === null || s.board?.id === effectiveBoardId),
      ) ?? null,
    [sessionPage, effectiveBoardId],
  );

  const metrics = [
    {
      id: 'blocking',
      icon: XCircle,
      label: 'Blocking Conflicts',
      value: exceptions?.blocking_conflicts ?? 0,
      isLoading: !exceptions,
      colorClass: 'text-destructive',
    },
    {
      id: 'reviews',
      icon: ShieldCheck,
      label: 'Awaiting Review',
      value: exceptions?.pending_reviews ?? 0,
      isLoading: !exceptions,
      colorClass: 'text-amber-600',
    },
    {
      id: 'queue',
      icon: ListOrdered,
      label: 'Queue Depth',
      value: queueStats?.depth ?? 0,
      isLoading: !queueStats,
    },
    {
      id: 'stuck',
      icon: AlertTriangle,
      label: 'Stuck Items',
      value: exceptions?.stuck_queue_items ?? 0,
      isLoading: !exceptions,
      colorClass: 'text-amber-600',
    },
    {
      id: 'locks',
      icon: Lock,
      label: 'Held Resources',
      value: health?.held_locks ?? 0,
      isLoading: !health,
    },
    {
      id: 'sessions',
      icon: Activity,
      label: 'Active Sessions',
      value: kpis?.sessions_active ?? 0,
      isLoading: !kpis,
      colorClass: 'text-emerald-600',
    },
  ];

  const blocking = exceptions?.blocking_conflicts ?? 0;

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[{ label: 'Logistics OS' }, { label: 'Dispatch' }]}
        title="Dispatch Command Center"
        description="Sessions, queue, allocation, conflicts and operational metrics"
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
              <span className="text-xs text-muted-foreground">
                Working as {activeSession.operator_name ?? 'you'} · {activeSession.assigned_count}{' '}
                assigned
              </span>
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
                        toast({
                          title: 'The session could not be opened.',
                          variant: 'destructive',
                        }),
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
          {/* Land on whatever is blocked; fall back to the queue when nothing is. */}
          <Tabs defaultValue={blocking > 0 ? 'exceptions' : 'queue'} className="w-full">
            <TabsList>
              <TabsTrigger value="queue">Queue</TabsTrigger>
              <TabsTrigger value="exceptions">
                Exceptions{blocking > 0 ? ` (${blocking})` : ''}
              </TabsTrigger>
              <TabsTrigger value="sessions">Sessions</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
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

            <TabsContent value="exceptions" className="pt-4">
              <DispatchConflictsPanel />
            </TabsContent>

            <TabsContent value="sessions" className="pt-4">
              <DispatchSessionsPanel activeSessionId={activeSession?.id ?? null} />
            </TabsContent>

            <TabsContent value="timeline" className="pt-4">
              <DispatchTimelinePanel boardId={effectiveBoardId} />
            </TabsContent>

            <TabsContent value="monitoring" className="pt-4">
              <DispatchMonitoringPanel />
            </TabsContent>
          </Tabs>
        </div>
      </WorkspacePage>

      <QueueItemDrawer item={selectedItem} open={drawerOpen} onOpenChange={setDrawerOpen} />
    </>
  );
}
