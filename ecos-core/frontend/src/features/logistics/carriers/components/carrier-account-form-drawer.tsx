import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PageDrawer } from '@/components/page/drawer/page-drawer';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { useCarrierOptions, useCreateCarrierAccount } from '../hooks/use-carriers';
import type { CarrierMode } from '../types/carrier';

/**
 * Creating a carrier account.
 *
 * The adapter list comes from the backend registry, which the controller calls
 * the one place carriers are named. An unknown adapter is refused by the API
 * rather than substituted, so the field is a select over that registry and
 * never free text.
 */
export function CarrierAccountFormDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation('logistics');
  const options = useCarrierOptions();
  const create = useCreateCarrierAccount();

  const [adapterKey, setAdapterKey] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<CarrierMode>('external');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const adapters = options.data?.adapters ?? [];
  const adapterValue = (adapter: { key?: string; value?: string; name?: string }) =>
    adapter.key ?? adapter.value ?? adapter.name ?? '';

  const canSubmit = adapterKey !== '' && code.trim() !== '' && name.trim() !== '';

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    try {
      await create.mutateAsync({
        adapter_key: adapterKey,
        code: code.trim(),
        name: name.trim(),
        mode,
        notes: notes.trim() || null,
      });
      onOpenChange(false);
    } catch {
      setError(t(($) => $.carriers.createFailed));
    }
  }

  return (
    <PageDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t(($) => $.carriers.newTitle)}
      description={t(($) => $.carriers.newDescription)}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={create.isPending}>
            {t(($) => $.carriers.cancel)}
          </Button>
          <Button onClick={() => void submit()} disabled={!canSubmit || create.isPending}>
            {create.isPending ? t(($) => $.carriers.saving) : t(($) => $.carriers.save)}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="carrier-adapter">{t(($) => $.carriers.adapterLabel)}</Label>
          <select
            id="carrier-adapter"
            value={adapterKey}
            onChange={(e) => setAdapterKey(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="">—</option>
            {adapters.map((adapter) => (
              <option key={adapterValue(adapter)} value={adapterValue(adapter)}>
                {adapter.label ?? adapter.name ?? adapterValue(adapter)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="carrier-code">{t(($) => $.carriers.code)}</Label>
            <Input
              id="carrier-code"
              value={code}
              maxLength={40}
              placeholder={t(($) => $.carriers.codePlaceholder)}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="carrier-name">{t(($) => $.carriers.name)}</Label>
            <Input
              id="carrier-name"
              value={name}
              maxLength={150}
              placeholder={t(($) => $.carriers.namePlaceholder)}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="carrier-mode">{t(($) => $.carriers.mode)}</Label>
          <select
            id="carrier-mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as CarrierMode)}
            className="h-9 rounded-md border bg-background px-2 text-sm"
          >
            <option value="internal">{t(($) => $.carriers.mode_internal)}</option>
            <option value="external">{t(($) => $.carriers.mode_external)}</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="carrier-notes">{t(($) => $.carriers.notes)}</Label>
          <Textarea
            id="carrier-notes"
            rows={3}
            value={notes}
            maxLength={2000}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>
    </PageDrawer>
  );
}
