import { useTranslation } from 'react-i18next';

import type { SupplierStatus } from '../types/supplier';

// ── Static style map ──────────────────────────────────────────────────────────

export const SUPPLIER_STATUS_COLORS: Record<SupplierStatus, string> = {
  draft:     'bg-slate-100 text-slate-600 border-slate-200',
  active:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  preferred: 'bg-blue-50 text-blue-700 border-blue-200',
  on_hold:   'bg-amber-50 text-amber-700 border-amber-200',
  blocked:   'bg-red-50 text-red-700 border-red-200',
  archived:  'bg-muted text-muted-foreground border-border',
};

// ── Supplier status labels ────────────────────────────────────────────────────
// Single source of truth — supplier badge, filter tabs, and 360-drawer consume this.

export function useSupplierLabels() {
  const { t } = useTranslation('suppliers');

  const supplierStatusLabel: Record<SupplierStatus, string> = {
    draft:     t($ => $.status.draft),
    active:    t($ => $.status.active),
    preferred: t($ => $.status.preferred),
    on_hold:   t($ => $.status.on_hold),
    blocked:   t($ => $.status.blocked),
    archived:  t($ => $.status.archived),
  };

  const supplierColumnHeaders = {
    code:          t($ => $.columns.code),
    name:          t($ => $.columns.name),
    contactPerson: t($ => $.columns.contactPerson),
    email:         t($ => $.columns.email),
    phone:         t($ => $.columns.phone),
    country:       t($ => $.columns.country),
    city:          t($ => $.columns.city),
    status:        t($ => $.columns.status),
  };

  return { supplierStatusLabel, supplierColumnHeaders };
}
