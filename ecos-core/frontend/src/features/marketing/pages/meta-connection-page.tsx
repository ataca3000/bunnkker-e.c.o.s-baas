import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Building2,
  Shield,
  ChevronRight,
  Clock,
  Loader2,
  Webhook,
  Trash2,
  RotateCcw,
  PlusCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ds/use-toast';
import { ConnectorIcon } from '../components/connector-icon';
import {
  useMetaConnectionDashboard,
  useMetaBusinesses,
  useMetaTriggerSync,
  useMetaDisconnect,
  useVerifyMetaPermissions,
  useSyncStatus,
  useMetaWebhooks,
  useRegisterAllWebhooks,
  useRemoveWebhook,
  useReRegisterWebhook,
} from '../hooks/use-meta-connection';
import { ROUTES } from '@/router/routes';

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(status: string) {
  if (['healthy', 'connected'].includes(status)) return 'text-green-600 dark:text-green-400';
  if (['warning', 'expired'].includes(status))   return 'text-amber-600 dark:text-amber-400';
  if (['disconnected', 'error'].includes(status)) return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
}

function statusDot(status: string) {
  if (['healthy', 'connected'].includes(status)) return 'bg-green-500';
  if (['warning', 'expired'].includes(status))   return 'bg-amber-500';
  if (['disconnected', 'error'].includes(status)) return 'bg-red-500';
  return 'bg-muted-foreground/40';
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function tokenExpiry(iso: string | null | undefined): { label: string; warn: boolean } {
  if (!iso) return { label: 'Unknown', warn: false };
  const diff = new Date(iso).getTime() - Date.now();
  const days = Math.floor(diff / 86_400_000);
  if (diff < 0)        return { label: 'Expired', warn: true };
  if (days < 7)        return { label: `${days}d left`, warn: true };
  if (days < 30)       return { label: `${days}d left`, warn: false };
  return { label: `${days}d left`, warn: false };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ title, children, icon: Icon }: {
  title: string;
  children: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b bg-muted/30">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <span className="text-sm font-semibold">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function PermissionRow({ scope, granted }: { scope: string; granted: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm font-mono text-muted-foreground">{scope}</span>
      {granted
        ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        : <XCircle     className="h-4 w-4 text-red-500 shrink-0" />}
    </div>
  );
}

const WEBHOOK_LABELS: Record<string, string> = {
  page:                       'Facebook Page',
  instagram:                  'Instagram Business',
  leadgen:                    'Lead Forms',
  commerce:                   'Commerce',
  whatsapp_business_account:  'WhatsApp Business',
  catalog:                    'Product Catalog',
};

function webhookStatusColor(status: string) {
  if (status === 'active')               return 'text-green-600 dark:text-green-400';
  if (status === 'pending_verification') return 'text-amber-600 dark:text-amber-400';
  if (status === 'failed')               return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
}

function webhookStatusDot(status: string) {
  if (status === 'active')               return 'bg-green-500';
  if (status === 'pending_verification') return 'bg-amber-500';
  if (status === 'failed')               return 'bg-red-500';
  return 'bg-muted-foreground/40';
}

function BusinessCard({ name, externalId, metadata }: {
  name: string;
  externalId: string;
  metadata?: Record<string, unknown> | null;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border bg-background p-4 hover:bg-muted/30 transition-colors">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Building2 className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">{name}</p>
        <p className="text-xs text-muted-foreground font-mono mt-0.5">ID: {externalId}</p>
        {metadata?.timezone_id != null && (
          <p className="text-xs text-muted-foreground mt-0.5">
            TZ: {String(metadata.timezone_id)}
          </p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function MetaConnectionPage() {
  const { id: connectionId } = useParams<{ id: string }>();
  const navigate             = useNavigate();
  const { toast }            = useToast();

  const [permissionsOpen, setPermissionsOpen] = useState(false);

  const dashboard           = useMetaConnectionDashboard(connectionId);
  const businesses          = useMetaBusinesses(connectionId);
  const syncStatus          = useSyncStatus(connectionId);
  const webhooks            = useMetaWebhooks(connectionId);
  const triggerSync         = useMetaTriggerSync(connectionId ?? '');
  const registerAllWebhooks = useRegisterAllWebhooks(connectionId ?? '');
  const removeWebhook       = useRemoveWebhook(connectionId ?? '');
  const reRegisterWebhook   = useReRegisterWebhook(connectionId ?? '');
  const disconnect          = useMetaDisconnect(connectionId ?? '');
  const verifyPerms         = useVerifyMetaPermissions(connectionId ?? '');

  const conn        = dashboard.data?.connection;
  const syncRunning = syncStatus.data?.is_running ?? dashboard.data?.recent_syncs?.some((s) => s.status === 'running') ?? false;

  function handleDisconnect() {
    if (!confirm('Disconnect Meta? All synced assets will remain but the connection will be deactivated.')) return;
    disconnect.mutate(undefined, {
      onSuccess: () => {
        toast({ title: 'Meta disconnected.' });
        navigate(ROUTES.marketingConnectMeta, { replace: true });
      },
      onError: () => toast({ title: 'Disconnect failed', variant: 'destructive' }),
    });
  }

  function handleSync() {
    triggerSync.mutate(undefined, {
      onSuccess: () => toast({ title: 'Sync dispatched. Businesses will refresh shortly.' }),
      onError: () => toast({ title: 'Sync failed to dispatch', variant: 'destructive' }),
    });
  }

  function handleVerifyPermissions() {
    setPermissionsOpen(true);
    verifyPerms.mutate(undefined, {
      onError: () => toast({ title: 'Permission check failed', variant: 'destructive' }),
    });
  }

  // ── Loading state ──────────────────────────────────────────────────────────

  if (dashboard.isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (dashboard.isError || !conn) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-4">
        <XCircle className="h-10 w-10 text-red-500 mx-auto" />
        <p className="text-sm text-muted-foreground">Connection not found.</p>
        <Button variant="outline" onClick={() => navigate(ROUTES.marketingConnectMeta)}>
          Go Back
        </Button>
      </div>
    );
  }

  const expiry = tokenExpiry(conn.token_expires_at);

  // ── Page ──────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ConnectorIcon connector="meta" size="lg" />
          <div>
            <h1 className="text-lg font-semibold">{conn.label}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`h-2 w-2 rounded-full ${statusDot(conn.status)}`} />
              <span className={`text-sm font-medium capitalize ${statusColor(conn.status)}`}>
                {conn.status}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={triggerSync.isPending || syncRunning}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${syncRunning ? 'animate-spin' : ''}`} />
            {syncRunning ? 'Syncing…' : 'Sync Now'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={handleDisconnect}
            disabled={disconnect.isPending}
          >
            <LogOut className="h-3.5 w-3.5 mr-1.5" />
            Disconnect
          </Button>
        </div>
      </div>

      {/* Sync progress banner */}
      {syncRunning && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 px-4 py-3 text-sm">
          <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="font-medium text-blue-800 dark:text-blue-200">Sync in progress</span>
            {syncStatus.data?.last_sync?.started_at && (
              <span className="text-blue-700 dark:text-blue-300 ml-2">
                started {fmtDate(syncStatus.data.last_sync.started_at)}
              </span>
            )}
          </div>
          {syncStatus.data?.last_sync?.assets_discovered != null && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              {syncStatus.data.last_sync.assets_discovered} assets
            </Badge>
          )}
        </div>
      )}

      {/* Connection Details */}
      <SectionCard title="Connection Details">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Meta Account ID</dt>
            <dd className="font-mono">{conn.external_account_id ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Connected At</dt>
            <dd>{fmtDate(conn.connected_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Last Synced</dt>
            <dd>{fmtDate(conn.last_synced_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">Token Expires</dt>
            <dd className="flex items-center gap-1.5">
              <Clock className={`h-3.5 w-3.5 ${expiry.warn ? 'text-amber-500' : 'text-muted-foreground'}`} />
              <span className={expiry.warn ? 'text-amber-600 dark:text-amber-400 font-medium' : ''}>
                {expiry.label}
              </span>
            </dd>
          </div>
        </dl>

        {expiry.warn && (
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-800 dark:text-amber-200">Token expiring soon</p>
              <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                Reconnect via the Connect Meta page to refresh your access token.
              </p>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Permissions */}
      <SectionCard title="Permissions" icon={Shield}>
        {!permissionsOpen ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Verify that all required Meta API permissions are granted.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleVerifyPermissions}
              disabled={verifyPerms.isPending}
            >
              {verifyPerms.isPending
                ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                : <Shield   className="h-3.5 w-3.5 mr-1.5" />}
              Verify Now
            </Button>
          </div>
        ) : verifyPerms.isPending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking permissions with Meta…
          </div>
        ) : verifyPerms.data ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {verifyPerms.data.valid
                  ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                  : <AlertTriangle className="h-4 w-4 text-amber-500" />}
                <span className="text-sm font-medium">
                  {verifyPerms.data.valid ? 'All permissions granted' : `${verifyPerms.data.missing.length} missing`}
                </span>
              </div>
              <Badge variant={verifyPerms.data.valid ? 'default' : 'destructive'} className="text-xs">
                {verifyPerms.data.granted.length} / {verifyPerms.data.granted.length + verifyPerms.data.missing.length}
              </Badge>
            </div>
            <div className="divide-y rounded-lg border overflow-hidden">
              {verifyPerms.data.granted.map((s) => (
                <PermissionRow key={s} scope={s} granted={true} />
              ))}
              {verifyPerms.data.missing.map((s) => (
                <PermissionRow key={s} scope={s} granted={false} />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No permission data available.</p>
        )}
      </SectionCard>

      {/* Businesses — Phase 4 */}
      <SectionCard title="Meta Business Accounts" icon={Building2}>
        {businesses.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Discovering businesses…
          </div>
        ) : businesses.isError ? (
          <p className="text-sm text-destructive">Failed to load businesses.</p>
        ) : (businesses.data?.businesses?.length ?? 0) === 0 ? (
          <div className="py-6 text-center space-y-3">
            {syncRunning ? (
              <>
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  Asset discovery is running in the background.
                  <br />
                  Businesses will appear here once the sync completes.
                </p>
              </>
            ) : (
              <>
                <Building2 className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">No businesses discovered yet.</p>
                <Button variant="outline" size="sm" onClick={handleSync} disabled={triggerSync.isPending}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Discover Businesses
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground mb-3">
              {businesses.data!.businesses.length} business{businesses.data!.businesses.length !== 1 ? 'es' : ''} discovered
            </p>
            {businesses.data!.businesses.map((biz) => (
              <BusinessCard
                key={biz.id}
                name={biz.name}
                externalId={biz.external_id}
                metadata={biz.asset_metadata}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {/* Webhook Subscriptions */}
      <SectionCard title="Webhook Subscriptions" icon={Webhook}>
        {webhooks.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading webhooks…
          </div>
        ) : (webhooks.data?.webhooks?.length ?? 0) === 0 ? (
          <div className="py-6 text-center space-y-3">
            <Webhook className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <p className="text-sm text-muted-foreground">
              No webhooks registered yet. Register all standard subscriptions to receive real-time Meta events.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => registerAllWebhooks.mutate(undefined, {
                onSuccess: () => toast({ title: 'Webhooks registered.' }),
                onError:   () => toast({ title: 'Registration failed', variant: 'destructive' }),
              })}
              disabled={registerAllWebhooks.isPending}
            >
              {registerAllWebhooks.isPending
                ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                : <PlusCircle className="h-3.5 w-3.5 mr-1.5" />}
              Register All
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">
                {webhooks.data!.webhooks.length} subscription{webhooks.data!.webhooks.length !== 1 ? 's' : ''}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => registerAllWebhooks.mutate(undefined, {
                  onSuccess: () => toast({ title: 'Webhooks registered.' }),
                  onError:   () => toast({ title: 'Registration failed', variant: 'destructive' }),
                })}
                disabled={registerAllWebhooks.isPending}
              >
                {registerAllWebhooks.isPending
                  ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  : <PlusCircle className="h-3.5 w-3.5 mr-1.5" />}
                Register All
              </Button>
            </div>

            {webhooks.data!.webhooks.map((wh) => (
              <div
                key={wh.id}
                className="flex items-center justify-between rounded-lg border bg-background p-3 gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${webhookStatusDot(wh.status)}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {WEBHOOK_LABELS[wh.object_type] ?? wh.object_type}
                    </p>
                    <p className={`text-xs capitalize ${webhookStatusColor(wh.status)}`}>
                      {wh.status.replace(/_/g, ' ')}
                      {wh.verified_at && (
                        <span className="text-muted-foreground ml-1.5">
                          · verified {fmtDate(wh.verified_at)}
                        </span>
                      )}
                    </p>
                    {wh.last_error && (
                      <p className="text-xs text-red-500 truncate mt-0.5">{wh.last_error}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {wh.status !== 'active' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Re-register"
                      onClick={() => reRegisterWebhook.mutate(wh.id, {
                        onSuccess: () => toast({ title: 'Webhook re-registered.' }),
                        onError:   () => toast({ title: 'Re-registration failed', variant: 'destructive' }),
                      })}
                      disabled={reRegisterWebhook.isPending}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    title="Remove"
                    onClick={() => {
                      if (!confirm(`Remove ${WEBHOOK_LABELS[wh.object_type] ?? wh.object_type} webhook?`)) return;
                      removeWebhook.mutate(wh.id, {
                        onSuccess: () => toast({ title: 'Webhook removed.' }),
                        onError:   () => toast({ title: 'Remove failed', variant: 'destructive' }),
                      });
                    }}
                    disabled={removeWebhook.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Recent Sync History */}
      {(dashboard.data?.recent_syncs?.length ?? 0) > 0 && (
        <SectionCard title="Recent Syncs">
          <div className="divide-y text-sm">
            {dashboard.data!.recent_syncs.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  {s.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  {s.status === 'failed'    && <XCircle      className="h-4 w-4 text-red-500" />}
                  {s.status === 'running'   && <Loader2      className="h-4 w-4 animate-spin text-blue-500" />}
                  {!['completed', 'failed', 'running'].includes(s.status) && (
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-muted-foreground">{fmtDate(s.started_at)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="capitalize">{s.sync_type}</span>
                  {s.assets_discovered != null && (
                    <span>{s.assets_discovered} assets</span>
                  )}
                  <Badge
                    variant={s.status === 'completed' ? 'default' : s.status === 'failed' ? 'destructive' : 'secondary'}
                    className="text-xs"
                  >
                    {s.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
