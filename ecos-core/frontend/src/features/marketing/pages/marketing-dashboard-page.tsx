import { useMarketingDashboard, useTriggerSync } from '../hooks/use-marketing-sync';
import { useMarketingConnections, useDisconnectConnection } from '../hooks/use-marketing-connections';
import { ConnectionStatusBadge } from '../components/connection-status-badge';
import { ConnectorIcon } from '../components/connector-icon';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ds/use-toast';
import { ASSET_TYPE_LABELS, CONNECTOR_LABELS } from '../types/marketing';

export function MarketingDashboardPage() {
  const { data: dashboard, isLoading } = useMarketingDashboard();
  const { data: connectionsPage }      = useMarketingConnections({ per_page: 10 });
  const sync       = useTriggerSync();
  const disconnect = useDisconnectConnection();
  const { toast }  = useToast();

  const connections = connectionsPage?.data ?? [];

  function handleSync(connectionId: string) {
    sync.mutate(
      { connectionId, async: true },
      { onSuccess: () => toast({ title: 'Sync queued' }) },
    );
  }

  function handleDisconnect(connectionId: string, label: string) {
    if (!confirm(`Disconnect "${label}"? This will clear the access token.`)) return;
    disconnect.mutate(connectionId, {
      onSuccess: () => toast({ title: 'Connection disconnected' }),
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading…
      </div>
    );
  }

  const kpis = dashboard?.kpis;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Marketing OS</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage platform connections and asset mappings
          </p>
        </div>
        <Button
          onClick={() => window.location.href = '/marketing/connect/meta'}
          variant="default"
        >
          + Connect Platform
        </Button>
      </div>

      {/* KPI Cards */}
      {kpis && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <KpiCard label="Active Connections" value={kpis.active_connections} sub={`of ${kpis.total_connections} total`} />
          <KpiCard label="Total Assets"       value={kpis.total_assets} />
          <KpiCard label="Healthy Assets"     value={kpis.healthy_assets} accent="green" />
          <KpiCard label="Pending Suggestions" value={kpis.pending_suggestions} accent="yellow" />
          {kpis.warning_assets > 0 && (
            <KpiCard label="Warning Assets"  value={kpis.warning_assets} accent="yellow" />
          )}
          {kpis.error_assets > 0 && (
            <KpiCard label="Error Assets"    value={kpis.error_assets} accent="red" />
          )}
        </div>
      )}

      {/* Assets by type */}
      {dashboard?.assets_by_type && Object.keys(dashboard.assets_by_type).length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Assets by Type</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(dashboard.assets_by_type).map(([type, count]) => (
              <div
                key={type}
                className="rounded-md border bg-card px-3 py-1.5 text-sm flex items-center gap-2"
              >
                <span className="font-medium">
                  {ASSET_TYPE_LABELS[type as keyof typeof ASSET_TYPE_LABELS] ?? type}
                </span>
                <span className="text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Connections grid */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Connections</h2>
        {connections.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            No connections yet. Connect a platform to start discovering assets.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="rounded-lg border bg-card p-4 flex flex-col gap-3"
              >
                <div className="flex items-start gap-3">
                  <ConnectorIcon connector={conn.connector_type} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{conn.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {CONNECTOR_LABELS[conn.connector_type]}
                    </p>
                  </div>
                  <ConnectionStatusBadge status={conn.status} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {conn.assets_count !== undefined && (
                    <span>{conn.assets_count} assets</span>
                  )}
                  {conn.last_synced_at && (
                    <span className="ml-2">
                      Synced {new Date(conn.last_synced_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={conn.status !== 'active' || sync.isPending}
                    onClick={() => handleSync(conn.id)}
                  >
                    Sync
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDisconnect(conn.id, conn.label)}
                  >
                    Disconnect
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recent syncs */}
      {dashboard?.recent_syncs && dashboard.recent_syncs.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Recent Syncs</h2>
          <div className="rounded-md border divide-y text-sm">
            {dashboard.recent_syncs.map((log) => (
              <div key={log.id} className="px-4 py-2 flex items-center gap-4">
                <span
                  className={
                    log.status === 'completed'
                      ? 'text-green-600'
                      : log.status === 'failed'
                      ? 'text-red-600'
                      : 'text-muted-foreground'
                  }
                >
                  {log.status}
                </span>
                <span className="text-muted-foreground">{log.sync_type}</span>
                <span>{log.assets_discovered} discovered</span>
                <span className="text-green-600">+{log.assets_created} new</span>
                {log.started_at && (
                  <span className="ms-auto text-muted-foreground">
                    {new Date(log.started_at).toLocaleString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: 'green' | 'yellow' | 'red';
}) {
  const valueClass =
    accent === 'green'
      ? 'text-green-600'
      : accent === 'yellow'
      ? 'text-yellow-600'
      : accent === 'red'
      ? 'text-red-600'
      : 'text-foreground';

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold mt-1 ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
