import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageDrawer } from '@/components/page';
import { useFormatter } from '@/hooks/use-formatter';

import { useAccounts, useCreateJournal } from '../hooks/use-finance-gl';
import type { JournalCreateLine } from '../types/finance-gl';

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

type DraftLine = { account_id: string; side: 'debit' | 'credit'; amount: string };

const emptyLine = (): DraftLine => ({ account_id: '', side: 'debit', amount: '' });

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Create a manual journal entry (POST /finance/journals). Lines use the account UUID + side +
 * amount (the write contract). The debit/credit balance shown is a form guard only — the
 * backend is authoritative and re-validates the balance.
 */
export function JournalFormDrawer({ open, onOpenChange }: Props) {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const accounts = useAccounts({ postable_only: true });
  const create = useCreateJournal();

  const [entryDate, setEntryDate] = useState(today());
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    let debit = 0;
    let credit = 0;
    for (const l of lines) {
      const amount = Number(l.amount) || 0;
      if (l.side === 'debit') debit += amount;
      else credit += amount;
    }
    return { debit, credit, balanced: debit > 0 && Math.abs(debit - credit) < 0.0001 };
  }, [lines]);

  const complete = lines.every((l) => l.account_id && Number(l.amount) > 0);
  const canSubmit = entryDate !== '' && lines.length >= 2 && complete && totals.balanced && !create.isPending;

  const reset = () => {
    setEntryDate(today()); setReference(''); setDescription('');
    setLines([emptyLine(), emptyLine()]); setError(null);
  };
  const close = () => { reset(); onOpenChange(false); };

  const setLine = (i: number, patch: Partial<DraftLine>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const submit = () => {
    setError(null);
    if (!canSubmit) return;
    const payloadLines: JournalCreateLine[] = lines.map((l) => ({
      account_id: l.account_id,
      side: l.side,
      amount: Number(l.amount),
    }));
    create.mutate(
      { entry_date: entryDate, reference: reference.trim() || null, description: description.trim() || null, lines: payloadLines },
      { onSuccess: close, onError: () => setError(t(($) => $.gl.journal.form.error)) },
    );
  };

  const accountOptions = accounts.data ?? [];

  return (
    <PageDrawer
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      title={t(($) => $.gl.journal.form.title)}
      description={t(($) => $.gl.journal.form.subtitle)}
      size="2xl"
      footer={
        <div className="flex w-full items-center justify-between gap-4">
          <div className="text-sm tabular-nums">
            <span className="text-muted-foreground">{t(($) => $.gl.journal.totalDebit)}: </span>
            <span className="font-medium">{fmt.money(totals.debit)}</span>
            <span className="mx-2 text-muted-foreground">·</span>
            <span className="text-muted-foreground">{t(($) => $.gl.journal.totalCredit)}: </span>
            <span className="font-medium">{fmt.money(totals.credit)}</span>
            {!totals.balanced && <span className="ms-2 text-amber-600">{t(($) => $.gl.journal.form.unbalanced)}</span>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={close}>{t(($) => $.gl.actions.cancel)}</Button>
            <Button onClick={submit} disabled={!canSubmit}>
              {create.isPending ? t(($) => $.gl.actions.saving) : t(($) => $.gl.actions.create)}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t(($) => $.gl.journal.entryDate)} *</Label>
            <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs text-muted-foreground">{t(($) => $.gl.journal.reference)}</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t(($) => $.gl.journal.description)}</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">{t(($) => $.gl.journal.lines)}</Label>
            <Button variant="ghost" size="sm" onClick={() => setLines((p) => [...p, emptyLine()])}>
              <Plus className="me-1 size-3.5" /> {t(($) => $.gl.journal.addLine)}
            </Button>
          </div>
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_120px_140px_36px] items-center gap-2">
              <Select value={l.account_id} onValueChange={(v) => setLine(i, { account_id: v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder={t(($) => $.gl.journal.account)} /></SelectTrigger>
                <SelectContent>
                  {accountOptions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.code} · {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={l.side} onValueChange={(v) => setLine(i, { side: v as 'debit' | 'credit' })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">{t(($) => $.gl.coa.balance.debit)}</SelectItem>
                  <SelectItem value="credit">{t(($) => $.gl.coa.balance.credit)}</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number" min="0" step="0.01" inputMode="decimal"
                placeholder={t(($) => $.gl.journal.amount)}
                value={l.amount}
                onChange={(e) => setLine(i, { amount: e.target.value })}
                className="h-9 text-end tabular-nums"
              />
              <Button
                variant="ghost" size="icon" className="size-9"
                onClick={() => setLines((p) => (p.length > 2 ? p.filter((_, idx) => idx !== i) : p))}
                disabled={lines.length <= 2}
                aria-label={t(($) => $.gl.journal.removeLine)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </PageDrawer>
  );
}
