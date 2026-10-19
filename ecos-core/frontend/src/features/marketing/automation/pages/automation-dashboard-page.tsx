import { Activity, CheckCircle, XCircle, Zap, TrendingUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAutomationDashboard } from '../hooks/use-automation-dashboard';

function StatCard({ label, value, sub, icon: Icon, color }: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-card border rounded-lg p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-2xl font-semibold">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        <p className="text-xs font-medium">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

export function AutomationDashboardPage() {
  const { t } = useTranslation('marketing');
  const { data, isLoading } = useAutomationDashboard();

  if (isLoading) {
    return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">{t($ => $.automation.dashboard.loading)}</div>;
  }

  if (!data) {
    return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">{t($ => $.common.noDataAvailable)}</div>;
  }

  const { kpis, trending_workflows, recent_executions, health } = data;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-6 py-4 border-b">
        <h1 className="text-lg font-semibold">{t($ => $.automation.dashboard.title)}</h1>
        <p className="text-xs text-muted-foreground">{t($ => $.automation.dashboard.subtitle)}</p>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard icon={Activity}      label={t($ => $.automation.dashboard.kpis.activeWorkflows)}  value={kpis.active}   color="bg-green-50 text-green-600" />
          <StatCard icon={Zap}           label={t($ => $.automation.dashboard.kpis.totalExecutions)}  value={kpis.total_executions} color="bg-blue-50 text-blue-600" />
          <StatCard icon={CheckCircle}   label={t($ => $.automation.dashboard.kpis.completed7d)}      value={health.completed_7d ?? 0} color="bg-emerald-50 text-emerald-600" />
          <StatCard icon={XCircle}       label={t($ => $.automation.dashboard.kpis.failed7d)}         value={health.failed_7d ?? 0}  color="bg-red-50 text-red-600" />
        </div>

        {/* Health + Success rate */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-3">{t($ => $.automation.dashboard.health.title)}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t($ => $.automation.dashboard.kpis.totalExecutions)}</span>
                <span className="font-medium">{(health.total_7d ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t($ => $.automation.executionStatus.completed)}</span>
                <span className="font-medium text-green-600">{(health.completed_7d ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t($ => $.automation.executionStatus.failed)}</span>
                <span className="font-medium text-red-600">{(health.failed_7d ?? 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-muted-foreground">{t($ => $.automation.dashboard.health.successRate)}</span>
                <span className={`font-semibold ${(health.success_rate ?? 0) >= 90 ? 'text-green-600' : 'text-yellow-600'}`}>
                  {health.success_rate ?? '—'}%
                </span>
              </div>
            </div>
          </div>

          <div className="bg-card border rounded-lg p-4">
            <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> {t($ => $.automation.dashboard.trending.title)}
            </h3>
            {trending_workflows.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t($ => $.automation.dashboard.trending.empty)}</p>
            ) : (
              <div className="space-y-2">
                {trending_workflows.map((wf, i) => (
                  <div key={wf.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                      <span className="truncate">{wf.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {t($ => $.automation.dashboard.trending.runs, { count: wf.execution_count })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent executions */}
        <div className="bg-card border rounded-lg p-4">
          <h3 className="text-sm font-medium mb-3">{t($ => $.automation.dashboard.recent.title)}</h3>
          {recent_executions.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t($ => $.automation.dashboard.recent.empty)}</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-start py-1.5 font-medium">{t($ => $.automation.dashboard.recent.columns.workflow)}</th>
                  <th className="text-start py-1.5 font-medium">{t($ => $.automation.dashboard.recent.columns.entity)}</th>
                  <th className="text-start py-1.5 font-medium">{t($ => $.common.status)}</th>
                  <th className="text-start py-1.5 font-medium">{t($ => $.automation.dashboard.recent.columns.time)}</th>
                </tr>
              </thead>
              <tbody>
                {recent_executions.map(exec => (
                  <tr key={exec.id} className="border-b last:border-0">
                    <td className="py-1.5 font-medium truncate max-w-32">{exec.workflow_name}</td>
                    <td className="py-1.5 text-muted-foreground">{exec.entity_type}</td>
                    <td className="py-1.5">
                      <span className={exec.status === 'completed' ? 'text-green-600' : exec.status === 'failed' ? 'text-red-600' : 'text-muted-foreground'}>
                        {t($ => $.automation.executionStatus[exec.status], { defaultValue: exec.status })}
                      </span>
                    </td>
                    <td className="py-1.5 text-muted-foreground">{new Date(exec.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
