import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PageDrawer } from '@/components/page';
import { usePermission } from '@/features/authorization';
import { useFormatter } from '@/hooks/use-formatter';

import {
  useApproveJournal,
  useDiscardJournal,
  useJournal,
  useReverseJournal,
} from '../hooks/use-finance-gl';
import { JournalStatusBadge } from './journal-status-badge';

type Props = { journalId: string | null; open: boolean; onOpenChange: (open: boolean) => void };

/** Full journal detail — header, posting info, audit, and entry lines. Actions are IAM-gated
 *  (hidden, never disabled) and reflect exactly the backend workflow (approve/discard/reverse). */
export function JournalDetailDrawer({ journalId, open, onOpenChange }: Props) {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const { can } = usePermission();

  const query = useJournal(open ? journalId : null);
  const journal = query.data;

  const approve = useApproveJournal();
  const discard = useDiscardJournal();
  const reverse = useReverseJournal();
  const [reversing, setReversing] = useState(false);
  const [reason, setReason] = useState('');

  const close = () => { setReversing(false); setReason(''); onOpenChange(false); };
  const busy = approve.isPending || discard.isPending || reverse.isPending;

  const isDraft = journal?.status === 'draft';
  const isPosted = journal?.status === 'posted';

  const footer = journal ? (
    <div className="flex w-full flex-col gap-2">
      {reversing && (
        <Textarea
          placeholder={t(($) => $.gl.journal.reverseReason)}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
        />
      )}
      <div className="flex justify-end gap-2">
        {isDraft && can('finance.journal.post') && (
          <Button onClick={() => approve.mutate(journal.id, { onSuccess: close })} disabled={busy}>
            {t(($) => $.gl.actions.approve)}
          </Button>
        )}
        {isDraft && can('finance.journal.create') && (
          <Button variant="outline" onClick={() => discard.mutate(journal.id, { onSuccess: close })} disabled={busy}>
            {t(($) => $.gl.actions.discard)}
          </Button>
        )}
        {isPosted && can('finance.journal.reverse') && !reversing && (
          <Button variant="outline" onClick={() => setReversing(true)} disabled={busy}>
            {t(($) => $.gl.actions.reverse)}
          </Button>
        )}
        {isPosted && can('finance.journal.reverse') && reversing && (
          <Button
            onClick={() => reverse.mutate({ uuid: journal.id, reason: reason.trim() }, { onSuccess: close })}
            disabled={busy || reason.trim() === ''}
          >
            {t(($) => $.gl.actions.confirmReverse)}
          </Button>
        )}
        <Button variant="ghost" onClick={close}>{t(($) => $.gl.actions.close)}</Button>
      </div>
    </div>
  ) : undefined;

  return (
    <PageDrawer
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      title={journal ? journal.reference || t(($) => $.gl.journal.entry) : t(($) => $.gl.journal.detail.title)}
      size="xl"
      footer={footer}
    >
      {query.isLoading && <p className="text-sm text-muted-foreground">{t(($) => $.loading)}</p>}
      {query.isError && <p className="text-sm text-red-600">{t(($) => $.error)}</p>}
      {journal && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <JournalStatusBadge status={journal.status} />
            <span className="text-sm text-muted-foreground">{fmt.date(journal.entry_date)}</span>
          </div>

          {journal.description && <p className="text-sm">{journal.description}</p>}

          <Section title={t(($) => $.gl.journal.posting)}>
            <Row label={t(($) => $.gl.journal.source)} value={journal.source || '—'} />
            <Row label={t(($) => $.gl.journal.postedAt)} value={fmt.dateTime(journal.posted_at)} />
            <Row label={t(($) => $.gl.journal.totalDebit)} value={fmt.money(journal.total_debit)} />
            <Row label={t(($) => $.gl.journal.totalCredit)} value={fmt.money(journal.total_credit)} />
          </Section>

          <Section title={t(($) => $.gl.journal.audit)}>
            <Row label={t(($) => $.gl.journal.createdBy)} value={idLabel(journal.created_by)} />
            <Row label={t(($) => $.gl.journal.approvedBy)} value={idLabel(journal.approved_by)} />
            <Row label={t(($) => $.gl.journal.postedBy)} value={idLabel(journal.posted_by)} />
            {journal.reverses_journal_id != null && <Row label={t(($) => $.gl.journal.reverses)} value={`#${journal.reverses_journal_id}`} />}
            {journal.reversed_by_journal_id != null && <Row label={t(($) => $.gl.journal.reversedBy)} value={`#${journal.reversed_by_journal_id}`} />}
          </Section>

          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t(($) => $.gl.journal.lines)}</h4>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-2 text-start">{t(($) => $.gl.journal.account)}</th>
                    <th className="p-2 text-start">{t(($) => $.gl.coa.field.name)}</th>
                    <th className="p-2 text-end">{t(($) => $.gl.coa.balance.debit)}</th>
                    <th className="p-2 text-end">{t(($) => $.gl.coa.balance.credit)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(journal.lines ?? []).map((l, i) => (
                    <tr key={i}>
                      <td className="p-2 tabular-nums">#{l.account_id}</td>
                      <td className="p-2 text-muted-foreground">{l.description || '—'}</td>
                      <td className="p-2 text-end tabular-nums">{l.debit ? fmt.money(l.debit) : '—'}</td>
                      <td className="p-2 text-end tabular-nums">{l.credit ? fmt.money(l.credit) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t(($) => $.gl.journal.accountNote)}</p>
          </div>
        </div>
      )}
    </PageDrawer>
  );
}

function idLabel(id: number | null): string {
  return id == null ? '—' : `#${id}`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h4>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end font-medium tabular-nums">{value}</dd>
    </div>
  );
}
