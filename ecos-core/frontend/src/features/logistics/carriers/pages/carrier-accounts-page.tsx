import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Plus, Truck } from 'lucide-react';

import { Pagination } from '@/components/crud';
import { SmartToolbar } from '@/components/data-grid/smart-toolbar';
import { WorkspacePage } from '@/components/page/layout/workspace-page';
import { WorkspaceHeader } from '@/components/workspace/header/workspace-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermission } from '@/features/authorization';
import type enLogistics from '@/i18n/locales/en/logistics.json';

import { CarrierAccountDrawer } from '../components/carrier-account-drawer';
import { CarrierAccountFormDrawer } from '../components/carrier-account-form-drawer';
import { useCarrierAccounts, useCarrierOptions } from '../hooks/use-carriers';
import type { CarrierAccount, CarrierMode, CarrierStatus } from '../types/carrier';

type LogisticsLabel = ($: typeof enLogistics) => string;

const MODE_LABEL: Record<CarrierMode, LogisticsLabel> = {
  internal: ($) => $.carriers.mode_internal,
  external: ($) => $.carriers.mode_external,
};

const STATUS_LABEL: Record<CarrierStatus, LogisticsLabel> = {
  draft: ($) => $.carriers.status_draft,
  active: ($) => $.carriers.status_active,
  disabled: ($) => $.carriers.status_disabled,
};

const STATUS_CLASS: Record<CarrierStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  disabled: 'bg-muted text-muted-foreground line-through',
};

const PER_PAGE = 20;

/**
 * Carrier accounts.
 *
 * The API creates, reads, tests and maps statuses. It has no update and no
 * delete, so the workspace offers neither — and says so, rather than showing a
 * disabled control whose absence would otherwise look like a permission issue.
 */
export function CarrierAccountsPage() {
  const { t } = useTranslation('logistics');
  const { can } = usePermission();

  const [status, setStatus] = useState<CarrierStatus | ''>('');
  const [mode, setMode] = useState<CarrierMode | ''>('');
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const options = useCarrierOptions();
  const { data, isFetching, isError, refetch } = useCarrierAccounts({
    status: status || undefined,
    mode: mode || undefined,
    per_page: PER_PAGE,
    page,
  });

  const accounts = data?.data ?? [];
  const meta = data?.meta;
  const hasFilter = status !== '' || mode !== '';

  function openDetail(account: CarrierAccount) {
    setDetailId(account.uuid);
    setDetailOpen(true);
  }

  return (
    <>
      <WorkspaceHeader
        breadcrumbs={[{ label: t(($) => $.title) }, { label: t(($) => $.carriers.title) }]}
        title={t(($) => $.carriers.title)}
        description={t(($) => $.carriers.subtitle)}
      />

      <WorkspacePage
        toolbar={
          <div className="px-4 sm:px-6">
            <SmartToolbar
              primaryAction={
                can('carrier.manage')
                  ? {
                      label: t(($) => $.carriers.new),
                      icon: Plus,
                      onClick: () => setFormOpen(true),
                    }
                  : undefined
              }
              onRefresh={() => void refetch()}
              isFetching={isFetching}
              refreshLabel={t(($) => $.carriers.refresh)}
            />
          </div>
        }
        quickFilters={
          <div className="flex flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as CarrierMode | '');
                setPage(1);
              }}
              aria-label={t(($) => $.carriers.mode)}
              className="h-8 rounded-md border bg-background px-2 text-xs"
            >
              <option value="">{t(($) => $.carriers.allModes)}</option>
              {(options.data?.modes ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {t(MODE_LABEL[option.value])}
                </option>
              ))}
            </select>

            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as CarrierStatus | '');
                setPage(1);
              }}
              aria-label={t(($) => $.carriers.status)}
              className="h-8 rounded-md border bg-background px-2 text-xs"
            >
              <option value="">{t(($) => $.carriers.allStatuses)}</option>
              {(options.data?.statuses ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {t(STATUS_LABEL[option.value])}
                </option>
              ))}
            </select>

            <span className="text-[11px] text-muted-foreground">
              {t(($) => $.carriers.noUpdateNote)}
            </span>
          </div>
        }
        pagination={
          meta && meta.last_page > 1 ? (
            <div className="px-4 pb-4 sm:px-6">
              <Pagination
                meta={{
                  page: meta.current_page,
                  perPage: meta.per_page,
                  total: meta.total,
                  lastPage: meta.last_page,
                }}
                onPageChange={setPage}
              />
            </div>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-3 px-4 sm:px-6">
          {isError && (
            <Alert variant="destructive">
              <AlertDescription>{t(($) => $.carriers.drawer.notFound)}</AlertDescription>
            </Alert>
          )}

          {isFetching && accounts.length === 0 ? (
            <Skeleton className="h-40 w-full" />
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-lg border bg-card px-6 py-14 text-center">
              <Truck className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {hasFilter ? t(($) => $.carriers.emptyFiltered) : t(($) => $.carriers.empty)}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 text-start font-medium">
                      {t(($) => $.carriers.code)}
                    </th>
                    <th className="px-3 py-2 text-start font-medium">
                      {t(($) => $.carriers.name)}
                    </th>
                    <th className="px-3 py-2 text-start font-medium">
                      {t(($) => $.carriers.adapter)}
                    </th>
                    <th className="px-3 py-2 text-start font-medium">
                      {t(($) => $.carriers.mode)}
                    </th>
                    <th className="px-3 py-2 text-start font-medium">
                      {t(($) => $.carriers.status)}
                    </th>
                    <th className="px-3 py-2 text-end font-medium">
                      {t(($) => $.carriers.priority)}
                    </th>
                    <th className="w-10 px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {accounts.map((account) => (
                    <tr
                      key={account.uuid}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => openDetail(account)}
                    >
                      <td className="px-3 py-2.5 font-medium">{account.code}</td>
                      <td className="px-3 py-2.5">
                        {account.name}
                        {account.is_default && (
                          <Badge variant="outline" className="ms-2 text-[10px]">
                            {t(($) => $.carriers.default)}
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">{account.adapter_key}</td>
                      <td className="px-3 py-2.5">{t(MODE_LABEL[account.mode])}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant="secondary" className={STATUS_CLASS[account.status]}>
                          {t(STATUS_LABEL[account.status])}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-end tabular-nums">{account.priority}</td>
                      <td className="px-3 py-2.5">
                        <ChevronRight className="h-4 w-4 text-muted-foreground rtl:rotate-180" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </WorkspacePage>

      <CarrierAccountDrawer
        key={`${detailId ?? 'none'}-${String(detailOpen)}`}
        accountId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      <CarrierAccountFormDrawer
        key={`form-${String(formOpen)}`}
        open={formOpen}
        onOpenChange={setFormOpen}
      />
    </>
  );
}

export default CarrierAccountsPage;
