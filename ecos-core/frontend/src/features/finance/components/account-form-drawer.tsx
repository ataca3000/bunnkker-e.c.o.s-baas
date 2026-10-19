import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

import { useAccountOptions, useCreateAccount } from '../hooks/use-finance-gl';
import type { AccountType } from '../types/finance-gl';

type Props = { open: boolean; onOpenChange: (open: boolean) => void };

/** Create a new GL account (POST /finance/accounts). No update endpoint exists. */
export function AccountFormDrawer({ open, onOpenChange }: Props) {
  const { t } = useTranslation('finance');
  const options = useAccountOptions();
  const create = useCreateAccount();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [accountType, setAccountType] = useState<AccountType | ''>('');
  const [accountCategory, setAccountCategory] = useState('');
  const [currency, setCurrency] = useState('EGP');
  const [isPostable, setIsPostable] = useState(true);
  const [isControl, setIsControl] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(
    () => (options.data?.account_categories ?? []).filter((c) => !accountType || c.type === accountType),
    [options.data, accountType],
  );

  const reset = () => {
    setCode(''); setName(''); setNameAr(''); setAccountType(''); setAccountCategory('');
    setCurrency('EGP'); setIsPostable(true); setIsControl(false); setError(null);
  };

  const close = () => { reset(); onOpenChange(false); };

  const canSubmit = code.trim() !== '' && name.trim() !== '' && accountType !== '' && !create.isPending;

  const submit = () => {
    setError(null);
    if (!canSubmit) return;
    create.mutate(
      {
        code: code.trim(),
        name: name.trim(),
        name_ar: nameAr.trim() || null,
        account_type: accountType as AccountType,
        account_category: accountCategory || null,
        currency: currency.trim() || 'EGP',
        is_postable: isPostable,
        is_control: isControl,
      },
      {
        onSuccess: close,
        onError: () => setError(t(($) => $.gl.coa.form.error)),
      },
    );
  };

  return (
    <PageDrawer
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(true) : close())}
      title={t(($) => $.gl.coa.form.title)}
      description={t(($) => $.gl.coa.form.subtitle)}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={close}>{t(($) => $.gl.actions.cancel)}</Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {create.isPending ? t(($) => $.gl.actions.saving) : t(($) => $.gl.actions.create)}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label={t(($) => $.gl.coa.field.code)} required>
            <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={40} />
          </Field>
          <Field label={t(($) => $.gl.coa.field.currency)}>
            <Input value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} />
          </Field>
        </div>
        <Field label={t(($) => $.gl.coa.field.name)} required>
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
        </Field>
        <Field label={t(($) => $.gl.coa.field.nameAr)}>
          <Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} maxLength={200} dir="rtl" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t(($) => $.gl.coa.field.type)} required>
            <Select value={accountType} onValueChange={(v) => { setAccountType(v as AccountType); setAccountCategory(''); }}>
              <SelectTrigger><SelectValue placeholder={t(($) => $.gl.coa.field.typePlaceholder)} /></SelectTrigger>
              <SelectContent>
                {(options.data?.account_types ?? []).map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t(($) => $.gl.coa.field.category)}>
            <Select value={accountCategory} onValueChange={setAccountCategory} disabled={accountType === ''}>
              <SelectTrigger><SelectValue placeholder={t(($) => $.gl.coa.field.categoryPlaceholder)} /></SelectTrigger>
              <SelectContent>
                {categories.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isPostable} onCheckedChange={(v) => setIsPostable(Boolean(v))} />
            {t(($) => $.gl.coa.field.postable)}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isControl} onCheckedChange={(v) => setIsControl(Boolean(v))} />
            {t(($) => $.gl.coa.field.control)}
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </PageDrawer>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </Label>
      {children}
    </div>
  );
}
