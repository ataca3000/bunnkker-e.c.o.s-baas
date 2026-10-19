import { RefreshCw, TrendingUp, Clock, AlertTriangle, CheckCircle, PauseCircle, Archive, XCircle, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStudioDashboard } from '../hooks/use-campaign-studio';
import { usePendingApprovals } from '../hooks/use-campaign-approval';

export function StudioExecutiveDashboardPage() {
  const { data: dashboard, isLoading, refetch } = useStudioDashboard();
  const { data: approvals }                     = usePendingApprovals();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <TrendingUp className="size-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold">Studio Dashboard</h1>
            <p className="text-xs text-muted-foreground">Campaign operations overview across all providers</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="size-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6 space-y-8">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 rounded-lg border bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : dashboard ? (
          <>
            {/* Campaign Status KPIs */}
            <section>
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Campaign Status</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                <StatCard label="Drafts"         value={dashboard.campaigns.drafts}          icon={<Layers className="size-4" />} />
                <StatCard label="Pending Review" value={dashboard.campaigns.pending_review}  icon={<Clock className="size-4" />}  color="text-yellow-600" />
                <StatCard label="Approved"       value={dashboard.campaigns.approved}        icon={<CheckCircle className="size-4" />} color="text-blue-600" />
                <StatCard label="Scheduled"      value={dashboard.campaigns.scheduled}       icon={<Clock className="size-4" />}  color="text-purple-600" />
                <StatCard label="Active"         value={dashboard.campaigns.active}          icon={<TrendingUp className="size-4" />} color="text-green-600" />
                <StatCard label="Paused"         value={dashboard.campaigns.paused}          icon={<PauseCircle className="size-4" />} color="text-orange-500" />
                <StatCard label="Archived"       value={dashboard.campaigns.archived}        icon={<Archive className="size-4" />} color="text-gray-500" />
                <StatCard label="Failed"         value={dashboard.campaigns.failed}          icon={<XCircle className="size-4" />} color="text-red-600" />
                <StatCard label="Published Today" value={dashboard.campaigns.published_today} icon={<CheckCircle className="size-4" />} color="text-green-700" />
              </div>
            </section>

            {/* Publishing Queue */}
            <section>
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Publishing Queue</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Queued"      value={dashboard.publishing_queue.queued}      icon={<Clock className="size-4" />} />
                <StatCard label="Processing"  value={dashboard.publishing_queue.processing}  icon={<RefreshCw className="size-4" />} color="text-blue-600" />
                <StatCard label="Retrying"    value={dashboard.publishing_queue.retrying}    icon={<RefreshCw className="size-4" />} color="text-orange-500" />
                <StatCard label="Failed Today" value={dashboard.publishing_queue.failed_today} icon={<XCircle className="size-4" />} color="text-red-600" />
              </div>
            </section>

            {/* Health */}
            <section>
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Platform Health</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard label="Blocking Validation Issues" value={dashboard.health.blocking_validation_issues} icon={<AlertTriangle className="size-4" />} color={dashboard.health.blocking_validation_issues > 0 ? 'text-red-600' : 'text-green-600'} />
                <StatCard label="Failures (7d)"              value={dashboard.health.recent_failures_7d}         icon={<XCircle className="size-4" />}       color={dashboard.health.recent_failures_7d > 0 ? 'text-red-500' : 'text-green-600'} />
                <StatCard label="Version Changes (24h)"      value={dashboard.health.version_changes_24h}        icon={<Layers className="size-4" />} />
              </div>
            </section>

            {/* Pending Approvals */}
            {approvals && approvals.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">Pending Approvals ({approvals.length})</h2>
                <div className="border rounded-lg divide-y">
                  {approvals.slice(0, 10).map((approval) => (
                    <div key={approval.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">Approval #{approval.id.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">
                          Step {approval.current_step_order}/{approval.total_steps} · Submitted {new Date(approval.submitted_at).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full shrink-0">Awaiting decision</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color = 'text-foreground' }: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="border rounded-lg p-3 flex flex-col gap-2">
      <div className={`flex items-center gap-1.5 text-muted-foreground ${color}`}>{icon}</div>
      <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
      <p className="text-xs text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}
