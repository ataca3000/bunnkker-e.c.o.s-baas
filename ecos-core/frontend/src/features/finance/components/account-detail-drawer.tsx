import { useTranslation } from 'react-i18next';

import { StatusBadge } from '@/components/crud';
import { PageDrawer } from '@/components/page';

import type { Account } from '../types/finance-gl';

type Props = { account: Account | null; open: boolean; onOpenChange: (open: boolean) => void };

/** Read-only detail for a GL account. */
export function AccountDetailDrawer({ account, open, onOpenChange }: Props) {
  const { t } = useTranslation('finance');

  return (
    <PageDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={account ? `${account.code} · ${account.name}` : t(($) => $.gl.coa.detail.title)}
      size="lg"
    >
      {account && (
        <dl className="space-y-3 text-sm">
          <Row label={t(($) => $.gl.coa.field.code)} value={account.code} />
          <Row label={t(($) => $.gl.coa.field.name)} value={account.name} />
          {account.name_ar && <Row label={t(($) => $.gl.coa.field.nameAr)} value={account.name_ar} />}
          <Row label={t(($) => $.gl.coa.field.type)} value={t(($) => $.gl.coa.type[account.account_type])} />
          {account.account_category && (
            <Row label={t(($) => $.gl.coa.field.category)} value={account.account_category.replace(/_/g, ' ')} />
          )}
          <Row label={t(($) => $.gl.coa.field.normalBalance)} value={t(($) => $.gl.coa.balance[account.normal_balance])} />
          <Row label={t(($) => $.gl.coa.field.statement)} value={t(($) => $.gl.coa.statement[account.statement])} />
          <Row label={t(($) => $.gl.coa.field.currency)} value={account.currency} />
          <Row label={t(($) => $.gl.coa.field.postable)} value={account.is_postable ? t(($) => $.gl.yes) : t(($) => $.gl.no)} />
          <Row label={t(($) => $.gl.coa.field.control)} value={account.is_control ? t(($) => $.gl.yes) : t(($) => $.gl.no)} />
          {account.control_subledger && (
            <Row label={t(($) => $.gl.coa.field.subledger)} value={account.control_subledger} />
          )}
          <div className="flex items-center justify-between pt-1">
            <dt className="text-muted-foreground">{t(($) => $.gl.coa.field.status)}</dt>
            <dd>
              <StatusBadge status={account.is_active ? 'active' : 'inactive'} />
            </dd>
          </div>
        </dl>
      )}
    </PageDrawer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end font-medium">{value}</dd>
    </div>
  );
}
