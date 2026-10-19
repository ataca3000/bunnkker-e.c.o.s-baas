import { useTranslation } from 'react-i18next';
import { AlertTriangle, Bell, GitBranch } from 'lucide-react';

import { SmartToolbar } from '@/components/data-grid/smart-toolbar';
import { WorkspacePage } from '@/components/page/layout/workspace-page';
import { WorkspaceHeader } from '@/components/workspace/header/workspace-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

import {
  useAutomationMetrics,
  useAutomationMonitoring,
  useAutomationPolicies,
} from '../hooks/use-automation';

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Automation monitoring.
 *
 * Read-only by construction: the API exposes policies, consumers and metrics
 * and nothing that writes. Policies are declared in code, so this page offers
 * no toggle — a control that could not take effect would be worse than none.
 */
export function AutomationMonitoringPage() {
  const { t, i18n } = useTranslation('logistics');

  const policies = useAutomationPolicies();
  const monitoring = useAutomationMonitoring();
  const metrics = useAutomationMetrics();

  const isFetching = policies.isFetching || monitoring.isFetching || metrics.isFetching;
  const isError = policies.isError || monitoring.isError || metrics.isError;

  const dateTime = (value: string | undefined) =>
    value ? new Date(value).toLocaleString(i18n.language) : '—';

  function refreshAll() {
    void policies.refetch();
    void monitoring.refetch();
    void metrics.refetch();
  }

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[{ label: t(($) => $.title) }, { label: t(($) => $.automation.title) }]}
        title={t(($) => $.automation.title)}
        description={t(($) => $.automation.subtitle)}
      />

      <WorkspacePage
        toolbar={
          <div className="px-4 sm:px-6">
            <SmartToolbar
              onRefresh={refreshAll}
              isFetching={isFetching}
              refreshLabel={t(($) => $.automation.refresh)}
            />
          </div>
        }
      >
        <div className="flex flex-col gap-6 px-4 pb-6 sm:px-6">
          <p className="text-[11px] text-muted-foreground">
            {t(($) => $.automation.readOnlyNote)}
          </p>

          {isError && (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.automation.error)}</AlertDescription>
            </Alert>
          )}

          <Section title={t(($) => $.automation.metrics.title)}>
            {metrics.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              metrics.data && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Stat
                    label={`${t(($) => $.automation.metrics.exceptions)} · ${t(($) => $.automation.metrics.outstanding)}`}
                    value={metrics.data.exceptions.outstanding}
                  />
                  <Stat
                    label={`${t(($) => $.automation.metrics.exceptions)} · ${t(($) => $.automation.metrics.critical)}`}
                    value={
                      <span className="flex items-center gap-2">
                        {metrics.data.exceptions.critical}
                        {metrics.data.exceptions.critical > 0 && (
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                        )}
                      </span>
                    }
                  />
                  <Stat
                    label={`${t(($) => $.automation.metrics.exceptions)} · ${t(($) => $.automation.metrics.overdue)}`}
                    value={metrics.data.exceptions.overdue_for_escalation}
                  />
                  <Stat
                    label={`${t(($) => $.automation.metrics.conflicts)} · ${t(($) => $.automation.metrics.open)}`}
                    value={metrics.data.conflicts.open}
                  />
                  <Stat
                    label={`${t(($) => $.automation.metrics.conflicts)} · ${t(($) => $.automation.metrics.blocking)}`}
                    value={metrics.data.conflicts.blocking}
                  />
                  <Stat
                    label={`${t(($) => $.automation.metrics.alerts)} · ${t(($) => $.automation.metrics.unacknowledged)}`}
                    value={
                      <span className="flex items-center gap-2">
                        {metrics.data.alerts.unacknowledged}
                        {metrics.data.alerts.unacknowledged > 0 && (
                          <Bell className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        )}
                      </span>
                    }
                  />
                </div>
              )
            )}
          </Section>

          <Section title={t(($) => $.automation.monitoring.title)}>
            {monitoring.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              monitoring.data && (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <Stat
                      label={t(($) => $.automation.monitoring.consumers)}
                      value={monitoring.data.consumer_count}
                    />
                    <Stat
                      label={t(($) => $.automation.monitoring.eventsConsumed)}
                      value={monitoring.data.events_consumed}
                    />
                    <Stat
                      label={t(($) => $.automation.monitoring.activePolicyCount)}
                      value={`${monitoring.data.active_policy_count} / ${monitoring.data.policy_count}`}
                    />
                    <Stat
                      label={t(($) => $.automation.monitoring.eventLogging)}
                      value={
                        monitoring.data.event_logging
                          ? t(($) => $.automation.monitoring.enabled)
                          : t(($) => $.automation.monitoring.disabled)
                      }
                    />
                    <Stat
                      label={t(($) => $.automation.monitoring.queueConnection)}
                      value={monitoring.data.queue?.connection ?? '—'}
                    />
                    <Stat
                      label={t(($) => $.automation.monitoring.generatedAt)}
                      value={dateTime(monitoring.data.generated_at)}
                    />
                  </div>

                  {monitoring.data.consumers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t(($) => $.automation.monitoring.empty)}
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border bg-card">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="px-3 py-2 text-start font-medium">
                              {t(($) => $.automation.policies.event)}
                            </th>
                            <th className="px-3 py-2 text-start font-medium">
                              {t(($) => $.automation.monitoring.consumers)}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {monitoring.data.consumers.map((consumer, index) => (
                            <tr key={`${consumer.event}-${consumer.consumer}-${index}`}>
                              <td className="px-3 py-2">{consumer.event}</td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {consumer.consumer}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )
            )}
          </Section>

          <Section title={t(($) => $.automation.policies.title)}>
            {policies.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (policies.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t(($) => $.automation.policies.empty)}
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border bg-card">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 text-start font-medium">
                        {t(($) => $.automation.policies.name)}
                      </th>
                      <th className="px-3 py-2 text-start font-medium">
                        {t(($) => $.automation.policies.event)}
                      </th>
                      <th className="px-3 py-2 text-start font-medium">
                        {t(($) => $.automation.policies.action)}
                      </th>
                      <th className="px-3 py-2 text-start font-medium">
                        {t(($) => $.automation.policies.channel)}
                      </th>
                      <th className="px-3 py-2 text-start font-medium">
                        {t(($) => $.automation.policies.active)}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(policies.data ?? []).map((policy) => (
                      <tr key={policy.name}>
                        <td className="px-3 py-2 font-medium">
                          <span className="flex items-center gap-2">
                            <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                            {policy.name}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{policy.event}</td>
                        <td className="px-3 py-2">{policy.action}</td>
                        <td className="px-3 py-2 text-muted-foreground">{policy.channel ?? '—'}</td>
                        <td className="px-3 py-2">
                          <Badge variant={policy.active ? 'outline' : 'secondary'}>
                            {policy.active
                              ? t(($) => $.automation.policies.active)
                              : t(($) => $.automation.policies.inactive)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>
        </div>
      </WorkspacePage>
    </>
  );
}

export default AutomationMonitoringPage;
