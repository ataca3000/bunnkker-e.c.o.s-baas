import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Settings2, AlertTriangle } from 'lucide-react';
import { useMetaAuthUrl, useMetaCallback } from '../hooks/use-meta-auth';
import { useProviderConfig } from '../hooks/use-provider-config';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ds/use-toast';
import { ConnectorIcon } from '../components/connector-icon';
import { MetaConfigWizard } from '../components/MetaConfigWizard';
import { ProviderStatusBadge } from '../components/provider-status-badge';

/**
 * Meta Connect page.
 *
 * Responsibilities:
 * 1. If Meta is not configured → show Not Configured state + [Configure Meta] wizard
 * 2. If configured → show Connect button → initiates OAuth
 * 3. Callback handler → reads ?code=&state= from URL and completes OAuth
 */
export function MetaConnectPage() {
  const [params]  = useSearchParams();
  const navigate  = useNavigate();
  const { toast } = useToast();

  const getUrl   = useMetaAuthUrl();
  const callback = useMetaCallback();
  const { data: providerConfig, isLoading: configLoading, refetch: refetchConfig } = useProviderConfig('meta');

  const [showWizard, setShowWizard] = useState(false);

  const code  = params.get('code');
  const state = params.get('state');

  // Auto-handle OAuth callback if URL has code + state
  useEffect(() => {
    if (!code || !state) return;
    if (callback.isPending || callback.isSuccess || callback.isError) return;

    callback.mutate(
      { code, state },
      {
        onSuccess: (data) => {
          toast({ title: 'Meta connected! Businesses are being discovered in the background.' });
          navigate(`/marketing/meta/connection/${data.connection.id}`, { replace: true });
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { message?: string } } })
            ?.response?.data?.message ?? 'Connection failed. Please try again.';
          toast({ title: 'Connection failed', description: msg, variant: 'destructive' });
        },
      },
    );
  }, [code, state]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleConnect() {
    const companyId = (window as unknown as Record<string, string>).__ECOS_COMPANY_ID__ ?? '';
    getUrl.mutate(companyId, {
      onSuccess: ({ url }) => { window.location.href = url; },
      onError: (err: unknown) => {
        const reason = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        if (reason === 'not_configured') {
          setShowWizard(true);
        } else {
          toast({ title: 'Failed to generate auth URL', variant: 'destructive' });
        }
      },
    });
  }

  // ── OAuth callback in progress ────────────────────────────────────────────

  if (code && state) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <ConnectorIcon connector="meta" size="lg" />
        <p className="text-sm text-muted-foreground">
          {callback.isPending
            ? 'Completing Meta connection…'
            : callback.isError
            ? 'Connection failed. Please close this page and try again.'
            : 'Connected!'}
        </p>
      </div>
    );
  }

  const isUnconfigured = !providerConfig?.status || providerConfig.status === 'not_configured' || providerConfig.status === 'invalid';

  // ── Config wizard ─────────────────────────────────────────────────────────

  if (showWizard || (isUnconfigured && !configLoading)) {
    return (
      <div className="max-w-lg mx-auto mt-12 px-4">
        <div className="rounded-xl border bg-card shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-semibold">Meta Configuration</h1>
              <p className="text-xs text-muted-foreground">Enterprise Setup Wizard</p>
            </div>
          </div>

          <MetaConfigWizard
            config={providerConfig ?? {
              provider: 'meta',
              app_id: null,
              has_app_secret: false,
              redirect_uri: null,
              default_redirect_uri: `${window.location.origin}/api/marketing/meta/auth/callback`,
              status: 'not_configured',
              validated_at: null,
              last_updated_at: null,
            }}
            onComplete={() => {
              setShowWizard(false);
              refetchConfig();
            }}
            onCancel={isUnconfigured ? undefined : () => setShowWizard(false)}
          />
        </div>
      </div>
    );
  }

  // ── Not configured gate ───────────────────────────────────────────────────

  if (isUnconfigured || configLoading) {
    return (
      <div className="max-w-md mx-auto mt-20 space-y-6 p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <ConnectorIcon connector="meta" size="lg" />
          <div>
            <h1 className="text-xl font-semibold">Meta Connector</h1>
            <div className="mt-2">
              <ProviderStatusBadge status={providerConfig?.status ?? 'not_configured'} />
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-4">
          <div className="flex gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Meta Connector is not configured yet.
              </p>
              <p className="text-amber-700 dark:text-amber-300 text-xs">
                Complete the setup before connecting your Meta Business account.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-2 text-sm text-muted-foreground">
          {[
            'Connect with Meta',
            'Sync',
            'Import Pages',
            'Import Ad Accounts',
            'Import Campaigns',
            'Webhook Registration',
          ].map((action) => (
            <div key={action} className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
              <span className="line-through opacity-50">{action}</span>
              <span className="text-xs text-muted-foreground/60 not-italic">(unavailable)</span>
            </div>
          ))}
        </div>

        <Button className="w-full" onClick={() => setShowWizard(true)}>
          <Settings2 className="h-4 w-4 mr-2" />
          Configure Meta
        </Button>
      </div>
    );
  }

  // ── Configured: show Connect button ──────────────────────────────────────

  return (
    <div className="max-w-md mx-auto mt-20 space-y-6 p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <ConnectorIcon connector="meta" size="lg" />
        <div>
          <h1 className="text-xl font-semibold">Connect Meta</h1>
          <div className="mt-2">
            <ProviderStatusBadge status={providerConfig.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Connect your Meta Business account to discover and manage all your
            Meta assets — Ad Accounts, Pages, Pixels, Catalogs, and more.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
        <p className="font-medium">Permissions requested:</p>
        <ul className="list-disc list-inside text-muted-foreground space-y-1">
          <li>Business management</li>
          <li>Ads management &amp; read</li>
          <li>Pages &amp; Instagram</li>
          <li>Catalog management</li>
        </ul>
      </div>

      <Button className="w-full" onClick={handleConnect} disabled={getUrl.isPending}>
        {getUrl.isPending ? 'Redirecting to Meta…' : 'Connect with Meta'}
      </Button>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>No passwords stored.</span>
        <button
          type="button"
          className="underline underline-offset-2 hover:text-foreground"
          onClick={() => setShowWizard(true)}
        >
          Reconfigure
        </button>
      </div>
    </div>
  );
}
