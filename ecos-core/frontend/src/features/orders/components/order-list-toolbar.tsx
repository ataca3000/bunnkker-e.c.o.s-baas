import { Clipboard, Download, Printer, Upload } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ColumnVisibilityMenu } from '@/components/data-grid/column-visibility-menu';
import { SavedViewsMenu } from '@/components/data-grid/saved-views-menu';
import { SmartToolbar, type SmartToolbarBulkAction } from '@/components/data-grid/smart-toolbar';
import type { ColumnMeta, ColumnVisibilityState } from '@/components/data-grid/types';
import type { BulkActionKey, Order } from '@/features/orders/types/order';
import { useOrderBulkLabels } from '@/features/orders/hooks/use-order-labels';

export type { BulkActionKey };

// ── Part 1: Bulk Action Routing ───────────────────────────────────────────────
// Maps a (source_status, target_status) pair to the BulkActionKey that handles it.
// Available transitions are derived from each order's allowed_status_transitions —
// no hardcoded per-status matrix.

function resolveTargetToBulkKey(sourceStatus: string, targetStatus: string): BulkActionKey | null {
  // 'in_progress' maps to different bulk keys depending on source
  if (targetStatus === 'in_progress') {
    if (sourceStatus === 'new')               return 'confirm';
    if (sourceStatus === 'ready_for_dispatch') return 'return_to_preparation';
    return 'resume'; // from on_hold, awaiting_stock, awaiting_payment, cancelled
  }
  const map: Partial<Record<string, BulkActionKey>> = {
    ready_for_dispatch: 'move_to_preparation',
    out_for_delivery:   'dispatch',
    delivered:          'complete_delivery',
    awaiting_payment:   'move_to_awaiting_payment',
    awaiting_stock:     'awaiting_stock',
    scheduled:          'reschedule',
    on_hold:            'review',
    cancelled:          'cancel',
    returned:           'return',
  };
  return map[targetStatus] ?? null;
}

// Display config for each action key (destructive styling + separator before it).
const BULK_ACTION_DISPLAY: Partial<Record<BulkActionKey, { destructive?: boolean; separator?: boolean }>> = {
  scrap:  { destructive: true, separator: true },
  cancel: { destructive: true, separator: true },
};

// Canonical order for rendering — ensures stable, predictable button order.
const BULK_ACTION_ORDER: BulkActionKey[] = [
  'confirm',
  'move_to_awaiting_payment',
  'verify_payment',
  'move_to_preparation',
  'return_to_preparation',
  'dispatch',
  'complete_delivery',
  'complete',
  'retry_reservation',
  'start_manufacturing',
  'purchase_materials',
  'awaiting_stock',
  'resume',
  'resume_confirmed',
  'return_to_confirmed',
  'delivery_failed',
  'inspect_return',
  'return_to_stock',
  'reschedule',
  'review',
  'return',
  'scrap',
  'cancel',
];

// Actions that cannot be undone — shown with an irreversible warning in the dialog.
export const IRREVERSIBLE_BULK_ACTIONS = new Set<BulkActionKey>(['cancel', 'complete', 'scrap']);

// Human-readable target outcome for each action (used in confirmation dialog).
export const BULK_ACTION_TARGET_LABEL: Partial<Record<BulkActionKey, string>> = {
  confirm:                  'In Progress',
  move_to_awaiting_payment: 'Awaiting Payment',
  verify_payment:           'In Progress',
  move_to_preparation:      'Ready for Dispatch',
  return_to_preparation:    'In Progress',
  dispatch:                 'Out for Delivery',
  complete_delivery:        'Delivered',
  complete:                 'Delivered',
  retry_reservation:        'In Progress',
  start_manufacturing:      'Manufacturing Started',
  purchase_materials:       'Procurement Queue',
  awaiting_stock:           'Awaiting Stock',
  resume:                   'In Progress',
  resume_confirmed:         'In Progress',
  return_to_confirmed:      'In Progress',
  delivery_failed:          'On Hold',
  inspect_return:           'Return Inspection',
  return_to_stock:          'Returned to Stock',
  scrap:                    'Scrapped',
  reschedule:               'Scheduled',
  review:                   'On Hold',
  return:                   'Returned',
  cancel:                   'Cancelled',
};

/**
 * Computes the intersection of valid bulk actions across all selected orders.
 * Derives available actions from each order's allowed_status_transitions field —
 * the backend is the single source of truth for what transitions are permitted.
 * Mixed selections show only actions common to every selected order.
 */
export function computeDynamicBulkActions(selectedOrders: Order[]): BulkActionKey[] {
  if (selectedOrders.length === 0) return [];

  const perOrderSets = selectedOrders.map((order) => {
    const keys = new Set<BulkActionKey>();
    for (const tr of (order.allowed_status_transitions ?? [])) {
      const key = resolveTargetToBulkKey(order.status, tr.target_status);
      if (key) keys.add(key);
    }
    return keys;
  });

  return BULK_ACTION_ORDER.filter((key) => perOrderSets.every((s) => s.has(key)));
}

// ── Props ─────────────────────────────────────────────────────────────────────

type OrderListToolbarProps = {
  /** Orders currently selected — actions are computed from their statuses. */
  selectedOrders: Order[];
  selectedCount: number;
  isFetching: boolean;
  columns: ColumnMeta[];
  columnVisibility: ColumnVisibilityState;
  onNew: () => void;
  onRefresh: () => void;
  onColumnToggle: (key: string) => void;
  onColumnReset: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onCopyToClipboard?: () => void;
  onPrint?: () => void;
  onBulkAction?: (action: BulkActionKey) => void;
};

export function OrderListToolbar({
  selectedOrders,
  selectedCount,
  isFetching,
  columns,
  columnVisibility,
  onNew,
  onRefresh,
  onColumnToggle,
  onColumnReset,
  onImport,
  onExport,
  onCopyToClipboard,
  onPrint,
  onBulkAction,
}: OrderListToolbarProps) {
  const { t } = useTranslation('orders');
  const { bulkLabel } = useOrderBulkLabels();

  const bulkActions = useMemo<SmartToolbarBulkAction[]>(() => {
    if (!onBulkAction) return [];
    const validKeys = computeDynamicBulkActions(selectedOrders);
    return validKeys.map((key) => ({
      key,
      label: bulkLabel[key],
      onClick: () => onBulkAction(key),
      ...BULK_ACTION_DISPLAY[key],
    }));
  }, [selectedOrders, onBulkAction, bulkLabel]);

  return (
    <SmartToolbar
      primaryAction={{ label: t($ => $.actions.new), onClick: onNew }}
      secondaryActions={[
        ...(onImport            ? [{ key: 'import', label: t($ => $.actions.import),           onClick: onImport,            icon: Upload,    hideOnMobile: true }] : []),
        ...(onExport            ? [{ key: 'export', label: t($ => $.actions.export),           onClick: onExport,            icon: Download,  hideOnMobile: true }] : []),
        ...(onCopyToClipboard   ? [{ key: 'copy',   label: t($ => $.actions.copyClipboard), onClick: onCopyToClipboard, icon: Clipboard, hideOnMobile: true }] : []),
        ...(onPrint             ? [{ key: 'print',  label: t($ => $.actions.print),          onClick: onPrint,           icon: Printer,   hideOnMobile: true }] : []),
      ]}
      bulkActions={bulkActions}
      bulkActionsLabel={t($ => $.actions.bulkActions)}
      selectedCount={selectedCount}
      onRefresh={onRefresh}
      refreshLabel={t($ => $.actions.refresh)}
      isFetching={isFetching}
      viewControls={
        <>
          <ColumnVisibilityMenu
            columns={columns}
            visibility={columnVisibility}
            onToggle={onColumnToggle}
            onReset={onColumnReset}
            label={t($ => $.toolbar.columns)}
          />
          <SavedViewsMenu label={t($ => $.toolbar.views)} />
        </>
      }
    />
  );
}
