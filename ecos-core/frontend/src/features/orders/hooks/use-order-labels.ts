import { useTranslation } from 'react-i18next';

import type { BulkActionKey, OrderStatus } from '@/features/orders/types/order';

// ── Status labels ─────────────────────────────────────────────────────────────
// Single source of truth consumed by: order-status-badge, order-status-tabs, orders-page.

export function useOrderStatusLabels() {
  const { t } = useTranslation('orders');

  const statusLabel: Record<OrderStatus, string> = {
    new:               t($ => $.status.new),
    in_progress:       t($ => $.status.in_progress),
    ready_for_dispatch: t($ => $.status.ready_for_dispatch),
    out_for_delivery:  t($ => $.status.out_for_delivery),
    delivered:         t($ => $.status.delivered),
    awaiting_payment:  t($ => $.status.awaiting_payment),
    awaiting_stock:    t($ => $.status.awaiting_stock),
    scheduled:         t($ => $.status.scheduled),
    on_hold:           t($ => $.status.on_hold),
    cancelled:         t($ => $.status.cancelled),
    returned:          t($ => $.status.returned),
  };

  const statusTabLabel: Record<OrderStatus | 'all', string> = {
    all:               t($ => $.statusTabs.all),
    new:               t($ => $.statusTabs.new),
    in_progress:       t($ => $.statusTabs.in_progress),
    ready_for_dispatch: t($ => $.statusTabs.ready_for_dispatch),
    out_for_delivery:  t($ => $.statusTabs.out_for_delivery),
    delivered:         t($ => $.statusTabs.delivered),
    awaiting_payment:  t($ => $.statusTabs.awaiting_payment),
    awaiting_stock:    t($ => $.statusTabs.awaiting_stock),
    scheduled:         t($ => $.statusTabs.scheduled),
    on_hold:           t($ => $.statusTabs.on_hold),
    cancelled:         t($ => $.statusTabs.cancelled),
    returned:          t($ => $.statusTabs.returned),
  };

  return { statusLabel, statusTabLabel };
}

// ── Bulk action labels ────────────────────────────────────────────────────────
// Single source of truth consumed by: order-list-toolbar, orders-page.

export function useOrderBulkLabels() {
  const { t } = useTranslation('orders');

  const bulkLabel: Record<BulkActionKey, string> = {
    confirm:                  t($ => $.bulk.confirm),
    move_to_awaiting_payment: t($ => $.bulk.move_to_awaiting_payment),
    verify_payment:           t($ => $.bulk.verify_payment),
    move_to_preparation:      t($ => $.bulk.move_to_preparation),
    return_to_preparation:    t($ => $.bulk.return_to_preparation),
    awaiting_stock:           t($ => $.bulk.awaiting_stock),
    retry_reservation:        t($ => $.bulk.retry_reservation),
    start_manufacturing:      t($ => $.bulk.start_manufacturing),
    purchase_materials:       t($ => $.bulk.purchase_materials),
    resume:                   t($ => $.bulk.resume),
    resume_confirmed:         t($ => $.bulk.resume_confirmed),
    dispatch:                 t($ => $.bulk.dispatch),
    complete_delivery:        t($ => $.bulk.complete_delivery),
    complete:                 t($ => $.bulk.complete),
    delivery_failed:          t($ => $.bulk.delivery_failed),
    reschedule:               t($ => $.bulk.reschedule),
    review:                   t($ => $.bulk.review),
    return:                   t($ => $.bulk.return),
    return_to_confirmed:      t($ => $.bulk.return_to_confirmed),
    inspect_return:           t($ => $.bulk.inspect_return),
    return_to_stock:          t($ => $.bulk.return_to_stock),
    scrap:                    t($ => $.bulk.scrap),
    cancel:                   t($ => $.bulk.cancel),
  };

  return { bulkLabel };
}
