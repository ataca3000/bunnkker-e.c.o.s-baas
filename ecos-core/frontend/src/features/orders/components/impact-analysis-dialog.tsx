import { AlertTriangle, CheckCircle2, MapPin, Route, Truck, XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import type { OrderDistributionStage } from '@/features/operations/distribution-board/types/distribution-board';

interface Props {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  stage: OrderDistributionStage;
}

export function ImpactAnalysisDialog({ open, onConfirm, onCancel, stage }: Props) {
  const { t } = useTranslation('orders');
  const isCritical = stage.trip_status === 'out_for_delivery';
  const isWarning  = ['loading', 'loading_completed', 'driver_accepted', 'dispatch_blocked'].includes(stage.trip_status);

  const Icon = isCritical ? XCircle : isWarning ? AlertTriangle : AlertTriangle;
  const iconClass = isCritical
    ? 'text-red-500'
    : isWarning
    ? 'text-amber-500'
    : 'text-amber-500';

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) onCancel(); }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Icon className={`size-5 ${iconClass}`} />
            {t($ => $.impactDialog.title)}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm text-foreground">
              {/* Stage info */}
              <div className="rounded-md border bg-muted/40 px-3 py-2.5 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">
                    {stage.stage}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Truck className="size-3" />
                    {stage.trip_number}
                    {stage.trip_name ? ` · ${stage.trip_name}` : ''}
                  </span>
                  {stage.wave_number ? (
                    <span className="flex items-center gap-1">
                      <Route className="size-3" />
                      {t($ => $.impactDialog.wave, { number: stage.wave_number })}
                    </span>
                  ) : null}
                  {stage.governorate ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="size-3" />
                      {stage.governorate}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Impact list */}
              {stage.impact_list.length > 0 ? (
                <div>
                  <p className="font-medium text-xs uppercase tracking-wider text-muted-foreground mb-1.5">
                    {t($ => $.impactDialog.whatWillHappen)}
                  </p>
                  <ul className="space-y-1">
                    {stage.impact_list.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-xs">
                        <CheckCircle2 className="size-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Manifest note */}
              {stage.manifest_exists ? (
                <p className="text-xs text-muted-foreground border-t pt-2">
                  {t($ => $.impactDialog.manifestNote)}
                </p>
              ) : null}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{t($ => $.statusSelector.cancel)}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={isCritical ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            {isCritical ? t($ => $.impactDialog.saveAnyway) : t($ => $.impactDialog.confirmSave)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
