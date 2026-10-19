import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { History } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  entityType?: string;
  entityId?: string;
}

/**
 * PATCH-CORE-001 — Replay Drawer Placeholder.
 * Full Replay UI is deferred to a future sprint.
 * This placeholder reserves the entry point and wires the route.
 */
export function ReplayDrawerPlaceholder({ open, onClose, entityType, entityId }: Props) {
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="w-[480px] sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Entity Replay
            <Badge variant="secondary" className="text-xs ml-1">Developer Preview</Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {entityType && entityId && (
            <div className="rounded-md border bg-muted/30 p-3 text-xs font-mono space-y-1">
              <div><span className="text-muted-foreground">entity_type: </span>{entityType}</div>
              <div><span className="text-muted-foreground">entity_id: </span>{entityId}</div>
            </div>
          )}

          <div className="rounded-md border border-dashed p-8 text-center space-y-2">
            <History className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">Replay UI — Coming Soon</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              The Enterprise Replay Engine (PATCH-CORE-001) is complete.
              The interactive Replay UI is scheduled for the next sprint.
            </p>
          </div>

          <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 space-y-1">
            <p className="text-xs font-medium text-blue-700 dark:text-blue-400">Available API Endpoints</p>
            <ul className="text-xs text-blue-600 dark:text-blue-500 space-y-0.5 font-mono">
              <li>GET /bae/replay/entity/{'{entityType}'}/{'{entityId}'}</li>
              <li>GET /bae/time-machine/{'{entityType}'}/{'{entityId}'}?at=</li>
              <li>GET /bae/cause-effect/{'{eventId}'}</li>
              <li>GET /bae/replay/audit</li>
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
