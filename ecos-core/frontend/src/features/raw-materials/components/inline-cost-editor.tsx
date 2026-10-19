import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { useCompany } from '@/features/organization/context/company-context';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

type Props = {
  materialId:   string;
  currentCost:  number | null | undefined;
  canEdit:      boolean;
  isSaving:     boolean;
  onSave:       (id: string, newCost: number, reason: string) => void;
};

export function InlineCostEditor({ materialId, currentCost, canEdit, isSaving, onSave }: Props) {
  const { t } = useTranslation('raw-materials');
  const { currency, locale } = useCompany();
  const fmtCost = (n: number | null | undefined) =>
    n == null ? '—' : formatMoney(n, currency, locale);
  const [open,    setOpen]    = useState(false);
  const [cost,    setCost]    = useState('');
  const [reason,  setReason]  = useState('');
  const [touched, setTouched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setCost(currentCost != null ? String(currentCost) : '');
      setReason('');
      setTouched(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, currentCost]);

  const costVal   = parseFloat(cost);
  const costValid = !Number.isNaN(costVal) && costVal >= 0;
  const canSave   = costValid && reason.trim().length >= 3 && !isSaving;

  function handleSave() {
    if (!canSave) { setTouched(true); return; }
    onSave(materialId, costVal, reason.trim());
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') { setOpen(false); }
  }

  const reasonError = touched && reason.trim().length < 3;
  const costError   = touched && !costValid;

  if (!canEdit) {
    return (
      <span className="text-sm font-medium tabular-nums">{fmtCost(currentCost)}</span>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'group inline-flex items-center gap-1.5 rounded px-1 -mx-1',
            'text-sm font-medium tabular-nums text-end',
            'hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
          aria-label={t($ => $.costEditor.ariaLabel, { cost: fmtCost(currentCost) })}
        >
          <span>{fmtCost(currentCost)}</span>
          <Pencil className="size-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-72 p-4"
        side="left"
        align="center"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <p className="text-sm font-semibold mb-3">{t($ => $.costEditor.title)}</p>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`cost-input-${materialId}`} className="text-xs">
              {t($ => $.costEditor.newCostLabel)}{' '}
              <span className="text-muted-foreground">({currency})</span>
            </Label>
            <Input
              id={`cost-input-${materialId}`}
              ref={inputRef}
              type="number"
              min="0"
              step="0.01"
              value={cost}
              onChange={(e) => { setCost(e.target.value); setTouched(false); }}
              placeholder={t($ => $.costEditor.newCostPlaceholder)}
              className={cn('h-8 text-sm', costError && 'border-destructive')}
            />
            {costError && (
              <p className="text-xs text-destructive">{t($ => $.costEditor.costError)}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={`reason-input-${materialId}`} className="text-xs">
              {t($ => $.costEditor.reasonLabel)}{' '}
              <span className="text-destructive">{t($ => $.costEditor.reasonRequired)}</span>
            </Label>
            <Textarea
              id={`reason-input-${materialId}`}
              value={reason}
              onChange={(e) => { setReason(e.target.value); setTouched(false); }}
              placeholder={t($ => $.costEditor.reasonPlaceholder)}
              rows={3}
              className={cn('text-sm resize-none', reasonError && 'border-destructive')}
            />
            {reasonError && (
              <p className="text-xs text-destructive">{t($ => $.costEditor.reasonError)}</p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              className="flex-1"
              onClick={handleSave}
              disabled={!canSave}
            >
              {isSaving ? t($ => $.costEditor.saving) : t($ => $.costEditor.save)}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={isSaving}
            >
              {t($ => $.costEditor.cancel)}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
