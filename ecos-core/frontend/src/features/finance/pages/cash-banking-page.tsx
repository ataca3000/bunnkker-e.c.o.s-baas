import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Banknote, Landmark, Scale, Wallet } from 'lucide-react';

import { UniversalDataGrid, type DataGridColumnDef } from '@/components/data-grid';
import { useToast } from '@/components/ds/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/ecos-select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkspacePage } from '@/components/page';
import { WorkspaceHeader, type WorkspaceMetric } from '@/components/workspace';
import { usePermission } from '@/features/authorization';
import { useFormatter } from '@/hooks/use-formatter';

import { Field, NoAccess, Panel, Stat } from '../components/finance-panels';
import {
  useAutoMatchReconciliation,
  useBankAccounts,
  useCashAccounts,
  useCashTransfer,
  useCloseCashSession,
  useCompleteReconciliation,
  useCreateBankAccount,
  useCreateCashAccount,
  useOpenCashSession,
  useOutstandingItems,
  useRecordCashTransaction,
} from '../hooks/use-finance-treasury';
import {
  CASH_TRANSACTION_TYPES,
  type BankAccount,
  type BankReconciliation,
  type CashAccount,
  type CashSessionClose,
  type CashTransactionType,
} from '../types/finance-treasury';
import { backendMessage } from '../utils/backend-message';

/**
 * EPIC-FINANCE-UI-001 · Phase 6 — Cash & Banking.
 *
 * Consumes the certified /finance/cash and /finance/bank endpoints. Every figure
 * shown is the backend's: the session variance, the reconciliation difference
 * and the outstanding total are all computed server-side and displayed
 * unmodified. Recomputing any of them here would produce a second number that
 * disagrees the moment a movement lands mid-operation.
 *
 * Two absences are stated on screen rather than papered over: there is no
 * cash-transaction list endpoint, so transactions are recorded but no history is
 * shown; and there is no reconciliation list endpoint, so a reconciliation is
 * identified directly rather than picked from a list that does not exist.
 *
 * No backend changes. IAM-gated per route permission; EN/AR; responsive.
 */
export function CashBankingPage() {
  const { t } = useTranslation('finance');
  const { can } = usePermission();

  const cash = useCashAccounts();
  const bank = useBankAccounts();

  const canCash = can('finance.cash.view');
  const canBank = can('finance.bank.view');

  const metrics = useMemo<WorkspaceMetric[]>(
    () => [
      {
        id: 'cash',
        icon: Wallet,
        label: t(($) => $.treasury.kpi.cashAccounts),
        value: cash.data?.length ?? 0,
        isLoading: cash.isLoading,
      },
      {
        id: 'cash-active',
        icon: Banknote,
        label: t(($) => $.treasury.kpi.activeCash),
        value: cash.data?.filter((a) => a.is_active).length ?? 0,
        isLoading: cash.isLoading,
      },
      {
        id: 'bank',
        icon: Landmark,
        label: t(($) => $.treasury.kpi.bankAccounts),
        value: bank.data?.length ?? 0,
        isLoading: bank.isLoading,
      },
      {
        id: 'bank-active',
        icon: Scale,
        label: t(($) => $.treasury.kpi.activeBank),
        value: bank.data?.filter((a) => a.is_active).length ?? 0,
        isLoading: bank.isLoading,
      },
    ],
    [cash.data, cash.isLoading, bank.data, bank.isLoading, t],
  );

  const header = (
    <WorkspaceHeader
      breadcrumbs={[
        { label: t(($) => $.breadcrumb.finance) },
        { label: t(($) => $.treasury.title) },
      ]}
      title={t(($) => $.treasury.title)}
      description={t(($) => $.treasury.subtitle)}
      metrics={canCash || canBank ? metrics : undefined}
    />
  );

  if (!canCash && !canBank) {
    return (
      <>
        {header}
        <WorkspacePage>
          <NoAccess />
        </WorkspacePage>
      </>
    );
  }

  return (
    <>
      {header}
      <WorkspacePage>
        <Tabs defaultValue={canCash ? 'cash' : 'bank'}>
          <TabsList>
            {canCash && <TabsTrigger value="cash">{t(($) => $.treasury.tab.cash)}</TabsTrigger>}
            {canBank && <TabsTrigger value="bank">{t(($) => $.treasury.tab.bank)}</TabsTrigger>}
            {canBank && (
              <TabsTrigger value="reconciliation">
                {t(($) => $.treasury.tab.reconciliation)}
              </TabsTrigger>
            )}
          </TabsList>

          {canCash && (
            <TabsContent value="cash" className="mt-4">
              <CashTab />
            </TabsContent>
          )}
          {canBank && (
            <TabsContent value="bank" className="mt-4">
              <BankTab />
            </TabsContent>
          )}
          {canBank && (
            <TabsContent value="reconciliation" className="mt-4">
              <ReconciliationTab />
            </TabsContent>
          )}
        </Tabs>
      </WorkspacePage>
    </>
  );
}

// ── Cash ─────────────────────────────────────────────────────────────────────

function CashTab() {
  const { t } = useTranslation('finance');
  const { can } = usePermission();
  const accounts = useCashAccounts();

  const columns = useMemo<DataGridColumnDef<CashAccount>[]>(
    () => [
      {
        key: 'code',
        label: t(($) => $.treasury.cash.code),
        pin: 'left',
        cell: (a) => <span className="font-medium">{a.code}</span>,
      },
      { key: 'name', label: t(($) => $.treasury.cash.name), cell: (a) => a.name },
      { key: 'currency', label: t(($) => $.treasury.cash.currency), cell: (a) => a.currency },
      {
        key: 'is_active',
        label: t(($) => $.treasury.cash.status),
        cell: (a) =>
          a.is_active ? t(($) => $.treasury.cash.active) : t(($) => $.treasury.cash.inactive),
      },
    ],
    [t],
  );

  const manage = can('finance.cash.manage');
  const rows = accounts.data ?? [];

  return (
    <div className="space-y-4">
      <UniversalDataGrid
        data={rows}
        columns={columns}
        rowId={(a) => a.id}
        loading={accounts.isLoading}
        error={accounts.isError}
        emptyState={
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t(($) => $.treasury.cash.empty)}
          </p>
        }
      />

      {manage && <CreateCashAccountPanel />}
      {can('finance.cash.session.manage') && <SessionPanel accounts={rows} />}
      {manage && <TransactionPanel accounts={rows} />}
      {manage && <TransferPanel accounts={rows} />}
    </div>
  );
}

function CreateCashAccountPanel() {
  const { t } = useTranslation('finance');
  const { toast } = useToast();
  const create = useCreateCashAccount();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [glAccount, setGlAccount] = useState('');

  const ready = code.trim() !== '' && name.trim() !== '' && glAccount.trim() !== '';

  return (
    <Panel
      title={t(($) => $.treasury.cash.newTitle)}
      hint={t(($) => $.treasury.cash.newDescription)}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <Field id="cash-code" label={t(($) => $.treasury.cash.codeLabel)}>
          <Input id="cash-code" value={code} onChange={(e) => setCode(e.target.value)} />
        </Field>
        <Field id="cash-name" label={t(($) => $.treasury.cash.nameLabel)}>
          <Input id="cash-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="cash-gl" label={t(($) => $.treasury.cash.glAccount)}>
          <Input
            id="cash-gl"
            value={glAccount}
            placeholder={t(($) => $.treasury.cash.glAccountPlaceholder)}
            onChange={(e) => setGlAccount(e.target.value)}
          />
        </Field>
      </div>

      <Button
        size="sm"
        className="self-start"
        disabled={!ready || create.isPending}
        onClick={async () => {
          try {
            await create.mutateAsync({
              code: code.trim(),
              name: name.trim(),
              gl_account_id: glAccount.trim(),
            });
            toast({ title: t(($) => $.treasury.toast.accountCreated) });
            setCode('');
            setName('');
            setGlAccount('');
          } catch (error) {
            toast({
              title: t(($) => $.treasury.cash.createFailed),
              description: backendMessage(error),
              variant: 'destructive',
            });
          }
        }}
      >
        {create.isPending ? t(($) => $.treasury.common.saving) : t(($) => $.treasury.cash.new)}
      </Button>
    </Panel>
  );
}

function SessionPanel({ accounts }: { accounts: CashAccount[] }) {
  const { t } = useTranslation('finance');
  const { toast } = useToast();
  const open = useOpenCashSession();
  const close = useCloseCashSession();

  const [accountId, setAccountId] = useState('');
  const [openingFloat, setOpeningFloat] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [counted, setCounted] = useState('');
  const [closed, setClosed] = useState<CashSessionClose | null>(null);

  return (
    <Panel title={t(($) => $.treasury.session.title)}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field id="session-account" label={t(($) => $.treasury.cash.accountLabel)}>
          <AccountSelect
            id="session-account"
            value={accountId}
            onChange={setAccountId}
            accounts={accounts}
          />
        </Field>
        <Field id="session-float" label={t(($) => $.treasury.session.openingFloat)}>
          <Input
            id="session-float"
            type="number"
            min={0}
            step="0.01"
            value={openingFloat}
            onChange={(e) => setOpeningFloat(e.target.value)}
          />
        </Field>
      </div>

      <p className="text-xs text-muted-foreground">
        {t(($) => $.treasury.session.openDescription)}
      </p>

      <Button
        size="sm"
        className="self-start"
        disabled={accountId === '' || open.isPending}
        onClick={async () => {
          try {
            const session = await open.mutateAsync({
              accountId,
              payload: openingFloat === '' ? {} : { opening_float: Number(openingFloat) },
            });
            setSessionId(session.id);
            setClosed(null);
            toast({ title: t(($) => $.treasury.toast.sessionOpened) });
          } catch (error) {
            toast({
              title: t(($) => $.treasury.session.openFailed),
              description: backendMessage(error),
              variant: 'destructive',
            });
          }
        }}
      >
        {t(($) => $.treasury.session.open)}
      </Button>

      <div className="grid gap-3 border-t pt-4 md:grid-cols-2">
        <Field id="session-id" label={t(($) => $.treasury.session.sessionId)}>
          <Input
            id="session-id"
            value={sessionId}
            dir="ltr"
            onChange={(e) => setSessionId(e.target.value)}
          />
        </Field>
        <Field id="session-counted" label={t(($) => $.treasury.session.countedAmount)}>
          <Input
            id="session-counted"
            type="number"
            min={0}
            step="0.01"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
          />
        </Field>
      </div>

      <p className="text-xs text-muted-foreground">
        {t(($) => $.treasury.session.closeDescription)}
      </p>

      <Button
        size="sm"
        variant="secondary"
        className="self-start"
        disabled={sessionId.trim() === '' || counted === '' || close.isPending}
        onClick={async () => {
          try {
            const result = await close.mutateAsync({
              sessionId: sessionId.trim(),
              payload: { counted_amount: Number(counted) },
            });
            setClosed(result);
            toast({ title: t(($) => $.treasury.toast.sessionClosed) });
          } catch (error) {
            toast({
              title: t(($) => $.treasury.session.closeFailed),
              description: backendMessage(error),
              variant: 'destructive',
            });
          }
        }}
      >
        {t(($) => $.treasury.session.close)}
      </Button>

      {closed && <SessionOutcome result={closed} />}
    </Panel>
  );
}

/** Shows the backend's expected balance and variance verbatim. */
function SessionOutcome({ result }: { result: CashSessionClose }) {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();

  return (
    <div className="flex flex-wrap gap-5 rounded-md border bg-muted/30 px-4 py-3 text-sm">
      <span>
        <span className="text-muted-foreground">{t(($) => $.treasury.session.expected)}: </span>
        <span className="font-semibold tabular-nums">{fmt.money(result.expected)}</span>
      </span>
      <span>
        <span className="text-muted-foreground">{t(($) => $.treasury.session.variance)}: </span>
        <span
          className={`font-semibold tabular-nums ${result.variance === 0 ? '' : 'text-amber-600'}`}
        >
          {fmt.money(result.variance)}
        </span>
      </span>
      <span>
        <span className="text-muted-foreground">{t(($) => $.treasury.session.status)}: </span>
        {result.status}
      </span>
    </div>
  );
}

function TransactionPanel({ accounts }: { accounts: CashAccount[] }) {
  const { t } = useTranslation('finance');
  const { toast } = useToast();
  const record = useRecordCashTransaction();

  const [accountId, setAccountId] = useState('');
  const [type, setType] = useState<CashTransactionType>('receipt');
  const [amount, setAmount] = useState('');
  const [counterparty, setCounterparty] = useState('');

  const typeLabel = (value: CashTransactionType) => {
    if (value === 'receipt') return t(($) => $.treasury.transaction.receipt);
    if (value === 'payment') return t(($) => $.treasury.transaction.payment);
    return t(($) => $.treasury.transaction.adjustment);
  };

  const ready =
    accountId !== '' && counterparty.trim() !== '' && amount !== '' && Number(amount) > 0;

  return (
    <Panel
      title={t(($) => $.treasury.transaction.title)}
      hint={t(($) => $.treasury.transaction.description)}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field id="txn-account" label={t(($) => $.treasury.cash.accountLabel)}>
          <AccountSelect
            id="txn-account"
            value={accountId}
            onChange={setAccountId}
            accounts={accounts}
          />
        </Field>

        <Field id="txn-type" label={t(($) => $.treasury.transaction.type)}>
          <Select value={type} onValueChange={(v) => setType(v as CashTransactionType)}>
            <SelectTrigger id="txn-type" className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CASH_TRANSACTION_TYPES.map((value) => (
                <SelectItem key={value} value={value}>
                  {typeLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field id="txn-amount" label={t(($) => $.treasury.transaction.amount)}>
          <Input
            id="txn-amount"
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>

        <Field id="txn-counterparty" label={t(($) => $.treasury.transaction.counterparty)}>
          <Input
            id="txn-counterparty"
            value={counterparty}
            placeholder={t(($) => $.treasury.transaction.counterpartyPlaceholder)}
            onChange={(e) => setCounterparty(e.target.value)}
          />
        </Field>
      </div>

      <Button
        size="sm"
        className="self-start"
        disabled={!ready || record.isPending}
        onClick={async () => {
          try {
            const result = await record.mutateAsync({
              accountId,
              payload: {
                type,
                amount: Number(amount),
                counterparty_account_id: counterparty.trim(),
              },
            });
            toast({
              title: result.journal_entry_id
                ? t(($) => $.treasury.transaction.recorded, { journal: result.journal_entry_id })
                : t(($) => $.treasury.transaction.recordedUnposted),
            });
            setAmount('');
          } catch (error) {
            toast({
              title: t(($) => $.treasury.transaction.failed),
              description: backendMessage(error),
              variant: 'destructive',
            });
          }
        }}
      >
        {t(($) => $.treasury.transaction.record)}
      </Button>

      <p className="text-xs text-muted-foreground">{t(($) => $.treasury.transaction.noListNote)}</p>
    </Panel>
  );
}

function TransferPanel({ accounts }: { accounts: CashAccount[] }) {
  const { t } = useTranslation('finance');
  const { toast } = useToast();
  const transfer = useCashTransfer();

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');

  const sameAccount = from !== '' && from === to;
  const ready = from !== '' && to !== '' && !sameAccount && amount !== '' && Number(amount) > 0;

  return (
    <Panel
      title={t(($) => $.treasury.transfer.title)}
      hint={t(($) => $.treasury.transfer.description)}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <Field id="tr-from" label={t(($) => $.treasury.transfer.from)}>
          <AccountSelect id="tr-from" value={from} onChange={setFrom} accounts={accounts} />
        </Field>
        <Field id="tr-to" label={t(($) => $.treasury.transfer.to)}>
          <AccountSelect id="tr-to" value={to} onChange={setTo} accounts={accounts} />
        </Field>
        <Field id="tr-amount" label={t(($) => $.treasury.transfer.amount)}>
          <Input
            id="tr-amount"
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>
      </div>

      {sameAccount && (
        <p className="text-xs text-destructive">{t(($) => $.treasury.transfer.sameAccount)}</p>
      )}

      <Button
        size="sm"
        className="self-start"
        disabled={!ready || transfer.isPending}
        onClick={async () => {
          try {
            await transfer.mutateAsync({
              from_account_id: from,
              to_account_id: to,
              amount: Number(amount),
            });
            toast({ title: t(($) => $.treasury.toast.transferPosted) });
            setAmount('');
          } catch (error) {
            toast({
              title: t(($) => $.treasury.transfer.failed),
              description: backendMessage(error),
              variant: 'destructive',
            });
          }
        }}
      >
        {t(($) => $.treasury.transfer.submit)}
      </Button>
    </Panel>
  );
}

// ── Banking ──────────────────────────────────────────────────────────────────

function BankTab() {
  const { t } = useTranslation('finance');
  const { can } = usePermission();
  const accounts = useBankAccounts();

  const columns = useMemo<DataGridColumnDef<BankAccount>[]>(
    () => [
      {
        key: 'name',
        label: t(($) => $.treasury.bank.name),
        pin: 'left',
        cell: (a) => <span className="font-medium">{a.name}</span>,
      },
      {
        key: 'bank_name',
        label: t(($) => $.treasury.bank.bankName),
        cell: (a) => a.bank_name ?? t(($) => $.treasury.common.none),
      },
      {
        key: 'iban',
        label: t(($) => $.treasury.bank.iban),
        cell: (a) => (
          <span dir="ltr" className="font-mono text-xs">
            {a.iban ?? t(($) => $.treasury.common.none)}
          </span>
        ),
      },
      { key: 'currency', label: t(($) => $.treasury.bank.currency), cell: (a) => a.currency },
      {
        key: 'is_active',
        label: t(($) => $.treasury.bank.status),
        cell: (a) =>
          a.is_active ? t(($) => $.treasury.cash.active) : t(($) => $.treasury.cash.inactive),
      },
    ],
    [t],
  );

  return (
    <div className="space-y-4">
      <UniversalDataGrid
        data={accounts.data ?? []}
        columns={columns}
        rowId={(a) => a.id}
        loading={accounts.isLoading}
        error={accounts.isError}
        emptyState={
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t(($) => $.treasury.bank.empty)}
          </p>
        }
      />

      {can('finance.bank.manage') && <CreateBankAccountPanel />}
    </div>
  );
}

function CreateBankAccountPanel() {
  const { t } = useTranslation('finance');
  const { toast } = useToast();
  const create = useCreateBankAccount();

  const [name, setName] = useState('');
  const [bankName, setBankName] = useState('');
  const [iban, setIban] = useState('');
  const [glAccount, setGlAccount] = useState('');

  const ready = name.trim() !== '' && glAccount.trim() !== '';

  return (
    <Panel
      title={t(($) => $.treasury.bank.newTitle)}
      hint={t(($) => $.treasury.bank.newDescription)}
    >
      <div className="grid gap-3 md:grid-cols-2">
        <Field id="bank-name" label={t(($) => $.treasury.bank.nameLabel)}>
          <Input id="bank-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="bank-institution" label={t(($) => $.treasury.bank.bankNameLabel)}>
          <Input
            id="bank-institution"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
          />
        </Field>
        <Field id="bank-iban" label={t(($) => $.treasury.bank.ibanLabel)}>
          <Input id="bank-iban" value={iban} dir="ltr" onChange={(e) => setIban(e.target.value)} />
        </Field>
        <Field id="bank-gl" label={t(($) => $.treasury.bank.glAccount)}>
          <Input
            id="bank-gl"
            value={glAccount}
            placeholder={t(($) => $.treasury.cash.glAccountPlaceholder)}
            onChange={(e) => setGlAccount(e.target.value)}
          />
        </Field>
      </div>

      <Button
        size="sm"
        className="self-start"
        disabled={!ready || create.isPending}
        onClick={async () => {
          try {
            await create.mutateAsync({
              name: name.trim(),
              bank_name: bankName.trim() === '' ? null : bankName.trim(),
              iban: iban.trim() === '' ? null : iban.trim(),
              gl_account_id: glAccount.trim(),
            });
            toast({ title: t(($) => $.treasury.toast.accountCreated) });
            setName('');
            setBankName('');
            setIban('');
            setGlAccount('');
          } catch (error) {
            toast({
              title: t(($) => $.treasury.bank.createFailed),
              description: backendMessage(error),
              variant: 'destructive',
            });
          }
        }}
      >
        {create.isPending ? t(($) => $.treasury.common.saving) : t(($) => $.treasury.bank.new)}
      </Button>
    </Panel>
  );
}

// ── Reconciliation ───────────────────────────────────────────────────────────

function ReconciliationTab() {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const { can } = usePermission();
  const { toast } = useToast();

  const [inputId, setInputId] = useState('');
  const [reconId, setReconId] = useState<string | null>(null);
  const [recon, setRecon] = useState<BankReconciliation | null>(null);

  const autoMatch = useAutoMatchReconciliation();
  const complete = useCompleteReconciliation();

  const canReconcile = can('finance.bank.reconcile');

  return (
    <div className="space-y-4">
      <Panel
        title={t(($) => $.treasury.reconciliation.title)}
        hint={t(($) => $.treasury.reconciliation.description)}
      >
        <Field id="recon-id" label={t(($) => $.treasury.reconciliation.reconciliationId)}>
          <Input
            id="recon-id"
            value={inputId}
            dir="ltr"
            onChange={(e) => setInputId(e.target.value)}
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          {t(($) => $.treasury.reconciliation.idNote)}
        </p>

        <Button
          size="sm"
          className="self-start"
          disabled={inputId.trim() === ''}
          onClick={() => {
            setRecon(null);
            setReconId(inputId.trim());
          }}
        >
          {t(($) => $.treasury.reconciliation.load)}
        </Button>
      </Panel>

      {reconId !== null && (
        <>
          {recon && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label={t(($) => $.treasury.reconciliation.bookBalance)}
                value={fmt.money(recon.book_balance)}
              />
              <Stat
                label={t(($) => $.treasury.reconciliation.statementBalance)}
                value={fmt.money(recon.statement_balance)}
              />
              <Stat
                label={t(($) => $.treasury.reconciliation.difference)}
                value={fmt.money(recon.difference)}
              />
              <Stat
                label={
                  recon.completed_at
                    ? t(($) => $.treasury.reconciliation.completedAt)
                    : t(($) => $.treasury.reconciliation.status)
                }
                value={recon.completed_at ? fmt.date(recon.completed_at) : recon.status}
              />
            </div>
          )}

          {canReconcile && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={autoMatch.isPending}
                onClick={async () => {
                  try {
                    setRecon(await autoMatch.mutateAsync(reconId));
                    toast({ title: t(($) => $.treasury.toast.autoMatched) });
                  } catch (error) {
                    toast({
                      title: t(($) => $.treasury.reconciliation.autoMatchFailed),
                      description: backendMessage(error),
                      variant: 'destructive',
                    });
                  }
                }}
              >
                {t(($) => $.treasury.reconciliation.autoMatch)}
              </Button>
              <Button
                size="sm"
                disabled={complete.isPending}
                onClick={async () => {
                  try {
                    setRecon(await complete.mutateAsync(reconId));
                    toast({ title: t(($) => $.treasury.toast.reconciliationCompleted) });
                  } catch (error) {
                    toast({
                      title: t(($) => $.treasury.reconciliation.completeFailed),
                      description: backendMessage(error),
                      variant: 'destructive',
                    });
                  }
                }}
              >
                {t(($) => $.treasury.reconciliation.complete)}
              </Button>
            </div>
          )}

          <OutstandingItemsPanel reconciliationId={reconId} />
        </>
      )}
    </div>
  );
}

function OutstandingItemsPanel({ reconciliationId }: { reconciliationId: string }) {
  const { t } = useTranslation('finance');
  const fmt = useFormatter();
  const outstanding = useOutstandingItems(reconciliationId);

  const data = outstanding.data;

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t(($) => $.treasury.reconciliation.outstanding)}
      </h3>

      {outstanding.isLoading ? (
        <p className="text-sm text-muted-foreground">{t(($) => $.loading)}</p>
      ) : outstanding.isError ? (
        <p className="text-sm text-destructive">{t(($) => $.treasury.reconciliation.loadFailed)}</p>
      ) : !data || data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t(($) => $.treasury.reconciliation.noOutstanding)}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-5 rounded-md border bg-muted/30 px-4 py-3 text-sm">
            <span>
              <span className="text-muted-foreground">
                {t(($) => $.treasury.reconciliation.outstandingCount)}:{' '}
              </span>
              <span className="font-semibold tabular-nums">{data.count}</span>
            </span>
            <span>
              <span className="text-muted-foreground">
                {t(($) => $.treasury.reconciliation.outstandingTotal)}:{' '}
              </span>
              <span className="font-semibold tabular-nums">{fmt.money(data.total)}</span>
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="p-2 text-start font-medium">
                    {t(($) => $.treasury.reconciliation.valueDate)}
                  </th>
                  <th className="p-2 text-start font-medium">
                    {t(($) => $.treasury.reconciliation.itemDescription)}
                  </th>
                  <th className="p-2 text-end font-medium">
                    {t(($) => $.treasury.reconciliation.amount)}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td className="whitespace-nowrap p-2">
                      {item.value_date
                        ? fmt.date(item.value_date)
                        : t(($) => $.treasury.common.none)}
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {item.description ?? t(($) => $.treasury.common.none)}
                    </td>
                    <td className="p-2 text-end tabular-nums">{fmt.money(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function AccountSelect({
  id,
  value,
  onChange,
  accounts,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  accounts: CashAccount[];
}) {
  const { t } = useTranslation('finance');

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger id={id} className="h-9 text-sm">
        <SelectValue placeholder={t(($) => $.treasury.cash.accountPlaceholder)} />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            {account.code} · {account.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default CashBankingPage;
