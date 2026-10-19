import { Briefcase, Globe, History, Key, Pencil, Webhook } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import type { BusinessAccount } from '@/features/business-accounts/types/business-account';
import { useChannelsQuery } from '@/features/channels/hooks/use-channels';

type BusinessAccountDetailDrawerProps = {
  account: BusinessAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (account: BusinessAccount) => void;
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive'> = {
  active: 'default',
  inactive: 'secondary',
  suspended: 'destructive',
};

const TAB_CLS =
  'flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full text-xs';

// ── Skeleton + empty ──────────────────────────────────────────────────────────

function RelationshipSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[1, 2].map((i) => (
        <div key={i} className="h-12 rounded-md border bg-muted/20 animate-pulse" />
      ))}
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ account, channelsCount }: { account: BusinessAccount; channelsCount: number }) {
  return (
    <div className="flex flex-col gap-5">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Sales Channels', value: channelsCount },
          { label: 'Status', value: account.status.charAt(0).toUpperCase() + account.status.slice(1) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-md border bg-muted/30 p-2.5 text-center">
            <p className="text-lg font-bold">{value}</p>
            <p className="text-[10px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {account.logo && (
        <div className="flex justify-center">
          <img src={account.logo} alt={account.name} className="h-16 w-16 rounded-lg object-contain border" />
        </div>
      )}

      <dl className="grid gap-3 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Code</dt>
          <dd className="font-mono font-medium">{account.code}</dd>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Name</dt>
          <dd className="font-medium">{account.name}</dd>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Provider</dt>
          <dd>
            <Badge variant="secondary">{account.provider}</Badge>
          </dd>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Company</dt>
          <dd>{account.company?.name ?? '—'}</dd>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Brand</dt>
          <dd>{account.brand?.name ?? '—'}</dd>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Status</dt>
          <dd>
            <Badge variant={STATUS_VARIANT[account.status] ?? 'secondary'}>
              {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
            </Badge>
          </dd>
        </div>
        {account.description && (
          <>
            <Separator />
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">Description</dt>
              <dd className="text-sm">{account.description}</dd>
            </div>
          </>
        )}
        <Separator />
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Created</dt>
          <dd className="text-muted-foreground text-xs">
            {account.created_at ? new Date(account.created_at).toLocaleDateString() : '—'}
          </dd>
        </div>
      </dl>
    </div>
  );
}

function CredentialsTab() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">API Credentials</p>
          <p className="text-xs text-muted-foreground">Authentication keys for this account</p>
        </div>
        <Badge variant="outline" className="text-xs">Not configured</Badge>
      </div>
      <Separator />
      {['API Key', 'API Secret', 'Access Token'].map((label) => (
        <div key={label} className="flex items-center justify-between rounded-md border px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Key className="size-3.5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{label}</span>
          </div>
          <Badge variant="secondary" className="text-xs">Not set</Badge>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground/60 text-center pt-2">
        Credential management will be available in a future update.
      </p>
    </div>
  );
}

function SynchronizationTab() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Sync Configuration</p>
          <p className="text-xs text-muted-foreground">Control what data syncs with this account</p>
        </div>
        <Badge variant="outline" className="text-xs">Idle</Badge>
      </div>
      <Separator />
      {[
        { label: 'Products', desc: 'Sync product catalog' },
        { label: 'Orders', desc: 'Import incoming orders' },
        { label: 'Inventory', desc: 'Update stock levels' },
        { label: 'Customers', desc: 'Sync customer profiles' },
      ].map(({ label, desc }) => (
        <div key={label} className="flex items-center justify-between rounded-md border px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
          <Badge variant="secondary" className="text-xs">Disabled</Badge>
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground/60 text-center pt-2">
        Synchronization settings will be configurable in a future update.
      </p>
    </div>
  );
}

function WebhooksTab() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Webhooks</p>
          <p className="text-xs text-muted-foreground">Incoming webhook endpoints for this account</p>
        </div>
        <Badge variant="outline" className="text-xs">0 registered</Badge>
      </div>
      <Separator />
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center rounded-md border border-dashed">
        <Webhook className="size-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No webhooks registered</p>
        <p className="text-xs text-muted-foreground/60 max-w-xs">
          Webhook registration will be available once integration credentials are configured.
        </p>
      </div>
    </div>
  );
}

// ── Drawer ────────────────────────────────────────────────────────────────────

export function BusinessAccountDetailDrawer({
  account,
  open,
  onOpenChange,
  onEdit,
}: BusinessAccountDetailDrawerProps) {
  if (!account) return null;

  const channelsResult = useChannelsQuery({ business_account_id: account.id, per_page: 50 }, { enabled: open });
  const channels = channelsResult.data?.items ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col overflow-hidden p-0">
        <SheetTitle className="sr-only">{account.name} — Integration Account Details</SheetTitle>

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-3 border-b px-6 py-5 flex-none pr-14">
          <div className="flex items-center gap-3 min-w-0">
            <div className="bg-primary/10 flex size-10 items-center justify-center rounded-lg shrink-0">
              <Briefcase className="text-primary size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-semibold leading-none truncate">{account.name}</span>
                <Badge
                  variant={STATUS_VARIANT[account.status] ?? 'secondary'}
                  className="text-[10px] px-1.5 py-0 shrink-0"
                >
                  {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
                </Badge>
              </div>
              <SheetDescription className="font-mono text-xs mt-0.5">{account.code}</SheetDescription>
            </div>
          </div>
          {onEdit && (
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => onEdit(account)}>
              <Pencil className="size-3.5 mr-1" />
              Edit
            </Button>
          )}
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          <Tabs defaultValue="overview">
            <div className="sticky top-0 z-10 bg-background border-b">
              <TabsList className="w-full rounded-none border-0 bg-transparent h-10 gap-0 p-0">
                <TabsTrigger value="overview"     className={TAB_CLS}>Overview</TabsTrigger>
                <TabsTrigger value="channels"     className={TAB_CLS}>Channels</TabsTrigger>
                <TabsTrigger value="credentials"  className={TAB_CLS}>Credentials</TabsTrigger>
                <TabsTrigger value="sync"         className={TAB_CLS}>Sync</TabsTrigger>
                <TabsTrigger value="webhooks"     className={TAB_CLS}>Webhooks</TabsTrigger>
                <TabsTrigger value="activity"     className={TAB_CLS}>Activity</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="m-0 px-6 py-5">
              <OverviewTab account={account} channelsCount={channelsResult.data?.meta.total ?? 0} />
            </TabsContent>

            <TabsContent value="channels" className="m-0 px-6 py-5">
              {channelsResult.isLoading ? (
                <RelationshipSkeleton />
              ) : channels.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-muted/50">
                    <Globe className="text-muted-foreground/50 size-7" />
                  </div>
                  <p className="text-muted-foreground text-sm">No channels linked to this account.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {channels.map((channel) => (
                    <div
                      key={channel.id}
                      className="flex items-center gap-3 rounded-md border px-3 py-2.5"
                    >
                      <div className="bg-primary/10 flex size-7 items-center justify-center rounded shrink-0">
                        <Globe className="text-primary size-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{channel.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{channel.store_url}</p>
                      </div>
                      <Badge variant="secondary" className="text-[10px] shrink-0">
                        {channel.platform_label}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="credentials" className="m-0 px-6 py-5">
              <CredentialsTab />
            </TabsContent>

            <TabsContent value="sync" className="m-0 px-6 py-5">
              <SynchronizationTab />
            </TabsContent>

            <TabsContent value="webhooks" className="m-0 px-6 py-5">
              <WebhooksTab />
            </TabsContent>

            <TabsContent value="activity" className="m-0 px-6 py-5">
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-muted/50">
                  <History className="text-muted-foreground/50 size-7" />
                </div>
                <p className="text-muted-foreground text-sm">Activity timeline will be available in a future update.</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
