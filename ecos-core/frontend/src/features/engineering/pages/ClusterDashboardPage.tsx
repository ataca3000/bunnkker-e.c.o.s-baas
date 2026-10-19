import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Play, AlertTriangle, Lock, Activity } from 'lucide-react';
import { useClusterDashboard } from '../hooks/useCluster';
import { useWorkers } from '../hooks/useWorkers';
import ClusterKPIRow from '../components/cluster/ClusterKPIRow';
import WorkerGrid from '../components/cluster/WorkerGrid';
import WorkerDetailDrawer from '../components/cluster/WorkerDetailDrawer';

export default function ClusterDashboardPage() {
  const {
    dashboard, loading, error, lastRefreshed,
    refresh, tick, recoverStale, purgeLocks,
  } = useClusterDashboard(30);

  const {
    workers, total, page, lastPage, selectedWorker, workerSessions,
    load: loadWorkers,
    selectWorker, startWorker, stopWorker, drainWorker, destroyWorker, recoverWorker,
  } = useWorkers();

  const locks = dashboard?.locks;

  return (
    <div className="flex flex-col gap-6 p-6 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Execution Cluster</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Distributed parallel worker platform
            {lastRefreshed && <span className="ml-2">· Refreshed {lastRefreshed.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={tick}>
            <Play className="h-3.5 w-3.5 mr-1.5" />
            Tick
          </Button>
          <Button variant="outline" size="sm" onClick={recoverStale}>
            <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
            Recover Stale
          </Button>
          <Button variant="outline" size="sm" onClick={purgeLocks}>
            <Lock className="h-3.5 w-3.5 mr-1.5" />
            Purge Locks
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* KPI Row */}
      <ClusterKPIRow dashboard={dashboard} />

      <Tabs defaultValue="workers">
        <TabsList>
          <TabsTrigger value="workers">Workers {workers.length > 0 && <Badge variant="secondary" className="ml-1.5 text-xs">{total}</Badge>}</TabsTrigger>
          <TabsTrigger value="locks">Locks</TabsTrigger>
          <TabsTrigger value="events">Recent Events</TabsTrigger>
          <TabsTrigger value="throughput">Throughput</TabsTrigger>
        </TabsList>

        <TabsContent value="workers" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Workers</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <WorkerGrid
                workers={workers}
                onSelect={selectWorker}
                onStart={startWorker}
                onStop={stopWorker}
                onDrain={drainWorker}
                onDestroy={destroyWorker}
              />
              {lastPage > 1 && (
                <div className="flex items-center justify-center gap-2 py-3 border-t">
                  <Button size="sm" variant="outline" onClick={() => loadWorkers(page - 1)} disabled={page <= 1}>Prev</Button>
                  <span className="text-sm text-muted-foreground">{page} / {lastPage}</span>
                  <Button size="sm" variant="outline" onClick={() => loadWorkers(page + 1)} disabled={page >= lastPage}>Next</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locks" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Workspace Locks', value: locks?.workspace_locks ?? 0 },
              { label: 'Branch Locks',    value: locks?.branch_locks    ?? 0 },
              { label: 'File Locks',      value: locks?.file_locks      ?? 0 },
            ].map(item => (
              <Card key={item.label}>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-3xl font-bold tabular-nums mt-1">{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" size="sm" onClick={purgeLocks}>
              <Lock className="h-3.5 w-3.5 mr-1.5" />
              Purge All Expired Locks
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="events" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Recent Cluster Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!dashboard?.recent_events || dashboard.recent_events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events recorded.</p>
              ) : (
                <div className="space-y-2">
                  {(dashboard.recent_events as unknown as Record<string, unknown>[]).map((ev, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs py-1.5 border-b last:border-0">
                      <Badge variant={ev.severity === 'error' ? 'destructive' : ev.severity === 'warning' ? 'outline' : 'secondary'} className="text-[10px] mt-0.5 shrink-0">
                        {ev.severity as string}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-xs">{ev.event_type as string}</p>
                        <p className="text-muted-foreground truncate">{ev.message as string}</p>
                      </div>
                      <span className="text-muted-foreground shrink-0">{ev.occurred_at ? new Date(ev.occurred_at as string).toLocaleTimeString() : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="throughput" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Tasks/Hour Today',      value: dashboard?.throughput?.tasks_per_hour?.toFixed(2) ?? '—' },
              { label: 'Avg Execution (min)',    value: dashboard?.throughput?.avg_execution_minutes?.toFixed(1) ?? '—' },
              { label: 'Success Rate',           value: dashboard?.throughput?.success_rate_percent ? dashboard.throughput.success_rate_percent.toFixed(1) + '%' : '—' },
            ].map(item => (
              <Card key={item.label}>
                <CardContent className="pt-4">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-3xl font-bold tabular-nums mt-1">{item.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Worker Detail Drawer */}
      <WorkerDetailDrawer
        worker={selectedWorker}
        sessions={workerSessions}
        onClose={() => selectWorker(null)}
        onRecover={recoverWorker}
        onStop={stopWorker}
      />
    </div>
  );
}
