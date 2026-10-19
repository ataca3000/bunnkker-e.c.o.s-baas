import { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import type { DriverAcceptancePayload, TripStatus } from '../types/distribution-board';
import { TRIP_STATUS_LABELS, TRIP_STATUS_COLORS } from '../types/distribution-board';
import { cn } from '@/lib/utils';

interface Props {
  tripId: string;
  tripStatus: TripStatus;
  driverAcceptedProducts: boolean;
  driverAcceptedCustody: boolean;
  driverAcceptedEquipment: boolean;
  driverAcceptanceAt: string | null;
  acceptingUserName: string | null;
  hasDiscrepancy: boolean;
  discrepancyNotes: string | null;
  onAccept: (payload: DriverAcceptancePayload) => void;
  isPending: boolean;
}

const CONFIRMATIONS = [
  {
    key: 'products_accepted' as const,
    label: 'Products',
    description: 'I confirm I received the loaded products.',
  },
  {
    key: 'custody_accepted' as const,
    label: 'Custody',
    description: 'I confirm I received all assigned custody items.',
  },
  {
    key: 'equipment_accepted' as const,
    label: 'Equipment',
    description: 'I confirm I received all operational equipment.',
  },
];

export function DriverAcceptanceForm({
  tripStatus,
  driverAcceptedProducts,
  driverAcceptedCustody,
  driverAcceptedEquipment,
  driverAcceptanceAt,
  acceptingUserName,
  hasDiscrepancy,
  discrepancyNotes,
  onAccept,
  isPending,
}: Props) {
  const [checks, setChecks] = useState({
    products_accepted:  false,
    custody_accepted:   false,
    equipment_accepted: false,
  });
  const [showDiscrepancy, setShowDiscrepancy]       = useState(false);
  const [discrepancyText, setDiscrepancyText]       = useState('');
  const [confirmOpen, setConfirmOpen]               = useState(false);
  const [discrepancyConfirmOpen, setDiscConfirmOpen] = useState(false);

  const isAlreadyAccepted = tripStatus === 'driver_accepted' || tripStatus === 'dispatch_blocked';
  const allChecked = checks.products_accepted && checks.custody_accepted && checks.equipment_accepted;

  if (isAlreadyAccepted) {
    return (
      <div className="space-y-4">
        <div className={cn(
          'flex items-start gap-3 p-4 rounded-lg border',
          hasDiscrepancy
            ? 'border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20'
            : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20',
        )}>
          {hasDiscrepancy ? (
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
          )}
          <div>
            <div className="font-semibold text-sm">
              {hasDiscrepancy ? 'Discrepancy Reported — Dispatch Blocked' : 'Driver Acceptance Confirmed'}
            </div>
            {driverAcceptanceAt && (
              <div className="text-xs text-muted-foreground mt-0.5">
                {new Date(driverAcceptanceAt).toLocaleString('en-US')}
                {acceptingUserName && ` · ${acceptingUserName}`}
              </div>
            )}
            {hasDiscrepancy && discrepancyNotes && (
              <p className="text-sm text-red-700 dark:text-red-400 mt-2">{discrepancyNotes}</p>
            )}
          </div>
        </div>

        {/* Show which confirmations were recorded */}
        <div className="space-y-2">
          {CONFIRMATIONS.map((c) => {
            const accepted = c.key === 'products_accepted' ? driverAcceptedProducts
              : c.key === 'custody_accepted'  ? driverAcceptedCustody
              : driverAcceptedEquipment;
            return (
              <div key={c.key} className="flex items-center gap-3 p-3 rounded-lg border">
                <CheckCircle2 className={cn('h-4 w-4 shrink-0', accepted ? 'text-emerald-500' : 'text-muted-foreground')} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{c.label}</div>
                  <div className="text-xs text-muted-foreground">{c.description}</div>
                </div>
                <span className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-medium',
                  accepted
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'bg-muted text-muted-foreground',
                )}>
                  {accepted ? 'Confirmed' : 'Not Confirmed'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Current trip status */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Trip Status:</span>
          <span className={cn('px-2 py-0.5 rounded-md font-medium', TRIP_STATUS_COLORS[tripStatus])}>
            {TRIP_STATUS_LABELS[tripStatus]}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        The driver must explicitly confirm receipt of products, custody items, and operational equipment.
        All three confirmations are required before obtaining dispatch authorization.
      </p>

      {/* 3 checkboxes */}
      <div className="space-y-3">
        {CONFIRMATIONS.map((c) => (
          <label
            key={c.key}
            className={cn(
              'flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
              checks[c.key]
                ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20'
                : 'border-border hover:border-muted-foreground/40',
            )}
          >
            <Checkbox
              className="mt-0.5"
              checked={checks[c.key]}
              onCheckedChange={(v) => setChecks((prev) => ({ ...prev, [c.key]: !!v }))}
            />
            <div>
              <div className="font-medium text-sm">{c.label}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{c.description}</div>
            </div>
          </label>
        ))}
      </div>

      {/* Discrepancy toggle */}
      <div className="flex items-center gap-2 pt-1">
        <Checkbox
          id="flag-discrepancy"
          checked={showDiscrepancy}
          onCheckedChange={(v) => setShowDiscrepancy(!!v)}
        />
        <Label htmlFor="flag-discrepancy" className="text-sm cursor-pointer text-amber-700 dark:text-amber-400">
          Report Discrepancy (blocks dispatch until resolved)
        </Label>
      </div>

      {showDiscrepancy && (
        <div className="space-y-1.5">
          <Label htmlFor="discrepancy-notes" className="text-xs text-muted-foreground">
            Discrepancy Details
          </Label>
          <Textarea
            id="discrepancy-notes"
            placeholder="Describe the discrepancy in detail..."
            value={discrepancyText}
            onChange={(e) => setDiscrepancyText(e.target.value)}
            rows={3}
            className="text-sm"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        {showDiscrepancy ? (
          <Button
            variant="destructive"
            className="flex-1"
            disabled={!allChecked || !discrepancyText.trim() || isPending}
            onClick={() => setDiscConfirmOpen(true)}
          >
            <AlertTriangle className="h-4 w-4 mr-1.5" />
            Submit with Discrepancy
          </Button>
        ) : (
          <Button
            className="flex-1"
            disabled={!allChecked || isPending}
            onClick={() => setConfirmOpen(true)}
          >
            Confirm Driver Acceptance
          </Button>
        )}
      </div>

      {/* Confirm normal acceptance */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Driver Acceptance?</AlertDialogTitle>
            <AlertDialogDescription>
              The driver has confirmed receipt of all products, custody items, and equipment.
              The trip will move to <strong>Driver Accepted</strong> status and become ready for dispatch.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmOpen(false);
                onAccept({ products_accepted: true, custody_accepted: true, equipment_accepted: true, has_discrepancy: false });
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm discrepancy */}
      <AlertDialog open={discrepancyConfirmOpen} onOpenChange={setDiscConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Report Discrepancy?</AlertDialogTitle>
            <AlertDialogDescription>
              The trip will be marked as <strong>Dispatch Blocked</strong>. A supervisor must review
              and resolve the discrepancy before the vehicle can be dispatched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setDiscConfirmOpen(false);
                onAccept({
                  products_accepted: true,
                  custody_accepted: true,
                  equipment_accepted: true,
                  has_discrepancy: true,
                  discrepancy_notes: discrepancyText.trim(),
                });
              }}
            >
              Report and Block Dispatch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
