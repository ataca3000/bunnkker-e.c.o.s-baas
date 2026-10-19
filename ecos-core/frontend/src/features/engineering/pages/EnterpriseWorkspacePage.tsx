import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ROUTES } from '@/router/routes';
import { useWorkspaceExecutive, useWorkspaceLive } from '../hooks/useWorkspace';
import { workspaceService, type ReleaseReadinessRow } from '../services/workspace-service';
import { EngineeringTimeline } from '../components/workspace/EngineeringTimeline';
import { GlobalSearchBar } from '../components/workspace/GlobalSearchBar';

function rateTone(value: number): string {
  if (value >= 90) return 'text-emerald-600 dark:text-emerald-400';
  if (value >= 70) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function debtTone(level: string): string {
  if (level === 'critical' || level === 'high') return 'text-red-600 dark:text-red-400';
  if (level === 'moderate') return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

function KpiCard({ label, value, tone, hint }: { label: string; value: string; tone?: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold tabular-nums ${tone ?? ''}`}>{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

function ReleaseReadinessTable({ releases }: { releases: ReleaseReadinessRow[] }) {
  const navigate = useNavigate();

  if (releases.length === 0) {
    return <p className="text-sm text-muted-foreground">No releases yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pe-4 font-medium">Release</th>
            <th className="py-2 pe-4 font-medium">Status</th>
            <th className="py-2 pe-4 font-medium">Readiness</th>
            <th className="py-2 pe-4 font-medium">Checks</th>
            <th className="py-2 pe-4 font-medium">Risks</th>
          </tr>
        </thead>
        <tbody>
          {releases.map((release) => (
            <tr
              key={release.id}
              className="cursor-pointer border-b last:border-0 hover:bg-muted/50"
              onClick={() => navigate(ROUTES.engineeringReleases)}
            >
              <td className="py-2 pe-4">
                {release.name} <span className="text-muted-foreground">v{release.version}</span>
              </td>
              <td className="py-2 pe-4"><Badge variant="outline">{release.status}</Badge></td>
              <td className="py-2 pe-4">
                {release.can_proceed
                  ? <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" variant="secondary">Ready</Badge>
                  : <Badge className="bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" variant="secondary">{release.blocking_issues} blocking</Badge>}
              </td>
              <td className="py-2 pe-4 tabular-nums">{release.passed_checks}/{release.passed_checks + release.failed_checks}</td>
              <td className="py-2 pe-4 tabular-nums">{release.risk_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EnterpriseWorkspacePage() {
  const navigate = useNavigate();
  const { data: executive, loading, error } = useWorkspaceExecutive(60000);
  const { data: live } = useWorkspaceLive(15000);

  const health = executive?.health;

  return (
    <div className="flex min-h-0 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Engineering Workspace</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Unified monitoring across repair, validation, guardian, intelligence, and releases
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.engineeringRepair)}>AI Repair</Button>
          <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.engineeringAiSupervisor)}>Supervisor</Button>
          <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.engineeringReleases)}>Releases</Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void workspaceService.downloadExport('repair_sessions')}
          >
            Export CSV
          </Button>
        </div>
      </div>

      <GlobalSearchBar />

      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && !executive && <p className="text-sm text-muted-foreground">Loading workspace…</p>}

      {health && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Repair Success" value={`${health.repair_success_rate}%`} tone={rateTone(health.repair_success_rate)} hint="30-day rate" />
          <KpiCard label="Validation Accept" value={`${health.validation_accept_rate}%`} tone={rateTone(health.validation_accept_rate)} hint="30-day rate" />
          <KpiCard label="Guardian Allow" value={`${health.guardian_allow_rate}%`} tone={rateTone(health.guardian_allow_rate)} hint="30-day rate" />
          <KpiCard
            label="Supervisor Score"
            value={health.supervisor_score !== null ? String(health.supervisor_score) : '—'}
            tone={health.supervisor_score !== null ? rateTone(health.supervisor_score) : undefined}
            hint="latest review"
          />
          <KpiCard label="Technical Debt" value={String(health.debt_score)} tone={debtTone(health.debt_level)} hint={health.debt_level} />
          <KpiCard
            label="In Flight"
            value={String((live?.active_repairs.length ?? 0) + (live?.active_guardian_runs.length ?? 0) + (live?.running_validations.length ?? 0))}
            hint="repairs + runs + validations"
          />
        </div>
      )}

      <Tabs defaultValue="live">
        <TabsList>
          <TabsTrigger value="live">Live Monitor</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="releases">Release Readiness</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="live" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active Repairs ({live?.active_repairs.length ?? 0})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(live?.active_repairs ?? []).length === 0 && <p className="text-muted-foreground">None in flight.</p>}
                {(live?.active_repairs ?? []).map((session) => (
                  <button
                    key={String(session.id)}
                    type="button"
                    className="block w-full truncate rounded px-2 py-1 text-left hover:bg-muted"
                    onClick={() => navigate(ROUTES.engineeringRepair)}
                  >
                    <Badge variant="outline" className="me-2">{String(session.status)}</Badge>
                    {String(session.failure_summary)}
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Running Validations ({live?.running_validations.length ?? 0})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(live?.running_validations ?? []).length === 0 && <p className="text-muted-foreground">None running.</p>}
                {(live?.running_validations ?? []).map((validation) => (
                  <div key={String(validation.id)} className="truncate px-2 py-1">
                    <Badge variant="outline" className="me-2">attempt {String(validation.attempt_number)}</Badge>
                    patch {String(validation.patch_id).slice(0, 8)}…
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active Guardian Runs ({live?.active_guardian_runs.length ?? 0})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(live?.active_guardian_runs ?? []).length === 0 && <p className="text-muted-foreground">None active.</p>}
                {(live?.active_guardian_runs ?? []).map((run) => (
                  <div key={String(run.id)} className="truncate px-2 py-1">
                    <Badge variant="outline" className="me-2">{String(run.status)}</Badge>
                    {String(run.branch ?? run.trigger_source)}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <EngineeringTimeline />
        </TabsContent>

        <TabsContent value="releases" className="mt-4">
          <ReleaseReadinessTable releases={executive?.releases ?? []} />
        </TabsContent>

        <TabsContent value="insights" className="mt-4">
          <div className="space-y-3">
            {(executive?.insights ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No open insights. Generate them from the Intelligence APIs.</p>
            )}
            {(executive?.insights ?? []).map((insight) => (
              <Card key={String(insight.id)}>
                <CardContent className="flex items-start gap-3 pt-4">
                  <Badge
                    variant="secondary"
                    className={
                      insight.severity === 'critical'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                    }
                  >
                    {String(insight.severity)}
                  </Badge>
                  <div>
                    <p className="text-sm font-medium">{String(insight.title)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{String(insight.description)}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
