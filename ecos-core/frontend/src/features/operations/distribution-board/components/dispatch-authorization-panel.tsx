import { AlertTriangle, CheckCircle2, Loader2, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { DispatchIssue } from '../types/distribution-board';

interface DispatchAuthorizationPanelProps {
  canDispatch: boolean;
  issues: DispatchIssue[];
  tripNumber: string;
  onDispatch: () => void;
  dispatchPending: boolean;
  isDispatched: boolean;
}

export function DispatchAuthorizationPanel({
  canDispatch,
  issues,
  tripNumber,
  onDispatch,
  dispatchPending,
  isDispatched,
}: DispatchAuthorizationPanelProps) {
  if (isDispatched) {
    return (
      <div className="flex items-center justify-center gap-3 py-8 text-emerald-600 dark:text-emerald-400">
        <Truck className="h-8 w-8" />
        <div>
          <p className="font-semibold text-base">Trip Dispatched</p>
          <p className="text-sm text-muted-foreground">Driver is on the way.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Dispatch conditions checklist */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Dispatch Conditions
        </p>

        <ConditionRow ok={issues.every((i) => !i.message.includes('product'))} label="Driver received all products" />
        <ConditionRow ok={issues.every((i) => !i.message.includes('discrepanc'))} label="No pending product discrepancies" />
        <ConditionRow ok={issues.every((i) => !i.message.includes('custody'))} label="All custody items handed over" />
        <ConditionRow ok={canDispatch} label="All conditions met — Ready to dispatch" />
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="space-y-1.5">
          {issues.map((issue, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-md px-3 py-2"
            >
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{issue.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Dispatch button */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            className="w-full gap-2 h-10"
            disabled={!canDispatch || dispatchPending}
          >
            {dispatchPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Truck className="h-4 w-4" />
            )}
            Authorize Dispatch
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Authorize Dispatch?</AlertDialogTitle>
            <AlertDialogDescription>
              Trip <strong>{tripNumber}</strong> will be dispatched. The driver has confirmed receipt of all products and custody items.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={onDispatch}
            >
              Yes, Dispatch Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ConditionRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`}>
      <CheckCircle2 className={`h-4 w-4 shrink-0 ${ok ? '' : 'opacity-30'}`} />
      <span>{label}</span>
    </div>
  );
}
