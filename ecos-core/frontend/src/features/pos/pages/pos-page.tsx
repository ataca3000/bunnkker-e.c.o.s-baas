import { useState } from 'react';
import { Monitor, Clock, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PosWorkspace } from '@/features/pos/components/pos-workspace';
import { PosErrorBoundary } from '@/features/pos/components/pos-error-boundary';
import { SessionDialog } from '@/features/pos/components/session-dialog';
import { ShiftDialog } from '@/features/pos/components/shift-dialog';
import { usePosStore } from '@/features/pos/store/pos-store';
import { useSession, useShift } from '@/features/pos/hooks/use-pos-queries';

type Gate = 'loading' | 'no-session' | 'no-shift' | 'ready';

export function PosPage() {
  const { sessionId, shiftId } = usePosStore();
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);

  const { data: session, isLoading: sessionLoading } = useSession();
  const { data: shift, isLoading: shiftLoading } = useShift();

  // Determine gate state
  let gate: Gate = 'loading';
  if (!sessionLoading && !shiftLoading) {
    if (!sessionId || session?.status !== 'open') {
      gate = 'no-session';
    } else if (!shiftId || shift?.status !== 'open') {
      gate = 'no-shift';
    } else {
      gate = 'ready';
    }
  }

  if (gate === 'loading') {
    return (
      <div className="flex h-svh items-center justify-center text-sm text-muted-foreground">
        <div className="space-y-2 text-center">
          <Monitor className="mx-auto size-8 animate-pulse" />
          <p>Loading POS...</p>
        </div>
      </div>
    );
  }

  if (gate === 'no-session') {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-muted">
            <Monitor className="size-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold">No Active Session</h1>
          <p className="text-sm text-muted-foreground max-w-xs">
            Open a POS session to start processing sales on this terminal.
          </p>
        </div>
        <Button onClick={() => setSessionDialogOpen(true)} size="lg" className="gap-2">
          <Monitor className="size-4" />
          Open Session
        </Button>

        {sessionDialogOpen && (
          <SessionDialog
            open
            mode="open"
            onOpenChange={setSessionDialogOpen}
          />
        )}
      </div>
    );
  }

  if (gate === 'no-shift') {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-6">
        <div className="space-y-2 text-center">
          <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-muted">
            <Clock className="size-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-semibold">No Active Shift</h1>
          <p className="text-sm text-muted-foreground max-w-xs">
            Open a shift to begin. The opening cash count will be recorded.
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setSessionDialogOpen(true)}
            className="gap-2"
          >
            <AlertTriangle className="size-4" />
            Close Session
          </Button>
          <Button onClick={() => setShiftDialogOpen(true)} size="lg" className="gap-2">
            <Clock className="size-4" />
            Open Shift
          </Button>
        </div>

        {sessionDialogOpen && (
          <SessionDialog
            open
            mode="close"
            onOpenChange={setSessionDialogOpen}
          />
        )}
        {shiftDialogOpen && (
          <ShiftDialog
            open
            mode="open"
            onOpenChange={setShiftDialogOpen}
          />
        )}
      </div>
    );
  }

  // gate === 'ready'
  return (
    <PosErrorBoundary>
      <PosWorkspace />
    </PosErrorBoundary>
  );
}
