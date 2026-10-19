import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, PlugZap, XCircle } from 'lucide-react';

import { PageDrawer } from '@/components/page/drawer/page-drawer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermission } from '@/features/authorization';

import {
  useCarrierAccount,
  useCarrierCapabilities,
  useCarrierStatusMappings,
  useTestCarrierConnection,
  useUpsertStatusMapping,
} from '../hooks/use-carriers';

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}

/**
 * One carrier account: what it is, what it can do, and how its statuses map.
 *
 * Capabilities show `absence_meaning` for anything unsupported, because absence
 * is not uniformly "unavailable" — for some capabilities it means the platform
 * handles that itself. Showing only a red cross would misread the contract.
 */
export function CarrierAccountDrawer({
  accountId,
  open,
  onOpenChange,
}: {
  accountId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation('logistics');
  const { can } = usePermission();
  const canManage = can('carrier.manage');

  const [tab, setTab] = useState('overview');
  const { data: account, isLoading } = useCarrierAccount(open ? accountId : null);
  const { data: capabilities } = useCarrierCapabilities(open ? accountId : null);
  const { data: mappings } = useCarrierStatusMappings(open ? accountId : null);

  const testConnection = useTestCarrierConnection(accountId ?? '');
  const upsertMapping = useUpsertStatusMapping(accountId ?? '');

  const [carrierStatus, setCarrierStatus] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState('');
  const [mappingError, setMappingError] = useState<string | null>(null);

  const dateTime = (value: string | null) =>
    value ? new Date(value).toLocaleString(i18n.language) : '—';

  async function submitMapping() {
    if (!carrierStatus.trim()) return;
    setMappingError(null);
    try {
      await upsertMapping.mutateAsync({
        carrier_status: carrierStatus.trim(),
        delivery_status: deliveryStatus.trim() || null,
      });
      setCarrierStatus('');
      setDeliveryStatus('');
    } catch {
      setMappingError(t(($) => $.carriers.drawer.mappingFailed));
    }
  }

  return (
    <PageDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={account ? `${account.code} — ${account.name}` : t(($) => $.carriers.title)}
      description={account?.adapter_key}
      size="xl"
    >
      {isLoading && <Skeleton className="h-32 w-full" />}

      {!isLoading && !account && (
        <p className="py-6 text-sm text-muted-foreground">
          {t(($) => $.carriers.drawer.notFound)}
        </p>
      )}

      {account && (
        <Tabs value={tab} onValueChange={setTab} className="flex flex-col gap-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">
              {t(($) => $.carriers.drawer.tabs.overview)}
            </TabsTrigger>
            <TabsTrigger value="capabilities">
              {t(($) => $.carriers.drawer.tabs.capabilities)}
            </TabsTrigger>
            <TabsTrigger value="mappings">
              {t(($) => $.carriers.drawer.tabs.mappings)}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t(($) => $.carriers.code)} value={account.code} />
              <Field label={t(($) => $.carriers.name)} value={account.name} />
              <Field label={t(($) => $.carriers.adapter)} value={account.adapter_key} />
              <Field label={t(($) => $.carriers.priority)} value={account.priority} />
              <Field
                label={t(($) => $.carriers.shippingCompany)}
                value={account.shipping_company?.name ?? '—'}
              />
              <Field
                label={t(($) => $.carriers.credentials)}
                value={
                  account.has_credentials
                    ? t(($) => $.carriers.credentials)
                    : t(($) => $.carriers.noCredentials)
                }
              />
              <Field label={t(($) => $.carriers.status)} value={account.status} />
              <Field label={t(($) => $.trips.drawer.timeline.created)} value={dateTime(account.created_at)} />
            </div>

            {account.notes && (
              <p className="rounded-md border bg-muted/30 p-3 text-sm">{account.notes}</p>
            )}

            {canManage && (
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  className="self-start"
                  disabled={testConnection.isPending}
                  onClick={() => testConnection.mutate()}
                >
                  <PlugZap className="me-1 h-3.5 w-3.5" />
                  {testConnection.isPending
                    ? t(($) => $.carriers.drawer.testing)
                    : t(($) => $.carriers.drawer.testConnection)}
                </Button>

                {testConnection.data && (
                  <Alert variant={testConnection.data.ok ? 'default' : 'destructive'}>
                    <AlertDescription className="flex flex-col gap-1">
                      <span className="font-medium">
                        {testConnection.data.ok
                          ? t(($) => $.carriers.drawer.testOk)
                          : t(($) => $.carriers.drawer.testFailed)}
                      </span>
                      <span className="text-xs">{testConnection.data.message}</span>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              {t(($) => $.carriers.noUpdateNote)}
            </p>
          </TabsContent>

          <TabsContent value="capabilities" className="flex flex-col gap-2">
            <ul className="flex flex-col gap-2">
              {(capabilities?.all ?? account.capabilities ?? []).map((capability) => (
                <li key={capability.capability} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{capability.capability}</span>
                    {capability.is_supported ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-emerald-600 dark:text-emerald-400"
                      >
                        <CheckCircle2 className="me-1 h-3 w-3" />
                        {t(($) => $.carriers.drawer.supported)}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        <XCircle className="me-1 h-3 w-3" />
                        {t(($) => $.carriers.drawer.notSupported)}
                      </Badge>
                    )}
                  </div>
                  {!capability.is_supported && capability.absence_meaning && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t(($) => $.carriers.drawer.absenceMeaning)}: {capability.absence_meaning}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="mappings" className="flex flex-col gap-3">
            {mappingError && (
              <Alert variant="destructive">
                <AlertDescription>{mappingError}</AlertDescription>
              </Alert>
            )}

            {(mappings ?? []).length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                {t(($) => $.carriers.drawer.noMappings)}
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(mappings ?? []).map((mapping) => (
                  <li key={mapping.id} className="flex flex-col gap-1 rounded-md border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium">{mapping.carrier_status}</span>
                      <Badge variant={mapping.is_complete ? 'outline' : 'secondary'}>
                        {mapping.is_complete
                          ? t(($) => $.carriers.drawer.complete)
                          : t(($) => $.carriers.drawer.incomplete)}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {t(($) => $.carriers.drawer.deliveryStatus)}:{' '}
                        {mapping.delivery_status ?? '—'}
                      </span>
                      {mapping.failure_reason && (
                        <span>
                          {t(($) => $.carriers.drawer.failureReason)}: {mapping.failure_reason}
                        </span>
                      )}
                    </div>
                    {mapping.description && (
                      <p className="text-xs text-muted-foreground">{mapping.description}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {canManage && (
              <div className="flex flex-col gap-2 rounded-md border p-3">
                <p className="text-sm font-medium">{t(($) => $.carriers.drawer.addMapping)}</p>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mapping-carrier-status">
                    {t(($) => $.carriers.drawer.carrierStatus)}
                  </Label>
                  <Input
                    id="mapping-carrier-status"
                    value={carrierStatus}
                    maxLength={80}
                    onChange={(e) => setCarrierStatus(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mapping-delivery-status">
                    {t(($) => $.carriers.drawer.deliveryStatus)}
                  </Label>
                  <Input
                    id="mapping-delivery-status"
                    value={deliveryStatus}
                    maxLength={40}
                    onChange={(e) => setDeliveryStatus(e.target.value)}
                  />
                </div>

                <Button
                  size="sm"
                  className="self-start"
                  disabled={!carrierStatus.trim() || upsertMapping.isPending}
                  onClick={() => void submitMapping()}
                >
                  {t(($) => $.carriers.save)}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </PageDrawer>
  );
}
