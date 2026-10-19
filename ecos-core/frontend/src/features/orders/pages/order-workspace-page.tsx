import { useParams, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { ManualOrderFormWorkspace } from '@/features/orders/components/manual-order-form';
import { OrderDetailPage } from '@/features/orders/pages/order-detail-page';
import { PageHeader } from '@/components/crud';
import { useOrderQuery } from '@/features/orders/hooks/use-orders';
import { ROUTES } from '@/router/routes';

// ─────────────────────────────────────────────────────────────────────────────
// Page entry point
// ─────────────────────────────────────────────────────────────────────────────

export function OrderWorkspacePage() {
  const { t } = useTranslation('orders');
  const { t: tCommon } = useTranslation('common');
  const { id } = useParams<{ id: string }>();
  const { pathname } = useLocation();

  const mode: 'create' | 'edit' | 'view' = !id
    ? 'create'
    : pathname.endsWith('/edit')
    ? 'edit'
    : 'view';

  // enabled: false in create mode (id is undefined)
  const { data: order, isLoading } = useOrderQuery(id ?? '');

  // Loading state — only for edit/view
  if (id && isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={t($ => $.detail.loading)}
          breadcrumbs={[
            { label: tCommon($ => $.home), to: ROUTES.dashboard },
            { label: t($ => $.title), to: ROUTES.orders },
            { label: '…' },
          ]}
        />
      </div>
    );
  }

  // Not found — only for edit/view
  if (id && !order) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={t($ => $.detail.notFound)}
          breadcrumbs={[
            { label: tCommon($ => $.home), to: ROUTES.dashboard },
            { label: t($ => $.title), to: ROUTES.orders },
          ]}
        />
        <p className="text-muted-foreground text-sm">{t($ => $.detail.notFoundMessage)}</p>
      </div>
    );
  }

  if (mode === 'view') return <OrderDetailPage />;
  // key forces a clean remount whenever the mode or order changes.
  // Without it, React reconciles create and edit as the same component instance,
  // allowing serverError / slotError / ref state to bleed across SPA navigations.
  if (mode === 'create') return <ManualOrderFormWorkspace key="create" />;
  return <ManualOrderFormWorkspace key={order!.id} mode="edit" order={order!} />;
}
