import { useState } from 'react';
import { useFormatter } from '@/hooks/use-formatter';
import { Settings, LogOut, RotateCcw, Clock, DollarSign } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { SessionDialog } from '@/features/pos/components/session-dialog';
import { ShiftDialog } from '@/features/pos/components/shift-dialog';
import { useSession, useShift } from '@/features/pos/hooks/use-pos-queries';
import { usePosStore } from '@/features/pos/store/pos-store';

export function ManagerPanel() {
  const { money } = useFormatter();
  const { sessionId, shiftId } = usePosStore();
  const [sessionDialogMode, setSessionDialogMode] = useState<'open' | 'close' | null>(null);
  const [shiftDialogMode, setShiftDialogMode] = useState<'open' | 'close' | 'approve' | null>(null);

  const { data: session } = useSession();
  const { data: shift } = useShift();

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Settings className="size-5 text-muted-foreground" />
        <h2 className="text-base font-semibold">Manager Panel</h2>
      </div>

      <Separator />

      {/* Session section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Session</span>
          <Badge
            variant={session?.status === 'open' ? 'default' : 'secondary'}
            className="text-[10px]"
          >
            {session?.status ?? 'No session'}
          </Badge>
        </div>

        {!sessionId ? (
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => setSessionDialogMode('open')}
          >
            <Clock className="size-4" />
            Open Session
          </Button>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-mono">{sessionId}</p>
            <Button
              variant="outline"
              className="w-full gap-2 text-destructive hover:text-destructive"
              onClick={() => setSessionDialogMode('close')}
            >
              <LogOut className="size-4" />
              Close Session
            </Button>
          </div>
        )}
      </div>

      <Separator />

      {/* Shift section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Shift</span>
          <Badge
            variant={shift?.status === 'open' ? 'default' : 'secondary'}
            className="text-[10px]"
          >
            {shift?.status ?? 'No shift'}
          </Badge>
        </div>

        {!shiftId ? (
          <Button
            variant="outline"
            className="w-full gap-2"
            disabled={!sessionId}
            onClick={() => setShiftDialogMode('open')}
          >
            <DollarSign className="size-4" />
            Open Shift
          </Button>
        ) : (
          <div className="space-y-1.5">
            {shift && (
              <div className="rounded bg-muted p-2 text-xs space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Opening Cash</span>
                  <span className="tabular-nums">{money(Number(shift.opening_cash.amount), shift.opening_cash.currency)}</span>
                </div>
                {shift.closing_count && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Closing Count</span>
                    <span className="tabular-nums">{money(Number(shift.closing_count.amount), shift.closing_count.currency)}</span>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShiftDialogMode('close')}
                disabled={shift?.status !== 'open'}
              >
                <RotateCcw className="size-4" />
                Close
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setShiftDialogMode('approve')}
                disabled={shift?.status !== 'closing'}
              >
                <Settings className="size-4" />
                Approve
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      {sessionDialogMode && (
        <SessionDialog
          open
          mode={sessionDialogMode}
          onOpenChange={(open) => !open && setSessionDialogMode(null)}
        />
      )}
      {shiftDialogMode && (
        <ShiftDialog
          open
          mode={shiftDialogMode}
          onOpenChange={(open) => !open && setShiftDialogMode(null)}
        />
      )}
    </div>
  );
}
