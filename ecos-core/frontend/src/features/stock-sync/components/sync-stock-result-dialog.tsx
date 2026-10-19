import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { SyncStockResult } from '@/features/stock-sync/types/stock-sync';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: SyncStockResult | null;
  channelName?: string;
};

export function SyncStockResultDialog({ open, onOpenChange, result, channelName }: Props) {
  const { t } = useTranslation('stock-sync');

  if (!result) return null;

  const allSucceeded = result.errors === 0 && result.synced > 0;
  const hasErrors = result.errors > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t($ => $.dialog.title)}</DialogTitle>
          <DialogDescription>
            {channelName ? t($ => $.dialog.subtitle, { name: channelName }) : t($ => $.dialog.subtitleGeneric)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            <Stat label={t($ => $.dialog.total)} value={result.total} />
            <Stat label={t($ => $.dialog.synced)} value={result.synced} />
            <Stat label={t($ => $.dialog.errors)} value={result.errors} highlight={hasErrors} />
          </div>

          {allSucceeded && (
            <div className="flex items-center gap-1.5 text-sm text-emerald-600">
              <CheckCircle2 className="size-4" />
              {t($ => $.dialog.allSuccess)}
            </div>
          )}

          {hasErrors && (
            <div className="flex items-center gap-1.5 text-sm text-rose-600">
              <AlertCircle className="size-4" />
              {t($ => $.dialog.someErrors)}
            </div>
          )}

          {result.total === 0 && (
            <p className="text-muted-foreground text-sm">{t($ => $.dialog.noMappings)}</p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>{t($ => $.dialog.close)}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="bg-muted/50 flex flex-col rounded-md p-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`text-xl font-bold ${highlight ? 'text-rose-600' : ''}`}>{value}</span>
    </div>
  );
}
