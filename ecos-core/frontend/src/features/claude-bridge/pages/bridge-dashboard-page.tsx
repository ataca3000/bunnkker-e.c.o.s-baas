import { useNavigate } from 'react-router-dom';
import { Activity, CheckCircle, Clock, PlayCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/crud';
import { ROUTES } from '@/router/routes';
import type { CbDashboard } from '@/features/claude-bridge/types';

export function BridgeDashboardPage() {
  const navigate = useNavigate();

  const dashboard: CbDashboard = {
    worker: null,
    counts: { queued: 0, running: 0, awaiting_review: 0, approved_today: 0 },
    active_task: null,
    recent_tasks: [],
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Claude Bridge"
        subtitle="Remote Claude Code execution"
        actions={
          <Button onClick={() => navigate(ROUTES.claudeBridgeTasksNew)}>
            + New Task
          </Button>
        }
      />

      {/* Worker status */}
      <Card>
        <CardContent className="pt-4">
          {dashboard.worker ? (
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${dashboard.worker.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}
              />
              <span className="font-medium">{dashboard.worker.name}</span>
              <span className="text-muted-foreground text-sm">
                {dashboard.worker.status === 'online' ? 'Online' : 'Offline'}
                {dashboard.worker.last_seen_at && ` · last seen ${dashboard.worker.last_seen_at}`}
              </span>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              No worker registered.{' '}
              <button
                className="text-primary underline"
                onClick={() => navigate(ROUTES.claudeBridgeSettings)}
              >
                Set up a worker
              </button>
            </p>
          )}
        </CardContent>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard icon={<Clock className="h-4 w-4" />} label="Queued"         value={dashboard.counts.queued} />
        <KpiCard icon={<PlayCircle className="h-4 w-4" />} label="Running"    value={dashboard.counts.running} />
        <KpiCard icon={<Activity className="h-4 w-4" />} label="Needs Review" value={dashboard.counts.awaiting_review} />
        <KpiCard icon={<CheckCircle className="h-4 w-4" />} label="Approved Today" value={dashboard.counts.approved_today} />
      </div>

      {/* Active task */}
      {dashboard.active_task && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Running Now</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">{dashboard.active_task.title}</p>
            <p className="text-muted-foreground text-sm">
              {Math.round(dashboard.active_task.elapsed_seconds / 60)} min elapsed
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              onClick={() => navigate(`${ROUTES.claudeBridgeTasks}/${dashboard.active_task!.id}`)}
            >
              View Live Log
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recent tasks placeholder */}
      {dashboard.recent_tasks.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground text-sm">No tasks yet.</p>
          <Button
            size="sm"
            className="mt-3"
            onClick={() => navigate(ROUTES.claudeBridgeTasksNew)}
          >
            Create your first task
          </Button>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs uppercase tracking-wide">{label}</span>
        </div>
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
